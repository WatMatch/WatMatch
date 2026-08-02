import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PARTNERS_CONTROLLER_PATH = BACKEND_ROOT / "src" / "partners" / "controller.py"


def _route_body(function_name: str) -> str:
    controller = PARTNERS_CONTROLLER_PATH.read_text(encoding="utf-8").lower()
    pattern = re.compile(rf"\basync\s+def\s+{re.escape(function_name.lower())}\s*\(")
    match = pattern.search(controller)
    if not match:
        raise AssertionError(f"Route function {function_name} was not found")

    next_route = controller.find("\n\n@router.", match.end())
    if next_route == -1:
        return controller[match.start() :]
    return controller[match.start() : next_route]


class PartnerTeamContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.route = _route_body("list_my_partner_teams")

    def test_partner_team_lookup_stays_actor_scoped(self) -> None:
        self.assertIn("_require_external_partner(current_user)", self.route)
        self.assertIn('.eq("partner_user_fk", current_user["user_id"])', self.route)
        self.assertIn('.in_("partner_opportunity_fk", opportunity_ids)', self.route)

    def test_partner_team_response_includes_support_confirmation(self) -> None:
        self.assertIn("external_partner_support_confirmed", self.route)
        self.assertIn(
            '"external_partner_support_confirmed": bool(',
            self.route,
        )


if __name__ == "__main__":
    unittest.main()
