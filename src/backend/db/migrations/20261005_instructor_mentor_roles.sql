-- Instructor / University Mentor memberships. Apply in one transaction.
-- users.role remains the default role for legacy course workflows. For the only
-- supported pair it is always instructor; selecting a workspace NEVER updates it.
begin;
create table if not exists user_roles (
  user_fk bigint not null references users(user_id) on delete cascade,
  role text not null check (role in ('student','instructor','mentor','admin','academic_advisor','enrollment_operator','external_partner')),
  granted_at timestamptz not null default now(),
  granted_by_fk bigint references users(user_id) on delete set null,
  primary key (user_fk, role)
);
alter table user_roles enable row level security;
revoke all on user_roles from public, anon, authenticated;
grant all on user_roles to service_role;
insert into user_roles(user_fk, role) select user_id, role from users on conflict do nothing;

create or replace function watmatch_user_has_role(p_user_id bigint, p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from user_roles where user_fk = p_user_id and role = p_role);
$$;

-- Keep existing single-role provisioning/imports compatible. Dual-role changes
-- must go through the audited membership operation, never through legacy edits.
create or replace function watmatch_sync_user_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    if (select count(*) from user_roles where user_fk = new.user_id) > 1 then
      raise exception 'Use Manage roles to change a multi-role account.' using errcode = '23514';
    end if;
    delete from user_roles where user_fk = new.user_id;
  end if;
  insert into user_roles(user_fk, role) values(new.user_id, new.role) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists trg_users_sync_roles on users;
create trigger trg_users_sync_roles after insert or update of role on users
for each row execute function watmatch_sync_user_roles();

create or replace function watmatch_validate_role_memberships()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_default text;
  v_roles text[];
begin
  if tg_table_name = 'users' then v_id := new.user_id;
  elsif tg_op = 'DELETE' then v_id := old.user_fk;
  else v_id := new.user_fk;
  end if;
  select role into v_default from users where user_id = v_id for update;
  if not found then return null; end if;
  select array_agg(role order by role) into v_roles from user_roles where user_fk = v_id;
  if v_roles is null or not (v_default = any(v_roles))
     or (cardinality(v_roles) > 1 and (v_roles <> array['instructor','mentor']::text[] or v_default <> 'instructor')) then
    raise exception 'Only Instructor and University Mentor can share an account; students have only Student.' using errcode = '23514';
  end if;
  return null;
end;
$$;
drop trigger if exists trg_role_memberships_valid on user_roles;
create constraint trigger trg_role_memberships_valid after insert or update or delete on user_roles
 deferrable initially deferred for each row execute function watmatch_validate_role_memberships();
drop trigger if exists trg_user_memberships_valid on users;
create constraint trigger trg_user_memberships_valid after insert or update on users
 deferrable initially deferred for each row execute function watmatch_validate_role_memberships();

