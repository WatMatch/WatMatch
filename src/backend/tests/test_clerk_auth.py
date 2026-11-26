"""Offline Clerk identity and account authorization checks; all sockets are blocked."""
import copy
import importlib
import json
import os
from pathlib import Path
import socket
import sys
import time
import types
import unittest
from unittest.mock import patch

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.auth.clerk_auth import ClerkAuthError, ClerkSettings, ClerkVerifier, validate_clerk_settings

ISSUER = "https://watmatch-test.clerk.accounts.dev"
ORIGIN = "http://127.0.0.1:8080"
TEST_SECRET = "sk_test_synthetic_server_secret_not_real"


def blocked_network(*args, **kwargs):
    raise AssertionError("Real network access is prohibited")


class ReadOnlyDatabase:
    def __init__(self, users):
        self.users, self.calls = users, []
        self.departments = []

    def table(self, name):
        self.calls.append(("table", name))
        if name not in {"users", "courses", "departments"}:
            raise AssertionError("Unexpected database table")
        owner = self
        class Query:
            def select(self, fields):
                owner.calls.append(("select", fields))
                return self
            def ilike(self, field, value):
                owner.calls.append(("ilike", field, value))
                return self
            def eq(self, field, value):
                owner.calls.append(("eq", field, value))
                return self
            def limit(self, count):
                owner.calls.append(("limit", count))
                return self
            def execute(self):
                owner.calls.append(("execute", name))
                rows = {"users": owner.users, "departments": owner.departments, "courses": []}
                return types.SimpleNamespace(data=copy.deepcopy(rows[name]))
            def __getattr__(self, method):
                raise AssertionError("Database writes are prohibited")
        return Query()


class ClerkAuthenticationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(cls.key.public_key()))
        cls.jwk.update(kid="test-key", use="sig", alg="RS256")
        module = types.ModuleType("src.config.database")
        module.supabase = None
        cls.original_modules = {name: sys.modules.get(name) for name in ("src.auth.dependencies", "src.auth.controller")}
        with patch.dict(sys.modules, {"src.config.database": module}):
            for name in cls.original_modules:
                sys.modules.pop(name, None)
            cls.dependencies = importlib.import_module("src.auth.dependencies")
            cls.controller = importlib.import_module("src.auth.controller")

    @classmethod
    def tearDownClass(cls):
        for name, module in cls.original_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module

    def setUp(self):
        self.calls = []
        self.status, self.broken_json, self.network_failure = 200, False, False
        self.session = {"id": "sess_test123", "user_id": "user_test123", "status": "active"}
        self.user = {
            "id": "user_test123", "banned": False, "locked": False,
            "primary_email_address_id": "idn_test123",
            "email_addresses": [{"id": "idn_test123", "email_address": " Pilot.Test@example.invalid ",
                                 "verification": {"status": "verified"}}],
            "public_metadata": {"role": "admin"},
        }
        self.database = ReadOnlyDatabase([{"user_id": 42, "email": "pilot.test@example.invalid", "role": "student",
                                          "active": True, "course_fk": None, "home_department_fk": None,
                                          "user_roles": [{"role": "student"}], "clerk_role_sessions": []}])
        self.verifier = ClerkVerifier(ClerkSettings(ISSUER, TEST_SECRET, frozenset({ORIGIN})), httpx.MockTransport(self.respond))
        for context in (patch.dict(os.environ, {"WATMATCH_REQUIRE_SYNC_CLOCK": "false"}),
                        patch.object(socket.socket, "connect", blocked_network),
                        patch.object(socket, "create_connection", blocked_network),
                        patch.object(self.dependencies, "get_clerk_verifier", return_value=self.verifier),
                        patch.object(self.dependencies, "supabase", self.database)):
            context.start()
            self.addCleanup(context.stop)
        app = FastAPI()
        app.include_router(self.controller.router, prefix="/api/v1")
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def respond(self, request):
        self.calls.append(request.url.path)
        self.assertEqual(request.method, "GET")
        if self.network_failure:
            raise httpx.ConnectError("synthetic upstream failure", request=request)
        if self.status != 200:
            return httpx.Response(self.status, json={"sensitive_upstream_detail": TEST_SECRET})
        if self.broken_json:
            return httpx.Response(200, content=b"not-json")
        if request.url.path == "/.well-known/jwks.json":
            self.assertEqual(str(request.url), ISSUER + "/.well-known/jwks.json")
            self.assertNotIn("authorization", request.headers)
            return httpx.Response(200, json={"keys": [self.jwk]})
        self.assertEqual(request.url.host, "api.clerk.com")
        self.assertEqual(request.headers["authorization"], "Bearer " + TEST_SECRET)
        if request.url.path == "/v1/sessions/sess_test123":
            return httpx.Response(200, json=self.session)
        if request.url.path == "/v1/users/user_test123":
            return httpx.Response(200, json=self.user)
        raise AssertionError("Unexpected identity endpoint")

    def token(self, updates=None, remove=(), kid="test-key"):
        now = int(time.time())
        claims = {"iss": ISSUER, "sub": "user_test123", "sid": "sess_test123", "azp": ORIGIN,
                  "iat": now, "nbf": now - 1, "exp": now + 60, "role": "admin"}
        claims.update(updates or {})
        for name in remove:
            claims.pop(name, None)
        return jwt.encode(claims, self.key, algorithm="RS256", headers={"kid": kid})

    def me(self, token=None):
        return self.client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + (token or self.token())})

    def test_verified_identity_uses_only_database_role_and_account(self):
        response = self.me()
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual((data["user_id"], data["role"], data["email"]), (42, "student", "pilot.test@example.invalid"))
        self.assertIn(("ilike", "email", "pilot.test@example.invalid"), self.database.calls)
        self.assertIn(("limit", 2), self.database.calls)
        self.assertEqual(len(self.calls), 3)

    def test_unsynchronized_required_clock_blocks_identity_and_database(self):
        from src.config import runtime_safety
        with patch.dict(os.environ, {"WATMATCH_REQUIRE_SYNC_CLOCK": "true"}), \
                patch.object(runtime_safety, "_clock_checked_at", float("-inf")), \
                patch.object(runtime_safety, "_clock_synchronized", True), \
                patch.object(runtime_safety.subprocess, "run", return_value=types.SimpleNamespace(
                    returncode=0, stdout="no\n")) as clock_check:
            response = self.me()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "Identity verification is temporarily unavailable")
        self.dependencies.get_clerk_verifier.assert_not_called()
        clock_check.assert_called_once()
        self.assertEqual(self.calls, [])
        self.assertEqual(self.database.calls, [])

    def test_me_preserves_home_department_for_discover(self):
        department = {"department_id": 19, "name": "Software Engineering", "active": True}
        self.database.users[0]["home_department_fk"] = department["department_id"]
        self.database.departments = [department]
        response = self.me()
        self.assertEqual(response.status_code, 200)
        account = response.json()["data"]
        self.assertEqual(account["home_department"], department)
        self.assertEqual(account["home_department_id"], 19)
        self.assertEqual(account["home_department_fk"], 19)
        self.assertIn(("eq", "department_id", 19), self.database.calls)

    def test_session_and_user_state_are_not_cached(self):
        retained_token = self.token()
        self.assertEqual(self.me(retained_token).status_code, 200)
        self.session["status"] = "revoked"
        self.assertEqual(self.me(retained_token).status_code, 401)
        self.assertEqual(self.calls.count("/.well-known/jwks.json"), 1)
        self.assertEqual(self.calls.count("/v1/sessions/sess_test123"), 2)

    def test_user_verification_state_is_checked_again(self):
        self.assertEqual(self.me().status_code, 200)
        self.user["email_addresses"][0]["verification"]["status"] = "unverified"
        self.assertEqual(self.me().status_code, 403)
        self.assertEqual(self.calls.count("/v1/users/user_test123"), 2)

    def test_tampered_signature_is_rejected(self):
        head, body, signature = self.token().split(".")
        signature = ("A" if signature[0] != "A" else "B") + signature[1:]
        self.assertEqual(self.me(".".join((head, body, signature))).status_code, 401)
        self.assertEqual(self.database.calls, [])

    def test_wrong_issuer_and_origin_are_rejected(self):
        for update in ({"iss": "https://other.invalid"}, {"azp": "http://localhost:8080"}, {"azp": []}):
            with self.subTest(update=update):
                self.assertEqual(self.me(self.token(update)).status_code, 401)
        self.assertEqual(self.database.calls, [])

    def test_all_required_claims_are_enforced(self):
        for name in ("exp", "nbf", "iat", "iss", "sub", "sid", "azp"):
            with self.subTest(claim=name):
                self.assertEqual(self.me(self.token(remove=(name,))).status_code, 401)
        self.assertEqual(self.database.calls, [])

    def test_expired_future_and_pending_tokens_are_rejected(self):
        now = int(time.time())
        for updates in ({"exp": now - 5}, {"nbf": now + 60}, {"iat": now + 60}, {"sts": "pending"}, {"exp": "9999999999"}):
            with self.subTest(updates=updates):
                self.assertEqual(self.me(self.token(updates)).status_code, 401)
        self.assertEqual(self.database.calls, [])

    def test_inactive_session_is_rejected(self):
        for status in ("revoked", "ended", "expired", "abandoned", "pending"):
            self.session["status"] = status
            self.assertEqual(self.me().status_code, 401)
        self.assertEqual(self.database.calls, [])

    def test_session_must_belong_to_subject(self):
        self.session["user_id"] = "user_other"
        self.assertEqual(self.me().status_code, 401)
        self.assertEqual(self.database.calls, [])

    def test_identifiers_cannot_change_identity_request_paths(self):
        for update in ({"sub": "user_../other"}, {"sid": "sess_../other"}):
            self.assertEqual(self.me(self.token(update)).status_code, 401)
        self.assertEqual(self.calls, ["/.well-known/jwks.json"])
        self.assertEqual(self.database.calls, [])

    def test_primary_email_must_be_verified(self):
        self.user["email_addresses"][0]["verification"]["status"] = "unverified"
        self.assertEqual(self.me().status_code, 403)
        self.assertEqual(self.database.calls, [])

    def test_secondary_verified_email_does_not_replace_primary(self):
        self.user["primary_email_address_id"] = "idn_missing"
        self.assertEqual(self.me().status_code, 403)
        self.assertEqual(self.database.calls, [])

    def test_banned_and_locked_users_are_rejected(self):
        for field in ("banned", "locked"):
            self.user[field] = True
            self.assertEqual(self.me().status_code, 403)
            self.user[field] = False
        self.assertEqual(self.database.calls, [])

    def test_unlisted_account_is_rejected_without_writes(self):
        self.database.users = []
        self.assertEqual(self.me().status_code, 403)

    def test_inactive_or_unknown_role_is_rejected(self):
        for active in (False, None, 1):
            self.database.users[0]["active"] = active
            self.assertEqual(self.me().status_code, 403)
        self.database.users[0]["active"] = True
        self.database.users[0]["role"] = "superadmin"
        self.assertEqual(self.me().status_code, 403)

    def test_ambiguous_case_insensitive_email_is_rejected(self):
        self.database.users.append(dict(self.database.users[0], user_id=43, email="PILOT.TEST@example.invalid"))
        self.assertEqual(self.me().status_code, 403)

    def test_like_false_match_is_rejected(self):
        self.database.users[0]["email"] = "unrelated@example.invalid"
        self.assertEqual(self.me().status_code, 403)

    def test_legacy_hs256_and_unsigned_tokens_are_rejected_without_network(self):
        for algorithm, key in (("HS256", "synthetic-old-secret-not-real-32bytes"), ("none", "")):
            token = jwt.encode({"user_id": 42, "type": "access", "exp": 4102444800}, key, algorithm=algorithm)
            self.assertEqual(self.me(token).status_code, 401)
        self.assertEqual(self.calls, [])
        self.assertEqual(self.database.calls, [])

    def test_unknown_kids_cannot_force_repeated_jwks_fetches(self):
        self.assertEqual(self.me().status_code, 200)
        for kid in ("random1", "random2", "random3"):
            self.assertEqual(self.me(self.token(kid=kid)).status_code, 401)
        self.assertEqual(self.calls.count("/.well-known/jwks.json"), 1)

    def test_expired_key_cache_refreshes_and_does_not_use_stale_keys_on_failure(self):
        self.assertEqual(self.me().status_code, 200)
        self.verifier._keys_expire = 0
        self.verifier._last_refresh = float("-inf")
        self.network_failure = True
        self.assertEqual(self.me().status_code, 503)
        self.assertEqual(self.calls.count("/.well-known/jwks.json"), 2)

    def test_user_record_id_must_match_verified_subject(self):
        self.user["id"] = "user_other"
        self.assertEqual(self.me().status_code, 401)
        self.assertEqual(self.database.calls, [])

    def test_identity_network_failure_is_fail_closed_and_sanitized(self):
        self.network_failure = True
        response = self.me()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(TEST_SECRET, response.text)
        self.assertEqual(self.database.calls, [])

    def test_identity_http_failure_is_fail_closed_and_sanitized(self):
        self.status = 429
        response = self.me()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(TEST_SECRET, response.text)
        self.assertEqual(self.database.calls, [])

    def test_backend_credentials_failure_does_not_grant_access(self):
        # Prime the key cache so the simulated failure occurs at the Backend API.
        self.assertEqual(self.me().status_code, 200)
        self.database.calls.clear()
        self.status = 401
        response = self.me()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(TEST_SECRET, response.text)
        self.assertEqual(self.database.calls, [])

    def test_malformed_identity_response_is_fail_closed(self):
        self.broken_json = True
        self.assertEqual(self.me().status_code, 503)
        self.assertEqual(self.database.calls, [])

    def test_database_failure_is_fail_closed_and_sanitized(self):
        with patch.object(self.database, "table", side_effect=RuntimeError(TEST_SECRET)):
            response = self.me()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn(TEST_SECRET, response.text)

    def test_legacy_routes_are_gone_without_configuration_or_database(self):
        with patch.dict(os.environ, {}, clear=True):
            for path in ("login", "refresh", "logout", "logout-all"):
                response = self.client.post("/api/v1/auth/" + path, json={"email": "pilot.test@example.invalid"})
                self.assertEqual(response.status_code, 410)
        self.assertEqual(self.calls, [])
        self.assertEqual(self.database.calls, [])

    def test_optional_audience_is_enforced_when_configured(self):
        self.verifier.settings = ClerkSettings(ISSUER, TEST_SECRET, frozenset({ORIGIN}), "watmatch-api")
        self.assertEqual(self.me().status_code, 401)
        self.assertEqual(self.me(self.token({"aud": "another-api"})).status_code, 401)
        self.assertEqual(self.me(self.token({"aud": "watmatch-api"})).status_code, 200)

    def test_configuration_requires_explicit_https_issuer_and_origins(self):
        valid = {"CLERK_ISSUER": ISSUER, "CLERK_SECRET_KEY": TEST_SECRET, "CLERK_AUTHORIZED_PARTIES": ORIGIN}
        with patch.dict(os.environ, valid, clear=True):
            self.assertEqual(validate_clerk_settings().authorized_parties, frozenset({ORIGIN}))
        for updates in ({"CLERK_ISSUER": "http://untrusted.invalid"}, {"CLERK_ISSUER": ISSUER + "/path"},
                        {"CLERK_AUTHORIZED_PARTIES": "*"}, {"CLERK_AUTHORIZED_PARTIES": "http://public.invalid"},
                        {"CLERK_SECRET_KEY": ""}):
            with self.subTest(updates=updates), patch.dict(os.environ, dict(valid, **updates), clear=True):
                with self.assertRaises(ClerkAuthError):
                    validate_clerk_settings()


if __name__ == "__main__":
    unittest.main()
