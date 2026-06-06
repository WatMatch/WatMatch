from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from ..config.database import supabase


def get_team_member_ids(team_id: int, fallback_team: Optional[Dict[str, Any]] = None) -> List[int]:
    """Return canonical team members from team_memberships."""
    rows = (
        supabase.table("team_memberships")
        .select("user_fk,created_at")
        .eq("team_fk", team_id)
        .order("created_at")
        .execute()
    ).data or []
    return [int(row["user_fk"]) for row in rows if row.get("user_fk") is not None]


def is_user_team_member(user_id: int, team_id: int, fallback_team: Optional[Dict[str, Any]] = None) -> bool:
    return int(user_id) in set(get_team_member_ids(team_id, fallback_team=fallback_team))


def get_user_course_fk(user_id: int) -> Optional[int]:
    res = (
        supabase.table("users")
        .select("course_fk")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = (res.data or [None])[0]
    if not row:
        return None
    course_fk = row.get("course_fk")
    return int(course_fk) if course_fk is not None else None


def get_team_member_course_fks(team: Dict[str, Any]) -> List[int]:
    team_id = team.get("team_id")
    members: List[int] = []
    if team_id is not None:
        members = get_team_member_ids(int(team_id), fallback_team=team)
    if not members:
        return []
    users_res = (
        supabase.table("users")
        .select("user_id,course_fk")
        .in_("user_id", members)
        .execute()
    )
    course_fks: Set[int] = set()
    for row in users_res.data or []:
        course_fk = row.get("course_fk")
        if course_fk is not None:
            course_fks.add(int(course_fk))
    return sorted(course_fks)


def is_instructor_scoped_to_team(instructor_id: int, team: Dict[str, Any]) -> bool:
    instructor_course_fk = get_user_course_fk(instructor_id)
    if instructor_course_fk is None:
        return False
    member_courses = get_team_member_course_fks(team)
    return int(instructor_course_fk) in {int(course_fk) for course_fk in member_courses}

