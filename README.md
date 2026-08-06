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

```powershell
Set-Location src/client
npm ci
npm run dev
```

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
npm run build
```

Database-backed acceptance tests require a configured non-production environment.

## Boundaries

WatMatch does not automate project matching, ranking, seat allocation, or Quest enrollment. It does not expose private student identities publicly. Finalized rosters cannot be changed, and projects cannot be routed to inactive, unavailable, retired, or unstaffed course offerings.
