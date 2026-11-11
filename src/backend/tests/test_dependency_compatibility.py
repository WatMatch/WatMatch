"""Offline regression tests for the JWT dependency replacement.

The fixture tokens were generated with python-jose 3.3.0. Their keys are public,
synthetic test data. No application environment or database is used.
"""
import base64
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

import jwt

BACKEND = Path(__file__).resolve().parents[1]
ACCESS_KEY = "watmatch-dependency-test-access-key-not-a-secret"
REFRESH_KEY = "watmatch-dependency-test-refresh-key-not-a-secret"
LEGACY_TOKENS = {'access': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0Miwicm9sZSI6InN0dWRlbnQiLCJleHAiOjQxMDI0NDQ4MDAsInR5cGUiOiJhY2Nlc3MifQ.EQJqrSkRkPetQ1fdR7FUO5orOOBZSMgQE9wl685ZTxg', 'refresh': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo0Miwicm9sZSI6InN0dWRlbnQiLCJleHAiOjQxMDI0NDQ4MDAsInR5cGUiOiJyZWZyZXNoIn0.VLDBxEvYLNZFTkY4uRScnN_off4DXD7uVB1XZ6UN22g'}


class JwtDependencyCompatibilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location(
            "isolated_jwt_utils", BACKEND / "src/auth/jwt_utils.py"
        )
        cls.tokens = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {
            "JWT_SECRET_KEY": ACCESS_KEY,
            "JWT_REFRESH_SECRET_KEY": REFRESH_KEY,
        }, clear=True), patch("dotenv.load_dotenv", return_value=False):
            spec.loader.exec_module(cls.tokens)

    def test_accepts_previous_python_jose_tokens(self):
        for kind in ("access", "refresh"):
            with self.subTest(kind=kind):
                verify = getattr(self.tokens, f"verify_{kind}_token")
                self.assertEqual(verify(LEGACY_TOKENS[kind])["user_id"], 42)

    def test_new_tokens_preserve_claims_algorithm_and_lifetimes(self):
        for kind, lifetime in (("access", 15 * 60), ("refresh", 7 * 24 * 60 * 60)):
            with self.subTest(kind=kind):
                before = int(time.time())
                token = getattr(self.tokens, f"create_{kind}_token")({"user_id": 42, "role": "student"})
                payload = getattr(self.tokens, f"verify_{kind}_token")(token)
                self.assertEqual(jwt.get_unverified_header(token)["alg"], "HS256")
                self.assertEqual(payload["type"], kind)
                self.assertEqual(payload["role"], "student")
                self.assertGreaterEqual(payload["exp"], before + lifetime)
                self.assertLessEqual(payload["exp"], int(time.time()) + lifetime)

    def test_rejects_tampered_payloads(self):
        for kind in ("access", "refresh"):
            with self.subTest(kind=kind):
                header, body, signature = LEGACY_TOKENS[kind].split(".")
                payload = json.loads(base64.urlsafe_b64decode(body + "=="))
                payload["role"] = "instructor"
                body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
                self.assertIsNone(getattr(self.tokens, f"verify_{kind}_token")(f"{header}.{body}.{signature}"))

    def test_rejects_expired_tokens(self):
        for kind, key in (("access", ACCESS_KEY), ("refresh", REFRESH_KEY)):
            with self.subTest(kind=kind):
                token = jwt.encode({"user_id": 42, "type": kind, "exp": 1}, key, algorithm="HS256")
                self.assertIsNone(getattr(self.tokens, f"verify_{kind}_token")(token))

    def test_rejects_wrong_key(self):
        for kind in ("access", "refresh"):
            with self.subTest(kind=kind):
                token = jwt.encode({"user_id": 42, "type": kind, "exp": 4102444800}, "unrelated-dependency-test-key-not-a-secret", algorithm="HS256")
                self.assertIsNone(getattr(self.tokens, f"verify_{kind}_token")(token))

    def test_rejects_wrong_type_even_with_correct_key(self):
        for kind, key, other in (("access", ACCESS_KEY, "refresh"), ("refresh", REFRESH_KEY, "access")):
            with self.subTest(kind=kind):
                token = jwt.encode({"user_id": 42, "type": other, "exp": 4102444800}, key, algorithm="HS256")
                self.assertIsNone(getattr(self.tokens, f"verify_{kind}_token")(token))

    def test_access_and_refresh_tokens_are_not_interchangeable(self):
        self.assertIsNone(self.tokens.verify_access_token(LEGACY_TOKENS["refresh"]))
        self.assertIsNone(self.tokens.verify_refresh_token(LEGACY_TOKENS["access"]))

    def test_rejects_unsigned_and_other_algorithm_tokens(self):
        for kind, key in (("access", ACCESS_KEY), ("refresh", REFRESH_KEY)):
            for algorithm in ("none", "HS384"):
                with self.subTest(kind=kind, algorithm=algorithm):
                    token = jwt.encode({"user_id": 42, "type": kind, "exp": 4102444800}, "" if algorithm == "none" else key, algorithm=algorithm)
                    self.assertIsNone(getattr(self.tokens, f"verify_{kind}_token")(token))

    def test_rejects_malformed_tokens(self):
        for token in ("", "invalid", "a.b.c"):
            self.assertIsNone(self.tokens.verify_access_token(token))
            self.assertIsNone(self.tokens.verify_refresh_token(token))

    def test_runtime_dependencies_with_network_blocked(self):
        result = subprocess.run(
            [sys.executable, "-I", "-B", str(BACKEND / "tests/runtime_dependency_check.py")],
            cwd=BACKEND, capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
