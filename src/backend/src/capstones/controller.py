from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from .capstones_bl import CapstonesBusinessLogic
from ..auth.dependencies import get_current_user
from ..config.database import supabase
from ..workflow.workflow_utils import (
    get_user_course_fk,
    is_user_team_participant,
)

router = APIRouter(prefix="/capstones", tags=["capstones"])
capstones_business = CapstonesBusinessLogic()


class CreateCapstoneRequest(BaseModel):
    user_id: int
    title: str = Field(..., min_length=1, max_length=200)
    course_id: int
    submission_track: str = Field(default="home_course", max_length=32)
    team_id: Optional[int] = None
    description: Optional[str] = Field(default=None, max_length=5000)
    project_start_date: Optional[str] = Field(default=None, max_length=100)
    project_disciplines: Optional[list[str]] = Field(default=None, max_length=25)
    department_ids: Optional[list[int]] = Field(default=None, max_length=25)
    skills_required: Optional[list[str]] = Field(default=None, max_length=50)
    problem_area: Optional[str] = Field(default=None, max_length=1000)
    main_objectives: Optional[str] = Field(default=None, max_length=3000)
    scope_of_work: Optional[str] = Field(default=None, max_length=3000)
    deliverables: Optional[str] = Field(default=None, max_length=3000)
    meeting_frequency: Optional[str] = Field(default=None, max_length=100)
    uw_resources: Optional[str] = Field(default=None, max_length=2000)
    org_resources: Optional[str] = Field(default=None, max_length=2000)
    other_resources: Optional[str] = Field(default=None, max_length=2000)
    how_heard_about_capstone: Optional[str] = Field(default=None, max_length=1000)
    deliverable_types: Optional[list[str]] = Field(default=None, max_length=25)
    proposed_team_members: Optional[str] = Field(default=None, max_length=2000)
    success_criteria: Optional[str] = Field(default=None, max_length=3000)
    validation_plan: Optional[str] = Field(default=None, max_length=3000)
    stakeholders: Optional[str] = Field(default=None, max_length=2000)
    risks_constraints: Optional[str] = Field(default=None, max_length=3000)
    public_evaluation_acknowledged: bool = False
    ip_acknowledged: bool = False
    confidentiality_acknowledged: bool = False
    ecosystem_id: Optional[int] = None
    organization_name: Optional[str] = Field(default=None, max_length=200)
    primary_contact: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=320)
    phone: Optional[str] = Field(default=None, max_length=50)
    website: Optional[str] = Field(default=None, max_length=500)
    organization_description: Optional[str] = Field(default=None, max_length=5000)
    organization_size: Optional[str] = Field(default=None, max_length=100)
    sector: Optional[str] = Field(default=None, max_length=200)
    partner_opportunity_id: Optional[int] = None
    external_partner_name: Optional[str] = Field(default=None, max_length=200)
    external_partner_organization: Optional[str] = Field(default=None, max_length=200)
    external_partner_email: Optional[str] = Field(default=None, max_length=320)
    external_partner_website: Optional[str] = Field(default=None, max_length=500)
    external_partner_notes: Optional[str] = Field(default=None, max_length=2000)
    external_partner_confirmed: bool = False
    finalization_override: bool = False
    finalization_override_reason: Optional[str] = Field(default=None, max_length=2000)


class RequestChangesRequest(BaseModel):
    comments: str = Field(..., min_length=1, max_length=2000)


class RejectCapstoneRequest(BaseModel):
    comments: Optional[str] = Field(default=None, max_length=2000)


class ApproveCapstoneRequest(BaseModel):
    comments: Optional[str] = Field(default=None, max_length=2000)


class AdminRouteCapstoneCourseRequest(BaseModel):
    target_course_id: int
    comments: Optional[str] = Field(default=None, max_length=2000)


class ProjectSubmissionEnrollmentRequest(BaseModel):
    target_course_id: int
    comments: Optional[str] = Field(default=None, max_length=2000)


class ProjectSubmissionEnrollmentDecisionRequest(BaseModel):
    decision: str = Field(..., min_length=1, max_length=20)
    target_course_id: Optional[int] = None
    comments: Optional[str] = Field(default=None, max_length=2000)


class MentorRequestCreateRequest(BaseModel):
    mentor_id: int
    message: Optional[str] = Field(default=None, max_length=2000)


class MentorOfferCreateRequest(BaseModel):
    message: Optional[str] = Field(default=None, max_length=2000)


class MentorProfileRequest(BaseModel):
    mentor_id: Optional[int] = None
    display_name: Optional[str] = Field(default=None, max_length=200)
    primary_department_id: Optional[int] = None
    department_ids: Optional[list[int]] = Field(default=None, max_length=25)
    affiliation: Optional[str] = Field(default=None, max_length=300)
    bio: Optional[str] = Field(default=None, max_length=5000)
    availability_terms: Optional[list[str]] = Field(default=None, max_length=3)
    expertise_tags: Optional[list[str]] = Field(default=None, max_length=50)
    max_active_projects: Optional[int] = Field(default=None, ge=0, le=25)


class MentorDecisionRequest(BaseModel):
    decision: str = Field(..., min_length=1, max_length=20)
    response_note: Optional[str] = Field(default=None, max_length=2000)


class MentorCancelRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=2000)


class DeleteCapstoneRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


class CompleteCapstoneRequest(BaseModel):
    notes: str = Field(..., min_length=1, max_length=2000)
    completed_term: Optional[str] = Field(default=None, max_length=100)


class ResubmitCapstoneRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    project_start_date: Optional[str] = Field(default=None, max_length=100)
    project_disciplines: Optional[list[str]] = Field(default=None, max_length=25)
    department_ids: Optional[list[int]] = Field(default=None, max_length=25)
    skills_required: Optional[list[str]] = Field(default=None, max_length=50)
    problem_area: Optional[str] = Field(default=None, max_length=1000)
    main_objectives: Optional[str] = Field(default=None, max_length=3000)
    scope_of_work: Optional[str] = Field(default=None, max_length=3000)
    deliverables: Optional[str] = Field(default=None, max_length=3000)
    meeting_frequency: Optional[str] = Field(default=None, max_length=100)
    uw_resources: Optional[str] = Field(default=None, max_length=2000)
    org_resources: Optional[str] = Field(default=None, max_length=2000)
    other_resources: Optional[str] = Field(default=None, max_length=2000)
    how_heard_about_capstone: Optional[str] = Field(default=None, max_length=1000)
    deliverable_types: Optional[list[str]] = Field(default=None, max_length=25)
    proposed_team_members: Optional[str] = Field(default=None, max_length=2000)
    success_criteria: Optional[str] = Field(default=None, max_length=3000)
    validation_plan: Optional[str] = Field(default=None, max_length=3000)
    stakeholders: Optional[str] = Field(default=None, max_length=2000)
    risks_constraints: Optional[str] = Field(default=None, max_length=3000)
    public_evaluation_acknowledged: bool = False
    ip_acknowledged: bool = False
    confidentiality_acknowledged: bool = False
    ecosystem_id: Optional[int] = None
    organization_name: Optional[str] = Field(default=None, max_length=200)
    primary_contact: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=320)
    phone: Optional[str] = Field(default=None, max_length=50)
    website: Optional[str] = Field(default=None, max_length=500)
    organization_description: Optional[str] = Field(default=None, max_length=5000)
    organization_size: Optional[str] = Field(default=None, max_length=100)
    sector: Optional[str] = Field(default=None, max_length=200)
    partner_opportunity_id: Optional[int] = None
    external_partner_name: Optional[str] = Field(default=None, max_length=200)
    external_partner_organization: Optional[str] = Field(default=None, max_length=200)
    external_partner_email: Optional[str] = Field(default=None, max_length=320)
    external_partner_website: Optional[str] = Field(default=None, max_length=500)
    external_partner_notes: Optional[str] = Field(default=None, max_length=2000)
    external_partner_confirmed: bool = False
    change_summary: str = Field(..., min_length=1, max_length=2000)


class AdminPastCapstoneRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = Field(default=None, max_length=10000)
    department: str = Field(..., min_length=1, max_length=1000)
    year: str = Field(..., min_length=4, max_length=20)
    students: Optional[list[str]] = Field(default=None, max_length=100)
    source_course_id: Optional[int] = None
    reason: str = Field(..., min_length=1, max_length=2000)


class AdminImportPastCapstonesRequest(BaseModel):
    csv_text: str = Field(..., min_length=1, max_length=2_000_000)


class AdminDeletePastCapstoneRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


class PastCapstoneShortlistRequest(BaseModel):
    source_type: str = Field(..., min_length=1, max_length=32)
    source_id: int = Field(..., ge=1)


def _require_admin(current_user: Dict[str, Any]) -> None:
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _require_course_router(current_user: Dict[str, Any]) -> None:
    if (current_user.get("role") or "").lower() not in {"admin", "academic_advisor", "enrollment_operator"}:
        raise HTTPException(status_code=403, detail="Course routing access required")


def _status_for_admin_message(message: str) -> int:
    lowered = message.lower()
    if "not found" in lowered:
        return 404
    if (
        "admin access required" in lowered
        or "course routing access required" in lowered
        or "access required" in lowered
        or "forbidden" in lowered
        or "only the student" in lowered
    ):
        return 403
    return 400


def _normalize_submission_track(value: Optional[str]) -> str:
    normalized = (value or "home_course").strip().lower()
    if normalized not in {"home_course", "interdisciplinary"}:
        raise HTTPException(status_code=400, detail="Unsupported capstone submission track")
    return normalized


def _require_proposal_quality(request: CreateCapstoneRequest | ResubmitCapstoneRequest) -> None:
    required_text_fields = {
        "success_criteria": "Success criteria are required.",
        "validation_plan": "Validation plan is required.",
        "stakeholders": "Stakeholders/users are required.",
        "risks_constraints": "Risks, constraints, ethics, safety, or privacy considerations are required.",
    }
    for field_name, message in required_text_fields.items():
        value = getattr(request, field_name, None)
        if not isinstance(value, str) or not value.strip():
            raise HTTPException(status_code=400, detail=message)

    required_acknowledgements = {
        "public_evaluation_acknowledged": "Public evaluation acknowledgement is required.",
        "ip_acknowledged": "IP policy acknowledgement is required.",
        "confidentiality_acknowledged": "Confidentiality/NDA acknowledgement is required.",
    }
    for field_name, message in required_acknowledgements.items():
        if getattr(request, field_name, False) is not True:
            raise HTTPException(status_code=400, detail=message)


def _current_marketplace_term() -> Optional[str]:
    try:
        settings = (
            supabase.table("marketplace_settings")
            .select("current_term")
            .eq("setting_id", 1)
            .limit(1)
            .execute()
            .data
            or [None]
        )[0]
        term = (settings or {}).get("current_term")
        return str(term).strip() if term else None
    except Exception:
        return None


def _assert_course_ready_for_submission(course_id: int, label: str = "Selected course") -> None:
    try:
        supabase.rpc(
            "watmatch_assert_course_ready_for_review",
            {"p_course_id": int(course_id), "p_label": label},
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{label} is not available for submission in the current marketplace term.",
        ) from exc


