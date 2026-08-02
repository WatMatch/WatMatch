from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, Optional
from .approvals_bl import ApprovalsBusinessLogic
from ..auth.dependencies import get_current_user
from ..config.database import supabase
from ..workflow.workflow_utils import is_user_team_participant
from ..workflow.rpc_utils import call_json_rpc

router = APIRouter(prefix="/approvals", tags=["approvals"])
approvals_business = ApprovalsBusinessLogic()


def _get_capstone_and_team(capstone_id: int) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    capstone = (
        supabase.table("capstones")
        .select("*")
        .eq("capstone_id", capstone_id)
        .limit(1)
        .execute()
        .data
        or [None]
    )[0]
    if not capstone:
        return None, None
    team = None
    if capstone.get("team_fk") is not None:
        team = (
            supabase.table("teams")
            .select("*")
            .eq("team_id", capstone.get("team_fk"))
            .limit(1)
            .execute()
            .data
            or [None]
        )[0]
    return capstone, team


def _can_access_capstone_context(capstone_id: int, current_user: Dict[str, Any]) -> bool:
    role = (current_user.get("role") or "").lower()
    if role == "admin":
        return True
    capstone, team = _get_capstone_and_team(capstone_id)
    if not capstone:
        return False
    if role == "student":
        user_id = current_user.get("user_id")
        if not user_id:
            return False
        if team and team.get("team_id") is not None:
            return is_user_team_participant(int(user_id), int(team["team_id"]), fallback_team=team)
        return int(capstone.get("user_fk") or 0) == int(user_id)
    if role == "instructor":
        course_fk = current_user.get("course_fk")
        if course_fk is None:
            return False
        course_id = int(course_fk)
        approval_scope = (
            supabase.table("capstone_course_approvals")
            .select("capstone_fk")
            .eq("capstone_fk", capstone_id)
            .eq("course_fk", course_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if team and team.get("team_id") is not None:
            if team.get("course_fk") is not None and int(team["course_fk"]) == course_id:
                return True
            return bool(approval_scope)
        if capstone.get("course_fk") is not None and int(capstone["course_fk"]) == course_id:
            return True
        return bool(approval_scope)
    return False


@router.get("/capstone/{capstone_id}")
async def get_capstone_approval_history(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() not in {"student", "instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Unauthorized")
    if not _can_access_capstone_context(capstone_id, current_user):
        raise HTTPException(status_code=403, detail="Forbidden for this capstone")
    result = approvals_business.get_capstone_history(capstone_id)
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result

@router.get("/audit-log")
async def get_audit_log(
    entity_type: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    actor_search: Optional[str] = Query(None),
    course_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    context_search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    role = (current_user.get("role") or "").lower()
    if role not in {"instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Instructor/admin access required")
    if role == "instructor":
        instructor_course_id = current_user.get("course_fk")
        if instructor_course_id is None:
            raise HTTPException(status_code=403, detail="Instructor course assignment required")
        instructor_course_id = int(instructor_course_id)
        if course_id is not None and int(course_id) != instructor_course_id:
            raise HTTPException(status_code=403, detail="Forbidden for this course")
        course_id = instructor_course_id

    try:
        result = call_json_rpc(
            "watmatch_get_audit_log",
            {
                "p_actor_id": int(current_user["user_id"]),
                "p_actor_role": role,
                "p_course_id": course_id,
                "p_team_id": team_id,
                "p_context_search": context_search,
                "p_entity_type": entity_type,
                "p_action": action,
                "p_actor_search": actor_search,
                "p_limit": limit,
            },
        )
        if not result.get("success", False):
            raise HTTPException(status_code=400, detail=result.get("message") or "Failed to fetch audit log")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
