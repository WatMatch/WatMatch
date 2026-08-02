from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .departments_bl import DepartmentsBusinessLogic
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/departments", tags=["departments"])
departments_business = DepartmentsBusinessLogic()


class CreateDepartmentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    faculty_id: Optional[int] = None


class UpdateDepartmentRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    active: Optional[bool] = None
    faculty_id: Optional[int] = None
    reason: Optional[str] = Field(default=None, max_length=2000)


@router.get("/")
async def get_departments(active_only: bool = Query(False)) -> Dict[str, Any]:
    result = departments_business.list_departments(active_only=active_only)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/faculties/")
async def get_faculties(active_only: bool = Query(False)) -> Dict[str, Any]:
    result = departments_business.list_faculties(active_only=active_only)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/{department_id}")
async def get_department(department_id: int) -> Dict[str, Any]:
    result = departments_business.get_department(department_id)
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.post("/")
async def create_department(
    request: CreateDepartmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = departments_business.create_department(
        name=request.name,
        faculty_id=request.faculty_id,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.patch("/{department_id}")
async def update_department(
    department_id: int,
    request: UpdateDepartmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = departments_business.update_department(
        department_id=department_id,
        name=request.name,
        active=request.active,
        faculty_id=request.faculty_id,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result
