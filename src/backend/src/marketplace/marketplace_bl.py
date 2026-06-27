import re
from typing import Any, Dict, Optional

from .marketplace_dl import MarketplaceDataLogic

TERM_PATTERN = re.compile(r"^(Winter|Spring|Fall) \d{4}$")


class MarketplaceBusinessLogic:
    """Business validation for marketplace exploration and commitment routing."""

    def __init__(self) -> None:
        self.marketplace_data = MarketplaceDataLogic()

    def get_settings(self) -> Dict[str, Any]:
        try:
            return self.marketplace_data.get_settings()
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

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
        try:
            normalized_phase = (phase or "").strip().lower()
            if normalized_phase not in {"exploration", "commitment", "finalization"}:
                return {"success": False, "message": "Marketplace phase must be exploration, commitment, or finalization.", "data": None}
            normalized_term = (current_term or "").strip()
            if not TERM_PATTERN.fullmatch(normalized_term):
                return {"success": False, "message": "Marketplace term must use Winter <year>, Spring <year>, or Fall <year>.", "data": None}
            return self.marketplace_data.update_settings(
                actor_id=actor_id,
                actor_role=actor_role,
                current_term=normalized_term,
                phase=normalized_phase,
                exploration_starts_at=exploration_starts_at,
                commitment_starts_at=commitment_starts_at,
                finalization_starts_at=finalization_starts_at,
                override_reason=override_reason.strip() if override_reason and override_reason.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

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
        try:
            if capstone_id <= 0 or student_id <= 0 or actor_id <= 0:
                return {"success": False, "message": "Invalid marketplace exploration request.", "data": None}
            normalized_status = (status or "").strip().lower()
            if normalized_status not in {"shortlisted", "interested", "invited", "exploring"}:
                return {"success": False, "message": "Unsupported exploration status.", "data": None}
            exploration = self.marketplace_data.upsert_exploration(
                capstone_id=capstone_id,
                student_id=student_id,
                status=normalized_status,
                source=(source or "student_marketplace").strip().lower(),
                actor_id=actor_id,
                message=message.strip() if message and message.strip() else None,
                priority_rank=priority_rank,
                override_reason=override_reason.strip() if override_reason and override_reason.strip() else None,
            )
            if "success" in exploration and not exploration.get("success"):
                return exploration
            return {
                "success": True,
                "message": "Marketplace exploration updated.",
                "data": exploration.get("data") if "success" in exploration else exploration,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def get_readiness(
        self,
        actor_id: int,
        actor_role: str,
        current_term: Optional[str] = None,
        phase: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            normalized_term = (current_term or "").strip() or None
            if normalized_term and not TERM_PATTERN.fullmatch(normalized_term):
                return {"success": False, "message": "Marketplace term must use Winter <year>, Spring <year>, or Fall <year>.", "data": None}
            normalized_phase = (phase or "").strip().lower() or None
            if normalized_phase and normalized_phase not in {"exploration", "commitment", "finalization"}:
                return {"success": False, "message": "Marketplace phase must be exploration, commitment, or finalization.", "data": None}
            return self.marketplace_data.get_readiness(
                actor_id=actor_id,
                actor_role=actor_role,
                current_term=normalized_term,
                phase=normalized_phase,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def get_workload_summary(
        self,
        actor_id: int,
        actor_role: str,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        department_id: Optional[int] = None,
        queue_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if actor_id <= 0:
                return {"success": False, "message": "Invalid actor identity.", "data": None}
            normalized_queue_type = (queue_type or "").strip().lower() or None
            return self.marketplace_data.get_workload_summary(
                actor_id=actor_id,
                actor_role=actor_role,
                search=search.strip() if search and search.strip() else None,
                course_id=course_id,
                department_id=department_id,
                queue_type=normalized_queue_type,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def list_closeout_capstones(self, actor_id: int, actor_role: str, include_carried_over: bool = False) -> Dict[str, Any]:
        try:
            return self.marketplace_data.list_closeout_capstones(
                actor_id=actor_id,
                actor_role=actor_role,
                include_carried_over=include_carried_over,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

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
        try:
            normalized_decision = (decision or "").strip().lower()
            if normalized_decision not in {"continue_to_course", "publish_completed", "carry_over_read_only", "archive", "clear_decision"}:
                return {"success": False, "message": "Unsupported closeout decision.", "data": None}
            normalized_notes = notes.strip() if notes and notes.strip() else None
            if not normalized_notes:
                return {"success": False, "message": "Closeout decision notes are required.", "data": None}
            if normalized_decision == "continue_to_course" and not target_course_id:
                return {"success": False, "message": "A target course is required for continuation.", "data": None}
            normalized_target_term = target_term.strip() if target_term and target_term.strip() else None
            if normalized_target_term and not TERM_PATTERN.fullmatch(normalized_target_term):
                return {"success": False, "message": "Continuation target term must use Winter <year>, Spring <year>, or Fall <year>.", "data": None}
            normalized_member_routes: Optional[Dict[str, int]] = None
            if member_enrollment_routes:
                normalized_member_routes = {}
                for student_id, course_id in member_enrollment_routes.items():
                    student_key = str(student_id).strip()
                    if not student_key.isdigit():
                        return {"success": False, "message": "Continuation route keys must be student IDs.", "data": None}
                    try:
                        parsed_course_id = int(course_id)
                    except (TypeError, ValueError):
                        return {"success": False, "message": "Continuation route values must be course IDs.", "data": None}
                    if parsed_course_id <= 0:
                        return {"success": False, "message": "Continuation route values must be positive course IDs.", "data": None}
                    normalized_member_routes[student_key] = parsed_course_id
            return self.marketplace_data.decide_closeout(
                capstone_id=capstone_id,
                actor_id=actor_id,
                actor_role=actor_role,
                decision=normalized_decision,
                target_course_id=target_course_id,
                notes=normalized_notes,
                target_term=normalized_target_term,
                member_enrollment_routes=normalized_member_routes,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def resolve_marketplace_activity_for_finalization(
        self,
        actor_id: int,
        actor_role: str,
        capstone_id: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if actor_id <= 0:
                return {"success": False, "message": "Invalid actor identity.", "data": None}
            if capstone_id is not None and capstone_id <= 0:
                return {"success": False, "message": "Invalid capstone ID.", "data": None}
            normalized_reason = reason.strip() if reason and reason.strip() else None
            if not normalized_reason:
                return {"success": False, "message": "Marketplace activity resolution requires an audit reason.", "data": None}
            return self.marketplace_data.resolve_marketplace_activity_for_finalization(
                actor_id=actor_id,
                actor_role=actor_role,
                capstone_id=capstone_id,
                reason=normalized_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def list_student_explorations(self, student_id: int) -> Dict[str, Any]:
        try:
            if student_id <= 0:
                return {"success": False, "message": "Invalid student ID.", "data": None}
            return self.marketplace_data.list_student_explorations(student_id)
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def create_commitment_request(
        self,
        exploration_id: int,
        actor_id: int,
        actor_role: str,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if exploration_id <= 0 or actor_id <= 0:
                return {"success": False, "message": "Invalid commitment request.", "data": None}
            return self.marketplace_data.create_commitment_request(
                exploration_id=exploration_id,
                actor_id=actor_id,
                actor_role=actor_role,
                comments=comments.strip() if comments and comments.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def confirm_team_commitment_roster(
        self,
        team_id: int,
        actor_id: int,
        actor_role: str,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if team_id <= 0 or actor_id <= 0:
                return {"success": False, "message": "Invalid roster confirmation request.", "data": None}
            return self.marketplace_data.confirm_team_commitment_roster(
                team_id=team_id,
                actor_id=actor_id,
                actor_role=actor_role,
                comments=comments.strip() if comments and comments.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def cancel_exploration(
        self,
        exploration_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            if exploration_id <= 0 or actor_id <= 0:
                return {"success": False, "message": "Invalid exploration cancellation request.", "data": None}
            return self.marketplace_data.cancel_exploration(
                exploration_id=exploration_id,
                actor_id=actor_id,
                actor_role=actor_role,
                reason=reason.strip() if reason and reason.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

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
        try:
            return self.marketplace_data.list_commitment_requests(
                actor_id=actor_id,
                actor_role=actor_role,
                page=page,
                page_size=page_size,
                search=search.strip() if search and search.strip() else None,
                course_id=course_id,
                department_id=department_id,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

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
        try:
            normalized_decision = (decision or "").strip().lower()
            if normalized_decision not in {"approve", "reject", "cancel"}:
                return {"success": False, "message": "Decision must be approve, reject, or cancel.", "data": None}
            normalized_route = (decision_route or "").strip().lower() or None
            if normalized_route is not None and normalized_route not in {"course_enrolled", "interdisciplinary", "other_course"}:
                return {"success": False, "message": "Unsupported commitment decision route.", "data": None}
            normalized_member_routes: Optional[Dict[str, int]] = None
            if member_enrollment_routes:
                normalized_member_routes = {}
                for student_id, course_id in member_enrollment_routes.items():
                    student_key = str(student_id).strip()
                    if not student_key.isdigit():
                        return {"success": False, "message": "Member enrollment route keys must be student IDs.", "data": None}
                    try:
                        parsed_course_id = int(course_id)
                    except (TypeError, ValueError):
                        return {"success": False, "message": "Member enrollment route values must be course IDs.", "data": None}
                    if parsed_course_id <= 0:
                        return {"success": False, "message": "Member enrollment route values must be positive course IDs.", "data": None}
                    normalized_member_routes[student_key] = parsed_course_id
            return self.marketplace_data.decide_commitment_request(
                commitment_request_id=commitment_request_id,
                actor_id=actor_id,
                actor_role=actor_role,
                decision=normalized_decision,
                decision_route=normalized_route,
                target_course_id=target_course_id,
                member_enrollment_routes=normalized_member_routes,
                comments=comments.strip() if comments and comments.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}
