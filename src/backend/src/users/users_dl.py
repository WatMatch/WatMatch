from typing import Optional, Dict, Any

from src.config.database import supabase
from src.workflow.rpc_utils import call_json_rpc


class UsersDataLogic:
    """Data layer for users operations."""

    def __init__(self) -> None:
        self.table_name = "users"

    def get_user_by_id(self, user_id: int) -> Optional[Dict[Any, Any]]:
        """Retrieve a single user by identifier."""
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            raise Exception(
                f"Database error in get_user_by_id: {str(e)}") from e

    def get_users(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Retrieve users with optional pagination."""
        try:
            if page is not None and page_size is not None:
                start = (page - 1) * page_size
                end = start + page_size - 1

                try:
                    response = (
                        supabase.table(self.table_name)
                        .select("*", count="exact")
                        .range(start, end)
                        .execute()
                    )
                except TypeError:
                    response = (
                        supabase.table(self.table_name)
                        .select("*")
                        .range(start, end)
                        .execute()
                    )

                data = getattr(response, "data", []) or []
                total = getattr(response, "count", None)

                if total is None:
                    try:
                        count_response = (
                            supabase.table(self.table_name)
                            .select("user_id", count="exact")
                            .execute()
                        )
                        total = getattr(count_response, "count", None)
                    except Exception:
                        total = None

                return {
                    "data": data,
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                }

            response = supabase.table(self.table_name).select("*").execute()
            data = response.data if response.data else []

            return {
                "data": data,
                "total": len(data),
                "page": None,
                "page_size": None,
            }

        except Exception as e:
            raise Exception(f"Database error in get_users: {str(e)}") from e

    def get_user_by_email(self, email: str) -> Optional[Dict[Any, Any]]:
        try:
            response = (
                supabase.table(self.table_name)
                .select("*")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            return (response.data or [None])[0]
        except Exception as e:
            raise Exception(f"Database error in get_user_by_email: {str(e)}") from e

    def list_users_for_admin(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        try:
            query = (
                supabase.table(self.table_name)
                .select("user_id,email,role,course_fk,home_department_fk,active_team_fk,active,created_at", count="exact")
                .order("role")
                .order("email")
            )
            if page is not None and page_size is not None:
                start = (page - 1) * page_size
                query = query.range(start, start + page_size - 1)
            response = query.execute()
            users = response.data or []
            total = int(response.count or len(users))

            course_ids = sorted({
                user.get("course_fk")
                for user in users
                if user.get("course_fk") is not None
            })
            courses_map: Dict[int, Dict[str, Any]] = {}
            if course_ids:
                courses = (
                    supabase.table("courses")
                    .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind,requires_project_support")
                    .in_("course_id", course_ids)
                    .execute()
                    .data
                    or []
                )
                courses_map = {
                    course["course_id"]: course
                    for course in courses
                    if course.get("course_id") is not None
                }

            department_ids = sorted({
                user.get("home_department_fk")
                for user in users
                if user.get("home_department_fk") is not None
            })
            departments_map: Dict[int, Dict[str, Any]] = {}
            if department_ids:
                departments = (
                    supabase.table("departments")
                    .select("department_id,name,active")
                    .in_("department_id", department_ids)
                    .execute()
                    .data
                    or []
                )
                departments_map = {
                    department["department_id"]: department
                    for department in departments
                    if department.get("department_id") is not None
                }

            enriched_users = [
                {
                    **user,
                    "course": courses_map.get(user.get("course_fk")),
                    "home_department_id": user.get("home_department_fk"),
                    "home_department": departments_map.get(user.get("home_department_fk")),
                }
                for user in users
            ]
            return {"data": enriched_users, "total": total}
        except Exception as e:
            raise Exception(f"Database error in list_users_for_admin: {str(e)}") from e

    def create_user_rpc(
        self,
        email: str,
        role: str,
        course_id: Optional[int],
        home_department_id: Optional[int],
        active: bool,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_admin_create_user",
                {
                    "p_email": email,
                    "p_role": role,
                    "p_course_id": course_id,
                    "p_home_department_id": home_department_id,
                    "p_actor_id": actor_id,
                    "p_active": active,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in create_user_rpc: {str(e)}") from e

    def set_user_course_rpc(
        self,
        user_id: int,
        course_id: Optional[int],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_admin_set_user_course",
                {
                    "p_user_id": user_id,
                    "p_course_id": course_id,
                    "p_actor_id": actor_id,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in set_user_course_rpc: {str(e)}") from e

    def set_user_active_rpc(
        self,
        user_id: int,
        active: bool,
        actor_id: int,
        force: bool = False,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_admin_set_user_active",
                {
                    "p_user_id": user_id,
                    "p_active": active,
                    "p_actor_id": actor_id,
                    "p_force": force,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in set_user_active_rpc: {str(e)}") from e

    def update_user_rpc(
        self,
        user_id: int,
        email: str,
        role: str,
        course_id: Optional[int],
        home_department_id: Optional[int],
        active: bool,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_admin_update_user",
                {
                    "p_user_id": user_id,
                    "p_email": email,
                    "p_role": role,
                    "p_course_id": course_id,
                    "p_home_department_id": home_department_id,
                    "p_active": active,
                    "p_actor_id": actor_id,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in update_user_rpc: {str(e)}") from e

    def delete_user_rpc(
        self,
        user_id: int,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return call_json_rpc(
                "watmatch_admin_delete_user",
                {
                    "p_user_id": user_id,
                    "p_actor_id": actor_id,
                    "p_reason": reason,
                },
            )
        except Exception as e:
            raise Exception(f"Database error in delete_user_rpc: {str(e)}") from e
