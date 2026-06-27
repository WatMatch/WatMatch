from fastapi import APIRouter, HTTPException, Query, Depends
import logging
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from .users_bl import UsersBusinessLogic
from ..auth.dependencies import get_current_user
from ..interests.interests_dl import InterestsDL
from ..config.database import supabase
from ..workflow.workflow_utils import get_team_member_ids
from ..workflow.rpc_utils import call_json_rpc

router = APIRouter(prefix="/users", tags=["users"])
users_business = UsersBusinessLogic()
interests_dl = InterestsDL()
logger = logging.getLogger(__name__)


class AdminCreateUserRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    role: str = Field(default="student", max_length=32)
    course_id: Optional[int] = None
    home_department_id: Optional[int] = None
    active: bool = True
    reason: str = Field(..., min_length=1, max_length=2000)


class AdminSetUserCourseRequest(BaseModel):
    course_id: Optional[int] = None
    reason: str = Field(..., min_length=1, max_length=2000)


class AdminSetUserActiveRequest(BaseModel):
    active: bool
    force: bool = False
    reason: str = Field(..., min_length=1, max_length=2000)


class AdminUpdateUserRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    role: str = Field(..., max_length=32)
    course_id: Optional[int] = None
    home_department_id: Optional[int] = None
    active: bool = True
    reason: str = Field(..., min_length=1, max_length=2000)


class AdminDeleteUserRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)


class AdminImportUsersRequest(BaseModel):
    csv_text: str = Field(..., min_length=1, max_length=2_000_000)