create or replace function watmatch_admin_set_user_roles(
  p_user_id bigint, p_roles text[], p_actor_id bigint, p_reason text,
  p_course_id bigint default null, p_home_department_id bigint default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor users%rowtype;
  v_user users%rowtype;
  v_roles text[];
  v_old_roles text[];
  v_default text;
  v_course bigint;
  v_department bigint;
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);
  if v_actor.active is not true then raise exception 'Admin access required.' using errcode = '42501'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'An audit reason is required.' using errcode = '22023'; end if;
  select * into v_user from users where user_id = p_user_id for update;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  if v_user.role not in ('instructor','mentor') then
    raise exception 'Only existing Instructor or University Mentor accounts can manage these roles.' using errcode = '23514';
  end if;
  select array_agg(distinct role order by role) into v_roles from unnest(p_roles) role;
  if v_roles is null or array_position(v_roles, null) is not null
    or not (v_roles <@ array['instructor','mentor']::text[]) then
    raise exception 'Choose Instructor, University Mentor, or both.' using errcode = '22023';
  end if;
  select array_agg(role order by role) into v_old_roles from user_roles where user_fk = p_user_id;
  v_default := case when 'instructor' = any(v_roles) then 'instructor' else 'mentor' end;
  -- Preserve an existing instructor assignment. Granting Instructor to a mentor
  -- requires an explicit home department and optionally a course.
  if v_default = 'instructor' then
    v_course := case when v_user.role = 'instructor' then v_user.course_fk else p_course_id end;
    v_department := case when v_user.role = 'instructor' then coalesce(v_user.home_department_fk, p_home_department_id) else p_home_department_id end;
    perform watmatch_validate_admin_managed_user(v_user.email, 'instructor', v_course, v_department);
  end if;
  if 'mentor' = any(v_old_roles) and not ('mentor' = any(v_roles)) and exists (
    select 1 from mentor_requests mr join capstones c on c.capstone_id = mr.capstone_fk
    where mr.mentor_fk = p_user_id and mr.status in ('pending','accepted') and c.archived is false
  ) then
    raise exception 'Cannot remove University Mentor while there are pending requests or active mentoring commitments.' using errcode = '23514';
  end if;
  -- Existing instructor safeguards still protect the last instructor in a course.
  perform watmatch_assert_instructor_can_leave_course(p_user_id, v_course, v_default, v_user.active);
  delete from user_roles where user_fk = p_user_id and not (role = any(v_roles));
  -- When the default changes, the compatibility trigger rebuilds its membership.
  update users set role = v_default, course_fk = v_course, home_department_fk = v_department
    where user_id = p_user_id returning * into v_user;
  insert into user_roles(user_fk, role, granted_by_fk)
    select p_user_id, role, p_actor_id from unnest(v_roles) role on conflict do nothing;
  insert into audit_log(actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values(p_actor_id, 'admin', 'user_roles_updated', 'user', p_user_id::text, btrim(p_reason),
      jsonb_build_object('old_roles', v_old_roles, 'roles', v_roles, 'course_fk', v_course, 'home_department_fk', v_department));
  return jsonb_build_object('success', true, 'data',
    (to_jsonb(v_user) - 'refresh_token') || jsonb_build_object('assigned_roles', v_roles));
end;
$$;

create or replace function watmatch_record_role_switch(p_user_id bigint, p_from_role text, p_to_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform 1 from users where user_id = p_user_id and active is true for update;
  if not found or p_to_role is null or p_from_role is null or p_to_role not in ('instructor','mentor') or p_from_role not in ('instructor','mentor')
     or not watmatch_user_has_role(p_user_id, p_from_role) or not watmatch_user_has_role(p_user_id, p_to_role) then
    raise exception 'This role is not assigned to your account.' using errcode = '42501';
  end if;
  insert into audit_log(actor_fk, actor_role, action, entity_type, entity_id, metadata)
    values(p_user_id, p_to_role, 'role_switched', 'user', p_user_id::text,
      jsonb_build_object('from_role',p_from_role,'to_role',p_to_role));
  return jsonb_build_object('success', true);
end;
$$;

create or replace function watmatch_assert_active_mentor_user(p_mentor_id bigint)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mentor users%rowtype;
begin
  if p_mentor_id is null then
    raise exception 'Mentor is required.' using errcode = '22023';
  end if;

  select *
    into v_mentor
  from users
  where user_id = p_mentor_id
    and active is true
    and watmatch_user_has_role(user_id, 'mentor');

  if not found then
    raise exception 'Active mentor not found.' using errcode = 'P0002';
  end if;

  return v_mentor;
end;
$$;

create or replace function watmatch_active_mentor_users(
  p_actor_id bigint,
  p_actor_role text,
  p_search text default null,
  p_department_id bigint default null,
  p_availability_term text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_availability_term text := nullif(btrim(coalesce(p_availability_term, '')), '');
  v_pattern text;
  v_data jsonb := '[]'::jsonb;
begin
  if v_role not in ('student', 'instructor', 'admin') then
    raise exception 'Student, instructor, or admin access required.' using errcode = '42501';
  end if;

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_') || '%';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', u.user_id,
        'email', u.email,
        'active', u.active,
        'profile', watmatch_mentor_profile_json(u.user_id)
      )
      order by coalesce(mp.display_name, u.email), u.email
    ),
    '[]'::jsonb
  )
  into v_data
  from users u
  left join mentor_profiles mp on mp.mentor_fk = u.user_id
  where u.active is true
    and watmatch_user_has_role(u.user_id, 'mentor')
    and (
      v_search is null
      or u.email ilike v_pattern escape '!'
      or mp.display_name ilike v_pattern escape '!'
      or mp.affiliation ilike v_pattern escape '!'
      or exists (
        select 1
        from unnest(coalesce(mp.expertise_tags, '{}'::text[])) tag
        where tag ilike v_pattern escape '!'
      )
    )
    and (
      p_department_id is null
      or mp.primary_department_fk = p_department_id
      or exists (
        select 1
        from mentor_profile_departments mpd
        where mpd.mentor_fk = u.user_id
          and mpd.department_fk = p_department_id
      )
    )
    and (
      v_availability_term is null
      or coalesce(mp.availability_terms, '{}'::text[]) @> array[v_availability_term]::text[]
    );

  return jsonb_build_object('success', true, 'data', v_data);
