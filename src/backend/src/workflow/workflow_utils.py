from __future__ import annotations

from typing import Any, Dict, List, Optional

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


def is_user_team_participant(
    user_id: int,
    team_id: int,
    fallback_team: Optional[Dict[str, Any]] = None,
) -> bool:
    return is_user_team_member(user_id, team_id, fallback_team=fallback_team)


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


def is_instructor_scoped_to_team(instructor_id: int, team: Dict[str, Any]) -> bool:
    instructor_course_fk = get_user_course_fk(instructor_id)
    if instructor_course_fk is None:
        return False
    target_course_fk = team.get("course_fk")
    return target_course_fk is not None and int(target_course_fk) == int(instructor_course_fk)

