# Instructor and University Mentor role switching

## Existing invite RPC upgrade

Some existing databases expose only the three-argument `watmatch_revoke_invite`
routine. The application sends `p_reason` as a fourth named argument, so those
databases reject the request before revocation runs. Apply
`migrations/20261125_invite_revoke_reason.sql` through the reviewed database
rollout. The transaction replaces the old overload, keeps optional arguments
for existing callers, and restricts execution to the backend service role.
It preserves stored rows and refreshes the PostgREST schema cache on commit.
Unexpected routine dependencies or custom execute grants abort the transaction
for review. Fresh databases already get this routine from `schema.sql`.

With PostgreSQL's `initdb`, `pg_ctl`, and `psql` on `PATH`, run from the repository
root:

```sh
bash src/backend/tests/invite_revoke/run.sh
```

The runner always creates and removes a private Unix-socket PostgreSQL cluster.
It models the old signature on the full schema using synthetic records, applies
the migration twice, compares every public table, and checks role/course scope,
required reasons, audit records, repeated requests, restricted execution, and
transaction rollback. It does not reproduce an entire deployed database snapshot.

## Membership migration order

Existing databases: apply `migrations/20261005_instructor_mentor_roles.sql` as part of the
approved database rollout, followed by `migrations/20261111_clerk_role_sessions.sql`, before running the updated backend. The migration is
transactional and safe to reapply. It backfills each existing account's one role;
it does not merge users, grant additional roles automatically, or reset projects.
Fresh databases can use `schema.sql`, which includes the same migration.

The migration has been tested on an isolated database built from the previous
schema, including verification that existing user rows are unchanged. Do not use
`demo_seed.sql` to apply this feature: that file resets workflow data.

## Manual acceptance

1. Sign in to Clerk with an approved test administrator. Open the Users section of the admin workspace.
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
   the existing Clerk session can no longer authorize that role.

Switching reloads the workspace and its cached data in all tabs sharing a
Clerk session. A separate signed-in session keeps its own selection. The API
checks the durable selection and current memberships on every protected request.
A stale tab receives a conflict if it tries to act in its old workspace.
Switches are audited and use a user-row lock shared with admin role changes.

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
semantics. The verified Clerk session selects a server-side record in
`clerk_role_sessions`. Memberships and the saved selection are read in one query.
The UI may send its expected workspace as a precondition. It cannot use that
header or a token role claim to grant itself a role. The API's
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
  'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;'
docker exec -i watmatch-roles-test psql -U postgres -d watmatch_test -v ON_ERROR_STOP=1 < src/backend/db/schema.sql
docker exec -i watmatch-roles-test psql -U postgres -d watmatch_test -v ON_ERROR_STOP=1 < src/backend/tests/db/instructor_mentor_roles.sql
docker exec -i watmatch-roles-test psql -U postgres -d watmatch_test -v ON_ERROR_STOP=1 < src/backend/tests/db/clerk_role_sessions.sql
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

The in-process HTTP suite uses signed synthetic Clerk tokens and a simulated
Clerk identity service. Database requests go through real, loopback-only
PostgREST and PostgreSQL. It requires the marker in the disposable test fixture.
For interactive sign-in with Clerk, use the trusted-authentication settings in
the backend and client READMEs and pre-provisioned test accounts.

Stop the disposable database and gateway after the checks finish:

```sh
docker stop watmatch-roles-rest watmatch-roles-test
```
