from .invites_dl import InvitesDataLogic
from typing import Dict, Any
from ..config.database import supabase


class InvitesBusinessLogic:
    """Business layer for invite operations"""

    def __init__(self):
        self.invites_data = InvitesDataLogic()

    def create_invite(self, team_id: int, email: str, requester_id: int) -> Dict[str, Any]:
        """Create a new team invite for a user by email (team leader only)"""
        try:
            # Validate inputs
            if not isinstance(team_id, int) or team_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid team ID. Must be a positive integer.",
                    "data": None
                }

            if not email or not isinstance(email, str):
                return {
                    "success": False,
                    "message": "Email is required and must be a string.",
                    "data": None
                }

            # Validate email format and domain
            email = email.strip().lower()
            if not email.endswith("@uwaterloo.ca"):
                return {
                    "success": False,
                    "message": "Email must be a valid @uwaterloo.ca email address.",
                    "data": None
                }

            # Find user by email
            user_response = supabase.table("users").select(
                "*").eq("email", email).execute()

            if not user_response.data or len(user_response.data) == 0:
                return {
                    "success": False,
                    "message": f"No user found with email '{email}'.",
                    "data": None
                }

            user = user_response.data[0]
            user_id = user.get("user_id")
            user_role = user.get("role")

            # Verify the user is a student
            if user_role != "student":
                return {
                    "success": False,
                    "message": "Only student users can be invited to teams.",
                    "data": None
                }

            # Verify the requester is the team leader
            from ..teams.teams_dl import TeamsDataLogic
            teams_data = TeamsDataLogic()
            team = teams_data.get_team_by_id(team_id)

            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found",
                    "data": None
                }

            if team.get("leader_fk") != requester_id:
                return {
                    "success": False,
                    "message": "Only the team leader can create invites",
                    "data": None
                }

            # Create the invite
            invite = self.invites_data.create_invite(team_id, user_id)

            if not invite:
                return {
                    "success": False,
                    "message": "Failed to create invite.",
                    "data": None
                }

            return {
                "success": True,
                "message": "Invite created successfully",
                "data": invite
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_invite(self, invite_id: str) -> Dict[str, Any]:
        """Get an invite by its ID"""
        try:
            if not invite_id or not isinstance(invite_id, str):
                return {
                    "success": False,
                    "message": "Invalid invite ID. Must be a non-empty string.",
                    "data": None
                }

            invite = self.invites_data.get_invite_by_id(invite_id)

            if not invite:
                return {
                    "success": False,
                    "message": f"Invite with ID '{invite_id}' not found",
                    "data": None
                }

            return {
                "success": True,
                "message": "Invite retrieved successfully",
                "data": invite
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_team_invites(self, team_id: int, requester_id: int) -> Dict[str, Any]:
        """Get all invites for a specific team (team leader only)"""
        try:
            if not isinstance(team_id, int) or team_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid team ID. Must be a positive integer.",
                    "data": None
                }

            # Verify the requester is the team leader
            from ..teams.teams_dl import TeamsDataLogic
            teams_data = TeamsDataLogic()
            team = teams_data.get_team_by_id(team_id)

            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found",
                    "data": None
                }

            if team.get("leader_fk") != requester_id:
                return {
                    "success": False,
                    "message": "Only the team leader can view team invites",
                    "data": None
                }

            invites = self.invites_data.get_invites_by_team(team_id)

            return {
                "success": True,
                "message": f"Retrieved {len(invites)} invite(s) for team {team_id}",
                "data": invites
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_user_invites(self, user_id: int, requester_id: int, requester_role: str = None) -> Dict[str, Any]:
        """Get all invites for a specific user (user themselves or admin only)"""
        try:
            if not isinstance(user_id, int) or user_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid user ID. Must be a positive integer.",
                    "data": None
                }

            # Users can only view their own invites unless they're admin
            if requester_id != user_id and requester_role != "admin":
                return {
                    "success": False,
                    "message": "You can only view your own invites",
                    "data": None
                }

            invites = self.invites_data.get_invites_by_user(user_id)

            # Enrich each invite with team and capstone information
            enriched_invites = []
            from ..teams.teams_dl import TeamsDataLogic
            from ..capstones.capstones_dl import CapstonesDataLogic
            teams_data = TeamsDataLogic()
            capstones_data = CapstonesDataLogic()

            for invite in invites:
                enriched_invite = dict(invite)
                team_id = invite.get("team_fk")

                if team_id:
                    team = teams_data.get_team_by_id(team_id)
                    if team:
                        enriched_invite["team"] = team
                        capstone_id = team.get("capstone_fk")

                        if capstone_id:
                            capstone = capstones_data.get_capstone_by_id(
                                capstone_id)
                            if capstone:
                                enriched_invite["capstone"] = capstone

                enriched_invites.append(enriched_invite)

            return {
                "success": True,
                "message": f"Retrieved {len(enriched_invites)} invite(s) for user {user_id}",
                "data": enriched_invites
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def accept_invite(self, invite_id: str, user_id: int) -> Dict[str, Any]:
        """Accept an invite and add user to team"""
        try:
            # Get the invite
            invite = self.invites_data.get_invite_by_id(invite_id)

            if not invite:
                return {
                    "success": False,
                    "message": f"Invite with ID '{invite_id}' not found",
                    "data": None
                }

            # Verify the invite is for this user
            if invite.get("user_fk") != user_id:
                return {
                    "success": False,
                    "message": "This invite is not for the specified user",
                    "data": None
                }

            team_id = invite.get("team_fk")

            # Get the team and add user to members
            from ..teams.teams_dl import TeamsDataLogic
            teams_data = TeamsDataLogic()
            team = teams_data.get_team_by_id(team_id)

            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found",
                    "data": None
                }

            # Add user to team members if not already a member
            current_members = team.get("members", [])
            if user_id not in current_members:
                current_members.append(user_id)
                updated_team = teams_data.update_team(
                    team_id, {"members": current_members})

                if not updated_team:
                    return {
                        "success": False,
                        "message": "Failed to add user to team",
                        "data": None
                    }
                team = updated_team

            # Delete the invite after successful acceptance
            self.invites_data.delete_invite(invite_id)

            return {
                "success": True,
                "message": "Invite accepted successfully",
                "data": {
                    "team": team,
                    "invite_id": invite_id
                }
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def decline_invite(self, invite_id: str, user_id: int) -> Dict[str, Any]:
        """Decline an invite"""
        try:
            # Get the invite
            invite = self.invites_data.get_invite_by_id(invite_id)

            if not invite:
                return {
                    "success": False,
                    "message": f"Invite with ID '{invite_id}' not found",
                    "data": None
                }

            # Verify the invite is for this user
            if invite.get("user_fk") != user_id:
                return {
                    "success": False,
                    "message": "This invite is not for the specified user",
                    "data": None
                }

            # Delete the invite
            self.invites_data.delete_invite(invite_id)

            return {
                "success": True,
                "message": "Invite declined successfully",
                "data": {"invite_id": invite_id}
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def revoke_invite(self, invite_id: str, team_leader_id: int) -> Dict[str, Any]:
        """Revoke an invite (only by team leader)"""
        try:
            # Get the invite
            invite = self.invites_data.get_invite_by_id(invite_id)

            if not invite:
                return {
                    "success": False,
                    "message": f"Invite with ID '{invite_id}' not found",
                    "data": None
                }

            team_id = invite.get("team_fk")

            # Verify the user is the team leader
            from ..teams.teams_dl import TeamsDataLogic
            teams_data = TeamsDataLogic()
            team = teams_data.get_team_by_id(team_id)

            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found",
                    "data": None
                }

            if team.get("leader_fk") != team_leader_id:
                return {
                    "success": False,
                    "message": "Only the team leader can revoke invites",
                    "data": None
                }

            # Delete the invite
            self.invites_data.delete_invite(invite_id)

            return {
                "success": True,
                "message": "Invite revoked successfully",
                "data": {"invite_id": invite_id}
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }
