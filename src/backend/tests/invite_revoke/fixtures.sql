-- Run only through run.sh, which creates a new private PostgreSQL cluster.
create schema wm_invite_test;
create function wm_invite_test.check_true(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', label; end if;
end;
$$;

insert into departments(name) values ('Invite migration test');
insert into courses(code,name,department_fk,activation_mode)
select code, 'Invite migration test', department_id, 'force_inactive'
from departments
cross join (values ('INVITE490'),('INVITE491')) as codes(code)
where name='Invite migration test';
insert into users(email,role,course_fk,home_department_fk)
select actors.name || '@uwaterloo.ca', actors.role, course_id, department_fk
from (values
  ('invite.leader','student','INVITE490'),
  ('invite.student','student','INVITE490'),
  ('invite.outsider','student','INVITE491'),
  ('invite.instructor','instructor','INVITE490'),
  ('invite.other-instructor','instructor','INVITE491'),
  ('invite.admin','admin','INVITE490')
) as actors(name,role,code)
join courses using (code);
update courses set activation_mode='force_active',active=true where code='INVITE490';

insert into teams(course_fk)
select course_id from courses where code='INVITE490';
insert into team_memberships(team_fk,user_fk,enrollment_course_fk,is_leader)
select t.team_id,u.user_id,t.course_fk,true from teams t cross join users u
where u.email='invite.leader@uwaterloo.ca';
update teams set leader_fk=(select user_id from users where email='invite.leader@uwaterloo.ca');
insert into capstones(title,description,team_fk,course_fk)
select 'Invite migration project','Synthetic fixture',team_id,course_fk from teams;
insert into project_explorations(capstone_fk,team_fk,student_fk,status)
select c.capstone_id,c.team_fk,u.user_id,'invited'
from capstones c cross join users u where u.email='invite.student@uwaterloo.ca';

-- Model the observed old three-argument signature on the full application schema.
-- The old implementation is intentionally a stub; it must be replaced, not called.
drop function public.watmatch_revoke_invite(text,bigint,text,text);
create function public.watmatch_revoke_invite(text,bigint,text)
returns jsonb language plpgsql as $$
begin raise exception 'Legacy signature was not replaced'; end;
$$;

-- Compare every public table, including audit rows, across both migration passes.
create table wm_invite_test.before_rows(table_name text primary key, rows jsonb);
do $$
declare item record; saved jsonb;
begin
  for item in select tablename from pg_tables where schemaname='public' loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), ''[]''::jsonb) from public.%I t',item.tablename) into saved;
    insert into wm_invite_test.before_rows values(item.tablename,saved);
  end loop;
end;
$$;
