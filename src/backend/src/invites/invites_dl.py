from src.config.database import supabase
from typing import Optional, Dict, Any
import secrets
import string
from src.workflow.rpc_utils import call_json_rpc


class InvitesDataLogic:
    """Data layer for invite operations"""

    def __init__(self):
        self.table_name = "project_explorations"

    def _generate_invite_id(self, length: int = 16) -> str:
        """
        Generate a random URL-safe invite ID.
        Uses alphanumeric characters (no special chars like %5 needed).
        """
        # Use URL-safe characters: letters (upper/lower) and digits
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def create_invite(self, team_id: int, user_id: int, requester_id: int) -> Dict[str, Any]:
        """Create a new invite through the transactional database workflow."""
        try:
            return call_json_rpc(
                "watmatch_create_invite",
                {
                    "p_team_id": team_id,
                    "p_user_id": user_id,
                    "p_actor_id": requester_id,
                    "p_invite_id": self._generate_invite_id(),
                },
            ) or {"success": False, "message": "Invite could not be created.", "data": None}

        except Exception as e:
            raise Exception(f"Database error in create_invite: {str(e)}")

    def get_invites_by_team(self, team_id: int) -> list[Dict[Any, Any]]:
        """Get all invites for a specific team"""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("team_fk", team_id)
                .eq("status", "invited")
                .order("created_at", desc=True)
                .execute()
            )

            return [self._invite_shape(row) for row in (response.data or [])]

        except Exception as e:
            raise Exception(f"Database error in get_invites_by_team: {str(e)}")

    def get_invites_by_user(self, user_id: int) -> list[Dict[Any, Any]]:
        """Get all invites for a specific user"""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("student_fk", user_id)
                .eq("status", "invited")
                .order("created_at", desc=True)
                .execute()
            )

            return [self._invite_shape(row) for row in (response.data or [])]

        except Exception as e:
            raise Exception(f"Database error in get_invites_by_user: {str(e)}")

    def cleanup_unavailable_relationships_rpc(
        self,
        actor_id: int,
        actor_role: str,
        user_id: Optional[int] = None,
        team_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Clean up unavailable invite/exploration records through the transactional database workflow."""
        try:
            return call_json_rpc(
                "watmatch_cleanup_unavailable_marketplace_relationships",
                {
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_user_id": user_id,
                    "p_team_id": team_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in cleanup_unavailable_relationships_rpc: {str(e)}")

    def accept_invite_rpc(self, invite_id: str, user_id: int) -> Dict[str, Any]:
        """Run the transactional Supabase invite acceptance workflow."""
        try:
            return call_json_rpc(
                "watmatch_accept_invite",
                {
                    "p_invite_id": invite_id,
                    "p_user_id": user_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in accept_invite_rpc: {str(e)}")

    def decline_invite_rpc(self, invite_id: str, user_id: int) -> Dict[str, Any]:
        """Run the transactional Supabase invite decline workflow."""
        try:
            return call_json_rpc(
                "watmatch_decline_invite",
                {
                    "p_invite_id": invite_id,
                    "p_user_id": user_id,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in decline_invite_rpc: {str(e)}")

    def revoke_invite_rpc(
        self,
        invite_id: str,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the transactional Supabase invite revoke workflow."""
        try:
            return call_json_rpc(
                "watmatch_revoke_invite",
                {
                    "p_invite_id": invite_id,
                    "p_actor_id": actor_id,
                    "p_actor_role": actor_role,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in revoke_invite_rpc: {str(e)}")

    def _invite_shape(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            **row,
            "invite_id": str(row.get("exploration_id")),
            "team_fk": row.get("team_fk"),
            "user_fk": row.get("student_fk"),
        }
