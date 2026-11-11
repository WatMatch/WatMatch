"""Exercise WatMatch's demo session endpoints with synthetic accounts and in-memory tables."""
import copy
import os
import sys
import unittest
from importlib import import_module
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


class MemoryTables:
    def __init__(self):
        self.rows = {
            "users": [{"user_id": 14, "email": "student@example.invalid", "role": "student",
                       "course_fk": None, "home_department_fk": 3, "active": True}],
            "departments": [{"department_id": 3, "name": "Software Engineering", "active": True}],
        }
        self.before_update = None

    def table(self, table):
        return MemoryQuery(self, table)


class MemoryQuery:
    def __init__(self, database, table):
        self.database = database
        self.table = table
        self.filters = {}
        self.patch = None

    def select(self, _fields):
        return self

    def update(self, fields):
        self.patch = fields
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, _count):
        return self

    def execute(self):
        if self.patch is not None and self.database.before_update:
            self.database.before_update()
        rows = [row for row in self.database.rows[self.table]
                if all(row.get(k) == v for k, v in self.filters.items())]
        if self.patch is not None:
            for row in rows:
                row.update(self.patch)
        return SimpleNamespace(data=copy.deepcopy(rows))


class DemoSessionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        cls.addClassCleanup(sys.path.pop, 0)
        cls.db = MemoryTables()
        module = ModuleType("src.config.database")
        module.supabase = cls.db
        names = ("src.config.database", "src.auth.controller", "src.auth.auth_bl",
                 "src.auth.auth_dl", "src.auth.dependencies", "src.auth.jwt_utils")
        for name in names:
            previous = sys.modules.pop(name, None)
            if previous is not None:
                cls.addClassCleanup(sys.modules.__setitem__, name, previous)
            else:
                cls.addClassCleanup(sys.modules.pop, name, None)
        sys.modules["src.config.database"] = module
        with patch.dict(os.environ, {"JWT_SECRET_KEY": "access-key-for-isolated-tests",
                                     "JWT_REFRESH_SECRET_KEY": "refresh-key-for-isolated-tests"}):
            controller = import_module("src.auth.controller")
        app = FastAPI()
        app.include_router(controller.router, prefix="/api/v1")
        cls.client = TestClient(app)
        cls.addClassCleanup(cls.client.close)

    def setUp(self):
        self.db.rows = MemoryTables().rows
        self.db.before_update = None

    def login(self):
        response = self.client.post("/api/v1/auth/login", json={"email": "student@example.invalid"})
        self.assertEqual(response.status_code, 200)
        return response.json()["data"]

    def post_token(self, action, token):
        return self.client.post("/api/v1/auth/" + action, json={"refresh_token": token})

    def test_department_returned_by_login_and_session_reload(self):
        for department in (3, None):
            self.db.rows["users"][0]["home_department_fk"] = department
            result = self.login()
            current = self.client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + result["access_token"]})
            self.assertEqual(current.status_code, 200)
            for account in (result["user"], current.json()["data"]):
                self.assertEqual(account["home_department_fk"], department)
                self.assertEqual(account["home_department_id"], department)
                self.assertEqual(account["home_department"], self.db.rows["departments"][0] if department else None)

    def test_logout_is_idempotent_and_ends_refresh(self):
        token = self.login()["refresh_token"]
        for _ in range(2):
            self.assertEqual(self.post_token("logout", token).status_code, 200)
        self.assertEqual(self.post_token("refresh", token).status_code, 401)

    def test_rotation_then_old_logout_preserves_current_login(self):
        token = self.login()["refresh_token"]
        rotated = self.post_token("refresh", token).json()["data"]["refresh_token"]
        self.assertNotEqual(token, rotated)
        self.assertEqual(self.post_token("logout", token).status_code, 200)
        self.assertEqual(self.post_token("refresh", rotated).status_code, 200)

    def test_revocation_during_rotation_wins(self):
        token = self.login()["refresh_token"]
        self.db.before_update = lambda: self.db.rows["users"][0].update(refresh_token=None)
        self.assertEqual(self.post_token("refresh", token).status_code, 401)
        self.assertIsNone(self.db.rows["users"][0]["refresh_token"])

    def test_revocation_failure_discloses_no_credential(self):
        token = self.login()["refresh_token"]
        def unavailable():
            raise RuntimeError("private database error")
        self.db.before_update = unavailable
        response = self.post_token("logout", token)
        self.assertGreaterEqual(response.status_code, 400)
        self.assertNotIn("private database error", response.text)
        self.assertNotIn(token, response.text)