def _effective_course_routing_kind(course_id: int) -> Optional[str]:
    result = (
        supabase.table("courses")
        .select("course_id,routing_kind,retired_for_routing")
        .eq("course_id", course_id)
        .limit(1)
        .execute()
    )
    course = (result.data or [None])[0]
    if not course or course.get("retired_for_routing") is True:
        return None

    routing_kind = course.get("routing_kind")
    current_term = _current_marketplace_term()
    if current_term:
        offering_result = (
            supabase.table("course_offerings")
            .select("course_offering_id,routing_kind_override,status")
            .eq("course_fk", course_id)
            .eq("term", current_term)
            .eq("status", "active")
            .order("course_offering_id", desc=True)
            .limit(1)
            .execute()
        )
        offering = (offering_result.data or [None])[0]
        if offering and offering.get("routing_kind_override"):
            return offering.get("routing_kind_override")

    return routing_kind


def _require_active_interdisciplinary_course(course_id: int) -> None:
    _assert_course_ready_for_submission(course_id, "Selected interdisciplinary course")
    if _effective_course_routing_kind(course_id) != "interdisciplinary":
        raise HTTPException(status_code=400, detail="Selected course is not an active interdisciplinary course")


def _require_active_staffed_course(course_id: int) -> None:
    _assert_course_ready_for_submission(course_id, "Selected course")


def _is_publicly_recruiting(capstone: Dict[str, Any]) -> bool:
    return (
        capstone.get("archived") is not True
        and (
            capstone.get("can_express_interest") is True
            or (capstone.get("public_status") or "").lower() == "recruiting"
            or (capstone.get("status") or "").lower() == "approved_recruiting"
        )
    )


def _can_offer_mentor_support_publicly(capstone: Dict[str, Any]) -> bool:
    if capstone.get("archived") is True:
        return False
    raw_status = (capstone.get("status") or "").lower()
    if raw_status == "complete":
        return False
    if _is_publicly_recruiting(capstone):
        return True
    return (
        bool(capstone.get("carry_over_read_only"))
        and raw_status in {"approved_recruiting", "approved"}
        and capstone.get("closeout_decision") in {"carry_over_read_only", "continue_to_course"}
    )


