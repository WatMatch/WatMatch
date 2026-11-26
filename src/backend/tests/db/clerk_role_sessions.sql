-- Run on an isolated database after applying the two role migrations.
\set ON_ERROR_STOP on
begin;
do $$
declare
  client_role text;
  staff_id bigint;
  first_session text := repeat('a', 64);
  other_session text := repeat('b', 64);
  result jsonb;
begin
  foreach client_role in array array['anon','authenticated'] loop
    if has_table_privilege(client_role, 'clerk_role_sessions', 'SELECT,INSERT,UPDATE,DELETE')
       or has_function_privilege(client_role,'watmatch_switch_clerk_workspace(bigint,text,text,text)','EXECUTE') then
      raise exception 'Browser role has workspace table or switch access';
    end if;
  end loop;
  insert into users(email,role) values ('wmtrial.workspace-sql@uwaterloo.ca','instructor') returning user_id into staff_id;
  insert into user_roles(user_fk,role) values (staff_id,'mentor');
  result := watmatch_switch_clerk_workspace(staff_id, first_session, 'instructor', 'mentor');
  if result->>'active_role' is distinct from 'mentor' then raise exception 'Switch failed'; end if;
  if watmatch_switch_clerk_workspace(staff_id, first_session, 'instructor','mentor')->>'reason' is distinct from 'stale'
    then raise exception 'Stale switch succeeded'; end if;
  if exists (select from clerk_role_sessions where user_fk=staff_id and session_key=other_session)
    then raise exception 'Changed another session'; end if;
  if (select count(*) from audit_log where actor_fk=staff_id and action='role_switched') <> 1
    then raise exception 'Switch was not audited exactly once'; end if;
  delete from user_roles where user_fk=staff_id and role='mentor';
  if watmatch_switch_clerk_workspace(staff_id, first_session,'mentor','instructor')->>'reason' is distinct from 'denied'
    then raise exception 'Revoked membership accepted'; end if;
end $$;
rollback;
