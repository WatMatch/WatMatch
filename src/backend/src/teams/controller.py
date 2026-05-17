from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from .teams_bl import TeamsBusinessLogic
from typing import Dict, Any, Optional

router = APIRouter(prefix="/teams", tags=["teams"])
teams_business = TeamsBusinessLogic()


class CreateTeamRequest(BaseModel):
    leader_id: int
    capstone_id: Optional[int] = None


class LeaveTeamRequest(BaseModel):
    user_id: int
    team_id: int


class AcceptMemberRequest(BaseModel):
    leader_id: int
    student_id: int
    team_id: int


class RejectMemberRequest(BaseModel):
    leader_id: int
    student_id: int
    team_id: int


class RemoveMemberRequest(BaseModel):
    leader_id: int
    student_id: int
    team_id: int


@router.get("/")
async def get_all_teams(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100)
) -> Dict[str, Any]:
    """Retrieve all teams with optional pagination."""
    try:
        if (page is None) != (page_size is None):
            raise HTTPException(
                status_code=400,
                detail="Both 'page' and 'page_size' must be provided together for pagination"
            )

        result = teams_business.get_all_teams(page, page_size)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create")
async def create_team(request: CreateTeamRequest) -> Dict[str, Any]:
    """
    Create a new team with the specified leader.

    What it does:
    - Creates a new team with the provided leader
    - Associates team with capstone if capstone_id is provided
    - Initializes team with leader as the only member
    - Sets team status to "forming"
    """
    try:
        result = teams_business.create_team(
            leader_id=request.leader_id,
            capstone_id=request.capstone_id
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            else:
                raise HTTPException(status_code=400, detail=result["message"])

        return {
            "success": True,
            "message": result["message"],
            "data": result["data"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error_message": str(e)
        }


@router.post("/leave")
async def leave_team(request: LeaveTeamRequest) -> Dict[str, Any]:
    """
    Allow a user to leave a team.

    What it does:
    - Regular members: Removes user from team membership arrays
    - Team leaders: Deletes entire team and associated capstone project
    - Handles cascade deletion when leader leaves
    """
    try:
        result = teams_business.leave_team(
            user_id=request.user_id,
            team_id=request.team_id
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            else:
                raise HTTPException(status_code=400, detail=result["message"])

        return {
            "success": True,
            "message": result["message"],
            "data": result["data"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error_message": str(e)
        }


@router.post("/accept")
async def accept_member(request: AcceptMemberRequest) -> Dict[str, Any]:
    """
    Allow a team leader to accept an interested student as a full member.

    What it does:
    - Validates that the caller is the team leader
    - Validates that the student has expressed interest
    - Validates that the student is not already in another team
    - Moves the student to the members array
    - Removes ALL interest records for this student (from all teams)
    - Triggers an email notification to the student
    """
    try:
        print(f"🔍 Accept member request: leader_id={request.leader_id}, student_id={request.student_id}, team_id={request.team_id}")
        
        result = teams_business.accept_member(
            leader_id=request.leader_id,
            student_id=request.student_id,
            team_id=request.team_id,
        )

        print(f"📊 Accept member result: {result}")

        if not result["success"]:
            msg = result["message"].lower()
            print(f"❌ Accept failed: {result['message']}")
            if "not found" in msg:
                raise HTTPException(status_code=404, detail=result["message"])
            if "forbidden" in msg:
                raise HTTPException(status_code=403, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return {
            "success": True,
            "message": result["message"],
            "data": result["data"],
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"💥 Error occurred: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error_message": str(e),
        }

@router.post("/reject")
async def reject_member(request: RejectMemberRequest) -> Dict[str, Any]:
    """
    Allow a team leader to reject an interested student.

    What it does:
    - Validates that the caller is the team leader
    - Removes the student's interest record from team_interest table
    - Student can re-apply later if they choose
    """
    try:
        result = teams_business.reject_member(
            leader_id=request.leader_id,
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
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error_message": str(e),
        }


@router.post("/remove")
async def remove_member(request: RemoveMemberRequest) -> Dict[str, Any]:
    """
    Allow a team leader to remove an existing team member.

    What it does:
    - Validates that the caller is the team leader
    - Validates that the target is a current member
    - Removes the member from the members array
    - Leader cannot remove themselves (must use leave instead)
    """
    try:
        result = teams_business.remove_member(
            leader_id=request.leader_id,
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
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        return {
            "success": False,
            "error_type": type(e).__name__,
            "error_message": str(e),
        }