-- Upgrade existing databases to the invite RPC signature used by the API.
-- Rehearse on a disposable database and use the deployment migration process.
-- This transaction replaces the routine and grants without changing stored rows.
-- Existing three-argument callers retain the defaulted p_reason argument.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Read-only catalog preflight. Fail before replacing a routine if a required
-- helper signature, return type, table, or directly used column is absent.
do $watmatch_revoke_preflight$
declare
  v_required record;
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc
    where oid = to_regprocedure('public.watmatch_actor_can_manage_team(bigint,bigint,text)')
      and prorettype = 'boolean'::regtype
  ) then
    raise exception 'Required helper watmatch_actor_can_manage_team is absent or incompatible.';
  end if;

  if to_regclass('public.project_explorations') is null then
    raise exception 'Required table project_explorations is absent.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc
    where oid = to_regprocedure('public.watmatch_project_exploration_json(public.project_explorations)')
      and prorettype = 'jsonb'::regtype
  ) then
    raise exception 'Required helper watmatch_project_exploration_json is absent or incompatible.';
  end if;

  for v_required in
    select table_name, column_name
    from (values
      ('project_explorations', 'exploration_id'),
      ('project_explorations', 'status'),
      ('project_explorations', 'team_fk'),
      ('project_explorations', 'student_fk'),
      ('project_explorations', 'decided_by_fk'),
      ('project_explorations', 'decided_at'),
      ('project_explorations', 'updated_at'),
      ('teams', 'team_id'),
      ('teams', 'leader_fk'),
      ('audit_log', 'actor_fk'),
      ('audit_log', 'actor_role'),
      ('audit_log', 'action'),
      ('audit_log', 'entity_type'),
      ('audit_log', 'entity_id'),
      ('audit_log', 'reason'),
      ('audit_log', 'metadata')
    ) as required(table_name, column_name)
  loop
    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = v_required.table_name
        and c.column_name = v_required.column_name
    ) then
      raise exception 'Required column %.% is absent.', v_required.table_name, v_required.column_name;
    end if;
  end loop;
end;
$watmatch_revoke_preflight$;

-- RESTRICT prevents deletion of dependent objects. A dependency failure rolls
-- back this transaction. Do not change this to CASCADE to force it through.
drop function if exists public.watmatch_revoke_invite(text, bigint, text) restrict;

-- Current repository function, with only an explicit public schema qualifier.
create or replace function public.watmatch_revoke_invite(
  p_invite_id text,
  p_actor_id bigint,
  p_actor_role text default 'student',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id text := nullif(btrim(coalesce(p_invite_id, '')), '');
  v_role text := lower(coalesce(p_actor_role, 'student'));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_exploration project_explorations%rowtype;
  v_team teams%rowtype;
begin
  if v_invite_id is null or p_actor_id is null or v_invite_id !~ '^[0-9]+$' then
    raise exception 'Invalid invite revoke request.' using errcode = '22023';
  end if;

  if v_reason is not null and char_length(v_reason) > 2000 then
    raise exception 'Invite revocation reason must be 2000 characters or fewer.' using errcode = '22023';
  end if;

  if v_role in ('admin', 'instructor') and v_reason is null then
    raise exception 'Staff invite revocation requires an audit reason.' using errcode = '23514';
  end if;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = v_invite_id::bigint
  for update;

  if not found or v_exploration.status <> 'invited' then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already revoked or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  select *
    into v_team
  from teams
  where team_id = v_exploration.team_fk
  for update;

  if not found then
    update project_explorations
    set status = 'expired',
        decided_at = coalesce(decided_at, now()),
        updated_at = now()
    where exploration_id = v_exploration.exploration_id;
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer actionable and has been expired.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'expired', true)
    );
  end if;

  if v_team.leader_fk is distinct from p_actor_id
     and watmatch_actor_can_manage_team(v_team.team_id, p_actor_id, v_role) is not true then
    raise exception 'Only the team leader or scoped instructors/admins can revoke invites.' using errcode = '42501';
  end if;

  update project_explorations
  set status = 'declined',
      decided_by_fk = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where exploration_id = v_exploration.exploration_id
  returning * into v_exploration;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'project_invite_revoked',
    'project_exploration',
    v_exploration.exploration_id::text,
    coalesce(v_reason, 'Team leader revoked pending invitation.'),
    watmatch_project_exploration_json(v_exploration) || jsonb_build_object(
      'previous_status', 'invited',
      'new_status', 'declined',
      'team_fk', v_team.team_id,
      'student_fk', v_exploration.student_fk,
      'student_id', v_exploration.student_fk,
      'staff_initiated', v_role in ('admin', 'instructor')
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Invite revoked successfully.',
    'data', watmatch_project_exploration_json(v_exploration)
  );
end;
$$;

-- Restrict ordinary application execution to the backend service role.
revoke all privileges on function public.watmatch_revoke_invite(text, bigint, text, text) from public;
revoke all privileges on function public.watmatch_revoke_invite(text, bigint, text, text) from anon;
revoke all privileges on function public.watmatch_revoke_invite(text, bigint, text, text) from authenticated;
grant execute on function public.watmatch_revoke_invite(text, bigint, text, text) to service_role;

-- Reject an unexpected explicit EXECUTE grant rather than retaining access
-- from a nonstandard existing ACL or default privilege configuration.
do $watmatch_revoke_acl_check$
begin
  if exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = 'public.watmatch_revoke_invite(text,bigint,text,text)'::regprocedure
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee <> p.proowner
      and acl.grantee <> (select oid from pg_catalog.pg_roles where rolname = 'service_role')
  ) then
    raise exception 'Unexpected invite-revocation EXECUTE grant. Review the routine ACL before applying this change.';
  end if;
end;
$watmatch_revoke_acl_check$;

-- Internal PostgREST schema-cache refresh; delivered only if COMMIT succeeds.
notify pgrst, 'reload schema';
commit;