def _require_admin(current_user: Dict[str, Any]) -> None:
    if (current_user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def _status_for_message(message: str) -> int:
    lowered = message.lower()
    if "not found" in lowered:
        return 404
    if "admin access required" in lowered or "forbidden" in lowered:
        return 403
    if (
        ("already" in lowered and "non-student" in lowered)
        or "different role" in lowered
        or "last active admin" in lowered
        or "cannot deactivate yourself" in lowered
        or "cannot delete" in lowered
        or "cannot remove" in lowered
        or "cannot change" in lowered
    ):
        return 409
    return 400


def _instructor_visible_student_ids(instructor_course_fk: Optional[int]) -> set[int]:
    if instructor_course_fk is None:
        return set()

    same_course_students = (
        supabase.table("users")
        .select("user_id")
        .eq("role", "student")
        .eq("course_fk", instructor_course_fk)
        .execute()
        .data
        or []
    )
    visible_student_ids = {
        int(row["user_id"])
        for row in same_course_students
        if row.get("user_id") is not None
    }

    if not visible_student_ids:
        return visible_student_ids

    scoped_team_rows = (
        supabase.table("team_memberships")
        .select("team_fk")
        .in_("user_fk", sorted(visible_student_ids))
        .execute()
        .data
        or []
    )
    scoped_team_ids = {
        int(row["team_fk"])
        for row in scoped_team_rows
        if row.get("team_fk") is not None
    }
    if not scoped_team_ids:
        return visible_student_ids

    teammate_rows = (
        supabase.table("team_memberships")
        .select("user_fk")
        .in_("team_fk", sorted(scoped_team_ids))
        .execute()
        .data
        or []
    )
    visible_student_ids.update(
        int(row["user_fk"])
        for row in teammate_rows
        if row.get("user_fk") is not None
    )
    return visible_student_ids


@router.get("/")
async def get_users(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get users with optional pagination."""
    try:
        role = (current_user.get("role") or "").lower()
        if role not in {"instructor", "admin"}:
            raise HTTPException(status_code=403, detail="Instructor/admin access required")
        if (page is None) != (page_size is None):
            raise HTTPException(
                status_code=400,
                detail="Both 'page' and 'page_size' must be provided together for pagination"
            )

        if role == "instructor":
            visible_ids = _instructor_visible_student_ids(current_user.get("course_fk"))
            if not visible_ids:
                return {
                    "success": True,
                    "message": "Retrieved 0 user(s).",
                    "data": [],
                    **({"page": page, "page_size": page_size, "total": 0, "total_pages": 0} if page is not None else {}),
                }
            result = users_business.get_users(None, None)
            if result["success"]:
                result["data"] = [
                    user
                    for user in (result.get("data") or [])
                    if user.get("role") == "student"
                    and int(user.get("user_id")) in visible_ids
                ]
                result["message"] = f"Retrieved {len(result['data'])} user(s)."
                if page is not None and page_size is not None:
                    total = len(result["data"])
                    start = (page - 1) * page_size
                    end = start + page_size
                    result["data"] = result["data"][start:end]
                    result.update({
                        "page": page,
                        "page_size": page_size,
                        "total": total,
                        "total_pages": (total + page_size - 1) // page_size,
                    })
        else:
            result = users_business.get_users(page, page_size)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("User capstone lookup failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me/capstone")
async def get_my_capstone(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        user_id = current_user["user_id"]
        student_explorations = []
        student_commitment_requests = []
        marketplace_settings = None
        if (current_user.get("role") or "").lower() == "student":
            try:
                marketplace_payload = call_json_rpc(
                    "watmatch_list_student_explorations",
                    {"p_student_id": int(user_id)},
                )
                student_explorations = marketplace_payload.get("data") or []
                student_commitment_requests = marketplace_payload.get("commitment_requests") or []
                marketplace_settings = marketplace_payload.get("marketplace")
            except Exception:
                student_explorations = []
                student_commitment_requests = []
                marketplace_settings = None

        membership_res = (
            supabase.table("team_memberships")
            .select("team_fk")
            .eq("user_fk", user_id)
            .limit(1)
            .execute()
        )
        membership = (membership_res.data or [None])[0]
        if not membership:
            return {
                "success": True,
                "teams": [],
                "is_leader": False,
                "explorations": student_explorations,
                "commitment_requests": student_commitment_requests,
                "marketplace": marketplace_settings,
            }

        team_id = membership.get("team_fk")
        team_res = (
            supabase.table("teams")
            .select("*")
            .eq("team_id", team_id)
            .limit(1)
            .execute()
        )
        team = (team_res.data or [None])[0]
        if not team:
            return {
                "success": True,
                "teams": [],
                "is_leader": False,
                "explorations": student_explorations,
                "commitment_requests": student_commitment_requests,
                "marketplace": marketplace_settings,
            }
        is_leader = int(team.get("leader_fk") or 0) == int(user_id)

        capstone_id = team.get("capstone_fk")
        project = None
        if capstone_id:
            capstone_res = (
                supabase.table("capstones")
                .select("*")
                .eq("capstone_id", capstone_id)
                .limit(1)
                .execute()
            )
            capstone = (capstone_res.data or [None])[0]
            if capstone:
                marketplace_phase_context: Dict[str, Any] = {}
                try:
                    marketplace_phase_context = call_json_rpc(
                        "watmatch_marketplace_phase_context_for_capstone",
                        {"p_capstone_id": int(capstone["capstone_id"])},
                    )
                except Exception:
                    marketplace_phase_context = {}
                marketplace_phase = str(
                    marketplace_phase_context.get("effective_phase")
                    or (marketplace_settings or {}).get("phase")
                    or "exploration"
                ).lower()
                if marketplace_phase == "locked":
                    marketplace_phase = "finalization"
                capstone_status = (capstone.get("status") or "").lower()
                accepts_marketplace = (
                    capstone.get("archived") is not True
                    and capstone_status == "approved_recruiting"
                )
                project = {
                    "capstone_id": str(capstone["capstone_id"]),
                    "title": capstone.get("title"),
                    "description": capstone.get("description"),
                    "status": capstone.get("status"),
                    "course_fk": capstone.get("course_fk"),
                    "marketplace_phase": marketplace_phase,
                    "marketplace_phase_context": marketplace_phase_context or None,
                    "can_express_interest": accepts_marketplace and marketplace_phase == "exploration",
                    "can_invite": accepts_marketplace and marketplace_phase == "exploration",
                    "can_commit": accepts_marketplace and marketplace_phase in {"exploration", "commitment"},
                }

        member_rows = (
            supabase.table("team_memberships")
            .select("user_fk,is_leader,enrollment_course_fk,enrollment_routed_at,enrollment_notes")
            .eq("team_fk", team_id)
            .execute()
        ).data or []
        member_ids = [row.get("user_fk") for row in member_rows if row.get("user_fk") is not None]
        memberships_map = {
            row.get("user_fk"): row
            for row in member_rows
            if row.get("user_fk") is not None
        }
        team_members = []
        if member_ids:
            team_members_raw = (
                supabase.table("users")
                .select("user_id, email, course_fk, home_department_fk")
                .in_("user_id", member_ids)
                .execute()
            ).data or []
            course_ids = sorted({
                course_id
                for member in team_members_raw
                for course_id in (
                    member.get("course_fk"),
                    memberships_map.get(member.get("user_id"), {}).get("enrollment_course_fk"),
                )
                if course_id is not None
            })
            courses_map = {}
            if course_ids:
                course_rows = (
                    supabase.table("courses")
                    .select("course_id, code, name, active, active_terms, activation_mode, department_fk, routing_kind, ecosystem_fk")
                    .in_("course_id", course_ids)
                    .execute()
                ).data or []
                courses_map = {
                    course.get("course_id"): course
                    for course in course_rows
                    if course.get("course_id") is not None
                }
            department_ids = sorted({
                member.get("home_department_fk")
                for member in team_members_raw
                if member.get("home_department_fk") is not None
            })
            departments_map = {}
            if department_ids:
                department_rows = (
                    supabase.table("departments")
                    .select("department_id, name, active")
                    .in_("department_id", department_ids)
                    .execute()
                ).data or []
                departments_map = {
                    department.get("department_id"): department
                    for department in department_rows
                    if department.get("department_id") is not None
                }
            team_members = [
                {
                    **member,
                    "is_leader": memberships_map.get(member.get("user_id"), {}).get("is_leader"),
                    "course": courses_map.get(member.get("course_fk")),
                    "enrollment_course_fk": memberships_map.get(member.get("user_id"), {}).get("enrollment_course_fk"),
                    "enrollment_course": courses_map.get(
                        memberships_map.get(member.get("user_id"), {}).get("enrollment_course_fk")
                    ),
                    "enrollment_routed_at": memberships_map.get(member.get("user_id"), {}).get("enrollment_routed_at"),
                    "enrollment_notes": memberships_map.get(member.get("user_id"), {}).get("enrollment_notes"),
                    "home_department_id": member.get("home_department_fk"),
                    "home_department": departments_map.get(member.get("home_department_fk")),
                }
                for member in team_members_raw
            ]

        interested_students = []
        exploring_students = []
        if capstone_id and is_leader:
            try:
                interest_result = interests_dl.get_interested_students(capstone_id)
                if interest_result.get("success"):
                    interested_students = interest_result.get("data", [])
            except Exception:
                interested_students = []
            try:
                exploration_rows = (
                    supabase.table("project_explorations")
                    .select("*")
                    .eq("team_fk", team_id)
                    .in_("status", ["exploring", "pending_commitment", "committed"])
                    .order("updated_at", desc=True)
                    .execute()
                    .data
                    or []
                )
                exploration_student_ids = [
                    row.get("student_fk")
                    for row in exploration_rows
                    if row.get("student_fk") is not None
                ]
                exploration_students_map = {}
                exploration_courses_map = {}
                exploration_departments_map = {}
                if exploration_student_ids:
                    exploration_students = (
                        supabase.table("users")
                        .select("user_id,email,course_fk,home_department_fk")
                        .in_("user_id", exploration_student_ids)
                        .execute()
                        .data
                        or []
                    )
                    exploration_students_map = {
                        student.get("user_id"): student
                        for student in exploration_students
                        if student.get("user_id") is not None
                    }
                    exploration_course_ids = sorted({
                        student.get("course_fk")
                        for student in exploration_students
                        if student.get("course_fk") is not None
                    })
                    if exploration_course_ids:
                        exploration_courses = (
                            supabase.table("courses")
                            .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind")
                            .in_("course_id", exploration_course_ids)
                            .execute()
                            .data
                            or []
                        )
                        exploration_courses_map = {
                            course.get("course_id"): course
                            for course in exploration_courses
                            if course.get("course_id") is not None
                        }
                    exploration_department_ids = sorted({
                        student.get("home_department_fk")
                        for student in exploration_students
                        if student.get("home_department_fk") is not None
                    })
                    if exploration_department_ids:
                        exploration_departments = (
                            supabase.table("departments")
                            .select("department_id,name,active")
                            .in_("department_id", exploration_department_ids)
                            .execute()
                            .data
                            or []
                        )
                        exploration_departments_map = {
                            department.get("department_id"): department
                            for department in exploration_departments
                            if department.get("department_id") is not None
                        }
                exploring_students = [
                    {
                        "exploration_id": row.get("exploration_id"),
                        "status": row.get("status"),
                        "message": row.get("message"),
                        "student_commitment_confirmed_at": row.get("student_commitment_confirmed_at"),
                        "student_commitment_confirmed_by_fk": row.get("student_commitment_confirmed_by_fk"),
                        "team_commitment_confirmed_at": row.get("team_commitment_confirmed_at"),
                        "team_commitment_confirmed_by_fk": row.get("team_commitment_confirmed_by_fk"),
                        "student_commitment_confirmed": bool(row.get("student_commitment_confirmed_at")),
                        "team_commitment_confirmed": bool(row.get("team_commitment_confirmed_at")),
                        "created_at": row.get("created_at"),
                        "updated_at": row.get("updated_at"),
                        **(exploration_students_map.get(row.get("student_fk")) or {"user_id": row.get("student_fk")}),
                        "course": exploration_courses_map.get(
                            (exploration_students_map.get(row.get("student_fk")) or {}).get("course_fk")
                        ),
                        "home_department": exploration_departments_map.get(
                            (exploration_students_map.get(row.get("student_fk")) or {}).get("home_department_fk")
                        ),
                    }
                    for row in exploration_rows
                ]
            except Exception:
                exploring_students = []
        return {
            "success": True,
            "teams": [{
                "team_id": team_id,
                "project": project,
                "team_members": team_members,
                "interested_students": interested_students,
                "exploring_students": exploring_students,
                "is_leader": is_leader,
                "leader_fk": team.get("leader_fk"),
                "status": team.get("status"),
                "commitment_roster_confirmed_at": team.get("commitment_roster_confirmed_at"),
                "commitment_roster_confirmed_by_fk": team.get("commitment_roster_confirmed_by_fk"),
                "commitment_roster_note": team.get("commitment_roster_note"),
            }],
            "is_leader": is_leader,
            "explorations": student_explorations,
            "commitment_requests": student_commitment_requests,
            "marketplace": marketplace_settings,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me/interests")
async def get_my_interests(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get all pending interests for the current user.
    
    Returns list of projects user has expressed interest in.
    """
    try:
        if current_user.get("role") != "student":
            return {
                "success": True,
                "data": []
            }
        
        user_id = current_user["user_id"]
        result = interests_dl.get_student_interests(user_id)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("message", "Failed to fetch interests"))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/users")
async def list_users_for_admin(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    if (page is None) != (page_size is None):
        raise HTTPException(
            status_code=400,
            detail="Both 'page' and 'page_size' must be provided together for pagination",
        )
    result = users_business.list_users_for_admin(page, page_size)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/admin/users")
async def create_user_for_admin(
    request: AdminCreateUserRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = users_business.create_user(
        email=request.email,
        role=request.role,
        course_id=request.course_id,
        home_department_id=request.home_department_id,
        active=request.active,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.patch("/admin/users/{user_id}/course")
async def set_user_course_for_admin(
    user_id: int,
    request: AdminSetUserCourseRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = users_business.set_user_course(
        user_id=user_id,
        course_id=request.course_id,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.patch("/admin/users/{user_id}/active")
async def set_user_active_for_admin(
    user_id: int,
    request: AdminSetUserActiveRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = users_business.set_user_active(
        user_id=user_id,
        active=request.active,
        actor_id=int(current_user["user_id"]),
        force=request.force,
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.patch("/admin/users/{user_id}")
async def update_user_for_admin(
    user_id: int,
    request: AdminUpdateUserRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = users_business.update_user(
        user_id=user_id,
        email=request.email,
        role=request.role,
        course_id=request.course_id,
        home_department_id=request.home_department_id,
        active=request.active,
        actor_id=int(current_user["user_id"]),
        reason=request.reason,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/admin/users/{user_id}/delete")
async def delete_user_for_admin(
    user_id: int,
    request: Optional[AdminDeleteUserRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = users_business.delete_user(
        user_id=user_id,
        actor_id=int(current_user["user_id"]),
        reason=request.reason if request else None,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_message(result["message"]),
            detail=result["message"],
        )
    return result


@router.post("/admin/users/import")
async def import_users_for_admin(
    request: AdminImportUsersRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(current_user)
    result = users_business.import_users_csv(
        csv_text=request.csv_text,
        actor_id=int(current_user["user_id"]),
    )
    if not result["success"]:
        raise HTTPException(
            status_code=_status_for_message(result["message"]),
            detail=result["message"],
        )
    return result

@router.get("/instructor/course-roster")
async def get_course_roster(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    role = (current_user.get("role") or "").lower()
    if role not in {"instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Instructor/admin access required")

    try:
        instructor_course_fk = current_user.get("course_fk")
        if role == "instructor" and instructor_course_fk is None:
            return {"success": True, "data": []}

        users_query = (
            supabase.table("users")
            .select("user_id,email,role,course_fk,home_department_fk,active_team_fk")
            .eq("role", "student")
            .order("course_fk")
            .order("email")
        )
        if role == "instructor":
            same_course_students = (
                supabase.table("users")
                .select("user_id")
                .eq("role", "student")
                .eq("course_fk", instructor_course_fk)
                .execute()
                .data
                or []
            )
            same_course_student_ids = {
                int(row["user_id"])
                for row in same_course_students
                if row.get("user_id") is not None
            }
            visible_student_ids = set(same_course_student_ids)

            if same_course_student_ids:
                scoped_team_rows = (
                    supabase.table("team_memberships")
                    .select("team_fk")
                    .in_("user_fk", sorted(same_course_student_ids))
                    .execute()
                    .data
                    or []
                )
                scoped_team_ids = {
                    int(row["team_fk"])
                    for row in scoped_team_rows
                    if row.get("team_fk") is not None
                }
                if scoped_team_ids:
                    teammate_rows = (
                        supabase.table("team_memberships")
                        .select("user_fk")
                        .in_("team_fk", sorted(scoped_team_ids))
                        .execute()
                        .data
                        or []
                    )
                    visible_student_ids.update(
                        int(row["user_fk"])
                        for row in teammate_rows
                        if row.get("user_fk") is not None
                    )

            if not visible_student_ids:
                return {"success": True, "data": []}
            users_query = users_query.in_("user_id", sorted(visible_student_ids))
        students = users_query.execute().data or []

        department_ids = sorted(
            {
                int(student.get("home_department_fk"))
                for student in students
                if student.get("home_department_fk") is not None
            }
        )
        departments_map: Dict[int, Dict[str, Any]] = {}
        if department_ids:
            departments_res = (
                supabase.table("departments")
                .select("department_id,name,active")
                .in_("department_id", department_ids)
                .execute()
            )
            departments_map = {
                int(department["department_id"]): department
                for department in departments_res.data or []
                if department.get("department_id") is not None
            }

        team_ids = sorted(
            {
                int(student.get("active_team_fk"))
                for student in students
                if student.get("active_team_fk") is not None
            }
        )
        teams_map: Dict[int, Dict[str, Any]] = {}
        capstones_map: Dict[int, Dict[str, Any]] = {}

        if team_ids:
            teams_res = (
                supabase.table("teams")
                .select("team_id,leader_fk,status,course_fk,capstone_fk")
                .in_("team_id", team_ids)
                .execute()
            )
            for team in teams_res.data or []:
                team["members"] = get_team_member_ids(int(team["team_id"]), fallback_team=team)
                teams_map[int(team["team_id"])] = team

            capstone_ids = sorted(
                {
                    int(team.get("capstone_fk"))
                    for team in teams_map.values()
                    if team.get("capstone_fk") is not None
                }
            )
            if capstone_ids:
                capstones_res = (
                    supabase.table("capstones")
                    .select("capstone_id,title,status,approval,course_fk")
                    .in_("capstone_id", capstone_ids)
                    .execute()
                )
                for capstone in capstones_res.data or []:
                    capstones_map[int(capstone["capstone_id"])] = capstone

        enriched_students = []
        for student in students:
            team_fk = student.get("active_team_fk")
            team = teams_map.get(int(team_fk)) if team_fk is not None else None
            capstone = None
            if team and team.get("capstone_fk") is not None:
                capstone = capstones_map.get(int(team["capstone_fk"]))
            enriched_students.append(
                {
                    "user_id": student.get("user_id"),
                    "email": student.get("email"),
                    "course_fk": student.get("course_fk"),
                    "home_department_fk": student.get("home_department_fk"),
                    "home_department_id": student.get("home_department_fk"),
                    "home_department": departments_map.get(int(student["home_department_fk"]))
                    if student.get("home_department_fk") is not None
                    else None,
                    "active_team_fk": team_fk,
                    "team": team,
                    "capstone": capstone,
                }
            )

        return {"success": True, "data": enriched_students}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id:int}")
async def get_user_by_id(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get a user by identifier."""
    try:
        role = (current_user.get("role") or "").lower()
        if role not in {"instructor", "admin"}:
            raise HTTPException(status_code=403, detail="Instructor/admin access required")
        result = users_business.get_user_by_id(user_id)

        if not result["success"]:
            message = result["message"]
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=message)
            raise HTTPException(status_code=400, detail=message)

        if role == "instructor":
            user = result.get("data") or {}
            visible_ids = _instructor_visible_student_ids(current_user.get("course_fk"))
            if user.get("role") != "student" or int(user.get("user_id")) not in visible_ids:
                raise HTTPException(status_code=403, detail="Forbidden for this user")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Instructor team creation failed")
        raise HTTPException(status_code=500, detail=str(e))
