# Waterloo VM release preparation

This directory prepares the existing Next.js and FastAPI application for the
Waterloo VM. Supabase remains the database. The private preview is reached
through SSH. Student access needs the HTTPS route agreed with ECE and a tested
identity and enrollment configuration.

The template service files and loopback Nginx site reproduce the configuration
used for the private preview. They keep database writes blocked. Installing a
new code release, changing the database, and exposing a student URL are separate
operator actions. No command in the verification script performs those actions.

## Decisions needed from ECE

Record the answer in the release issue before preparing the final configuration.

| Setting | Required answer |
| --- | --- |
| Browser origin | Exact HTTPS hostname, and whether students use campus or VPN access |
| TLS termination | Certificate and renewal process on the VM, or the ECE-managed proxy and its forwarding contract |
| Network access | Listener/interface and permitted path from the chosen student network |
| Time source | Reachable NTP/NTS source, protocol, and whether ECE manages its guest configuration |

The prepared proxy uses `http://ecserv8.uwaterloo.ca:3128` for outbound HTTPS.
The existing `/etc/watmatch/backend-network.env` is shared by the application
services. `NO_PROXY` must cover `localhost,127.0.0.1,::1`. Chrony uses its own
time protocol. Its last checks showed secure time key-exchange timeouts, which
does not identify the failing network device. A selected time source and
`timedatectl show -p NTPSynchronized` returning `yes` are required on the VM.

## Release contents and current service layout

- `/srv/watmatch/releases/<commit>/` contains an immutable source and dependency build.
- `/srv/watmatch/current` selects that release.
- `/etc/watmatch/backend.env` and `/etc/watmatch/frontend.env` hold private configuration.
- `watmatch-backend.service` runs as `watmatch-api`, on `127.0.0.1:8000`.
- `watmatch-frontend.service` runs as `watmatch-web`, on `127.0.0.1:3000`.
- The current Nginx site listens on `127.0.0.1:8080` and preserves `/api/` paths.
- `/var/cache/watmatch-web` supplies the frontend's writable cache.

The web command intentionally binds `localhost` with IPv4-first DNS. The
previous `127.0.0.1` hostname argument caused Clerk development redirects to
loop. Verify the resulting listener is `127.0.0.1:3000` with `ss -ltn`. The
template overwrites forwarded host, protocol, and client-address headers.
If an ECE proxy terminates TLS, adapt the trusted forwarding contract to that
proxy. Passing through arbitrary browser-supplied forwarding headers is unsafe.

These are the existing service names and locations, not evidence that the latest
review branch is installed. Record the running release with
`readlink -f /srv/watmatch/current` and compare it to the chosen commit.

## Prepare and validate configuration

Use `templates/backend.env.example` and `templates/frontend.env.example` as
references. Keep real files outside the checkout, owned by root with mode 0600.
The examples have empty required fields. Obtain the values from the project's
normal credential owner. Each file uses one `NAME=value` entry per line.
Single-line quoted values are also accepted by the checker. It prints variable
names and outcomes only.

The server secret is required by both the API and Next.js middleware. Only the
Clerk publishable key and `NEXT_PUBLIC_*` feature/API settings belong in browser
bundles. Supabase and legacy JWT signing keys must be absent from the frontend.
The current client requires a rebuild when a `NEXT_PUBLIC_*` setting changes.
The public API base is `/api/v1`, under the same origin as the frontend.

For the existing private origin, run from the release root:

```sh
sudo python3 deploy/verify.py config \
  --backend-env /etc/watmatch/backend.env \
  --frontend-env /etc/watmatch/frontend.env \
  --origin http://127.0.0.1:8080 --mode read-only
```

