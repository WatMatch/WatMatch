"""Verify Clerk identity without trusting browser-provided roles or email claims."""
from dataclasses import dataclass, field
from functools import lru_cache
from hashlib import sha256
import json
import os
import re
import threading
import time
from urllib.parse import urlsplit

import httpx
import jwt

CLERK_API_URL = "https://api.clerk.com/v1"
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_TOKEN_BYTES = 16 * 1024


class ClerkAuthError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _invalid() -> ClerkAuthError:
    return ClerkAuthError(401, "Invalid or expired session")


def _unavailable() -> ClerkAuthError:
    return ClerkAuthError(503, "Identity verification is temporarily unavailable")


def _origin(value: str, allow_loopback: bool = False) -> str:
    try:
        parsed = urlsplit(value)
        valid_scheme = parsed.scheme == "https" or (
            allow_loopback and parsed.scheme == "http"
            and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
        )
        # Accessing port also rejects malformed or out-of-range port values.
        parsed.port
        if (not valid_scheme or not parsed.hostname or parsed.username or parsed.password
                or parsed.path or parsed.query or parsed.fragment or "*" in value
                or any(c.isspace() for c in value)):
            raise ValueError
        return value
    except ValueError:
        raise _unavailable() from None


@dataclass(frozen=True)
class ClerkSettings:
    issuer: str
    secret_key: str = field(repr=False)
    authorized_parties: frozenset[str]
    audience: str | None = None


def validate_clerk_settings() -> ClerkSettings:
    """Validate names and formats only; never contact Clerk or disclose values."""
    issuer = os.getenv("CLERK_ISSUER", "").strip()
    key = os.getenv("CLERK_SECRET_KEY", "").strip()
    parties = [part.strip() for part in os.getenv("CLERK_AUTHORIZED_PARTIES", "").split(",")]
    if (not key.startswith(("sk_test_", "sk_live_")) or len(key) <= 8
            or any(c.isspace() for c in key) or not all(parties)):
        raise _unavailable()
    audience = os.getenv("CLERK_AUDIENCE", "").strip() or None
    return ClerkSettings(_origin(issuer), key,
                         frozenset(_origin(part, allow_loopback=True) for part in parties), audience)


