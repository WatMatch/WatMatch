-- Run only through run.sh in its disposable cluster. Fail on any unexpected outcome.
create function pg_temp.denied(stmt text, expected_state text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then return; else raise; end if;
  end;
  raise exception 'Expected rejection (%) for %', expected_state, stmt;
end $$;
do $$
declare
  c bigint := (select course_id from courses where code='WM-PHASE');
  other_course bigint := (select course_id from courses where code='WM-OTHER');
  admin_id bigint := (select user_id from users where email ilike 'admin-wm-phase@uwaterloo.ca');
  instructor bigint := (select user_id from users where email ilike 'instructor-wm-phase@uwaterloo.ca');
  student bigint := (select user_id from users where email ilike 'student-wm-phase@uwaterloo.ca');
  other_instructor bigint := (select user_id from users where email ilike 'instructor-wm-other@uwaterloo.ca');
  cap bigint;
  team bigint;
  actor bigint;
  req bigint;
  fn regprocedure;
begin
  assert c is not null and instructor is not null and student is not null;
  assert not (select instructor_phase_control from courses where course_id = c);
  foreach fn in array array[
    'watmatch_admin_set_course_instructor_phase_control(bigint,boolean,bigint)'::regprocedure,
    'watmatch_instructor_advance_course_phase(bigint,bigint,text)'::regprocedure,
    'watmatch_admin_patch_course(bigint,jsonb,bigint,text)'::regprocedure
  ] loop
    assert not has_function_privilege('anon',fn,'execute');
    assert not has_function_privilege('authenticated',fn,'execute');
    assert has_function_privilege('service_role',fn,'execute');
  end loop;
  assert (select relrowsecurity from pg_class where oid='public.courses'::regclass);
  perform pg_temp.denied(format('select watmatch_instructor_advance_course_phase(%s,%s,''exploration'')',c,instructor),'42501');
  perform pg_temp.denied(format('select watmatch_admin_set_course_instructor_phase_control(%s,true,%s)',c,student),'42501');
  perform watmatch_admin_patch_course(c,'{"instructor_phase_control":true}',admin_id);
  assert (select instructor_phase_control from courses where course_id=c);
  update marketplace_settings set phase='exploration', exploration_starts_at=null, commitment_starts_at=null, finalization_starts_at=null where setting_id=1;
  for actor in select user_id from users where email ilike '%wm-phase@uwaterloo.ca' and role in ('student','mentor','admin')
    or email in ('inactive@uwaterloo.ca','instructor-WM-OTHER@uwaterloo.ca') loop
    perform pg_temp.denied(format('select watmatch_instructor_advance_course_phase(%s,%s,''exploration'')',c,actor),'42501');
  end loop;
  perform watmatch_instructor_advance_course_phase(c,instructor,'exploration');
  assert watmatch_effective_marketplace_phase_for_course(c) = 'commitment';
  perform pg_temp.denied(format('select watmatch_instructor_advance_course_phase(%s,%s,''exploration'')',c,instructor),'23514');
  perform watmatch_admin_patch_course(c,'{"name":"Renamed after advance"}',admin_id);
  assert (select marketplace_phase_override_updated_by_fk = instructor from courses where course_id=c);
  perform pg_temp.denied(format('select watmatch_admin_patch_course(%s,%L,%s)',
    c,'{"marketplace_phase_override":"exploration","expected_phase_override_updated_at":null}',admin_id),'40001');
  insert into capstones(title,course_fk,user_fk) values ('Fixture project',c,student) returning capstone_id into cap;
  insert into teams(course_fk,capstone_fk) values(c,cap) returning team_id into team;
  insert into project_commitment_requests(capstone_fk,team_fk,student_fk) values(cap,team,student) returning commitment_request_id into req;
  perform pg_temp.denied(format('select watmatch_instructor_advance_course_phase(%s,%s,''commitment'')',c,instructor),'23514');
  update project_commitment_requests set status='cancelled' where commitment_request_id=req;
  perform watmatch_instructor_advance_course_phase(c,instructor,'commitment');
  assert watmatch_effective_marketplace_phase_for_capstone(cap)='finalization';
  perform pg_temp.denied(format('select watmatch_instructor_advance_course_phase(%s,%s,''finalization'')',c,instructor),'23514');
  assert (select count(*)=2 from audit_log where action='course_phase_advanced_by_instructor' and entity_id=c::text and actor_fk=instructor);
  perform watmatch_admin_set_course_instructor_phase_control(c,false,admin_id);
  assert (select count(*)=2 from audit_log where action='course_instructor_phase_control_set' and entity_id=c::text and actor_fk=admin_id);
  perform pg_temp.denied(format('select watmatch_instructor_advance_course_phase(%s,%s,''finalization'')',c,instructor),'42501');

  -- Transfer ownership by a real admin edit, keeping approval on the other course.
  perform watmatch_admin_set_course_instructor_phase_control(other_course,true,admin_id);
  perform watmatch_instructor_advance_course_phase(other_course,other_instructor,'exploration');
  perform watmatch_admin_patch_course(other_course,'{"marketplace_phase_override":"finalization","marketplace_phase_override_reason":"Academic exception"}',admin_id);
  update marketplace_settings set current_term = case when current_term='Winter 2030' then 'Spring 2030' else 'Winter 2030' end where setting_id=1;
  assert (select marketplace_phase_override is null and not instructor_phase_control from courses where course_id=c);
  assert (select marketplace_phase_override='finalization' and instructor_phase_control from courses where course_id=other_course);

  -- The permission update fails after the catalog RPC. The whole save rolls back.
  perform pg_temp.denied(format('select watmatch_admin_patch_course(%s,%L,%s,%L)',
    c,'{"name":"Must roll back","activation_mode":"force_inactive","instructor_phase_control":true}',admin_id,'Fixture change'),'23514');
  assert (select name='Renamed after advance' and activation_mode='force_active' from courses where course_id=c);
end $$;
-- Give SQL table privileges as in a hosted project. RLS must still deny raw reads/updates.
grant select,update on courses to anon, authenticated;
set role anon;
do $$ begin assert not exists (select 1 from courses); end $$;
reset role;
set role authenticated;
do $$ declare changed integer; begin
  update courses set instructor_phase_control=true;
  get diagnostics changed = row_count;
  assert changed=0;
end $$;
reset role;
select 'Phase-control acceptance passed: migration, grants, RLS, actors, sequencing, audit, atomic edits, rollover.' as result;
