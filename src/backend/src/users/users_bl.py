from typing import Dict, Any, Optional

from .users_dl import UsersDataLogic


class UsersBusinessLogic:
    """Business layer for users operations."""

    def __init__(self) -> None:
        self.users_data = UsersDataLogic()

    def get_user_by_id(self, user_id: int) -> Dict[str, Any]:
        """Return user by identifier with validation."""
        try:
            if not isinstance(user_id, int) or user_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid user ID. Must be a positive integer.",
                    "data": None,
                }

            user = self.users_data.get_user_by_id(user_id)
            if not user:
                return {
                    "success": False,
                    "message": f"User with ID {user_id} not found.",
                    "data": None,
                }

            return {
                "success": True,
                "message": "User retrieved successfully.",
                "data": self._process_user(user),
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def get_users(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Return list of users with optional pagination."""
        try:
            result = self.users_data.get_users(page, page_size)
            users = result["data"]

            processed_users = [self._process_user(user) for user in users]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed_users)} user(s).",
                "data": processed_users,
            }

            if page is not None and page_size is not None:
                total = result.get("total")
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size

                response.update(
                    {
                        "page": page,
                        "page_size": page_size,
                        "total": total,
                        "total_pages": total_pages,
                    }
                )

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def _process_user(self, user: Dict[Any, Any]) -> Dict[Any, Any]:
        enriched = dict(user)
        enriched["source"] = "watmatch-server"
        return enriched
