from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from .courses_bl import CoursesBusinessLogic
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/courses", tags=["courses"])
courses_business = CoursesBusinessLogic()


def _field_supplied(model: BaseModel, field_name: str) -> bool:
    fields = getattr(model, "model_fields_set", None)
    if fields is None:
        fields = getattr(model, "__fields_set__", set())
    return field_name in fields


class CreateCourseRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=200)
    active_terms: List[str] = Field(default_factory=list, max_length=3)
    activation_mode: str = Field(default="auto", max_length=32)
    department_id: Optional[int] = None
    ecosystem_id: Optional[int] = None
    routing_kind: str = Field(default="standard", max_length=32)
    marketplace_phase_override: Optional[str] = Field(default=None, max_length=32)
    marketplace_phase_override_reason: Optional[str] = Field(default=None, max_length=2000)
    requires_project_support: bool = True


class UpdateCourseRequest(BaseModel):
    code: Optional[str] = Field(default=None, max_length=32)
    name: Optional[str] = Field(default=None, max_length=200)
    active_terms: Optional[List[str]] = Field(default=None, max_length=3)
    activation_mode: Optional[str] = Field(default=None, max_length=32)
    department_id: Optional[int] = None
    ecosystem_id: Optional[int] = None
    routing_kind: Optional[str] = Field(default=None, max_length=32)
    marketplace_phase_override: Optional[str] = Field(default=None, max_length=32)
    marketplace_phase_override_reason: Optional[str] = Field(default=None, max_length=2000)
    requires_project_support: Optional[bool] = None
    reason: Optional[str] = Field(default=None, max_length=2000)


class UpdateProjectEcosystemRequest(BaseModel):
    description: Optional[str] = Field(default=None, max_length=2000)
    active: Optional[bool] = None
    marketplace_phase_override: Optional[str] = Field(default=None, max_length=32)
    marketplace_phase_override_reason: Optional[str] = Field(default=None, max_length=2000)
    reason: Optional[str] = Field(default=None, max_length=2000)


class CoursePipelineEdgeRequest(BaseModel):
    from_course_id: int
    to_course_id: int
    active: bool = True
    is_default: bool = False
    notes: Optional[str] = Field(default=None, max_length=1000)


class CourseOfferingRequest(BaseModel):
    course_id: int
    term: str = Field(..., min_length=1, max_length=100)
    title_override: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5000)
    topic: Optional[str] = Field(default=None, max_length=500)
    section_label: Optional[str] = Field(default=None, max_length=100)
    status: str = Field(default="draft", max_length=32)
    routing_kind_override: Optional[str] = Field(default=None, max_length=32)
    ecosystem_id: Optional[int] = None
    requires_project_support: Optional[bool] = None
    student_registration_notes: Optional[str] = Field(default=None, max_length=5000)
    admin_routing_notes: Optional[str] = Field(default=None, max_length=5000)
    source_url: Optional[str] = Field(default=None, max_length=1000)
    held_with_course_ids: List[int] = Field(default_factory=list, max_length=50)


class CloneCourseOfferingsRequest(BaseModel):
    source_term: str = Field(..., min_length=1, max_length=100)
    target_term: str = Field(..., min_length=1, max_length=100)
    target_status: str = Field(default="draft", max_length=32)
    overwrite_existing: bool = False
    reason: Optional[str] = Field(default=None, max_length=2000)


@router.post("/")
async def create_course(
    request: CreateCourseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.create_course(
        request.code,
        request.name,
        request.active_terms,
        request.activation_mode,
        request.department_id,
        request.ecosystem_id,
        request.routing_kind,
        request.marketplace_phase_override,
        request.marketplace_phase_override_reason,
        request.requires_project_support,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/")
async def get_courses(active_only: bool = Query(False)) -> Dict[str, Any]:
    result = courses_business.list_courses(active_only=active_only)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/ecosystems")
async def get_project_ecosystems(active_only: bool = Query(False)) -> Dict[str, Any]:
    result = courses_business.list_project_ecosystems(active_only=active_only)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.get("/offerings")
async def get_course_offerings(
    term: Optional[str] = Query(default=None),
    course_id: Optional[int] = Query(default=None),
) -> Dict[str, Any]:
    result = courses_business.list_course_offerings(term=term, course_id=course_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/offerings")
async def create_course_offering(
    request: CourseOfferingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.upsert_course_offering(
        offering_id=None,
        course_id=request.course_id,
        term=request.term,
        title_override=request.title_override,
        description=request.description,
        topic=request.topic,
        section_label=request.section_label,
        status=request.status,
        routing_kind_override=request.routing_kind_override,
        ecosystem_id=request.ecosystem_id,
        requires_project_support=request.requires_project_support,
        student_registration_notes=request.student_registration_notes,
        admin_routing_notes=request.admin_routing_notes,
        source_url=request.source_url,
        held_with_course_ids=request.held_with_course_ids,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.patch("/offerings/{offering_id}")
async def update_course_offering(
    offering_id: int,
    request: CourseOfferingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.upsert_course_offering(
        offering_id=offering_id,
        course_id=request.course_id,
        term=request.term,
        title_override=request.title_override,
        description=request.description,
        topic=request.topic,
        section_label=request.section_label,
        status=request.status,
        routing_kind_override=request.routing_kind_override,
        ecosystem_id=request.ecosystem_id,
        requires_project_support=request.requires_project_support,
        student_registration_notes=request.student_registration_notes,
        admin_routing_notes=request.admin_routing_notes,
        source_url=request.source_url,
        held_with_course_ids=request.held_with_course_ids,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.post("/offerings/clone")
async def clone_course_offerings(
    request: CloneCourseOfferingsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.clone_course_offerings(
        source_term=request.source_term,
        target_term=request.target_term,
        target_status=request.target_status,
        overwrite_existing=request.overwrite_existing,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.patch("/ecosystems/{ecosystem_id}")
async def update_project_ecosystem(
    ecosystem_id: int,
    request: UpdateProjectEcosystemRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.update_project_ecosystem(
        ecosystem_id=ecosystem_id,
        description=request.description,
        active=request.active if _field_supplied(request, "active") else None,
        marketplace_phase_override=request.marketplace_phase_override,
        marketplace_phase_override_reason=request.marketplace_phase_override_reason,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.post("/pipeline-edges")
async def create_course_pipeline_edge(
    request: CoursePipelineEdgeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.upsert_pipeline_edge(
        edge_id=None,
        from_course_id=request.from_course_id,
        to_course_id=request.to_course_id,
        active=request.active,
        is_default=request.is_default,
        notes=request.notes,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.patch("/pipeline-edges/{edge_id}")
async def update_course_pipeline_edge(
    edge_id: int,
    request: CoursePipelineEdgeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.upsert_pipeline_edge(
        edge_id=edge_id,
        from_course_id=request.from_course_id,
        to_course_id=request.to_course_id,
        active=request.active,
        is_default=request.is_default,
        notes=request.notes,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.get("/{course_id}")
async def get_course(course_id: int) -> Dict[str, Any]:
    result = courses_business.get_course(course_id)
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result


@router.patch("/{course_id}")
async def update_course(
    course_id: int,
    request: UpdateCourseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = courses_business.update_course(
        course_id=course_id,
        code=request.code,
        name=request.name,
        active_terms=request.active_terms,
        activation_mode=request.activation_mode,
        department_id=request.department_id,
        department_id_supplied=_field_supplied(request, "department_id"),
        ecosystem_id=request.ecosystem_id,
        ecosystem_id_supplied=_field_supplied(request, "ecosystem_id"),
        routing_kind=request.routing_kind,
        marketplace_phase_override=request.marketplace_phase_override,
        marketplace_phase_override_supplied=_field_supplied(request, "marketplace_phase_override"),
        marketplace_phase_override_reason=request.marketplace_phase_override_reason,
        marketplace_phase_override_reason_supplied=_field_supplied(request, "marketplace_phase_override_reason"),
        requires_project_support=request.requires_project_support,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        code = 404 if "not found" in result["message"].lower() else 400
        raise HTTPException(status_code=code, detail=result["message"])
    return result
