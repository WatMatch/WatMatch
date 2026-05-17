# routers/interests.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from .interests_bl import InterestsBusiness
from ..auth.controller import get_current_user

router = APIRouter(prefix="/interests", tags=["Team Interests"])
interests_bl = InterestsBusiness()


class ExpressInterestRequest(BaseModel):
    message: Optional[str] = None


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

    print(result)

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
    if current_user.get("role") != "leader":
        raise HTTPException(status_code=403, detail="Only leaders can view interest list")

    result = interests_bl.list_interested(capstone_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to list interested students"))
    return result
