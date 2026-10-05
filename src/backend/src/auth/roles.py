"""Assigned roles are durable; the signed token selects the active workspace."""
from fastapi import HTTPException
from src.config.database import supabase


SWITCHABLE_ROLES = frozenset({"instructor", "mentor"})


def assigned_roles(user_id: int) -> list[str]:
    rows = supabase.table("user_roles").select("role").eq("user_fk", user_id).execute().data or []
    return sorted({row["role"] for row in rows})


def resolve_active_role(user: dict, roles: list[str], selected: str | None = None) -> str:
    role = selected or user["role"]
    if role not in roles:
        raise HTTPException(status_code=403, detail="Active role is no longer assigned. Please log in again.")
    if role != user["role"] and {role, user["role"]} != SWITCHABLE_ROLES:
        raise HTTPException(status_code=403, detail="Role switching is not available for this account.")
    return role
