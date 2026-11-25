#!/usr/bin/env bash
# Always create a disposable cluster. Never connect to an existing database.
set -euo pipefail
root=$(cd "$(dirname "$0")/../../../.." && pwd)
run=$(mktemp -d "${TMPDIR:-/tmp}/wminvite.XXXXXX")
trap 'pg_ctl -D "$run/db" -m immediate -w stop >/dev/null 2>&1 || :; rm -rf -- "$run"' EXIT
unset PGHOST PGHOSTADDR PGPORT PGDATABASE PGUSER PGPASSWORD PGPASSFILE PGOPTIONS PGSERVICE PGSERVICEFILE
initdb --no-locale --encoding=UTF8 --auth-local=peer --auth-host=scram-sha-256 -D "$run/db" >/dev/null
mkdir -m 700 "$run/socket"
pg_ctl -D "$run/db" -l "$run/postgres.log" -o "-h '' -k '$run/socket'" -w start >/dev/null
sql=(psql -X -At -v ON_ERROR_STOP=1 --host "$run/socket" --username "$(id -un)" --dbname postgres)
export PGOPTIONS='-c client_min_messages=warning'
"${sql[@]}" -q -c 'create role anon; create role authenticated; create role service_role bypassrls;'
"${sql[@]}" -q -f "$root/src/backend/db/schema.sql" > "$run/schema.out"
"${sql[@]}" -q -f "$root/src/backend/tests/invite_revoke/fixtures.sql"
migration="$root/src/backend/db/migrations/20261125_invite_revoke_reason.sql"
for pass in 1 2; do
  "${sql[@]}" -q -f "$migration"
  "${sql[@]}" -q -f "$root/src/backend/tests/invite_revoke/unchanged.sql"
done
"${sql[@]}" -q -f "$root/src/backend/tests/invite_revoke/acceptance.sql"

# A custom execute grant must fail closed and restore the previous definition.
"${sql[@]}" -q <<'SQL'
create role invite_test_extra;
create or replace function public.watmatch_revoke_invite(
  p_invite_id text, p_actor_id bigint,
  p_actor_role text default 'student', p_reason text default null
) returns jsonb language sql as 'select null::jsonb';
grant execute on function public.watmatch_revoke_invite(text,bigint,text,text)
  to invite_test_extra;
create table wm_invite_test.before_routine as
  select prosrc,proacl,prosecdef from pg_proc
  where oid='public.watmatch_revoke_invite(text,bigint,text,text)'::regprocedure;
SQL
if "${sql[@]}" -q -f "$migration" > "$run/acl.out" 2>&1; then
  printf '%s\n' 'FAIL: unexpected execute grant was accepted'
  exit 1
fi
"${sql[@]}" -q <<'SQL'
select wm_invite_test.check_true(
  exists(
    select 1 from pg_proc p cross join wm_invite_test.before_routine b
    where p.oid='public.watmatch_revoke_invite(text,bigint,text,text)'::regprocedure
      and p.prosrc=b.prosrc and p.proacl=b.proacl and p.prosecdef=b.prosecdef
  ),
  'failed migration rolls back definition and grants'
);
SQL

# A dependent legacy caller must cause an atomic failure, with no CASCADE.
"${sql[@]}" -q <<'SQL'
drop function public.watmatch_revoke_invite(text,bigint,text,text);
create function public.watmatch_revoke_invite(text,bigint,text)
  returns jsonb language sql as 'select null::jsonb';
create view wm_invite_test.legacy_dependency as
  select public.watmatch_revoke_invite('1'::text,1::bigint,'student'::text);
SQL
if "${sql[@]}" -q -f "$migration" > "$run/dependency.out" 2>&1; then
  printf '%s\n' 'FAIL: dependent legacy routine unexpectedly removed'
  exit 1
fi
"${sql[@]}" -q <<'SQL'
select wm_invite_test.check_true(
  to_regclass('wm_invite_test.legacy_dependency') is not null
    and to_regprocedure('public.watmatch_revoke_invite(text,bigint,text)') is not null,
  'dependent legacy routine and view preserved after failed migration'
);
SQL
printf '%s\n' 'PASS: invite RPC upgrade, reapplication, data preservation, authorization and dependency rollback'
