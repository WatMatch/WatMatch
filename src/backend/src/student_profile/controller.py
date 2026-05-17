from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from .student_profile_bl import StudentProfileBusinessLogic
from ..auth.dependencies import get_current_user
from typing import Dict, Any, Optional, List

router = APIRouter(prefix="/student-profile", tags=["student-profile"])
profile_business = StudentProfileBusinessLogic()


class CreateOrUpdateProfileRequest(BaseModel):
    about_me: Optional[str] = None
    skills: Optional[List[str]] = None


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
            about_me=request.about_me,
            skills=request.skills
        )

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
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
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
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
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{student_id}")
async def delete_profile(
    student_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Delete a student profile (own profile or admin only)"""
    try:
        requester_id = current_user.get("user_id")

        if not requester_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = profile_business.delete_profile(
            student_id=student_id,
            requester_id=requester_id,
            requester_role=current_user.get("role")
        )

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            if "only delete your own" in result["message"].lower():
                status_code = 403
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
