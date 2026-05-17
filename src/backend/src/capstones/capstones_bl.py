from .capstones_dl import CapstonesDataLogic
from ..teams.teams_bl import TeamsBusinessLogic
from typing import Dict, Any, Optional
from ..config.database import supabase
from ..mailer.mailer import send_capstone_approval_email, send_capstone_rejection_email, send_capstone_changes_email


class CapstonesBusinessLogic:
    """Business layer for capstone operations"""

    def __init__(self):
        self.capstones_data = CapstonesDataLogic()
        self.teams_business = TeamsBusinessLogic()

    def create_capstone_with_team(self, user_id: int, title: str, course_id: int, description: str = None) -> Dict[str, Any]:
        """Create a capstone project and automatically create a team for the user"""
        try:

            # Validate inputs
            if not isinstance(user_id, int) or user_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid user ID. Must be a positive integer.",
                    "data": None
                }

            if not title or not title.strip():
                return {
                    "success": False,
                    "message": "Title is required and cannot be empty.",
                    "data": None
                }

            # Prepare capstone data with defaults
            capstone_data = {
                "user_fk": user_id,
                "title": title.strip(),
                "description": description.strip() if description else None,
                "status": "draft",
                "disciplines": [],
                "skills": [],
                "approval": False
            }

            # Create the capstone first
            capstone = self.capstones_data.create_capstone(capstone_data)

            if not capstone:
                return {
                    "success": False,
                    "message": "Failed to create capstone project.",
                    "data": None
                }

            # Call the teams business logic
            team_result = self.teams_business.create_team(
                leader_id=user_id,
                capstone_id=capstone["capstone_id"],
                course_id=course_id
            )

            if not team_result.get("success"):
                return {
                    "success": False,
                    "message": f"Capstone created but team creation failed: {team_result.get('message', 'Unknown error')}",
                    "data": {
                        "capstone": capstone,
                        "team": None
                    }
                }

            # Update the capstone with the team_fk
            team_data = team_result["data"]
            team_id = team_data.get("team_id")

            if team_id:
                updated_capstone = self.capstones_data.update_capstone(
                    capstone["capstone_id"],
                    {"team_fk": team_id}
                )
                if updated_capstone:
                    capstone = updated_capstone

            # Process and return successful result
            result_data = {
                "capstone": self._process_capstone_data(capstone),
                "team": team_result["data"]
            }

            return {
                "success": True,
                "message": "Capstone project and team created successfully",
                "data": result_data
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def _process_capstone_data(self, capstone_data: Dict[Any, Any]) -> Dict[Any, Any]:
        """Process capstone data with metadata"""
        processed = dict(capstone_data)
        processed['source'] = 'watmatch-server'
        return processed

    def _get_course_id_by_code(self, course_code: str) -> Optional[int]:
        """Get course_id by course_code"""
        try:
            return self.capstones_data.get_course_id_by_code(course_code)
        except Exception:
            return None

    def get_all_capstones(self, page: Optional[int] = None, page_size: Optional[int] = None) -> Dict[str, Any]:
        """Get all current capstone projects with optional pagination"""
        try:
            result = self.capstones_data.get_all_capstones(page, page_size)
            capstones = result["data"]

            # Process each capstone with metadata
            processed_capstones = [self._process_capstone_data(
                capstone) for capstone in capstones]

            response = {
                "success": True,
                "message": f"Retrieved {len(processed_capstones)} capstone(s)",
                "data": processed_capstones
            }

            # Add pagination metadata if applicable
            if page is not None and page_size is not None:
                total = result.get("total")
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size

                response.update({
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages
                })

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_approved_capstones(self, page: Optional[int] = None, page_size: Optional[int] = None) -> Dict[str, Any]:
        """Get approved capstone projects with optional pagination"""
        try:
            result = self.capstones_data.get_approved_capstones(
                page, page_size)
            capstones = result["data"]

            processed_capstones = [
                self._process_capstone_data(capstone) for capstone in capstones
            ]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed_capstones)} approved capstone(s)",
                "data": processed_capstones
            }

            if page is not None and page_size is not None:
                total = result.get("total")
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size

                response.update({
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages
                })

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_capstones_pending_review(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get unapproved capstones with no feedback entries."""
        try:
            capstones = self.capstones_data.get_unapproved_without_feedback()

            total = len(capstones)

            if page is not None and page_size is not None and page_size > 0:
                start = (page - 1) * page_size
                end = start + page_size
                paginated_capstones = capstones[start:end] if start < total else [
                ]
            else:
                paginated_capstones = capstones

            processed_capstones = [
                self._process_capstone_data(capstone)
                for capstone in paginated_capstones
            ]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed_capstones)} capstone(s) requiring review",
                "data": processed_capstones
            }

            if page is not None and page_size is not None and page_size > 0:
                total_pages = (total + page_size - 1) // page_size
                response.update({
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages
                })

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def approve_capstone(self, capstone_id: int) -> Dict[str, Any]:
        """Mark a capstone as approved."""
        try:
            capstone = self.capstones_data.get_capstone_by_id(capstone_id)

            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} not found",
                    "data": None
                }

            update_data = {
                "approval": True,
                "status": "approved"
            }

            updated_capstone = self.capstones_data.update_capstone(
                capstone_id,
                update_data
            )

            if not updated_capstone:
                return {
                    "success": False,
                    "message": "Failed to update capstone approval state",
                    "data": None
                }

            # Send approval email
            user_email = self._get_user_email(capstone.get("user_fk"))
            if user_email:
                try:
                    send_capstone_approval_email(
                        to_email=user_email,
                        project_title=capstone.get("title", "Your project")
                    )
                except Exception as e:
                    print(f"Failed to send approval email: {e}")

            return {
                "success": True,
                "message": "Capstone approved successfully",
                "data": self._process_capstone_data(updated_capstone)
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_capstone_by_id(self, capstone_id: int) -> Dict[str, Any]:
        """Retrieve a single capstone by its identifier."""
        try:
            if not isinstance(capstone_id, int) or capstone_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid capstone ID. Must be a positive integer.",
                    "data": None
                }

            capstone = self.capstones_data.get_capstone_by_id(capstone_id)

            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} not found",
                    "data": None
                }

            return {
                "success": True,
                "message": "Capstone retrieved successfully",
                "data": self._process_capstone_data(capstone)
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def reject_capstone(self, capstone_id: int) -> Dict[str, Any]:
        """Mark a capstone as rejected."""
        try:
            capstone = self.capstones_data.get_capstone_by_id(capstone_id)

            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} not found",
                    "data": None
                }

            update_data = {
                "approval": False,
                "status": "rejected"
            }

            updated_capstone = self.capstones_data.update_capstone(
                capstone_id,
                update_data
            )

            if not updated_capstone:
                return {
                    "success": False,
                    "message": "Failed to update capstone approval state",
                    "data": None
                }

            # Send rejection email
            user_email = self._get_user_email(capstone.get("user_fk"))
            if user_email:
                try:
                    send_capstone_rejection_email(
                        to_email=user_email,
                        project_title=capstone.get("title", "Your project")
                    )
                except Exception as e:
                    print(f"Failed to send rejection email: {e}")

            return {
                "success": True,
                "message": "Capstone rejected successfully",
                "data": self._process_capstone_data(updated_capstone)
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def request_changes(self, capstone_id: int, comments: str) -> Dict[str, Any]:
        """Request changes for a capstone project."""
        try:
            capstone = self.capstones_data.get_capstone_by_id(capstone_id)

            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} not found",
                    "data": None
                }

            update_data = {
                "status": "changes_requested"
            }

            updated_capstone = self.capstones_data.update_capstone(
                capstone_id,
                update_data
            )

            if not updated_capstone:
                return {
                    "success": False,
                    "message": "Failed to update capstone status",
                    "data": None
                }

            # Send changes request email
            user_email = self._get_user_email(capstone.get("user_fk"))
            if user_email:
                try:
                    send_capstone_changes_email(
                        to_email=user_email,
                        project_title=capstone.get("title", "Your project"),
                        comments=comments or "Please review and update your proposal."
                    )
                except Exception as e:
                    print(f"Failed to send changes request email: {e}")

            return {
                "success": True,
                "message": "Changes requested successfully",
                "data": self._process_capstone_data(updated_capstone)
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def _get_user_email(self, user_id: int) -> Optional[str]:
        """Fetch a user's email from the users table."""
        try:
            response = supabase.table("users").select(
                "email").eq("user_id", user_id).execute()
            if not response.data:
                return None
            return response.data[0].get("email")
        except Exception as e:
            print(f"Failed to fetch user email: {e}")
            return None
