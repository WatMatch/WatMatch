from src.config.database import supabase
from typing import Optional, Dict, Any


class AuthDataLogic:
    """Data layer for authentication operations"""

    def __init__(self):
        self.users_table = "users"

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email address"""
        try:
            response = supabase.table(self.users_table).select(
                "*").eq("email", email).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in get_user_by_email: {str(e)}")

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by user ID"""
        try:
            response = supabase.table(self.users_table).select(
                "*").eq("user_id", user_id).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in get_user_by_id: {str(e)}")

    def create_user(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new user"""
        try:
            response = supabase.table(
                self.users_table).insert(user_data).execute()

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in create_user: {str(e)}")

    def update_refresh_token(self, user_id: int, token_hash: Optional[str]) -> bool:
        """Update user's refresh token"""
        try:
            response = supabase.table(self.users_table).update(
                {"refresh_token": token_hash}
            ).eq("user_id", user_id).execute()

            return response.data is not None

        except Exception as e:
            raise Exception(
                f"Database error in update_refresh_token: {str(e)}")

    def get_user_by_refresh_token(self, token_hash: str) -> Optional[Dict[str, Any]]:
        """Get user by refresh token hash"""
        try:
            response = supabase.table(self.users_table).select(
                "*").eq("refresh_token", token_hash).execute()

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(
                f"Database error in get_user_by_refresh_token: {str(e)}")
