import ast
import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = BACKEND_ROOT / "db" / "schema.sql"
CAPSTONES_BUSINESS_PATH = BACKEND_ROOT / "src" / "capstones" / "capstones_bl.py"


def _function_sql(schema_sql: str, function_name: str) -> str:
    pattern = re.compile(
        rf"\bcreate\s+or\s+replace\s+function\s+{re.escape(function_name.lower())}\s*\(",
        re.IGNORECASE,
    )
    match = pattern.search(schema_sql)
    if not match:
        raise AssertionError(f"Function {function_name} was not found in schema.sql")

    terminator = schema_sql.find("\n$$;", match.end())
    if terminator == -1:
        raise AssertionError(f"Function {function_name} does not end with a $$; terminator")
    return schema_sql[match.start() : terminator]


def _method_source(module_source: str, class_name: str, method_name: str) -> str:
    module = ast.parse(module_source)
    for node in module.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            for child in node.body:
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name == method_name:
                    return "\n".join(module_source.splitlines()[child.lineno - 1 : child.end_lineno])
    raise AssertionError(f"Method {class_name}.{method_name} was not found")


def _assigned_literal(module_source: str, variable_name: str):
    module = ast.parse(module_source)
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue
        if any(isinstance(target, ast.Name) and target.id == variable_name for target in node.targets):
            return ast.literal_eval(node.value)
    raise AssertionError(f"Assignment {variable_name} was not found")


class NativeArchivePrivacyContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = SCHEMA_PATH.read_text(encoding="utf-8").lower()
        cls.business_source = CAPSTONES_BUSINESS_PATH.read_text(encoding="utf-8")

    def function_sql(self, function_name: str) -> str:
        return _function_sql(self.schema, function_name)

    def test_native_archive_read_uses_an_explicit_public_projection(self) -> None:
        body = self.function_sql("watmatch_get_past_watmatch_capstones")

        for forbidden in (
            "p.*",
            "p.snapshot",
            "p.source_capstone_fk",
            "p.source_team_fk",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, body)

        expected_public_projection = (
            "p.past_watmatch_capstone_id",
            "p.title",
            "p.description",
            "p.department",
            "p.year",
            "'{}'::text[] as students",
            "p.source_fk",
            "p.completed_term",
            "p.project_start_date",
            "p.problem_area",
            "p.main_objectives",
            "p.scope_of_work",
            "p.deliverables",
            "p.deliverable_types",
            "p.skills",
            "position('@' in coalesce(p.mentor_name, '')) > 0",
            "p.external_partner_name",
            "p.external_partner_organization",
            "is_shortlisted",
            "shortlisted_at",
        )
        for field in expected_public_projection:
            with self.subTest(field=field):
                self.assertIn(field, body)

    def test_saved_native_archive_rows_redact_student_and_mentor_email_values(self) -> None:
        body = self.function_sql("watmatch_list_student_past_capstone_shortlists")
        native_start = body.find("'watmatch'::text as source_type")
        self.assertNotEqual(native_start, -1, "Native saved-inspiration projection was not found")
        native_end = body.find("from student_past_capstone_shortlists s", native_start)
        self.assertNotEqual(native_end, -1, "Native saved-inspiration projection has no source join")
        native_projection = body[native_start:native_end]

        self.assertIn("'{}'::text[] as students", native_projection)
        self.assertNotIn("p.students", native_projection)
        self.assertIn(
            "position('@' in coalesce(p.mentor_name, '')) > 0",
            native_projection,
        )
        self.assertIn("else nullif(btrim(p.mentor_name), '')", native_projection)
        self.assertNotIn("snapshot", native_projection)

    def test_native_publication_uses_public_labels_and_a_curated_snapshot(self) -> None:
        body = self.function_sql("watmatch_apply_capstone_closeout_decision")
        publish_start = body.find("elsif v_decision = 'publish_completed' then")
        self.assertNotEqual(publish_start, -1, "Native publication branch was not found")
        publish_end_marker = "returning past_watmatch_capstone_id into v_native_past_id;"
        publish_end = body.find(publish_end_marker, publish_start)
        self.assertNotEqual(publish_end, -1, "Native publication insert was not found")
        publication = body[publish_start : publish_end + len(publish_end_marker)]

        self.assertIn("join mentor_profiles mp on mp.mentor_fk = mr.mentor_fk", publication)
        self.assertIn("mp.display_name", publication)
        self.assertRegex(
            publication,
            r"coalesce\(v_year,[\s\S]*?\),\s*'\{\}'::text\[\],\s*v_capstone\.course_fk",
        )

        for public_snapshot_field in (
            "'title'",
            "'description'",
            "'department'",
            "'year'",
            "'completed_term'",
            "'project_start_date'",
            "'problem_area'",
            "'main_objectives'",
            "'scope_of_work'",
            "'deliverables'",
            "'deliverable_types'",
            "'skills'",
            "'mentor_name'",
            "'external_partner_name'",
            "'external_partner_organization'",
        ):
            with self.subTest(public_snapshot_field=public_snapshot_field):
                self.assertIn(public_snapshot_field, publication)

        for forbidden in (
            "array_agg(u.email",
            "select u.email",
            "'email'",
            ".email",
            "to_jsonb(v_capstone)",
            "'capstone'",
            "'team'",
            "'members'",
            "watmatch_capstone_support_summary",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, publication)

    def test_business_layer_allowlist_protects_both_native_response_paths(self) -> None:
        public_fields = set(
            _assigned_literal(self.business_source, "_PAST_WATMATCH_PUBLIC_FIELDS")
        )
        for forbidden in (
            "snapshot",
            "source_capstone_fk",
            "source_team_fk",
            "user_id",
            "email",
            "members",
            "support_summary",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, public_fields)

        projector = _method_source(
            self.business_source,
            "CapstonesBusinessLogic",
            "_process_past_watmatch_capstone_data",
        )
        self.assertIn("_PAST_WATMATCH_PUBLIC_FIELDS", projector)
        self.assertIn('public_data["students"] = []', projector)
        self.assertIn('"@" not in mentor_name', projector)

        native_list = _method_source(
            self.business_source,
            "CapstonesBusinessLogic",
            "get_past_watmatch_capstones",
        )
        saved_list = _method_source(
            self.business_source,
            "CapstonesBusinessLogic",
            "list_student_past_capstone_shortlists",
        )
        self.assertIn("self._process_past_watmatch_capstone_data(row)", native_list)
        self.assertIn("self._process_past_watmatch_capstone_data(row)", saved_list)
        self.assertIn('== "watmatch"', saved_list)


if __name__ == "__main__":
    unittest.main()
