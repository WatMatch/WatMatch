from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth.dependencies import get_current_user
from .marketplace_bl import MarketplaceBusinessLogic

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
marketplace_business = MarketplaceBusinessLogic()


def _default_marketplace_term() -> str:
    today = date.today()
    if today.month <= 4:
        season = "Winter"
    elif today.month <= 8:
        season = "Spring"
    else:
        season = "Fall"
    return f"{season} {today.year}"


class MarketplaceSettingsRequest(BaseModel):
    current_term: str = Field(default_factory=_default_marketplace_term, max_length=100)
    phase: str = Field(..., max_length=32)
    exploration_starts_at: Optional[str] = Field(default=None, max_length=100)
    commitment_starts_at: Optional[str] = Field(default=None, max_length=100)
    finalization_starts_at: Optional[str] = Field(default=None, max_length=100)
    override_reason: Optional[str] = Field(default=None, max_length=2000)


class MarketplaceExplorationRequest(BaseModel):
    capstone_id: int
    status: str = Field(default="shortlisted", max_length=32)
    message: Optional[str] = Field(default=None, max_length=2000)
    priority_rank: Optional[int] = Field(default=None, ge=1, le=100)
    student_id: Optional[int] = None
    override_reason: Optional[str] = Field(default=None, max_length=2000)


class ProjectCommitmentCreateRequest(BaseModel):
    exploration_id: int
    comments: Optional[str] = Field(default=None, max_length=2000)


class TeamCommitmentRosterConfirmRequest(BaseModel):
    team_id: int
    comments: Optional[str] = Field(default=None, max_length=2000)


class MarketplaceExplorationCancelRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=2000)


class ProjectCommitmentDecisionRequest(BaseModel):
    decision: str = Field(..., max_length=20)
    decision_route: Optional[str] = Field(default=None, max_length=40)
    target_course_id: Optional[int] = None
    member_enrollment_routes: Optional[Dict[str, int]] = None
    comments: Optional[str] = Field(default=None, max_length=2000)


class CapstoneCloseoutDecisionRequest(BaseModel):
    decision: str = Field(..., max_length=40)
    target_course_id: Optional[int] = None
    notes: str = Field(..., min_length=1, max_length=2000)
    target_term: Optional[str] = Field(default=None, max_length=100)
    member_enrollment_routes: Optional[Dict[str, int]] = None


class MarketplaceActivityResolveRequest(BaseModel):
    capstone_id: Optional[int] = None
    reason: str = Field(..., min_length=1, max_length=2000)


def _status_for_message(message: str) -> int:
    lowered = (message or "").lower()
    if "not found" in lowered:
        return 404
    if "access required" in lowered or "forbidden" in lowered or "only the student" in lowered:
        return 403
    if "already" in lowered or "committed" in lowered:
        return 409
    return 400


