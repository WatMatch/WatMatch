from src.config.database import supabase
from typing import Optional, Dict, Any
from src.workflow.rpc_utils import call_json_rpc


class CapstonesDataLogic:
    """Data layer for capstone operations"""

    def __init__(self):
        self.table_name = "capstones"

    def review_capstone_rpc(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase capstone review workflow."""
        try:
            return call_json_rpc(
                "watmatch_review_capstone",
                {
                    "p_capstone_id": capstone_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_decision": decision,
                    "p_comments": comments,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in review_capstone_rpc: {str(e)}")

    def archive_capstone_rpc(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase capstone archive/disband workflow."""
        try:
            return call_json_rpc(
                "watmatch_archive_capstone",
                {
                    "p_capstone_id": capstone_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in archive_capstone_rpc: {str(e)}")

    def complete_capstone_rpc(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
        notes: Optional[str] = None,
        completed_term: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase capstone completion workflow."""
        try:
            return call_json_rpc(
                "watmatch_complete_capstone",
                {
                    "p_capstone_id": capstone_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_notes": notes,
                    "p_completed_term": completed_term,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in complete_capstone_rpc: {str(e)}")

    def create_capstone_with_new_team_rpc(
        self,
        user_id: int,
        course_id: int,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Run the transactional Supabase capstone + new team submission workflow."""
        try:
            return call_json_rpc(
                "watmatch_create_capstone_with_new_team",
                {
                    "p_user_id": user_id,
                    "p_course_id": course_id,
                    "p_payload": payload,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_capstone_with_new_team_rpc: {str(e)}")

    def create_capstone_for_existing_team_rpc(
        self,
        user_id: int,
        team_id: int,
        course_id: int,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Run the transactional Supabase capstone + existing team submission workflow."""
        try:
            return call_json_rpc(
                "watmatch_create_capstone_for_existing_team",
                {
                    "p_user_id": user_id,
                    "p_team_id": team_id,
                    "p_course_id": course_id,
                    "p_payload": payload,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_capstone_for_existing_team_rpc: {str(e)}")

    def resubmit_capstone_rpc(
        self,
        capstone_id: int,
        student_id: int,
        payload: Dict[str, Any],
        change_summary: str,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase capstone resubmission workflow."""
        try:
            return call_json_rpc(
                "watmatch_resubmit_capstone",
                {
                    "p_capstone_id": capstone_id,
                    "p_student_id": student_id,
                    "p_payload": payload,
                    "p_change_summary": change_summary,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in resubmit_capstone_rpc: {str(e)}")

    def withdraw_capstone_review_rpc(
        self,
        capstone_id: int,
        student_id: int,
    ) -> Dict[str, Any]:
        """Move a pending review capstone back to draft through the database workflow."""
        try:
            return call_json_rpc(
                "watmatch_withdraw_capstone_review",
                {
                    "p_capstone_id": capstone_id,
                    "p_student_id": student_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in withdraw_capstone_review_rpc: {str(e)}")

    def get_capstone_by_id(self, capstone_id: int) -> Optional[Dict[Any, Any]]:
        """Get a capstone by its ID"""
        try:
            response = supabase.table(self.table_name).select(
                "*").eq("capstone_id", capstone_id).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in get_capstone_by_id: {str(e)}")

    def get_review_capstones(
        self,
        actor_id: int,
        actor_role: str,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get reviewable capstones with course scoping and pagination in Postgres."""
        try:
            payload = call_json_rpc(
                "watmatch_get_review_capstones",
                {
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_page": page,
                    "p_page_size": page_size,
                },
            )
            return {
                "data": payload.get("data") or [],
                "total": payload.get("total", 0),
                "page": payload.get("page", page),
                "page_size": payload.get("page_size", page_size),
            }
        except Exception as e:
            raise Exception(f"Database error in get_review_capstones: {str(e)}")

    def get_course_routing_capstones(
        self,
        actor_id: int,
        actor_role: str,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        department_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get capstones waiting for course routing."""
        try:
            payload = call_json_rpc(
                "watmatch_get_course_routing_capstones",
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
            return {
                "data": payload.get("data") or [],
                "total": payload.get("total", 0),
                "page": payload.get("page", page),
                "page_size": payload.get("page_size", page_size),
            }
        except Exception as e:
            raise Exception(f"Database error in get_course_routing_capstones: {str(e)}")

    def route_capstone_course_rpc(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
        target_course_id: int,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Route a capstone to a target course for instructor review."""
        try:
            return call_json_rpc(
                "watmatch_admin_route_capstone_course",
                {
                    "p_capstone_id": capstone_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_target_course_id": target_course_id,
                    "p_comments": comments,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in route_capstone_course_rpc: {str(e)}")

    def create_project_submission_enrollment_request_rpc(
        self,
        student_id: int,
        target_course_id: int,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Student requests a course assignment before submitting a capstone proposal."""
        try:
            return call_json_rpc(
                "watmatch_create_project_submission_enrollment_request",
                {
                    "p_student_id": student_id,
                    "p_target_course_id": target_course_id,
                    "p_comments": comments,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_project_submission_enrollment_request_rpc: {str(e)}")

    def get_project_submission_enrollment_requests(
        self,
        actor_id: int,
        actor_role: str,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        department_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get no-course project submission enrollment requests."""
        try:
            payload = call_json_rpc(
                "watmatch_get_project_submission_enrollment_requests",
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
            return {
                "data": payload.get("data") or [],
                "total": payload.get("total", 0),
                "page": payload.get("page", page),
                "page_size": payload.get("page_size", page_size),
                "total_pages": payload.get("total_pages"),
            }
        except Exception as e:
            raise Exception(f"Database error in get_project_submission_enrollment_requests: {str(e)}")

    def decide_project_submission_enrollment_request_rpc(
        self,
        request_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        target_course_id: Optional[int] = None,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Approve/reject/cancel a course request for capstone proposal submission."""
        try:
            return call_json_rpc(
                "watmatch_decide_project_submission_enrollment_request",
                {
                    "p_request_id": request_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_decision": decision,
                    "p_target_course_id": target_course_id,
                    "p_comments": comments,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in decide_project_submission_enrollment_request_rpc: {str(e)}")

    def get_recruiting_capstones(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get instructor-approved public recruiting capstones with filters applied in Postgres."""
        try:
            payload = call_json_rpc(
                "watmatch_get_recruiting_capstones",
                {
                    "p_page": page,
                    "p_page_size": page_size,
                    "p_search": search,
                    "p_department": department,
                    "p_year": year,
                },
            )
            return {
                "data": payload.get("data") or [],
                "total": payload.get("total", 0),
                "page": payload.get("page", page),
                "page_size": payload.get("page_size", page_size),
            }
        except Exception as e:
            raise Exception(f"Database error in get_recruiting_capstones: {str(e)}")

    def get_recruiting_capstone_metadata(self) -> Dict[str, Any]:
        """Get full recruiting-capstone filter metadata from Postgres."""
        try:
            payload = call_json_rpc("watmatch_get_recruiting_capstone_metadata", {})
            return payload or {"success": True, "data": {"departments": [], "years": []}}
        except Exception as e:
            raise Exception(f"Database error in get_recruiting_capstone_metadata: {str(e)}")

    def get_finalized_capstones(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get live finalized capstones with filters applied in Postgres."""
        try:
            payload = call_json_rpc(
                "watmatch_get_finalized_capstones",
                {
                    "p_page": page,
                    "p_page_size": page_size,
                    "p_search": search,
                    "p_department": department,
                    "p_year": year,
                },
            )
            return {
                "data": payload.get("data") or [],
                "total": payload.get("total", 0),
                "page": payload.get("page", page),
                "page_size": payload.get("page_size", page_size),
            }
        except Exception as e:
            raise Exception(f"Database error in get_finalized_capstones: {str(e)}")

    def get_finalized_capstone_metadata(self) -> Dict[str, Any]:
        """Get full live-finalized capstone filter metadata from Postgres."""
        try:
            payload = call_json_rpc("watmatch_get_finalized_capstone_metadata", {})
            return payload or {"success": True, "data": {"departments": [], "years": []}}
        except Exception as e:
            raise Exception(f"Database error in get_finalized_capstone_metadata: {str(e)}")

    def list_active_mentors_rpc(
        self,
        actor_id: int,
        actor_role: str,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        availability_term: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_active_mentor_users",
                {
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_search": search,
                    "p_department_id": department_id,
                    "p_availability_term": availability_term,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in list_active_mentors_rpc: {str(e)}")

    def upsert_mentor_profile_rpc(
        self,
        actor_id: int,
        actor_role: str,
        mentor_id: Optional[int] = None,
        display_name: Optional[str] = None,
        primary_department_id: Optional[int] = None,
        department_ids: Optional[list[int]] = None,
        affiliation: Optional[str] = None,
        bio: Optional[str] = None,
        availability_terms: Optional[list[str]] = None,
        expertise_tags: Optional[list[str]] = None,
        max_active_projects: Optional[int] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_upsert_mentor_profile",
                {
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_mentor_id": mentor_id,
                    "p_display_name": display_name,
                    "p_primary_department_id": primary_department_id,
                    "p_department_ids": department_ids,
                    "p_affiliation": affiliation,
                    "p_bio": bio,
                    "p_availability_terms": availability_terms,
                    "p_expertise_tags": expertise_tags,
                    "p_max_active_projects": max_active_projects,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in upsert_mentor_profile_rpc: {str(e)}")

    def create_mentor_request_rpc(
        self,
        capstone_id: int,
        mentor_id: int,
        actor_id: int,
        actor_role: str,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_create_mentor_request",
                {
                    "p_capstone_id": capstone_id,
                    "p_mentor_id": mentor_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_message": message,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_mentor_request_rpc: {str(e)}")

    def create_mentor_offer_rpc(
        self,
        capstone_id: int,
        actor_id: int,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_create_mentor_offer",
                {
                    "p_capstone_id": capstone_id,
                    "p_actor_id": actor_id,
                    "p_message": message,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_mentor_offer_rpc: {str(e)}")

    def decide_mentor_request_rpc(
        self,
        request_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        response_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_decide_mentor_request",
                {
                    "p_request_id": request_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_decision": decision,
                    "p_response_note": response_note,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in decide_mentor_request_rpc: {str(e)}")

    def decide_mentor_offer_rpc(
        self,
        request_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        response_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_decide_mentor_offer",
                {
                    "p_request_id": request_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_decision": decision,
                    "p_response_note": response_note,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in decide_mentor_offer_rpc: {str(e)}")

    def cancel_mentor_request_rpc(
        self,
        request_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_cancel_mentor_request",
                {
                    "p_request_id": request_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in cancel_mentor_request_rpc: {str(e)}")

    def get_mentor_dashboard_rpc(
        self,
        actor_id: int,
        actor_role: str,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_get_mentor_dashboard",
                {
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in get_mentor_dashboard_rpc: {str(e)}")

    def get_capstone_mentor_requests_rpc(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_get_capstone_mentor_requests",
                {
                    "p_capstone_id": capstone_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in get_capstone_mentor_requests_rpc: {str(e)}")

    def get_past_capstones(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
        student_id: Optional[int] = None,
        saved_only: bool = False,
    ) -> Dict[str, Any]:
        """Get past capstones with filtering and pagination applied in Postgres."""
        try:
            payload = call_json_rpc(
                "watmatch_get_past_capstones",
                {
                    "p_page": page,
                    "p_page_size": page_size,
                    "p_search": search,
                    "p_department": department,
                    "p_year": year,
                    "p_student_id": student_id,
                    "p_saved_only": saved_only,
                },
            )
            return {
                "data": payload.get("data") or [],
                "total": payload.get("total", 0),
                "page": payload.get("page", page),
                "page_size": payload.get("page_size", page_size),
                "total_pages": payload.get("total_pages", 1),
            }
        except Exception as e:
            raise Exception(f"Database error in get_past_capstones: {str(e)}")

    def get_past_capstone_metadata(self) -> Dict[str, Any]:
        """Get full past-capstone filter metadata from Postgres."""
        try:
            payload = call_json_rpc("watmatch_get_past_capstone_metadata", {})
            return payload or {"success": True, "data": {"departments": [], "years": [], "courses": []}}
        except Exception as e:
            raise Exception(f"Database error in get_past_capstone_metadata: {str(e)}")

    def get_past_watmatch_capstones(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
        student_id: Optional[int] = None,
        saved_only: bool = False,
    ) -> Dict[str, Any]:
        """Get completed WatMatch-native capstones with filtering and pagination."""
        try:
            payload = call_json_rpc(
                "watmatch_get_past_watmatch_capstones",
                {
                    "p_page": page,
                    "p_page_size": page_size,
                    "p_search": search,
                    "p_department": department,
                    "p_year": year,
                    "p_student_id": student_id,
                    "p_saved_only": saved_only,
                },
            )
            return {
                "data": payload.get("data") or [],
                "total": payload.get("total", 0),
                "page": payload.get("page", page),
                "page_size": payload.get("page_size", page_size),
                "total_pages": payload.get("total_pages", 1),
            }
        except Exception as e:
            raise Exception(f"Database error in get_past_watmatch_capstones: {str(e)}")

    def get_past_watmatch_capstone_metadata(self) -> Dict[str, Any]:
        """Get filter metadata for completed WatMatch-native capstones."""
        try:
            payload = call_json_rpc("watmatch_get_past_watmatch_capstone_metadata", {})
            return payload or {"success": True, "data": {"departments": [], "years": [], "courses": []}}
        except Exception as e:
            raise Exception(f"Database error in get_past_watmatch_capstone_metadata: {str(e)}")

    def upsert_past_capstone_shortlist_rpc(
        self,
        student_id: int,
        source_type: str,
        source_id: int,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_upsert_past_capstone_shortlist",
                {
                    "p_student_id": student_id,
                    "p_source_type": source_type,
                    "p_source_id": source_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in upsert_past_capstone_shortlist_rpc: {str(e)}")

    def delete_past_capstone_shortlist_rpc(
        self,
        student_id: int,
        source_type: str,
        source_id: int,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_delete_past_capstone_shortlist",
                {
                    "p_student_id": student_id,
                    "p_source_type": source_type,
                    "p_source_id": source_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in delete_past_capstone_shortlist_rpc: {str(e)}")

    def list_student_past_capstone_shortlists_rpc(
        self,
        student_id: int,
        limit: int = 6,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_list_student_past_capstone_shortlists",
                {
                    "p_student_id": student_id,
                    "p_limit": limit,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in list_student_past_capstone_shortlists_rpc: {str(e)}")

    def upsert_past_capstone_rpc(
        self,
        past_capstone_id: Optional[int],
        title: str,
        description: Optional[str],
        department: str,
        year: str,
        students: Optional[list[str]],
        source_course_id: Optional[int],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_admin_upsert_past_capstone",
                {
                    "p_past_capstone_id": past_capstone_id,
                    "p_title": title,
                    "p_description": description,
                    "p_department": department,
                    "p_year": year,
                    "p_students": students,
                    "p_source_fk": source_course_id,
                    "p_actor_id": actor_id,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in upsert_past_capstone_rpc: {str(e)}")

    def delete_past_capstone_rpc(
        self,
        past_capstone_id: int,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_admin_delete_past_capstone",
                {
                    "p_past_capstone_id": past_capstone_id,
                    "p_actor_id": actor_id,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in delete_past_capstone_rpc: {str(e)}")

