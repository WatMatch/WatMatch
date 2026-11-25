"""Check deployment configuration or anonymous HTTP responses without writes."""
import argparse
import base64
import json
import re
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class CheckError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise CheckError(message)


def origin(value):
    parsed = urllib.parse.urlsplit(value)
    require(
        parsed.scheme in {"http", "https"}
        and parsed.hostname
        and not parsed.username
        and not parsed.password
        and parsed.path in {"", "/"}
        and not parsed.query
        and not parsed.fragment,
        "Origin must contain only an HTTP(S) scheme, hostname and optional port",
    )
    require(parsed.scheme == "https" or parsed.hostname in {"localhost", "127.0.0.1", "::1"},
            "HTTP is allowed only for a loopback origin")
    try:
        parsed.port
    except ValueError:
        raise CheckError("Origin port is invalid") from None
    return value.rstrip("/")


def environment(path):
    """Read the simple assignment format used by the supplied systemd templates."""
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode), "Environment input must be a regular file")
    require(info.st_mode & 0o077 == 0, "Environment input must be private (mode 0600 or 0400)")
    values = {}
    for number, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"([A-Z][A-Z0-9_]*)=(.*)", line)
        require(match is not None, f"Invalid environment assignment on line {number}")
        name, value = match.groups()
        require(name not in values, f"Duplicate variable {name}")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        require(not any(character.isspace() or character in "\\\"'`" for character in value),
                f"{name} requires a simple single-line value")
        values[name] = value
    return values


