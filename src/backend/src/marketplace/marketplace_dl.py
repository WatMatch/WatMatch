from typing import Any, Dict, Optional

from src.workflow.rpc_utils import call_json_rpc


class MarketplaceDataLogic:
    """Data access for the exploratory capstone marketplace workflow."""

    def get_settings(self) -> Dict[str, Any]:
        return call_json_rpc("watmatch_get_marketplace_settings", {})

    def update_settings(
        self,
        actor_id: int,
        actor_role: str,
        current_term: str,
        phase: str,
        exploration_starts_at: Optional[str] = None,
        commitment_starts_at: Optional[str] = None,
        finalization_starts_at: Optional[str] = None,
        override_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_update_marketplace_settings",
            {
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_current_term": current_term,
                "p_phase": phase,
                "p_exploration_starts_at": exploration_starts_at,
                "p_commitment_starts_at": commitment_starts_at,
                "p_finalization_starts_at": finalization_starts_at,
                "p_override_reason": override_reason,
            },
        )

    def upsert_exploration(
        self,
        capstone_id: int,
        student_id: int,
        status: str,
        source: str,
        actor_id: int,
        message: Optional[str] = None,
        priority_rank: Optional[int] = None,
        override_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_upsert_project_exploration",
            {
                "p_capstone_id": capstone_id,
                "p_student_id": student_id,
                "p_status": status,
                "p_source": source,
                "p_actor_id": actor_id,
                "p_message": message,
                "p_priority_rank": priority_rank,
                "p_override_reason": override_reason,
            },
        )

    def get_readiness(
        self,
        actor_id: int,
        actor_role: str,
        current_term: Optional[str] = None,
        phase: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_get_marketplace_readiness",
            {
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_current_term": current_term,
                "p_phase": phase,
            },
        )

    def get_workload_summary(
        self,
        actor_id: int,
        actor_role: str,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        department_id: Optional[int] = None,
        queue_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_get_enrollment_workload_summary",
            {
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_search": search,
                "p_course_id": course_id,
                "p_department_id": department_id,
                "p_queue_type": queue_type,
            },
        )

    def list_closeout_capstones(self, actor_id: int, actor_role: str, include_carried_over: bool = False) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_get_capstones_needing_closeout",
            {
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_include_carried_over": include_carried_over,
            },
        )

    def decide_closeout(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        target_course_id: Optional[int] = None,
        notes: Optional[str] = None,
        target_term: Optional[str] = None,
        member_enrollment_routes: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_apply_capstone_closeout_decision",
            {
                "p_capstone_id": capstone_id,
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_decision": decision,
                "p_target_course_id": target_course_id,
                "p_notes": notes,
                "p_target_term": target_term,
                "p_member_enrollment_routes": member_enrollment_routes,
            },
        )

    def resolve_marketplace_activity_for_finalization(
        self,
        actor_id: int,
        actor_role: str,
        capstone_id: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_resolve_marketplace_activity_for_finalization",
            {
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_capstone_id": capstone_id,
                "p_reason": reason,
            },
        )

    def list_student_explorations(self, student_id: int) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_list_student_explorations",
            {"p_student_id": student_id},
        )

    def create_commitment_request(
        self,
        exploration_id: int,
        actor_id: int,
        actor_role: str,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_create_project_commitment_request",
            {
                "p_exploration_id": exploration_id,
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_comments": comments,
            },
        )

    def confirm_team_commitment_roster(
        self,
        team_id: int,
        actor_id: int,
        actor_role: str,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_confirm_team_commitment_roster",
            {
                "p_team_id": team_id,
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_comments": comments,
            },
        )

    def cancel_exploration(
        self,
        exploration_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_cancel_project_exploration",
            {
                "p_exploration_id": exploration_id,
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_reason": reason,
            },
        )

    def list_commitment_requests(
        self,
        actor_id: int,
        actor_role: str,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        department_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_get_project_commitment_requests",
            {
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_page": page,
                "p_page_size": page_size,
                "p_search": search,
                "p_course_id": course_id,
                "p_department_id": department_id,
            },
        )

    def decide_commitment_request(
        self,
        commitment_request_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        decision_route: Optional[str] = None,
        target_course_id: Optional[int] = None,
        member_enrollment_routes: Optional[Dict[str, int]] = None,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_decide_project_commitment_request",
            {
                "p_commitment_request_id": commitment_request_id,
                "p_actor_id": actor_id,
                "p_actor_role": actor_role,
                "p_decision": decision,
                "p_decision_route": decision_route,
                "p_target_course_id": target_course_id,
                "p_comments": comments,
                "p_member_enrollment_routes": member_enrollment_routes,
            },
        )
