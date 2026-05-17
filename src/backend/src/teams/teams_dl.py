from src.config.database import supabase
from typing import Optional, Dict, Any


class TeamsDataLogic:
    """Data layer for teams operations"""

    def __init__(self):
        self.table_name = "teams"

    def create_team(self, team_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Create a new team"""
        try:
            response = supabase.table(
                self.table_name).insert(team_data).execute()

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in create_team: {str(e)}")

    def get_team_by_id(self, team_id: int) -> Optional[Dict[Any, Any]]:
        """Get a team by its ID"""
        try:
            response = supabase.table(self.table_name).select(
                "*").eq("team_id", team_id).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in get_team_by_id: {str(e)}")

    def update_team(self, team_id: int, update_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Update a team with new data"""
        try:
            response = supabase.table(self.table_name).update(
                update_data).eq("team_id", team_id).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in update_team: {str(e)}")

    def delete_team(self, team_id: int) -> bool:
        """Delete a team by its ID"""
        try:
            response = supabase.table(self.table_name).delete().eq(
                "team_id", team_id).execute()

            # Return True if deletion was successful (data will be empty but no error)
            return True

        except Exception as e:
            raise Exception(f"Database error in delete_team: {str(e)}")

    def get_all_teams(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get teams with optional pagination."""
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
                            .select("team_id", count="exact")
                            .execute()
                        )
                        total = getattr(count_response, "count", None)
                    except Exception:
                        total = None

                return {
                    "data": data,
                    "total": total,
                    "page": page,
                    "page_size": page_size
                }

            response = supabase.table(self.table_name).select("*").execute()
            data = response.data if response.data else []

            return {
                "data": data,
                "total": len(data),
                "page": None,
                "page_size": None
            }

        except Exception as e:
            raise Exception(f"Database error in get_all_teams: {str(e)}")
