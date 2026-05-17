from .teams_dl import TeamsDataLogic
from src.capstones.capstones_dl import CapstonesDataLogic
from src.interests.interests_dl import InterestsDL
from typing import Dict, Any, Optional
from src.config.database import supabase
from src.mailer.mailer import send_match_email, send_interest_rejected_email


class TeamsBusinessLogic:
    """Business layer for teams operations"""

    def __init__(self):
        self.teams_data = TeamsDataLogic()
        self.capstones_data = CapstonesDataLogic()
        self.interests_data = InterestsDL()

    def create_team(self, leader_id: int, capstone_id: int = None, course_id: int = None) -> Dict[str, Any]:
        """Create a new team with the specified leader"""
        try:
            if not isinstance(leader_id, int) or leader_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid leader ID. Must be a positive integer.",
                    "data": None
                }

            # Prepare team data (removed interested array)
            team_data = {
                "leader_fk": leader_id,
                "capstone_fk": capstone_id,
                "course_fk": course_id,
                "members": [leader_id],
                "status": "forming"
            }

            team = self.teams_data.create_team(team_data)

            if not team:
                return {
                    "success": False,
                    "message": "Failed to create team.",
                    "data": None
                }

            processed_data = self._process_team_data(team)

            return {
                "success": True,
                "message": "Team created successfully",
                "data": processed_data
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_all_teams(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """Return all teams with optional pagination."""
        try:
            result = self.teams_data.get_all_teams(page, page_size)
            teams = result["data"]

            processed = [self._process_team_data(team) for team in teams]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed)} team(s)",
                "data": processed
            }

            if page is not None and page_size is not None:
                total = result.get("total")
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size

                response.update({
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages
                })

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def leave_team(self, user_id: int, team_id: int) -> Dict[str, Any]:
        """Allow a user to leave a team (leaders leaving will delete the team and capstone)"""
        try:
            if not isinstance(user_id, int) or user_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid user ID. Must be a positive integer.",
                    "data": None
                }

            if not isinstance(team_id, int) or team_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid team ID. Must be a positive integer.",
                    "data": None
                }

            team = self.teams_data.get_team_by_id(team_id)

            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found.",
                    "data": None
                }

            # Check if user is the leader
            if team.get("leader_fk") == user_id:
                capstone_id = team.get("capstone_fk")

                # Delete the team first
                team_deleted = self.teams_data.delete_team(team_id)

                if not team_deleted:
                    return {
                        "success": False,
                        "message": "Failed to delete team.",
                        "data": None
                    }

                # If team was associated with a capstone, delete the capstone as well
                if capstone_id:
                    try:
                        capstone_deleted = self.capstones_data.delete_capstone(capstone_id)
                        if not capstone_deleted:
                            return {
                                "success": True,
                                "message": "Team deleted successfully, but failed to delete associated capstone.",
                                "data": {"team_deleted": True, "capstone_deleted": False}
                            }
                    except Exception as e:
                        return {
                            "success": True,
                            "message": f"Team deleted successfully, but failed to delete associated capstone: {str(e)}",
                            "data": {"team_deleted": True, "capstone_deleted": False}
                        }

                return {
                    "success": True,
                    "message": "Team leader left and team was deleted successfully." + (" Associated capstone was also deleted." if capstone_id else ""),
                    "data": {"team_deleted": True, "capstone_deleted": bool(capstone_id)}
                }

            # Get current members
            current_members = team.get("members", [])
            current_members_int = [int(uid) if isinstance(uid, str) else uid for uid in current_members]

            # Check if user is in the team
            if user_id not in current_members_int:
                return {
                    "success": False,
                    "message": "User is not a member of this team.",
                    "data": None
                }

            # Remove user from members array
            new_members = [uid for uid in current_members_int if uid != user_id]

            update_data = {"members": new_members}

            # Update the team in the database
            updated_team = self.teams_data.update_team(team_id, update_data)

            if not updated_team:
                return {
                    "success": False,
                    "message": "Failed to update team membership.",
                    "data": None
                }

            processed_data = self._process_team_data(updated_team)

            return {
                "success": True,
                "message": "User successfully left the team.",
                "data": processed_data
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def accept_member(self, leader_id: int, student_id: int, team_id: int) -> Dict[str, Any]:
        """Allow a team leader to accept an interested student as a member."""
        try:
            if leader_id <= 0 or student_id <= 0 or team_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid IDs. All IDs must be positive integers.",
                    "data": None,
                }

            team = self.teams_data.get_team_by_id(team_id)
            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found.",
                    "data": None,
                }

            # Ensure the caller is the leader
            if team.get("leader_fk") != leader_id:
                return {
                    "success": False,
                    "message": "Forbidden. Only the team leader can accept members.",
                    "data": None,
                }

            # Check if student is already in ANY team
            student_team = self.interests_data._get_student_team(student_id)
            if student_team:
                return {
                    "success": False,
                    "message": "Student is already part of another team.",
                    "data": None,
                }

            # Check if student has expressed interest in THIS team
            capstone_id = team.get("capstone_fk")
            if not capstone_id:
                return {
                    "success": False,
                    "message": "Team has no associated capstone project.",
                    "data": None,
                }

            # Verify student has interest record for this team
            interest_check = supabase.table("team_interest").select("*").eq("team_id", team_id).eq("student_id", student_id).execute()
            if not interest_check.data:
                return {
                    "success": False,
                    "message": "Student has not expressed interest in this team.",
                    "data": None,
                }

            # Add student to members
            current_members = team.get("members", []) or []
            current_members_int = [int(uid) if isinstance(uid, str) else uid for uid in current_members]

            if student_id not in current_members_int:
                new_members = current_members_int + [student_id]
            else:
                new_members = current_members_int

            update_data = {"members": new_members}

            updated_team = self.teams_data.update_team(team_id, update_data)
            if not updated_team:
                return {
                    "success": False,
                    "message": "Failed to update team membership.",
                    "data": None,
                }

            # Remove ALL interest records for this student (from all teams)
            self.interests_data.remove_all_interests_for_student(student_id)

            processed_data = self._process_team_data(updated_team)

            # Best effort email sending
            student_email = self._get_user_email(student_id)
            if student_email:
                try:
                    # Get project title
                    project_title = "a WatMatch capstone project"
                    if capstone_id:
                        capstone_res = supabase.table("capstones").select("title").eq("capstone_id", capstone_id).execute()
                        if capstone_res.data:
                            project_title = capstone_res.data[0].get("title", project_title)
                    
                    send_match_email(
                        to_email=student_email,
                        student_name="there",
                        project_title=project_title,
                    )
                except Exception as e:
                    print(f"Failed to send match email: {e}")
            else:
                pass # No email found for student, skipping email

            return {
                "success": True,
                "message": "Student accepted into the team.",
                "data": processed_data,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def reject_member(self, leader_id: int, student_id: int, team_id: int) -> Dict[str, Any]:
        """Allow a team leader to reject an interested student."""
        try:
            if leader_id <= 0 or student_id <= 0 or team_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid IDs. All IDs must be positive integers.",
                    "data": None,
                }

            team = self.teams_data.get_team_by_id(team_id)
            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found.",
                    "data": None,
                }

            # Ensure the caller is the leader
            if team.get("leader_fk") != leader_id:
                return {
                    "success": False,
                    "message": "Forbidden. Only the team leader can reject students.",
                    "data": None,
                }

            # Remove interest record from team_interest table
            try:
                supabase.table("team_interest").delete().eq("team_id", team_id).eq("student_id", student_id).execute()
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Failed to remove interest record: {str(e)}",
                    "data": None,
                }

            # Send rejection email
            student_email = self._get_user_email(student_id)
            if student_email:
                try:
                    # Get project title
                    project_title = "a WatMatch capstone project"
                    capstone_id = team.get("capstone_fk")
                    if capstone_id:
                        capstone_res = supabase.table("capstones").select("title").eq("capstone_id", capstone_id).execute()
                        if capstone_res.data:
                            project_title = capstone_res.data[0].get("title", project_title)
                    
                    send_interest_rejected_email(
                        to_email=student_email,
                        project_title=project_title
                    )
                except Exception as e:
                    print(f"Failed to send rejection email: {e}")

            return {
                "success": True,
                "message": "Student interest rejected.",
                "data": None,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def remove_member(self, leader_id: int, student_id: int, team_id: int) -> Dict[str, Any]:
        """Allow a team leader to remove an existing team member."""
        try:
            if leader_id <= 0 or student_id <= 0 or team_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid IDs. All IDs must be positive integers.",
                    "data": None,
                }

            team = self.teams_data.get_team_by_id(team_id)
            if not team:
                return {
                    "success": False,
                    "message": f"Team with ID {team_id} not found.",
                    "data": None,
                }

            # Ensure the caller is the leader
            if team.get("leader_fk") != leader_id:
                return {
                    "success": False,
                    "message": "Forbidden. Only the team leader can remove members.",
                    "data": None,
                }

            # Can't remove the leader
            if student_id == leader_id:
                return {
                    "success": False,
                    "message": "Cannot remove the team leader. Leader must leave the team instead.",
                    "data": None,
                }

            # Get current members
            current_members = team.get("members", []) or []
            current_members_int = [int(uid) if isinstance(uid, str) else uid for uid in current_members]

            # Check if student is a member
            if student_id not in current_members_int:
                return {
                    "success": False,
                    "message": "Student is not a member of this team.",
                    "data": None,
                }

            # Remove student from members
            new_members = [uid for uid in current_members_int if uid != student_id]

            update_data = {"members": new_members}

            updated_team = self.teams_data.update_team(team_id, update_data)
            if not updated_team:
                return {
                    "success": False,
                    "message": "Failed to update team membership.",
                    "data": None,
                }

            processed_data = self._process_team_data(updated_team)

            return {
                "success": True,
                "message": "Member removed from the team.",
                "data": processed_data,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def _process_team_data(self, team_data: Dict[Any, Any]) -> Dict[Any, Any]:
        processed = dict(team_data)
        processed['source'] = 'watmatch-server'
        return processed

    def _get_user_email(self, user_id: int) -> Optional[str]:
        """Fetch a user's email from the users table."""
        try:
            response = supabase.table("users").select("email").eq("user_id", user_id).execute()
            if not response.data:
                return None
            return response.data[0].get("email")
        except Exception as e:
            print(f"Failed to fetch user email: {e}")
            return None