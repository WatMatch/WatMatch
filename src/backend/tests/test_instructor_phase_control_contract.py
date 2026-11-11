import re
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
CLIENT_ROOT = BACKEND_ROOT.parent / "client"
SCHEMA_PATH = BACKEND_ROOT / "db" / "schema.sql"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


database_stub = types.ModuleType("src.config.database")
database_stub.supabase = object()
rpc_utils_stub = types.ModuleType("src.workflow.rpc_utils")
rpc_utils_stub.call_json_rpc = lambda *_args, **_kwargs: None

with patch.dict(
    sys.modules,
    {
        "src.config.database": database_stub,
        "src.workflow.rpc_utils": rpc_utils_stub,
    },
):
    from src.courses.courses_bl import CoursesBusinessLogic


class InstructorPhaseControlSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = SCHEMA_PATH.read_text(encoding="utf-8").lower()

    def function_sql(self, name: str) -> str:
        match = re.search(
            rf"\bcreate\s+or\s+replace\s+function\s+{re.escape(name)}\s*\(", self.schema
        )
        self.assertIsNotNone(match, f"{name} was not found in schema.sql")
        return self.schema[match.start() : self.schema.index("\n$$;", match.end())]

    def assert_in_order(self, body: str, fragments: list[str]) -> None:
        cursor = -1
        for fragment in fragments:
            cursor = body.find(fragment, cursor + 1)
            self.assertNotEqual(cursor, -1, f"Expected {fragment!r} in order")

    def test_flag_defaults_off(self) -> None:
        self.assertTrue(
            "add column if not exists instructor_phase_control boolean not null default false"
            in self.schema,
            "courses.instructor_phase_control column is missing from schema.sql",
        )

    def test_instructor_advance_checks_run_in_safe_order(self) -> None:
        self.assert_in_order(
            self.function_sql("watmatch_instructor_advance_course_phase"),
            [
                "lower(coalesce(role, '')) = 'instructor'",
                "course_fk = p_course_id",
                "for update",
                "instructor_phase_control is not true",
                "watmatch_effective_marketplace_phase_for_course",
                "p_expected_phase",
                "project_commitment_requests",
                "update courses",
                "insert into audit_log",
            ],
        )

    def test_admin_toggle_requires_admin_and_standard_course(self) -> None:
        self.assert_in_order(
            self.function_sql("watmatch_admin_set_course_instructor_phase_control"),
            [
                "watmatch_assert_admin_actor",
                "routing_kind",
                "update courses",
                "insert into audit_log",
            ],
        )

    def test_term_rollover_clears_instructor_overrides(self) -> None:
        self.assertTrue(
            "after update of current_term on marketplace_settings" in self.schema,
            "term-rollover trigger is missing from schema.sql",
        )
        self.assert_in_order(
            self.function_sql("watmatch_clear_instructor_phase_overrides_on_term_change"),
            [
                "update courses",
                "marketplace_phase_override = null",
                "instructor_phase_control is true",
            ],
        )


class FakeCoursesData:
    def __init__(self) -> None:
        self.calls = []
        self.error = None

    def advance_course_phase_rpc(self, **kwargs):
        if self.error:
            raise self.error
        self.calls.append(("advance", kwargs))
        return {"success": True, "message": "ok", "data": kwargs}

    def set_instructor_phase_control_rpc(self, **kwargs):
        self.calls.append(("toggle", kwargs))
        return {"success": True, "message": "ok", "data": kwargs}


class InstructorPhaseControlBusinessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.data = FakeCoursesData()
        self.logic = CoursesBusinessLogic.__new__(CoursesBusinessLogic)
        self.logic.courses_data = self.data

    def test_advance_rejects_unknown_phase_without_calling_database(self) -> None:
        result = self.logic.advance_course_phase(7, "locked", 99)

        self.assertFalse(result["success"])
        self.assertEqual(self.data.calls, [])

    def test_advance_normalizes_expected_phase_before_rpc(self) -> None:
        result = self.logic.advance_course_phase(7, "  Commitment ", 99)

        self.assertTrue(result["success"])
        self.assertEqual(
            self.data.calls,
            [("advance", {"course_id": 7, "expected_phase": "commitment", "actor_id": 99})],
        )

    def test_advance_turns_database_errors_into_failures(self) -> None:
        self.data.error = RuntimeError("Resolve 2 pending commitment request(s)")

        result = self.logic.advance_course_phase(7, "commitment", 99)

        self.assertFalse(result["success"])
        self.assertIn("pending commitment", result["message"])

    def test_toggle_rejects_invalid_course_id(self) -> None:
        result = self.logic.set_instructor_phase_control(0, True, 99)

        self.assertFalse(result["success"])
        self.assertEqual(self.data.calls, [])

    def test_toggle_forwards_flag(self) -> None:
        result = self.logic.set_instructor_phase_control(7, True, 99)

        self.assertTrue(result["success"])
        self.assertEqual(
            self.data.calls,
            [("toggle", {"course_id": 7, "enabled": True, "actor_id": 99})],
        )


class InstructorPhaseControlWiringTests(unittest.TestCase):
    def test_client_and_api_agree_on_routes_and_guards(self) -> None:
        service = (CLIENT_ROOT / "src" / "services" / "courses.service.ts").read_text(
            encoding="utf-8"
        )
        controller = (BACKEND_ROOT / "src" / "courses" / "controller.py").read_text(
            encoding="utf-8"
        )

        for path in ("/phase/advance", "/instructor-phase-control"):
            self.assertIn(path, service)
            self.assertIn(path, controller)
        self.assertIn("Depends(get_current_instructor)", controller)
