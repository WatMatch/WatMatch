from .student_profile_dl import StudentProfileDataLogic
from typing import Dict, Any, Optional, List


class StudentProfileBusinessLogic:
    """Business layer for student profile operations"""

    def __init__(self):
        self.profile_data = StudentProfileDataLogic()

    def create_or_update_profile(
        self,
        student_id: int,
        about_me: Optional[str] = None,
        skills: Optional[List[str]] = None
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

            # Validate about_me length (max 250 characters)
            if about_me is not None:
                if not isinstance(about_me, str):
                    return {
                        "success": False,
                        "message": "About me must be a string.",
                        "data": None
                    }
                if len(about_me) >= 250:
                    return {
                        "success": False,
                        "message": "About me must be less than 250 characters.",
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

            # Prepare profile data
            profile_data = {}
            if about_me is not None:
                profile_data["about_me"] = about_me
            if skills is not None:
                profile_data["skills"] = skills

            # Check if profile exists
            existing_profile = self.profile_data.get_profile_by_student_id(
                student_id)

            if existing_profile:
                # Update existing profile
                updated_profile = self.profile_data.update_profile(
                    student_id, profile_data)
                if not updated_profile:
                    return {
                        "success": False,
                        "message": "Failed to update profile.",
                        "data": None
                    }
                return {
                    "success": True,
                    "message": "Profile updated successfully",
                    "data": updated_profile
                }
            else:
                # Create new profile
                created_profile = self.profile_data.create_profile(
                    student_id, profile_data)
                if not created_profile:
                    return {
                        "success": False,
                        "message": "Failed to create profile.",
                        "data": None
                    }
                return {
                    "success": True,
                    "message": "Profile created successfully",
                    "data": created_profile
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

            # Get the profile
            profile = self.profile_data.get_profile_by_student_id(student_id)

            if not profile:
                return {
                    "success": False,
                    "message": f"Profile for student {student_id} not found",
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

    def delete_profile(self, student_id: int, requester_id: int, requester_role: str = None) -> Dict[str, Any]:
        """Delete a student profile (own profile or admin only)"""
        try:
            # Validate student_id
            if not isinstance(student_id, int) or student_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid student ID. Must be a positive integer.",
                    "data": None
                }

            # Check authorization - only the student themselves or admin can delete
            if requester_id != student_id and requester_role != "admin":
                return {
                    "success": False,
                    "message": "You can only delete your own profile",
                    "data": None
                }

            # Check if profile exists
            profile = self.profile_data.get_profile_by_student_id(student_id)
            if not profile:
                return {
                    "success": False,
                    "message": f"Profile for student {student_id} not found",
                    "data": None
                }

            # Delete the profile
            self.profile_data.delete_profile(student_id)

            return {
                "success": True,
                "message": "Profile deleted successfully",
                "data": {"student_id": student_id}
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }
