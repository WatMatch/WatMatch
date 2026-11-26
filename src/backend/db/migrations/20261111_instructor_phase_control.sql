-- Apply to the existing WatMatch schema in one transaction. Existing course records retain their values.
begin;
alter table public.courses add column if not exists instructor_phase_control boolean not null default false;
set local search_path = public;

create or replace function watmatch_admin_set_course_instructor_phase_control(
  p_course_id bigint,
  p_enabled boolean,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_course courses%rowtype;
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  select *
    into v_course
  from courses
  where course_id = p_course_id
  for update;

  if not found then
    raise exception 'Course not found.' using errcode = 'P0002';
  end if;

  if p_enabled is true
     and (v_course.routing_kind <> 'standard' or v_course.retired_for_routing
          or v_course.activation_mode = 'force_inactive'
          or watmatch_current_course_offering_json(p_course_id) ->> 'routing_kind_override' = 'interdisciplinary') then
    raise exception 'Instructor phase control is only available for active standalone (standard) courses.'
      using errcode = '23514';
  end if;

  update courses
  set instructor_phase_control = p_enabled is true
  where course_id = p_course_id
  returning * into v_course;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'course_instructor_phase_control_set',
    'course',
    v_course.course_id::text,
    jsonb_build_object('enabled', v_course.instructor_phase_control)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Instructor phase control updated.',
    'data', to_jsonb(v_course)
  );
end;
$$;

create or replace function watmatch_instructor_advance_course_phase(
  p_course_id bigint,
  p_actor_id bigint,
  p_expected_phase text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_course courses%rowtype;
  v_current text;
  v_next text;
  v_pending integer;
begin
  -- Serialize advances with a change of term before taking the course lock.
  perform 1 from marketplace_settings where setting_id = 1 for share;
  select *
    into v_actor
  from users
  where user_id = p_actor_id
    and active is true
    and lower(coalesce(role, '')) = 'instructor'
    and course_fk = p_course_id
  for share;

  if not found then
    raise exception 'Only the assigned course instructor can advance this course phase.'
      using errcode = '42501';
  end if;

  select *
    into v_course
  from courses
  where course_id = p_course_id
  for update;

  if not found
     or v_course.instructor_phase_control is not true
     or v_course.routing_kind <> 'standard'
     or v_course.retired_for_routing or v_course.active is not true
     or watmatch_current_course_offering_json(p_course_id) ->> 'routing_kind_override' = 'interdisciplinary' then
    raise exception 'Instructor phase control is not enabled for this course.'
      using errcode = '42501';
  end if;

  v_current := watmatch_effective_marketplace_phase_for_course(p_course_id);

  if v_current is distinct from lower(nullif(btrim(coalesce(p_expected_phase, '')), '')) then
    raise exception 'The course phase changed to % since this page loaded. Refresh and try again.', v_current
      using errcode = '23514';
  end if;

  v_next := case v_current
    when 'exploration' then 'commitment'
    when 'commitment' then 'finalization'
  end;

  if v_next is null then
    raise exception 'This course is already in finalization.' using errcode = '23514';
  end if;

  if v_next = 'finalization' then
    select count(*)::integer
      into v_pending
    from project_commitment_requests pcr
    where pcr.status = 'pending'
      and watmatch_target_course_fk(pcr.capstone_fk, pcr.team_fk) = p_course_id;

    if v_pending > 0 then
      raise exception 'Resolve % pending commitment request(s) before moving this course to finalization.', v_pending
        using errcode = '23514';
    end if;
  end if;

  update courses
  set marketplace_phase_override = v_next,
      marketplace_phase_override_reason = 'Advanced by course instructor.',
      marketplace_phase_override_updated_by_fk = v_actor.user_id,
      marketplace_phase_override_updated_at = now()
  where course_id = p_course_id;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'course_phase_advanced_by_instructor',
    'course',
    p_course_id::text,
    jsonb_build_object('from', v_current, 'to', v_next)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Course phase advanced to ' || v_next || '.',
    'data', watmatch_marketplace_phase_context_for_course(p_course_id)
  );
end;
$$;

create or replace function watmatch_clear_instructor_phase_overrides_on_term_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Advance and audit use the same transaction timestamp. An admin replacement
  -- changes the recorded actor/time. Unrelated course edits preserve both.
  update courses c
  set marketplace_phase_override = null,
      marketplace_phase_override_reason = null,
      marketplace_phase_override_updated_by_fk = null,
      marketplace_phase_override_updated_at = null
  where c.marketplace_phase_override is not null and exists (
    select 1 from audit_log a
    where a.action = 'course_phase_advanced_by_instructor'
      and a.entity_type = 'course' and a.entity_id = c.course_id::text
      and a.actor_fk is not distinct from c.marketplace_phase_override_updated_by_fk
      and a.created_at = c.marketplace_phase_override_updated_at
      and a.metadata ->> 'to' = c.marketplace_phase_override
  );

  return new;
end;
$$;

drop trigger if exists trg_marketplace_settings_clear_instructor_phase_overrides on marketplace_settings;
create trigger trg_marketplace_settings_clear_instructor_phase_overrides
after update of current_term on marketplace_settings
for each row
when (old.current_term is distinct from new.current_term)
execute function watmatch_clear_instructor_phase_overrides_on_term_change();

-- Use the existing upsert validation and audit trail under the same course lock.
-- Missing PATCH fields always use the locked row, even after an instructor advance.
create or replace function watmatch_admin_patch_course(
  p_course_id bigint, p_changes jsonb, p_actor_id bigint, p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c courses%rowtype;
  v_result jsonb;
  v_enable boolean;
begin
  perform watmatch_assert_admin_actor(p_actor_id);
  select * into c from courses where course_id = p_course_id for update;
  if not found then raise exception 'Course not found.' using errcode = 'P0002'; end if;
  if p_changes ->> 'activation_mode' = 'force_inactive' and c.activation_mode <> 'force_inactive'
     and nullif(btrim(p_reason), '') is null then
    raise exception 'Forcing a course inactive requires an audit reason.' using errcode = '23514';
  end if;
  if p_changes ? 'expected_phase_override_updated_at'
     and (p_changes ->> 'expected_phase_override_updated_at')::timestamptz
         is distinct from c.marketplace_phase_override_updated_at then
    raise exception 'The course phase changed. Reopen the course and review the current phase.'
      using errcode = '40001';
  end if;

  -- jsonb_populate_record keeps omitted fields and respects explicit SQL nulls.
  c := jsonb_populate_record(c, (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from jsonb_each(p_changes) where key in ('code','name','active_terms','activation_mode',
      'routing_kind','marketplace_phase_override','marketplace_phase_override_reason',
      'requires_project_support','instructor_phase_control')));
  if p_changes ? 'department_id' then c.department_fk := (p_changes ->> 'department_id')::bigint; end if;
  if p_changes ? 'ecosystem_id' then c.ecosystem_fk := (p_changes ->> 'ecosystem_id')::bigint; end if;
  v_result := watmatch_admin_upsert_course(c.course_id, c.code, c.name, c.active_terms,
    c.activation_mode, c.department_fk, c.ecosystem_fk, c.routing_kind,
    c.marketplace_phase_override, c.marketplace_phase_override_reason,
    c.requires_project_support, p_actor_id, coalesce(nullif(btrim(p_reason), ''), 'admin_course_management'));

  v_enable := case when p_changes ? 'instructor_phase_control' then c.instructor_phase_control
    when c.instructor_phase_control and (c.routing_kind <> 'standard' or c.activation_mode = 'force_inactive') then false
  end;
  if v_enable is not null then
    -- If approval fails, PostgreSQL rolls back the preceding course edit and audit.
    perform watmatch_admin_set_course_instructor_phase_control(c.course_id, v_enable, p_actor_id);
    select * into strict c from courses where course_id = p_course_id;
    v_result := jsonb_set(v_result, '{data}', to_jsonb(c));
  end if;
  return v_result;
end;
$$;

revoke all on function
  watmatch_admin_set_course_instructor_phase_control(bigint, boolean, bigint),
  watmatch_instructor_advance_course_phase(bigint, bigint, text),
  watmatch_clear_instructor_phase_overrides_on_term_change(),
  watmatch_admin_patch_course(bigint, jsonb, bigint, text)
from public, anon, authenticated;
grant execute on function
  watmatch_admin_set_course_instructor_phase_control(bigint, boolean, bigint),
  watmatch_instructor_advance_course_phase(bigint, bigint, text),
  watmatch_clear_instructor_phase_overrides_on_term_change(),
  watmatch_admin_patch_course(bigint, jsonb, bigint, text)
to service_role;
commit;
