-- Run in a disposable Postgres database containing db/schema.sql and the three Supabase roles.
-- Every fixture and assertion runs inside a rolled-back transaction.
\set ON_ERROR_STOP on
begin;
insert into courses (course_id,code,name) overriding system value values
  (970001,'TEST970001','Synthetic coordinating course'),(970002,'TEST970002','Synthetic other course');
insert into users (user_id,email,role,course_fk) overriding system value values
  (970001,'scope-instructor-synthetic-970001@uwaterloo.ca','instructor',970001),
  (970002,'other-instructor-synthetic-970001@uwaterloo.ca','instructor',970002),
  (970003,'team-student-synthetic-970001@uwaterloo.ca','student',970001),
  (970004,'other-student-synthetic-970001@uwaterloo.ca','student',970001),
  (970005,'mentor-synthetic-970001@uwaterloo.ca','mentor',970001),
  (970006,'leader-synthetic-970001@uwaterloo.ca','student',970001),
  (970007,'second-instructor-synthetic-970001@uwaterloo.ca','instructor',970001);
update courses set activation_mode='force_active', active=true where course_id=970001;
insert into capstones (capstone_id,title,status,approval,course_fk) overriding system value
  values (970001,'Synthetic finalized project','draft',false,970001);
insert into teams(team_id,capstone_fk,course_fk,leader_fk,status) overriding system value
  values(970001,970001,970001,null,'forming');
update capstones set team_fk=970001 where capstone_id=970001;
insert into team_memberships(user_fk,team_fk,enrollment_course_fk,is_leader)
  values(970006,970001,970001,true),(970003,970001,970001,false);
update teams set leader_fk=970006 where team_id=970001;
set constraints all immediate;
set constraints all deferred;
update teams set status='finalized' where team_id=970001;
update capstones set status='approved',approval=true where capstone_id=970001;
set constraints all immediate;
set constraints all deferred;

create function pg_temp.expect_sqlstate(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE %', expected;
end $$;

set local role service_role;
do $$
declare first_note jsonb; repeated jsonb; entries jsonb; entry text := '00000000-0000-4000-8000-000000000017';
begin
  first_note := watmatch_add_milestone_feedback(970001,970001,entry::uuid,' Midpoint ',' Show the test results. ');
  repeated := watmatch_add_milestone_feedback(970001,970001,entry::uuid,'Midpoint','Show the test results.');
  if repeated <> first_note or first_note->>'created_at' is null then raise exception 'Idempotent write failed'; end if;
  entries := watmatch_list_milestone_feedback(970001,970003,'student');
  if jsonb_array_length(entries) <> 1 or entries->0->>'comment' <> 'Show the test results.' then raise exception 'Student read failed'; end if;
  if entries <> watmatch_list_milestone_feedback(970001,970001,'instructor') then raise exception 'Instructor read failed'; end if;
  perform pg_temp.expect_sqlstate(format('select watmatch_add_milestone_feedback(970001,970001,%L,%L,%L)',entry,'Midpoint','Changed note'), '23505');
  perform pg_temp.expect_sqlstate(format('select watmatch_add_milestone_feedback(970001,970002,%L,%L,%L)',entry,'Midpoint','Wrong course'), '42501');
  perform pg_temp.expect_sqlstate(format('select watmatch_add_milestone_feedback(970001,970003,%L,%L,%L)',entry,'Midpoint','Student write'), '42501');
  perform pg_temp.expect_sqlstate('select watmatch_list_milestone_feedback(970001,970003,''instructor'')','42501');
  perform pg_temp.expect_sqlstate('select watmatch_list_milestone_feedback(970001,970002,''instructor'')','42501');
  perform pg_temp.expect_sqlstate('select watmatch_list_milestone_feedback(970001,970004,''student'')','42501');
  perform pg_temp.expect_sqlstate('select watmatch_list_milestone_feedback(970001,970005,''mentor'')','42501');
end $$;
reset role;
update users set active=false where user_id=970003;
select pg_temp.expect_sqlstate('select watmatch_list_milestone_feedback(970001,970003,''student'')','42501');
select watmatch_complete_capstone(970001,970001,'instructor','Synthetic closeout','Fall 2026') is not null;
select pg_temp.expect_sqlstate('select watmatch_add_milestone_feedback(970001,970001,gen_random_uuid(),''After closeout'',''Late edit'')','42501');
update users set active=false where user_id=970001;
select pg_temp.expect_sqlstate('select watmatch_list_milestone_feedback(970001,970001,''instructor'')','42501');

-- Assess effective privileges after the Supabase-style schema grants.
do $$
declare r text; func regprocedure;
begin
  if not (select relrowsecurity from pg_class where oid='public.capstone_milestone_feedback'::regclass) then raise exception 'RLS is off'; end if;
  if has_table_privilege('service_role','public.capstone_milestone_feedback','UPDATE') or
     has_table_privilege('service_role','public.capstone_milestone_feedback','DELETE') then raise exception 'Feedback must remain append-only'; end if;
  foreach r in array array['anon','authenticated'] loop
    if has_table_privilege(r,'public.capstone_milestone_feedback','SELECT') or
       has_table_privilege(r,'public.capstone_milestone_feedback','INSERT') then raise exception 'Direct table privileges for %',r; end if;
    foreach func in array array[
      'public.watmatch_can_read_milestone_feedback(bigint,bigint,text)'::regprocedure,
      'public.watmatch_list_milestone_feedback(bigint,bigint,text)'::regprocedure,
      'public.watmatch_add_milestone_feedback(bigint,bigint,uuid,text,text)'::regprocedure] loop
      if has_function_privilege(r,func,'EXECUTE') then raise exception 'Direct RPC privilege for %',r; end if;
    end loop;
  end loop;
end $$;
rollback;
