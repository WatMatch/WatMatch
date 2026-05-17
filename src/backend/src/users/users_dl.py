from typing import Optional, Dict, Any

from src.config.database import supabase


class UsersDataLogic:
    """Data layer for users operations."""

    def __init__(self) -> None:
        self.table_name = "users"

    def get_user_by_id(self, user_id: int) -> Optional[Dict[Any, Any]]:
        """Retrieve a single user by identifier."""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(
                f"Database error in get_user_by_id: {str(e)}") from e

    def get_users(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Retrieve users with optional pagination."""
        try:
            if page is not None and page_size is not None:
                start = (page - 1) * page_size
                end = start + page_size - 1

                try:
                    response = (
                        supabase.table(self.table_name)
                        .select("*", count="exact")
                        .range(start, end)
                        .execute()
                    )
                except TypeError:
                    response = (
                        supabase.table(self.table_name)
                        .select("*")
                        .range(start, end)
                        .execute()
                    )

                data = getattr(response, "data", []) or []
                total = getattr(response, "count", None)

                if total is None:
                    try:
                        count_response = (
                            supabase.table(self.table_name)
                            .select("user_id", count="exact")
                            .execute()
                        )
                        total = getattr(count_response, "count", None)
                    except Exception:
                        total = None

                return {
                    "data": data,
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                }

            response = supabase.table(self.table_name).select("*").execute()
            data = response.data if response.data else []

            return {
                "data": data,
                "total": len(data),
                "page": None,
                "page_size": None,
            }

        except Exception as e:
            raise Exception(f"Database error in get_users: {str(e)}") from e
