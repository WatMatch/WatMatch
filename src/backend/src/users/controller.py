from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, Optional

from .users_bl import UsersBusinessLogic
from ..auth.controller import get_current_user
from ..interests.interests_dl import InterestsDL
from ..config.database import supabase

router = APIRouter(prefix="/users", tags=["users"])
users_business = UsersBusinessLogic()
interests_dl = InterestsDL()


@router.get("/")
async def get_users(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100)
) -> Dict[str, Any]:
    """Get users with optional pagination."""
    try:
        if (page is None) != (page_size is None):
            raise HTTPException(
                status_code=400,
                detail="Both 'page' and 'page_size' must be provided together for pagination"
            )

        result = users_business.get_users(page, page_size)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me/capstone")
async def get_my_capstone(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get current user's capstone project(s) and team information.
    
    Returns:
    - If user is a team leader: list of teams they lead (with projects, members, interested students)
    - If user is a team member: the team they're part of
    - If user has no team: empty list
    """
    try:
        user_id = current_user["user_id"]
        
        print(f"🔍 Fetching capstone(s) for user: {user_id}")
        
        # Check if user is a team leader (can be leader of multiple teams)
        leader_res = supabase.table("teams").select("*").eq("leader_fk", user_id).execute()
        leader_teams = leader_res.data if leader_res.data else []
        print(f"👑 Leader teams: {len(leader_teams)} team(s)")
        
        # Check if user is a team member (should only be in one team)
        member_res = supabase.table("teams").select("*").filter("members", "cs", f"{{{user_id}}}").execute()
        member_teams = member_res.data if member_res.data else []
        print(f"👥 Member teams: {len(member_teams)} team(s)")
        
        # If leader of any teams, process all of them
        if leader_teams:
            teams_data = []
            
            for team in leader_teams:
                team_id = team.get("team_id")
                capstone_id = team.get("capstone_fk")
                leader_fk = team.get("leader_fk")
                
                print(f"✅ Processing team: {team_id}, is_leader: True")
                
                # Get capstone details
                project = None
                if capstone_id:
                    print(f"🎓 Fetching capstone: {capstone_id}")
                    capstone_res = supabase.table("capstones").select("*").eq("capstone_id", capstone_id).execute()
                    if capstone_res.data:
                        capstone = capstone_res.data[0]
                        project = {
                            "capstone_id": str(capstone["capstone_id"]),
                            "title": capstone.get("title"),
                            "description": capstone.get("description"),
                            "status": capstone.get("status"),
                        }
                        print(f"✅ Capstone loaded: {project['title']}")
                else:
                    print(f"⚠️ No capstone associated with team {team_id}")
                
                # Get team members info
                member_ids = team.get("members", [])
                team_members = []
                if member_ids:
                    print(f"👥 Fetching members: {member_ids}")
                    members_res = supabase.table("users").select("user_id, email").in_("user_id", member_ids).execute()
                    team_members = members_res.data or []
                    print(f"✅ Members loaded: {len(team_members)}")
                
                # Get interested students (only if capstone exists)
                interested_students = []
                if capstone_id:
                    print(f"🔍 Fetching interested students for capstone: {capstone_id}")
                    try:
                        interest_result = interests_dl.get_interested_students(capstone_id)
                        print(f"📊 Interest result: {interest_result}")
                        if interest_result.get("success"):
                            interested_students = interest_result.get("data", [])
                            print(f"✅ Interested students: {len(interested_students)}")
                    except Exception as e:
                        print(f"❌ Error fetching interested students: {type(e).__name__}: {str(e)}")
                        # Don't raise, just skip this team's interested students
                
                teams_data.append({
                    "team_id": team_id,
                    "project": project,
                    "team_members": team_members,
                    "interested_students": interested_students,
                    "is_leader": True,
                    "leader_fk": leader_fk
                })
            
            return {
                "success": True,
                "teams": teams_data,
                "is_leader": True
            }
        
        # If not a leader but is a member of a team
        elif member_teams:
            team = member_teams[0]  # Should only be in one team as a member
            team_id = team.get("team_id")
            capstone_id = team.get("capstone_fk")
            leader_fk = team.get("leader_fk")

            print(f"✅ Team found: {team_id}, is_leader: False")
            
            # Get capstone details
            project = None
            if capstone_id:
                print(f"🎓 Fetching capstone: {capstone_id}")
                capstone_res = supabase.table("capstones").select("*").eq("capstone_id", capstone_id).execute()
                if capstone_res.data:
                    capstone = capstone_res.data[0]
                    project = {
                        "capstone_id": str(capstone["capstone_id"]),
                        "title": capstone.get("title"),
                        "description": capstone.get("description"),
                        "status": capstone.get("status"),
                    }
                    print(f"✅ Capstone loaded: {project['title']}")
            
            # Get team members info
            member_ids = team.get("members", [])
            team_members = []
            if member_ids:
                print(f"👥 Fetching members: {member_ids}")
                members_res = supabase.table("users").select("user_id, email").in_("user_id", member_ids).execute()
                team_members = members_res.data or []
                print(f"✅ Members loaded: {len(team_members)}")
            
            return {
                "success": True,
                "teams": [{
                    "team_id": team_id,
                    "project": project,
                    "team_members": team_members,
                    "interested_students": [],
                    "is_leader": False,
                    "leader_fk": leader_fk
                }],
                "is_leader": False
            }
        
        # No teams at all
        print("❌ No team found")
        return {
            "success": True,
            "teams": [],
            "is_leader": False
        }
        
    except Exception as e:
        print(f"💥 Error in get_my_capstone: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
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


@router.get("/{user_id}")
async def get_user_by_id(user_id: int) -> Dict[str, Any]:
    """Get a user by identifier."""
    try:
        result = users_business.get_user_by_id(user_id)

        if not result["success"]:
            message = result["message"]
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=message)
            raise HTTPException(status_code=400, detail=message)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))