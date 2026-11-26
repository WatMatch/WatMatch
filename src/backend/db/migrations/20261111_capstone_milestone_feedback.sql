begin;
-- Qualitative milestone notes for finalized capstone teams.
create table if not exists public.capstone_milestone_feedback (
  entry_id uuid primary key,
  capstone_fk bigint not null references public.capstones(capstone_id) on delete cascade,
  author_fk bigint references public.users(user_id) on delete set null,
  milestone text not null check (length(btrim(milestone)) between 1 and 100),
  comment text not null check (length(btrim(comment)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists capstone_milestone_feedback_history
  on public.capstone_milestone_feedback(capstone_fk, created_at desc, entry_id);
alter table public.capstone_milestone_feedback enable row level security;
revoke all on public.capstone_milestone_feedback from public, anon, authenticated, service_role;
grant select, insert on public.capstone_milestone_feedback to service_role;

-- Both endpoints receive actor identity and active role from the backend.
create or replace function public.watmatch_can_read_milestone_feedback(
  p_capstone_id bigint, p_actor_id bigint, p_role text
) returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.capstones c
    join public.teams t on t.team_id = c.team_fk and t.capstone_fk = c.capstone_id
    join public.users u on u.user_id = p_actor_id and u.active and u.role = p_role
    where c.capstone_id = p_capstone_id and c.status in ('approved', 'complete')
      and c.approval and not c.archived and t.status = 'finalized'
      and (
        (p_role = 'instructor' and u.course_fk = c.course_fk)
        or (p_role = 'student' and exists (
          select 1 from public.team_memberships m where m.team_fk = t.team_id and m.user_fk = u.user_id
        ))
      )
  );
$$;

create or replace function public.watmatch_list_milestone_feedback(
  p_capstone_id bigint, p_actor_id bigint, p_role text
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not public.watmatch_can_read_milestone_feedback(p_capstone_id, p_actor_id, p_role) then
    raise insufficient_privilege;
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('entry_id', f.entry_id,
      'milestone', f.milestone, 'comment', f.comment, 'created_at', f.created_at)
      order by f.created_at desc, f.entry_id), '[]'::jsonb)
    from public.capstone_milestone_feedback f where f.capstone_fk = p_capstone_id);
end;
$$;

create or replace function public.watmatch_add_milestone_feedback(
  p_capstone_id bigint, p_actor_id bigint, p_entry_id uuid, p_milestone text, p_comment text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare f public.capstone_milestone_feedback%rowtype;
begin
  -- Lock the scope and project state until this write commits.
  perform 1 from public.capstones c
    join public.teams t on t.team_id = c.team_fk and t.capstone_fk = c.capstone_id
    join public.users u on u.user_id = p_actor_id and u.active
    where c.capstone_id = p_capstone_id and t.status = 'finalized'
      and c.status = 'approved' and c.approval and not c.archived
      and not coalesce(c.carry_over_read_only, false) and c.closeout_decision is null
      and u.role = 'instructor' and u.course_fk = c.course_fk
    for share of c, t, u;
  if not found then raise insufficient_privilege; end if;

  insert into public.capstone_milestone_feedback(entry_id, capstone_fk, author_fk, milestone, comment)
    values (p_entry_id, p_capstone_id, p_actor_id, btrim(p_milestone), btrim(p_comment))
    on conflict (entry_id) do nothing returning * into f;
  if not found then
    select * into f from public.capstone_milestone_feedback where entry_id = p_entry_id
      and author_fk = p_actor_id and capstone_fk = p_capstone_id
      and milestone = btrim(p_milestone) and comment = btrim(p_comment);
    if not found then raise unique_violation; end if;
  end if;
  return jsonb_build_object('entry_id', f.entry_id, 'milestone', f.milestone,
    'comment', f.comment, 'created_at', f.created_at);
end;
$$;

revoke all on function public.watmatch_can_read_milestone_feedback(bigint,bigint,text),
  public.watmatch_list_milestone_feedback(bigint,bigint,text),
  public.watmatch_add_milestone_feedback(bigint,bigint,uuid,text,text) from public, anon, authenticated;
grant execute on function public.watmatch_can_read_milestone_feedback(bigint,bigint,text),
  public.watmatch_list_milestone_feedback(bigint,bigint,text),
  public.watmatch_add_milestone_feedback(bigint,bigint,uuid,text,text) to service_role;
commit;