For a pilot origin, replace `--origin` with the exact approved HTTPS origin and
use `--mode pilot`. The checker expects matching writable-mode flags, the
configured production Clerk instance, and `WATMATCH_REQUIRE_SYNC_CLOCK=true`.
This is a validation command, not permission to enable writes or migrate data.
The private backend service template deliberately requires read-only mode.
The pilot change must also update its `ExecCondition` to require the approved
mode, and rebuild the client with the corresponding notice/feature flags.

The checker confirms consistency and formats. It cannot verify whether keys are
active, how Clerk verifies emails, whether the user has a WatMatch account, or
what values were embedded in an existing frontend build. Verify the live
provider and the exact build metadata separately. Milestone feedback defaults
off. Enable both feature flags only when its migration and intended permission
tests pass. Existing mail settings are optional. Review the selected workflow's
email side effects before using shared pilot data; there is no documented
global notification-disable flag to assume.

## Prepare a release while infrastructure is pending

1. Select the reviewed integration commit. Record its full SHA and dependency
   order in the release issue. Include the role/session, phase, feedback fixes,
   and public-copy branches intended for the pilot. Check the actual merge result.
   The existing Vercel exclusion covers `mid2-review-*`. A merge to another
   branch can deploy Vercel automatically; confirm that project's deployment
   setting before merging when public deployment is outside the task scope.
2. Build in a new unprivileged VM directory, with the selected tracked source.
   Preserve the installed preview and its environment. Build Linux dependencies
   on Linux, using the committed frontend lockfile. The prepared VM has Node
   22.22.1, npm 9.2.0, and separate Python 3.13.18 under `/opt/watmatch`.
   Confirm the actual versions before running. System Python is independent.
3. From `src/backend`, create a new virtual environment with the prepared Python.
   Run its Python as `python -m pip` to avoid a stale shebang if a staged virtual
   environment is relocated. Install the reviewed requirements, capture the
   resolved dependency versions for this release, and run:

   ```sh
   .venv/bin/python -m pip check
   .venv/bin/python -I -B -m unittest discover -s tests
   ```

   The backend requirements include unpinned transitive dependencies. Save the
   resolved lock/freeze with the release evidence, and test the installed result.
   Do not describe this manifest alone as a fully reproducible backend lockfile.
4. From `src/client`, provide the chosen public build configuration and run:

   ```sh
   npm ci --include=dev --include=optional
   npm run lint
   ./node_modules/.bin/tsc --noEmit --incremental false
   npm test
   NEXT_TELEMETRY_DISABLED=1 npm run build
   ```

   Record the publishable-key instance, API path, preview notice and milestone
   flag with the release SHA. A review build can use the loopback development
   instance. Rebuild for the final approved pilot configuration.
5. Run the disposable database and HTTP acceptance checks in
   [the database guide](../src/backend/db/README.md). Use the existing dedicated
   fixtures and local endpoints. `role_test_app.py` validates an isolated fixture
   marker. The signed identities in this suite are synthetic; separately test
   the actual Clerk provider and target browser origin before accepting users.
6. Run `python3 -I -B -m unittest discover -s deploy/tests -v` for this directory.
   These tests mock HTTP responses and use temporary environment files. They
   do not contact the application, Clerk or a database.

Do not place environment files, credential values, user records, native macOS
dependencies, or the Git directory in a release archive. Record an archive
SHA-256 and inventory before moving it into a new VM release directory.

## Database rollout

Existing database changes need a current backup and restore rehearsal on a
disposable database. Confirm the deployed schema before selecting SQL. Apply
incremental migrations with `ON_ERROR_STOP=1`, preserving their transaction
boundaries, in this dependency order:

1. `20261005_instructor_mentor_roles.sql`
2. `20261111_clerk_role_sessions.sql`
3. `20261111_instructor_phase_control.sql`
4. `20261125_invite_revoke_reason.sql`
5. `20261111_capstone_milestone_feedback.sql`, if the pilot includes milestone feedback

