"""Private-preview safeguards. These never substitute sample data for Supabase."""
import os
import subprocess
import threading
import time

import httpx

_clock_lock = threading.Lock()
_clock_checked_at = 0.0
_clock_synchronized = False


def clock_is_synchronized() -> bool:
    """The managed VM must deny authentication until its time service is ready.

    Portable developer hosts may rely on their host's clock instead. The private
    VM service requires this setting and does not permit that opt-out.
    """
    required = os.getenv("WATMATCH_REQUIRE_SYNC_CLOCK", "false").strip().lower()
    if required not in {"true", "false"}:
        return False
    if required == "false":
        return True
    global _clock_checked_at, _clock_synchronized
    with _clock_lock:
        if time.monotonic() - _clock_checked_at >= 5:
            try:
                result = subprocess.run(
                    ["/usr/bin/timedatectl", "show", "--property=NTPSynchronized", "--value"],
                    capture_output=True, text=True, timeout=2, check=False,
                )
                _clock_synchronized = result.returncode == 0 and result.stdout.strip() == "yes"
            except (OSError, subprocess.SubprocessError):
                _clock_synchronized = False
            _clock_checked_at = time.monotonic()
        return _clock_synchronized


def read_only_mode() -> bool:
    value = os.getenv("WATMATCH_READ_ONLY", "true").strip().lower()
    if value not in {"true", "false"}:
        raise ValueError("WATMATCH_READ_ONLY must be true or false")
    return value == "true"


class ReadOnlyPreviewError(RuntimeError):
    pass


def reject_database_write(request: httpx.Request) -> None:
    # Some GET application routes perform cleanup writes or call RPCs. Check the
    # actual database request, before HTTPX can send it, as a second boundary.
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        raise ReadOnlyPreviewError("Database writes and RPC calls are disabled in the private preview")


def protect_database_client(client) -> None:
    if read_only_mode():
        client.postgrest.session.event_hooks["request"].append(reject_database_write)
