-- Only for the disposable local role test database. Never run against Supabase.
\set ON_ERROR_STOP on
begin;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
do $$
declare d bigint; c bigint;
begin
 select department_id into d from departments where name='Role Preview Engineering';
 if d is null then insert into departments(name) values('Role Preview Engineering') returning department_id into d; end if;
 select course_id into c from courses where code='ROLE 490';
 if c is null then insert into courses(code,name,department_fk,activation_mode) values('ROLE 490','Role switching preview',d,'force_inactive') returning course_id into c; end if;
 insert into users(email,role,course_fk,home_department_fk) values
 ('wmtrial.admin@uwaterloo.ca','admin',null,null),
 ('wmtrial.instructor.se@uwaterloo.ca','instructor',c,d),
 ('wmtrial.mentor.lee@uwaterloo.ca','mentor',null,null),
 ('wmtrial.student.test@uwaterloo.ca','student',null,d)
 on conflict(email) do nothing;
end $$;
create table if not exists public.watmatch_role_test_marker (id integer primary key check (id=1));
insert into public.watmatch_role_test_marker values(1) on conflict do nothing;
grant select on public.watmatch_role_test_marker to service_role;
notify pgrst, 'reload schema';
commit;
