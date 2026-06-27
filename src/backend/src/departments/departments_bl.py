from typing import Any, Dict, Optional

from .departments_dl import DepartmentsDataLogic


class DepartmentsBusinessLogic:
    def __init__(self) -> None:
        self.departments_data = DepartmentsDataLogic()

    def list_departments(self, active_only: bool) -> Dict[str, Any]:
        try:
            rows = self.departments_data.list_departments(active_only=active_only)
            return {
                "success": True,
                "message": f"Retrieved {len(rows)} department(s)",
                "data": rows,
            }
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def list_faculties(self, active_only: bool) -> Dict[str, Any]:
        try:
            rows = self.departments_data.list_faculties(active_only=active_only)
            return {
                "success": True,
                "message": f"Retrieved {len(rows)} faculty record(s)",
                "data": rows,
            }
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def get_department(self, department_id: int) -> Dict[str, Any]:
        if department_id <= 0:
            return {"success": False, "message": "Invalid department_id", "data": None}
        try:
            row = self.departments_data.get_department_by_id(department_id)
            if not row:
                return {"success": False, "message": "Department not found", "data": None}
            return {"success": True, "message": "Department retrieved", "data": row}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def create_department(
        self,
        name: str,
        actor_id: int,
        faculty_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not name or not name.strip():
            return {"success": False, "message": "Department name is required", "data": None}
        try:
            return self.departments_data.upsert_department_rpc(
                department_id=None,
                name=name.strip(),
                active=True,
                actor_id=actor_id,
                faculty_id=faculty_id,
                reason="admin_department_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def update_department(
        self,
        department_id: int,
        name: Optional[str],
        active: Optional[bool],
        faculty_id: Optional[int],
        actor_id: int,
    ) -> Dict[str, Any]:
        if department_id <= 0:
            return {"success": False, "message": "Invalid department_id", "data": None}
        existing = self.departments_data.get_department_by_id(department_id)
        if not existing:
            return {"success": False, "message": "Department not found", "data": None}

        next_name = existing.get("name") or ""
        if name is not None:
            if not name.strip():
                return {"success": False, "message": "Department name is required", "data": None}
            next_name = name.strip()

        try:
            return self.departments_data.upsert_department_rpc(
                department_id=department_id,
                name=next_name,
                active=existing.get("active") is True if active is None else bool(active),
                actor_id=actor_id,
                faculty_id=existing.get("faculty_fk") if faculty_id is None else faculty_id,
                reason="admin_department_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}
