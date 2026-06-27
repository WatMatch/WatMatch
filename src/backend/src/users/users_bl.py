import csv
import io
from typing import Dict, Any, Optional

from .users_dl import UsersDataLogic
from src.config.database import supabase


def _required_audit_reason(reason: Optional[str]) -> str | None:
    trimmed = reason.strip() if reason and reason.strip() else None
    if not trimmed:
        return None
    return trimmed


class UsersBusinessLogic:
    """Business layer for users operations."""

    def __init__(self) -> None:
        self.users_data = UsersDataLogic()

    def get_user_by_id(self, user_id: int) -> Dict[str, Any]:
        """Return user by identifier with validation."""
        try:
            if not isinstance(user_id, int) or user_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid user ID. Must be a positive integer.",
                    "data": None,
                }

            user = self.users_data.get_user_by_id(user_id)
            if not user:
                return {
                    "success": False,
                    "message": f"User with ID {user_id} not found.",
                    "data": None,
                }

            return {
                "success": True,
                "message": "User retrieved successfully.",
                "data": self._process_user(user),
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def get_users(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Return list of users with optional pagination."""
        try:
            result = self.users_data.get_users(page, page_size)
            users = result["data"]

            processed_users = [self._process_user(user) for user in users]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed_users)} user(s).",
                "data": processed_users,
            }

            if page is not None and page_size is not None:
                total = result.get("total")
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size

                response.update(
                    {
                        "page": page,
                        "page_size": page_size,
                        "total": total,
                        "total_pages": total_pages,
                    }
                )

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def list_users_for_admin(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
    ) -> Dict[str, Any]:
        try:
            result = self.users_data.list_users_for_admin(page, page_size)
            users = result.get("data", [])
            response = {
                "success": True,
                "message": f"Retrieved {len(users)} user(s).",
                "data": users,
            }
            if page is not None and page_size is not None:
                total = int(result.get("total") or 0)
                response.update({
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size,
                })
            return response
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def create_user(
        self,
        email: str,
        role: str,
        course_id: Optional[int],
        home_department_id: Optional[int],
        active: bool,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not email or not email.strip():
            return {"success": False, "message": "User email is required.", "data": None}
        normalized_role = (role or "").strip().lower()
        staff_roles = {"admin", "academic_advisor", "enrollment_operator", "external_partner", "mentor"}
        if normalized_role not in {"student", "instructor", *staff_roles}:
            return {"success": False, "message": "Role must be student, instructor, admin, academic_advisor, enrollment_operator, external_partner, or mentor.", "data": None}
        if normalized_role in {"student", "instructor"} and home_department_id is None:
            return {"success": False, "message": "Home department is required for students and instructors.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}
        trimmed_reason = _required_audit_reason(reason)
        if not trimmed_reason:
            return {"success": False, "message": "An audit reason is required when creating a user.", "data": None}

        try:
            return self.users_data.create_user_rpc(
                email=email.strip().lower(),
                role=normalized_role,
                course_id=None if normalized_role in staff_roles else course_id,
                home_department_id=None if normalized_role in staff_roles else home_department_id,
                active=bool(active),
                actor_id=actor_id,
                reason=trimmed_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def set_user_course(
        self,
        user_id: int,
        course_id: Optional[int],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not isinstance(user_id, int) or user_id <= 0:
            return {"success": False, "message": "Invalid user ID.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}
        trimmed_reason = _required_audit_reason(reason)
        if not trimmed_reason:
            return {"success": False, "message": "An audit reason is required when changing a user course.", "data": None}

        try:
            return self.users_data.set_user_course_rpc(
                user_id=user_id,
                course_id=course_id,
                actor_id=actor_id,
                reason=trimmed_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def set_user_active(
        self,
        user_id: int,
        active: bool,
        actor_id: int,
        force: bool = False,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not isinstance(user_id, int) or user_id <= 0:
            return {"success": False, "message": "Invalid user ID.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}
        trimmed_reason = _required_audit_reason(reason)
        if not trimmed_reason:
            return {"success": False, "message": "An audit reason is required when changing user active status.", "data": None}

        try:
            return self.users_data.set_user_active_rpc(
                user_id=user_id,
                active=bool(active),
                actor_id=actor_id,
                force=bool(force),
                reason=trimmed_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def update_user(
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
        if not isinstance(user_id, int) or user_id <= 0:
            return {"success": False, "message": "Invalid user ID.", "data": None}
        if not email or not email.strip():
            return {"success": False, "message": "User email is required.", "data": None}
        normalized_role = (role or "").strip().lower()
        staff_roles = {"admin", "academic_advisor", "enrollment_operator", "external_partner", "mentor"}
        if normalized_role not in {"student", "instructor", *staff_roles}:
            return {"success": False, "message": "Role must be student, instructor, admin, academic_advisor, enrollment_operator, external_partner, or mentor.", "data": None}
        if normalized_role in {"student", "instructor"} and home_department_id is None:
            return {"success": False, "message": "Home department is required for students and instructors.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}
        trimmed_reason = _required_audit_reason(reason)
        if not trimmed_reason:
            return {"success": False, "message": "An audit reason is required when updating a user.", "data": None}

        try:
            return self.users_data.update_user_rpc(
                user_id=user_id,
                email=email.strip().lower(),
                role=normalized_role,
                course_id=None if normalized_role in staff_roles else course_id,
                home_department_id=None if normalized_role in staff_roles else home_department_id,
                active=bool(active),
                actor_id=actor_id,
                reason=trimmed_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def delete_user(
        self,
        user_id: int,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not isinstance(user_id, int) or user_id <= 0:
            return {"success": False, "message": "Invalid user ID.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}
        trimmed_reason = _required_audit_reason(reason)
        if not trimmed_reason:
            return {"success": False, "message": "An audit reason is required when deleting a user.", "data": None}

        try:
            return self.users_data.delete_user_rpc(
                user_id=user_id,
                actor_id=actor_id,
                reason=trimmed_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def import_users_csv(self, csv_text: str, actor_id: int) -> Dict[str, Any]:
        if not csv_text or not csv_text.strip():
            return {"success": False, "message": "CSV content is required.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}

        try:
            reader = csv.DictReader(io.StringIO(csv_text.strip()))
            headers = {
                header.strip().lstrip("\ufeff").lower()
                for header in (reader.fieldnames or [])
                if header
            }
            if "email" not in headers:
                return {
                    "success": False,
                    "message": "CSV must include an email header.",
                    "data": None,
                }

            summary: Dict[str, Any] = {
                "created": 0,
                "updated": 0,
                "unchanged": 0,
                "errors": [],
            }

            courses = (
                supabase.table("courses")
                .select("course_id,code,active")
                .execute()
                .data
                or []
            )
            courses_by_code: Dict[str, Dict[int, Dict[str, Any]]] = {}
            for course in courses:
                raw_code = str(course.get("code") or "").strip().upper()
                course_id = course.get("course_id")
                if not raw_code or course_id is None:
                    continue
                for alias in {raw_code, raw_code.replace(" ", "")}:
                    courses_by_code.setdefault(alias, {})[int(course_id)] = course

            departments = (
                supabase.table("departments")
                .select("department_id,name,active")
                .execute()
                .data
                or []
            )
            departments_by_name = {
                str(department.get("name") or "").strip().lower(): department
                for department in departments
                if department.get("department_id") is not None
            }
            departments_by_id = {
                int(department["department_id"]): department
                for department in departments
                if department.get("department_id") is not None
            }

            for row_number, row in enumerate(reader, start=2):
                normalized_row = {
                    (key or "").strip().lstrip("\ufeff").lower(): (value or "").strip()
                    for key, value in row.items()
                }
                email = normalized_row.get("email", "").lower()
                role = (normalized_row.get("role") or "student").lower()
                course_code = (normalized_row.get("course_code") or "").upper()
                department_name = normalized_row.get("home_department") or normalized_row.get("department")
                department_id_text = normalized_row.get("home_department_id") or normalized_row.get("department_id")
                active_text = (normalized_row.get("active") or "true").lower()

                if not email:
                    summary["errors"].append({"row": row_number, "error": "Missing email."})
                    continue
                staff_roles = {"admin", "academic_advisor", "enrollment_operator", "external_partner", "mentor"}
                if role not in {"student", "instructor", *staff_roles}:
                    summary["errors"].append({"row": row_number, "email": email, "error": "Invalid role."})
                    continue
                if active_text not in {"true", "false", "1", "0", "yes", "no"}:
                    summary["errors"].append({"row": row_number, "email": email, "error": "Invalid active value."})
                    continue

                active = active_text in {"true", "1", "yes"}
                course_id: Optional[int] = None
                home_department_id: Optional[int] = None
                if course_code and role in {"student", "instructor"}:
                    matches = list(
                        (
                            courses_by_code.get(course_code)
                            or courses_by_code.get(course_code.replace(" ", ""))
                            or {}
                        ).values()
                    )
                    if not matches:
                        summary["errors"].append({
                            "row": row_number,
                            "email": email,
                            "error": f"Course code {course_code} was not found.",
                        })
                        continue
                    course_id = int(matches[0]["course_id"])
                elif course_code and role in staff_roles:
                    summary["errors"].append({
                        "row": row_number,
                        "email": email,
                        "error": "Admins, academic advisors, enrollment operators, external partners, and mentors cannot be assigned to a course.",
                    })
                    continue

                if role in {"student", "instructor"}:
                    if department_id_text:
                        try:
                            parsed_department_id = int(department_id_text)
                        except ValueError:
                            summary["errors"].append({
                                "row": row_number,
                                "email": email,
                                "error": "Invalid home_department_id.",
                            })
                            continue
                        department = departments_by_id.get(parsed_department_id)
                    else:
                        department = departments_by_name.get((department_name or "").strip().lower())

                    if not department:
                        summary["errors"].append({
                            "row": row_number,
                            "email": email,
                            "error": "Home department was not found.",
                        })
                        continue
                    if department.get("active") is False:
                        summary["errors"].append({
                            "row": row_number,
                            "email": email,
                            "error": "Home department is inactive.",
                        })
                        continue
                    home_department_id = int(department["department_id"])
                elif department_name or department_id_text:
                    summary["errors"].append({
                        "row": row_number,
                        "email": email,
                    "error": "Admins, academic advisors, enrollment operators, external partners, and mentors cannot be assigned a home department.",
                    })
                    continue

                existing = self.users_data.get_user_by_email(email)
                if existing:
                    result = self.update_user(
                        user_id=int(existing["user_id"]),
                        email=email,
                        role=role,
                        course_id=course_id,
                        home_department_id=home_department_id,
                        active=active,
                        actor_id=actor_id,
                        reason="csv_import",
                    )
                else:
                    result = self.create_user(
                        email=email,
                        role=role,
                        course_id=course_id,
                        home_department_id=home_department_id,
                        active=active,
                        actor_id=actor_id,
                        reason="csv_import",
                    )

                if not result.get("success"):
                    summary["errors"].append({
                        "row": row_number,
                        "email": email,
                        "error": result.get("message", "Import failed."),
                    })
                    continue

                if not existing:
                    summary["created"] += 1
                elif (
                    existing.get("role") == role
                    and existing.get("course_fk") == course_id
                    and existing.get("home_department_fk") == home_department_id
                    and existing.get("active") is active
                ):
                    summary["unchanged"] += 1
                else:
                    summary["updated"] += 1

            return {
                "success": True,
                "message": "User import processed.",
                "data": summary,
            }
        except csv.Error as e:
            return {"success": False, "message": f"CSV parse error: {str(e)}", "data": None}
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def _process_user(self, user: Dict[Any, Any]) -> Dict[Any, Any]:
        enriched = dict(user)
        enriched["home_department_id"] = enriched.get("home_department_fk")
        enriched["home_department"] = None
        if enriched.get("home_department_fk") is not None:
            try:
                department = (
                    supabase.table("departments")
                    .select("department_id,name,active")
                    .eq("department_id", enriched.get("home_department_fk"))
                    .limit(1)
                    .execute()
                    .data
                    or [None]
                )[0]
                enriched["home_department"] = department
            except Exception:
                enriched["home_department"] = None
        enriched["source"] = "watmatch-server"
        return enriched
