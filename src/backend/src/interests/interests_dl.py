from typing import Optional, Dict, Any, List
from ..config.database import supabase
from src.workflow.rpc_utils import call_json_rpc


class InterestsDL:
    def _get_capstone(self, capstone_id: int) -> Optional[Dict[str, Any]]:
        res = (
            supabase.table("capstones")
            .select("capstone_id,user_fk,team_fk,title,status,approval,archived")
            .eq("capstone_id", capstone_id)
            .limit(1)
            .execute()
        )
        data = getattr(res, "data", None)
        if data and len(data) > 0:
            return data[0]
        return None

    def _get_team_id_by_capstone(self, capstone_id: int) -> Optional[int]:
        """Get team_id from capstone_id"""
        res = supabase.table("teams").select("team_id").eq("capstone_fk", capstone_id).limit(1).execute()
        data = getattr(res, "data", None)
        if data and len(data) > 0:
            return data[0].get("team_id")
        return None

    def add_interest(self, capstone_id: int, student_id: int, message: Optional[str]) -> Dict[str, Any]:
        """Add student interest through the transactional database workflow."""
        try:
            return call_json_rpc(
                "watmatch_express_project_interest",
                {
                    "p_capstone_id": capstone_id,
                    "p_student_id": student_id,
                    "p_message": message,
                },
            ) or {"success": False, "message": "Interest could not be recorded"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def remove_interest(self, capstone_id: int, student_id: int) -> Dict[str, Any]:
        """Withdraw interest through the transactional database workflow."""
        try:
            return call_json_rpc(
                "watmatch_withdraw_project_interest",
                {
                    "p_capstone_id": capstone_id,
                    "p_student_id": student_id,
                },
            ) or {"success": False, "message": "Interest could not be withdrawn"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_interested_students(self, capstone_id: int) -> Dict[str, Any]:
        """Get all students interested in a capstone's team"""
        capstone = self._get_capstone(capstone_id)
        if (
            not capstone
            or capstone.get("archived") is True
            or (capstone.get("status") or "").lower() != "approved_recruiting"
        ):
            return {"success": True, "data": []}

        team_id = self._get_team_id_by_capstone(capstone_id)
        if not team_id:
            return {"success": True, "data": []}

        try:
            res = (
                supabase.table("project_explorations")
                .select("*")
                .eq("team_fk", team_id)
                .eq("status", "interested")
                .order("created_at", desc=True)
                .execute()
            )
            interest_rows = getattr(res, "data", []) or []

            student_ids = [r["student_fk"] for r in interest_rows if r.get("student_fk") is not None]
            students_map = {}
            courses_map = {}
            departments_map = {}

            if student_ids:
                users_res = supabase.table("users").select("user_id,email,course_fk,home_department_fk").in_("user_id", student_ids).execute()
                users = getattr(users_res, "data", []) or []
                students_map = {u["user_id"]: u for u in users}
                course_ids = sorted({
                    u["course_fk"]
                    for u in users
                    if u.get("course_fk") is not None
                })
                if course_ids:
                    courses_res = (
                        supabase.table("courses")
                        .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind")
                        .in_("course_id", course_ids)
                        .execute()
                    )
                    courses_map = {
                        c["course_id"]: c
                        for c in (getattr(courses_res, "data", []) or [])
                        if c.get("course_id") is not None
                    }
                department_ids = sorted({
                    u["home_department_fk"]
                    for u in users
                    if u.get("home_department_fk") is not None
                })
                if department_ids:
                    departments_res = (
                        supabase.table("departments")
                        .select("department_id,name,active")
                        .in_("department_id", department_ids)
                        .execute()
                    )
                    departments_map = {
                        d["department_id"]: d
                        for d in (getattr(departments_res, "data", []) or [])
                        if d.get("department_id") is not None
                    }

            result_list: List[Dict[str, Any]] = []
            for r in interest_rows:
                sid = r.get("student_fk")
                user = students_map.get(sid, {"user_id": sid, "email": None, "name": None})
                result_list.append({
                    "exploration_id": r.get("exploration_id"),
                    "user_id": user.get("user_id"),
                    "email": user.get("email"),
                    "course_fk": user.get("course_fk"),
                    "course": courses_map.get(user.get("course_fk")),
                    "home_department_id": user.get("home_department_fk"),
                    "home_department": departments_map.get(user.get("home_department_fk")),
                    "message": r.get("message"),
                    "created_at": r.get("created_at"),
                })

            return {"success": True, "data": result_list}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_student_interests(self, student_id: int) -> Dict[str, Any]:
        """Get a student's active marketplace project signals in the legacy interest shape."""
        try:
            payload = call_json_rpc(
                "watmatch_list_student_explorations",
                {"p_student_id": student_id},
            )
            explorations = payload.get("data") if isinstance(payload, dict) else []
            if not isinstance(explorations, list):
                return {"success": True, "data": []}

            result_list: List[Dict[str, Any]] = []
            for exploration in explorations:
                status = (exploration.get("status") or "").lower()
                if status not in {"interested", "invited", "exploring", "pending_commitment", "committed"}:
                    continue
                team = exploration.get("team") or {}
                capstone = exploration.get("capstone") or {}
                result_list.append({
                    "exploration_id": exploration.get("exploration_id"),
                    "status": status,
                    "team_id": team.get("team_id") or exploration.get("team_fk"),
                    "capstone_id": capstone.get("capstone_id") or exploration.get("capstone_fk"),
                    "project_name": capstone.get("title", "Unknown Project"),
                    "project_description": capstone.get("description"),
                    "message": exploration.get("message"),
                    "student_commitment_confirmed_at": exploration.get("student_commitment_confirmed_at"),
                    "team_commitment_confirmed_at": exploration.get("team_commitment_confirmed_at"),
                    "student_commitment_confirmed": exploration.get("student_commitment_confirmed"),
                    "team_commitment_confirmed": exploration.get("team_commitment_confirmed"),
                    "created_at": exploration.get("created_at"),
                    "updated_at": exploration.get("updated_at"),
                })

            return {"success": True, "data": result_list}
        except Exception as e:
            return {"success": False, "message": str(e)}
