from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth.dependencies import get_current_user
from ..config.database import supabase
from ..workflow.rpc_utils import call_json_rpc

router = APIRouter(prefix="/skills", tags=["skills"])


class CreateSkillRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class UpdateSkillRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)


@router.get("/")
async def get_skills() -> Dict[str, Any]:
    try:
        query = supabase.table("skills").select("*").order("name")
        rows = query.execute().data or []
        return {
            "success": True,
            "message": f"Retrieved {len(rows)} skill(s)",
            "data": rows,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _require_admin(current_user: Dict[str, Any]) -> None:
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _raise_rpc_error(result: Dict[str, Any]) -> None:
    if result.get("success", True):
        return
    detail = str(result.get("message") or "Skill workflow failed")
    lowered = detail.lower()
    if "not found" in lowered:
        status_code = 404
    elif "already exists" in lowered:
        status_code = 409
    elif "access required" in lowered or "forbidden" in lowered:
        status_code = 403
    else:
        status_code = 400
    raise HTTPException(status_code=status_code, detail=detail)


@router.post("/")
async def create_skill(
    request: CreateSkillRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = call_json_rpc(
        "watmatch_admin_upsert_skill",
        {
            "p_skill_id": None,
            "p_name": request.name,
            "p_actor_id": int(current_user["user_id"]),
            "p_reason": "admin_skill_management",
        },
    )
    _raise_rpc_error(result)
    return result


@router.patch("/{skill_id}")
async def update_skill(
    skill_id: int,
    request: UpdateSkillRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    existing = (
        supabase.table("skills")
        .select("*")
        .eq("skill_id", skill_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Skill not found")
    current = existing[0]
    next_name = request.name if request.name is not None else current.get("name")
    result = call_json_rpc(
        "watmatch_admin_upsert_skill",
        {
            "p_skill_id": skill_id,
            "p_name": next_name,
            "p_actor_id": int(current_user["user_id"]),
            "p_reason": "admin_skill_management",
        },
    )
    _raise_rpc_error(result)
    return result