def _public_support_summary(summary: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    public_summary = dict(summary or {})
    accepted_mentor = public_summary.get("accepted_mentor")
    if isinstance(accepted_mentor, dict):
        public_summary["accepted_mentor"] = {
            "accepted": True,
            "accepted_at": accepted_mentor.get("accepted_at"),
        }

    external_partner = public_summary.get("external_partner")
    if isinstance(external_partner, dict):
        public_summary["external_partner"] = {
            "name": external_partner.get("name"),
            "organization": external_partner.get("organization"),
            "website": external_partner.get("website"),
        }
    return public_summary


def _current_marketplace_phase() -> str:
    try:
        settings = (
            supabase.table("marketplace_settings")
            .select("phase")
            .eq("setting_id", 1)
            .limit(1)
            .execute()
            .data
            or [None]
        )[0]
        phase = ((settings or {}).get("phase") or "exploration").lower()
        return phase
    except Exception:
        return "exploration"


def _effective_marketplace_phase_for_course(course_id: Optional[int]) -> str:
    if not course_id:
        return _current_marketplace_phase()
    try:
        response = (
            supabase.rpc(
                "watmatch_effective_marketplace_phase_for_course",
                {"p_course_id": int(course_id)},
            )
            .execute()
        )
        phase = str(response.data or _current_marketplace_phase()).lower()
        return "finalization" if phase == "locked" else phase
    except Exception:
        return _current_marketplace_phase()


def _public_capstone_payload(capstone: Dict[str, Any], marketplace_phase: Optional[str] = None) -> Dict[str, Any]:
    raw_phase = capstone.get("marketplace_phase") or marketplace_phase or _current_marketplace_phase()
    phase = raw_phase
    lifecycle_closed = bool(capstone.get("carry_over_read_only")) or capstone.get("closeout_decision") is not None
    recruiting = bool(capstone.get("can_express_interest", _is_publicly_recruiting(capstone))) and not lifecycle_closed
    offerable_for_mentor = _can_offer_mentor_support_publicly(capstone)
    action_state = capstone.get("marketplace_action_state")
    if not action_state:
        action_state = "read_only" if lifecycle_closed else ("actionable" if recruiting else capstone.get("public_status") or capstone.get("status") or "read_only")
    read_only_reason = capstone.get("read_only_reason")
    if recruiting and phase != "exploration":
        read_only_reason = (
            "This project is in commitment. Existing explorations can commit, but new marketplace activity is closed."
            if phase == "commitment"
            else "This project is in finalization and is not accepting new marketplace activity."
        )
    return {
        "capstone_id": capstone.get("capstone_id"),
        "title": capstone.get("title"),
        "description": capstone.get("description"),
        "public_status": capstone.get("public_status") or "recruiting",
        "status": capstone.get("status"),
        "disciplines": capstone.get("disciplines") or [],
        "department_ids": capstone.get("department_ids") or [],
        "departments": capstone.get("departments") or [],
        "skills": capstone.get("skills") or [],
        "created_at": capstone.get("created_at"),
        "completed_at": capstone.get("completed_at"),
        "completed_by_fk": capstone.get("completed_by_fk"),
        "completed_term": capstone.get("completed_term"),
        "completion_notes": capstone.get("completion_notes"),
        "course_fk": capstone.get("course_fk"),
        "course": capstone.get("course"),
        "coordinating_course": capstone.get("course"),
        "ecosystem_fk": capstone.get("ecosystem_fk"),
        "ecosystem_id": capstone.get("ecosystem_fk"),
        "ecosystem": capstone.get("ecosystem") or ((capstone.get("course") or {}).get("ecosystem") if isinstance(capstone.get("course"), dict) else None),
        "marketplace_phase": phase,
        "marketplace_phase_context": capstone.get("marketplace_phase_context"),
        "marketplace_action_state": action_state,
        "read_only_reason": read_only_reason,
        "closeout_decision": capstone.get("closeout_decision"),
        "closeout_decided_at": capstone.get("closeout_decided_at"),
        "closeout_applied_at": capstone.get("closeout_applied_at"),
        "continued_to_course_fk": capstone.get("continued_to_course_fk"),
        "continued_to_term": capstone.get("continued_to_term"),
        "published_past_capstone_fk": capstone.get("published_past_capstone_fk"),
        "published_watmatch_past_capstone_fk": capstone.get("published_watmatch_past_capstone_fk"),
        "carry_over_read_only": bool(capstone.get("carry_over_read_only")),
        "can_shortlist": recruiting and phase == "exploration",
        "can_express_interest": recruiting and phase == "exploration",
        "can_invite": recruiting and phase == "exploration",
        "can_offer_mentor": offerable_for_mentor,
        "can_offer_mentor_support": offerable_for_mentor,
        "can_commit": recruiting and phase in {"exploration", "commitment"},
        "external_partner_name": capstone.get("external_partner_name"),
        "external_partner_organization": capstone.get("external_partner_organization"),
        "external_partner_website": capstone.get("external_partner_website"),
        "support_summary": _public_support_summary(capstone.get("support_summary")),
    }


def _get_team_for_capstone(capstone: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    team_fk = capstone.get("team_fk")
    if team_fk is None:
        return None
    team_res = (
        supabase.table("teams")
        .select("*")
        .eq("team_id", team_fk)
        .limit(1)
        .execute()
    )
    return (team_res.data or [None])[0]


def _can_access_full_capstone(capstone: Dict[str, Any], current_user: Dict[str, Any]) -> bool:
    role = (current_user.get("role") or "").lower()
    if role == "admin":
        return True

    user_id = current_user.get("user_id")
    if not user_id:
        return False

    team = _get_team_for_capstone(capstone)
    if role == "student":
        if team and team.get("team_id") is not None:
            return is_user_team_participant(int(user_id), int(team["team_id"]), fallback_team=team)
        return int(capstone.get("user_fk") or 0) == int(user_id)

    if role == "instructor":
        instructor_course_fk = get_user_course_fk(int(user_id))
        if instructor_course_fk is None:
            return False
        instructor_course_id = int(instructor_course_fk)
        approval_scope = (
            supabase.table("capstone_course_approvals")
            .select("capstone_fk")
            .eq("capstone_fk", capstone.get("capstone_id"))
            .eq("course_fk", instructor_course_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if team and team.get("team_id") is not None:
            if team.get("course_fk") is not None and int(team["course_fk"]) == instructor_course_id:
                return True
            return bool(approval_scope)
        if capstone.get("course_fk") is not None and int(capstone["course_fk"]) == instructor_course_id:
            return True
        return bool(approval_scope)

    return False


@router.post("/create")
async def create_capstone(
    request: CreateCapstoneRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    actor_role = (current_user.get("role") or "").lower()
    marketplace_phase = _effective_marketplace_phase_for_course(request.course_id)
    admin_override = bool(
        request.finalization_override
        and actor_role == "admin"
        and marketplace_phase == "finalization"
    )
    if marketplace_phase == "finalization" and not admin_override:
        raise HTTPException(
            status_code=400,
            detail="Project submission is closed during finalization. Contact an admin if this is an exception.",
        )
    if actor_role not in {"student", "admin"}:
        raise HTTPException(status_code=403, detail="Only students can create capstones")
    if actor_role == "admin" and not admin_override:
        raise HTTPException(
            status_code=403,
            detail="Admin project creation requires an explicit finalization override",
        )
    finalization_override_reason = (
        request.finalization_override_reason.strip()
        if isinstance(request.finalization_override_reason, str)
        else ""
    )
    if admin_override and not finalization_override_reason:
        raise HTTPException(
            status_code=400,
            detail="Admin finalization override requires an audit reason",
        )

    target_user: Dict[str, Any]
    if actor_role == "student":
        if current_user.get("user_id") != request.user_id:
            raise HTTPException(status_code=403, detail="You can only create capstones for yourself")
        target_user = current_user
    else:
        target_rows = (
            supabase.table("users")
            .select("user_id,role,active,course_fk")
            .eq("user_id", request.user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        target_user = target_rows[0] if target_rows else {}
        if not target_user:
            raise HTTPException(status_code=404, detail="Target student not found")
        if (target_user.get("role") or "").lower() != "student" or target_user.get("active") is not True:
            raise HTTPException(status_code=400, detail="Target user must be an active student")

    if target_user.get("course_fk") is None and not admin_override:
        raise HTTPException(status_code=400, detail="Your account must be assigned to a course before submitting a capstone")
    submission_track = _normalize_submission_track(request.submission_track)
    if (
        not admin_override
        and submission_track == "home_course"
        and int(request.course_id) != int(target_user.get("course_fk"))
    ):
        raise HTTPException(status_code=400, detail="Submitted course does not match your assigned course")
    if admin_override:
        _require_active_staffed_course(int(request.course_id))
    elif submission_track == "interdisciplinary":
        _require_active_interdisciplinary_course(int(request.course_id))
    _require_proposal_quality(request)

    if request.team_id is not None:
        result = capstones_business.create_capstone_for_existing_team(
            user_id=request.user_id,
            team_id=request.team_id,
            course_id=request.course_id,
            title=request.title,
            description=request.description,
            project_start_date=request.project_start_date,
            project_disciplines=request.project_disciplines,
            department_ids=request.department_ids,
            skills_required=request.skills_required,
            problem_area=request.problem_area,
            main_objectives=request.main_objectives,
            scope_of_work=request.scope_of_work,
            deliverables=request.deliverables,
            meeting_frequency=request.meeting_frequency,
            uw_resources=request.uw_resources,
            org_resources=request.org_resources,
            other_resources=request.other_resources,
            how_heard_about_capstone=request.how_heard_about_capstone,
            deliverable_types=request.deliverable_types,
            proposed_team_members=request.proposed_team_members,
            success_criteria=request.success_criteria,
            validation_plan=request.validation_plan,
            stakeholders=request.stakeholders,
            risks_constraints=request.risks_constraints,
            public_evaluation_acknowledged=request.public_evaluation_acknowledged,
            ip_acknowledged=request.ip_acknowledged,
            confidentiality_acknowledged=request.confidentiality_acknowledged,
            ecosystem_id=request.ecosystem_id,
            organization_name=request.organization_name,
            primary_contact=request.primary_contact,
            email=request.email,
            phone=request.phone,
            website=request.website,
            organization_description=request.organization_description,
            organization_size=request.organization_size,
            sector=request.sector,
            partner_opportunity_id=request.partner_opportunity_id,
            external_partner_name=request.external_partner_name,
            external_partner_organization=request.external_partner_organization,
            external_partner_email=request.external_partner_email,
            external_partner_website=request.external_partner_website,
            external_partner_notes=request.external_partner_notes,
            external_partner_confirmed=request.external_partner_confirmed,
            submission_track=submission_track,
            requested_course_id=request.course_id,
            admin_finalization_override=admin_override,
            admin_finalization_override_actor_id=current_user.get("user_id") if admin_override else None,
            admin_finalization_override_reason=finalization_override_reason if admin_override else None,
        )
    else:
        result = capstones_business.create_capstone_with_team(
            user_id=request.user_id,
            title=request.title,
            course_id=request.course_id,
            description=request.description,
            project_start_date=request.project_start_date,
            project_disciplines=request.project_disciplines,
            department_ids=request.department_ids,
            skills_required=request.skills_required,
            problem_area=request.problem_area,
            main_objectives=request.main_objectives,
            scope_of_work=request.scope_of_work,
            deliverables=request.deliverables,
            meeting_frequency=request.meeting_frequency,
            uw_resources=request.uw_resources,
            org_resources=request.org_resources,
            other_resources=request.other_resources,
            how_heard_about_capstone=request.how_heard_about_capstone,
            deliverable_types=request.deliverable_types,
            proposed_team_members=request.proposed_team_members,
            success_criteria=request.success_criteria,
            validation_plan=request.validation_plan,
            stakeholders=request.stakeholders,
            risks_constraints=request.risks_constraints,
            public_evaluation_acknowledged=request.public_evaluation_acknowledged,
            ip_acknowledged=request.ip_acknowledged,
            confidentiality_acknowledged=request.confidentiality_acknowledged,
            ecosystem_id=request.ecosystem_id,
            organization_name=request.organization_name,
            primary_contact=request.primary_contact,
            email=request.email,
            phone=request.phone,
            website=request.website,
            organization_description=request.organization_description,
            organization_size=request.organization_size,
            sector=request.sector,
            partner_opportunity_id=request.partner_opportunity_id,
            external_partner_name=request.external_partner_name,
            external_partner_organization=request.external_partner_organization,
            external_partner_email=request.external_partner_email,
            external_partner_website=request.external_partner_website,
            external_partner_notes=request.external_partner_notes,
            external_partner_confirmed=request.external_partner_confirmed,
            submission_track=submission_track,
            requested_course_id=request.course_id,
            admin_finalization_override=admin_override,
            admin_finalization_override_actor_id=current_user.get("user_id") if admin_override else None,
            admin_finalization_override_reason=finalization_override_reason if admin_override else None,
        )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.get("/past/shortlists/me")
async def get_my_past_capstone_shortlists(
    limit: int = Query(6, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    result = capstones_business.list_student_past_capstone_shortlists(
        student_id=int(current_user["user_id"]),
        limit=limit,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/past/shortlists")
async def save_past_capstone_shortlist(
    request: PastCapstoneShortlistRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    result = capstones_business.save_past_capstone_shortlist(
        student_id=int(current_user["user_id"]),
        source_type=request.source_type,
        source_id=request.source_id,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.delete("/past/shortlists")
async def delete_past_capstone_shortlist(
    request: PastCapstoneShortlistRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "student":
        raise HTTPException(status_code=403, detail="Student access required")
    result = capstones_business.delete_past_capstone_shortlist(
        student_id=int(current_user["user_id"]),
        source_type=request.source_type,
        source_id=request.source_id,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.get("/past")
async def get_past_capstones(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    saved_only: bool = Query(False),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    student_id = int(current_user["user_id"]) if (current_user.get("role") or "").lower() == "student" else None
    if saved_only and student_id is None:
        raise HTTPException(status_code=403, detail="Student access required to filter saved past capstones")
    result = capstones_business.get_past_capstones(
        page=page,
        page_size=page_size,
        search=search,
        department=department,
        year=year,
        student_id=student_id,
        saved_only=saved_only,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/past/watmatch")
async def get_past_watmatch_capstones(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    saved_only: bool = Query(False),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    student_id = int(current_user["user_id"]) if (current_user.get("role") or "").lower() == "student" else None
    if saved_only and student_id is None:
        raise HTTPException(status_code=403, detail="Student access required to filter saved past capstones")
    result = capstones_business.get_past_watmatch_capstones(
        page=page,
        page_size=page_size,
        search=search,
        department=department,
        year=year,
        student_id=student_id,
        saved_only=saved_only,
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/past/watmatch/metadata")
async def get_past_watmatch_capstones_metadata() -> Dict[str, Any]:
    """
    Return complete dropdown metadata for WatMatch-native completed capstones.
    """
    result = capstones_business.get_past_watmatch_capstone_metadata()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/past/metadata")
async def get_past_capstones_metadata() -> Dict[str, Any]:
    """
    Return complete dropdown metadata (all departments, years, and source courses)
    independent of current page size.
    """
    result = capstones_business.get_past_capstone_metadata()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/admin/past")
async def create_past_capstone_for_admin(
    request: AdminPastCapstoneRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    if not request.reason.strip():
        raise HTTPException(status_code=400, detail="An audit reason is required for manual past capstone changes")
    result = capstones_business.upsert_past_capstone(
        actor_id=int(current_user["user_id"]),
        title=request.title,
        description=request.description,
        department=request.department,
        year=request.year,
        students=request.students,
        source_course_id=request.source_course_id,
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.patch("/admin/past/{past_capstone_id}")
async def update_past_capstone_for_admin(
    past_capstone_id: int,
    request: AdminPastCapstoneRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    if not request.reason.strip():
        raise HTTPException(status_code=400, detail="An audit reason is required for manual past capstone changes")
    result = capstones_business.upsert_past_capstone(
        actor_id=int(current_user["user_id"]),
        past_capstone_id=past_capstone_id,
        title=request.title,
        description=request.description,
        department=request.department,
        year=request.year,
        students=request.students,
        source_course_id=request.source_course_id,
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/admin/past/import")
async def import_past_capstones_for_admin(
    request: AdminImportPastCapstonesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = capstones_business.import_past_capstones_csv(
        csv_text=request.csv_text,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/admin/past/{past_capstone_id}/delete")
async def delete_past_capstone_for_admin(
    past_capstone_id: int,
    request: AdminDeletePastCapstoneRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    if not request.reason.strip():
        raise HTTPException(status_code=400, detail="An audit reason is required when deleting a past capstone")
    result = capstones_business.delete_past_capstone(
        past_capstone_id=past_capstone_id,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.get("/review")
async def get_capstones_for_review(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") not in {"instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Only instructors/admins can access review queue")
    if (page is None) != (page_size is None):
        raise HTTPException(
            status_code=400,
            detail="Both 'page' and 'page_size' must be provided together for pagination"
        )
    result = capstones_business.get_capstones_pending_review(
        page=page,
        page_size=page_size,
        actor_role=current_user.get("role"),
        actor_id=current_user.get("user_id"),
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/course-routing")
@router.get("/admin/course-routing")
async def get_capstones_for_course_routing(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=200),
    course_id: Optional[int] = Query(None, ge=1),
    department_id: Optional[int] = Query(None, ge=1),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    _require_course_router(current_user)
    if (page is None) != (page_size is None):
        raise HTTPException(
            status_code=400,
            detail="Both 'page' and 'page_size' must be provided together for pagination"
        )
    result = capstones_business.get_capstones_pending_course_routing(
        page=page,
        page_size=page_size,
        actor_role=current_user.get("role"),
        actor_id=current_user.get("user_id"),
        search=search,
        course_id=course_id,
        department_id=department_id,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/{capstone_id}/route-course")
async def route_capstone_course(
    capstone_id: int,
    request: AdminRouteCapstoneCourseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    _require_course_router(current_user)
    result = capstones_business.route_capstone_course(
        capstone_id=capstone_id,
        target_course_id=request.target_course_id,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        comments=request.comments,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/submission-enrollment-requests")
async def create_project_submission_enrollment_request(
    request: ProjectSubmissionEnrollmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "student":
        raise HTTPException(status_code=403, detail="Only students can request course enrollment for project submission")
    if _effective_marketplace_phase_for_course(request.target_course_id) == "finalization":
        raise HTTPException(
            status_code=400,
            detail="Project submission enrollment requests are closed during finalization. Contact an admin if this is an exception.",
        )
    result = capstones_business.create_project_submission_enrollment_request(
        student_id=int(current_user["user_id"]),
        target_course_id=request.target_course_id,
        comments=request.comments,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.get("/submission-enrollment-requests")
@router.get("/admin/submission-enrollment-requests")
async def get_project_submission_enrollment_requests(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=200),
    course_id: Optional[int] = Query(None, ge=1),
    department_id: Optional[int] = Query(None, ge=1),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    _require_course_router(current_user)
    if (page is None) != (page_size is None):
        raise HTTPException(
            status_code=400,
            detail="Both 'page' and 'page_size' must be provided together for pagination"
        )
    result = capstones_business.get_project_submission_enrollment_requests(
        page=page,
        page_size=page_size,
        actor_role=current_user.get("role"),
        actor_id=current_user.get("user_id"),
        search=search,
        course_id=course_id,
        department_id=department_id,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/submission-enrollment-requests/{request_id}/decision")
@router.post("/admin/submission-enrollment-requests/{request_id}/decision")
async def decide_project_submission_enrollment_request(
    request_id: int,
    request: ProjectSubmissionEnrollmentDecisionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    _require_course_router(current_user)
    normalized_decision = request.decision.strip().lower()
    if normalized_decision not in {"approve", "reject", "cancel"}:
        raise HTTPException(status_code=400, detail="Decision must be approve, reject, or cancel")
    if normalized_decision == "approve" and request.target_course_id is None:
        raise HTTPException(status_code=400, detail="Target course is required to approve enrollment")
    result = capstones_business.decide_project_submission_enrollment_request(
        request_id=request_id,
        decision=normalized_decision,
        target_course_id=request.target_course_id,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        comments=request.comments,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.get("/all")
async def get_public_capstones(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (page is None) != (page_size is None):
        raise HTTPException(
            status_code=400,
            detail="Both 'page' and 'page_size' must be provided together for pagination"
        )

    base_result = capstones_business.get_public_recruiting_capstones(
        page=page,
        page_size=page_size,
        search=search,
        department=department,
        year=year,
    )

    if not base_result["success"]:
        raise HTTPException(status_code=500, detail=base_result["message"])

    rows = base_result.get("data") or []
    if page is not None and page_size is not None:
        return {
            "success": True,
            "message": f"Retrieved {len(rows)} capstone(s)",
            "data": [_public_capstone_payload(row) for row in rows],
            "page": base_result.get("page", page),
            "page_size": base_result.get("page_size", page_size),
            "total": base_result.get("total", len(rows)),
            "total_pages": base_result.get("total_pages", 1),
        }

    return {
        "success": True,
        "message": f"Retrieved {len(rows)} capstone(s)",
        "data": [_public_capstone_payload(row) for row in rows],
    }


@router.get("/all/metadata")
async def get_public_capstone_metadata(
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.get_public_recruiting_metadata()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/all/finalized")
async def get_finalized_capstones(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (page is None) != (page_size is None):
        raise HTTPException(
            status_code=400,
            detail="Both 'page' and 'page_size' must be provided together for pagination"
        )

    base_result = capstones_business.get_public_finalized_capstones(
        page=page,
        page_size=page_size,
        search=search,
        department=department,
        year=year,
    )

    if not base_result["success"]:
        raise HTTPException(status_code=500, detail=base_result["message"])

    rows = base_result.get("data") or []
    if page is not None and page_size is not None:
        return {
            "success": True,
            "message": f"Retrieved {len(rows)} finalized capstone(s)",
            "data": [_public_capstone_payload(row) for row in rows],
            "page": base_result.get("page", page),
            "page_size": base_result.get("page_size", page_size),
            "total": base_result.get("total", len(rows)),
            "total_pages": base_result.get("total_pages", 1),
        }

    return {
        "success": True,
        "message": f"Retrieved {len(rows)} finalized capstone(s)",
        "data": [_public_capstone_payload(row) for row in rows],
    }


@router.get("/all/finalized/metadata")
async def get_finalized_capstone_metadata(
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.get_public_finalized_metadata()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/mentors/active")
async def list_active_mentors(
    search: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    availability_term: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.list_active_mentors(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        search=search,
        department_id=department_id,
        availability_term=availability_term,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.put("/mentor/profile")
async def upsert_my_mentor_profile(
    request: MentorProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "mentor":
        raise HTTPException(status_code=403, detail="Mentor access required")
    result = capstones_business.upsert_mentor_profile(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        mentor_id=int(current_user["user_id"]),
        display_name=request.display_name,
        primary_department_id=request.primary_department_id,
        department_ids=request.department_ids,
        affiliation=request.affiliation,
        bio=request.bio,
        availability_terms=request.availability_terms,
        expertise_tags=request.expertise_tags,
        max_active_projects=request.max_active_projects,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.get("/mentor/dashboard")
async def get_mentor_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "mentor":
        raise HTTPException(status_code=403, detail="Mentor access required")
    result = capstones_business.get_mentor_dashboard(
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.get("/{capstone_id:int}/mentor-requests")
async def get_capstone_mentor_requests(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.get_capstone_mentor_requests(
        capstone_id=capstone_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/{capstone_id:int}/mentor-requests")
async def create_mentor_request(
    capstone_id: int,
    request: MentorRequestCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.create_mentor_request(
        capstone_id=capstone_id,
        mentor_id=request.mentor_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        message=request.message,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/{capstone_id:int}/mentor-offer")
async def create_mentor_offer(
    capstone_id: int,
    request: MentorOfferCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if (current_user.get("role") or "").lower() != "mentor":
        raise HTTPException(status_code=403, detail="Mentor access required")
    result = capstones_business.create_mentor_offer(
        capstone_id=capstone_id,
        actor_id=int(current_user["user_id"]),
        message=request.message,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/mentor-requests/{request_id:int}/decision")
async def decide_mentor_request(
    request_id: int,
    request: MentorDecisionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.decide_mentor_request(
        request_id=request_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        decision=request.decision,
        response_note=request.response_note,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/mentor-offers/{request_id:int}/decision")
async def decide_mentor_offer(
    request_id: int,
    request: MentorDecisionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.decide_mentor_offer(
        request_id=request_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        decision=request.decision,
        response_note=request.response_note,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/mentor-requests/{request_id:int}/cancel")
async def cancel_mentor_request(
    request_id: int,
    request: Optional[MentorCancelRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.cancel_mentor_request(
        request_id=request_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
        reason=request.reason if request else None,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_admin_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.get("/{capstone_id:int}/full")
async def get_full_capstone_by_id(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.get_capstone_by_id(capstone_id)
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    capstone = result.get("data")
    if not capstone or not _can_access_full_capstone(capstone, current_user):
        raise HTTPException(status_code=403, detail="Forbidden for this capstone")
    return result


@router.get("/{capstone_id:int}")
async def get_capstone_by_id(
    capstone_id: int,
    _current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = capstones_business.get_capstone_by_id(capstone_id)
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    capstone = result.get("data") or {}
    if not _is_publicly_recruiting(capstone):
        raise HTTPException(status_code=404, detail="This capstone is not accepting interest")
    return {
        "success": True,
        "message": "Capstone retrieved successfully",
        "data": _public_capstone_payload(capstone),
    }


@router.post("/{capstone_id}/approve")
async def approve_capstone(
    capstone_id: int,
    request: Optional[ApproveCapstoneRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") not in {"instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Only instructors or admins can approve capstones")
    result = capstones_business.approve_capstone(
        capstone_id,
        instructor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        comments=request.comments if request else None
    )
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            code = 404
        elif "forbidden" in message:
            code = 403
        else:
            code = 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.post("/{capstone_id}/archive")
async def delete_capstone(
    capstone_id: int,
    request: Optional[DeleteCapstoneRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") not in {"admin", "instructor"}:
        raise HTTPException(status_code=403, detail="Only admins/instructors can delete capstones")
    if not request or not request.reason.strip():
        raise HTTPException(status_code=400, detail="An audit reason is required when archiving a capstone")
    result = capstones_business.delete_capstone_as_privileged(
        capstone_id=capstone_id,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        reason=request.reason
    )
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in message:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/{capstone_id}/complete")
async def complete_capstone(
    capstone_id: int,
    request: CompleteCapstoneRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") not in {"admin", "instructor"}:
        raise HTTPException(status_code=403, detail="Only admins/instructors can mark capstones complete")
    if not request.notes.strip():
        raise HTTPException(status_code=400, detail="Completion notes are required when marking a capstone complete")
    result = capstones_business.complete_capstone(
        capstone_id=capstone_id,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        notes=request.notes,
        completed_term=request.completed_term,
    )
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in message:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/{capstone_id}/reject")
async def reject_capstone(
    capstone_id: int,
    request: Optional[RejectCapstoneRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") not in {"instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Only instructors or admins can reject capstones")
    if not request or not request.comments or not request.comments.strip():
        raise HTTPException(status_code=400, detail="comments are required when rejecting a capstone")
    result = capstones_business.reject_capstone(
        capstone_id,
        instructor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        comments=request.comments if request else None
    )
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            code = 404
        elif "forbidden" in message:
            code = 403
        else:
            code = 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.post("/{capstone_id}/request-changes")
async def request_changes(
    capstone_id: int,
    request: RequestChangesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") not in {"instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Only instructors or admins can request changes")
    if not request.comments or not request.comments.strip():
        raise HTTPException(status_code=400, detail="comments are required when requesting changes")
    result = capstones_business.request_changes(
        capstone_id,
        request.comments.strip(),
        instructor_id=current_user.get("user_id"),
        actor_role=current_user.get("role")
    )
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            code = 404
        elif "forbidden" in message:
            code = 403
        else:
            code = 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.post("/{capstone_id}/resubmit")
async def resubmit_capstone(
    capstone_id: int,
    request: ResubmitCapstoneRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can resubmit capstones")
    if not request.change_summary or not request.change_summary.strip():
        raise HTTPException(status_code=400, detail="change_summary is required")
    _require_proposal_quality(request)

    update_data = {
        "title": request.title,
        "description": request.description,
        "project_start_date": request.project_start_date,
        "disciplines": request.project_disciplines,
        "department_ids": request.department_ids,
        "skills": request.skills_required,
        "problem_area": request.problem_area,
        "main_objectives": request.main_objectives,
        "scope_of_work": request.scope_of_work,
        "deliverables": request.deliverables,
        "meeting_frequency": request.meeting_frequency,
        "uw_resources": request.uw_resources,
        "org_resources": request.org_resources,
        "other_resources": request.other_resources,
        "how_heard_about_capstone": request.how_heard_about_capstone,
        "deliverable_types": request.deliverable_types,
        "proposed_team_members": request.proposed_team_members,
        "success_criteria": request.success_criteria,
        "validation_plan": request.validation_plan,
        "stakeholders": request.stakeholders,
        "risks_constraints": request.risks_constraints,
        "public_evaluation_acknowledged": request.public_evaluation_acknowledged,
        "ip_acknowledged": request.ip_acknowledged,
        "confidentiality_acknowledged": request.confidentiality_acknowledged,
        "ecosystem_id": request.ecosystem_id,
        "organization_name": request.organization_name,
        "primary_contact": request.primary_contact,
        "email": request.email,
        "phone": request.phone,
        "website": request.website,
        "organization_description": request.organization_description,
        "organization_size": request.organization_size,
        "sector": request.sector,
        "partner_opportunity_id": request.partner_opportunity_id,
        "external_partner_name": request.external_partner_name,
        "external_partner_organization": request.external_partner_organization,
        "external_partner_email": request.external_partner_email,
        "external_partner_website": request.external_partner_website,
        "external_partner_notes": request.external_partner_notes,
        "external_partner_confirmed": request.external_partner_confirmed,
    }

    result = capstones_business.resubmit_capstone(
        capstone_id=capstone_id,
        student_id=current_user.get("user_id"),
        update_data=update_data,
        change_summary=request.change_summary.strip(),
    )
    if not result["success"]:
        if "not found" in result["message"].lower():
            raise HTTPException(status_code=404, detail=result["message"])
        if "only the capstone owner" in result["message"].lower() or "only the current team leader" in result["message"].lower():
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/{capstone_id}/withdraw-review")
async def withdraw_capstone_review(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can reopen capstones for edits")

    result = capstones_business.withdraw_capstone_review(
        capstone_id=capstone_id,
        student_id=current_user.get("user_id"),
    )
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            raise HTTPException(status_code=404, detail=result["message"])
        if "only the current team leader" in message:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result
