from .auth_dl import AuthDataLogic
from .roles import assigned_roles, resolve_active_role, SWITCHABLE_ROLES
from fastapi import HTTPException
from src.workflow.rpc_utils import call_json_rpc
from .jwt_utils import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token
)
from typing import Dict, Any
from datetime import datetime, timedelta
import hashlib
from src.config.database import supabase


class AuthBusinessLogic:
    """Business layer for authentication operations"""

    def __init__(self):
        self.auth_data = AuthDataLogic()

    def _enrich_course(self, user: Dict[str, Any], selected_role: str | None = None) -> Dict[str, Any]:
        user_response = dict(user)
        roles = assigned_roles(user["user_id"])
        active_role = resolve_active_role(user, roles, selected_role)
        user_response.update(assigned_roles=roles, default_role=user["role"], role=active_role, active_role=active_role)
        course_fk = user_response.get("course_fk")
        user_response["course"] = None
        user_response["course_active"] = None
        user_response["home_department"] = None
        user_response["home_department_id"] = user_response.get("home_department_fk")
        if course_fk is not None:
            try:
                course_res = (
                    supabase.table("courses")
                    .select("course_id,code,name,active,active_terms,activation_mode,department_fk,routing_kind,requires_project_support")
                    .eq("course_id", course_fk)
                    .limit(1)
                    .execute()
                )
                course = (course_res.data or [None])[0]
                user_response["course"] = course
                user_response["course_active"] = bool(course.get("active")) if course else False
            except Exception:
                user_response["course_active"] = False

        home_department_fk = user_response.get("home_department_fk")
        if home_department_fk is not None:
            try:
                department_res = (
                    supabase.table("departments")
                    .select("department_id,name,active")
                    .eq("department_id", home_department_fk)
                    .limit(1)
                    .execute()
                )
                user_response["home_department"] = (department_res.data or [None])[0]
            except Exception:
                user_response["home_department"] = None
        return user_response

    def login(self, email: str) -> Dict[str, Any]:
        """Authenticate an admin-provisioned local/demo user by email."""
        try:
            # Validate inputs
            if not email or not email.strip():
                return {
                    "success": False,
                    "message": "Email is required",
                    "data": None
                }

            # Get user
            user = self.auth_data.get_user_by_email(email.strip().lower())

            if not user:
                return {
                    "success": False,
                    "message": "User not found",
                    "data": None
                }
            if user.get("active") is False:
                return {
                    "success": False,
                    "message": "User account is inactive",
                    "data": None
                }

            active_role = resolve_active_role(user, assigned_roles(user["user_id"]))
            # Create tokens
            token_data = {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": active_role,
                "active_role": active_role,
                "course_fk": user.get("course_fk"),
                "home_department_fk": user.get("home_department_fk"),
            }

            access_token = create_access_token(token_data)
            refresh_token = create_refresh_token(token_data)

            # Store refresh token hash in user record
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            self.auth_data.update_refresh_token(user["user_id"], token_hash)

            # Remove refresh token from user data
            user_response = self._enrich_course({
                k: v for k, v in user.items() if k != "refresh_token"
            })

            return {
                "success": True,
                "message": "Login successful",
                "data": {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "token_type": "bearer",
                    "user": user_response
                }
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Login error: {str(e)}",
                "data": None
            }

    def refresh_tokens(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token with rotation"""
        try:
            # Verify refresh token
            payload = verify_refresh_token(refresh_token)

            if not payload:
                return {
                    "success": False,
                    "message": "Invalid or expired refresh token",
                    "data": None
                }

            # Check if token exists in database
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            user = self.auth_data.get_user_by_refresh_token(token_hash)

            if not user:
                return {
                    "success": False,
                    "message": "Refresh token not found or already used",
                    "data": None
                }
            if user.get("active") is False:
                return {
                    "success": False,
                    "message": "User account is inactive",
                    "data": None
                }

            # Verify user_id matches
            if user["user_id"] != payload.get("user_id"):
                return {
                    "success": False,
                    "message": "Invalid refresh token",
                    "data": None
                }

            active_role = resolve_active_role(user, assigned_roles(user["user_id"]), payload.get("active_role"))
            # Create new tokens
            token_data = {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": active_role,
                "active_role": active_role,
                "course_fk": user.get("course_fk"),
                "home_department_fk": user.get("home_department_fk"),
            }

            new_access_token = create_access_token(token_data)
            new_refresh_token = create_refresh_token(token_data)

            # Store new refresh token (token rotation)
            new_token_hash = hashlib.sha256(
                new_refresh_token.encode()).hexdigest()
            self.auth_data.update_refresh_token(
                user["user_id"], new_token_hash)

            return {
                "success": True,
                "message": "Tokens refreshed successfully",
                "data": {
                    "access_token": new_access_token,
                    "refresh_token": new_refresh_token,
                    "token_type": "bearer",
                    "user": self._enrich_course({k: v for k, v in user.items() if k != "refresh_token"}, active_role)
                }
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Token refresh error: {str(e)}",
                "data": None
            }

    def switch_role(self, user_id: int, from_role: str, target_role: str) -> Dict[str, Any]:
        user = self.auth_data.get_user_by_id(user_id)
        if not user or user.get("active") is not True:
            raise HTTPException(status_code=403, detail="User account is inactive")
        roles = assigned_roles(user_id)
        if target_role not in SWITCHABLE_ROLES or from_role not in SWITCHABLE_ROLES or target_role not in roles:
            raise HTTPException(status_code=403, detail="This role is not assigned to your account.")
        active_role = resolve_active_role(user, roles, target_role)
        # The RPC rechecks membership under a user-row lock and records the actor.
        result = call_json_rpc("watmatch_record_role_switch", {
            "p_user_id": user_id, "p_from_role": from_role, "p_to_role": target_role,
        })
        if not result.get("success"):
            raise HTTPException(status_code=403, detail=result.get("message", "Role switch denied."))
        token_data = {"user_id": user_id, "email": user["email"], "role": active_role, "active_role": active_role}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        self.auth_data.update_refresh_token(user_id, hashlib.sha256(refresh_token.encode()).hexdigest())
        return {"success": True, "data": {
            "access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer",
            "user": self._enrich_course({k: v for k, v in user.items() if k != "refresh_token"}, active_role),
        }}

    def logout(self, refresh_token: str) -> Dict[str, Any]:
        """Logout user by invalidating refresh token"""
        try:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            user = self.auth_data.get_user_by_refresh_token(token_hash)

            if user:
                self.auth_data.update_refresh_token(user["user_id"], None)

            return {
                "success": True,
                "message": "Logged out successfully",
                "data": None
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Logout error: {str(e)}",
                "data": None
            }

    def logout_all_devices(self, user_id: int) -> Dict[str, Any]:
        """Logout user from all devices"""
        try:
            self.auth_data.update_refresh_token(user_id, None)

            return {
                "success": True,
                "message": "Logged out successfully",
                "data": None
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Logout error: {str(e)}",
                "data": None
            }
