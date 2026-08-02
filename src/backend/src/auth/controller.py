from fastapi import APIRouter, HTTPException, Depends
import logging
from pydantic import BaseModel, Field
from typing import Dict, Any
from .auth_bl import AuthBusinessLogic
from .dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
auth_business = AuthBusinessLogic()
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=16, max_length=4096)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=16, max_length=4096)


@router.post("/login")
async def login(request: LoginRequest) -> Dict[str, Any]:
    """
    Login an admin-provisioned local/demo user and get access and refresh tokens.

    Request body:
    - email: User's email

    Returns:
    - success: bool
    - message: str
    - data:
      - access_token: JWT access token (15 min expiry)
      - refresh_token: JWT refresh token (7 day expiry)
      - token_type: "bearer"
      - user: User object
    """
    try:
        result = auth_business.login(
            email=request.email
        )

        if not result["success"]:
            raise HTTPException(status_code=401, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Auth login failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
async def refresh_tokens(request: RefreshTokenRequest) -> Dict[str, Any]:
    """
    Refresh access token using refresh token.
    Implements refresh token rotation - old refresh token is invalidated.

    Request body:
    - refresh_token: Current refresh token

    Returns:
    - success: bool
    - message: str
    - data:
      - access_token: New JWT access token
      - refresh_token: New JWT refresh token
      - token_type: "bearer"
    """
    try:
        result = auth_business.refresh_tokens(request.refresh_token)

        if not result["success"]:
            raise HTTPException(status_code=401, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Auth refresh failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout")
async def logout(request: LogoutRequest) -> Dict[str, Any]:
    """
    Logout user by invalidating refresh token.

    Request body:
    - refresh_token: Refresh token to invalidate

    Returns:
    - success: bool
    - message: str
    """
    try:
        result = auth_business.logout(request.refresh_token)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Auth logout failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout-all")
async def logout_all_devices(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Logout user from all devices by invalidating all refresh tokens.
    Requires authentication (access token in Authorization header).

    Headers:
    - Authorization: Bearer <access_token>

    Returns:
    - success: bool
    - message: str
    """
    try:
        result = auth_business.logout_all_devices(current_user["user_id"])

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Auth me lookup failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get current authenticated user information.
    Requires authentication (access token in Authorization header).

    Headers:
    - Authorization: Bearer <access_token>

    Returns:
    - success: bool
    - data: User information from token
    """
    return {
        "success": True,
        "data": current_user
    }
