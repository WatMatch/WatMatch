-- Load after role_preview_fixture.sql in a fresh disposable database.
-- This fixture commits synthetic rows for the loopback HTTP trial.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if not exists(select 1 from watmatch_role_test_marker where id=1) then
    raise exception 'Expected the disposable role fixture';
  end if;
end $$;
insert into courses (course_id,code,name) overriding system value values
  (980001,'TEST980001','Synthetic coordinating course'),(980002,'TEST980002','Synthetic other course');
insert into users (user_id,email,role,course_fk) overriding system value values
  (980001,'wmtrial.milestonescopeinstructor@uwaterloo.ca','instructor',980001),
  (980002,'wmtrial.milestoneotherinstructor@uwaterloo.ca','instructor',980002),
  (980003,'wmtrial.milestoneteamstudent@uwaterloo.ca','student',980001),
  (980004,'wmtrial.milestoneotherstudent@uwaterloo.ca','student',980001),
  (980005,'wmtrial.milestonementor@uwaterloo.ca','mentor',980001),
  (980006,'wmtrial.milestoneleader@uwaterloo.ca','student',980001),
  (980007,'wmtrial.milestonesecondinstructor@uwaterloo.ca','instructor',980001);
update users set home_department_fk=(select department_id from departments where name='Role Preview Engineering')
where user_id=980001;
update marketplace_settings set phase='exploration', exploration_starts_at=null, commitment_starts_at=null, finalization_starts_at=null where setting_id=1;
update courses set activation_mode='force_active', active=true where course_id=980001;
insert into capstones (capstone_id,title,status,approval,course_fk) overriding system value
  values (980001,'Synthetic finalized project','draft',false,980001);
insert into teams(team_id,capstone_fk,course_fk,leader_fk,status) overriding system value
  values(980001,980001,980001,null,'forming');
update capstones set team_fk=980001 where capstone_id=980001;
insert into team_memberships(user_fk,team_fk,enrollment_course_fk,is_leader)
  values(980006,980001,980001,true),(980003,980001,980001,false);
update teams set leader_fk=980006 where team_id=980001;
set constraints all immediate;
set constraints all deferred;
update teams set status='finalized' where team_id=980001;
update capstones set status='approved',approval=true where capstone_id=980001;
set constraints all immediate;
set constraints all deferred;

commit;
notify pgrst, 'reload schema';
