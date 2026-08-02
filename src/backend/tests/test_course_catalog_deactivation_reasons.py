import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = BACKEND_ROOT.parent
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


class FakeCoursesData:
    def __init__(self) -> None:
        self.course = {
            "course_id": 7,
            "code": "SE 490",
            "name": "Design Project",
            "active_terms": ["Fall"],
            "activation_mode": "auto",
            "department_fk": 2,
            "ecosystem_fk": 3,
            "routing_kind": "standard",
            "marketplace_phase_override": "commitment",
            "marketplace_phase_override_reason": "Course-specific review window.",
            "requires_project_support": True,
        }
        self.ecosystem = {
            "ecosystem_id": 3,
            "name": "Future Cities",
            "description": "Shared interdisciplinary projects.",
            "active": True,
        }
        self.course_calls = []
        self.ecosystem_calls = []

    def get_course_by_id(self, course_id):
        return self.course if course_id == self.course["course_id"] else None

    def get_project_ecosystem_by_id(self, ecosystem_id):
        return self.ecosystem if ecosystem_id == self.ecosystem["ecosystem_id"] else None

    def upsert_course_rpc(self, **kwargs):
        self.course_calls.append(kwargs)
        return {"success": True, "message": "Course updated.", "data": kwargs}

    def update_project_ecosystem_rpc(self, **kwargs):
        self.ecosystem_calls.append(kwargs)
        return {"success": True, "message": "Project ecosystem updated.", "data": kwargs}


class CourseCatalogDeactivationReasonTests(unittest.TestCase):
    def setUp(self) -> None:
        self.data = FakeCoursesData()
        self.logic = CoursesBusinessLogic.__new__(CoursesBusinessLogic)
        self.logic.courses_data = self.data

    def update_course(self, *, activation_mode, reason=None):
        return self.logic.update_course(
            course_id=7,
            code=None,
            name=None,
            active_terms=None,
            activation_mode=activation_mode,
            department_id=None,
            department_id_supplied=False,
            ecosystem_id=None,
            ecosystem_id_supplied=False,
            routing_kind=None,
            marketplace_phase_override=None,
            marketplace_phase_override_supplied=False,
            marketplace_phase_override_reason=None,
            marketplace_phase_override_reason_supplied=False,
            requires_project_support=None,
            actor_id=99,
            reason=reason,
        )

    def update_ecosystem(self, *, active, reason=None):
        return self.logic.update_project_ecosystem(
            ecosystem_id=3,
            description="Shared interdisciplinary projects.",
            active=active,
            marketplace_phase_override=None,
            marketplace_phase_override_reason=None,
            actor_id=99,
            reason=reason,
        )

    def test_force_inactive_transition_rejects_missing_reason(self) -> None:
        result = self.update_course(activation_mode="force_inactive", reason="   ")

        self.assertFalse(result["success"])
        self.assertIn("requires an audit reason", result["message"].lower())
        self.assertEqual(self.data.course_calls, [])

    def test_force_inactive_transition_forwards_typed_reason_separately(self) -> None:
        result = self.update_course(
            activation_mode="force_inactive",
            reason="  Program paused for curriculum review.  ",
        )

        self.assertTrue(result["success"])
        call = self.data.course_calls[0]
        self.assertEqual(call["reason"], "Program paused for curriculum review.")
        self.assertEqual(call["marketplace_phase_override"], "commitment")
        self.assertEqual(
            call["marketplace_phase_override_reason"],
            "Course-specific review window.",
        )

    def test_non_destructive_course_edit_keeps_default_audit_reason(self) -> None:
        result = self.update_course(activation_mode="force_active")

        self.assertTrue(result["success"])
        self.assertEqual(self.data.course_calls[0]["reason"], "admin_course_management")

    def test_ecosystem_deactivation_rejects_missing_reason(self) -> None:
        result = self.update_ecosystem(active=False, reason=None)

        self.assertFalse(result["success"])
        self.assertIn("requires an audit reason", result["message"].lower())
        self.assertEqual(self.data.ecosystem_calls, [])

    def test_ecosystem_deactivation_forwards_typed_reason(self) -> None:
        result = self.update_ecosystem(
            active=False,
            reason="  Ecosystem retired after the pilot.  ",
        )

        self.assertTrue(result["success"])
        self.assertEqual(
            self.data.ecosystem_calls[0]["reason"],
            "Ecosystem retired after the pilot.",
        )

    def test_non_destructive_ecosystem_edit_keeps_default_audit_reason(self) -> None:
        result = self.update_ecosystem(active=True)

        self.assertTrue(result["success"])
        self.assertEqual(
            self.data.ecosystem_calls[0]["reason"],
            "admin_project_ecosystem_management",
        )


class CourseCatalogDeactivationWiringTests(unittest.TestCase):
    def test_reason_contract_is_wired_from_ui_to_database_rpc(self) -> None:
        client_service = (
            WORKSPACE_ROOT / "client" / "src" / "services" / "courses.service.ts"
        ).read_text(encoding="utf-8").lower()
        admin_courses = (
            WORKSPACE_ROOT
            / "client"
            / "src"
            / "app"
            / "dashboard"
            / "components"
            / "AdminCoursesSection.tsx"
        ).read_text(encoding="utf-8").lower()
        controller = (BACKEND_ROOT / "src" / "courses" / "controller.py").read_text(
            encoding="utf-8"
        ).lower()
        data_layer = (BACKEND_ROOT / "src" / "courses" / "courses_dl.py").read_text(
            encoding="utf-8"
        ).lower()

        update_course_service = client_service[
            client_service.index("export async function updatecourse") :
            client_service.index("export async function fetchcourseofferings")
        ]
        update_ecosystem_service = client_service[
            client_service.index("export async function updateprojectecosystem") :
            client_service.index("export async function upsertcoursepipelineedge")
        ]

        self.assertIn("reason?: string | null", update_course_service)
        self.assertIn("reason?: string | null", update_ecosystem_service)
        self.assertIn("reason: payload.reason ?? null", update_ecosystem_service)
        self.assertIn("reason: forceinactivereason?.trim() || null", admin_courses)
        self.assertIn("reason: deactivationreason?.trim() || null", admin_courses)
        self.assertGreaterEqual(controller.count("reason=request.reason"), 3)
        self.assertIn('"p_reason": reason', data_layer)


if __name__ == "__main__":
    unittest.main()
