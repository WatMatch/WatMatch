"""Private, qualitative instructor feedback for finalized capstone teams."""
import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from httpx import RequestError
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from src.auth.dependencies import get_current_user
from src.config.database import supabase

router = APIRouter(prefix="/capstones", tags=["milestone feedback"])


class FeedbackRequest(BaseModel):
    entry_id: UUID
    milestone: str = Field(min_length=1, max_length=100)
    comment: str = Field(min_length=1, max_length=2000)


def verified_feedback_user(request: Request, user: dict = Depends(get_current_user)):
    if os.getenv("WATMATCH_MILESTONE_FEEDBACK_ENABLED") != "true":
        raise HTTPException(404, "Milestone feedback is unavailable.")
    if getattr(request.state, "watmatch_verified_identity", False) is not True or user.get("role") not in {"student", "instructor"}:
        raise HTTPException(403, "Verified instructor or student access is required.")
    return user


def feedback_rpc(name, params):
    try:
        return supabase.rpc(name, params).execute().data
    except APIError as exc:
        if exc.code == "42501":
            raise HTTPException(403, "You do not have access to this milestone feedback.") from exc
        if exc.code == "23505":
            raise HTTPException(409, "This feedback request has already been used.") from exc
        if exc.code in {"23502", "23514"}:
            raise HTTPException(422, "Enter a milestone and a comment within the length limits.") from exc
        raise HTTPException(503, "Milestone feedback is temporarily unavailable.") from exc
    except RequestError as exc:
        raise HTTPException(503, "Milestone feedback is temporarily unavailable.") from exc


@router.get("/{capstone_id:int}/milestone-feedback")
def list_feedback(capstone_id: int, response: Response, user: dict = Depends(verified_feedback_user)):
    response.headers["Cache-Control"] = "private, no-store"
    return feedback_rpc("watmatch_list_milestone_feedback", {
        "p_capstone_id": capstone_id, "p_actor_id": user["user_id"], "p_role": user["role"],
    })


@router.post("/{capstone_id:int}/milestone-feedback")
def add_feedback(capstone_id: int, feedback: FeedbackRequest, user: dict = Depends(verified_feedback_user)):
    if user["role"] != "instructor":
        raise HTTPException(403, "Only the coordinating course instructor can record feedback.")
    milestone, comment = feedback.milestone.strip(), feedback.comment.strip()
    if not milestone or not comment:
        raise HTTPException(422, "Enter a milestone and a comment.")
    return feedback_rpc("watmatch_add_milestone_feedback", {
        "p_capstone_id": capstone_id, "p_actor_id": user["user_id"],
        "p_entry_id": str(feedback.entry_id), "p_milestone": milestone, "p_comment": comment,
    })
