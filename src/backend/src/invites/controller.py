from fastapi import APIRouter, HTTPException, Depends
import logging
from pydantic import BaseModel, Field
from .invites_bl import InvitesBusinessLogic
from ..auth.dependencies import get_current_user
from typing import Dict, Any, Optional

router = APIRouter(prefix="/invites", tags=["invites"])
invites_business = InvitesBusinessLogic()
logger = logging.getLogger(__name__)


class CreateInviteRequest(BaseModel):
    team_id: int
    email: str = Field(..., min_length=3, max_length=320)


class AcceptInviteRequest(BaseModel):
    invite_id: str = Field(..., min_length=1, max_length=32)


class DeclineInviteRequest(BaseModel):
    invite_id: str = Field(..., min_length=1, max_length=32)


class RevokeInviteRequest(BaseModel):
    invite_id: str = Field(..., min_length=1, max_length=32)
    reason: Optional[str] = Field(default=None, max_length=2000)


@router.post("/")
async def create_invite(
    request: CreateInviteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a new team invite (team leader only)"""
    try:
        requester_id = current_user.get("user_id")

        if not requester_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = invites_business.create_invite(
            team_id=request.team_id,
            email=request.email,
            requester_id=requester_id
        )

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            if "only the team leader" in result["message"].lower():
                status_code = 403
            if "must be a valid @uwaterloo.ca" in result["message"].lower() or "only student users" in result["message"].lower():
                status_code = 400
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create invite failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team/{team_id}")
async def get_team_invites(
    team_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get all invites for a specific team (team leader only)"""
    try:
        requester_id = current_user.get("user_id")

        if not requester_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = invites_business.get_team_invites(
            team_id,
            requester_id,
            current_user.get("role") or "student",
        )

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            if "only the team leader" in result["message"].lower():
                status_code = 403
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Accept invite failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}")
async def get_user_invites(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get all invites for a specific user"""
    try:
        requester_id = current_user.get("user_id")
        requester_role = current_user.get("role")

        if not requester_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = invites_business.get_user_invites(
            user_id, requester_id, requester_role)

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            if "only view your own" in result["message"].lower():
                status_code = 403
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Decline invite failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/accept")
async def accept_invite(
    request: AcceptInviteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Accept a team invite"""
    try:
        user_id = current_user.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = invites_business.accept_invite(request.invite_id, user_id)

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            if "not for the specified user" in result["message"].lower():
                status_code = 403
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Revoke invite failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decline")
async def decline_invite(
    request: DeclineInviteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Decline a team invite"""
    try:
        user_id = current_user.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = invites_business.decline_invite(request.invite_id, user_id)

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            if "not for the specified user" in result["message"].lower():
                status_code = 403
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("User invite lookup failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/revoke")
async def revoke_invite(
    request: RevokeInviteRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Revoke a team invite (team leader only)"""
    try:
        user_id = current_user.get("user_id")

        if not user_id:
            raise HTTPException(
                status_code=401, detail="User ID not found in token")

        result = invites_business.revoke_invite(
            request.invite_id,
            user_id,
            current_user.get("role") or "student",
            request.reason,
        )

        if not result["success"]:
            status_code = 404 if "not found" in result["message"].lower(
            ) else 400
            if "only the team leader" in result["message"].lower() or "scoped instructors/admins" in result["message"].lower():
                status_code = 403
            raise HTTPException(status_code=status_code,
                                detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Team invite lookup failed")
        raise HTTPException(status_code=500, detail=str(e))
