from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from .courses_bl import CoursesBusinessLogic
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/courses", tags=["courses"])
courses_business = CoursesBusinessLogic()


class CreateCourseRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=200)
    term: Optional[str] = Field(default=None, max_length=100)


class UpdateCourseRequest(BaseModel):
    code: Optional[str] = Field(default=None, max_length=32)
    name: Optional[str] = Field(default=None, max_length=200)
    term: Optional[str] = Field(default=None, max_length=100)
    active: Optional[bool] = None


@router.post("/")
async def create_course(
    request: CreateCourseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.create_course(
        request.code,
        request.name,
        request.term,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/")
async def get_courses(active_only: bool = Query(False)) -> Dict[str, Any]:
    result = courses_business.list_courses(active_only=active_only)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/{course_id}")
async def get_course(course_id: int) -> Dict[str, Any]:
    result = courses_business.get_course(course_id)
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.patch("/{course_id}")
async def update_course(
    course_id: int,
    request: UpdateCourseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.update_course(
        course_id=course_id,
        code=request.code,
        name=request.name,
        term=request.term,
        active=request.active,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result
