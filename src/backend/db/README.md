# Instructor and University Mentor role switching

Existing databases: apply `migrations/20261005_instructor_mentor_roles.sql` in the
Supabase SQL Editor before running the updated backend. The migration is
transactional and safe to reapply. It backfills each existing account's one role;
it does not merge users, grant additional roles automatically, or reset projects.
Fresh databases can use `schema.sql`, which includes the same migration.

The migration has been tested on an isolated database built from the previous
schema, including verification that existing user rows are unchanged. Do not use
`demo_seed.sql` to apply this feature: that file resets workflow data.

## Manual acceptance

1. Log in as `admin@uwaterloo.ca`. Open the Users section of the admin workspace.
2. Find an existing instructor, expand the account, choose **Manage roles**, and
   select both **Instructor** and **University Mentor**. Supply an audit reason.
3. Log out and log in using that instructor's same email. The **Active workspace**
   selector at the bottom of the sidebar switches between Instructor and University
   Mentor. Both directions return to the dashboard and preserve the same account.
4. Refresh while using University Mentor: the workspace remains selected. Log out
   and back in: the default workspace is Instructor for accounts holding both roles.
5. For the reverse setup, grant Instructor to an existing mentor through **Manage
   roles**. Supply its home department and optionally its course. The mentor's
   profile and project history remain attached to the same user ID.
6. Students and single-role accounts have no switcher. Students cannot obtain a
   second role, including through the admin membership endpoint. Staff cannot
   grant themselves roles. Only admins see the membership management controls.
7. Admins can revoke a role. An open session using that role must log in again;
   even its previously issued access and refresh tokens cannot authorize that role.

Switching discards page drafts and cached workspace data. Browser tabs share the
selected workspace and reload when another tab switches. The selection is not a
global change to the person's course or membership. Existing authentication still
stores one refresh token per account; this feature does not add independent
multi-device sessions.

An instructor may approve a project they also mentor, within the existing course
scope. Removing Instructor still protects the last active instructor on a course.
Removing University Mentor is blocked while pending requests or active mentoring
commitments remain. Account deactivation preserves the existing mentor cancellation
rules for both single-role and dual-role accounts.

## Data model and compatibility

`user_roles` stores memberships. Only the Instructor/Mentor pair can contain more
than one membership; every other role, including Student, remains single-role.
`users.role` is retained as the default/compatibility role and is Instructor for
that pair. This preserves existing instructor/course indexes, triggers and query
semantics. A signed `active_role` token claim selects the workspace, and each
protected request validates it against current database memberships. The API's
`role` field continues to mean the active role, with `default_role` and
`assigned_roles` returned separately.

Mentor eligibility and the directory use memberships, regardless of the current
workspace. Existing CSV imports still accept a single `role` column; updating a
dual-role account with its default Instructor role preserves its memberships.
Changing a dual-role account's role through the legacy editor/import is rejected;
use **Manage roles**. Additional role assignment/removal is audited separately.

## Isolated local test environment

Requirements: Docker Desktop, backend dependencies installed in `.venv`, frontend
packages installed, and a supported Node version (tested with Node 22.13.1).
Run these commands from the repository root. These containers use only local test
data and bind their ports to loopback. The test fixture must not run on Supabase.

```sh
docker run -d --name watmatch-roles-test \
  -e POSTGRES_PASSWORD=watmatch-local-test -e POSTGRES_DB=watmatch_test \
  -p 127.0.0.1:55439:5432 postgres:16
# Wait until `docker exec watmatch-roles-test pg_isready -U postgres` succeeds.
docker exec watmatch-roles-test psql -U postgres -d watmatch_test -c \
  'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;'
docker exec -i watmatch-roles-test psql -U postgres -d watmatch_test -v ON_ERROR_STOP=1 < src/backend/db/schema.sql
docker exec -i watmatch-roles-test psql -U postgres -d watmatch_test -v ON_ERROR_STOP=1 < src/backend/tests/db/instructor_mentor_roles.sql
docker exec -i watmatch-roles-test psql -U postgres -d watmatch_test -v ON_ERROR_STOP=1 < src/backend/tests/db/role_preview_fixture.sql
docker run -d --name watmatch-roles-rest -p 127.0.0.1:55440:3000 \
  -e PGRST_DB_URI=postgres://postgres:watmatch-local-test@host.docker.internal:55439/watmatch_test \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_JWT_SECRET=watmatch-role-tests-only-not-a-production-secret-12345 \
  postgrest/postgrest:v12.2.3
```

The `host.docker.internal` address above is provided by Docker Desktop.
Run the full HTTP/database acceptance checks:

```sh
cd src/backend
.venv/bin/python tests/role_http_acceptance.py
```

Then start the preview backend from `src/backend`:

```sh
.venv/bin/python tests/role_test_app.py
```

In a second terminal, from `src/client`:

```sh
NEXT_PUBLIC_API_URL=http://127.0.0.1:8011/api/v1 npm run dev -- --port 3011
```

Open `http://localhost:3011/login`. The acceptance test leaves
`instructor.se@uwaterloo.ca` with both roles. `mentor.lee@uwaterloo.ca` starts with
Mentor only, `admin@uwaterloo.ca` manages roles, and `student.test@uwaterloo.ca`
remains Student only. These are local fixture accounts, separate from the connected
Supabase accounts even where emails match. The test app explicitly replaces all
Supabase and JWT settings with local-only values; it never reads/writes the remote
project through those services.

To stop the preview, stop the two terminal servers and run:

```sh
docker stop watmatch-roles-rest watmatch-roles-test
```
