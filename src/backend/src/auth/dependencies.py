from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .jwt_utils import verify_access_token
from typing import Dict, Any
from ..config.database import supabase

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from JWT token.
    Use this in protected routes.

    Example:
        @router.get("/protected")
        async def protected_route(current_user: Dict = Depends(get_current_user)):
            return {"user": current_user}
    """
    token = credentials.credentials

    payload = verify_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token user",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_response = (
        supabase.table("users")
        .select("user_id,email,role,course_fk,home_department_fk,active")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    user = (user_response.data or [None])[0]
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.get("active") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    course = None
    course_active = None
    if user.get("course_fk") is not None:
        course_response = (
            supabase.table("courses")
            .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind,requires_project_support")
            .eq("course_id", user.get("course_fk"))
            .limit(1)
            .execute()
        )
        course = (course_response.data or [None])[0]
        course_active = bool(course.get("active")) if course else False

    home_department = None
    if user.get("home_department_fk") is not None:
        department_response = (
            supabase.table("departments")
            .select("department_id,name,active")
            .eq("department_id", user.get("home_department_fk"))
            .limit(1)
            .execute()
        )
        home_department = (department_response.data or [None])[0]

    return {
        "user_id": user.get("user_id"),
        "email": user.get("email"),
        "role": user.get("role"),
        "course_fk": user.get("course_fk"),
        "home_department_fk": user.get("home_department_fk"),
        "home_department_id": user.get("home_department_fk"),
        "home_department": home_department,
        "active": user.get("active"),
        "course": course,
        "course_active": course_active,
    }


async def get_current_student(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Dependency to ensure current user is a student.
    """
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required"
        )
    return current_user


async def get_current_instructor(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Dependency to ensure current user is an instructor.
    """
    if current_user.get("role") != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Instructor access required"
        )
    return current_user
