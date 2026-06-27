from typing import Any, Dict, Optional

from src.config.database import supabase
from src.workflow.rpc_utils import call_json_rpc


class DepartmentsDataLogic:
    def __init__(self) -> None:
        self.table_name = "departments"

    def _enrich_departments(self, departments: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        faculty_ids = sorted({
            int(department["faculty_fk"])
            for department in departments
            if department.get("faculty_fk") is not None
        })
        faculties_by_id: Dict[int, Dict[str, Any]] = {}
        if faculty_ids:
            faculties = (
                supabase.table("faculties")
                .select("faculty_id,name,active")
                .in_("faculty_id", faculty_ids)
                .execute()
                .data
                or []
            )
            faculties_by_id = {
                int(faculty["faculty_id"]): faculty
                for faculty in faculties
                if faculty.get("faculty_id") is not None
            }

        return [
            {
                **department,
                "faculty_id": department.get("faculty_fk"),
                "faculty": (
                    faculties_by_id.get(int(department["faculty_fk"]))
                    if department.get("faculty_fk") is not None
                    else None
                ),
            }
            for department in departments
        ]

    def list_faculties(self, active_only: bool = False) -> list[Dict[str, Any]]:
        query = supabase.table("faculties").select("*").order("name")
        if active_only:
            query = query.eq("active", True)
        response = query.execute()
        return response.data or []

    def list_departments(self, active_only: bool = False) -> list[Dict[str, Any]]:
        query = supabase.table(self.table_name).select("*").order("name")
        if active_only:
            query = query.eq("active", True)
        response = query.execute()
        return self._enrich_departments(response.data or [])

    def get_department_by_id(self, department_id: int) -> Optional[Dict[str, Any]]:
        response = (
            supabase.table(self.table_name)
            .select("*")
            .eq("department_id", department_id)
            .limit(1)
            .execute()
        )
        row = (response.data or [None])[0]
        return self._enrich_departments([row])[0] if row else None

    def upsert_department_rpc(
        self,
        department_id: Optional[int],
        name: str,
        active: bool,
        actor_id: int,
        faculty_id: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_admin_upsert_department",
            {
                "p_department_id": department_id,
                "p_name": name,
                "p_active": active,
                "p_actor_id": actor_id,
                "p_faculty_id": faculty_id,
                "p_reason": reason,
            },
        )
