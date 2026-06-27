from src.config.database import supabase
from typing import Optional, Dict, Any
from src.workflow.rpc_utils import call_json_rpc


class TeamsDataLogic:
    """Data layer for teams operations"""

    def __init__(self):
        self.table_name = "teams"

    def get_team_by_id(self, team_id: int) -> Optional[Dict[Any, Any]]:
        """Get a team by its ID"""
        try:
            response = supabase.table(self.table_name).select(
                "*").eq("team_id", team_id).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in get_team_by_id: {str(e)}")

    def create_empty_team_rpc(
        self,
        leader_id: int,
        course_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase empty-team creation workflow."""
        try:
            return call_json_rpc(
                "watmatch_create_empty_team",
                {
                    "p_leader_id": leader_id,
                    "p_course_id": course_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_empty_team_rpc: {str(e)}")

    def create_managed_team_rpc(
        self,
        student_ids: list[int],
        leader_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional instructor/admin managed-team creation workflow."""
        try:
            return call_json_rpc(
                "watmatch_privileged_create_team",
                {
                    "p_student_ids": student_ids,
                    "p_leader_id": leader_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_managed_team_rpc: {str(e)}")

    def disband_team_rpc(
        self,
        team_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase team archive/disband workflow."""
        try:
            return call_json_rpc(
                "watmatch_disband_team",
                {
                    "p_team_id": team_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in disband_team_rpc: {str(e)}")

    def accept_interest_rpc(
        self,
        team_id: int,
        student_id: int,
        actor_id: int,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase interest acceptance workflow."""
        try:
            return call_json_rpc(
                "watmatch_accept_project_interest",
                {
                    "p_team_id": team_id,
                    "p_student_id": student_id,
                    "p_actor_id": actor_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in accept_interest_rpc: {str(e)}")

    def reject_interest_rpc(
        self,
        team_id: int,
        student_id: int,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase interest rejection workflow."""
        try:
            return call_json_rpc(
                "watmatch_reject_project_interest",
                {
                    "p_team_id": team_id,
                    "p_student_id": student_id,
                    "p_actor_id": actor_id,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in reject_interest_rpc: {str(e)}")

    def leave_team_rpc(self, team_id: int, user_id: int) -> Dict[str, Any]:
        """Run the transactional Supabase leave-team workflow."""
        try:
            return call_json_rpc(
                "watmatch_leave_team",
                {
                    "p_team_id": team_id,
                    "p_user_id": user_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in leave_team_rpc: {str(e)}")

    def abandon_solo_project_rpc(self, team_id: int, actor_id: int) -> Dict[str, Any]:
        """Run the transactional solo-leader project abandon workflow."""
        try:
            return call_json_rpc(
                "watmatch_student_abandon_solo_project",
                {
                    "p_team_id": team_id,
                    "p_actor_id": actor_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in abandon_solo_project_rpc: {str(e)}")

    def leader_remove_member_rpc(
        self,
        team_id: int,
        student_id: int,
        actor_id: int,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase leader member-remove workflow."""
        try:
            return call_json_rpc(
                "watmatch_leader_remove_team_member",
                {
                    "p_team_id": team_id,
                    "p_student_id": student_id,
                    "p_actor_id": actor_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in leader_remove_member_rpc: {str(e)}")

    def privileged_add_member_rpc(
        self,
        team_id: int,
        student_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase privileged member-add workflow."""
        try:
            return call_json_rpc(
                "watmatch_privileged_add_team_member",
                {
                    "p_team_id": team_id,
                    "p_student_id": student_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in privileged_add_member_rpc: {str(e)}")

    def privileged_remove_member_rpc(
        self,
        team_id: int,
        student_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase privileged member-remove workflow."""
        try:
            return call_json_rpc(
                "watmatch_privileged_remove_team_member",
                {
                    "p_team_id": team_id,
                    "p_student_id": student_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in privileged_remove_member_rpc: {str(e)}")

    def reassign_leader_rpc(
        self,
        team_id: int,
        actor_id: int,
        actor_role: str,
        new_leader_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase leader reassignment workflow."""
        try:
            return call_json_rpc(
                "watmatch_reassign_team_leader",
                {
                    "p_team_id": team_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_new_leader_id": new_leader_id,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in reassign_leader_rpc: {str(e)}")

    def finalize_team_rpc(
        self,
        team_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase recruiting finalization workflow."""
        try:
            return call_json_rpc(
                "watmatch_finalize_team",
                {
                    "p_team_id": team_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in finalize_team_rpc: {str(e)}")

    def get_all_teams(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get teams with optional pagination."""
        try:
            if page is not None and page_size is not None:
                start = (page - 1) * page_size
                end = start + page_size - 1

                try:
                    response = (
                        supabase.table(self.table_name)
                        .select("*", count="exact")
                        .range(start, end)
                        .execute()
                    )
                except TypeError:
                    response = (
                        supabase.table(self.table_name)
                        .select("*")
                        .range(start, end)
                        .execute()
                    )

                data = getattr(response, "data", []) or []
                total = getattr(response, "count", None)

                if total is None:
                    try:
                        count_response = (
                            supabase.table(self.table_name)
                            .select("team_id", count="exact")
                            .execute()
                        )
                        total = getattr(count_response, "count", None)
                    except Exception:
                        total = None

                return {
                    "data": data,
                    "total": total,
                    "page": page,
                    "page_size": page_size
                }

            response = supabase.table(self.table_name).select("*").execute()
            data = response.data if response.data else []

            return {
                "data": data,
                "total": len(data),
                "page": None,
                "page_size": None
            }

        except Exception as e:
            raise Exception(f"Database error in get_all_teams: {str(e)}")
