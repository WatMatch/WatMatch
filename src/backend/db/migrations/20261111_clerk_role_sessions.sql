begin;
-- Requires 20261005_instructor_mentor_roles.sql. Only the API may select a workspace.
create table if not exists public.clerk_role_sessions (
    user_fk bigint not null references public.users(user_id) on delete cascade,
    session_key text not null check (session_key ~ '^[a-f0-9]{64}$'),
    active_role text not null check (active_role in ('instructor', 'mentor')),
    primary key (user_fk, session_key)
);
alter table public.clerk_role_sessions enable row level security;
revoke all on public.clerk_role_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.clerk_role_sessions to service_role;

create or replace function public.watmatch_switch_clerk_workspace(
    p_user_id bigint, p_session_key text, p_from_role text, p_to_role text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
    current_role_name text;
    default_role_name text;
begin
    -- Admin membership changes and switches use the same user-row lock.
    select role into default_role_name from users where user_id = p_user_id and active is true for update;
    if not found or p_session_key is null or p_session_key !~ '^[a-f0-9]{64}$'
       or p_from_role is null or p_to_role is null or p_to_role = p_from_role
       or p_to_role not in ('instructor','mentor') or p_from_role not in ('instructor','mentor') then
        return jsonb_build_object('success', false, 'reason', 'denied');
    end if;
    select active_role into current_role_name from clerk_role_sessions
      where user_fk = p_user_id and session_key = p_session_key;
    if coalesce(current_role_name, default_role_name) <> p_from_role then
        return jsonb_build_object('success', false, 'reason', 'stale');
    end if;
    if not watmatch_user_has_role(p_user_id, p_to_role) or not watmatch_user_has_role(p_user_id, p_from_role) then
        return jsonb_build_object('success', false, 'reason', 'denied');
    end if;
    perform watmatch_record_role_switch(p_user_id, p_from_role, p_to_role);
    insert into clerk_role_sessions(user_fk, session_key, active_role)
      values (p_user_id, p_session_key, p_to_role)
      on conflict (user_fk, session_key) do update set active_role = excluded.active_role;
    return jsonb_build_object('success', true, 'active_role', p_to_role);
end;
$$;
revoke all on function public.watmatch_switch_clerk_workspace(bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.watmatch_switch_clerk_workspace(bigint,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
