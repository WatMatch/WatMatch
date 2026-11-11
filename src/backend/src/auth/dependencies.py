from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .clerk_auth import ClerkAuthError, get_clerk_verifier
from .roles import resolve_active_role
from starlette.concurrency import run_in_threadpool
from typing import Dict, Any
from ..config.database import supabase
from ..config.runtime_safety import clock_is_synchronized

security = HTTPBearer()


KNOWN_ROLES = {"student", "instructor", "admin", "academic_advisor", "enrollment_operator", "mentor", "external_partner"}


def _resolve_current_user(token: str, expected_role: str | None) -> tuple[Dict[str, Any], str]:
    # A wrong host clock invalidates the guarantees of token time checks.
    # This runs in the same worker thread as identity verification below.
    if not clock_is_synchronized():
        raise ClerkAuthError(503, "Identity verification is temporarily unavailable")
    email, session_key = get_clerk_verifier().verified_account(token)
    # Match case-insensitively, escape SQL LIKE wildcards, then check equality
    # again in Python. Two rows are enough to reject an ambiguous mapping.
    pattern = email.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    user_response = (
        supabase.table("users")
        .select("user_id,email,role,course_fk,home_department_fk,active,"
                "user_roles!user_roles_user_fk_fkey(role),clerk_role_sessions(active_role)")
        .eq("clerk_role_sessions.session_key", session_key)
        .ilike("email", pattern)
        .limit(2)
        .execute()
    )
    rows = user_response.data or []
    if not isinstance(rows, list):
        raise ClerkAuthError(503, "Account verification is temporarily unavailable")
    if len(rows) != 1 or not isinstance(rows[0], dict):
        raise ClerkAuthError(403, "This identity is not provisioned for WatMatch")
    user = rows[0]
    if (not isinstance(user.get("email"), str)
            or user["email"].strip().lower() != email
            or user.get("user_id") is None
            or user.get("active") is not True
            or user.get("role") not in KNOWN_ROLES):
        raise ClerkAuthError(403, "This identity is not permitted")

    roles = sorted({row["role"] for row in user["user_roles"]})
    sessions = user["clerk_role_sessions"]
    if not isinstance(sessions, list) or len(sessions) > 1:
        raise ClerkAuthError(503, "Account verification is temporarily unavailable")
    active_role = resolve_active_role(user, roles, sessions[0]["active_role"] if sessions else None)
    if expected_role is not None and expected_role != active_role:
        raise HTTPException(409, "The active workspace has changed.", headers={"X-WatMatch-Workspace-Changed": "1"})

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
        "role": active_role,
        "active_role": active_role,
        "assigned_roles": roles,
        "default_role": user["role"],
        "course_fk": user.get("course_fk"),
        "home_department_fk": user.get("home_department_fk"),
        "home_department_id": user.get("home_department_fk"),
        "home_department": home_department,
        "active": user.get("active"),
        "course": course,
        "course_active": course_active,
    }, session_key


async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Resolve a current Clerk identity to a pre-provisioned WatMatch account."""
    try:
        # Clerk and Supabase use synchronous HTTP clients; keep network work off
        # the API event loop. No identity/session cache permits stale revocation.
        account, session_key = await run_in_threadpool(
            _resolve_current_user, credentials.credentials, request.headers.get("X-WatMatch-Workspace")
        )
        request.state.watmatch_session_key = session_key
        request.state.watmatch_verified_identity = True
        return account
    except ClerkAuthError as exc:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        raise HTTPException(status_code=exc.status_code, detail=exc.detail, headers=headers) from None
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Account verification is temporarily unavailable") from None


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
