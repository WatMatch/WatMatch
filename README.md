# WatMatch

WatMatch helps University of Waterloo students discover capstone projects, form teams, and complete the academic approval process. It supports standalone and interdisciplinary courses while keeping each student's enrollment route explicit.

## Core Workflows

- Explore projects, save options, express interest, and invite teammates.
- Confirm a roster and route each student to an enrollment course.
- Review and finalize projects through role-specific workspaces.
- Turn projects over between terms or publish completed work to Past Capstones.

Students, instructors, academic advisors, enrollment operators, administrators, university mentors, and external partners each receive a workspace limited to their responsibilities. WatMatch records routing decisions and history, but official Quest updates remain manual.

## Design

The client uses Next.js and TypeScript. The FastAPI backend uses Supabase/Postgres for application data and transactional workflow operations. Permissions are enforced by the API and database, not only by hidden UI controls.

A course such as `SE 490` is stored separately from a specific term offering. This allows staffing, availability, held-with relationships, and marketplace phases to change by term. A shared project can have one coordinating review course while each student keeps an individual enrollment course.

## Repository Layout

```text
.
├── src/
│   ├── backend/        FastAPI, database schema, demo seed, and tests
│   └── client/         Next.js application and role workspaces
├── docs/
│   ├── design/         Architecture and workflow design
│   ├── meeting-notes/  Project and stakeholder notes
│   └── slides/         Presentation material
├── abstract.md
└── team.md
```

## Local Development

Create `src/backend/.env` with the required Supabase, JWT, and CORS settings. Never commit credentials.

Backend:

```powershell
Set-Location src/backend
python -m pip install -r requirements.txt
python main.py
```

Frontend:

When running the frontend and backend separately, create `src/client/.env.local`
with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`.

```powershell
Set-Location src/client
npm ci
npm run dev
```

## Vercel Deployment

Import this repository as one Vercel project, with the Root Directory set to the
repository root. The root `vercel.json` builds `backend` from `src/backend`
(FastAPI, `main:app`) and `client` from `src/client` (Next.js).

Public requests under `/api/` go to the backend with their paths unchanged;
all other paths go to the client. Existing backend endpoints remain at
`/api/v1/...`. Backend `/docs`, `/openapi.json`, and `/health` are not exposed by
these rewrites.

The browser calls the public API directly on the same origin. There are currently
no server-to-server calls between these services, so no service bindings are
needed. If server-side calls are added later, declare a binding on the calling
service and read its generated URL only in a runtime function, never in browser
code, middleware, or build configuration. See the
[Vercel service bindings documentation](https://vercel.com/docs/services/bindings).

Configure these environment variables in Vercel for each deployment environment:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the existing backend expects a
  service-role JWT).
- `JWT_SECRET_KEY` and `JWT_REFRESH_SECRET_KEY`, with different secret values.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `FROM_EMAIL` if
  email delivery is needed.
- `NEXT_PUBLIC_API_URL=/api/v1`, or leave it unset to use that default. Remove
  any previous localhost or separately hosted backend override from Vercel.

Same-origin deployment does not require additional CORS origins. `CORS_ORIGINS`
remains available for separate frontend origins. Keep all backend secrets out of
`NEXT_PUBLIC_*` variables and Git.

For a local check of the combined routing, use Python 3.12 or newer for the
backend virtual environment (required by the current Vercel Python runner),
install both services' dependencies, then run a current Vercel CLI from the
repository root:

```sh
NEXT_PUBLIC_API_URL=/api/v1 vercel dev --local
```

The explicit API value overrides any separate-backend setting in local frontend
env files. The backend loads its existing `src/backend/.env`. Check `/login`
and `/api/v1/users/me/interests` on the URL printed by Vercel; an authentication response
from a protected API endpoint is expected when no token is supplied.

Login currently accepts a known email without verifying ownership. This remains
a prototype limitation; production authentication is a separate task.

## Database

Apply `src/backend/db/schema.sql` first. Apply `src/backend/db/demo_seed.sql` only when resetting a demo environment.

The seed requires the historical capstone archive and clears mutable workflow data before rebuilding the demo state. Do not run it against a shared or production database.

## Validation

Backend:

```powershell
Set-Location src/backend
python -m compileall src tests
python -m unittest discover -s tests
```

Frontend:

```powershell
Set-Location src/client
npx tsc --noEmit
npx eslint src --max-warnings=0
npm test
npm run build
```

Database-backed acceptance tests require a configured non-production environment.

## Boundaries

WatMatch does not automate project matching, ranking, seat allocation, or Quest enrollment. It does not expose private student identities publicly. Finalized rosters cannot be changed, and projects cannot be routed to inactive, unavailable, retired, or unstaffed course offerings.
