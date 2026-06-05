from typing import Dict, Any, Optional
from .courses_dl import CoursesDataLogic


class CoursesBusinessLogic:
    def __init__(self) -> None:
        self.courses_data = CoursesDataLogic()

    def create_course(self, code: str, name: str, term: Optional[str], actor_id: int) -> Dict[str, Any]:
        if not code or not code.strip():
            return {"success": False, "message": "Course code is required", "data": None}
        if not name or not name.strip():
            return {"success": False, "message": "Course name is required", "data": None}

        payload = {
            "code": code.strip().upper(),
            "name": name.strip(),
            "term": term.strip() if term else None,
            "active": True
        }

        try:
            return self.courses_data.upsert_course_rpc(
                course_id=None,
                code=payload["code"],
                name=payload["name"],
                term=payload["term"],
                active=True,
                actor_id=actor_id,
                reason="admin_course_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def list_courses(self, active_only: bool) -> Dict[str, Any]:
        try:
            rows = self.courses_data.list_courses(active_only=active_only)
            return {"success": True, "message": f"Retrieved {len(rows)} course(s)", "data": rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def get_course(self, course_id: int) -> Dict[str, Any]:
        if course_id <= 0:
            return {"success": False, "message": "Invalid course_id", "data": None}
        try:
            row = self.courses_data.get_course_by_id(course_id)
            if not row:
                return {"success": False, "message": "Course not found", "data": None}
            return {"success": True, "message": "Course retrieved", "data": row}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def update_course(
        self,
        course_id: int,
        code: Optional[str],
        name: Optional[str],
        term: Optional[str],
        active: Optional[bool],
        actor_id: int,
    ) -> Dict[str, Any]:
        if course_id <= 0:
            return {"success": False, "message": "Invalid course_id", "data": None}

        existing = self.courses_data.get_course_by_id(course_id)
        if not existing:
            return {"success": False, "message": "Course not found", "data": None}

        payload: Dict[str, Any] = {
            "code": existing.get("code"),
            "name": existing.get("name"),
            "term": existing.get("term"),
            "active": existing.get("active") is True,
        }
        if code is not None:
            if not code.strip():
                return {"success": False, "message": "Course code is required", "data": None}
            payload["code"] = code.strip().upper()
        if name is not None:
            if not name.strip():
                return {"success": False, "message": "Course name is required", "data": None}
            payload["name"] = name.strip()
        if term is not None:
            payload["term"] = term.strip() if term else None
        if active is not None:
            payload["active"] = active

        try:
            return self.courses_data.upsert_course_rpc(
                course_id=course_id,
                code=payload["code"],
                name=payload["name"],
                term=payload["term"],
                active=payload["active"],
                actor_id=actor_id,
                reason="admin_course_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}
