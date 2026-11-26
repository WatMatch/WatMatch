from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any, Literal
from .dependencies import get_current_user
from ..workflow.rpc_utils import call_json_rpc

router = APIRouter(prefix="/auth", tags=["auth"])


class WorkspaceSelection(BaseModel):
    role: Literal["instructor", "mentor"]


@router.post("/switch-role")
def switch_workspace(selection: WorkspaceSelection, request: Request,
                     account: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if set(account["assigned_roles"]) != {"instructor", "mentor"}:
        raise HTTPException(403, "Both workspaces must be assigned to this account.")
    try:
        result = call_json_rpc("watmatch_switch_clerk_workspace", {
            "p_user_id": account["user_id"], "p_session_key": request.state.watmatch_session_key,
            "p_from_role": account["active_role"], "p_to_role": selection.role,
        })
    except Exception:
        raise HTTPException(503, "Workspace selection is temporarily unavailable.") from None
    if result.get("reason") == "stale":
        raise HTTPException(409, "The active workspace has changed.", headers={"X-WatMatch-Workspace-Changed": "1"})
    if result.get("success") is not True:
        raise HTTPException(403, "Workspace change denied.")
    return {"success": True, "data": {"active_role": result["active_role"]}}


@router.post("/login")
@router.post("/refresh")
@router.post("/logout")
@router.post("/logout-all")
async def retired_demo_auth() -> None:
    """Legacy token operations cannot issue tokens or write refresh-token records."""
    raise HTTPException(
        status_code=410,
        detail="Demo authentication has been removed. Use Clerk to sign in or sign out.",
    )


@router.get("/me")
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return {"success": True, "data": current_user}
