from typing import Optional, Dict, Any
from src.config.database import supabase
from src.workflow.rpc_utils import call_json_rpc


class CoursesDataLogic:
    def __init__(self) -> None:
        self.table_name = "courses"

    def upsert_course_rpc(
        self,
        course_id: Optional[int],
        code: str,
        name: str,
        term: Optional[str],
        active: bool,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_admin_upsert_course",
            {
                "p_course_id": course_id,
                "p_code": code,
                "p_name": name,
                "p_term": term,
                "p_active": active,
                "p_actor_id": actor_id,
                "p_reason": reason,
            },
        )

    def list_courses(self, active_only: bool = False) -> list[Dict[str, Any]]:
        query = supabase.table(self.table_name).select("*").order("code")
        if active_only:
            query = query.eq("active", True)
        response = query.execute()
        return response.data or []

    def get_course_by_id(self, course_id: int) -> Optional[Dict[str, Any]]:
        response = supabase.table(self.table_name).select(
            "*").eq("course_id", course_id).execute()
        if not response.data:
            return None
        return response.data[0]

