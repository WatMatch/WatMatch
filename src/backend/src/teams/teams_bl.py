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

    def get_capstone_team_context(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
    ) -> Dict[str, Any]:
        """Return the canonical, read-only team context for a capstone."""
        try:
            capstone = self.capstones_data.get_capstone_by_id(capstone_id)
            if not capstone:
                return {"success": False, "message": "Capstone not found", "data": None}

            team_id = capstone.get("team_fk")
            if team_id is None:
                return {"success": False, "message": "Capstone team not found", "data": None}

            team = self.teams_data.get_team_by_id(int(team_id))
            if not team:
                return {"success": False, "message": "Capstone team not found", "data": None}

            member_ids = get_team_member_ids(int(team_id), fallback_team=team)
            role = (actor_role or "").strip().lower()
            is_member = int(actor_id) in set(member_ids)
            is_leader = int(team.get("leader_fk") or 0) == int(actor_id)
            is_admin = role == "admin"
            is_routing_staff = role in {"academic_advisor", "enrollment_operator"}
            is_scoped_instructor = (
                self._is_instructor_scoped_to_capstone(
                    actor_id=int(actor_id),
                    capstone=capstone,
                    team=team,
                )
                if role == "instructor"
                else False
            )

            can_view = (
                (role == "student" and is_member)
                or is_admin
                or is_routing_staff
                or is_scoped_instructor
            )
            if not can_view:
                return {
                    "success": False,
                    "message": "Forbidden. Official team membership or scoped staff access required.",
                    "data": None,
                }

            members = self._get_team_member_details(int(team_id), member_ids)
            leader_id = int(team.get("leader_fk")) if team.get("leader_fk") is not None else None
            for member in members:
                member_id = member.get("user_id")
                member["is_leader"] = (
                    leader_id is not None
                    and member_id is not None
                    and int(member_id) == leader_id
                )

            support_response = supabase.rpc(
                "watmatch_capstone_support_summary",
                {"p_capstone_id": int(capstone_id)},
            ).execute()
            support_summary = support_response.data or {}
            readiness_counts = self._get_finalization_readiness_facts(int(team_id))
            readiness_items = self._build_finalization_readiness_items(
                capstone=capstone,
                team=team,
                members=members,
                support_summary=support_summary,
                readiness_counts=readiness_counts,
            )
            ready_count = sum(1 for item in readiness_items if item["ready"])

            can_manage = is_admin or is_scoped_instructor or (role == "student" and is_leader)
            return {
                "success": True,
                "message": "Capstone team context retrieved successfully",
                "data": {
                    "team_id": int(team_id),
                    "capstone_id": int(capstone_id),
                    "team_status": team.get("status"),
                    "leader_fk": leader_id,
                    "project": {
                        "capstone_id": int(capstone_id),
                        "title": capstone.get("title"),
                        "description": capstone.get("description"),
                        "status": capstone.get("status"),
                        "course_fk": capstone.get("course_fk") or team.get("course_fk"),
                        "marketplace_phase": capstone.get("marketplace_phase"),
                    },
                    "members": members,
                    "readiness": {
                        "ready": ready_count == len(readiness_items),
                        "ready_count": ready_count,
                        "total_count": len(readiness_items),
                        "items": readiness_items,
                        **readiness_counts,
                    },
                    "support_summary": support_summary,
                    "capabilities": {
                        "is_official_member": is_member,
                        "is_leader": is_leader,
                        "can_manage_roster": can_manage,
                        "can_manage_support": can_manage,
                        "can_submit_roster": role == "student" and is_leader,
                        "can_finalize": can_manage,
                    },
                },
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def _is_instructor_scoped_to_capstone(
        self,
        actor_id: int,
        capstone: Dict[str, Any],
        team: Dict[str, Any],
    ) -> bool:
        actor_course_fk = get_user_course_fk(actor_id)
        if actor_course_fk is None:
            return False
        scoped_course_ids = {
            int(course_id)
            for course_id in (team.get("course_fk"), capstone.get("course_fk"))
            if course_id is not None
        }
        if int(actor_course_fk) in scoped_course_ids:
            return True
        approval = (
            supabase.table("capstone_course_approvals")
            .select("capstone_course_approval_id")
            .eq("capstone_fk", capstone.get("capstone_id"))
            .eq("course_fk", actor_course_fk)
            .limit(1)
            .execute()
        )
        return bool(approval.data)

    def _build_finalization_readiness_items(
        self,
        capstone: Dict[str, Any],
        team: Dict[str, Any],
        members: List[Dict[str, Any]],
        support_summary: Dict[str, Any],
        readiness_counts: Dict[str, int],
    ) -> List[Dict[str, Any]]:
        project_status = str(capstone.get("status") or "").lower()
        approval_ready = project_status in {"approved_recruiting", "approved", "complete"}
        support_required = support_summary.get("requires_project_support") is not False
        support_ready = not support_required or support_summary.get("has_support") is True
        pending_routing = int(readiness_counts.get("pending_commitment_request_count") or 0)
        unresolved_explorations = int(
            readiness_counts.get("mutually_confirmed_exploration_count") or 0
        )
        leader_fk = team.get("leader_fk")
        member_ids = {
            int(member["user_id"])
            for member in members
            if member.get("user_id") is not None
        }
        identity_ready = bool(members) and leader_fk is not None and int(leader_fk) in member_ids

        enrollment_course_ids: List[int] = []
        enrollment_courses: List[Dict[str, Any]] = []
        for member in members:
            course = member.get("enrollment_course") or member.get("course") or {}
            course_id = (
                member.get("enrollment_course_fk")
                or course.get("course_id")
                or member.get("course_fk")
            )
            if course_id is not None:
                enrollment_course_ids.append(int(course_id))
                enrollment_courses.append(course)

        staffed_course_ids = set()
        if enrollment_course_ids:
            instructor_rows = (
                supabase.table("users")
                .select("course_fk")
                .eq("role", "instructor")
                .eq("active", True)
                .in_("course_fk", sorted(set(enrollment_course_ids)))
                .execute()
                .data
                or []
            )
            staffed_course_ids = {
                int(row["course_fk"])
                for row in instructor_rows
                if row.get("course_fk") is not None
            }
        enrollment_ready = (
            bool(members)
            and len(enrollment_course_ids) == len(members)
            and all(course.get("active") is not False for course in enrollment_courses)
            and all(course_id in staffed_course_ids for course_id in enrollment_course_ids)
        )

        return [
            {
                "key": "instructor_approval",
                "label": (
                    "Instructor approval complete"
                    if approval_ready
                    else "Instructor approval required"
                ),
                "ready": approval_ready,
                "detail": (
                    "Instructor review has approved this project."
                    if approval_ready
                    else "Instructor approval is still required."
                ),
            },
            {
                "key": "project_support",
                "label": (
                    "Required support confirmed"
                    if support_ready
                    else "Required support missing"
                ),
                "ready": support_ready,
                "detail": (
                    "Mentor or external partner support is attached, or support is optional."
                    if support_ready
                    else "An accepted mentor or confirmed external partner is still required."
                ),
            },
            {
                "key": "staff_routing",
                "label": (
                    "No pending staff routing"
                    if pending_routing == 0
                    else "Staff routing required"
                ),
                "ready": pending_routing == 0,
                "detail": (
                    "No commitment routing is waiting on staff."
                    if pending_routing == 0
                    else f"{pending_routing} commitment routing item{'s' if pending_routing != 1 else ''} remain."
                ),
            },
            {
                "key": "confirmed_explorations",
                "label": (
                    "No unresolved commitments"
                    if unresolved_explorations == 0
                    else "Commitments need resolution"
                ),
                "ready": unresolved_explorations == 0,
                "detail": (
                    "No mutually confirmed exploration is awaiting resolution."
                    if unresolved_explorations == 0
                    else "Resolve mutually confirmed explorations before finalization."
                ),
            },
            {
                "key": "team_identity",
                "label": (
                    "Team identity valid"
                    if identity_ready
                    else "Team identity incomplete"
                ),
                "ready": identity_ready,
                "detail": (
                    "The official roster includes a team leader."
                    if identity_ready
                    else "The official roster needs at least one member and a valid leader."
                ),
            },
            {
                "key": "official_enrollment",
                "label": (
                    "Official enrollment recorded"
                    if enrollment_ready
                    else "Enrollment records incomplete"
                ),
                "ready": enrollment_ready,
                "detail": (
                    "Every official member has an active, staffed enrollment course."
                    if enrollment_ready
                    else "Every official member needs an active, staffed enrollment course."
                ),
            },
        ]

    def _get_finalization_readiness_facts(self, team_id: int) -> Dict[str, int]:
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

    def _get_finalization_readiness_counts(self, team_id: int) -> Dict[str, int]:
        try:
            return self._get_finalization_readiness_facts(team_id)
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
