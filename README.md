# WatMatch

WatMatch is a capstone marketplace, team-formation, academic-routing, and lifecycle-audit platform for the University of Waterloo. It connects students, instructors, academic advisors, enrollment operators, administrators, mentors, and external partners while preserving clear authorization and privacy boundaries.

## Final Scope

The Final implementation supports:

- multi-course and term-offering configuration;
- project discovery, private saves, interest, invitations, and exploration;
- mutual commitment and leader-proposed official rosters;
- same-course, cross-course, interdisciplinary, and no-course routing;
- course-scoped instructor review and lifecycle audit history;
- mentor requests, mentor offers, and external-partner opportunities;
- support-aware team finalization;
- academic completion, term closeout, and course continuation;
- privacy-safe publication of completed WatMatch capstones;
- deterministic demonstration personas and scenarios.

WatMatch records intended course routes and decisions. Registrar/Quest updates remain an explicit manual responsibility outside the application.

## Repository Layout

```text
.
├── src/
│   ├── backend/        FastAPI, Supabase/Postgres RPCs, schema, seed, tests
│   └── client/         Next.js application and role-aware workspaces
├── docs/
│   ├── final/          Final milestone, flows, roles, demo, and validation docs
│   ├── slides/         Presentation evidence
│   └── meeting-notes/  Project and stakeholder notes
├── abstract.md
└── team.md
```

## Architecture

- The frontend uses Next.js and TypeScript.
- The backend uses FastAPI and Python.
- Supabase/Postgres stores application state and owns transactional workflow RPCs.
- Frontend capability checks guide navigation; backend and database authorization remain authoritative.
- Stable courses are distinct from term-specific offerings.
- Coordinating course, per-student enrollment course, and home department remain separate concepts.

## Local Setup

### Backend

```powershell
Set-Location src/backend
python -m pip install -r requirements.txt
python main.py
```

Create `src/backend/.env` with the required Supabase, JWT, and CORS values. Do not commit credentials.

### Frontend

```powershell
Set-Location src/client
npm ci
npm run dev
```

### Non-Production Database

Apply these files through the approved Supabase workflow:

1. `src/backend/db/schema.sql`
2. `src/backend/db/demo_seed.sql` when a deterministic demonstration reset is intended

The demo seed expects the imported historical capstone archive to exist. Use only an approved non-production environment for resets and live acceptance.

## Validation Commands

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

Record validation as complete only after the exact command has passed on the revision being reviewed. Live transaction, authorization, concurrency, phase-lock, and rollback checks require a configured non-production database.

## Documentation

- `docs/design/` contains design and architecture material.
- `docs/meeting-notes/` contains project and stakeholder notes.
- `docs/slides/` preserves presentation evidence.
- Final lifecycle, role, demonstration, and validation references are maintained alongside the implementation under `docs/`.

## Product Boundaries

- No automated matching, ranking, recommendation, or seat allocation.
- No public exposure of private student identities.
- No administrator editing of mentor-owned profile content.
- No student roster mutation after finalization.
- No live routing to draft, inactive, retired, unavailable, or unstaffed courses.
- No implication that an in-app routing decision completes the external Registrar/Quest process.
