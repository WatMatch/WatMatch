from .invites_dl import InvitesDataLogic
from typing import Dict, Any, Optional
from ..config.database import supabase
from ..workflow.workflow_utils import get_team_member_ids, is_instructor_scoped_to_team


class InvitesBusinessLogic:
    """Business layer for invite operations"""

    def __init__(self):
        self.invites_data = InvitesDataLogic()

    def _current_marketplace_phase(self) -> str:
        try:
            settings = (
                supabase.table("marketplace_settings")
                .select("phase")
                .eq("setting_id", 1)
                .limit(1)
                .execute()
                .data
                or [None]
            )[0]
            phase = ((settings or {}).get("phase") or "exploration").lower()
            return phase
        except Exception:
            return "finalization"

    def _effective_marketplace_phase_for_capstone(self, capstone_id: Any) -> str:
        if capstone_id is None:
            return self._current_marketplace_phase()
        try:
            response = (
                supabase.rpc(
                    "watmatch_effective_marketplace_phase_for_capstone",
                    {"p_capstone_id": int(capstone_id)},
                )
                .execute()
            )
            phase = str(response.data or self._current_marketplace_phase()).lower()
            return "finalization" if phase == "locked" else phase
        except Exception:
            return self._current_marketplace_phase()

    def _team_accepts_members(
        self,
        team: Dict[str, Any],
        require_marketplace_open: bool = False,
    ) -> Dict[str, Any]:
        if (team.get("status") or "").lower() in {"archived", "finalized"}:
            return {"allowed": False, "message": "This team is no longer active."}
        capstone_id = team.get("capstone_fk")
        if capstone_id is None:
            return {"allowed": False, "message": "Teams can invite students only after an approved recruiting capstone is linked."}
        capstone = (
            supabase.table("capstones")
            .select("status,approval,archived")
            .eq("capstone_id", capstone_id)
            .limit(1)
            .execute()
            .data
            or [None]
        )[0]
        if not capstone:
            return {"allowed": False, "message": "Linked capstone not found."}
        if capstone.get("archived") is True:
            return {"allowed": False, "message": "This capstone is archived."}
        capstone_status = (capstone.get("status") or "").lower()
        if capstone_status != "approved_recruiting":
            return {"allowed": False, "message": "This capstone is not accepting team invites right now."}
        if require_marketplace_open:
            marketplace_phase = self._effective_marketplace_phase_for_capstone(capstone_id)
            if marketplace_phase != "exploration":
                return {
                    "allowed": False,
                    "message": (
                        "Team invites are paused because this project is outside its marketplace exploration phase."
                    ),
                }
        return {"allowed": True, "message": "ok"}

    def _team_invites_are_terminal(self, team: Dict[str, Any]) -> bool:
        if (team.get("status") or "").lower() in {"archived", "finalized"}:
            return True
        capstone_id = team.get("capstone_fk")
        if capstone_id is None:
            return True
        capstone = (
            supabase.table("capstones")
            .select("status,archived")
            .eq("capstone_id", capstone_id)
            .limit(1)
            .execute()
            .data
            or [None]
        )[0]
        if not capstone:
            return True
        capstone_status = (capstone.get("status") or "").lower()
        return capstone.get("archived") is True or capstone_status != "approved_recruiting"

    def _can_manage_team_invites(
        self,
        team: Dict[str, Any],
        requester_id: int,
        requester_role: str = "student",
    ) -> bool:
        role = (requester_role or "").lower()
        if team.get("leader_fk") == requester_id:
            return True
        if role == "admin":
            return True
        if role == "instructor":
            return is_instructor_scoped_to_team(requester_id, team)
        return False

    def _enrich_invites_with_invitees(self, invites: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        user_ids = sorted({
            int(invite["user_fk"])
            for invite in invites
            if invite.get("user_fk") is not None
        })
        if not user_ids:
            return invites

        users_res = (
            supabase.table("users")
            .select("user_id,email,role,course_fk")
            .in_("user_id", user_ids)
            .execute()
        )
        users_by_id = {
            int(user["user_id"]): user
            for user in (users_res.data or [])
            if user.get("user_id") is not None
        }

        enriched = []
        for invite in invites:
            row = dict(invite)
            invitee_id = row.get("user_fk")
            row["invitee"] = users_by_id.get(int(invitee_id)) if invitee_id is not None else None
            enriched.append(row)
        return enriched

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
            if user.get("active") is not True:
                return {
                    "success": False,
                    "message": "This student account is inactive.",
                    "data": None,
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

            requester = (
                supabase.table("users")
                .select("course_fk,active")
                .eq("user_id", requester_id)
                .limit(1)
                .execute()
                .data
                or [None]
            )[0]
            requester_course_fk = requester.get("course_fk") if requester else None
            if (
                not requester
                or requester.get("active") is not True
                or requester_course_fk is None
            ):
                return {
                    "success": False,
                    "message": "Your account must be active and assigned to a course before inviting students.",
                    "data": None,
                }

            availability = self._team_accepts_members(team, require_marketplace_open=True)
            if not availability["allowed"]:
                return {"success": False, "message": availability["message"], "data": None}

            existing_membership = (
                supabase.table("team_memberships")
                .select("team_fk")
                .eq("user_fk", user_id)
                .limit(1)
                .execute()
            )
            already_on_team = bool(existing_membership.data)

            if already_on_team:
                return {
                    "success": False,
                    "message": "This student is already enrolled in a capstone team and cannot be invited.",
                    "data": None
                }

            invite_result = self.invites_data.create_invite(
                team_id,
                user_id,
                requester_id,
            )

            if not invite_result.get("success"):
                return {
                    "success": False,
                    "message": invite_result.get("message", "Failed to create invite."),
                    "data": None
                }

            return {
                "success": True,
                "message": invite_result.get("message", "Invite created successfully"),
                "data": invite_result.get("data")
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_team_invites(self, team_id: int, requester_id: int, requester_role: str = "student") -> Dict[str, Any]:
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

            if not self._can_manage_team_invites(team, requester_id, requester_role):
                return {
                    "success": False,
                    "message": "Only the team leader or scoped instructors/admins can view team invites",
                    "data": None
                }

            self.invites_data.cleanup_unavailable_relationships_rpc(
                actor_id=requester_id,
                actor_role=requester_role,
                team_id=team_id,
            )
            if self._team_invites_are_terminal(team):
                return {
                    "success": True,
                    "message": "Team invites are no longer active; unavailable invite records were cleared.",
                    "data": []
                }

            invites = self._enrich_invites_with_invitees(
                self.invites_data.get_invites_by_team(team_id)
            )

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

            self.invites_data.cleanup_unavailable_relationships_rpc(
                actor_id=requester_id,
                actor_role=requester_role,
                user_id=user_id,
            )
            invites = self.invites_data.get_invites_by_user(user_id)
            invitee = (
                supabase.table("users")
                .select("user_id,role,active,course_fk")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
                .data
                or [None]
            )[0]
            invitee_course_fk = invitee.get("course_fk") if invitee else None
            # Enrich each invite with team and capstone information
            enriched_invites = []
            from ..teams.teams_dl import TeamsDataLogic
            from ..capstones.capstones_dl import CapstonesDataLogic
            teams_data = TeamsDataLogic()
            capstones_data = CapstonesDataLogic()

            for invite in invites:
                enriched_invite = dict(invite)
                team_id = invite.get("team_fk")
                enriched_invite["team"] = None
                enriched_invite["capstone"] = None

                if not team_id:
                    continue

                team = teams_data.get_team_by_id(team_id)
                if not team:
                    continue

                enriched_team = dict(team)
                enriched_team["members"] = get_team_member_ids(
                    int(team_id), fallback_team=team)
                enriched_invite["team"] = enriched_team
                capstone_id = team.get("capstone_fk")

                if capstone_id:
                    capstone = capstones_data.get_capstone_by_id(
                        capstone_id)
                    if not capstone:
                        continue
                    enriched_invite["capstone"] = capstone
                marketplace_phase = self._effective_marketplace_phase_for_capstone(capstone_id)
                enriched_invite["marketplace_phase"] = marketplace_phase

                availability = self._team_accepts_members(team)
                if not availability["allowed"]:
                    enriched_invite["acceptance_blocked_reason"] = availability["message"]
                elif marketplace_phase == "finalization":
                    enriched_invite["acceptance_blocked_reason"] = (
                        "The marketplace is in finalization. Staff can resolve official workflows, but new exploration is closed."
                    )
                elif marketplace_phase != "exploration":
                    enriched_invite["acceptance_blocked_reason"] = (
                        "The marketplace is in commitment. Existing explorations can commit, but new invite acceptance is closed."
                    )

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
            rpc_result = self.invites_data.accept_invite_rpc(invite_id=invite_id, user_id=user_id)
            if not rpc_result.get("success"):
                data = rpc_result.get("data") or {}
                message = (
                    "This invite is still pending, but the project is being reviewed. You can accept it later."
                    if data.get("invite_still_pending")
                    else rpc_result.get("message", "Invite acceptance failed.")
                )
                return {"success": False, "message": message, "data": None}

            return {
                "success": True,
                "message": rpc_result.get("message", "Invite accepted successfully"),
                "data": rpc_result.get("data"),
                "marketplace_exploration": rpc_result.get("marketplace_exploration") is True,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def decline_invite(self, invite_id: str, user_id: int) -> Dict[str, Any]:
        """Decline an invite through the transactional database workflow."""
        try:
            rpc_result = self.invites_data.decline_invite_rpc(invite_id=invite_id, user_id=user_id)
            if not rpc_result.get("success"):
                return {
                    "success": False,
                    "message": rpc_result.get("message", "Invite decline failed."),
                    "data": None
                }
            return {
                "success": True,
                "message": rpc_result.get("message", "Invite declined successfully"),
                "data": rpc_result.get("data")
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def revoke_invite(
        self,
        invite_id: str,
        actor_id: int,
        actor_role: str = "student",
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Revoke an invite through the transactional database workflow."""
        try:
            normalized_role = (actor_role or "student").strip().lower()
            normalized_reason = (reason or "").strip() or None
            if normalized_role in {"admin", "instructor"} and normalized_reason is None:
                return {
                    "success": False,
                    "message": "Staff invite revocation requires an audit reason.",
                    "data": None,
                }

            rpc_result = self.invites_data.revoke_invite_rpc(
                invite_id=invite_id,
                actor_id=actor_id,
                actor_role=normalized_role,
                reason=normalized_reason,
            )
            if not rpc_result.get("success"):
                return {
                    "success": False,
                    "message": rpc_result.get("message", "Invite revoke failed."),
                    "data": None
                }
            return {
                "success": True,
                "message": rpc_result.get("message", "Invite revoked successfully"),
                "data": rpc_result.get("data")
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }
