from typing import Dict, Any, Optional
from .approvals_dl import ApprovalsDataLogic
from ..config.database import supabase


class ApprovalsBusinessLogic:
    def __init__(self) -> None:
        self.approvals_data = ApprovalsDataLogic()

    def _name_from_email(self, email: Optional[str], fallback: str) -> str:
        if not email or "@" not in email:
            return fallback
        local_part = email.split("@", 1)[0]
        cleaned = local_part.replace(".", " ").replace("_", " ").replace("-", " ").strip()
        return cleaned.title() if cleaned else fallback

    def get_capstone_history(self, capstone_id: int) -> Dict[str, Any]:
        if capstone_id <= 0:
            return {"success": False, "message": "Invalid capstone_id", "data": None}
        try:
            rows = self.approvals_data.get_history_for_capstone(capstone_id)
            instructor_ids = sorted(
                {
                    row.get("instructor_fk")
                    for row in rows
                    if row.get("instructor_fk") is not None
                }
            )
            instructor_lookup: Dict[int, Dict[str, Optional[str]]] = {}
            if instructor_ids:
                users_res = (
                    supabase.table("users")
                    .select("user_id,email")
                    .in_("user_id", instructor_ids)
                    .execute()
                )
                for user in (users_res.data or []):
                    uid = user.get("user_id")
                    if uid is not None:
                        email = user.get("email")
                        name = self._name_from_email(email, f"instructor {uid}")
                        instructor_lookup[int(uid)] = {"name": name, "email": email}

            enriched_rows = []
            for row in rows:
                instructor_fk = row.get("instructor_fk")
                normalized = dict(row)
                if instructor_fk is not None:
                    lookup = instructor_lookup.get(int(instructor_fk), {})
                    name = lookup.get("name") or f"instructor {instructor_fk}"
                    email = lookup.get("email")
                    normalized["instructor_name"] = name
                    normalized["instructor_email"] = email
                    normalized["instructor_display"] = f"{name} ({email})" if email else name
                else:
                    normalized["instructor_name"] = None
                    normalized["instructor_email"] = None
                    normalized["instructor_display"] = None
                enriched_rows.append(normalized)
            return {"success": True, "message": f"Retrieved {len(enriched_rows)} record(s)", "data": enriched_rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}
