from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from .feedback_bl import FeedbackBusinessLogic

router = APIRouter(prefix="/feedback", tags=["feedback"])
feedback_business = FeedbackBusinessLogic()


class CreateFeedbackRequest(BaseModel):
    capstone_id: int
    feedback: str


class AcknowledgeFeedbackRequest(BaseModel):
    acknowledged: bool = True


@router.post("/")
async def create_feedback(request: CreateFeedbackRequest) -> Dict[str, Any]:
    """Create feedback for a capstone."""
    try:
        result = feedback_business.create_feedback(
            capstone_id=request.capstone_id,
            feedback_text=request.feedback,
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error occurred: {type(exc).__name__}: {str(exc)}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{feedback_id}/acknowledge")
async def acknowledge_feedback(
    feedback_id: int,
    request: AcknowledgeFeedbackRequest,
) -> Dict[str, Any]:
    """Acknowledge or unacknowledge a feedback entry."""
    try:
        result = feedback_business.acknowledge_feedback(
            feedback_id=feedback_id,
            acknowledged=request.acknowledged,
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error occurred: {type(exc).__name__}: {str(exc)}")
        raise HTTPException(status_code=500, detail=str(exc))
