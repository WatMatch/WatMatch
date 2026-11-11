"""Test API requests with synthetic identities and a recording RPC stub."""
import importlib
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class MilestoneFeedbackApiTests(unittest.TestCase):
    def setUp(self):
        self.actor = {"role": "instructor", "user_id": 41}
        self.verified = True
        self.db = Mock()
        db_module = types.ModuleType("src.config.database")
        db_module.supabase = self.db
        auth_module = types.ModuleType("src.auth.dependencies")
        def get_user(request: Request):
            if self.verified:
                request.state.watmatch_verified_identity = True
            return self.actor
        auth_module.get_current_user = get_user
        with patch.dict(sys.modules, {"src.config.database": db_module, "src.auth.dependencies": auth_module}):
            sys.modules.pop("src.capstones.milestone_feedback", None)
            self.m = importlib.import_module("src.capstones.milestone_feedback")
        app = FastAPI()
        app.include_router(self.m.router, prefix="/api/v1")
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.path = "/api/v1/capstones/29/milestone-feedback"
        self.payload = {"entry_id": "d55ca459-5d0e-4a62-b73f-c744b46dc40e", "milestone": " Design ", "comment": " Include evidence. "}
        flag = patch.dict(os.environ, {"WATMATCH_MILESTONE_FEEDBACK_ENABLED": "true"})
        flag.start()
        self.addCleanup(flag.stop)

    def test_disabled_and_legacy_identities_never_reach_database(self):
        with patch.dict(os.environ, {"WATMATCH_MILESTONE_FEEDBACK_ENABLED": "false"}):
            self.assertEqual(self.client.get(self.path).status_code, 404)
        self.verified = False
        self.actor["identity_verified"] = True
        self.assertEqual(self.client.post(self.path, json=self.payload, headers={"X-Verified-Identity": "true"}).status_code, 403)
        self.assertEqual(self.client.get(self.path).status_code, 403)
        self.db.rpc.assert_not_called()

    def test_instructor_records_validated_note_with_server_actor(self):
        self.db.rpc.return_value.execute.return_value.data = {"milestone": "Design"}
        response = self.client.post(self.path, json={**self.payload, "p_actor_id": 999})
        self.assertEqual(response.status_code, 200)
        self.db.rpc.assert_called_once_with("watmatch_add_milestone_feedback", {
            "p_capstone_id": 29, "p_actor_id": 41, "p_entry_id": self.payload["entry_id"],
            "p_milestone": "Design", "p_comment": "Include evidence.",
        })

    def test_blank_oversize_and_invalid_id(self):
        for change in ({"comment":"   "}, {"milestone":"  "}, {"comment":"x"*2001}, {"entry_id":"bad"}):
            self.assertEqual(self.client.post(self.path, json={**self.payload, **change}).status_code, 422)
        self.db.rpc.assert_not_called()

    def test_student_reads_but_cannot_write_and_unassigned_roles_are_denied(self):
        self.actor["role"] = "student"
        self.db.rpc.return_value.execute.return_value.data = []
        response = self.client.get(self.path)
        self.assertEqual(response.json(), [])
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        self.db.rpc.assert_called_once_with("watmatch_list_milestone_feedback", {"p_capstone_id":29,"p_actor_id":41,"p_role":"student"})
        self.assertEqual(self.client.post(self.path, json=self.payload).status_code, 403)
        for role in ("mentor", "ta", "admin", "external_partner"):
            self.actor["role"] = role
            self.assertEqual(self.client.get(self.path).status_code, 403)
        self.assertEqual(self.db.rpc.call_count, 1)

    def test_database_permissions_errors_are_sanitized(self):
        for code, status in (("42501",403), ("23505",409), ("08006",503)):
            self.db.rpc.return_value.execute.side_effect = self.m.APIError({
                "code":code,"message":"internal-only","details":"","hint":"",
            })
            response = self.client.post(self.path, json=self.payload)
            self.assertEqual(response.status_code, status)
            self.assertNotIn("internal-only", response.text)
