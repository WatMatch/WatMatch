from typing import Optional, Dict, Any, List
from ..config.database import supabase


class InterestsDL:
    def _get_team_id_by_capstone(self, capstone_id: int) -> Optional[int]:
        """Get team_id from capstone_id"""
        res = supabase.table("teams").select("team_id").eq("capstone_fk", capstone_id).limit(1).execute()
        data = getattr(res, "data", None)
        if data and len(data) > 0:
            return data[0].get("team_id")
        return None

    def _get_student_team(self, student_id: int) -> Optional[Dict[str, Any]]:
        """Check if student is already part of a team (leader or member)"""
        try:
            # Check if leader
            res = supabase.table("teams").select("*").eq("leader_fk", student_id).execute()
            if res.data:
                return res.data[0]

            # Check if member
            # res = supabase.table("teams").select("*").contains("members", [student_id]).execute()
            res = supabase.table("teams").select("*").filter("members", "cs", f"{{{student_id}}}").execute()
            if res.data:
                return res.data[0]

            return None
        except Exception:
            return None

    def add_interest(self, capstone_id: int, student_id: int, message: Optional[str]) -> Dict[str, Any]:
        """Add student interest in a team (via team_interest table)"""
        team_id = self._get_team_id_by_capstone(capstone_id)
        if not team_id:
            return {"success": False, "message": "No team found for this capstone"}

        # Check if student is already in a team
        existing_team = self._get_student_team(student_id)
        if existing_team:
            return {"success": False, "message": "You are already part of a team"}

        payload = {
            "team_id": team_id,
            "student_id": student_id,
            "message": message,
        }

        try:
            res = supabase.table("team_interest").upsert(payload).execute()
            if getattr(res, "status_code", None) and res.status_code >= 400:
                return {"success": False, "message": f"Database error: {getattr(res, 'data', res)}"}
            return {"success": True, "message": "Interest recorded", "data": {"team_id": team_id, "student_id": student_id}}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def remove_interest(self, capstone_id: int, student_id: int) -> Dict[str, Any]:
        """Remove student interest from a team"""
        team_id = self._get_team_id_by_capstone(capstone_id)
        if not team_id:
            return {"success": False, "message": "No team found for this capstone"}

        try:
            res = supabase.table("team_interest").delete().eq("team_id", team_id).eq("student_id", student_id).execute()
            return {"success": True, "message": "Interest withdrawn"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_interested_students(self, capstone_id: int) -> Dict[str, Any]:
        """Get all students interested in a capstone's team"""
        team_id = self._get_team_id_by_capstone(capstone_id)
        if not team_id:
            return {"success": True, "data": []}

        try:
            # Fetch interest rows
            res = supabase.table("team_interest").select("*").eq("team_id", team_id).order("created_at", desc=True).execute()
            interest_rows = getattr(res, "data", []) or []

            # Gather student ids
            student_ids = [r["student_id"] for r in interest_rows if r.get("student_id") is not None]
            students_map = {}

            # Fetch all users for those ids in a single request
            if student_ids:
                # users_res = supabase.table("users").select("user_id,email,name").in_("user_id", student_ids).execute()
                users_res = supabase.table("users").select("user_id,email").in_("user_id", student_ids).execute()
                users = getattr(users_res, "data", []) or []
                students_map = {u["user_id"]: u for u in users}

            # Combine interest rows with user info
            result_list: List[Dict[str, Any]] = []
            for r in interest_rows:
                sid = r.get("student_id")
                user = students_map.get(sid, {"user_id": sid, "email": None, "name": None})
                result_list.append({
                    "user_id": user.get("user_id"),
                    "email": user.get("email"),
                    # "name": user.get("name"),
                    "message": r.get("message"),
                    "created_at": r.get("created_at"),
                })

            return {"success": True, "data": result_list}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def remove_all_interests_for_student(self, student_id: int) -> Dict[str, Any]:
        """Remove student from all team interest lists (called after acceptance)"""
        try:
            res = supabase.table("team_interest").delete().eq("student_id", student_id).execute()
            return {"success": True, "message": "All interests removed"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_student_interests(self, student_id: int) -> Dict[str, Any]:
        """Get all teams a student has expressed interest in"""
        try:
            # Get all interest records for this student
            res = supabase.table("team_interest").select("team_id, message, created_at").eq("student_id", student_id).execute()
            interest_rows = getattr(res, "data", []) or []

            if not interest_rows:
                return {"success": True, "data": []}

            # Get team IDs
            team_ids = [r["team_id"] for r in interest_rows]

            # Fetch team details
            teams_res = supabase.table("teams").select("team_id, capstone_fk, leader_fk").in_("team_id", team_ids).execute()
            teams = getattr(teams_res, "data", []) or []
            teams_map = {t["team_id"]: t for t in teams}

            # Get capstone IDs
            capstone_ids = [t.get("capstone_fk") for t in teams if t.get("capstone_fk")]

            # Fetch capstone details
            capstones_map = {}
            if capstone_ids:
                capstones_res = supabase.table("capstones").select("capstone_id, title, description").in_("capstone_id", capstone_ids).execute()
                capstones = getattr(capstones_res, "data", []) or []
                capstones_map = {c["capstone_id"]: c for c in capstones}

            # Combine all data
            result_list: List[Dict[str, Any]] = []
            for interest in interest_rows:
                team_id = interest["team_id"]
                team = teams_map.get(team_id, {})
                capstone_id = team.get("capstone_fk")
                capstone = capstones_map.get(capstone_id, {}) if capstone_id else {}

                result_list.append({
                    "team_id": team_id,
                    "capstone_id": capstone_id,
                    "project_name": capstone.get("title", "Unknown Project"),
                    "project_description": capstone.get("description"),
                    "message": interest.get("message"),
                    "created_at": interest.get("created_at"),
                })

            return {"success": True, "data": result_list}
        except Exception as e:
            return {"success": False, "message": str(e)}