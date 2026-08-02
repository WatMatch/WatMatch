import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
USERS_CONTROLLER_PATH = BACKEND_ROOT / "src" / "users" / "controller.py"


def _normalized_controller() -> str:
    return USERS_CONTROLLER_PATH.read_text(encoding="utf-8").lower()


def _route_body(controller: str, function_name: str) -> str:
    pattern = re.compile(rf"\basync\s+def\s+{re.escape(function_name.lower())}\s*\(")
    match = pattern.search(controller)
    if not match:
        raise AssertionError(f"Route function {function_name} was not found")

    next_route = controller.find("\n\n@router.", match.end())
    if next_route == -1:
        return controller[match.start() :]
    return controller[match.start() : next_route]


def _assert_in_order(test_case: unittest.TestCase, body: str, fragments: list[str]) -> None:
    cursor = -1
    for fragment in fragments:
        next_index = body.find(fragment, cursor + 1)
        test_case.assertNotEqual(
            next_index,
            -1,
            f"Expected to find {fragment!r} after position {cursor}",
        )
        cursor = next_index


class InstructorRosterContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.controller = _normalized_controller()
        cls.route = _route_body(cls.controller, "get_course_roster")

    def test_roster_route_is_course_scoped_and_instructor_safe(self) -> None:
        expected_fragments = [
            'role not in {"instructor", "admin"}',
            "instructor_course_fk = current_user.get(\"course_fk\")",
            'role == "instructor" and instructor_course_fk is none',
            '"success": true, "data": []',
            '.eq("course_fk", instructor_course_fk)',
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.route)

    def test_instructor_scope_includes_same_course_students_and_their_teammates(self) -> None:
        _assert_in_order(
            self,
            self.route,
            [
                "same_course_student_ids",
                "scoped_team_rows",
                'supabase.table("team_memberships")',
                '.select("team_fk")',
                "scoped_team_ids",
                "teammate_rows",
                'supabase.table("team_memberships")',
                '.select("user_fk")',
                "visible_student_ids.update",
                'users_query = users_query.in_("user_id", sorted(visible_student_ids))',
            ],
        )

    def test_roster_response_preserves_course_team_capstone_and_home_department_context(self) -> None:
        expected_fragments = [
            '.select("user_id,email,role,course_fk,home_department_fk,active_team_fk")',
            'supabase.table("departments")',
            '.select("department_id,name,active")',
            'supabase.table("teams")',
            '.select("team_id,leader_fk,status,course_fk,capstone_fk")',
            'supabase.table("capstones")',
            '.select("capstone_id,title,status,approval,course_fk")',
            '"home_department_id": student.get("home_department_fk")',
            '"home_department": departments_map.get',
            '"team": team',
            '"capstone": capstone',
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.route)


if __name__ == "__main__":
    unittest.main()