def check_config(backend, frontend, public_origin, read_only):
    public_origin = origin(public_origin)
    required_backend = (
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLERK_ISSUER", "CLERK_SECRET_KEY",
        "CLERK_AUTHORIZED_PARTIES", "WATMATCH_READ_ONLY", "WATMATCH_REQUIRE_SYNC_CLOCK",
    )
    required_frontend = (
        "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_PREVIEW_READ_ONLY",
    )
    for values, names in ((backend, required_backend), (frontend, required_frontend)):
        for name in names:
            require(bool(values.get(name)), f"Missing or empty {name}")
    for name in frontend:
        require(not name.startswith("SUPABASE_") and not name.startswith("JWT_"),
                f"Server-only database or legacy token variable in frontend: {name}")
    for name in set(backend) | set(frontend):
        require(not (name.startswith("NEXT_PUBLIC_") and
                     any(part in name for part in ("SECRET", "SERVICE_ROLE", "PASSWORD"))),
                f"Secret variable must not be browser-visible: {name}")
    expected = "true" if read_only else "false"
    require(backend["WATMATCH_READ_ONLY"] == expected, "WATMATCH_READ_ONLY does not match the requested mode")
    require(frontend["NEXT_PUBLIC_PREVIEW_READ_ONLY"] == expected,
            "NEXT_PUBLIC_PREVIEW_READ_ONLY does not match the requested mode")
    require(backend["WATMATCH_REQUIRE_SYNC_CLOCK"] == "true", "WATMATCH_REQUIRE_SYNC_CLOCK must be true on the VM")
    parties = [item.strip() for item in backend["CLERK_AUTHORIZED_PARTIES"].split(",")]
    require(public_origin in parties, "CLERK_AUTHORIZED_PARTIES does not include the browser origin")
    for party in parties:
        require(origin(party) == party, "CLERK_AUTHORIZED_PARTIES must contain canonical origins")
    if backend.get("CORS_ORIGINS"):
        cors = [origin(item.strip()) for item in backend["CORS_ORIGINS"].split(",")]
        require(public_origin in cors, "CORS_ORIGINS does not include the browser origin")
    require(frontend["NEXT_PUBLIC_API_URL"] == "/api/v1", "NEXT_PUBLIC_API_URL must be /api/v1 for this same-origin deployment")
    issuer = origin(backend["CLERK_ISSUER"])
    require(issuer.startswith("https://") and issuer == backend["CLERK_ISSUER"],
            "CLERK_ISSUER must be a canonical HTTPS origin")
    require(origin(backend["SUPABASE_URL"]).startswith("https://"), "SUPABASE_URL must use HTTPS")
    # Match the backend's supported key contract without importing database.py,
    # which would create a live Supabase client. Decoding does not verify a key.
    parts = backend["SUPABASE_SERVICE_ROLE_KEY"].split(".")
    require(len(parts) == 3 and all(parts), "SUPABASE_SERVICE_ROLE_KEY must use the supported JWT format")
    try:
        payload = base64.b64decode(parts[1] + "=" * (-len(parts[1]) % 4), altchars=b"-_", validate=True)
        claims = json.loads(payload)
    except (ValueError, UnicodeError):
        raise CheckError("SUPABASE_SERVICE_ROLE_KEY payload is invalid") from None
    require(isinstance(claims, dict) and claims.get("role") == "service_role",
            "SUPABASE_SERVICE_ROLE_KEY must contain the service_role role")
    secret = re.fullmatch(r"sk_(test|live)_[A-Za-z0-9_-]+", backend["CLERK_SECRET_KEY"])
    publishable = re.fullmatch(r"pk_(test|live)_([A-Za-z0-9_+/=-]+)", frontend["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"])
    require(secret is not None and publishable is not None, "Clerk key format is invalid")
    require(secret.group(1) == publishable.group(1), "Clerk key instance types differ")
    require(frontend["CLERK_SECRET_KEY"] == backend["CLERK_SECRET_KEY"], "CLERK_SECRET_KEY differs between services")
    encoded = publishable.group(2)
    try:
        public_host = base64.b64decode(encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True).decode()
    except (ValueError, UnicodeError):
        raise CheckError("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY encoding is invalid") from None
    require(public_host == urllib.parse.urlsplit(issuer).netloc + "$", "Clerk publishable key and issuer differ")
    api_feedback = backend.get("WATMATCH_MILESTONE_FEEDBACK_ENABLED", "false")
    client_feedback = frontend.get("NEXT_PUBLIC_MILESTONE_FEEDBACK_ENABLED", "false")
    require(api_feedback in {"true", "false"} and api_feedback == client_feedback,
            "Milestone feature flags must match and be true or false")
    return secret.group(1) == "test"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def check_http(public_origin, read_only, allow_unready=False):
    public_origin = origin(public_origin)
    loopback = urllib.parse.urlsplit(public_origin).hostname in {"localhost", "127.0.0.1", "::1"}
    handlers = [NoRedirect()]
    if loopback:
        handlers.append(urllib.request.ProxyHandler({}))
    opener = urllib.request.build_opener(*handlers)

    def get(path):
        try:
            response = opener.open(public_origin + path, timeout=8)
        except urllib.error.HTTPError as error:
            response = error
        except (OSError, urllib.error.URLError):
            raise CheckError(f"{path}: connection failed") from None
        with response:
            return response.status, response.read(2 * 1024 * 1024)

    for path in ("/", "/login"):
        code, body = get(path)
        require(code == 200 and b"WatMatch" in body, f"{path}: expected WatMatch HTML with HTTP 200")
        print(f"PASS {path}: HTML served")
    code, _ = get("/api/health")
    require(code == 200, "/api/health: expected HTTP 200")
    code, raw = get("/api/status")
    status = json.loads(raw)
    require(isinstance(status, dict), "/api/status: expected a JSON object")
    require(code == 200 and status.get("authentication") == "clerk", "/api/status: expected Clerk authentication")
    require(status.get("read_only") is read_only, "/api/status: unexpected read-only mode")
    code, _ = get("/api/v1/auth/me")
    require(code in {401, 403}, "/api/v1/auth/me: anonymous access was not rejected")
    print("PASS API routing, expected mode, and anonymous authentication rejection")
    code, raw = get("/api/readiness")
    readiness = json.loads(raw)
    require(isinstance(readiness, dict), "/api/readiness: expected a JSON object")
    require(code in {200, 503}, "/api/readiness: unexpected HTTP status")
    require(readiness.get("read_only") is read_only, "/api/readiness: unexpected read-only mode")
    ready = readiness.get("ready") is True
    require((code == 200) == ready, "/api/readiness: status and ready field disagree")
    require(isinstance(readiness.get("clock_synchronized"), bool), "/api/readiness: missing clock state")
    if ready:
        require(readiness["clock_synchronized"] and readiness.get("database") == "reachable"
                and readiness.get("identity_configuration") == "configured",
                "/api/readiness: dependencies disagree with ready field")
        print("PASS configuration, clock, and database connectivity readiness")
    else:
        require(allow_unready, "/api/readiness: dependencies are unavailable")
        print("LIMIT readiness HTTP 503; preview-only transport checks passed")
    print("LIMIT anonymous checks do not prove identity, schema compatibility, or a student workflow")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    config = subcommands.add_parser("config")
    config.add_argument("--backend-env", type=Path, required=True)
    config.add_argument("--frontend-env", type=Path, required=True)
    http = subcommands.add_parser("http")
    http.add_argument("--allow-unready", action="store_true", help="preview transport check only")
    for subcommand in (config, http):
        subcommand.add_argument("--origin", required=True)
        subcommand.add_argument("--mode", choices=("read-only", "pilot"), default="read-only")
    args = parser.parse_args()
    try:
        if args.command == "config":
            development_instance = check_config(environment(args.backend_env), environment(args.frontend_env),
                                                args.origin, args.mode == "read-only")
            print("PASS environment names, origin, key consistency and feature modes")
            if development_instance:
                print("LIMIT Clerk development instance; confirm its settings and suitability for the intended testers")
            print("LIMIT format checks do not verify live credentials or the client build's embedded configuration")
        else:
            require(not args.allow_unready or args.mode == "read-only", "--allow-unready is limited to read-only previews")
            check_http(args.origin, args.mode == "read-only", args.allow_unready)
    except CheckError as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError):
        print("FAIL invalid configuration or response; values withheld", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
