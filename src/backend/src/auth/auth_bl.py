from .auth_dl import AuthDataLogic
from .jwt_utils import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token
)
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import hashlib


class AuthBusinessLogic:
    """Business layer for authentication operations"""

    def __init__(self):
        self.auth_data = AuthDataLogic()

    def register_user(self, email: str, role: str = "student", course_id: Optional[int] = None) -> Dict[str, Any]:
        """Register a new user"""
        try:
            # Validate inputs
            if not email or not email.strip():
                return {
                    "success": False,
                    "message": "Email is required",
                    "data": None
                }

            if role not in ["student", "instructor"]:
                return {
                    "success": False,
                    "message": "Role must be 'student' or 'instructor'",
                    "data": None
                }

            # Check if user already exists
            existing_user = self.auth_data.get_user_by_email(email.lower())
            if existing_user:
                return {
                    "success": False,
                    "message": "User with this email already exists",
                    "data": None
                }

            # Create user data (no password stored)
            user_data = {
                "email": email.lower(),
                "role": role,
                "course_fk": course_id
            }

            # Create user
            user = self.auth_data.create_user(user_data)

            if not user:
                return {
                    "success": False,
                    "message": "Failed to create user",
                    "data": None
                }

            user_response = user

            return {
                "success": True,
                "message": "User registered successfully",
                "data": user_response
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Registration error: {str(e)}",
                "data": None
            }

    def login(self, email: str) -> Dict[str, Any]:
        """Authenticate user and return tokens (password validation to be implemented later)"""
        try:
            # Validate inputs
            if not email:
                return {
                    "success": False,
                    "message": "Email is required",
                    "data": None
                }

            # Get user
            user = self.auth_data.get_user_by_email(email.lower())

            if not user:
                return {
                    "success": False,
                    "message": "User not found",
                    "data": None
                }

            # Create tokens
            token_data = {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": user["role"],
                "course_fk": user.get("course_fk")
            }

            access_token = create_access_token(token_data)
            refresh_token = create_refresh_token(token_data)

            # Store refresh token hash in user record
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            self.auth_data.update_refresh_token(user["user_id"], token_hash)

            # Remove refresh token from user data
            user_response = {k: v for k,
                             v in user.items() if k != "refresh_token"}

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

            # Verify user_id matches
            if user["user_id"] != payload.get("user_id"):
                return {
                    "success": False,
                    "message": "Invalid refresh token",
                    "data": None
                }

            # Create new tokens
            token_data = {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": user["role"],
                "course_fk": user.get("course_fk")
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
                    "token_type": "bearer"
                }
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Token refresh error: {str(e)}",
                "data": None
            }

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
