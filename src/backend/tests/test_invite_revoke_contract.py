import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = BACKEND_ROOT / "db" / "schema.sql"
CONTROLLER_PATH = BACKEND_ROOT / "src" / "invites" / "controller.py"
BUSINESS_PATH = BACKEND_ROOT / "src" / "invites" / "invites_bl.py"
DATA_PATH = BACKEND_ROOT / "src" / "invites" / "invites_dl.py"


def _source(path: Path) -> str:
    return path.read_text(encoding="utf-8").lower()


def _function_sql(schema_sql: str, function_name: str) -> str:
    match = re.search(
        rf"\bcreate\s+or\s+replace\s+function\s+{re.escape(function_name.lower())}\s*\(",
        schema_sql,
    )
    if not match:
        raise AssertionError(f"Function {function_name} was not found")
    terminator = schema_sql.find("\n$$;", match.end())
    if terminator == -1:
        raise AssertionError(f"Function {function_name} does not end with $$;")
    return schema_sql[match.start() : terminator]


class InviteRevokeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = _source(SCHEMA_PATH)
        cls.rpc = _function_sql(cls.schema, "watmatch_revoke_invite")
        cls.controller = _source(CONTROLLER_PATH)
        cls.business = _source(BUSINESS_PATH)
        cls.data = _source(DATA_PATH)

    def test_staff_reason_flows_from_http_request_to_rpc(self) -> None:
        expected_by_source = {
            "controller": (self.controller, ["reason: optional[str]", "request.reason"]),
            "business": (self.business, ["normalized_reason", "reason=normalized_reason"]),
            "data": (self.data, ['"p_reason": reason']),
            "rpc": (self.rpc, ["p_reason text default null", "v_reason text"]),
        }
        for layer, (source, fragments) in expected_by_source.items():
            for fragment in fragments:
                with self.subTest(layer=layer, fragment=fragment):
                    self.assertIn(fragment, source)

    def test_staff_reason_is_required_in_business_and_database_layers(self) -> None:
        for source in (self.business, self.rpc):
            with self.subTest(layer="business" if source is self.business else "rpc"):
                self.assertIn("staff invite revocation requires an audit reason", source)
                self.assertIn("admin", source)
                self.assertIn("instructor", source)

    def test_revoke_is_audited_with_reason_and_route_context(self) -> None:
        expected = [
            "insert into audit_log",
            "'project_invite_revoked'",
            "'project_exploration'",
            "coalesce(v_reason, 'team leader revoked pending invitation.')",
            "'previous_status', 'invited'",
            "'new_status', 'declined'",
            "'student_id', v_exploration.student_fk",
            "'staff_initiated'",
        ]
        for fragment in expected:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.rpc)

    def test_student_team_leader_can_still_revoke_without_reason(self) -> None:
        self.assertIn("reason: optional[str] = field(default=none", self.controller)
        self.assertIn("reason: optional[str] = none", self.business)
        self.assertIn("reason: optional[str] = none", self.data)
        self.assertIn("p_reason text default null", self.rpc)
        self.assertIn(
            "v_role in ('admin', 'instructor') and v_reason is null",
            self.rpc,
        )

    def test_legacy_three_argument_rpc_overload_is_removed(self) -> None:
        self.assertRegex(
            self.schema,
            r"drop\s+function\s+if\s+exists\s+watmatch_revoke_invite\s*\(\s*text\s*,\s*bigint\s*,\s*text\s*\)\s*;",
        )


if __name__ == "__main__":
    unittest.main()
