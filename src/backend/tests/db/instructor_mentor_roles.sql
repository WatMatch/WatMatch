-- Isolated PostgreSQL acceptance tests. All fixtures are rolled back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin
 if ok is not true then raise exception 'FAIL: %', label; end if;
 raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_error(statement text, expected_state text, label text) returns void language plpgsql as $$
declare actual_state text;
begin
 begin
  execute statement;
  set constraints all immediate;
 exception when others then
  get stacked diagnostics actual_state = returned_sqlstate;
 end;
 set constraints all deferred;
 if actual_state is distinct from expected_state then
  raise exception 'FAIL: % (expected %, got %)', label, expected_state, actual_state;
 end if;
 raise notice 'PASS: %', label;
end $$;

do $$
declare
 a bigint; i bigint; m bigint; s bigint; d bigint; c bigint; cap bigint; team bigint; result jsonb; before_course bigint;
begin
 insert into departments(name) values('Role test department') returning department_id into d;
 insert into courses(code,name,department_fk,activation_mode,active_terms) values('ROLE 491','Role test course',d,'force_inactive',array['Fall']) returning course_id into c;
 insert into users(email,role) values('roles.admin@uwaterloo.ca','admin') returning user_id into a;
 insert into users(email,role,course_fk,home_department_fk) values('roles.instructor@uwaterloo.ca','instructor',c,d) returning user_id into i;
 insert into users(email,role) values('roles.mentor@uwaterloo.ca','mentor') returning user_id into m;
 insert into users(email,role,home_department_fk) values('roles.student@uwaterloo.ca','student',d) returning user_id into s;
 perform pg_temp.check_true((select count(*) = 4 from user_roles where user_fk in (a,i,m,s)), 'single-role provisioning sync');
 perform pg_temp.expect_error(format('select watmatch_admin_set_user_roles(%s,array[''instructor'',''mentor''],%s,''test'')', i,s), '42501','student cannot grant roles');
 perform pg_temp.expect_error(format('select watmatch_admin_set_user_roles(%s,array[''instructor'',''mentor''],%s,''test'')', i,i), '42501','instructor cannot grant roles');
 perform pg_temp.expect_error(format('select watmatch_admin_set_user_roles(%s,array[''instructor'',''mentor''],%s,''test'')', s,a), '23514','admin cannot give students additional roles');
 perform pg_temp.expect_error(format('select watmatch_admin_set_user_roles(%s,array[''instructor'',''admin''],%s,''test'')', i,a), '22023','unsupported role combinations rejected');
 perform pg_temp.expect_error(format('select watmatch_record_role_switch(%s,''instructor'',''mentor'')', i), '42501','cannot switch to unassigned role');
 perform pg_temp.expect_error(format('insert into user_roles(user_fk,role) values(%s,''mentor'')', s), '23514','database student exclusivity');
 perform pg_temp.expect_error(format('select watmatch_admin_set_user_roles(%s,array[''instructor'',''mentor''],%s,'' '')', i,a), '22023','grant requires audit reason');
 perform watmatch_admin_set_user_roles(i,array['instructor','mentor'],a,'Grant mentoring');
 set constraints all immediate;
 set constraints all deferred;
 perform pg_temp.check_true(watmatch_user_has_role(i,'instructor') and watmatch_user_has_role(i,'mentor'),'admin grants mentor to instructor');
 perform pg_temp.check_true((select course_fk = c and home_department_fk = d and role = 'instructor' from users where user_id=i),'instructor assignment preserved');
 perform watmatch_record_role_switch(i,'instructor','mentor');
 perform watmatch_get_mentor_dashboard(i,'mentor');
 perform watmatch_upsert_mentor_profile(i,'mentor',i,'Derek role test');
 result := watmatch_active_mentor_users(a,'admin');
 perform pg_temp.check_true(exists(select 1 from jsonb_array_elements(result->'data') row where (row->>'user_id')::bigint=i),'dual-role user stays in mentor directory');
 perform watmatch_record_role_switch(i,'mentor','instructor');
 perform pg_temp.check_true((select course_fk=c and role='instructor' from users where user_id=i),'switching leaves database identity and staffing unchanged');
 perform pg_temp.check_true((select count(*)=2 from audit_log where actor_fk=i and action='role_switched'),'switches audited with active role');
 perform pg_temp.expect_error(format('update users set role=''admin'' where user_id=%s',i),'23514','legacy role editing cannot bypass membership management');
 -- Granting Instructor to an existing mentor keeps their profile identity.
 insert into mentor_profiles(mentor_fk,display_name) values(m,'Existing mentor');
 perform watmatch_admin_set_user_roles(m,array['instructor','mentor'],a,'Grant teaching',c,d);
 perform pg_temp.check_true((select display_name='Existing mentor' from mentor_profiles where mentor_fk=m),'mentor profile survives instructor grant');
 perform pg_temp.check_true((select role='instructor' and course_fk=c from users where user_id=m),'mentor receives instructor course assignment');
 perform watmatch_admin_set_user_roles(m,array['mentor'],a,'Remove teaching');
 perform pg_temp.check_true((select role='mentor' and course_fk is null from users where user_id=m),'instructor revocation clears course and retains mentor');
 perform watmatch_admin_set_user_roles(i,array['instructor'],a,'Remove mentoring');
 perform pg_temp.expect_error(format('select watmatch_assert_active_mentor_user(%s)',i),'P0002','revoked mentor rejected by database');
 perform pg_temp.check_true((select display_name='Derek role test' from mentor_profiles where mentor_fk=i),'revocation retains mentor profile history');
 perform watmatch_admin_set_user_roles(i,array['instructor','mentor'],a,'Restore mentoring');
 update courses set activation_mode='force_active', active=true where course_id=c;
 perform pg_temp.check_true((select active from courses where course_id=c),'course activates with dual-role instructor');
 perform pg_temp.expect_error(format('select watmatch_admin_set_user_roles(%s,array[''mentor''],%s,''Remove teaching'')',i,a),'23514','cannot remove last instructor from active course');
 update courses set activation_mode='force_inactive', active=false where course_id=c;
 insert into teams(course_fk) values(c) returning team_id into team;
 insert into capstones(title,description,team_fk,course_fk) values('Role test project','Role test description',team,c) returning capstone_id into cap;
 insert into mentor_requests(capstone_fk,team_fk,mentor_fk,requested_by_fk) values(cap,team,i,a);
 perform pg_temp.expect_error(format('select watmatch_admin_set_user_roles(%s,array[''instructor''],%s,''Remove mentor'')',i,a),'23514','active mentor requests protect revocation');
 update capstones set status='pending_review' where capstone_id=cap;
 update mentor_requests set status='accepted', decided_by_fk=i, decided_at=now() where mentor_fk=i;
 perform watmatch_review_capstone(cap,i,'instructor','approve','Instructor also mentors this project');
 perform pg_temp.check_true((select status='approved_recruiting' from capstones where capstone_id=cap), 'instructor can approve a project they also mentor');
 perform pg_temp.check_true((select mentor_fk=i and status='accepted' from mentor_requests where capstone_fk=cap), 'instructor approval preserves own mentoring assignment');
 perform watmatch_admin_set_user_active(i,false,a,false,'Deactivate dual-role account');
 perform pg_temp.check_true((select status='cancelled' from mentor_requests where mentor_fk=i),'deactivating dual-role account cancels unfinished mentoring commitments');
 perform pg_temp.expect_error(format('select watmatch_record_role_switch(%s,''instructor'',''mentor'')',i),'42501','inactive accounts cannot switch');
 perform pg_temp.check_true(not has_table_privilege('authenticated','user_roles','INSERT'),'browser DB role cannot grant memberships');
 perform pg_temp.check_true(not has_function_privilege('authenticated','watmatch_admin_set_user_roles(bigint,text[],bigint,text,bigint,bigint)','EXECUTE'),'browser DB role cannot call membership RPC');
 set constraints all immediate;
end $$;
rollback;