These files are in `src/backend/db/migrations/`. Rehearse the same sequence on
the baseline schema and fixtures. Confirm the role and phase acceptance checks,
function grants, row-level security, preserved existing records, migration
reapplication and any additional feature prerequisites found by the schema
comparison. The full `schema.sql` is for fresh disposable installations.
`demo_seed.sql` resets workflow data. It is not an upgrade procedure.

The invite-revocation migration repairs the runtime RPC contract on older
schemas. It requires the existing exploration, team and audit tables and the
existing team-authorization and exploration-JSON helpers. Review its explicit
preflight and dependency checks as part of the candidate containing that change.

Shared migration approval, the backup/restore checkpoint and an assigned
database operator belong in the release issue. Application readiness checks do
not establish that these migrations ran.

## Activate the chosen release

Use a maintenance window for changing the existing release. Before changing it,
record the resolved `current` target, service units/drop-ins, Nginx site, modes,
and private environment files in a root-only backup directory. Record whether
each service is enabled. Keep that backup outside the repository and build logs.

The deployer builds as an unprivileged account. The administrator validates and
freezes the final release with root ownership. Runtime users must have read and
execute access. Keep the frontend cache in a writable, service-owned directory.
The existing template requires `.next/cache` to be a symlink to that cache.
The backend account requires no writable source or frontend secret access.

1. Validate the new environment with `verify.py config`. Compare the build
   configuration with the chosen origin. Run `systemd-analyze verify` on the
   units and `nginx -t` on the final installed configuration before restarting.
2. Stop only the two WatMatch services for the maintenance window. Change
   `/srv/watmatch/current` to the prepared release using a temporary symlink and
   an atomic rename. Install only reviewed config changes. Run
   `systemctl daemon-reload` if units changed, then start the API and frontend.
   Reload Nginx only if its approved site changed.
3. Run the private HTTP check on the VM:

   ```sh
   python3 deploy/verify.py http --origin http://127.0.0.1:8080 --mode read-only
   ```

   While dependencies are pending, `--allow-unready` can check only private
   transport. It must report its limited scope and cannot be used in pilot mode.
   The check sends anonymous GET requests. It does not sign in, request account
   creation, send an email, read user records, or submit a workflow.
4. Once the agreed HTTPS site and approved write mode are active, run
   `verify.py http --origin https://APPROVED_HOST --mode pilot` from the intended
   student network. TLS verification remains enabled. Browser-check the overview,
   local assets, sign-in, role resolution, and intended course workflow using an
   authorized pilot account. Confirm direct API permission failures with test
   accounts and inspect the expected audit events. Check only sanitized logs.
5. Enable the intended services at boot only after acceptance. Record the exact
   release, configuration, test account scope and result in the release issue.
   Give students the HTTPS address after a tester opens it on their own device.

## Restore the previous release

If activation fails, stop only the two WatMatch services. Atomically restore the
recorded `current` target and the reviewed config backup. Validate the restored
Nginx and units, reload as needed, then start the former services. Restore their
previous enabled state and rerun the corresponding anonymous HTTP check.

Do not run the October 29 preview installer or its recovery rollback as a general
upgrade/rollback tool. Those scripts restore the earlier prepared host state.
An application rollback does not undo a database migration. Confirm old-code
compatibility during the rehearsal and retain additive schema objects. Any
database restore or destructive reverse migration needs its own explicit plan.

## Pilot completion evidence

Record the tester's network, selected release and task outcome without storing
credentials or personal records. Required evidence includes actual identity
verification, the expected role/course, project reads, the selected test write
and instructor review, refusal of another course/team's data, sign-out, visible
errors/retries, and expected audit events. Use approved test accounts and
disposable workflow data for writes. A successful `/api/readiness` response
covers configuration, clock and database transport only.

Before independent access is ready, a student can operate the real private VM
overview on the developer's laptop and describe where to start and who reviews
the proposal. Record this as a pre-sign-in usability task. The authenticated
pilot requires its own complete acceptance result.
