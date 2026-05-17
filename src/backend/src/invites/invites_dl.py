from src.config.database import supabase
from typing import Optional, Dict, Any
import secrets
import string


class InvitesDataLogic:
    """Data layer for invite operations"""

    def __init__(self):
        self.table_name = "invites"

    def _generate_invite_id(self, length: int = 16) -> str:
        """
        Generate a random URL-safe invite ID.
        Uses alphanumeric characters (no special chars like %5 needed).
        """
        # Use URL-safe characters: letters (upper/lower) and digits
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def create_invite(self, team_id: int, user_id: int) -> Optional[Dict[Any, Any]]:
        """Create a new invite for a team and user"""
        try:
            # Generate unique invite ID
            invite_id = self._generate_invite_id()

            # Check if invite already exists for this team-user pair
            existing = (
                supabase.table(self.table_name)
                .select("*")
                .eq("team_fk", team_id)
                .eq("user_fk", user_id)
                .execute()
            )

            if existing.data and len(existing.data) > 0:
                # Return existing invite instead of creating duplicate
                return existing.data[0]

            invite_data = {
                "invite_id": invite_id,
                "team_fk": team_id,
                "user_fk": user_id
            }

            response = supabase.table(
                self.table_name).insert(invite_data).execute()

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in create_invite: {str(e)}")

    def get_invite_by_id(self, invite_id: str) -> Optional[Dict[Any, Any]]:
        """Get an invite by its ID"""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("invite_id", invite_id)
                .execute()
            )

            if not response.data or len(response.data) == 0:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(f"Database error in get_invite_by_id: {str(e)}")

    def get_invites_by_team(self, team_id: int) -> list[Dict[Any, Any]]:
        """Get all invites for a specific team"""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("team_fk", team_id)
                .execute()
            )

            return response.data if response.data else []

        except Exception as e:
            raise Exception(f"Database error in get_invites_by_team: {str(e)}")

    def get_invites_by_user(self, user_id: int) -> list[Dict[Any, Any]]:
        """Get all invites for a specific user"""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("user_fk", user_id)
                .execute()
            )

            return response.data if response.data else []

        except Exception as e:
            raise Exception(f"Database error in get_invites_by_user: {str(e)}")

    def delete_invite(self, invite_id: str) -> bool:
        """Delete an invite by its ID"""
        try:
            response = (
                supabase.table(self.table_name)
                .delete()
                .eq("invite_id", invite_id)
                .execute()
            )

            return True

        except Exception as e:
            raise Exception(f"Database error in delete_invite: {str(e)}")

    def delete_invites_by_team(self, team_id: int) -> bool:
        """Delete all invites for a specific team"""
        try:
            response = (
                supabase.table(self.table_name)
                .delete()
                .eq("team_fk", team_id)
                .execute()
            )

            return True

        except Exception as e:
            raise Exception(
                f"Database error in delete_invites_by_team: {str(e)}")

    def delete_invites_by_user(self, user_id: int) -> bool:
        """Delete all invites for a specific user"""
        try:
            response = (
                supabase.table(self.table_name)
                .delete()
                .eq("user_fk", user_id)
                .execute()
            )

            return True

        except Exception as e:
            raise Exception(
                f"Database error in delete_invites_by_user: {str(e)}")
