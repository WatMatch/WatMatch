#!/usr/bin/env bash
# Start a private PostgreSQL cluster; never use an existing database.
set -euo pipefail
root=$(cd "$(dirname "$0")/../../../.." && pwd)
run=$(mktemp -d "${TMPDIR:-/tmp}/wmphase.XXXXXX")
trap 'pg_ctl -D "$run/db" -m immediate -w stop >/dev/null 2>&1 || :; rm -rf -- "$run"' EXIT
initdb --no-locale --encoding=UTF8 --auth-local=peer --auth-host=scram-sha-256 -D "$run/db" >/dev/null
mkdir -m 700 "$run/socket"
pg_ctl -D "$run/db" -l "$run/postgres.log" -o "-h '' -k '$run/socket'" -w start >/dev/null
sql=(psql -X -v ON_ERROR_STOP=1 --host "$run/socket" --username "$(id -un)" --dbname postgres)
unset PGOPTIONS PGSERVICE PGSERVICEFILE
export PGOPTIONS='-c client_min_messages=warning'
"${sql[@]}" -q -c 'create role anon; create role authenticated; create role service_role bypassrls;'
# Set PHASE_BASE_SCHEMA to an exported pre-feature WatMatch schema to verify the
# upgrade from main. With no override the same checks run against a fresh schema.
"${sql[@]}" -q -f "${PHASE_BASE_SCHEMA:-$root/src/backend/db/schema.sql}" > "$run/schema.out"
"${sql[@]}" -q -f "$root/src/backend/tests/course_phase/fixtures.sql"
for pass in 1 2; do
  "${sql[@]}" -q -f "$root/src/backend/db/migrations/20261111_instructor_phase_control.sql"
done
"${sql[@]}" -q -f "$root/src/backend/tests/course_phase/acceptance.sql"
