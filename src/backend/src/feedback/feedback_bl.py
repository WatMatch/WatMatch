from typing import Dict, Any, Optional, List
from .feedback_dl import FeedbackDataLogic
from ..capstones.capstones_dl import CapstonesDataLogic


class FeedbackBusinessLogic:
    """Business layer for feedback operations."""

    def __init__(self) -> None:
        self.feedback_data = FeedbackDataLogic()
        self.capstones_data = CapstonesDataLogic()

    def create_feedback(self, capstone_id: int, feedback_text: Optional[str] = None) -> Dict[str, Any]:
        """Create a feedback entry for a capstone."""
        try:
            if not isinstance(capstone_id, int) or capstone_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid capstone ID. Must be a positive integer.",
                    "data": None,
                }

            capstone = self.capstones_data.get_capstone_by_id(capstone_id)
            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} was not found.",
                    "data": None,
                }

            feedback_payload = {
                "capstone_fk": capstone_id,
                "feedback": (feedback_text or "").strip(),
            }

            record = self.feedback_data.create_feedback(feedback_payload)
            if not record:
                return {
                    "success": False,
                    "message": "Failed to create feedback entry.",
                    "data": None,
                }

            return {
                "success": True,
                "message": "Feedback created successfully.",
                "data": self._process_feedback_data(record),
            }

        except Exception as exc:
            return {
                "success": False,
                "message": f"Business logic error: {str(exc)}",
                "data": None,
            }

    def get_feedback_by_id(self, feedback_id: int) -> Dict[str, Any]:
        """Retrieve a single feedback entry by its ID."""
        try:
            if not isinstance(feedback_id, int) or feedback_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid feedback ID. Must be a positive integer.",
                    "data": None,
                }

            record = self.feedback_data.get_feedback_by_id(feedback_id)
            if not record:
                return {
                    "success": False,
                    "message": f"Feedback with ID {feedback_id} was not found.",
                    "data": None,
                }

            return {
                "success": True,
                "message": "Feedback retrieved successfully.",
                "data": self._process_feedback_data(record),
            }

        except Exception as exc:
            return {
                "success": False,
                "message": f"Business logic error: {str(exc)}",
                "data": None,
            }

    def get_feedback_for_capstone(self, capstone_id: int) -> Dict[str, Any]:
        """Fetch all feedback associated with a capstone."""
        try:
            if not isinstance(capstone_id, int) or capstone_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid capstone ID. Must be a positive integer.",
                    "data": None,
                }

            capstone = self.capstones_data.get_capstone_by_id(capstone_id)
            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} was not found.",
                    "data": None,
                }

            records = self.feedback_data.get_feedback_for_capstone(capstone_id)
            processed: List[Dict[str, Any]] = [
                self._process_feedback_data(item) for item in records
            ]

            return {
                "success": True,
                "message": f"Retrieved {len(processed)} feedback record(s).",
                "data": processed,
            }

        except Exception as exc:
            return {
                "success": False,
                "message": f"Business logic error: {str(exc)}",
                "data": None,
            }

    def update_feedback(
        self,
        feedback_id: int,
        feedback_text: Optional[str] = None,
        acknowledged: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """Update the text and/or acknowledgement flag for a feedback entry."""
        try:
            if not isinstance(feedback_id, int) or feedback_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid feedback ID. Must be a positive integer.",
                    "data": None,
                }

            update_payload: Dict[str, Any] = {}

            if feedback_text is not None:
                update_payload["feedback"] = feedback_text.strip()

            if acknowledged is not None:
                if not isinstance(acknowledged, bool):
                    return {
                        "success": False,
                        "message": "Acknowledged must be a boolean value if provided.",
                        "data": None,
                    }
                update_payload["acknowledged"] = acknowledged

            if not update_payload:
                return {
                    "success": False,
                    "message": "No update payload supplied.",
                    "data": None,
                }

            updated = self.feedback_data.update_feedback(
                feedback_id, update_payload)
            if not updated:
                return {
                    "success": False,
                    "message": f"Feedback with ID {feedback_id} was not found.",
                    "data": None,
                }

            return {
                "success": True,
                "message": "Feedback updated successfully.",
                "data": self._process_feedback_data(updated),
            }

        except Exception as exc:
            return {
                "success": False,
                "message": f"Business logic error: {str(exc)}",
                "data": None,
            }

    def acknowledge_feedback(self, feedback_id: int, acknowledged: bool = True) -> Dict[str, Any]:
        """Toggle the acknowledgement flag for a feedback entry."""
        return self.update_feedback(feedback_id, acknowledged=acknowledged)

    def delete_feedback(self, feedback_id: int) -> Dict[str, Any]:
        """Remove a feedback entry permanently."""
        try:
            if not isinstance(feedback_id, int) or feedback_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid feedback ID. Must be a positive integer.",
                    "data": None,
                }

            record = self.feedback_data.get_feedback_by_id(feedback_id)
            if not record:
                return {
                    "success": False,
                    "message": f"Feedback with ID {feedback_id} was not found.",
                    "data": None,
                }

            self.feedback_data.delete_feedback(feedback_id)

            return {
                "success": True,
                "message": "Feedback deleted successfully.",
                "data": self._process_feedback_data(record),
            }

        except Exception as exc:
            return {
                "success": False,
                "message": f"Business logic error: {str(exc)}",
                "data": None,
            }

    def _process_feedback_data(self, feedback: Dict[Any, Any]) -> Dict[Any, Any]:
        enriched = dict(feedback)
        enriched["source"] = "watmatch-server"
        return enriched
