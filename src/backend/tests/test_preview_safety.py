"""Enforce no writes even when an application GET tries to mutate PostgREST."""
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config.runtime_safety import (
    ReadOnlyPreviewError, protect_database_client, read_only_mode,
)


class PreviewSafetyTests(unittest.TestCase):
    def test_http_guard_blocks_writes_and_sanitizes_legacy_client_errors(self):
        # A separate process prevents database stubs from unrelated contract tests
        # from changing the app under test. Only synthetic errors are supplied.
        script = r'''
import os, socket, sys, types
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path.cwd()))
calls = []
class Database:
    def table(self, name):
        calls.append(name)
        raise RuntimeError("synthetic-upstream-detail-must-not-be-returned")
def blocked(*args, **kwargs):
    raise AssertionError("Network connections are prohibited")
database = types.ModuleType("src.config.database")
database.supabase = Database()
with patch.dict(os.environ, {"WATMATCH_READ_ONLY": "true"}, clear=True), patch.dict(sys.modules, {"src.config.database": database}), patch.object(socket.socket, "connect", blocked), patch.object(socket, "create_connection", blocked):
    from fastapi import HTTPException
    from fastapi.testclient import TestClient
    from src.auth.dependencies import get_current_user
    import main
    with TestClient(main.app) as client:
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            response = client.request(method, "/api/v1/teams/", json={})
            assert response.status_code == 403
            assert calls == []
        for route in ("login", "refresh", "logout", "logout-all"):
            assert client.post("/api/v1/auth/" + route, json={}).status_code == 410
            assert calls == []
        response = client.get("/api/v1/departments/1")
        assert response.status_code == 400
        assert "synthetic-upstream-detail" not in response.text
        assert calls == ["departments"]
        validation = client.get("/api/v1/departments/not-an-integer")
        assert validation.status_code == 422
        assert "not-an-integer" not in validation.text
        def denied_identity():
            raise HTTPException(403, "This identity is not provisioned for WatMatch")
        main.app.dependency_overrides[get_current_user] = denied_identity
        auth = client.get("/api/v1/auth/me")
        assert auth.status_code == 403
        assert auth.json()["detail"] == "This identity is not provisioned for WatMatch"
'''
        result = subprocess.run([sys.executable, "-I", "-B", "-c", script],
                                cwd=Path(__file__).resolve().parents[1],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_defaults_read_only_and_rejects_invalid_setting(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(read_only_mode())
        with patch.dict(os.environ, {"WATMATCH_READ_ONLY": "perhaps"}):
            with self.assertRaises(ValueError):
                read_only_mode()

    def test_vm_requires_clock_sync_and_caches_the_read_only_check(self):
        from src.config import runtime_safety
        from types import SimpleNamespace
        with patch.dict(os.environ, {"WATMATCH_REQUIRE_SYNC_CLOCK": "true"}), \
                patch.object(runtime_safety, "_clock_checked_at", 0), \
                patch.object(runtime_safety.subprocess, "run") as run:
            run.return_value = SimpleNamespace(returncode=0, stdout="no\n")
            self.assertFalse(runtime_safety.clock_is_synchronized())
            self.assertFalse(runtime_safety.clock_is_synchronized())
            self.assertEqual(run.call_count, 1)
            runtime_safety._clock_checked_at = 0
            run.return_value = SimpleNamespace(returncode=0, stdout="yes\n")
            self.assertTrue(runtime_safety.clock_is_synchronized())

    def test_database_writes_are_blocked_before_transport(self):
        sent = []

        def transport(request):
            sent.append(request.method)
            return httpx.Response(200, json=[])

        with httpx.Client(transport=httpx.MockTransport(transport)) as client:
            from types import SimpleNamespace
            sdk = SimpleNamespace(postgrest=SimpleNamespace(session=client))
            with patch.dict(os.environ, {"WATMATCH_READ_ONLY": "true"}):
                protect_database_client(sdk)
            for method in ("POST", "PATCH", "PUT", "DELETE"):
                with self.subTest(method=method), self.assertRaises(ReadOnlyPreviewError):
                    client.request(method, "https://database.invalid/rest/v1/rpc/test")
            self.assertEqual(sent, [])
            self.assertEqual(client.get("https://database.invalid/rest/v1/users?limit=0").status_code, 200)
            self.assertEqual(sent, ["GET"])

    def test_explicit_write_mode_does_not_add_preview_guard(self):
        from types import SimpleNamespace
        with httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200))) as client:
            with patch.dict(os.environ, {"WATMATCH_READ_ONLY": "false"}):
                protect_database_client(SimpleNamespace(postgrest=SimpleNamespace(session=client)))
            self.assertEqual(client.event_hooks["request"], [])

    def test_readiness_only_requests_zero_rows_and_caches_result(self):
        from src.config import readiness
        test_env = {
            "CLERK_ISSUER": "https://identity.invalid",
            "CLERK_SECRET_KEY": "sk_test_synthetic",
            "CLERK_AUTHORIZED_PARTIES": "http://127.0.0.1:8080",
            "SUPABASE_URL": "https://database.invalid",
            "SUPABASE_SERVICE_ROLE_KEY": "synthetic-test-key",
        }
        with patch.dict(os.environ, test_env, clear=True), \
                patch.object(readiness, "_checked_at", 0), \
                patch.object(readiness, "_database_reachable", False), \
                patch.object(readiness.httpx, "Client") as factory:
            client = factory.return_value.__enter__.return_value
            client.get.return_value.status_code = 200
            client.get.return_value.json.return_value = []
            self.assertTrue(readiness.service_readiness()["ready"])
            self.assertTrue(readiness.service_readiness()["ready"])
            self.assertEqual(client.get.call_count, 1)
            self.assertEqual(client.get.call_args.kwargs["params"], {"select": "user_id", "limit": "0"})
            self.assertEqual(client.post.call_count, 0)

    def test_readiness_fails_closed_on_connection_error(self):
        from src.config import readiness
        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://database.invalid",
            "SUPABASE_SERVICE_ROLE_KEY": "synthetic-test-key",
        }, clear=True), patch.object(readiness, "_checked_at", 0), \
                patch.object(readiness.httpx, "Client") as factory:
            factory.return_value.__enter__.return_value.get.side_effect = httpx.ConnectError("unavailable")
            result = readiness.service_readiness()
            self.assertFalse(result["ready"])
            self.assertEqual(result["database"], "unavailable")
            self.assertNotIn("synthetic-test-key", str(result))


if __name__ == "__main__":
    unittest.main()
