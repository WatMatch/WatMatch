from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from .invites_bl import InvitesBusinessLogic
from ..auth.dependencies import get_current_user
from typing import Dict, Any

router = APIRouter(prefix="/invites", tags=["invites"])
invites_business = InvitesBusinessLogic()


class CreateInviteRequest(BaseModel):
    team_id: int
    email: str


class AcceptInviteRequest(BaseModel):
    invite_id: str


class DeclineInviteRequest(BaseModel):
    invite_id: str


class RevokeInviteRequest(BaseModel):
    invite_id: str


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
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{invite_id}")
async def get_invite(invite_id: str) -> Dict[str, Any]:
    """Get an invite by its ID"""
    try:
        result = invites_business.get_invite(invite_id)

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

        result = invites_business.get_team_invites(team_id, requester_id)

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
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
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
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
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
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
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
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/revoke")
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

        result = invites_business.revoke_invite(request.invite_id, user_id)

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
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
