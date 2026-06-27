from src.config.database import supabase
from src.workflow.rpc_utils import call_json_rpc
from typing import Optional, Dict, Any


class StudentProfileDataLogic:
    """Data layer for student profile operations"""

    def __init__(self):
        self.table_name = "student_profile"

    def get_profile_by_student_id(self, student_id: int) -> Optional[Dict[Any, Any]]:
        """Get a student profile by student ID"""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("student_fk", student_id)
                .execute()
            )

            if not response.data or len(response.data) == 0:
                return None

            return self._with_departments(response.data[0])

        except Exception as e:
            raise Exception(
                f"Database error in get_profile_by_student_id: {str(e)}")

    def upsert_profile(
        self,
        student_id: int,
        headline: Optional[str],
        about_me: Optional[str],
        skills: Optional[list[str]],
        preferred_roles: Optional[list[str]],
        project_interests: Optional[list[str]],
        interested_department_ids: Optional[list[int]],
        availability: Optional[str],
        portfolio_url: Optional[str],
        linkedin_url: Optional[str],
        github_url: Optional[str],
        profile_visibility: str,
    ) -> Optional[Dict[Any, Any]]:
        """Create or update a student profile through the database RPC."""
        try:
            result = call_json_rpc(
                "watmatch_upsert_student_profile",
                {
                    "p_actor_id": student_id,
                    "p_headline": headline,
                    "p_about_me": about_me,
                    "p_skills": skills or [],
                    "p_preferred_roles": preferred_roles or [],
                    "p_project_interests": project_interests or [],
                    "p_interested_department_ids": interested_department_ids or [],
                    "p_availability": availability,
                    "p_portfolio_url": portfolio_url,
                    "p_linkedin_url": linkedin_url,
                    "p_github_url": github_url,
                    "p_profile_visibility": profile_visibility,
                },
            )

            if not result.get("success"):
                raise Exception(result.get("message") or "Failed to save profile")

            profile = result.get("data")
            if not isinstance(profile, dict):
                return None

            return profile

        except Exception as e:
            raise Exception(f"Database error in upsert_profile: {str(e)}")

    def can_view_profile(
        self,
        student_id: int,
        requester_id: int,
        requester_role: Optional[str],
        profile_visibility: Optional[str],
    ) -> bool:
        """Check profile visibility against WatMatch team/recruiting relationships."""
        try:
            role = (requester_role or "").lower()
            visibility = (profile_visibility or "team_network").lower()
            if requester_id == student_id:
                return True
            if role == "admin":
                return True
            if role == "instructor":
                return self._instructor_is_connected_to_student(student_id, requester_id)
            if visibility == "private":
                return False
            if role == "student" and visibility == "students":
                return True
            if role == "student":
                return self._students_are_connected(student_id, requester_id)
            if role == "external_partner":
                return self._partner_is_connected_to_student(student_id, requester_id)
            return False
        except Exception:
            return False

    def get_all_profiles(self) -> list[Dict[Any, Any]]:
        """Get all student profiles"""
        try:
            response = supabase.table(self.table_name).select("*").execute()

            return response.data if response.data else []

        except Exception as e:
            raise Exception(f"Database error in get_all_profiles: {str(e)}")

    def _with_departments(self, profile: Dict[Any, Any]) -> Dict[Any, Any]:
        student_id = profile.get("student_fk")
        if student_id is None:
            return {**profile, "interested_department_ids": [], "interested_departments": []}

        rows = (
            supabase.table("student_profile_departments")
            .select("department_fk")
            .eq("student_fk", student_id)
            .execute()
            .data
            or []
        )
        department_ids = [
            row.get("department_fk")
            for row in rows
            if row.get("department_fk") is not None
        ]
        departments = []
        if department_ids:
            departments = (
                supabase.table("departments")
                .select("department_id,name,active")
                .in_("department_id", department_ids)
                .order("name")
                .execute()
                .data
                or []
            )
        return {
            **profile,
            "interested_department_ids": department_ids,
            "interested_departments": departments,
        }

    def _team_ids_for_student(self, student_id: int) -> set[int]:
        rows = (
            supabase.table("team_memberships")
            .select("team_fk")
            .eq("user_fk", student_id)
            .execute()
            .data
            or []
        )
        return {
            int(row["team_fk"])
            for row in rows
            if row.get("team_fk") is not None
        }

    def _students_are_connected(self, student_id: int, requester_id: int) -> bool:
        target_team_ids = self._team_ids_for_student(student_id)
        requester_team_ids = self._team_ids_for_student(requester_id)
        if target_team_ids.intersection(requester_team_ids):
            return True

        if requester_team_ids:
            target_interest = (
                supabase.table("project_explorations")
                .select("team_fk")
                .eq("student_fk", student_id)
                .in_("team_fk", sorted(requester_team_ids))
                .in_("status", ["interested", "invited", "exploring", "pending_commitment", "committed"])
                .limit(1)
                .execute()
                .data
                or []
            )
            if target_interest:
                return True

        if target_team_ids:
            requester_interest = (
                supabase.table("project_explorations")
                .select("team_fk")
                .eq("student_fk", requester_id)
                .in_("team_fk", sorted(target_team_ids))
                .in_("status", ["interested", "invited", "exploring", "pending_commitment", "committed"])
                .limit(1)
                .execute()
                .data
                or []
            )
            if requester_interest:
                return True

        return False

    def _instructor_is_connected_to_student(self, student_id: int, instructor_id: int) -> bool:
        rows = (
            supabase.table("users")
            .select("user_id,course_fk,role")
            .in_("user_id", [student_id, instructor_id])
            .execute()
            .data
            or []
        )
        users = {
            int(row["user_id"]): row
            for row in rows
            if row.get("user_id") is not None
        }
        student = users.get(student_id)
        instructor = users.get(instructor_id)
        if not student or not instructor:
            return False
        instructor_course = instructor.get("course_fk")
        if instructor_course is not None and instructor_course == student.get("course_fk"):
            return True

        student_team_ids = self._team_ids_for_student(student_id)
        if not student_team_ids or instructor_course is None:
            return False
        scoped_team_rows = (
            supabase.table("teams")
            .select("team_id")
            .in_("team_id", sorted(student_team_ids))
            .eq("course_fk", instructor_course)
            .limit(1)
            .execute()
            .data
            or []
        )
        return bool(scoped_team_rows)

    def _partner_is_connected_to_student(self, student_id: int, partner_user_id: int) -> bool:
        team_ids = self._team_ids_for_student(student_id)
        if not team_ids:
            return False

        team_rows = (
            supabase.table("teams")
            .select("capstone_fk")
            .in_("team_id", sorted(team_ids))
            .execute()
            .data
            or []
        )
        capstone_ids = [
            row.get("capstone_fk")
            for row in team_rows
            if row.get("capstone_fk") is not None
        ]
        if not capstone_ids:
            return False

        capstone_rows = (
            supabase.table("capstones")
            .select("partner_opportunity_fk,external_partner_email")
            .in_("capstone_id", capstone_ids)
            .execute()
            .data
            or []
        )
        opportunity_ids = [
            row.get("partner_opportunity_fk")
            for row in capstone_rows
            if row.get("partner_opportunity_fk") is not None
        ]
        if not opportunity_ids:
            partner_rows = (
                supabase.table("users")
                .select("email")
                .eq("user_id", partner_user_id)
                .eq("active", True)
                .eq("role", "external_partner")
                .limit(1)
                .execute()
                .data
                or []
            )
            if not partner_rows:
                return False
            partner_email = (partner_rows[0].get("email") or "").strip().lower()
            if not partner_email:
                return False
            return any(
                (row.get("external_partner_email") or "").strip().lower() == partner_email
                for row in capstone_rows
            )

        owned_opportunities = (
            supabase.table("partner_opportunities")
            .select("partner_opportunity_id")
            .eq("partner_user_fk", partner_user_id)
            .in_("partner_opportunity_id", opportunity_ids)
            .limit(1)
            .execute()
            .data
            or []
        )
        if owned_opportunities:
            return True

        partner_rows = (
            supabase.table("users")
            .select("email")
            .eq("user_id", partner_user_id)
            .eq("active", True)
            .eq("role", "external_partner")
            .limit(1)
            .execute()
            .data
            or []
        )
        if not partner_rows:
            return False
        partner_email = (partner_rows[0].get("email") or "").strip().lower()
        if not partner_email:
            return False
        return any(
            (row.get("external_partner_email") or "").strip().lower() == partner_email
            for row in capstone_rows
        )
