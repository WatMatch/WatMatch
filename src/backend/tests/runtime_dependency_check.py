"""Exercise the real API and Supabase SDK with synthetic data and no network.

Run as a separate process so other source-contract tests cannot change imports.
This is a mocked dependency compatibility check, not a database integration test.
"""
import importlib
import json
import os
from pathlib import Path
import socket
import sys
import types
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class BlockedDatabase:
    def __getattr__(self, name):
        raise AssertionError("Database access is prohibited")


def blocked_network(*args, **kwargs):
    raise AssertionError("Network connections are prohibited")


database = types.ModuleType("src.config.database")
database.supabase = BlockedDatabase()
test_env = {
    "CLERK_SECRET_KEY": "sk_test_synthetic_runtime_key_not_real",
    "CLERK_ISSUER": "https://watmatch-test.clerk.accounts.dev",
    "CLERK_AUTHORIZED_PARTIES": "http://127.0.0.1:8080",
    "CORS_ORIGINS": "http://127.0.0.1:8080",
}
with patch.dict(os.environ, test_env, clear=True), patch("dotenv.load_dotenv", return_value=False), patch.dict(sys.modules, {"src.config.database": database}), patch.object(socket.socket, "connect", blocked_network), patch.object(socket, "create_connection", blocked_network):
    import httpx
    import jwt
    from fastapi.testclient import TestClient
    from supabase import create_client

    app = importlib.import_module("main").app
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/health").json()["status"] == "healthy"
        # Newer FastAPI HTTPBearer correctly uses 401 plus the Bearer challenge.
        missing_auth = client.get("/api/v1/auth/me")
        assert missing_auth.status_code == 401
        assert missing_auth.headers["www-authenticate"] == "Bearer"
        assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
        assert client.post("/api/v1/auth/login", json={}).status_code == 410
        assert "src.auth.auth_bl" not in sys.modules
        assert "src.auth.jwt_utils" not in sys.modules
        preflight = client.options("/api/v1/courses/", headers={"Origin": test_env["CORS_ORIGINS"], "Access-Control-Request-Method": "GET"})
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == test_env["CORS_ORIGINS"]
        assert client.get("/openapi.json").status_code == 200

    # The SDK constructs the same table and RPC requests used by the application.
    # MockTransport is the only transport; even accidental real sockets fail.
    key = jwt.encode({"role": "service_role"}, "synthetic-sdk-test-key-not-a-secret", algorithm="HS256")
    sdk = create_client("https://watmatch-test.invalid", key)
    requests = []
    def respond(request):
        requests.append(request)
        assert request.headers["apikey"] == key
        assert request.headers["authorization"] == f"Bearer {key}"
        if request.url.path == "/rest/v1/users":
            assert request.method == "GET"
            assert request.url.params["user_id"] == "eq.42"
            return httpx.Response(200, json=[{"user_id": 42, "role": "student"}])
        if request.url.path == "/rest/v1/rpc/dependency_test":
            assert request.method == "POST"
            assert json.loads(request.content) == {"example": 42}
            return httpx.Response(200, json={"success": True, "data": {"verified": True}})
        raise AssertionError("Unexpected mock endpoint")

    postgrest = sdk.postgrest
    headers = dict(postgrest.session.headers)
    postgrest.session.close()
    with httpx.Client(base_url="https://watmatch-test.invalid/rest/v1", headers=headers, transport=httpx.MockTransport(respond)) as mock_client:
        postgrest.session = mock_client
        rows = sdk.table("users").select("user_id,role").eq("user_id", 42).limit(1).execute()
        assert rows.data == [{"user_id": 42, "role": "student"}]
        database.supabase = sdk
        rpc = importlib.reload(importlib.import_module("src.workflow.rpc_utils"))
        assert rpc.call_json_rpc("dependency_test", {"example": 42}) == {"success": True, "data": {"verified": True}}
        assert len(requests) == 2
    sdk.auth.close()
    print("PASS: API health/auth rejection/validation/CORS/OpenAPI and mocked Supabase table/RPC")
    print("LIMIT: synthetic data, blocked sockets, no live database or identity verification")