class ClerkVerifier:
    """Bound the JWKS cache; verify current session/user state on every request."""
    def __init__(self, settings: ClerkSettings, transport: httpx.BaseTransport | None = None):
        self.settings = settings
        self._transport = transport
        self._keys: dict[str, jwt.PyJWK] = {}
        self._keys_expire = 0.0
        self._last_refresh = float("-inf")
        self._key_lock = threading.Lock()

    def _get_json(self, url: str, *, authenticated: bool = False) -> dict:
        headers = {"Accept": "application/json", "User-Agent": "watmatch-auth/1.0"}
        if authenticated:
            headers["Authorization"] = f"Bearer {self.settings.secret_key}"
        try:
            with httpx.Client(timeout=httpx.Timeout(5.0, connect=3.0),
                              follow_redirects=False, trust_env=True,
                              transport=self._transport) as client:
                with client.stream("GET", url, headers=headers) as response:
                    if authenticated and response.status_code == 404:
                        raise _invalid()
                    if response.status_code != 200:
                        raise _unavailable()
                    content = bytearray()
                    for chunk in response.iter_bytes():
                        content.extend(chunk)
                        if len(content) > MAX_RESPONSE_BYTES:
                            raise _unavailable()
                    data = json.loads(content)
                    if not isinstance(data, dict):
                        raise _unavailable()
                    return data
        except (httpx.HTTPError, ValueError, TypeError):
            raise _unavailable() from None

    def _signing_key(self, kid: str) -> jwt.PyJWK:
        with self._key_lock:
            now = time.monotonic()
            if now < self._keys_expire and kid in self._keys:
                return self._keys[kid]
            # An attacker cannot force a remote JWKS request for every random kid.
            if now - self._last_refresh < 30:
                if now >= self._keys_expire:
                    raise _unavailable()
                raise _invalid()
            self._last_refresh = now
            payload = self._get_json(self.settings.issuer + "/.well-known/jwks.json")
            keys = payload.get("keys")
            if not isinstance(keys, list) or not 1 <= len(keys) <= 16:
                raise _unavailable()
            parsed_keys = {}
            try:
                for raw in keys:
                    if not isinstance(raw, dict):
                        raise ValueError
                    if raw.get("kty") != "RSA" or raw.get("use", "sig") != "sig" or raw.get("alg", "RS256") != "RS256":
                        continue
                    key_id = raw.get("kid")
                    if not isinstance(key_id, str) or not 1 <= len(key_id) <= 128 or key_id in parsed_keys:
                        raise ValueError
                    key = jwt.PyJWK.from_dict(raw, algorithm="RS256")
                    if key.key.key_size < 2048:
                        raise ValueError
                    parsed_keys[key_id] = key
            except (ValueError, TypeError, jwt.PyJWTError, AttributeError):
                raise _unavailable() from None
            if not parsed_keys:
                raise _unavailable()
            self._keys = parsed_keys
            self._keys_expire = time.monotonic() + 300
            if kid not in self._keys:
                raise _invalid()
            return self._keys[kid]

    def verified_account(self, token: str) -> tuple[str, str]:
        if not isinstance(token, str) or not token or len(token) > MAX_TOKEN_BYTES:
            raise _invalid()
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError:
            raise _invalid() from None
        kid = header.get("kid")
        if header.get("alg") != "RS256" or not isinstance(kid, str) or not 1 <= len(kid) <= 128:
            raise _invalid()
        key = self._signing_key(kid)
        try:
            claims = jwt.decode(token, key.key, algorithms=["RS256"],
                                issuer=self.settings.issuer, audience=self.settings.audience,
                                options={"require": ["exp", "nbf", "iat", "iss", "sub", "sid", "azp"]})
        except (jwt.PyJWTError, ValueError, TypeError, OverflowError):
            raise _invalid() from None
        if (not isinstance(claims.get("azp"), str)
                or claims["azp"] not in self.settings.authorized_parties
                or claims.get("sts", "active") != "active"
                or not isinstance(claims.get("sub"), str)
                or not re.fullmatch(r"user_[A-Za-z0-9]+", claims["sub"])
                or not isinstance(claims.get("sid"), str)
                or not re.fullmatch(r"sess_[A-Za-z0-9]+", claims["sid"])):
            raise _invalid()
        # Timestamp types must be numeric dates, not bools or coercible strings.
        if any(type(claims[name]) not in (int, float) for name in ("exp", "nbf", "iat")):
            raise _invalid()
        if claims["exp"] <= claims["iat"] or claims["exp"] <= claims["nbf"]:
            raise _invalid()
        session = self._get_json(CLERK_API_URL + "/sessions/" + claims["sid"], authenticated=True)
        if (session.get("id") != claims["sid"] or session.get("status") != "active"
                or session.get("user_id") != claims["sub"]):
            raise _invalid()
        user = self._get_json(CLERK_API_URL + "/users/" + claims["sub"], authenticated=True)
        if user.get("id") != claims["sub"]:
            raise _invalid()
        if user.get("banned") is not False or user.get("locked") is not False:
            raise ClerkAuthError(403, "This identity is not permitted")
        addresses = user.get("email_addresses")
        if not isinstance(addresses, list):
            raise _unavailable()
        primary_id = user.get("primary_email_address_id")
        primary = [address for address in addresses if isinstance(address, dict) and address.get("id") == primary_id]
        if (not primary_id or len(primary) != 1
                or not isinstance(primary[0].get("verification"), dict)
                or primary[0]["verification"].get("status") != "verified"):
            raise ClerkAuthError(403, "A verified primary email address is required")
        email = primary[0].get("email_address")
        if not isinstance(email, str):
            raise _unavailable()
        email = email.strip().lower()
        if (len(email) > 320 or email.count("@") != 1 or any(c.isspace() or ord(c) < 32 for c in email)
                or not all(email.split("@"))):
            raise _unavailable()
        # A workspace is local to this verified issuer and session. Keep the
        # original Clerk session identifier out of database rows and API responses.
        session_key = sha256((self.settings.issuer + "\0" + claims["sid"]).encode()).hexdigest()
        return email, session_key


@lru_cache(maxsize=1)
def _configured_verifier(settings: ClerkSettings) -> ClerkVerifier:
    return ClerkVerifier(settings)


def get_clerk_verifier() -> ClerkVerifier:
    # Reload settings so a configuration change cannot retain a stale issuer/key.
    return _configured_verifier(validate_clerk_settings())
