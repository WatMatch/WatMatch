from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

from .teams_bl import TeamsBusinessLogic
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/teams", tags=["teams"])
teams_business = TeamsBusinessLogic()


class LeaveTeamRequest(BaseModel):
    team_id: int


class AcceptMemberRequest(BaseModel):
    student_id: int
    team_id: int


class RejectMemberRequest(BaseModel):
    student_id: int
    team_id: int
    reason: Optional[str] = Field(default=None, max_length=2000)


class RemoveMemberRequest(BaseModel):
    student_id: int
    team_id: int


class DeleteTeamRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=2000)


class PrivilegedMemberUpdateRequest(BaseModel):
    student_id: int
    reason: Optional[str] = Field(default=None, max_length=2000)


class ReassignLeaderRequest(BaseModel):
    new_leader_id: int
    reason: Optional[str] = Field(default=None, max_length=2000)


class FinalizeTeamRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=2000)


class ManagedTeamCreateRequest(BaseModel):
    student_ids: List[int] = Field(..., min_length=1, max_length=20)
    leader_id: int
    reason: Optional[str] = Field(default=None, max_length=2000)


@router.get("/capstone/{capstone_id}/context")
async def get_capstone_team_context(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    result = teams_business.get_capstone_team_context(
        capstone_id=capstone_id,
        actor_id=int(current_user["user_id"]),
        actor_role=current_user.get("role") or "",
    )
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in message or "access required" in message:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/create-empty")
async def create_empty_team(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can create teams")

    user_id = current_user.get("user_id")
    course_fk = current_user.get("course_fk")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authenticated user")
    if course_fk is None:
        raise HTTPException(status_code=400, detail="Your account must be assigned to a course before creating a team")

    result = teams_business.create_team(leader_id=user_id, course_id=course_fk)
    if not result["success"]:
        message = result["message"].lower()
        if "not found" in message:
            raise HTTPException(status_code=404, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/create-managed")
async def create_managed_team(
    request: ManagedTeamCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    role = (current_user.get("role") or "").lower()
    if role not in {"admin", "instructor"}:
        raise HTTPException(status_code=403, detail="Only admins/instructors can create managed teams")

    result = teams_business.create_managed_team(
        student_ids=request.student_ids,
        leader_id=request.leader_id,
        actor_id=current_user.get("user_id"),
        actor_role=role,
        reason=request.reason,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg or "instructor-created" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/")
async def get_all_teams(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    role = (current_user.get("role") or "").lower()
    if role not in {"instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Instructor/admin access required")
    if (page is None) != (page_size is None):
        raise HTTPException(
            status_code=400,
            detail="Both 'page' and 'page_size' must be provided together for pagination",
        )
    result = teams_business.get_all_teams(
        page,
        page_size,
        actor_role=current_user.get("role"),
        actor_id=current_user.get("user_id"),
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])
    return result


@router.post("/leave")
async def leave_team(
    request: LeaveTeamRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can leave teams")
    result = teams_business.leave_team(user_id=current_user.get("user_id"), team_id=request.team_id)
    if not result["success"]:
        if "not found" in result["message"].lower():
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in result["message"].lower():
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return {
        "success": True,
        "message": result["message"],
        "data": result["data"],
    }


@router.post("/{team_id}/abandon-solo-project")
async def abandon_solo_project(
    team_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can abandon their own solo project")
    result = teams_business.abandon_solo_project(
        user_id=current_user.get("user_id"),
        team_id=team_id,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/accept")
async def accept_member(
    request: AcceptMemberRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can accept members to teams")
    result = teams_business.accept_member(
        leader_id=current_user.get("user_id"),
        student_id=request.student_id,
        team_id=request.team_id,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return {
        "success": True,
        "message": result["message"],
        "data": result["data"],
        "marketplace_exploration": result.get("marketplace_exploration") is True,
        "exploration": result.get("exploration"),
    }


@router.post("/reject")
async def reject_member(
    request: RejectMemberRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can reject requests")
    result = teams_business.reject_member(
        leader_id=current_user.get("user_id"),
        student_id=request.student_id,
        team_id=request.team_id,
        reason=request.reason,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return {"success": True, "message": result["message"]}


@router.post("/remove")
async def remove_member(
    request: RemoveMemberRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can remove members")
    result = teams_business.remove_member(
        leader_id=current_user.get("user_id"),
        student_id=request.student_id,
        team_id=request.team_id,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return {"success": True, "message": result["message"], "data": result["data"]}


@router.post("/{team_id}/disband")
async def delete_team(
    team_id: int,
    request: Optional[DeleteTeamRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") not in {"admin", "instructor"}:
        raise HTTPException(status_code=403, detail="Only admins/instructors can disband teams")

    result = teams_business.delete_team_as_privileged(
        team_id=team_id,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        reason=request.reason if request else None,
    )

    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/{team_id}/add-member")
async def add_member_privileged(
    team_id: int,
    request: PrivilegedMemberUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") not in {"admin", "instructor"}:
        raise HTTPException(status_code=403, detail="Only admins/instructors can modify teams")
    result = teams_business.add_member_as_privileged(
        team_id=team_id,
        student_id=request.student_id,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        reason=request.reason,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/{team_id}/remove-member")
async def remove_member_privileged(
    team_id: int,
    request: PrivilegedMemberUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    if current_user.get("role") not in {"admin", "instructor"}:
        raise HTTPException(status_code=403, detail="Only admins/instructors can modify teams")
    result = teams_business.remove_member_as_privileged(
        team_id=team_id,
        student_id=request.student_id,
        actor_id=current_user.get("user_id"),
        actor_role=current_user.get("role"),
        reason=request.reason,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/{team_id}/reassign-leader")
async def reassign_team_leader(
    team_id: int,
    request: ReassignLeaderRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    role = (current_user.get("role") or "").lower()
    if role not in {"student", "instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Only students, instructors, or admins can reassign leadership")
    result = teams_business.reassign_leader(
        team_id=team_id,
        requester_id=current_user.get("user_id"),
        requester_role=role,
        new_leader_id=request.new_leader_id,
        reason=request.reason,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/{team_id}/finalize")
async def finalize_team(
    team_id: int,
    request: Optional[FinalizeTeamRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    role = (current_user.get("role") or "").lower()
    if role not in {"student", "instructor", "admin"}:
        raise HTTPException(status_code=403, detail="Team leader, scoped instructor, or admin access required to finalize recruiting")
    result = teams_business.finalize_team(
        team_id=team_id,
        actor_id=current_user.get("user_id"),
        actor_role=role,
        reason=request.reason if request else None,
    )
    if not result["success"]:
        msg = result["message"].lower()
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=result["message"])
        if "forbidden" in msg:
            raise HTTPException(status_code=403, detail=result["message"])
        raise HTTPException(status_code=400, detail=result["message"])
    return result
