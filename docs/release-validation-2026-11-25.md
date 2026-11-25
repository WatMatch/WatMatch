# Release candidate validation — 25 November 2026

The integrated candidate includes PRs #6, #7, #9, #10, #11, #12 and #13,
the incremental invite-revocation repair, deployment checks and pilot instructions.
Application code was tested at `cd80af7543668818688278d32d5419c873f070fa`.
The deployment checks from `424c23b40e15bf65b1b8eaf069e9ed7c1a9d9906` were
merged at `2292034`. Later preparation changes add package constraints and this
record. These results cover the local candidate. The running Waterloo release
was not changed or retested on this date.

## Environment

macOS ARM64, Node 23.10.0, npm 10.9.2, Python 3.13.7, PostgreSQL 15.17 and
PostgREST 16.5. Existing backend dependencies matched the requirements and the
previously verified 45-package VM set. The candidate has its own copied client
dependency directory. The security update changed only Next.js, its matching
lint configuration and the corresponding Next.js lock entries to 15.5.29.

The VM's previously recorded runtimes were Node 22.22.1 and Python 3.13.18.
Repeat the build on that target before activation. The local build succeeded
with a workspace-root warning caused by another lockfile above this checkout.

## Commands and results

`python` below means the verified Python 3.13 environment. Commands ran from
the directory named in the table. Database checks used a new, private Unix
socket PostgreSQL cluster and loopback PostgREST with synthetic records.
Every temporary process was stopped and its database removed after the check.

| Directory | Command or check | Result and scope |
| --- | --- | --- |
| `src/backend` | `python -I -B -m unittest discover -s tests` | 130 passed. Source contracts and mocked runtime/authentication tests. |
| `src/backend` | `python -I -B tests/runtime_dependency_check.py` | Passed API health, auth refusal, input validation, CORS and mocked Supabase table/RPC calls. Network sockets blocked. |
| `src/backend` | `python -m pip check` | Passed. |
| `src/client` | `npm test` | 30 passed, zero failed or skipped. |
| `src/client` | `npm run lint` | Passed with zero warnings. |
| `src/client` | `./node_modules/.bin/tsc --noEmit --incremental false` | Passed. |
| `src/client` | `npm run build` | Passed after the Next.js patch. |
| `src/client` | `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port <temporary-port>` | Overview and login returned 200 with PR #13 wording. A referenced local JavaScript asset returned 200 with content. Server stopped. |
| Repository root | `python3 -I -B -m unittest discover -s deploy/tests -v` | 14 passed. Temporary configuration and mocked HTTP checks. |
| Repository root | `bash src/backend/tests/course_phase/run.sh` | Passed on a fresh schema and with `PHASE_BASE_SCHEMA` pointing to the exported current-main schema. Migration applied twice. Checked roles, grants, RLS, audit, stale actions, atomic edits and rollover. |
| Repository root | `bash src/backend/tests/invite_revoke/run.sh` | Passed upgrade, reapplication, original data preservation, authorization, retries, and rollback when preconditions fail. |
| Disposable database | `tests/db/instructor_mentor_roles.sql`, `tests/db/clerk_role_sessions.sql`, `tests/milestone_feedback_trial.sql` through `psql -X -v ON_ERROR_STOP=1 -f` | Passed on both fresh and upgraded schemas. Includes permissions and audit assertions. |
| `src/backend` | `python -B tests/role_http_acceptance.py` | 28 passed using signed synthetic Clerk sessions, the application API, real PostgREST and PostgreSQL. |
| `src/backend` | `python -B tests/workspace_workflow_acceptance.py` | Passed instructor/team access, outsider refusals, duplicate submissions and active-workspace restrictions. |

## Complete upgrade rehearsal

The baseline was current main
`e12f0dfe4097c2b42844c38450d0bc030ed39005`, exported with
`git show e12f0df:src/backend/db/schema.sql`. Synthetic role-preview fixtures
were inserted before upgrading. The following sequence ran twice:

1. `20261005_instructor_mentor_roles.sql`
2. `20261111_clerk_role_sessions.sql`
3. `20261111_instructor_phase_control.sql`
4. `20261125_invite_revoke_reason.sql`
5. `20261111_capstone_milestone_feedback.sql`

After each complete pass, all 32 original public tables had the same rows and
original-column values as before the migration. The comparison used sorted JSON
row hashes over the columns captured before migration. New columns and tables
were checked through the feature acceptance suites. The role/session/milestone
SQL and both HTTP suites also passed against this upgraded database.

This rehearsal used repository schema and synthetic records. Restore and test a
current shared-database backup before its approved rollout. These tests do not
verify the current shared schema or the contents of a production backup.

## Dependency evidence

`npm audit --omit=dev --json` returned zero advisories after the targeted
Next.js 15.5.29 patch. Six moderate findings remain in the development lint
dependency chain through `minimatch`. They are tracked in the pilot release
issue. The audit does not establish that unknown vulnerabilities are absent.

`pip-audit -r <installed-package-freeze> --no-deps --disable-pip` checked all
45 installed application packages and reported zero known advisories, with
zero packages skipped. The same versions are recorded in
`src/backend/constraints-python313.txt`. A resolver dry run verified that all
45 versions have usable Linux x86-64/Python 3.13 wheel candidates, with no
extra packages:

```sh
python -m pip install --dry-run --ignore-installed --only-binary=:all: \
  --python-version 3.13 --implementation cp --abi cp313 \
  --platform manylinux_2_28_x86_64 --platform manylinux2014_x86_64 \
  --platform manylinux_2_17_x86_64 \
  -r requirements.txt -c constraints-python313.txt --report resolution.json
```

This verifies package selection and available wheels. The actual new Linux
installation and target build still require a VM run. Constraints pin versions
and do not supply artifact hashes.

## Pilot acceptance still required

Use [the deployment guide](../deploy/README.md) and
[pilot acceptance tasks](pilot-acceptance.md). Confirm the approved HTTPS
origin and synchronized VM clock, the actual Clerk instance and accounts,
reviewed shared migrations and credential rotation, and a complete student
workflow on the final release. The local identity provider was simulated.
The production smoke checked HTML and JavaScript transport. Real provider
sign-in, browser authorization and student use at the final HTTPS URL remain
unverified for this candidate. Passing readiness alone does not close them.