end;
$$;

create or replace function watmatch_admin_set_user_active(
  p_user_id bigint,
  p_active boolean,
  p_actor_id bigint,
  p_force boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_user users%rowtype;
  v_role text;
  v_active boolean := coalesce(p_active, true);
  v_active_admin_count integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_archived_partner_opportunity_ids bigint[] := '{}'::bigint[];
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Admin user active-status changes require an audit reason.' using errcode = '23514';
  end if;

  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;

  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if v_user.user_id = v_actor.user_id and v_active is false then
    raise exception 'Admins cannot deactivate their own account.' using errcode = '23514';
  end if;

  v_role := lower(coalesce(v_user.role, ''));
  if v_role = 'admin' and v_active is false then
    select count(*)
      into v_active_admin_count
    from users
    where lower(coalesce(role, '')) = 'admin'
      and active is true
      and user_id <> p_user_id;

    if v_active_admin_count = 0 then
      raise exception 'Cannot deactivate the last active admin.' using errcode = '23514';
    end if;
  end if;

  if v_role = 'student'
     and v_active is false
     and exists (select 1 from team_memberships tm where tm.user_fk = p_user_id) then
    raise exception 'Cannot deactivate a student while they are in an active team.'
      using errcode = '23514';
  end if;

  if v_role = 'external_partner' and v_active is false then
    select coalesce(array_agg(partner_opportunity_id order by partner_opportunity_id), '{}'::bigint[])
      into v_archived_partner_opportunity_ids
    from partner_opportunities
    where partner_user_fk = p_user_id
      and status <> 'archived';

    update partner_opportunities
    set status = 'archived',
        archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where partner_user_fk = p_user_id
      and status <> 'archived';
  end if;

  if watmatch_user_has_role(p_user_id, 'mentor') and v_active is false then
    update mentor_requests
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    where mentor_fk = p_user_id
      and status = 'pending';

    update mentor_requests mr
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    from capstones c
    left join teams t on t.team_id = c.team_fk
    where mr.mentor_fk = p_user_id
      and mr.capstone_fk = c.capstone_id
      and mr.status = 'accepted'
      and coalesce(t.status, '') <> 'finalized';
  end if;

  perform watmatch_assert_instructor_can_leave_course(
    p_user_id,
    v_user.course_fk,
    v_role,
    v_active
  );

  if v_user.active is not distinct from v_active then
    if v_role = 'student' and v_active is false then
      perform watmatch_cancel_pending_submission_enrollment_requests(
        p_user_id,
        v_actor.user_id,
        v_actor.role,
        'Student account is inactive.'
      );

      perform watmatch_cleanup_marketplace_for_unavailable_student(
        p_user_id,
        v_actor.user_id,
        v_actor.role,
        'Student account is inactive.'
      );
    end if;

    if coalesce(array_length(v_archived_partner_opportunity_ids, 1), 0) > 0 then
      insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
      values (
        v_actor.user_id,
        v_actor.role,
        'external_partner_opportunities_archived',
        'user',
        p_user_id::text,
        v_reason,
        jsonb_build_object('archived_partner_opportunity_ids', v_archived_partner_opportunity_ids)
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'message', 'User active status is already up to date.',
      'data', to_jsonb(v_user),
      'archived_partner_opportunity_ids', v_archived_partner_opportunity_ids
    );
  end if;

  update users
  set active = v_active,
      refresh_token = case when v_active is false then null else refresh_token end
  where user_id = p_user_id
  returning * into v_user;

  if v_role = 'student' and v_active is false then
    perform watmatch_cancel_pending_submission_enrollment_requests(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student account was deactivated.'
    );

    perform watmatch_cleanup_marketplace_for_unavailable_student(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student account was deactivated.'
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    case when v_active is true then 'user_activated' else 'user_deactivated' end,
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'role', v_role,
      'forced', coalesce(p_force, false),
      'archived_partner_opportunity_ids', v_archived_partner_opportunity_ids
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', case when v_active is true then 'User activated.' else 'User deactivated.' end,
    'data', to_jsonb(v_user)
  );
end;
$$;

create or replace function watmatch_admin_update_user(
  p_user_id bigint,
  p_email text,
  p_role text,
  p_course_id bigint,
  p_home_department_id bigint,
  p_active boolean,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_user users%rowtype;
  v_old_user users%rowtype;
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
  v_active boolean := coalesce(p_active, true);
  v_active_admin_count integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old_role text;
  v_archived_partner_opportunity_ids bigint[] := '{}'::bigint[];
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Admin user updates require an audit reason.' using errcode = '23514';
  end if;

  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;
  if v_email is null then
    raise exception 'User email is required.' using errcode = '22023';
  end if;
  if v_role not in ('student', 'instructor', 'admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then
    raise exception 'Role must be student, instructor, admin, academic_advisor, enrollment_operator, external_partner, or mentor.' using errcode = '23514';
  end if;
  if v_role <> 'external_partner' and v_email !~ '^[^@[:space:]]+@uwaterloo[.]ca$' then
    raise exception 'Email must be a uwaterloo.ca address.' using errcode = '23514';
  end if;
  if v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') and p_course_id is not null then
    raise exception 'Admin, academic advisor, enrollment operator, external partner, and mentor users cannot be enrolled in a course.' using errcode = '23514';
  end if;
  if v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') and p_home_department_id is not null then
    raise exception 'Admin, academic advisor, enrollment operator, external partner, and mentor users cannot be assigned a home department.' using errcode = '23514';
  end if;
  if v_role in ('student', 'instructor') and p_home_department_id is null then
    raise exception 'Home department is required for students and instructors.' using errcode = '23514';
  end if;
  if v_role in ('student', 'instructor')
     and p_course_id is not null
     and not exists (select 1 from courses where course_id = p_course_id) then
    raise exception 'Cannot assign a missing course.' using errcode = '23514';
  end if;
  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  v_old_user := v_user;
  v_old_role := lower(coalesce(v_user.role, ''));

  if v_role in ('student', 'instructor') then
    if not exists (
      select 1
      from departments
      where department_id = p_home_department_id
    ) then
      raise exception 'Cannot assign a missing home department.' using errcode = '23514';
    end if;

    if exists (
      select 1
      from departments
      where department_id = p_home_department_id
        and active is not true
    )
       and not (
         v_old_role in ('student', 'instructor')
         and v_user.home_department_fk is not distinct from p_home_department_id
       ) then
      raise exception 'Cannot assign an inactive home department.' using errcode = '23514';
    end if;
  end if;

  if v_user.user_id = v_actor.user_id and v_active is false then
    raise exception 'Admins cannot deactivate their own account.' using errcode = '23514';
  end if;

  if v_role <> v_old_role
     and exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'Cannot change role while the user is in an active team.' using errcode = '23514';
  end if;

  if v_role <> v_old_role
     and (v_role = 'external_partner' or v_old_role = 'external_partner')
     and (
       exists (select 1 from partner_profiles where partner_user_fk = p_user_id)
       or exists (select 1 from partner_opportunities where partner_user_fk = p_user_id)
     ) then
    raise exception 'Cannot change role for a user with external partner history. Deactivate the account instead.'
      using errcode = '23514';
  end if;

  if v_role <> v_old_role
     and (v_role = 'mentor' or v_old_role = 'mentor')
     and exists (
       select 1
       from mentor_requests
       where mentor_fk = p_user_id
          or requested_by_fk = p_user_id
          or decided_by_fk = p_user_id
     ) then
    raise exception 'Cannot change role for a user with mentor request history. Deactivate the account instead.'
      using errcode = '23514';
  end if;

  if lower(coalesce(v_user.role, '')) = 'student'
     and v_user.course_fk is distinct from p_course_id
     and exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'Cannot change course assignment while the student is in an active team.'
      using errcode = '23514';
  end if;

  if lower(coalesce(v_user.role, '')) = 'admin'
     and v_role <> 'admin'
     and v_user.active is true then
    select count(*)
      into v_active_admin_count
    from users
    where lower(coalesce(role, '')) = 'admin'
      and active is true
      and user_id <> p_user_id;

    if v_active_admin_count = 0 then
      raise exception 'Cannot remove the last active admin.' using errcode = '23514';
    end if;
  end if;

  if v_role = 'admin' and v_active is false then
    select count(*)
      into v_active_admin_count
    from users
    where lower(coalesce(role, '')) = 'admin'
      and active is true
      and user_id <> p_user_id;

    if v_active_admin_count = 0 then
      raise exception 'Cannot deactivate the last active admin.' using errcode = '23514';
    end if;
  end if;

  if lower(coalesce(v_user.role, '')) = 'student'
     and v_active is false
     and exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'Cannot deactivate a student while they are in an active team.'
      using errcode = '23514';
  end if;

  if v_old_role = 'external_partner' and v_active is false then
    select coalesce(array_agg(partner_opportunity_id order by partner_opportunity_id), '{}'::bigint[])
      into v_archived_partner_opportunity_ids
    from partner_opportunities
    where partner_user_fk = p_user_id
      and status <> 'archived';

    update partner_opportunities
    set status = 'archived',
        archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where partner_user_fk = p_user_id
      and status <> 'archived';
  end if;

  if watmatch_user_has_role(p_user_id, 'mentor') and v_active is false then
    update mentor_requests
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    where mentor_fk = p_user_id
      and status = 'pending';

    update mentor_requests mr
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    from capstones c
    left join teams t on t.team_id = c.team_fk
    where mr.mentor_fk = p_user_id
      and mr.capstone_fk = c.capstone_id
      and mr.status = 'accepted'
      and coalesce(t.status, '') <> 'finalized';
  end if;

  perform watmatch_assert_instructor_can_leave_course(
    p_user_id,
    case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_course_id end,
    v_role,
    v_active
  );

  update users
  set email = v_email,
      role = v_role,
      course_fk = case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_course_id end,
      home_department_fk = case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_home_department_id end,
      active = v_active,
      active_team_fk = case when v_role = 'student' then active_team_fk else null end,
      refresh_token = case when v_active is false then null else refresh_token end
  where user_id = p_user_id
  returning * into v_user;

  if v_old_role = 'student' and (v_role <> 'student' or v_active is false) then
    perform watmatch_cancel_pending_submission_enrollment_requests(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      case
        when v_role <> 'student' then 'User is no longer a student.'
        else 'Student account was deactivated.'
      end
    );

    perform watmatch_cleanup_marketplace_for_unavailable_student(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      case
        when v_role <> 'student' then 'User is no longer a student.'
        else 'Student account was deactivated.'
      end
    );
  elsif v_role = 'student' and v_user.course_fk is not null then
    perform watmatch_cancel_pending_submission_enrollment_requests(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student was manually assigned to a course.'
    );

    perform watmatch_reconcile_marketplace_commitments_after_course_assignment(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student was manually assigned to a course.'
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'user_updated',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'old', jsonb_build_object(
        'email', v_old_user.email,
        'role', v_old_user.role,
        'course_fk', v_old_user.course_fk,
        'home_department_fk', v_old_user.home_department_fk,
        'active', v_old_user.active
      ),
      'new', jsonb_build_object(
        'email', v_user.email,
        'role', v_user.role,
        'course_fk', v_user.course_fk,
        'home_department_fk', v_user.home_department_fk,
        'active', v_user.active
      ),
      'archived_partner_opportunity_ids', v_archived_partner_opportunity_ids
    )
  );

  return jsonb_build_object('success', true, 'message', 'User updated.', 'data', to_jsonb(v_user));
end;
$$;

revoke execute on function watmatch_user_has_role(bigint,text), watmatch_sync_user_roles(), watmatch_validate_role_memberships(),
 watmatch_admin_set_user_roles(bigint,text[],bigint,text,bigint,bigint), watmatch_record_role_switch(bigint,text,text)
 from public, anon, authenticated;
grant execute on function watmatch_user_has_role(bigint,text), watmatch_sync_user_roles(), watmatch_validate_role_memberships(),
 watmatch_admin_set_user_roles(bigint,text[],bigint,text,bigint,bigint), watmatch_record_role_switch(bigint,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
