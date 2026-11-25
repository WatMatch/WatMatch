create function wm_invite_test.expect_error(statement text, expected_state text, label text)
returns void language plpgsql as $$
declare actual_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
  end;
  if actual_state is distinct from expected_state then
    raise exception 'FAIL: % (expected %, got %)', label, expected_state, actual_state;
  end if;
end;
$$;

select wm_invite_test.check_true(to_regprocedure('public.watmatch_revoke_invite(text,bigint,text)') is null, 'old overload removed');
select wm_invite_test.check_true((select proargnames=array['p_invite_id','p_actor_id','p_actor_role','p_reason']::text[] and pronargdefaults=2 from pg_proc where oid='public.watmatch_revoke_invite(text,bigint,text,text)'::regprocedure), 'PostgREST argument names and legacy call defaults');
select wm_invite_test.check_true(not has_function_privilege('anon','public.watmatch_revoke_invite(text,bigint,text,text)','EXECUTE'), 'anon denied');
select wm_invite_test.check_true(not has_function_privilege('authenticated','public.watmatch_revoke_invite(text,bigint,text,text)','EXECUTE'), 'authenticated denied');
select wm_invite_test.check_true(has_function_privilege('service_role','public.watmatch_revoke_invite(text,bigint,text,text)','EXECUTE'), 'backend service allowed');

-- Exercise the same four named arguments PostgREST receives from the backend.
do $$
declare
  invitation text;
  leader bigint;
  outsider bigint;
  instructor bigint;
  other_instructor bigint;
  admin_user bigint;
  result jsonb;
  audit_before bigint;
begin
  select exploration_id::text into invitation from project_explorations;
  select user_id into leader from users where email='invite.leader@uwaterloo.ca';
  select user_id into outsider from users where email='invite.outsider@uwaterloo.ca';
  select user_id into instructor from users where email='invite.instructor@uwaterloo.ca';
  select user_id into other_instructor from users where email='invite.other-instructor@uwaterloo.ca';
  select user_id into admin_user from users where email='invite.admin@uwaterloo.ca';
  select count(*) into audit_before from audit_log where action='project_invite_revoked';

  perform wm_invite_test.expect_error(format('select watmatch_revoke_invite(%L,%s,''student'',null)',invitation,outsider),'42501','outside student denied');
  perform wm_invite_test.expect_error(format('select watmatch_revoke_invite(%L,%s,''instructor'',''Other course'')',invitation,other_instructor),'42501','other course instructor denied');
  perform wm_invite_test.expect_error(format('select watmatch_revoke_invite(%L,%s,''instructor'',null)',invitation,instructor),'23514','instructor reason required');
  perform wm_invite_test.expect_error(format('select watmatch_revoke_invite(%L,%s,''admin'','' '')',invitation,admin_user),'23514','admin reason required');
  perform wm_invite_test.expect_error(format('select watmatch_revoke_invite(%L,%s,''student'',repeat(''x'',2001))',invitation,leader),'22023','oversized reason denied');
  perform wm_invite_test.expect_error(format('select watmatch_revoke_invite(''bad-id'',%s,''student'',null)',leader),'22023','invalid invite denied');
  perform wm_invite_test.check_true((select status='invited' from project_explorations where exploration_id=invitation::bigint),'failed calls preserve invitation');
  perform wm_invite_test.check_true((select count(*)=audit_before from audit_log where action='project_invite_revoked'),'failed calls preserve audit history');

  set local role service_role;
  result := public.watmatch_revoke_invite(p_invite_id=>invitation,p_actor_id=>leader,p_actor_role=>'student',p_reason=>null);
  reset role;
  perform wm_invite_test.check_true((result->>'success')::boolean,'leader can revoke without reason');
  perform wm_invite_test.check_true((select status='declined' and decided_by_fk=leader from project_explorations where exploration_id=invitation::bigint),'revocation saves deciding actor');
  perform wm_invite_test.check_true((select count(*)=audit_before+1 from audit_log where action='project_invite_revoked'),'revocation has one audit record');

  -- The default keeps direct legacy three-argument callers compatible.
  result := public.watmatch_revoke_invite(invitation,leader,'student');
  perform wm_invite_test.check_true((result->'data'->>'already_resolved')::boolean,'repeated revoke is idempotent');
  perform wm_invite_test.check_true((select count(*)=audit_before+1 from audit_log where action='project_invite_revoked'),'retry adds no audit duplicate');

  update project_explorations set status='invited' where exploration_id=invitation::bigint;
  result := public.watmatch_revoke_invite(invitation,instructor,'instructor','  Team requested removal  ');
  perform wm_invite_test.check_true((result->>'success')::boolean,'assigned instructor can revoke');
  perform wm_invite_test.check_true(exists(select 1 from audit_log where action='project_invite_revoked' and actor_fk=instructor and reason='Team requested removal' and (metadata->>'staff_initiated')::boolean),'staff reason is trimmed and audited');
  update project_explorations set status='invited' where exploration_id=invitation::bigint;
  result := public.watmatch_revoke_invite(invitation,admin_user,'admin','Administrative correction');
  perform wm_invite_test.check_true((result->>'success')::boolean,'administrator can revoke with reason');
end;
$$;
