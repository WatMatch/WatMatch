from fastapi import APIRouter, HTTPException, Depends
import logging
from pydantic import BaseModel, Field
from .student_profile_bl import StudentProfileBusinessLogic
from ..auth.dependencies import get_current_user
from typing import Dict, Any, Optional, List

router = APIRouter(prefix="/student-profile", tags=["student-profile"])
profile_business = StudentProfileBusinessLogic()
logger = logging.getLogger(__name__)


class CreateOrUpdateProfileRequest(BaseModel):
    headline: Optional[str] = Field(default=None, max_length=120)
    about_me: Optional[str] = Field(default=None, max_length=600)
    skills: Optional[List[str]] = Field(default=None, max_length=25)
    preferred_roles: Optional[List[str]] = Field(default=None, max_length=8)
    project_interests: Optional[List[str]] = Field(default=None, max_length=10)
    interested_department_ids: Optional[List[int]] = Field(default=None, max_length=12)
    availability: Optional[str] = Field(default=None, max_length=80)
    portfolio_url: Optional[str] = Field(default=None, max_length=500)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    github_url: Optional[str] = Field(default=None, max_length=500)
    profile_visibility: Optional[str] = Field(default="team_network", max_length=32)


@router.post("/")
async def create_or_update_profile(
    request: CreateOrUpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create or update student profile for the authenticated user"""
    try:
        student_id = current_user.get("user_id")

        if not student_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        # Verify user is a student
        if current_user.get("role") != "student":
            raise HTTPException(
                status_code=403,
                detail="Only students can create profiles"
            )

        result = profile_business.create_or_update_profile(
            student_id=student_id,
            headline=request.headline,
            about_me=request.about_me,
            skills=request.skills,
            preferred_roles=request.preferred_roles,
            project_interests=request.project_interests,
            interested_department_ids=request.interested_department_ids,
            availability=request.availability,
            portfolio_url=request.portfolio_url,
            linkedin_url=request.linkedin_url,
            github_url=request.github_url,
            profile_visibility=request.profile_visibility,
        )

        if not result["success"]:
            lowered = result["message"].lower()
            status_code = 404 if "not found" in lowered else 403 if "forbidden" in lowered or "access" in lowered else 400
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create or update profile failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get the authenticated user's profile"""
    try:
        student_id = current_user.get("user_id")

        if not student_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = profile_business.get_profile(
            student_id=student_id,
            requester_id=student_id,
            requester_role=current_user.get("role")
        )

        if not result["success"]:
            lowered = result["message"].lower()
            status_code = 404 if "not found" in lowered else 403 if "forbidden" in lowered or "access" in lowered else 400
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Own profile lookup failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{student_id}")
async def get_profile(
    student_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get a student profile by student ID"""
    try:
        requester_id = current_user.get("user_id")

        if not requester_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = profile_business.get_profile(
            student_id=student_id,
            requester_id=requester_id,
            requester_role=current_user.get("role")
        )

        if not result["success"]:
            lowered = result["message"].lower()
            status_code = 404 if "not found" in lowered else 403 if "forbidden" in lowered or "access" in lowered else 400
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Student profile lookup failed")
        raise HTTPException(status_code=500, detail=str(e))


