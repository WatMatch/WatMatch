from typing import Optional, Dict, Any, List
from src.config.database import supabase


class FeedbackDataLogic:
    """Data layer for feedback operations"""

    def __init__(self) -> None:
        self.table_name = "feedback"

    def create_feedback(self, feedback_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Insert a new feedback row."""
        try:
            response = supabase.table(self.table_name).insert(
                feedback_data).execute()

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(
                f"Database error in create_feedback: {str(e)}") from e

    def get_feedback_by_id(self, feedback_id: int) -> Optional[Dict[Any, Any]]:
        """Fetch a single feedback row by its identifier."""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("feedback_id", feedback_id)
                .execute()
            )

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(
                f"Database error in get_feedback_by_id: {str(e)}") from e

    def get_feedback_for_capstone(self, capstone_id: int) -> List[Dict[Any, Any]]:
        """Fetch feedback rows for a capstone, newest first."""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("capstone_fk", capstone_id)
                .order("created_at", desc=True)
                .execute()
            )

            if not response.data:
                return []

            return response.data

        except Exception as e:
            raise Exception(
                f"Database error in get_feedback_for_capstone: {str(e)}"
            ) from e

    def update_feedback(self, feedback_id: int, update_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Update an existing feedback row."""
        try:
            response = (
                supabase.table(self.table_name)
                .update(update_data)
                .eq("feedback_id", feedback_id)
                .execute()
            )

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(
                f"Database error in update_feedback: {str(e)}") from e

    def delete_feedback(self, feedback_id: int) -> bool:
        """Delete a feedback row by its identifier."""
        try:
            supabase.table(self.table_name).delete().eq(
                "feedback_id", feedback_id).execute()
            return True

        except Exception as e:
            raise Exception(
                f"Database error in delete_feedback: {str(e)}") from e
