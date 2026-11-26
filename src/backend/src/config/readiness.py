"""Bounded, zero-row connectivity probe; not a pilot or schema acceptance test."""
import os
import threading
import time

import httpx

from .runtime_safety import read_only_mode, clock_is_synchronized

_lock = threading.Lock()
_checked_at = 0.0
_database_reachable = False


def service_readiness() -> dict:
    global _checked_at, _database_reachable
    from src.auth.clerk_auth import ClerkAuthError, validate_clerk_settings

    try:
        validate_clerk_settings()
        identity_configured = True
    except (ValueError, RuntimeError, ClerkAuthError):
        identity_configured = False
    with _lock:
        now = time.monotonic()
        if now - _checked_at >= 15:
            _database_reachable = False
            url = os.getenv("SUPABASE_URL", "").rstrip("/")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            if url and key:
                try:
                    with httpx.Client(timeout=3, follow_redirects=False) as client:
                        response = client.get(
                            url + "/rest/v1/users",
                            params={"select": "user_id", "limit": "0"},
                            headers={"apikey": key, "Authorization": "Bearer " + key},
                        )
                    _database_reachable = response.status_code == 200 and response.json() == []
                except (httpx.HTTPError, ValueError):
                    pass
            _checked_at = time.monotonic()
    clock_ready = clock_is_synchronized()
    return {
        "ready": identity_configured and _database_reachable and clock_ready,
        "scope": "configuration_clock_and_database_connection_only",
        "clock_synchronized": clock_ready,
        "identity_configuration": "configured" if identity_configured else "unavailable",
        "database": "reachable" if _database_reachable else "unavailable",
        "read_only": read_only_mode(),
    }
