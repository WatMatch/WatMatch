from .student_profile_dl import StudentProfileDataLogic
from typing import Dict, Any, Optional, List


class StudentProfileBusinessLogic:
    """Business layer for student profile operations"""

    def __init__(self):
        self.profile_data = StudentProfileDataLogic()

    def create_or_update_profile(
        self,
        student_id: int,
        headline: Optional[str] = None,
        about_me: Optional[str] = None,
        skills: Optional[List[str]] = None,
        preferred_roles: Optional[List[str]] = None,
        project_interests: Optional[List[str]] = None,
        interested_department_ids: Optional[List[int]] = None,
        availability: Optional[str] = None,
        portfolio_url: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        github_url: Optional[str] = None,
        profile_visibility: Optional[str] = "team_network",
    ) -> Dict[str, Any]:
        """Create or update a student profile"""
        try:
            # Validate student_id
            if not isinstance(student_id, int) or student_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid student ID. Must be a positive integer.",
                    "data": None
                }

            if headline is not None:
                if not isinstance(headline, str):
                    return {"success": False, "message": "Headline must be a string.", "data": None}
                if len(headline) > 120:
                    return {"success": False, "message": "Headline must be 120 characters or fewer.", "data": None}

            # Validate about_me length
            if about_me is not None:
                if not isinstance(about_me, str):
                    return {
                        "success": False,
                        "message": "About me must be a string.",
                        "data": None
                    }
                if len(about_me) > 600:
                    return {
                        "success": False,
                        "message": "About me must be 600 characters or fewer.",
                        "data": None
                    }

            # Validate skills
            if skills is not None:
                if not isinstance(skills, list):
                    return {
                        "success": False,
                        "message": "Skills must be a list of strings.",
                        "data": None
                    }
                for skill in skills:
                    if not isinstance(skill, str):
                        return {
                            "success": False,
                            "message": "Each skill must be a string.",
                            "data": None
                        }
                    if len(skill) > 80:
                        return {
                            "success": False,
                            "message": "Each skill must be 80 characters or fewer.",
                            "data": None
                        }

            list_specs = [
                ("preferred roles", preferred_roles, 8, 60),
                ("project interests", project_interests, 10, 80),
            ]
            for label, values, max_items, max_length in list_specs:
                if values is None:
                    continue
                if not isinstance(values, list):
                    return {"success": False, "message": f"{label.title()} must be a list of strings.", "data": None}
                if len(values) > max_items:
                    return {"success": False, "message": f"A profile can include at most {max_items} {label}.", "data": None}
                for value in values:
                    if not isinstance(value, str):
                        return {"success": False, "message": f"Each {label[:-1]} must be a string.", "data": None}
                    if len(value) > max_length:
                        return {"success": False, "message": f"Each {label[:-1]} must be {max_length} characters or fewer.", "data": None}

            if interested_department_ids is not None:
                if not isinstance(interested_department_ids, list):
                    return {"success": False, "message": "Interested departments must be a list of IDs.", "data": None}
                if len(interested_department_ids) > 12:
                    return {"success": False, "message": "A profile can include at most 12 interested departments.", "data": None}
                for department_id in interested_department_ids:
                    if not isinstance(department_id, int) or department_id <= 0:
                        return {"success": False, "message": "Interested department IDs must be positive integers.", "data": None}

            text_specs = [
                ("Availability", availability, 80),
                ("Portfolio URL", portfolio_url, 500),
                ("LinkedIn URL", linkedin_url, 500),
                ("GitHub URL", github_url, 500),
            ]
            for label, value, max_length in text_specs:
                if value is None:
                    continue
                if not isinstance(value, str):
                    return {"success": False, "message": f"{label} must be a string.", "data": None}
                if len(value) > max_length:
                    return {"success": False, "message": f"{label} must be {max_length} characters or fewer.", "data": None}

            if profile_visibility not in {None, "team_network", "students", "private"}:
                return {"success": False, "message": "Invalid profile visibility.", "data": None}

            saved_profile = self.profile_data.upsert_profile(
                student_id=student_id,
                headline=headline,
                about_me=about_me,
                skills=skills,
                preferred_roles=preferred_roles,
                project_interests=project_interests,
                interested_department_ids=interested_department_ids,
                availability=availability,
                portfolio_url=portfolio_url,
                linkedin_url=linkedin_url,
                github_url=github_url,
                profile_visibility=profile_visibility or "team_network",
            )
            if not saved_profile:
                return {
                    "success": False,
                    "message": "Failed to save profile.",
                    "data": None
                }
            return {
                "success": True,
                "message": "Profile saved successfully",
                "data": saved_profile
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_profile(self, student_id: int, requester_id: int, requester_role: str = None) -> Dict[str, Any]:
        """Get a student profile"""
        try:
            # Validate student_id
            if not isinstance(student_id, int) or student_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid student ID. Must be a positive integer.",
                    "data": None
                }

            profile = self.profile_data.get_profile_by_student_id(student_id)

            if not profile:
                return {
                    "success": False,
                    "message": f"Profile for student {student_id} not found",
                    "data": None
                }

            if not self.profile_data.can_view_profile(
                student_id=student_id,
                requester_id=requester_id,
                requester_role=requester_role,
                profile_visibility=profile.get("profile_visibility"),
            ):
                return {
                    "success": False,
                    "message": "Forbidden: you do not have access to this student profile.",
                    "data": None
                }

            return {
                "success": True,
                "message": "Profile retrieved successfully",
                "data": profile
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

