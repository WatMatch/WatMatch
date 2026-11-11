# WatMatch Backend

This FastAPI service provides WatMatch's project, team, review, and role-based
workflows. It reads application accounts and workflow data through Supabase.
Clerk verifies sign-in identity; WatMatch database records determine access.

## Run the App

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file:

```env
SUPABASE_URL=<existing project HTTPS URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service-role key>
CLERK_ISSUER=<exact Clerk HTTPS origin>
CLERK_SECRET_KEY=<server-only Clerk key>
CLERK_AUTHORIZED_PARTIES=http://127.0.0.1:3000,http://localhost:3000
CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
WATMATCH_READ_ONLY=true
HOST=127.0.0.1
```

Start the backend:

```bash
python main.py
```

Or run with hot reload:

```bash
uvicorn main:app --reload --host 127.0.0.1
```

The API runs at:

```text
http://localhost:8000
```

## Dependency verification

Use Python 3.13 and a fresh virtual environment when changing dependencies.
Installing into an old environment can retain packages removed from requirements.
From `src/backend`, run:

```bash
python -m pip install -r requirements.txt
python -m pip check
python -I -B -m unittest discover -s tests
```

The dependency tests use synthetic JWTs, a blocked network, and mocked database
responses. They check the retained legacy token helper, invalid-token rejection,
API startup, and the Supabase table/RPC client interfaces. The Clerk tests also
prove that legacy tokens cannot authorize active API routes. They do not verify
real database access or production identity. Newer FastAPI returns `401` with a
Bearer challenge for missing credentials; role failures still return `403`.

## Trusted sign-in

Protected API routes accept Clerk RS256 session tokens only. The backend verifies
signature, issuer, authorized browser origin, required time/session claims, and
current Clerk session state. It retrieves the user's verified primary email from
Clerk, then reads exactly one active, pre-provisioned WatMatch account. The
account's database role and course determine access. Browser claims and Clerk
metadata cannot assign application roles. No account is created automatically.

Required server-only settings:

```text
CLERK_ISSUER=<exact Clerk HTTPS origin, without a trailing slash>
CLERK_SECRET_KEY=<Clerk server secret for the same instance>
CLERK_AUTHORIZED_PARTIES=http://127.0.0.1:3000,http://localhost:3000
```

Use an exact comma-separated list of approved browser origins. HTTP origins are
allowed only for loopback development. Set optional `CLERK_AUDIENCE` only when
that exact audience is configured on the Clerk token. The instance must verify
its users' primary email addresses. The frontend publishable key must refer to
the same instance as `CLERK_ISSUER` and `CLERK_SECRET_KEY`.

The backend retrieves keys only from `CLERK_ISSUER/.well-known/jwks.json` and uses
`https://api.clerk.com/v1` to check session/user status on each authenticated
request. Requests use normal `HTTPS_PROXY`/`NO_PROXY` settings, certificate
verification, short timeouts, and no redirects. Only public signing keys are
cached: at most 16 keys for five minutes, with at most one refresh per 30 seconds.
Session revocation and primary-email changes are not cached. An identity service
or database failure denies access with a sanitized error.

The former `/api/v1/auth/login`, `/refresh`, `/logout`, and `/logout-all` POST
routes return `410`. Sign-in, refresh, and sign-out use Clerk. Legacy HS256 tokens
cannot authorize API requests. `JWT_SECRET_KEY` and `JWT_REFRESH_SECRET_KEY` are
not used by the active application. Retained legacy helper code is unreachable
from these routes; it is not a fallback authentication mode.

The Clerk tests generate temporary RSA keys and synthetic sessions. Network
connections and database writes are blocked. Passing these tests does not prove
that the configured Clerk instance, its policies, or real accounts are ready.
The private preview's read-only guard remains separate from identity verification.

### Private VM preview safeguards

`WATMATCH_READ_ONLY` defaults to `true`. It blocks mutating API requests and
non-GET PostgREST requests before transport. Some existing GET routes perform
cleanup or call RPC functions; these operations are also blocked. Do not treat
this mode as full workflow acceptance. Set it to `false` only for an authorized
write environment with the required data protection and tests.

On the managed VM, `WATMATCH_REQUIRE_SYNC_CLOCK=true` is mandatory. The API reads
systemd's clock synchronization state and denies authentication when it is not
synchronized. This check is cached for five seconds. Portable development hosts
can use their host-managed clock with the default `false`; JWT signature and
expiry validation always remain enabled.

- `/api/health` checks the API process.
- `/api/status` reports the authentication provider and read-only mode.
- `/api/readiness` checks configuration, required clock synchronization and a
  bounded zero-row database read. HTTP 503 means a dependency is unavailable.
  HTTP 200 does not prove schema compatibility, trusted user enrollment, or pilot
  acceptance. The probe never reads user records or applies SQL changes.

The current private preview uses a Clerk development instance. Use a configured
production instance and approved HTTPS origin before inviting pilot users.
WatIAM SSH access is separate from Waterloo web SSO registration.

See [workspace membership and role selection](db/README.md) for the required incremental migrations, test fixture and role checks.
