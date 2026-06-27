import logging
from typing import Dict, Any, Optional, List

from .teams_dl import TeamsDataLogic
from src.capstones.capstones_dl import CapstonesDataLogic
from src.config.database import supabase
from src.mailer.mailer import send_match_email, send_interest_rejected_email
from src.workflow.workflow_utils import (
    get_team_member_ids,
    get_user_course_fk,
)

logger = logging.getLogger(__name__)


class TeamsBusinessLogic:
    """Business layer for teams operations."""

    def __init__(self):
        self.teams_data = TeamsDataLogic()
        self.capstones_data = CapstonesDataLogic()

    def create_team(self, leader_id: int, course_id: int = None) -> Dict[str, Any]:
        try:
            if not isinstance(leader_id, int) or leader_id <= 0:
                return {"success": False, "message": "Invalid leader ID. Must be a positive integer.", "data": None}

            rpc_result = self.teams_data.create_empty_team_rpc(
                leader_id=leader_id,
                course_id=course_id,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Team creation failed."), "data": None}

            updated_team = rpc_result.get("data")
            if not updated_team:
                return {"success": False, "message": "Team creation failed.", "data": None}
            processed_data = self._process_team_data(updated_team)
            return {"success": True, "message": rpc_result.get("message", "Team created successfully"), "data": processed_data}
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def create_managed_team(
        self,
        student_ids: list[int],
        leader_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if not isinstance(actor_id, int) or actor_id <= 0:
                return {"success": False, "message": "Invalid actor ID. Must be a positive integer.", "data": None}
            if not isinstance(leader_id, int) or leader_id <= 0:
                return {"success": False, "message": "Invalid leader ID. Must be a positive integer.", "data": None}
            if not student_ids:
                return {"success": False, "message": "At least one student must be assigned to create a team.", "data": None}

            clean_student_ids = sorted({int(student_id) for student_id in student_ids if int(student_id) > 0})
            if not clean_student_ids:
                return {"success": False, "message": "At least one valid student must be assigned to create a team.", "data": None}
            if leader_id not in clean_student_ids:
                return {"success": False, "message": "Leader must be one of the selected students.", "data": None}

            rpc_result = self.teams_data.create_managed_team_rpc(
                student_ids=clean_student_ids,
                leader_id=leader_id,
                actor_id=actor_id,
                actor_role=actor_role,
                reason=reason.strip() if reason and reason.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Managed team creation failed."), "data": None}

            updated_team = rpc_result.get("data")
            if not updated_team:
                return {"success": False, "message": "Managed team creation failed.", "data": None}
            return {
                "success": True,
                "message": rpc_result.get("message", "Team created and students assigned successfully."),
                "data": self._process_team_data(updated_team),
            }
        except (TypeError, ValueError):
            return {"success": False, "message": "Student IDs must be positive integers.", "data": None}
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def get_all_teams(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        actor_role: Optional[str] = None,
        actor_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        try:
            role = (actor_role or "").lower()
            if role == "instructor" and actor_id is not None:
                instructor_course_fk = get_user_course_fk(actor_id)
                if instructor_course_fk is None:
                    result = {"data": [], "total": 0, "page": page, "page_size": page_size}
                else:
                    query = (
                        supabase.table("teams")
                        .select("*", count="exact")
                        .eq("course_fk", instructor_course_fk)
                        .order("created_at", desc=True)
                    )
                    if page is not None and page_size is not None:
                        start = (page - 1) * page_size
                        end = start + page_size - 1
                        query = query.range(start, end)
                    response = query.execute()
                    result = {
                        "data": response.data or [],
                        "total": getattr(response, "count", None),
                        "page": page,
                        "page_size": page_size,
                    }
            else:
                result = self.teams_data.get_all_teams(page, page_size)
            teams = result["data"] or []
            processed = [self._process_team_data(team) for team in teams]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed)} team(s)",
                "data": processed,
            }
            if page is not None and page_size is not None:
                total = result.get("total")
                if not isinstance(total, int):
                    total = len(processed)
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size
                response.update({"page": page, "page_size": page_size, "total": total, "total_pages": total_pages})
            return response
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def leave_team(self, user_id: int, team_id: int) -> Dict[str, Any]:
        try:
            if not isinstance(user_id, int) or user_id <= 0:
                return {"success": False, "message": "Invalid user ID. Must be a positive integer.", "data": None}
            if not isinstance(team_id, int) or team_id <= 0:
                return {"success": False, "message": "Invalid team ID. Must be a positive integer.", "data": None}

            rpc_result = self.teams_data.leave_team_rpc(team_id=team_id, user_id=user_id)
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Team leave workflow failed."), "data": None}

            data = rpc_result.get("data")
            if isinstance(data, dict) and data.get("status") is not None:
                data = self._process_team_data(data)

            return {
                "success": True,
                "message": rpc_result.get("message", "User successfully left the team."),
                "data": data,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def abandon_solo_project(self, user_id: int, team_id: int) -> Dict[str, Any]:
        try:
            if not isinstance(user_id, int) or user_id <= 0:
                return {"success": False, "message": "Invalid user ID. Must be a positive integer.", "data": None}
            if not isinstance(team_id, int) or team_id <= 0:
                return {"success": False, "message": "Invalid team ID. Must be a positive integer.", "data": None}

            rpc_result = self.teams_data.abandon_solo_project_rpc(team_id=team_id, actor_id=user_id)
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Project abandon workflow failed."), "data": None}

            return {
                "success": True,
                "message": rpc_result.get("message", "Project abandoned."),
                "data": rpc_result.get("data"),
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def accept_member(self, leader_id: int, student_id: int, team_id: int) -> Dict[str, Any]:
        try:
            if leader_id <= 0 or student_id <= 0 or team_id <= 0:
                return {"success": False, "message": "Invalid IDs. All IDs must be positive integers.", "data": None}

            rpc_result = self.teams_data.accept_interest_rpc(
                team_id=team_id,
                student_id=student_id,
                actor_id=leader_id,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Interest acceptance failed."), "data": None}

            if rpc_result.get("marketplace_exploration") is True:
                result_data = rpc_result.get("data") or {}
                team_data = result_data.get("team") or self.teams_data.get_team_by_id(team_id)
                return {
                    "success": True,
                    "message": rpc_result.get("message", "Student moved into marketplace exploration."),
                    "data": self._process_team_data(team_data) if team_data else result_data,
                    "marketplace_exploration": True,
                    "exploration": result_data.get("exploration"),
                }

            updated_team = rpc_result.get("data") or self.teams_data.get_team_by_id(team_id)
            if not updated_team:
                return {"success": False, "message": "Failed to load updated team membership.", "data": None}

            student_email = self._get_user_email(student_id)
            if student_email:
                try:
                    project_title = "a WatMatch capstone project"
                    capstone_id = rpc_result.get("capstone_id") or updated_team.get("capstone_fk")
                    if capstone_id:
                        capstone_res = supabase.table("capstones").select("title").eq("capstone_id", capstone_id).execute()
                        if capstone_res.data:
                            project_title = capstone_res.data[0].get("title", project_title)
                    send_match_email(to_email=student_email, student_name="there", project_title=project_title)
                except Exception:
                    logger.warning("Failed sending interest acceptance email")

            return {
                "success": True,
                "message": rpc_result.get("message", "Student accepted into the team."),
                "data": self._process_team_data(updated_team),
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def reject_member(self, leader_id: int, student_id: int, team_id: int, reason: Optional[str] = None) -> Dict[str, Any]:
        try:
            if leader_id <= 0 or student_id <= 0 or team_id <= 0:
                return {"success": False, "message": "Invalid IDs. All IDs must be positive integers.", "data": None}
            clean_reason = reason.strip() if reason and reason.strip() else None
            if clean_reason is None:
                return {"success": False, "message": "A short rejection reason is required.", "data": None}

            rpc_result = self.teams_data.reject_interest_rpc(
                team_id=team_id,
                student_id=student_id,
                actor_id=leader_id,
                reason=clean_reason,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Interest rejection failed."), "data": None}

            result_data = rpc_result.get("data") or {}
            if result_data.get("rejected"):
                student_email = self._get_user_email(student_id)
                try:
                    if student_email:
                        project_title = "a WatMatch capstone project"
                        capstone_id = result_data.get("capstone_id")
                        if capstone_id:
                            capstone_res = supabase.table("capstones").select("title").eq("capstone_id", capstone_id).execute()
                            if capstone_res.data:
                                project_title = capstone_res.data[0].get("title", project_title)
                        send_interest_rejected_email(to_email=student_email, project_title=project_title)
                except Exception:
                    logger.warning("Failed sending interest rejection email")

            return {"success": True, "message": rpc_result.get("message", "Student interest rejected."), "data": result_data}
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def remove_member(self, leader_id: int, student_id: int, team_id: int) -> Dict[str, Any]:
        try:
            if leader_id <= 0 or student_id <= 0 or team_id <= 0:
                return {"success": False, "message": "Invalid IDs. All IDs must be positive integers.", "data": None}

            rpc_result = self.teams_data.leader_remove_member_rpc(
                team_id=team_id,
                student_id=student_id,
                actor_id=leader_id,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Member removal workflow failed."), "data": None}

            updated_team = rpc_result.get("data") or self.teams_data.get_team_by_id(team_id)
            return {
                "success": True,
                "message": rpc_result.get("message", "Member removed from the team."),
                "data": self._process_team_data(updated_team) if updated_team else None,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def delete_team_as_privileged(
        self,
        team_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            rpc_result = self.teams_data.disband_team_rpc(
                team_id=team_id,
                actor_id=actor_id,
                actor_role=actor_role,
                reason=reason.strip() if reason and reason.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Disband workflow failed."), "data": None}
            return {
                "success": True,
                "message": rpc_result.get("message", "Team disbanded successfully."),
                "data": rpc_result.get("data"),
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def add_member_as_privileged(
        self,
        team_id: int,
        student_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            rpc_result = self.teams_data.privileged_add_member_rpc(
                team_id=team_id,
                student_id=student_id,
                actor_id=actor_id,
                actor_role=actor_role,
                reason=reason.strip() if reason and reason.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Member add workflow failed."), "data": None}
            updated_team = rpc_result.get("data") or self.teams_data.get_team_by_id(team_id)
            return {
                "success": True,
                "message": rpc_result.get("message", "Student added to team."),
                "data": self._process_team_data(updated_team) if updated_team else None,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def remove_member_as_privileged(
        self,
        team_id: int,
        student_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            rpc_result = self.teams_data.privileged_remove_member_rpc(
                team_id=team_id,
                student_id=student_id,
                actor_id=actor_id,
                actor_role=actor_role,
                reason=reason.strip() if reason and reason.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Member removal workflow failed."), "data": None}
            updated_team = rpc_result.get("data") or self.teams_data.get_team_by_id(team_id)
            return {
                "success": True,
                "message": rpc_result.get("message", "Student removed from team."),
                "data": self._process_team_data(updated_team) if updated_team else None,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def reassign_leader(
        self,
        team_id: int,
        requester_id: int,
        requester_role: str,
        new_leader_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            rpc_result = self.teams_data.reassign_leader_rpc(
                team_id=team_id,
                actor_id=requester_id,
                actor_role=requester_role,
                new_leader_id=new_leader_id,
                reason=reason.strip() if reason and reason.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Leader reassignment failed."), "data": None}
            updated_team = rpc_result.get("data") or self.teams_data.get_team_by_id(team_id)
            return {
                "success": True,
                "message": rpc_result.get("message", "Team leader reassigned successfully."),
                "data": self._process_team_data(updated_team) if updated_team else None,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def finalize_team(
        self,
        team_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            rpc_result = self.teams_data.finalize_team_rpc(
                team_id=team_id,
                actor_id=actor_id,
                actor_role=actor_role,
                reason=reason.strip() if reason and reason.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Team finalization failed."), "data": None}
            updated_team = rpc_result.get("data") or self.teams_data.get_team_by_id(team_id)
            return {
                "success": True,
                "message": rpc_result.get("message", "Team finalized successfully."),
                "data": self._process_team_data(updated_team) if updated_team else None,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def _process_team_data(self, team_data: Dict[Any, Any]) -> Dict[Any, Any]:
        processed = dict(team_data)
        team_id = processed.get("team_id")
        member_ids = get_team_member_ids(int(team_id), fallback_team=processed) if team_id is not None else []
        processed["members"] = member_ids
        processed["member_details"] = self._get_team_member_details(int(team_id), member_ids) if team_id is not None else []
        processed.update(self._get_finalization_readiness_counts(int(team_id)) if team_id is not None else {})
        if processed.get("capstone_fk") is not None and not isinstance(processed.get("capstone"), dict):
            try:
                capstone = self.capstones_data.get_capstone_by_id(int(processed["capstone_fk"]))
                if capstone:
                    processed["capstone"] = {
                        "capstone_id": capstone.get("capstone_id"),
                        "title": capstone.get("title"),
                        "description": capstone.get("description"),
                        "status": capstone.get("status"),
                        "disciplines": capstone.get("disciplines") or [],
                    }
                    processed["capstone_title"] = capstone.get("title")
            except Exception:
                processed["capstone"] = None
        processed["source"] = "watmatch-server"
        return processed

    def _get_finalization_readiness_counts(self, team_id: int) -> Dict[str, int]:
        try:
            pending_commitments = (
                supabase.table("project_commitment_requests")
                .select("commitment_request_id", count="exact")
                .eq("team_fk", team_id)
                .eq("status", "pending")
                .execute()
            )
            pending_explorations = (
                supabase.table("project_explorations")
                .select("exploration_id,student_commitment_confirmed_at,team_commitment_confirmed_at")
                .eq("team_fk", team_id)
                .in_("status", ["exploring", "pending_commitment"])
                .execute()
            )
            mutually_confirmed_count = sum(
                1
                for row in (pending_explorations.data or [])
                if row.get("student_commitment_confirmed_at")
                and row.get("team_commitment_confirmed_at")
            )
            return {
                "pending_commitment_request_count": int(getattr(pending_commitments, "count", 0) or 0),
                "mutually_confirmed_exploration_count": mutually_confirmed_count,
            }
        except Exception:
            return {
                "pending_commitment_request_count": 0,
                "mutually_confirmed_exploration_count": 0,
            }

    def _get_team_member_details(self, team_id: int, member_ids: List[int]) -> List[Dict[str, Any]]:
        if not member_ids:
            return []
        try:
            membership_rows = (
                supabase.table("team_memberships")
                .select("user_fk,is_leader,enrollment_course_fk,enrollment_routed_at,enrollment_notes")
                .eq("team_fk", team_id)
                .execute()
                .data
                or []
            )
            memberships_map = {
                membership.get("user_fk"): membership
                for membership in membership_rows
                if membership.get("user_fk") is not None
            }
            users = (
                supabase.table("users")
                .select("user_id,email,course_fk,home_department_fk")
                .in_("user_id", member_ids)
                .execute()
                .data
                or []
            )
            course_ids = sorted({
                course_id
                for user in users
                for course_id in (
                    user.get("course_fk"),
                    memberships_map.get(user.get("user_id"), {}).get("enrollment_course_fk"),
                )
                if course_id is not None
            })
            courses_map: Dict[Any, Any] = {}
            if course_ids:
                courses = (
                    supabase.table("courses")
                    .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind,ecosystem_fk")
                    .in_("course_id", course_ids)
                    .execute()
                    .data
                    or []
                )
                courses_map = {
                    course.get("course_id"): course
                    for course in courses
                    if course.get("course_id") is not None
                }
            department_ids = sorted({
                user.get("home_department_fk")
                for user in users
                if user.get("home_department_fk") is not None
            })
            departments_map: Dict[Any, Any] = {}
            if department_ids:
                departments = (
                    supabase.table("departments")
                    .select("department_id,name,active")
                    .in_("department_id", department_ids)
                    .execute()
                    .data
                    or []
                )
                departments_map = {
                    department.get("department_id"): department
                    for department in departments
                    if department.get("department_id") is not None
            }
            users_map = {
                user.get("user_id"): {
                    **user,
                    "course": courses_map.get(user.get("course_fk")),
                    "enrollment_course_fk": memberships_map.get(user.get("user_id"), {}).get("enrollment_course_fk"),
                    "enrollment_course": courses_map.get(
                        memberships_map.get(user.get("user_id"), {}).get("enrollment_course_fk")
                    ),
                    "enrollment_routed_at": memberships_map.get(user.get("user_id"), {}).get("enrollment_routed_at"),
                    "enrollment_notes": memberships_map.get(user.get("user_id"), {}).get("enrollment_notes"),
                    "is_leader": memberships_map.get(user.get("user_id"), {}).get("is_leader"),
                    "home_department_id": user.get("home_department_fk"),
                    "home_department": departments_map.get(user.get("home_department_fk")),
                }
                for user in users
                if user.get("user_id") is not None
            }
            return [
                users_map[member_id]
                for member_id in member_ids
                if member_id in users_map
            ]
        except Exception:
            return []

    def _get_user_email(self, user_id: int) -> Optional[str]:
        try:
            response = supabase.table("users").select("email").eq("user_id", user_id).execute()
            if not response.data:
                return None
            return response.data[0].get("email")
        except Exception:
            return None
