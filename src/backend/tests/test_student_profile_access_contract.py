import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROFILE_DATA_PATH = (
    BACKEND_ROOT / "src" / "student_profile" / "student_profile_dl.py"
)


def _source() -> str:
    return PROFILE_DATA_PATH.read_text(encoding="utf-8").lower()


def _method_body(source: str, method_name: str) -> str:
    match = re.search(rf"\n    def {re.escape(method_name.lower())}\s*\(", source)
    if not match:
        raise AssertionError(f"Method {method_name} was not found")
    next_method = source.find("\n    def ", match.end())
    return source[match.start() : next_method if next_method != -1 else None]


class StudentProfileAccessContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = _source()
        cls.policy = _method_body(cls.source, "can_view_profile")
        cls.official_team_check = _method_body(
            cls.source, "_students_share_official_team"
        )

    def test_self_admin_and_official_teammates_are_explicitly_allowed(self) -> None:
        expected = [
            "requester_id == student_id",
            'role == "admin"',
            'role == "student" and self._students_share_official_team',
        ]
        for fragment in expected:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.policy)

    def test_official_teammate_check_precedes_private_visibility_denial(self) -> None:
        teammate_index = self.policy.index("self._students_share_official_team")
        private_index = self.policy.index('visibility == "private"')
        self.assertLess(teammate_index, private_index)

    def test_private_override_is_membership_only_not_recruiting_state(self) -> None:
        self.assertIn("_team_ids_for_student(student_id)", self.official_team_check)
        self.assertIn("_team_ids_for_student(requester_id)", self.official_team_check)
        self.assertIn("intersection", self.official_team_check)
        self.assertNotIn("project_explorations", self.official_team_check)

    def test_non_teammate_visibility_rules_remain_scoped(self) -> None:
        private_index = self.policy.index('visibility == "private"')
        all_students_index = self.policy.index('visibility == "students"')
        network_index = self.policy.index("self._students_are_connected")
        self.assertLess(private_index, all_students_index)
        self.assertLess(all_students_index, network_index)


if __name__ == "__main__":
    unittest.main()
