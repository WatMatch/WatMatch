from src.config.database import supabase
from typing import Optional, Dict, Any


class CapstonesDataLogic:
    """Data layer for capstone operations"""

    def __init__(self):
        self.table_name = "capstones"

    def create_capstone(self, capstone_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Create a new capstone project"""
        try:
            response = supabase.table(self.table_name).insert(
                capstone_data).execute()

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in create_capstone: {str(e)}")

    def update_capstone(self, capstone_id: int, update_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Update a capstone project with new data"""
        try:
            response = supabase.table(self.table_name).update(
                update_data).eq("capstone_id", capstone_id).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in update_capstone: {str(e)}")

    def get_course_id_by_code(self, course_code: str) -> Optional[int]:
        """Get course_id by course_code"""
        try:
            response = supabase.table("courses").select(
                "course_id").eq("code", course_code).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]["course_id"]

        except Exception as e:
            raise Exception(
                f"Database error in get_course_id_by_code: {str(e)}")

    def delete_capstone(self, capstone_id: int) -> bool:
        """Delete a capstone project by its ID"""
        try:
            response = supabase.table(self.table_name).delete().eq(
                "capstone_id", capstone_id).execute()

            # Return True if deletion was successful
            return True

        except Exception as e:
            raise Exception(f"Database error in delete_capstone: {str(e)}")

    def get_capstone_by_id(self, capstone_id: int) -> Optional[Dict[Any, Any]]:
        """Get a capstone by its ID"""
        try:
            response = supabase.table(self.table_name).select(
                "*").eq("capstone_id", capstone_id).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in get_capstone_by_id: {str(e)}")

    def get_unapproved_without_feedback(self) -> list[Dict[Any, Any]]:
        """Get unapproved capstones that do not have feedback entries."""
        try:
            capstone_response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("approval", False)
                .execute()
            )

            capstones = capstone_response.data or []
            if not capstones:
                return []

            capstone_ids = [
                capstone.get("capstone_id")
                for capstone in capstones
                if capstone.get("capstone_id") is not None
            ]

            if not capstone_ids:
                return []

            feedback_response = (
                supabase.table("feedback")
                .select("capstone_fk")
                .in_("capstone_fk", capstone_ids)
                .execute()
            )

            feedback_capstone_ids = {
                row.get("capstone_fk")
                for row in (feedback_response.data or [])
                if row.get("capstone_fk") is not None
            }

            return [
                capstone
                for capstone in capstones
                if capstone.get("capstone_id") not in feedback_capstone_ids
            ]

        except Exception as e:
            raise Exception(
                f"Database error in get_unapproved_without_feedback: {str(e)}"
            )

    def get_all_capstones(self, page: Optional[int] = None, page_size: Optional[int] = None) -> Dict[str, Any]:
        """Get all current capstone projects with optional pagination"""
        try:
            # If pagination params provided, use range
            if page is not None and page_size is not None:
                start = (page - 1) * page_size
                end = start + page_size - 1

                # Try to get count
                try:
                    response = supabase.table(self.table_name).select(
                        "*", count="exact").range(start, end).execute()
                except TypeError:
                    response = supabase.table(self.table_name).select(
                        "*").range(start, end).execute()

                data = getattr(response, "data", [])
                total = getattr(response, "count", None)

                # Fallback count query if needed
                if total is None:
                    try:
                        count_res = supabase.table(self.table_name).select(
                            "capstone_id", count="exact").execute()
                        total = getattr(count_res, "count", None)
                    except Exception:
                        total = None

                return {
                    "data": data if data else [],
                    "total": total,
                    "page": page,
                    "page_size": page_size
                }
            else:
                # No pagination - return all
                response = supabase.table(
                    self.table_name).select("*").execute()
                data = response.data if response.data else []
                return {
                    "data": data,
                    "total": len(data),
                    "page": None,
                    "page_size": None
                }

        except Exception as e:
            raise Exception(f"Database error in get_all_capstones: {str(e)}")

    def get_approved_capstones(self, page: Optional[int] = None, page_size: Optional[int] = None) -> Dict[str, Any]:
        """Get approved capstone projects with optional pagination"""
        try:
            if page is not None and page_size is not None:
                start = (page - 1) * page_size
                end = start + page_size - 1

                try:
                    response = (
                        supabase
                        .table(self.table_name)
                        .select("*", count="exact")
                        .eq("approval", True)
                        .range(start, end)
                        .execute()
                    )
                except TypeError:
                    response = (
                        supabase
                        .table(self.table_name)
                        .select("*")
                        .eq("approval", True)
                        .range(start, end)
                        .execute()
                    )

                data = getattr(response, "data", [])
                total = getattr(response, "count", None)

                if total is None:
                    try:
                        count_res = (
                            supabase
                            .table(self.table_name)
                            .select("capstone_id", count="exact")
                            .eq("approval", True)
                            .execute()
                        )
                        total = getattr(count_res, "count", None)
                    except Exception:
                        total = None

                return {
                    "data": data if data else [],
                    "total": total,
                    "page": page,
                    "page_size": page_size
                }

            response = (
                supabase
                .table(self.table_name)
                .select("*")
                .eq("approval", True)
                .execute()
            )
            data = response.data if response.data else []
            return {
                "data": data,
                "total": len(data),
                "page": None,
                "page_size": None
            }

        except Exception as e:
            raise Exception(
                f"Database error in get_approved_capstones: {str(e)}")
