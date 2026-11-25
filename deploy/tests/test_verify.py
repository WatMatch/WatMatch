import base64
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verify


def configuration():
    payload = base64.urlsafe_b64encode(json.dumps({"role": "service_role"}).encode()).decode().rstrip("=")
    backend = {
        "SUPABASE_URL": "https://database.invalid", "SUPABASE_SERVICE_ROLE_KEY": "header." + payload + ".synthetic-signature",
        "CLERK_ISSUER": "https://identity.invalid", "CLERK_SECRET_KEY": "sk_test_synthetic",
        "CLERK_AUTHORIZED_PARTIES": "http://127.0.0.1:8080", "WATMATCH_READ_ONLY": "true",
        "WATMATCH_REQUIRE_SYNC_CLOCK": "true",
    }
    frontend = {
        "CLERK_SECRET_KEY": backend["CLERK_SECRET_KEY"],
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_" + base64.b64encode(b"identity.invalid$").decode(),
        "NEXT_PUBLIC_API_URL": "/api/v1", "NEXT_PUBLIC_PREVIEW_READ_ONLY": "true",
    }
    return backend, frontend


class Response(io.BytesIO):
    def __init__(self, status, body):
        super().__init__(body if isinstance(body, bytes) else json.dumps(body).encode())
        self.status = status


class DeploymentVerificationTests(unittest.TestCase):
    def test_valid_read_only_config(self):
        verify.check_config(*configuration(), "http://127.0.0.1:8080", True)

    def test_config_rejects_each_missing_setting(self):
        for group in range(2):
            for name in configuration()[group]:
                with self.subTest(name=name):
                    values = configuration()
                    del values[group][name]
                    with self.assertRaises(verify.CheckError):
                        verify.check_config(*values, "http://127.0.0.1:8080", True)

    def test_config_rejects_wrong_instance_and_disabled_safeguards(self):
        changes = [
            (0, "CLERK_ISSUER", "https://other.invalid"),
            (0, "CLERK_SECRET_KEY", "sk_live_synthetic"),
            (0, "CLERK_AUTHORIZED_PARTIES", "http://localhost:8080"),
            (0, "WATMATCH_READ_ONLY", "false"),
            (0, "WATMATCH_REQUIRE_SYNC_CLOCK", "false"),
            (1, "NEXT_PUBLIC_PREVIEW_READ_ONLY", "false"),
            (1, "NEXT_PUBLIC_API_URL", "https://other.invalid/api/v1"),
            (1, "NEXT_PUBLIC_MILESTONE_FEEDBACK_ENABLED", "true"),
            (1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_%%"),
            (1, "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "synthetic-only"),
            (1, "SUPABASE_SERVICE_ROLE_KEY", "synthetic-only"),
        ]
        for group, name, value in changes:
            with self.subTest(name=name):
                values = configuration()
                values[group][name] = value
                with self.assertRaises(verify.CheckError):
                    verify.check_config(*values, "http://127.0.0.1:8080", True)

    def test_pilot_validates_write_mode_and_reports_clerk_instance_type(self):
        backend, frontend = configuration()
        backend["CLERK_AUTHORIZED_PARTIES"] = "https://pilot.invalid"
        backend["WATMATCH_READ_ONLY"] = "false"
        frontend["NEXT_PUBLIC_PREVIEW_READ_ONLY"] = "false"
        self.assertTrue(verify.check_config(backend, frontend, "https://pilot.invalid", False))
        backend["CLERK_SECRET_KEY"] = frontend["CLERK_SECRET_KEY"] = "sk_live_synthetic"
        frontend["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] = frontend["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"].replace("pk_test_", "pk_live_")
        self.assertFalse(verify.check_config(backend, frontend, "https://pilot.invalid", False))

    def test_private_https_preview_can_use_development_clerk(self):
        backend, frontend = configuration()
        backend["CLERK_AUTHORIZED_PARTIES"] = "https://preview.invalid"
        verify.check_config(backend, frontend, "https://preview.invalid", True)

    def test_database_key_contract_rejects_invalid_anon_and_new_key_format(self):
        anon_payload = base64.urlsafe_b64encode(b'{"role":"anon"}').decode().rstrip("=")
        values = ("synthetic-only", "sb_secret_synthetic-only", "header.bad.signature",
                  "header." + anon_payload + ".signature", "header.W10.signature")
        for value in values:
            with self.subTest(format=value.split(".")[0]):
                backend, frontend = configuration()
                backend["SUPABASE_SERVICE_ROLE_KEY"] = value
                with self.assertRaises(verify.CheckError) as error:
                    verify.check_config(backend, frontend, "http://127.0.0.1:8080", True)
                self.assertNotIn(value, str(error.exception))

    def test_origin_rejects_cleartext_remote_and_credential_urls(self):
        for value in ("http://pilot.invalid", "https://user:password@pilot.invalid", "https://pilot.invalid/path",
                      "https://pilot.invalid?secret=value", "https://pilot.invalid:bad", "file:///tmp/test"):
            with self.subTest(value=value), self.assertRaises(verify.CheckError):
                verify.origin(value)

    def test_environment_file_privacy_duplicate_and_quoted_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "backend.env"
            path.write_text('# comment\nCLERK_SECRET_KEY="sk_test_synthetic"\n')
            path.chmod(0o600)
            self.assertEqual(verify.environment(path)["CLERK_SECRET_KEY"], "sk_test_synthetic")
            path.chmod(0o644)
            with self.assertRaises(verify.CheckError):
                verify.environment(path)
            path.chmod(0o600)
            path.write_text("CLERK_SECRET_KEY=first\nCLERK_SECRET_KEY=second\n")
            with self.assertRaises(verify.CheckError):
                verify.environment(path)

    def test_invalid_environment_value_is_never_printed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.env"
            path.write_text("CLERK_SECRET_KEY='do not print this secret'\n")
            path.chmod(0o600)
            with patch.object(sys, "argv", ["verify.py", "config", "--origin", "http://localhost:8080",
                                          "--backend-env", str(path), "--frontend-env", str(path)]), \
                    contextlib.redirect_stderr(io.StringIO()) as output:
                self.assertEqual(verify.main(), 1)
            self.assertNotIn("do not print", output.getvalue())

    def http_check(self, *, readiness_code=200, ready=True, auth_code=401, homepage_code=200, allow_unready=False):
        responses = [Response(homepage_code, b"<title>WatMatch</title>"), Response(200, b"<title>WatMatch</title>"),
                     Response(200, {}), Response(200, {"authentication": "clerk", "read_only": True}),
                     Response(auth_code, {}), Response(readiness_code, {
                         "ready": ready, "read_only": True, "clock_synchronized": ready,
                         "database": "reachable", "identity_configuration": "configured",
                     })]
        with patch.object(verify.urllib.request, "build_opener") as factory, contextlib.redirect_stdout(io.StringIO()):
            factory.return_value.open.side_effect = responses
            verify.check_http("http://127.0.0.1:8080", True, allow_unready)
            self.assertEqual(factory.return_value.open.call_count, 6)
            for call in factory.return_value.open.call_args_list:
                self.assertIsInstance(call.args[0], str)  # URL only: no credentials or POST request object.
                self.assertEqual(call.kwargs["timeout"], 8)

    def test_http_probe_only_uses_anonymous_gets(self):
        self.http_check()

    def test_preview_can_report_unready_without_pilot_success(self):
        self.http_check(readiness_code=503, ready=False, allow_unready=True)

    def test_unready_is_a_failure_by_default(self):
        with self.assertRaises(verify.CheckError):
            self.http_check(readiness_code=503, ready=False)

    def test_redirect_and_anonymous_access_fail(self):
        for options in ({"homepage_code": 302}, {"auth_code": 200}, {"readiness_code": 200, "ready": False}):
            with self.subTest(options=options), self.assertRaises(verify.CheckError):
                self.http_check(**options)

    def test_redirect_handler_never_follows(self):
        self.assertIsNone(verify.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.invalid"))


if __name__ == "__main__":
    unittest.main()
