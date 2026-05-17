from src.config.database import supabase
from typing import Optional, Dict, Any


class StudentProfileDataLogic:
    """Data layer for student profile operations"""

    def __init__(self):
        self.table_name = "student_profile"

    def create_profile(self, student_id: int, profile_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Create a new student profile"""
        try:
            profile_data["student_fk"] = student_id
            response = supabase.table(self.table_name).insert(
                profile_data).execute()

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in create_profile: {str(e)}")

    def get_profile_by_student_id(self, student_id: int) -> Optional[Dict[Any, Any]]:
        """Get a student profile by student ID"""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("student_fk", student_id)
                .execute()
            )

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(
                f"Database error in get_profile_by_student_id: {str(e)}")

    def update_profile(self, student_id: int, update_data: Dict[str, Any]) -> Optional[Dict[Any, Any]]:
        """Update a student profile"""
        try:
            response = (
                supabase.table(self.table_name)
                .update(update_data)
                .eq("student_fk", student_id)
                .execute()
            )

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in update_profile: {str(e)}")

    def delete_profile(self, student_id: int) -> bool:
        """Delete a student profile"""
        try:
            response = (
                supabase.table(self.table_name)
                .delete()
                .eq("student_fk", student_id)
                .execute()
            )

            return True

        except Exception as e:
            raise Exception(f"Database error in delete_profile: {str(e)}")

    def get_all_profiles(self) -> list[Dict[Any, Any]]:
        """Get all student profiles"""
        try:
            response = supabase.table(self.table_name).select("*").execute()

            return response.data if response.data else []

        except Exception as e:
            raise Exception(f"Database error in get_all_profiles: {str(e)}")
