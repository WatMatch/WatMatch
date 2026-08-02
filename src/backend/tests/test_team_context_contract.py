import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
TEAMS_CONTROLLER_PATH = BACKEND_ROOT / "src" / "teams" / "controller.py"
TEAMS_BUSINESS_PATH = BACKEND_ROOT / "src" / "teams" / "teams_bl.py"


def _source(path: Path) -> str:
    return path.read_text(encoding="utf-8").lower()


def _method_body(source: str, method_name: str) -> str:
    match = re.search(rf"\n    def {re.escape(method_name.lower())}\s*\(", source)
    if not match:
        raise AssertionError(f"Method {method_name} was not found")
    next_method = source.find("\n    def ", match.end())
    return source[match.start() : next_method if next_method != -1 else None]


class TeamContextContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.controller = _source(TEAMS_CONTROLLER_PATH)
        cls.business = _source(TEAMS_BUSINESS_PATH)
        cls.context_method = _method_body(cls.business, "get_capstone_team_context")
        cls.readiness_method = _method_body(
            cls.business, "_build_finalization_readiness_items"
        )

    def test_context_route_is_authenticated_and_maps_access_errors(self) -> None:
        self.assertIn('@router.get("/capstone/{capstone_id}/context")', self.controller)
        self.assertIn("depends(get_current_user)", self.controller)
        self.assertIn('raise httpexception(status_code=403', self.controller)
        self.assertIn('raise httpexception(status_code=404', self.controller)

    def test_context_requires_official_membership_or_existing_staff_scope(self) -> None:
        expected = [
            "member_ids = get_team_member_ids",
            'role == "student" and is_member',
            'role in {"academic_advisor", "enrollment_operator"}',
            "_is_instructor_scoped_to_capstone",
            "official team membership or scoped staff access required",
        ]
        for fragment in expected:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.context_method)

    def test_member_payload_is_summary_only_and_capability_driven(self) -> None:
        expected = [
            '"members": members',
            '"readiness": {',
            '"support_summary": support_summary',
            '"is_official_member": is_member',
            '"can_manage_roster": can_manage',
            '"can_manage_support": can_manage',
        ]
        for fragment in expected:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.context_method)
        self.assertNotIn('"message": request', self.context_method)
        self.assertNotIn('"response_note"', self.context_method)

    def test_readiness_has_stable_server_owned_checks(self) -> None:
        for key in (
            "instructor_approval",
            "project_support",
            "staff_routing",
            "confirmed_explorations",
            "team_identity",
            "official_enrollment",
        ):
            with self.subTest(key=key):
                self.assertIn(f'"key": "{key}"', self.readiness_method)


if __name__ == "__main__":
    unittest.main()