@router.get("/settings")
async def get_marketplace_settings(
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.get_settings()
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.patch("/settings")
async def update_marketplace_settings(
    request: MarketplaceSettingsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.update_settings(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        current_term=request.current_term,
        phase=request.phase,
        exploration_starts_at=request.exploration_starts_at,
        commitment_starts_at=request.commitment_starts_at,
        finalization_starts_at=request.finalization_starts_at,
        override_reason=request.override_reason,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.get("/workload")
async def get_enrollment_workload_summary(
    search: Optional[str] = Query(None, max_length=200),
    course_id: Optional[int] = Query(None, ge=1),
    department_id: Optional[int] = Query(None, ge=1),
    queue_type: Optional[str] = Query(None, max_length=80),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.get_workload_summary(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        search=search,
        course_id=course_id,
        department_id=department_id,
        queue_type=queue_type,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.get("/readiness")
async def get_marketplace_readiness(
    current_term: Optional[str] = Query(None, max_length=100),
    phase: Optional[str] = Query(None, max_length=32),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.get_readiness(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        current_term=current_term,
        phase=phase,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.get("/closeout")
async def get_capstones_needing_closeout(
    include_carried_over: bool = Query(False),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.list_closeout_capstones(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        include_carried_over=include_carried_over,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.post("/readiness/resolve-marketplace-activity")
async def resolve_marketplace_activity_for_finalization(
    request: MarketplaceActivityResolveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if not request.reason.strip():
        raise HTTPException(status_code=400, detail="Marketplace activity resolution requires an audit reason")
    result = marketplace_business.resolve_marketplace_activity_for_finalization(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        capstone_id=request.capstone_id,
        reason=request.reason,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.post("/closeout/{capstone_id:int}/decision")
async def decide_capstone_closeout(
    capstone_id: int,
    request: CapstoneCloseoutDecisionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if not request.notes.strip():
        raise HTTPException(status_code=400, detail="Closeout decision notes are required")
    result = marketplace_business.decide_closeout(
        capstone_id=capstone_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        decision=request.decision,
        target_course_id=request.target_course_id,
        notes=request.notes,
        target_term=request.target_term,
        member_enrollment_routes=request.member_enrollment_routes,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.get("/explorations/me")
async def get_my_marketplace_explorations(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "student":
        return {"success": True, "data": [], "commitment_requests": []}
    result = marketplace_business.list_student_explorations(int(current_user["user_id"]))
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.post("/explorations")
async def upsert_marketplace_exploration(
    request: MarketplaceExplorationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    role = (current_user.get("role") or "").lower()
    requested_status = (request.status or "").strip().lower()
    if role == "student":
        if requested_status not in {"shortlisted", "interested"}:
            raise HTTPException(
                status_code=400,
                detail="Students can only save projects or express interest directly.",
            )
        student_id = int(current_user["user_id"])
        source = "student_marketplace"
    elif role in {"admin", "academic_advisor", "enrollment_operator"} and request.student_id:
        student_id = int(request.student_id)
        source = (
            "staff_marketplace_override"
            if request.override_reason and role in {"admin", "enrollment_operator"}
            else "staff_marketplace"
        )
    else:
        raise HTTPException(status_code=403, detail="Student or routing staff access required")

    result = marketplace_business.upsert_exploration(
        capstone_id=request.capstone_id,
        student_id=student_id,
        status=request.status,
        source=source,
        actor_id=int(current_user["user_id"]),
        message=request.message,
        priority_rank=request.priority_rank,
        override_reason=request.override_reason,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.post("/commitments")
async def create_project_commitment_request(
    request: ProjectCommitmentCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.create_commitment_request(
        exploration_id=request.exploration_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        comments=request.comments,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.post("/commitments/roster")
async def confirm_team_commitment_roster(
    request: TeamCommitmentRosterConfirmRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.confirm_team_commitment_roster(
        team_id=request.team_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        comments=request.comments,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.post("/explorations/{exploration_id:int}/cancel")
async def cancel_marketplace_exploration(
    exploration_id: int,
    request: Optional[MarketplaceExplorationCancelRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.cancel_exploration(
        exploration_id=exploration_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        reason=request.reason if request else None,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.get("/commitments/pending")
async def get_pending_project_commitments(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=200),
    search: Optional[str] = Query(None, max_length=200),
    course_id: Optional[int] = Query(None, ge=1),
    department_id: Optional[int] = Query(None, ge=1),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.list_commitment_requests(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        page=page,
        page_size=page_size,
        search=search,
        course_id=course_id,
        department_id=department_id,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result


@router.post("/commitments/{commitment_request_id:int}/decision")
async def decide_project_commitment_request(
    commitment_request_id: int,
    request: ProjectCommitmentDecisionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = marketplace_business.decide_commitment_request(
        commitment_request_id=commitment_request_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        decision=request.decision,
        decision_route=request.decision_route,
        target_course_id=request.target_course_id,
        member_enrollment_routes=request.member_enrollment_routes,
        comments=request.comments,
    )
    if not result.get("success"):
        raise HTTPException(status_code=_status_for_message(result.get("message", "")), detail=result.get("message"))
    return result
