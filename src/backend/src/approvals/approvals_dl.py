from typing import Any, Dict
from src.config.database import supabase


class ApprovalsDataLogic:
    def __init__(self) -> None:
        self.table_name = "approvals"

    def get_history_for_capstone(self, capstone_id: int) -> list[Dict[str, Any]]:
        response = (
            supabase.table(self.table_name)
            .select("*")
            .eq("capstone_fk", capstone_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []
