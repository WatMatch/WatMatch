from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth.dependencies import get_current_user
from ..config.database import supabase
from ..workflow.rpc_utils import call_json_rpc

router = APIRouter(prefix="/partners", tags=["partners"])


class PartnerProfileRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=200)
    organization: str = Field(..., min_length=1, max_length=200)
    contact_email: str = Field(..., min_length=3, max_length=320)
    website: Optional[str] = Field(default=None, max_length=500)
    bio: Optional[str] = Field(default=None, max_length=5000)
    areas: Optional[list[str]] = Field(default_factory=list, max_length=50)
    reason: Optional[str] = Field(default=None, max_length=1000)


class PartnerOpportunityRequest(BaseModel):
    partner_user_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=300)
    organization: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=10000)
    primary_contact: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=50)
    how_heard_about_capstone: Optional[str] = Field(default=None, max_length=1000)
    organization_description: Optional[str] = Field(default=None, max_length=5000)
    organization_size: Optional[str] = Field(default=None, max_length=100)
    project_start_date: Optional[str] = Field(default=None, max_length=100)
    problem_area: Optional[str] = Field(default=None, max_length=1000)
    main_objectives: Optional[str] = Field(default=None, max_length=3000)
    scope_of_work: Optional[str] = Field(default=None, max_length=3000)
    deliverable_types: Optional[list[str]] = Field(default_factory=list, max_length=25)
    deliverables: Optional[str] = Field(default=None, max_length=3000)
    meeting_frequency: Optional[str] = Field(default=None, max_length=100)
    resources_needed: Optional[str] = Field(default=None, max_length=2000)
    disciplines: Optional[list[str]] = Field(default_factory=list, max_length=50)
    skills: Optional[list[str]] = Field(default_factory=list, max_length=100)
    target_course_tags: Optional[list[str]] = Field(default_factory=list, max_length=50)
    target_course_ids: Optional[list[int]] = Field(default_factory=list, max_length=50)
    preferred_team_size: Optional[str] = Field(default=None, max_length=100)
    max_active_teams: Optional[int] = Field(default=None, ge=1, le=100)
    contact_email: str = Field(..., min_length=3, max_length=320)
    contact_url: Optional[str] = Field(default=None, max_length=500)
    ip_acknowledged: bool = False
    nda_acknowledged: bool = False
    matching_acknowledged: bool = False
    status: str = Field(default="draft", max_length=32)
    reason: Optional[str] = Field(default=None, max_length=1000)


def _role(user: Dict[str, Any]) -> str:
    return (user.get("role") or "").lower()


def _require_admin(user: Dict[str, Any]) -> None:
    if _role(user) != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _require_external_partner(user: Dict[str, Any]) -> None:
    if _role(user) != "external_partner":
        raise HTTPException(status_code=403, detail="External partner access required")


def _clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _require_audit_reason(value: Optional[str], detail: str) -> str:
    reason = _clean_text(value)
    if reason is None:
        raise HTTPException(status_code=400, detail=detail)
    return reason


def _clean_list(values: Optional[list[str]]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values or []:
        item = str(value).strip()
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _profile_payload(request: PartnerProfileRequest) -> Dict[str, Any]:
    return {
        "display_name": request.display_name.strip(),
        "organization": request.organization.strip(),
        "contact_email": request.contact_email.strip().lower(),
        "website": _clean_text(request.website),
        "bio": _clean_text(request.bio),
        "areas": _clean_list(request.areas),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _opportunity_payload(
    request: PartnerOpportunityRequest,
    partner_user_id: int,
) -> Dict[str, Any]:
    status = (request.status or "draft").strip().lower()
    if status not in {"draft", "published", "archived"}:
        raise HTTPException(status_code=400, detail="Invalid opportunity status")

    payload = {
        "partner_user_fk": partner_user_id,
        "title": request.title.strip(),
        "organization": request.organization.strip(),
        "description": _clean_text(request.description),
        "primary_contact": _clean_text(request.primary_contact),
        "phone": _clean_text(request.phone),
        "how_heard_about_capstone": _clean_text(request.how_heard_about_capstone),
        "organization_description": _clean_text(request.organization_description),
        "organization_size": _clean_text(request.organization_size),
        "project_start_date": _clean_text(request.project_start_date),
        "problem_area": _clean_text(request.problem_area),
        "main_objectives": _clean_text(request.main_objectives),
        "scope_of_work": _clean_text(request.scope_of_work),
        "deliverable_types": _clean_list(request.deliverable_types),
        "deliverables": _clean_text(request.deliverables),
        "meeting_frequency": _clean_text(request.meeting_frequency),
        "resources_needed": _clean_text(request.resources_needed),
        "disciplines": _clean_list(request.disciplines),
        "skills": _clean_list(request.skills),
        "target_course_tags": _clean_list(request.target_course_tags),
        "target_course_ids": sorted(
            {
                int(course_id)
                for course_id in request.target_course_ids or []
                if course_id is not None
            }
        ),
        "preferred_team_size": _clean_text(request.preferred_team_size),
        "max_active_teams": request.max_active_teams,
        "contact_email": request.contact_email.strip().lower(),
        "contact_url": _clean_text(request.contact_url),
        "ip_acknowledged": request.ip_acknowledged is True,
        "nda_acknowledged": request.nda_acknowledged is True,
        "matching_acknowledged": request.matching_acknowledged is True,
        "status": status,
        "archived_at": datetime.now(timezone.utc).isoformat() if status == "archived" else None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    return payload


def _profile_rpc_params(
    request: PartnerProfileRequest,
    actor: Dict[str, Any],
    partner_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    payload = _profile_payload(request)
    return {
        "p_actor_id": int(actor["user_id"]),
        "p_actor_role": _role(actor),
        "p_partner_user_id": partner_user_id,
        "p_display_name": payload["display_name"],
        "p_organization": payload["organization"],
        "p_contact_email": payload["contact_email"],
        "p_website": payload["website"],
        "p_bio": payload["bio"],
        "p_areas": payload["areas"],
        "p_reason": _clean_text(request.reason),
    }


def _opportunity_rpc_params(
    request: PartnerOpportunityRequest,
    actor: Dict[str, Any],
    opportunity_id: Optional[int] = None,
    partner_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    owner_id = partner_user_id if partner_user_id is not None else request.partner_user_id
    payload = _opportunity_payload(request, int(owner_id or actor["user_id"]))
    return {
        "p_actor_id": int(actor["user_id"]),
        "p_actor_role": _role(actor),
        "p_opportunity_id": opportunity_id,
        "p_partner_user_id": owner_id,
        "p_title": payload["title"],
        "p_organization": payload["organization"],
        "p_description": payload["description"],
        "p_primary_contact": payload["primary_contact"],
        "p_phone": payload["phone"],
        "p_how_heard_about_capstone": payload["how_heard_about_capstone"],
        "p_organization_description": payload["organization_description"],
        "p_organization_size": payload["organization_size"],
        "p_project_start_date": payload["project_start_date"],
        "p_problem_area": payload["problem_area"],
        "p_main_objectives": payload["main_objectives"],
        "p_scope_of_work": payload["scope_of_work"],
        "p_deliverable_types": payload["deliverable_types"],
        "p_deliverables": payload["deliverables"],
        "p_meeting_frequency": payload["meeting_frequency"],
        "p_resources_needed": payload["resources_needed"],
        "p_disciplines": payload["disciplines"],
        "p_skills": payload["skills"],
        "p_target_course_tags": payload["target_course_tags"],
        "p_target_course_ids": payload["target_course_ids"],
        "p_preferred_team_size": payload["preferred_team_size"],
        "p_max_active_teams": payload["max_active_teams"],
        "p_contact_email": payload["contact_email"],
        "p_contact_url": payload["contact_url"],
        "p_ip_acknowledged": payload["ip_acknowledged"],
        "p_nda_acknowledged": payload["nda_acknowledged"],
        "p_matching_acknowledged": payload["matching_acknowledged"],
        "p_status": payload["status"],
        "p_reason": _clean_text(request.reason),
    }


def _raise_rpc_error(result: Dict[str, Any]) -> None:
    if result.get("success", True):
        return
    detail = str(result.get("message") or "External partner workflow failed")
    lowered = detail.lower()
    if "not found" in lowered:
        status_code = 404
    elif "access required" in lowered or "cannot manage" in lowered or "forbidden" in lowered:
        status_code = 403
    elif "already" in lowered or "limit" in lowered or "inactive" in lowered:
        status_code = 409
    else:
        status_code = 400
    raise HTTPException(status_code=status_code, detail=detail)


def _get_opportunity(opportunity_id: int) -> Dict[str, Any]:
    rows = (
        supabase.table("partner_opportunities")
        .select("*")
        .eq("partner_opportunity_id", opportunity_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="External partner opportunity not found")
    return _with_target_courses(rows[0])


def _with_target_courses(opportunity: Dict[str, Any]) -> Dict[str, Any]:
    opportunity_id = opportunity.get("partner_opportunity_id")
    if opportunity_id is None:
        return {**opportunity, "target_course_ids": [], "target_courses": []}
    link_rows = (
        supabase.table("partner_opportunity_courses")
        .select("course_fk")
        .eq("partner_opportunity_fk", opportunity_id)
        .execute()
        .data
        or []
    )
    course_ids = sorted(
        {
            int(row["course_fk"])
            for row in link_rows
            if row.get("course_fk") is not None
        }
    )
    if not course_ids:
        return {**opportunity, "target_course_ids": [], "target_courses": []}
    course_rows = (
        supabase.table("courses")
        .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind,requires_project_support")
        .in_("course_id", course_ids)
        .execute()
        .data
        or []
    )
    course_by_id = {
        int(course["course_id"]): course
        for course in course_rows
        if course.get("course_id") is not None
    }
    return {
        **opportunity,
        "target_course_ids": course_ids,
        "target_courses": [
            course_by_id[course_id]
            for course_id in course_ids
            if course_id in course_by_id
        ],
    }


def _with_opportunity_usage(opportunity: Dict[str, Any]) -> Dict[str, Any]:
    opportunity_id = opportunity.get("partner_opportunity_id")
    if opportunity_id is None:
        return {**opportunity, "active_team_count": 0, "is_available": True}

    rows = (
        supabase.table("capstones")
        .select("capstone_id,status")
        .eq("partner_opportunity_fk", opportunity_id)
        .eq("archived", False)
        .execute()
        .data
        or []
    )
    active_count = sum(
        1
        for row in rows
        if (row.get("status") or "").lower() not in {"archived", "rejected"}
    )
    max_active_teams = opportunity.get("max_active_teams")
    is_available = max_active_teams is None or active_count < int(max_active_teams)
    return {
        **opportunity,
        "active_team_count": active_count,
        "is_available": is_available,
    }


def _student_rows_for_team_ids(team_ids: list[int]) -> Dict[int, list[Dict[str, Any]]]:
    if not team_ids:
        return {}
    membership_rows = (
        supabase.table("team_memberships")
        .select("team_fk,user_fk,is_leader,enrollment_course_fk")
        .in_("team_fk", team_ids)
        .execute()
        .data
        or []
    )
    student_ids = sorted({
        int(row["user_fk"])
        for row in membership_rows
        if row.get("user_fk") is not None
    })
    users_map: Dict[int, Dict[str, Any]] = {}
    if student_ids:
        user_rows = (
            supabase.table("users")
            .select("user_id,email,course_fk,home_department_fk")
            .in_("user_id", student_ids)
            .execute()
            .data
            or []
        )
        users_map = {
            int(user["user_id"]): user
            for user in user_rows
            if user.get("user_id") is not None
        }

    course_ids = sorted({
        int(course_id)
        for membership in membership_rows
        for course_id in (
            membership.get("enrollment_course_fk"),
            users_map.get(int(membership["user_fk"]), {}).get("course_fk")
            if membership.get("user_fk") is not None
            else None,
        )
        if course_id is not None
    })
    courses_map: Dict[int, Dict[str, Any]] = {}
    if course_ids:
        course_rows = (
            supabase.table("courses")
            .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind,ecosystem_fk")
            .in_("course_id", course_ids)
            .execute()
            .data
            or []
        )
        courses_map = {
            int(course["course_id"]): course
            for course in course_rows
            if course.get("course_id") is not None
        }

    department_ids = sorted({
        int(user["home_department_fk"])
        for user in users_map.values()
        if user.get("home_department_fk") is not None
    })
    departments_map: Dict[int, Dict[str, Any]] = {}
    if department_ids:
        department_rows = (
            supabase.table("departments")
            .select("department_id,name,active")
            .in_("department_id", department_ids)
            .execute()
            .data
            or []
        )
        departments_map = {
            int(department["department_id"]): department
            for department in department_rows
            if department.get("department_id") is not None
        }

    by_team: Dict[int, list[Dict[str, Any]]] = {team_id: [] for team_id in team_ids}
    for membership in membership_rows:
        team_id = membership.get("team_fk")
        user = users_map.get(int(membership.get("user_fk") or 0))
        if team_id is None or not user:
            continue
        department_id = user.get("home_department_fk")
        enrollment_course_fk = membership.get("enrollment_course_fk")
        by_team.setdefault(int(team_id), []).append({
            **user,
            "is_leader": membership.get("is_leader"),
            "course": courses_map.get(int(user["course_fk"])) if user.get("course_fk") is not None else None,
            "enrollment_course_fk": enrollment_course_fk,
            "enrollment_course": courses_map.get(int(enrollment_course_fk)) if enrollment_course_fk is not None else None,
            "home_department_id": department_id,
            "home_department": departments_map.get(int(department_id)) if department_id is not None else None,
        })
    return by_team


def _active_external_partner_ids(rows: list[Dict[str, Any]]) -> set[int]:
    partner_ids = sorted({
        int(row["partner_user_fk"])
        for row in rows
        if row.get("partner_user_fk") is not None
    })
    if not partner_ids:
        return set()
    active_rows = (
        supabase.table("users")
        .select("user_id")
        .in_("user_id", partner_ids)
        .eq("role", "external_partner")
        .eq("active", True)
        .execute()
        .data
        or []
    )
    return {
        int(row["user_id"])
        for row in active_rows
        if row.get("user_id") is not None
    }


def _can_view_opportunity(opportunity: Dict[str, Any], user: Dict[str, Any]) -> bool:
    if opportunity.get("status") == "published":
        return True
    if _role(user) == "admin":
        return True
    return (
        _role(user) == "external_partner"
        and int(opportunity.get("partner_user_fk") or 0) == int(user.get("user_id") or 0)
    )


def _require_opportunity_owner_or_admin(
    opportunity: Dict[str, Any],
    user: Dict[str, Any],
) -> None:
    if _role(user) == "admin":
        return
    if (
        _role(user) == "external_partner"
        and int(opportunity.get("partner_user_fk") or 0) == int(user.get("user_id") or 0)
    ):
        return
    raise HTTPException(status_code=403, detail="You cannot manage this opportunity")


def _paginated_rpc_response(
    function_name: str,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    result = call_json_rpc(function_name, params)
    _raise_rpc_error(result)
    data = result.get("data") or []
    page = int(result.get("page") or params.get("p_page") or 1)
    page_size = int(result.get("page_size") or params.get("p_page_size") or len(data) or 1)
    total = int(result.get("total") or 0)
    total_pages = int(result.get("total_pages") or max(1, (total + page_size - 1) // page_size))
    return {
        "success": True,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "data": data,
    }


@router.get("/opportunities")
async def list_opportunities(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    search: Optional[str] = Query(default=None, max_length=200),
    discipline: Optional[str] = Query(default=None, max_length=100),
    skill: Optional[str] = Query(default=None, max_length=100),
    status: Optional[str] = Query(default="published", max_length=32),
    target_course_id: Optional[int] = Query(default=None, ge=1),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    return _paginated_rpc_response(
        "watmatch_get_partner_opportunities",
        {
            "p_actor_id": int(current_user["user_id"]),
            "p_actor_role": _role(current_user),
            "p_page": page,
            "p_page_size": page_size,
            "p_search": search,
            "p_discipline": discipline,
            "p_skill": skill,
            "p_status": status or "published",
            "p_target_course_id": target_course_id,
        },
    )


@router.get("/opportunities/{opportunity_id}")
async def get_opportunity(
    opportunity_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    opportunity = _get_opportunity(opportunity_id)
    if opportunity.get("status") == "published":
        active_partner_ids = _active_external_partner_ids([opportunity])
        if int(opportunity.get("partner_user_fk") or 0) not in active_partner_ids:
            raise HTTPException(status_code=404, detail="External partner opportunity not found")
    if not _can_view_opportunity(opportunity, current_user):
        raise HTTPException(status_code=404, detail="External partner opportunity not found")
    return {"success": True, "data": _with_opportunity_usage(opportunity)}


@router.get("/me/profile")
async def get_my_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_external_partner(current_user)
    rows = (
        supabase.table("partner_profiles")
        .select("*")
        .eq("partner_user_fk", current_user["user_id"])
        .limit(1)
        .execute()
        .data
        or []
    )
    return {"success": True, "data": rows[0] if rows else None}


@router.put("/me/profile")
async def upsert_my_profile(
    request: PartnerProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_external_partner(current_user)
    result = call_json_rpc(
        "watmatch_upsert_partner_profile",
        _profile_rpc_params(request, current_user, int(current_user["user_id"])),
    )
    _raise_rpc_error(result)
    return result


@router.get("/me/opportunities")
async def list_my_opportunities(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_external_partner(current_user)
    return _paginated_rpc_response(
        "watmatch_get_my_partner_opportunities",
        {
            "p_actor_id": int(current_user["user_id"]),
            "p_page": page,
            "p_page_size": page_size,
        },
    )


@router.get("/me/teams")
async def list_my_partner_teams(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_external_partner(current_user)
    opportunity_rows = (
        supabase.table("partner_opportunities")
        .select("partner_opportunity_id,title,organization,status")
        .eq("partner_user_fk", current_user["user_id"])
        .execute()
        .data
        or []
    )
    opportunity_ids = [
        row.get("partner_opportunity_id")
        for row in opportunity_rows
        if row.get("partner_opportunity_id") is not None
    ]
    if not opportunity_ids:
        return {"success": True, "data": []}

    opportunities_map = {
        int(row["partner_opportunity_id"]): row
        for row in opportunity_rows
        if row.get("partner_opportunity_id") is not None
    }
    capstone_rows = (
        supabase.table("capstones")
        .select("capstone_id,title,status,team_fk,partner_opportunity_fk")
        .in_("partner_opportunity_fk", opportunity_ids)
        .eq("archived", False)
        .execute()
        .data
        or []
    )
    team_ids = sorted({
        int(row["team_fk"])
        for row in capstone_rows
        if row.get("team_fk") is not None
    })
    if not team_ids:
        return {"success": True, "data": []}

    team_rows = (
        supabase.table("teams")
        .select("team_id,leader_fk,status,capstone_fk,created_at")
        .in_("team_id", team_ids)
        .execute()
        .data
        or []
    )
    capstones_by_team = {
        int(row["team_fk"]): row
        for row in capstone_rows
        if row.get("team_fk") is not None
    }
    members_by_team = _student_rows_for_team_ids(team_ids)
    data = []
    for team in team_rows:
        team_id = int(team["team_id"])
        capstone = capstones_by_team.get(team_id) or {}
        opportunity_id = capstone.get("partner_opportunity_fk")
        data.append({
            "team_id": team_id,
            "leader_fk": team.get("leader_fk"),
            "status": team.get("status"),
            "created_at": team.get("created_at"),
            "capstone": {
                "capstone_id": capstone.get("capstone_id"),
                "title": capstone.get("title"),
                "status": capstone.get("status"),
                "partner_opportunity_fk": opportunity_id,
            },
            "opportunity": opportunities_map.get(int(opportunity_id)) if opportunity_id is not None else None,
            "team_members": members_by_team.get(team_id, []),
        })
    return {"success": True, "data": data}


@router.post("/me/opportunities")
async def create_my_opportunity(
    request: PartnerOpportunityRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_external_partner(current_user)
    result = call_json_rpc(
        "watmatch_upsert_partner_opportunity",
        _opportunity_rpc_params(request, current_user, partner_user_id=int(current_user["user_id"])),
    )
    _raise_rpc_error(result)
    return result


@router.patch("/me/opportunities/{opportunity_id}")
async def update_my_opportunity(
    opportunity_id: int,
    request: PartnerOpportunityRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    opportunity = _get_opportunity(opportunity_id)
    _require_opportunity_owner_or_admin(opportunity, current_user)
    result = call_json_rpc(
        "watmatch_upsert_partner_opportunity",
        _opportunity_rpc_params(
            request,
            current_user,
            opportunity_id=opportunity_id,
            partner_user_id=int(opportunity["partner_user_fk"]),
        ),
    )
    _raise_rpc_error(result)
    return result


@router.get("/admin/profiles")
async def list_partner_profiles(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    start = (page - 1) * page_size
    end = start + page_size - 1
    response = (
        supabase.table("partner_profiles")
        .select("*", count="exact")
        .order("organization")
        .range(start, end)
        .execute()
    )
    rows = response.data or []
    total = int(response.count or 0)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "success": True,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "data": rows,
    }


@router.put("/admin/profiles/{partner_user_id}")
async def upsert_partner_profile_for_admin(
    partner_user_id: int,
    request: PartnerProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    _require_audit_reason(
        request.reason,
        "Admin partner profile changes require an audit reason",
    )
    result = call_json_rpc(
        "watmatch_upsert_partner_profile",
        _profile_rpc_params(request, current_user, partner_user_id),
    )
    _raise_rpc_error(result)
    return result


@router.get("/admin/opportunities")
async def list_admin_opportunities(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    return _paginated_rpc_response(
        "watmatch_get_admin_partner_opportunities",
        {
            "p_actor_id": int(current_user["user_id"]),
            "p_page": page,
            "p_page_size": page_size,
        },
    )


@router.post("/admin/opportunities")
async def create_admin_opportunity(
    request: PartnerOpportunityRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    if request.partner_user_id is None:
        raise HTTPException(status_code=400, detail="partner_user_id is required")
    _require_audit_reason(
        request.reason,
        "Admin partner opportunity changes require an audit reason",
    )
    result = call_json_rpc(
        "watmatch_upsert_partner_opportunity",
        _opportunity_rpc_params(request, current_user, partner_user_id=request.partner_user_id),
    )
    _raise_rpc_error(result)
    return result


@router.patch("/admin/opportunities/{opportunity_id}")
async def update_admin_opportunity(
    opportunity_id: int,
    request: PartnerOpportunityRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    _require_audit_reason(
        request.reason,
        "Admin partner opportunity changes require an audit reason",
    )
    opportunity = _get_opportunity(opportunity_id)
    partner_user_id = request.partner_user_id or int(opportunity["partner_user_fk"])
    result = call_json_rpc(
        "watmatch_upsert_partner_opportunity",
        _opportunity_rpc_params(
            request,
            current_user,
            opportunity_id=opportunity_id,
            partner_user_id=partner_user_id,
        ),
    )
    _raise_rpc_error(result)
    return result
