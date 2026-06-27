# routers/interests.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from .interests_bl import InterestsBusiness
from ..auth.dependencies import get_current_user
from ..config.database import supabase

router = APIRouter(prefix="/interests", tags=["Team Interests"])
interests_bl = InterestsBusiness()


def _can_view_interest_list(capstone_id: int, current_user: Dict[str, Any]) -> bool:
    role = (current_user.get("role") or "").lower()
    if role == "admin":
        return True
    capstone = (
        supabase.table("capstones")
        .select("*")
        .eq("capstone_id", capstone_id)
        .limit(1)
        .execute()
        .data
        or [None]
    )[0]
    if not capstone or capstone.get("team_fk") is None:
        return False
    team = (
        supabase.table("teams")
        .select("*")
        .eq("team_id", capstone.get("team_fk"))
        .limit(1)
        .execute()
        .data
        or [None]
    )[0]
    if not team:
        return False
    if role == "student":
        return int(team.get("leader_fk") or 0) == int(current_user.get("user_id") or 0)
    if role == "instructor":
        course_fk = current_user.get("course_fk")
        return course_fk is not None and team.get("course_fk") is not None and int(course_fk) == int(team["course_fk"])
    return False


class ExpressInterestRequest(BaseModel):
    message: Optional[str] = Field(default=None, max_length=1000)


@router.post("/{capstone_id}")
async def express_interest(
    capstone_id: int,
    body: ExpressInterestRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can express interest")

    student_id = current_user["user_id"]
    result = interests_bl.express_interest(capstone_id, student_id, body.message)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to express interest"))
    return result


@router.delete("/{capstone_id}")
async def withdraw_interest(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can withdraw interest")

    student_id = current_user["user_id"]
    result = interests_bl.withdraw_interest(capstone_id, student_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to withdraw interest"))
    return result


@router.get("/{capstone_id}")
async def list_interested_students(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") not in {"student", "instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Unauthorized to view interest list")
    if not _can_view_interest_list(capstone_id, current_user):
        raise HTTPException(status_code=403, detail="Forbidden to view interest list for this capstone")

    result = interests_bl.list_interested(capstone_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to list interested students"))
    return result
