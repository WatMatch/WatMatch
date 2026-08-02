-- WatMatch deterministic demo seed.
--
-- Run after db/schema.sql. This script intentionally reads, but does not write,
-- stable catalog/reference tables such as courses, departments, faculties,
-- course_offerings, course_offering_held_with, project_ecosystems, skills, or
-- past_capstones.
--
-- It leaves triggers enabled. In particular, user/instructor writes are allowed
-- to run the existing course activation sync invariant.

begin;
set constraints all deferred;

do $$
declare
  v_missing text;
begin
  select string_agg(required.course_code, ', ' order by required.course_code)
    into v_missing
  from (
    values
      ('SE 490'),
      ('SE 491'),
      ('MTE 481'),
      ('BME 461'),
      ('SYDE 461'),
      ('MTHEL 398'),
      ('SCI 300'),
      ('GENE 403')
  ) as required(course_code)
  where not exists (
    select 1
    from courses c
    where upper(c.code) = upper(required.course_code)
  );

  if v_missing is not null then
    raise exception 'Demo seed cannot run. Missing required catalog course(s): %', v_missing;
  end if;

  select string_agg(required.home_department, ', ' order by required.home_department)
    into v_missing
  from (
    values
      ('Software Engineering'),
      ('Mechatronics Engineering'),
      ('Biomedical Engineering'),
      ('Systems Design Engineering'),
      ('Mathematics'),
      ('Science'),
      ('Interdisciplinary')
  ) as required(home_department)
  where not exists (
    select 1
    from departments d
    where d.name = required.home_department
  );

  if v_missing is not null then
    raise exception 'Demo seed cannot run. Missing required department(s): %', v_missing;
  end if;

  if to_regprocedure(
    'public.watmatch_apply_marketplace_commitment(bigint,bigint,bigint,text,text,bigint,text,boolean)'
  ) is not null then
    raise exception 'Demo seed cannot run. The legacy marketplace commitment RPC overload is still installed. Re-run db/schema.sql before reseeding.';
  end if;

  if to_regprocedure(
    'public.watmatch_apply_marketplace_commitment(bigint,bigint,bigint,text,text,bigint,text,boolean,jsonb)'
  ) is null then
    raise exception 'Demo seed cannot run. The current marketplace commitment RPC is missing. Run db/schema.sql before reseeding.';
  end if;

  if not exists (select 1 from past_capstones) then
    raise exception 'Demo seed cannot run. No imported historical past_capstones rows were found. Load the past-capstone archive before seeding the Mid 2 demo.';
  end if;
end $$;

-- Reset mutable workflow/demo tables. Users are upserted below rather than
-- globally deleted, so local non-demo accounts survive the demo reset.
--
-- Most leaf workflow tables can be truncated safely. `teams`, `capstones`, and
-- `partner_opportunities` are deleted in order because truncating them would
-- cascade through FK relationships into `users` and/or core catalog tables.
update users
set active_team_fk = null
where active_team_fk is not null;

update teams
set status = 'forming'
where status <> 'forming';

update capstones
set status = 'draft',
    approval = false,
    archived = false,
    archived_at = null,
    archived_reason = null,
    closeout_decision = null,
    closeout_decided_by_fk = null,
    closeout_decided_at = null,
    closeout_applied_at = null,
    closeout_notes = null,
    continued_to_course_fk = null,
    continued_to_term = null,
    continued_member_enrollment_routes = '{}'::jsonb,
    completed_at = null,
    completed_by_fk = null,
    completed_term = null,
    completion_notes = null,
    published_past_capstone_fk = null,
    published_watmatch_past_capstone_fk = null,
    carry_over_read_only = false,
    updated_at = now()
where status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing')
   or approval is true
   or archived is true
   or completed_at is not null
   or closeout_decision is not null
   or carry_over_read_only is true;

update teams
set leader_fk = null
where leader_fk is not null;

delete from student_past_capstone_shortlists s
using users u
where s.student_fk = u.user_id
  and u.email in (
    'student.se.leader@uwaterloo.ca',
    'student.se.member@uwaterloo.ca',
    'student.se.explorer@uwaterloo.ca',
    'student.se.direct.leader@uwaterloo.ca',
    'student.se.direct.candidate@uwaterloo.ca',
    'student.se.mixed.leader@uwaterloo.ca',
    'student.se.unsupported@uwaterloo.ca',
    'student.mte.commit@uwaterloo.ca',
    'student.mte.review@uwaterloo.ca',
    'student.nocourse@uwaterloo.ca',
    'student.syde.final@uwaterloo.ca',
    'student.se.complete@uwaterloo.ca',
    'student.bme.partner@uwaterloo.ca',
    'student.futurecities@uwaterloo.ca'
  );

truncate table
  audit_log,
  project_commitment_requests,
  project_explorations,
  course_reassignment_requests,
  capstone_course_approvals,
  approvals,
  mentor_requests,
  capstone_departments,
  team_memberships,
  partner_opportunity_courses
restart identity;

delete from capstones;
delete from past_watmatch_capstones;
delete from teams;
delete from partner_opportunities;

truncate table
  partner_profiles,
  mentor_profile_departments,
  mentor_profiles,
  student_profile_departments,
  student_profile
restart identity;

with seed (email, role, course_code, home_department, active) as (
  values
    ('admin@uwaterloo.ca', 'admin', null, null, true),
    ('advisor@uwaterloo.ca', 'academic_advisor', null, null, true),
    ('enrollment@uwaterloo.ca', 'enrollment_operator', null, null, true),
    ('instructor.se@uwaterloo.ca', 'instructor', 'SE 490', 'Software Engineering', true),
    ('instructor.se491@uwaterloo.ca', 'instructor', 'SE 491', 'Software Engineering', true),
    ('instructor.mte@uwaterloo.ca', 'instructor', 'MTE 481', 'Mechatronics Engineering', true),
    ('instructor.bme@uwaterloo.ca', 'instructor', 'BME 461', 'Biomedical Engineering', true),
    ('instructor.syde@uwaterloo.ca', 'instructor', 'SYDE 461', 'Systems Design Engineering', true),
    ('instructor.futurecities@uwaterloo.ca', 'instructor', 'MTHEL 398', 'Mathematics', true),
    ('instructor.interdisciplinary@uwaterloo.ca', 'instructor', 'SCI 300', 'Science', true),
    ('instructor.gene@uwaterloo.ca', 'instructor', 'GENE 403', 'Interdisciplinary', true),
    ('mentor.lee@uwaterloo.ca', 'mentor', null, 'Software Engineering', true),
    ('external.partner@uwaterloo.ca', 'external_partner', null, null, true),
    ('student.se.leader@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.se.member@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.se.explorer@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.se.direct.leader@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.se.direct.candidate@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.se.mixed.leader@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.se.unsupported@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.mte.commit@uwaterloo.ca', 'student', 'MTE 481', 'Mechatronics Engineering', true),
    ('student.mte.review@uwaterloo.ca', 'student', 'MTE 481', 'Mechatronics Engineering', true),
    ('student.nocourse@uwaterloo.ca', 'student', null, null, true),
    ('student.syde.final@uwaterloo.ca', 'student', 'SYDE 461', 'Systems Design Engineering', true),
    ('student.se.complete@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true),
    ('student.bme.partner@uwaterloo.ca', 'student', 'BME 461', 'Biomedical Engineering', true),
    ('student.futurecities@uwaterloo.ca', 'student', 'SE 490', 'Software Engineering', true)
)
insert into users (email, role, course_fk, home_department_fk, active, active_team_fk)
select
  seed.email,
  seed.role,
  c.course_id,
  d.department_id,
  seed.active,
  null
from seed
left join courses c on upper(c.code) = upper(seed.course_code)
left join departments d on d.name = seed.home_department
on conflict (email) do update
  set role = excluded.role,
      course_fk = excluded.course_fk,
      home_department_fk = excluded.home_department_fk,
      active = excluded.active,
      active_team_fk = null;

insert into marketplace_settings (
  setting_id,
  current_term,
  phase,
  exploration_starts_at,
  commitment_starts_at,
  finalization_starts_at,
  updated_by_fk,
  updated_at
)
select
  1,
  'Fall 2026',
  'exploration',
  '2026-09-08 09:00:00-04'::timestamptz,
  '2026-09-22 09:00:00-04'::timestamptz,
  '2026-10-06 09:00:00-04'::timestamptz,
  u.user_id,
  now()
from users u
where u.email = 'admin@uwaterloo.ca'
on conflict (setting_id) do update
  set current_term = excluded.current_term,
      phase = excluded.phase,
      exploration_starts_at = excluded.exploration_starts_at,
      commitment_starts_at = excluded.commitment_starts_at,
      finalization_starts_at = excluded.finalization_starts_at,
      updated_by_fk = excluded.updated_by_fk,
      updated_at = now();

do $$
declare
  v_admin bigint;
begin
  select user_id
    into v_admin
  from users
  where email = 'admin@uwaterloo.ca';

  perform watmatch_sync_course_activation_for_current_term(
    v_admin,
    'Demo seed aligned courses.active after setting Fall 2026 marketplace term.'
  );
end $$;

do $$
declare
  v_missing text;
begin
  select string_agg(required.course_code || ' for ' || required.term, ', ' order by required.course_code, required.term)
    into v_missing
  from (
    values
      ('SE 490', 'Fall 2026'),
      ('MTE 481', 'Fall 2026'),
      ('BME 461', 'Fall 2026'),
      ('SYDE 461', 'Fall 2026'),
      ('MTHEL 398', 'Fall 2026'),
      ('SCI 300', 'Fall 2026'),
      ('GENE 403', 'Fall 2026'),
      ('SE 491', 'Winter 2027')
  ) as required(course_code, term)
  join courses c on upper(c.code) = upper(required.course_code)
  where watmatch_course_available_for_term(c.course_id, required.term) is not true;

  if v_missing is not null then
    raise exception 'Demo seed cannot run. These routes are not available/staffed for the demo term(s): %', v_missing;
  end if;
end $$;

insert into partner_profiles (
  partner_user_fk,
  display_name,
  organization,
  contact_email,
  website,
  bio,
  areas,
  updated_at
)
select
  u.user_id,
  'Waterloo Region Health Network',
  'Waterloo Region Health Network',
  'external.partner@uwaterloo.ca',
  'https://example.org/wrhn',
  'Demo external partner profile for partner-originated project opportunities.',
  array['Health systems', 'Operations', 'Accessibility'],
  now()
from users u
where u.email = 'external.partner@uwaterloo.ca';

insert into partner_opportunities (
  partner_user_fk,
  title,
  organization,
  description,
  primary_contact,
  how_heard_about_capstone,
  organization_description,
  organization_size,
  project_start_date,
  problem_area,
  main_objectives,
  scope_of_work,
  deliverable_types,
  deliverables,
  meeting_frequency,
  resources_needed,
  disciplines,
  skills,
  target_course_tags,
  preferred_team_size,
  max_active_teams,
  contact_email,
  contact_url,
  ip_acknowledged,
  nda_acknowledged,
  matching_acknowledged,
  status,
  updated_at
)
select
  u.user_id,
  opportunity.title,
  opportunity.organization,
  opportunity.description,
  opportunity.primary_contact,
  opportunity.how_heard_about_capstone,
  opportunity.organization_description,
  opportunity.organization_size,
  opportunity.project_start_date,
  opportunity.problem_area,
  opportunity.main_objectives,
  opportunity.scope_of_work,
  opportunity.deliverable_types,
  opportunity.deliverables,
  opportunity.meeting_frequency,
  opportunity.resources_needed,
  opportunity.disciplines,
  opportunity.skills,
  opportunity.target_course_tags,
  opportunity.preferred_team_size,
  opportunity.max_active_teams,
  opportunity.contact_email,
  opportunity.contact_url,
  true,
  true,
  true,
  opportunity.status,
  now()
from users u
cross join (
  values
    (
      'Hospital Scheduling Optimizer',
      'Waterloo Region Health Network',
      'A partner-originated opportunity to explore ward staffing, appointment scheduling, and bottleneck visibility for clinical coordinators.',
      'Jamie Demo',
      'Waterloo capstone outreach',
      'Regional healthcare operator with multiple clinics and care teams.',
      '500-999',
      'Fall 2026',
      'Care teams need better ways to surface schedule pressure before it affects patient flow.',
      'Prototype a scheduling insight tool, identify feasible data inputs, and evaluate coordinator-facing workflows.',
      'Interview workflow owners, map scheduling constraints, design a dashboard prototype, and validate it with sample scenarios.',
      array['Prototype', 'Research report', 'Technical design'],
      'Interactive prototype, feasibility report, and implementation roadmap.',
      'Weekly partner check-ins',
      'Access to de-identified sample scheduling scenarios and stakeholder interviews.',
      array['Biomedical Engineering', 'Software Engineering', 'Science'],
      array['Optimization', 'UX research', 'Data visualization'],
      array['BME 461', 'SE 490', 'SCI 300'],
      '3-5 students',
      2,
      'external.partner@uwaterloo.ca',
      'https://example.org/wrhn/capstones',
      'published'
    ),
    (
      'Civic Accessibility Data Portal',
      'Waterloo Region Health Network',
      'A lighter partner posting for demoing draft/archive behavior without needing a live team.',
      'Jamie Demo',
      'Waterloo capstone outreach',
      'Regional healthcare operator with community accessibility partners.',
      '500-999',
      'Fall 2026',
      'Accessibility requests are spread across spreadsheets and email threads.',
      'Explore a public-service intake and triage workflow.',
      'Sketch intake flows, data fields, and reporting views.',
      array['Prototype', 'Process map'],
      'Concept prototype and process recommendation.',
      'Bi-weekly partner check-ins',
      'Sample intake fields and staff interviews.',
      array['Software Engineering', 'Science'],
      array['Accessibility', 'Product design'],
      array['SE 490', 'SCI 300'],
      '2-4 students',
      1,
      'external.partner@uwaterloo.ca',
      'https://example.org/wrhn/accessibility',
      'draft'
    )
) as opportunity(
  title,
  organization,
  description,
  primary_contact,
  how_heard_about_capstone,
  organization_description,
  organization_size,
  project_start_date,
  problem_area,
  main_objectives,
  scope_of_work,
  deliverable_types,
  deliverables,
  meeting_frequency,
  resources_needed,
  disciplines,
  skills,
  target_course_tags,
  preferred_team_size,
  max_active_teams,
  contact_email,
  contact_url,
  status
)
where u.email = 'external.partner@uwaterloo.ca';

insert into partner_opportunity_courses (partner_opportunity_fk, course_fk)
select po.partner_opportunity_id, c.course_id
from partner_opportunities po
join unnest(po.target_course_tags) as tag(course_code) on true
join courses c on upper(c.code) = upper(tag.course_code)
on conflict do nothing;

insert into mentor_profiles (
  mentor_fk,
  display_name,
  primary_department_fk,
  affiliation,
  bio,
  availability_terms,
  expertise_tags,
  max_active_projects,
  updated_at
)
select
  mentor.user_id,
  'Dr. Alex Lee',
  dept.department_id,
  'Faculty mentor, Software Engineering',
  'Demo mentor profile for project support, mentor request, and accepted support flows.',
  array['Fall', 'Winter'],
  array['Product scoping', 'Accessibility', 'Health systems', 'Data visualization'],
  3,
  now()
from users mentor
left join departments dept on dept.name = 'Software Engineering'
where mentor.email = 'mentor.lee@uwaterloo.ca';

insert into mentor_profile_departments (mentor_fk, department_fk)
select mentor.user_id, dept.department_id
from users mentor
join departments dept on dept.name in ('Software Engineering', 'Biomedical Engineering', 'Systems Design Engineering')
where mentor.email = 'mentor.lee@uwaterloo.ca'
on conflict do nothing;

insert into student_profile (
  student_fk,
  headline,
  about_me,
  skills,
  preferred_roles,
  project_interests,
  availability,
  portfolio_url,
  linkedin_url,
  github_url,
  profile_visibility,
  updated_at
)
select
  u.user_id,
  profile.headline,
  profile.about_me,
  profile.skills,
  profile.preferred_roles,
  profile.project_interests,
  profile.availability,
  profile.portfolio_url,
  profile.linkedin_url,
  profile.github_url,
  'team_network',
  now()
from users u
join (
  values
    ('student.se.leader@uwaterloo.ca', 'SE project proposer', 'Interested in accessibility and campus operations projects.', array['React', 'Product scoping', 'Interviews'], array['Team lead', 'Frontend'], array['Accessibility', 'Campus tools'], 'Weekdays after 4 PM', 'https://example.org/se-leader', 'https://linkedin.com/in/se-leader-demo', 'https://github.com/se-leader-demo'),
    ('student.se.member@uwaterloo.ca', 'SE builder', 'Enjoys building usable prototypes from ambiguous project ideas.', array['TypeScript', 'APIs', 'Testing'], array['Backend', 'Full stack'], array['Civic tech', 'Developer tools'], 'Flexible', 'https://example.org/se-member', 'https://linkedin.com/in/se-member-demo', 'https://github.com/se-member-demo'),
    ('student.se.explorer@uwaterloo.ca', 'Marketplace explorer', 'Looking for projects with user research and measurable impact.', array['UX research', 'Figma', 'React'], array['Research', 'Frontend'], array['Accessibility', 'Education'], 'Mondays and Thursdays', null, null, 'https://github.com/se-explorer-demo'),
    ('student.se.direct.leader@uwaterloo.ca', 'Same-course leader', 'Building a practical scheduling tool for student teams.', array['Next.js', 'SQL', 'Leadership'], array['Team lead'], array['Scheduling', 'Student life'], 'Afternoons', null, null, 'https://github.com/se-direct-leader-demo'),
    ('student.se.direct.candidate@uwaterloo.ca', 'Same-course candidate', 'Strong in frontend polish and QA.', array['React', 'Accessibility testing', 'CSS'], array['Frontend', 'QA'], array['Student tools'], 'Evenings', null, null, 'https://github.com/se-direct-candidate-demo'),
    ('student.se.mixed.leader@uwaterloo.ca', 'Mixed-course leader', 'Interested in hardware/software coordination projects.', array['Python', 'Embedded systems', 'Planning'], array['Team lead', 'Systems'], array['Sensors', 'Robotics'], 'Flexible', null, null, 'https://github.com/se-mixed-leader-demo'),
    ('student.se.unsupported@uwaterloo.ca', 'Support blocker demo', 'Project is otherwise ready but deliberately missing mentor/partner support.', array['React', 'Data visualization'], array['Frontend'], array['Campus systems'], 'Tuesdays', null, null, 'https://github.com/se-unsupported-demo'),
    ('student.mte.commit@uwaterloo.ca', 'MTE cross-course student', 'Mechatronics student interested in sensor systems.', array['CAD', 'Controls', 'Python'], array['Hardware', 'Systems'], array['Sensors', 'Automation'], 'Mornings', null, null, 'https://github.com/mte-commit-demo'),
    ('student.mte.review@uwaterloo.ca', 'MTE proposer', 'Preparing an instructor-review project submission.', array['Mechatronics design', 'Simulation'], array['Systems'], array['Clinical flow', 'Simulation'], 'Fridays', null, null, 'https://github.com/mte-review-demo'),
    ('student.nocourse@uwaterloo.ca', 'No-course applicant', 'Needs staff enrollment routing before submitting or joining a capstone.', array['Data analysis', 'Writing'], array['Research'], array['Future cities', 'Policy'], 'Flexible', null, null, null),
    ('student.syde.final@uwaterloo.ca', 'Finalized SYDE lead', 'Read-only finalized project demo owner.', array['Systems design', 'Stakeholder mapping'], array['Team lead'], array['Mobility', 'Cities'], 'Flexible', null, null, 'https://github.com/syde-final-demo'),
    ('student.se.complete@uwaterloo.ca', 'Completed project owner', 'Completed project demo owner for native WatMatch archive publishing.', array['APIs', 'Deployment'], array['Backend'], array['Health systems'], 'Flexible', null, null, 'https://github.com/se-complete-demo'),
    ('student.bme.partner@uwaterloo.ca', 'BME partner proposer', 'Working with an external partner opportunity.', array['Biomedical design', 'Workflow analysis'], array['Clinical SME'], array['Health systems'], 'Wednesdays', null, null, 'https://github.com/bme-partner-demo'),
    ('student.futurecities@uwaterloo.ca', 'Future Cities route demo', 'Interdisciplinary route demo student awaiting staff routing.', array['Urban systems', 'Data storytelling'], array['Research', 'Planning'], array['Future cities', 'Climate adaptation'], 'Afternoons', null, null, null)
) as profile(email, headline, about_me, skills, preferred_roles, project_interests, availability, portfolio_url, linkedin_url, github_url)
  on profile.email = u.email;

with seed (email, role, home_department) as (
  values
    ('student.se.leader@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.se.member@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.se.explorer@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.se.direct.leader@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.se.direct.candidate@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.se.mixed.leader@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.se.unsupported@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.mte.commit@uwaterloo.ca', 'student', 'Mechatronics Engineering'),
    ('student.mte.review@uwaterloo.ca', 'student', 'Mechatronics Engineering'),
    ('student.syde.final@uwaterloo.ca', 'student', 'Systems Design Engineering'),
    ('student.se.complete@uwaterloo.ca', 'student', 'Software Engineering'),
    ('student.bme.partner@uwaterloo.ca', 'student', 'Biomedical Engineering'),
    ('student.futurecities@uwaterloo.ca', 'student', 'Software Engineering')
)
insert into student_profile_departments (student_fk, department_fk)
select u.user_id, d.department_id
from users u
join seed on seed.email = u.email
join departments d on d.name = seed.home_department
where seed.role = 'student'
  and seed.home_department is not null
on conflict do nothing;

do $$
declare
  v_admin bigint;
  v_advisor bigint;
  v_enrollment bigint;
  v_instructor_se bigint;
  v_instructor_mte bigint;
  v_instructor_bme bigint;
  v_instructor_syde bigint;
  v_instructor_future bigint;
  v_mentor bigint;
  v_partner bigint;

  v_se490 bigint;
  v_mte481 bigint;
  v_bme461 bigint;
  v_syde461 bigint;
  v_mthel398 bigint;
  v_sci300 bigint;

  v_dept_se bigint;
  v_dept_mte bigint;
  v_dept_bme bigint;
  v_dept_syde bigint;
  v_dept_math bigint;
  v_dept_science bigint;

  v_partner_opportunity bigint;

  v_leader bigint;
  v_member bigint;
  v_explorer bigint;
  v_direct_leader bigint;
  v_direct_candidate bigint;
  v_mixed_leader bigint;
  v_unsupported bigint;
  v_mte_commit bigint;
  v_mte_review bigint;
  v_no_course bigint;
  v_syde_final bigint;
  v_se_complete bigint;
  v_bme_partner bigint;
  v_futurecities bigint;

  v_cap bigint;
  v_team bigint;
  v_exploration bigint;
  v_count integer;
begin
  select user_id into v_admin from users where email = 'admin@uwaterloo.ca';
  select user_id into v_advisor from users where email = 'advisor@uwaterloo.ca';
  select user_id into v_enrollment from users where email = 'enrollment@uwaterloo.ca';
  select user_id into v_instructor_se from users where email = 'instructor.se@uwaterloo.ca';
  select user_id into v_instructor_mte from users where email = 'instructor.mte@uwaterloo.ca';
  select user_id into v_instructor_bme from users where email = 'instructor.bme@uwaterloo.ca';
  select user_id into v_instructor_syde from users where email = 'instructor.syde@uwaterloo.ca';
  select user_id into v_instructor_future from users where email = 'instructor.futurecities@uwaterloo.ca';
  select user_id into v_mentor from users where email = 'mentor.lee@uwaterloo.ca';
  select user_id into v_partner from users where email = 'external.partner@uwaterloo.ca';

  select course_id into v_se490 from courses where upper(code) = 'SE 490';
  select course_id into v_mte481 from courses where upper(code) = 'MTE 481';
  select course_id into v_bme461 from courses where upper(code) = 'BME 461';
  select course_id into v_syde461 from courses where upper(code) = 'SYDE 461';
  select course_id into v_mthel398 from courses where upper(code) = 'MTHEL 398';
  select course_id into v_sci300 from courses where upper(code) = 'SCI 300';

  select department_id into v_dept_se from departments where name = 'Software Engineering';
  select department_id into v_dept_mte from departments where name = 'Mechatronics Engineering';
  select department_id into v_dept_bme from departments where name = 'Biomedical Engineering';
  select department_id into v_dept_syde from departments where name = 'Systems Design Engineering';
  select department_id into v_dept_math from departments where name = 'Mathematics';
  select department_id into v_dept_science from departments where name = 'Science';

  select partner_opportunity_id
    into v_partner_opportunity
  from partner_opportunities
  where title = 'Hospital Scheduling Optimizer'
  order by partner_opportunity_id
  limit 1;

  select user_id into v_leader from users where email = 'student.se.leader@uwaterloo.ca';
  select user_id into v_member from users where email = 'student.se.member@uwaterloo.ca';
  select user_id into v_explorer from users where email = 'student.se.explorer@uwaterloo.ca';
  select user_id into v_direct_leader from users where email = 'student.se.direct.leader@uwaterloo.ca';
  select user_id into v_direct_candidate from users where email = 'student.se.direct.candidate@uwaterloo.ca';
  select user_id into v_mixed_leader from users where email = 'student.se.mixed.leader@uwaterloo.ca';
  select user_id into v_unsupported from users where email = 'student.se.unsupported@uwaterloo.ca';
  select user_id into v_mte_commit from users where email = 'student.mte.commit@uwaterloo.ca';
  select user_id into v_mte_review from users where email = 'student.mte.review@uwaterloo.ca';
  select user_id into v_no_course from users where email = 'student.nocourse@uwaterloo.ca';
  select user_id into v_syde_final from users where email = 'student.syde.final@uwaterloo.ca';
  select user_id into v_se_complete from users where email = 'student.se.complete@uwaterloo.ca';
  select user_id into v_bme_partner from users where email = 'student.bme.partner@uwaterloo.ca';
  select user_id into v_futurecities from users where email = 'student.futurecities@uwaterloo.ca';

  -- Approved recruiting SE project with interest, a pending invite, and pending mentor support.
  insert into teams (status, course_fk)
  values ('forming', v_se490)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_leader, true, v_se490, v_admin, 'Demo leader for recruiting project.');
  update teams set leader_fk = v_leader where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, uw_resources, org_resources,
    success_criteria, validation_plan, stakeholders, risks_constraints,
    public_evaluation_acknowledged, ip_acknowledged, confidentiality_acknowledged,
    external_partner_support_confirmed, status, disciplines, skills, approval,
    team_fk, course_fk, submission_track, requested_course_fk
  )
  values (
    v_leader,
    'Campus Accessibility Navigator',
    'A student-originated SE project that helps students find accessible campus routes, entrances, and temporary obstruction updates.',
    'Fall 2026',
    'Campus accessibility information is fragmented across maps, service pages, and word of mouth.',
    'Prototype a route planning and reporting experience for accessibility-aware campus navigation.',
    'Interview users, identify core data fields, design a route/status prototype, and validate with representative scenarios.',
    'Working prototype, validation notes, risk register, and demo video.',
    'Weekly student team meeting plus monthly mentor check-in.',
    'Access to public campus map data and stakeholder interviews.',
    'Potential campus accessibility office feedback.',
    'Students can plan a route and understand uncertainty before traveling.',
    'Run scenario-based tests with at least five target users.',
    'Students with mobility needs, campus visitors, accessibility staff.',
    'Data freshness, incomplete building access data, privacy for reports.',
    true, true, true,
    false,
    'approved_recruiting',
    array['Software Engineering'],
    array['Accessibility', 'React', 'UX research'],
    true,
    v_team,
    v_se490,
    'home_course',
    v_se490
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;
  perform watmatch_claim_team_membership(v_team, v_member, false, v_se490, v_admin, 'Demo starting member.');

  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_se)
  on conflict do nothing;

  insert into capstone_course_approvals (capstone_fk, course_fk, status, decided_by_fk, decided_at, comments)
  values (v_cap, v_se490, 'approved', v_instructor_se, now() - interval '9 days', 'Seeded approved recruiting SE project.');

  insert into approvals (capstone_fk, instructor_fk, action, comments, created_at)
  values (v_cap, v_instructor_se, 'approved', 'Approved for recruiting in the marketplace.', now() - interval '9 days');

  insert into project_explorations (
    capstone_fk, team_fk, student_fk, status, source, priority_rank, message,
    created_by_fk, decided_by_fk, decided_at
  )
  values
    (v_cap, v_team, v_explorer, 'interested', 'student_marketplace', 1, 'Interested in accessibility-focused product work.', v_explorer, null, null),
    (v_cap, v_team, v_no_course, 'invited', 'team_invite', 2, 'Invited by the leader, but this student has no enrolled capstone course yet.', v_leader, null, null);
  insert into mentor_requests (
    capstone_fk, team_fk, mentor_fk, requested_by_fk, request_source, status, message
  )
  values (
    v_cap, v_team, v_mentor, v_leader, 'team_request', 'pending',
    'Could you advise us on scoping accessibility validation safely?'
  );

  -- Same-course commitment-ready project. Both sides have committed; leader can route directly to instructor review.
  insert into teams (status, course_fk)
  values ('forming', v_se490)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_direct_leader, true, v_se490, v_admin, 'Demo same-course leader.');
  update teams set leader_fk = v_direct_leader where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, external_partner_support_confirmed, status, disciplines,
    skills, approval, team_fk, course_fk, submission_track, requested_course_fk
  )
  values (
    v_direct_leader,
    'Peer Study Room Finder',
    'A same-course SE marketplace project where the final candidate is ready for leader confirmation.',
    'Fall 2026',
    'Students struggle to find quiet study rooms that match group size, time, and accessibility needs.',
    'Build a working discovery prototype and validate demand with SE students.',
    'Model availability, design search filters, and evaluate with realistic scheduling scenarios.',
    'Prototype, usability notes, and technical plan.',
    'Weekly',
    'A team can find an appropriate room with fewer failed searches.',
    'Run usability sessions with target students.',
    'Students booking rooms and study groups.',
    'Room data availability and integration limits.',
    true, true, true,
    false,
    'approved_recruiting',
    array['Software Engineering'],
    array['React', 'Scheduling', 'Accessibility testing'],
    true,
    v_team,
    v_se490,
    'home_course',
    v_se490
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;

  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_se)
  on conflict do nothing;

  insert into capstone_course_approvals (capstone_fk, course_fk, status, decided_by_fk, decided_at, comments)
  values (v_cap, v_se490, 'approved', v_instructor_se, now() - interval '7 days', 'Approved for marketplace commitment demo.');

  insert into approvals (capstone_fk, instructor_fk, action, comments, created_at)
  values (v_cap, v_instructor_se, 'approved', 'Approved for same-course commitment demo.', now() - interval '7 days');

  insert into project_explorations (
    capstone_fk, team_fk, student_fk, status, source, message, created_by_fk,
    decided_by_fk, decided_at, student_commitment_confirmed_at, student_commitment_confirmed_by_fk,
    team_commitment_confirmed_at, team_commitment_confirmed_by_fk
  )
  values (
    v_cap, v_team, v_direct_candidate, 'exploring', 'project_interest_acceptance',
    'Both the candidate and leader have committed; leader still needs to confirm the final roster.',
    v_direct_candidate, v_direct_leader, now() - interval '2 days',
    now() - interval '1 day', v_direct_candidate,
    now() - interval '12 hours', v_direct_leader
  );

  -- Mixed SE/MTE commitment routing queue.
  insert into teams (status, course_fk, commitment_roster_confirmed_at, commitment_roster_confirmed_by_fk, commitment_roster_note)
  values (
    'forming',
    v_se490,
    now() - interval '6 hours',
    v_mixed_leader,
    'Leader confirmed final roster; cross-course staff routing is pending.'
  )
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_mixed_leader, true, v_se490, v_admin, 'Demo mixed-course leader.');
  update teams set leader_fk = v_mixed_leader where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, external_partner_support_confirmed, status, disciplines,
    skills, approval, team_fk, course_fk, submission_track, requested_course_fk
  )
  values (
    v_mixed_leader,
    'Mixed-Course Sensor Platform',
    'A cross-course SE/MTE team with a pending staff routing decision.',
    'Fall 2026',
    'Small lab teams need a low-cost way to collect and visualize environmental sensor data.',
    'Prototype a hardware/software data collection platform and decide the coordinating course route.',
    'Build sensor ingestion proof of concept, dashboard mock, and integration plan.',
    'Prototype, architecture note, and routing decision record.',
    'Weekly',
    'Team has a viable sensor-to-dashboard path and clear course routing.',
    'Bench tests plus staff routing approval.',
    'Lab coordinators and student research teams.',
    'Hardware availability, course fit, and enrollment routing.',
    true, true, true,
    true,
    'approved_recruiting',
    array['Software Engineering', 'Mechatronics Engineering'],
    array['Embedded systems', 'Python', 'Data visualization'],
    true,
    v_team,
    v_se490,
    'interdisciplinary',
    v_se490
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;

  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_se), (v_cap, v_dept_mte)
  on conflict do nothing;

  insert into capstone_course_approvals (capstone_fk, course_fk, status, decided_by_fk, decided_at, comments)
  values (v_cap, v_se490, 'approved', v_instructor_se, now() - interval '6 days', 'Approved for mixed routing demo.');

  insert into approvals (capstone_fk, instructor_fk, action, comments, created_at)
  values (v_cap, v_instructor_se, 'approved', 'Approved before mixed enrollment routing.', now() - interval '6 days');

  insert into project_explorations (
    capstone_fk, team_fk, student_fk, status, source, message, created_by_fk,
    decided_by_fk, decided_at, student_commitment_confirmed_at, student_commitment_confirmed_by_fk,
    team_commitment_confirmed_at, team_commitment_confirmed_by_fk
  )
  values (
    v_cap, v_team, v_mte_commit, 'pending_commitment', 'student_marketplace',
    'MTE student is ready to join; staff must choose course enrollment route before official membership.',
    v_mte_commit, v_mixed_leader, now() - interval '1 day',
    now() - interval '18 hours', v_mte_commit,
    now() - interval '8 hours', v_mixed_leader
  )
  returning exploration_id into v_exploration;

  insert into project_commitment_requests (
    exploration_fk, capstone_fk, team_fk, student_fk, status, requested_by_fk,
    decision_route, target_course_fk, comments
  )
  values (
    v_exploration, v_cap, v_team, v_mte_commit, 'pending', v_mixed_leader,
    'interdisciplinary', v_mte481,
    'Demo queue item: choose coordinating course and enrollment route manually.'
  );

  -- Approved recruiting project that is deliberately missing required support.
  insert into teams (status, course_fk)
  values ('forming', v_se490)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_unsupported, true, v_se490, v_admin, 'Demo support blocker leader.');
  update teams set leader_fk = v_unsupported where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, external_partner_support_confirmed, status, disciplines,
    skills, approval, team_fk, course_fk, submission_track, requested_course_fk
  )
  values (
    v_unsupported,
    'Unsupported Finalization Blocker',
    'A deliberate unhappy-path project: approved and staffed, but missing mentor or partner support.',
    'Fall 2026',
    'Demo operators need a quick way to confirm finalization support blockers.',
    'Exercise the finalization guardrail for courses that require project support.',
    'Attempt finalization and verify the support-required error appears.',
    'Manual test case.',
    'Weekly',
    'The app blocks finalization until support is recorded.',
    'Manual attempt through the UI.',
    'Demo admins and instructors.',
    'This project should not finalize until support is added.',
    true, true, true,
    false,
    'approved_recruiting',
    array['Software Engineering'],
    array['Testing', 'Workflow QA'],
    true,
    v_team,
    v_se490,
    'home_course',
    v_se490
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;
  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_se)
  on conflict do nothing;
  insert into capstone_course_approvals (capstone_fk, course_fk, status, decided_by_fk, decided_at, comments)
  values (v_cap, v_se490, 'approved', v_instructor_se, now() - interval '5 days', 'Approved but deliberately missing support.');

  -- MTE project pending instructor review.
  insert into teams (status, course_fk)
  values ('forming', v_mte481)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_mte_review, true, v_mte481, v_admin, 'Demo MTE review leader.');
  update teams set leader_fk = v_mte_review where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, external_partner_support_confirmed, status, disciplines,
    skills, approval, team_fk, course_fk, submission_track, requested_course_fk
  )
  values (
    v_mte_review,
    'Clinical Flow Simulator',
    'A Mechatronics proposal awaiting instructor review.',
    'Fall 2026',
    'Clinic teams need a lightweight simulator for patient flow experiments.',
    'Model patient flow scenarios and identify useful simulation outputs.',
    'Build simple simulation logic, validate assumptions, and prepare instructor-scoped review material.',
    'Simulation prototype and design memo.',
    'Weekly',
    'Instructor can decide whether the project is scoped appropriately for MTE 481.',
    'Instructor review plus sample simulation run.',
    'Clinical coordinators and students.',
    'Simulation accuracy and project scope.',
    true, true, true,
    true,
    'pending_review',
    array['Mechatronics Engineering'],
    array['Simulation', 'Systems modeling'],
    false,
    v_team,
    v_mte481,
    'home_course',
    v_mte481
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;
  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_mte)
  on conflict do nothing;
  insert into capstone_course_approvals (capstone_fk, course_fk, status, comments)
  values (v_cap, v_mte481, 'pending', 'Awaiting MTE instructor review.');

  -- Interdisciplinary/Future Cities-style project pending admin course routing.
  insert into teams (status, course_fk)
  values ('forming', v_se490)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_futurecities, true, v_se490, v_admin, 'Demo interdisciplinary routing leader.');
  update teams set leader_fk = v_futurecities where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, external_partner_support_confirmed, status, disciplines,
    skills, approval, team_fk, course_fk, submission_track, requested_course_fk,
    course_routing_notes
  )
  values (
    v_futurecities,
    'Future Cities Stormwater Commons',
    'A Future Cities-style interdisciplinary project that needs staff to choose the coordinating transcript course.',
    'Fall 2026',
    'Municipal stormwater knowledge is hard to reuse across neighborhoods and disciplines.',
    'Prototype a shared evidence map for stormwater interventions.',
    'Gather sample cases, model a taxonomy, and prepare a route-ready project proposal.',
    'Evidence map prototype and routing notes.',
    'Weekly',
    'Staff can route the project cleanly to the coordinating course.',
    'Routing review and instructor acceptance.',
    'Planning students, engineering students, and community stakeholders.',
    'Course fit, term offering availability, and manual registrar update.',
    true, true, true,
    true,
    'pending_admin_course_routing',
    array['Mathematics', 'Science', 'Software Engineering'],
    array['Urban systems', 'Climate adaptation', 'Data storytelling'],
    false,
    v_team,
    v_se490,
    'interdisciplinary',
    v_mthel398,
    'Demo route: staff should decide whether MTHEL 398 or another active interdisciplinary course coordinates this project. Registrar/Quest update remains manual.'
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;
  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_math), (v_cap, v_dept_science), (v_cap, v_dept_se)
  on conflict do nothing;
  insert into course_reassignment_requests (
    student_fk, from_course_fk, to_course_fk, team_fk, capstone_fk, status,
    requested_by_fk, comments, request_type, request_source
  )
  values (
    v_futurecities, v_se490, v_mthel398, v_team, v_cap, 'pending',
    v_futurecities,
    'Demo route change request for interdisciplinary coordinating course. Enrollment coordinator must update Quest manually after approval.',
    'course_reassignment',
    'capstone_submission'
  );

  -- No-course submission enrollment request.
  perform watmatch_create_project_submission_enrollment_request(
    v_no_course,
    v_sci300,
    'Demo no-course student asks for SCI 300 submission enrollment. Staff must update registrar records manually if approved.'
  );

  -- External-partner opportunity plus BME proposal.
  insert into teams (status, course_fk)
  values ('forming', v_bme461)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_bme_partner, true, v_bme461, v_admin, 'Demo BME partner proposal leader.');
  update teams set leader_fk = v_bme_partner where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, organization_name, primary_contact, email, website,
    partner_opportunity_fk, external_partner_name, external_partner_organization,
    external_partner_email, external_partner_website, external_partner_notes,
    external_partner_support_confirmed, external_partner_support_confirmed_at,
    status, disciplines, skills, approval, team_fk, course_fk, submission_track,
    requested_course_fk
  )
  values (
    v_bme_partner,
    'Hospital Scheduling Optimizer - BME Proposal',
    'A BME team proposal derived from the published external partner opportunity.',
    'Fall 2026',
    'Hospital scheduling pressure is hard to inspect before it affects coordinator decisions.',
    'Build a workflow analysis and optimization prototype with the partner.',
    'Translate partner problem statement into BME design requirements, prototype scheduling insight views, and validate with scenario data.',
    'Prototype, BME design report, and partner handoff.',
    'Weekly partner check-ins',
    'Partner confirms the workflow assumptions and expected deliverables.',
    'Partner review and instructor review.',
    'Clinical coordinators and operational leads.',
    'Data access, clinical workflow complexity, and privacy.',
    true, true, true,
    'Waterloo Region Health Network',
    'Jamie Demo',
    'external.partner@uwaterloo.ca',
    'https://example.org/wrhn',
    v_partner_opportunity,
    'Jamie Demo',
    'Waterloo Region Health Network',
    'external.partner@uwaterloo.ca',
    'https://example.org/wrhn',
    'Partner explicitly confirmed support before student submission.',
    true,
    now() - interval '2 days',
    'pending_review',
    array['Biomedical Engineering'],
    array['Optimization', 'Workflow analysis', 'Health systems'],
    false,
    v_team,
    v_bme461,
    'home_course',
    v_bme461
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;
  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_bme)
  on conflict do nothing;
  insert into capstone_course_approvals (capstone_fk, course_fk, status, comments)
  values (v_cap, v_bme461, 'pending', 'Awaiting BME instructor review with partner support attached.');

  -- Finalized read-only project.
  insert into teams (status, course_fk)
  values ('forming', v_syde461)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_syde_final, true, v_syde461, v_admin, 'Demo finalized SYDE leader.');
  update teams set leader_fk = v_syde_final where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, external_partner_support_confirmed, status, disciplines,
    skills, approval, team_fk, course_fk, submission_track, requested_course_fk
  )
  values (
    v_syde_final,
    'Transit Equity Scenario Planner',
    'A finalized SYDE project for read-only team state and closeout demos.',
    'Fall 2026',
    'Transit service changes have uneven impacts across neighborhoods.',
    'Build a scenario planning prototype that compares service tradeoffs.',
    'Define equity metrics, prototype comparison views, and prepare a stakeholder-facing demo.',
    'Scenario prototype and design rationale.',
    'Weekly',
    'Stakeholders can compare at least three transit scenarios.',
    'Scenario walkthrough and heuristic review.',
    'Transit planners and riders.',
    'Data quality, interpretation, and policy sensitivity.',
    true, true, true,
    false,
    'approved_recruiting',
    array['Systems Design Engineering'],
    array['Systems design', 'Mobility', 'Data visualization'],
    true,
    v_team,
    v_syde461,
    'home_course',
    v_syde461
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;
  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_syde)
  on conflict do nothing;
  insert into capstone_course_approvals (capstone_fk, course_fk, status, decided_by_fk, decided_at, comments)
  values (v_cap, v_syde461, 'approved', v_instructor_syde, now() - interval '10 days', 'Approved before finalization.');
  insert into mentor_requests (
    capstone_fk, team_fk, mentor_fk, requested_by_fk, request_source, status,
    message, response_note, decided_by_fk, decided_at
  )
  values (
    v_cap, v_team, v_mentor, v_syde_final, 'team_request', 'accepted',
    'Can you mentor the scenario planning scope?',
    'Accepted for demo support.',
    v_mentor,
    now() - interval '8 days'
  );

  -- Flush queued link-status checks while this project is still approved_recruiting.
  -- Finalization changes capstone/team status in the same transaction.
  set constraints all immediate;
  set constraints all deferred;

  perform watmatch_finalize_team(v_team, v_instructor_syde, 'instructor', 'Demo seed finalizes the read-only SYDE project.');

  -- Completed project ready for native WatMatch past publication.
  insert into teams (status, course_fk)
  values ('forming', v_se490)
  returning team_id into v_team;

  perform watmatch_claim_team_membership(v_team, v_se_complete, true, v_se490, v_admin, 'Demo completed SE leader.');
  update teams set leader_fk = v_se_complete where team_id = v_team;

  insert into capstones (
    user_fk, title, description, project_start_date, problem_area, main_objectives,
    scope_of_work, deliverables, meeting_frequency, success_criteria, validation_plan,
    stakeholders, risks_constraints, public_evaluation_acknowledged, ip_acknowledged,
    confidentiality_acknowledged, organization_name, primary_contact, email,
    external_partner_name, external_partner_organization, external_partner_email,
    external_partner_support_confirmed, external_partner_support_confirmed_at,
    status, disciplines, skills, approval, team_fk, course_fk, submission_track,
    requested_course_fk
  )
  values (
    v_se_complete,
    'Clinic Intake Triage Dashboard',
    'A completed SE project used to demo native WatMatch past-project publishing.',
    'Fall 2026',
    'Clinic intake requests need clearer triage status and owner visibility.',
    'Build and validate a dashboard concept for intake queue triage.',
    'Prototype queue views, validate with scenarios, and prepare completion notes.',
    'Final prototype, validation summary, and publication-ready project record.',
    'Weekly',
    'Coordinator can identify urgent intake requests and ownership gaps.',
    'Scenario replay with partner feedback.',
    'Clinic coordinators and operations leads.',
    'Privacy and workflow adoption.',
    true, true, true,
    'Waterloo Region Health Network',
    'Jamie Demo',
    'external.partner@uwaterloo.ca',
    'Jamie Demo',
    'Waterloo Region Health Network',
    'external.partner@uwaterloo.ca',
    true,
    now() - interval '20 days',
    'approved_recruiting',
    array['Software Engineering'],
    array['Dashboards', 'Workflow analysis', 'APIs'],
    true,
    v_team,
    v_se490,
    'home_course',
    v_se490
  )
  returning capstone_id into v_cap;

  update teams set capstone_fk = v_cap where team_id = v_team;
  insert into capstone_departments (capstone_fk, department_fk)
  values (v_cap, v_dept_se)
  on conflict do nothing;
  insert into capstone_course_approvals (capstone_fk, course_fk, status, decided_by_fk, decided_at, comments)
  values (v_cap, v_se490, 'approved', v_instructor_se, now() - interval '18 days', 'Approved before completion.');

  -- Flush queued link-status checks while this project is still approved_recruiting.
  -- Finalization changes capstone/team status in the same transaction.
  set constraints all immediate;
  set constraints all deferred;

  perform watmatch_finalize_team(v_team, v_instructor_se, 'instructor', 'Demo seed finalizes the completed SE project.');
  perform watmatch_complete_capstone(v_cap, v_instructor_se, 'instructor', 'Demo seed marks this project complete for native past publication testing.', 'Fall 2026');

  update users u
  set active_team_fk = tm.team_fk
  from team_memberships tm
  where u.user_id = tm.user_fk;

  -- Validate the complete initial demo contract before committing. Any mismatch
  -- aborts the transaction so a failed seed never leaves a partial demo state.
  select count(*) into v_count from capstones;
  if v_count <> 9 then
    raise exception 'Demo seed invariant failed: expected 9 capstones, found %.', v_count;
  end if;

  select count(*) into v_count from teams;
  if v_count <> 9 then
    raise exception 'Demo seed invariant failed: expected 9 teams, found %.', v_count;
  end if;

  select count(*) into v_count from team_memberships;
  if v_count <> 10 then
    raise exception 'Demo seed invariant failed: expected 10 official memberships, found %.', v_count;
  end if;

  select count(*) into v_count from project_explorations;
  if v_count <> 4 then
    raise exception 'Demo seed invariant failed: expected 4 marketplace relationships, found %.', v_count;
  end if;

  select count(*) into v_count from partner_opportunities;
  if v_count <> 2 then
    raise exception 'Demo seed invariant failed: expected 2 partner opportunities, found %.', v_count;
  end if;

  if exists (
    select 1
    from teams t
    left join team_memberships tm
      on tm.team_fk = t.team_id
     and tm.user_fk = t.leader_fk
     and tm.is_leader is true
    where t.leader_fk is null
       or tm.user_fk is null
  ) then
    raise exception 'Demo seed invariant failed: every team leader must be an official leader membership.';
  end if;

  if exists (
    select 1
    from team_memberships tm
    group by tm.team_fk
    having count(*) filter (where tm.is_leader is true) <> 1
  ) then
    raise exception 'Demo seed invariant failed: every team must have exactly one leader membership.';
  end if;

  if exists (
    select 1
    from capstones c
    join teams t on t.team_id = c.team_fk
    where t.capstone_fk is distinct from c.capstone_id
       or t.course_fk is distinct from c.course_fk
  ) then
    raise exception 'Demo seed invariant failed: capstone/team links or coordinating courses are inconsistent.';
  end if;

  if exists (
    select 1
    from users u
    left join team_memberships tm on tm.user_fk = u.user_id
    where u.email in (
      'student.se.leader@uwaterloo.ca',
      'student.se.member@uwaterloo.ca',
      'student.se.explorer@uwaterloo.ca',
      'student.se.direct.leader@uwaterloo.ca',
      'student.se.direct.candidate@uwaterloo.ca',
      'student.se.mixed.leader@uwaterloo.ca',
      'student.se.unsupported@uwaterloo.ca',
      'student.mte.commit@uwaterloo.ca',
      'student.mte.review@uwaterloo.ca',
      'student.nocourse@uwaterloo.ca',
      'student.syde.final@uwaterloo.ca',
      'student.se.complete@uwaterloo.ca',
      'student.bme.partner@uwaterloo.ca',
      'student.futurecities@uwaterloo.ca'
    )
    group by u.user_id, u.active_team_fk
    having u.active_team_fk is distinct from max(tm.team_fk)
  ) then
    raise exception 'Demo seed invariant failed: users.active_team_fk must match official team membership.';
  end if;

  perform watmatch_assert_team_members_valid(t.team_id)
  from teams t;

  if not exists (
    select 1
    from capstones c
    join project_explorations pe on pe.capstone_fk = c.capstone_id
    join users u on u.user_id = pe.student_fk
    where c.title = 'Campus Accessibility Navigator'
      and u.email = 'student.se.explorer@uwaterloo.ca'
      and pe.status = 'interested'
      and pe.source = 'student_marketplace'
      and pe.student_commitment_confirmed_at is null
      and pe.team_commitment_confirmed_at is null
      and not exists (
        select 1 from team_memberships tm where tm.user_fk = u.user_id
      )
  ) then
    raise exception 'Demo seed invariant failed: Campus explorer must start as interested and unofficial.';
  end if;

  if not exists (
    select 1
    from capstones c
    join project_explorations pe on pe.capstone_fk = c.capstone_id
    join users u on u.user_id = pe.student_fk
    where c.title = 'Campus Accessibility Navigator'
      and u.email = 'student.nocourse@uwaterloo.ca'
      and pe.status = 'invited'
      and pe.source = 'team_invite'
      and pe.decided_by_fk is null
      and pe.decided_at is null
  ) then
    raise exception 'Demo seed invariant failed: Campus must include one unresolved team invite.';
  end if;

  if not exists (
    select 1
    from capstones c
    join mentor_requests mr on mr.capstone_fk = c.capstone_id
    join users u on u.user_id = mr.mentor_fk
    where c.title = 'Campus Accessibility Navigator'
      and u.email = 'mentor.lee@uwaterloo.ca'
      and mr.status = 'pending'
      and mr.decided_by_fk is null
      and mr.decided_at is null
  ) then
    raise exception 'Demo seed invariant failed: Campus mentor request must be pending.';
  end if;

  if not exists (
    select 1
    from capstones c
    join teams t on t.team_id = c.team_fk
    join project_explorations pe on pe.capstone_fk = c.capstone_id
    join users u on u.user_id = pe.student_fk
    where c.title = 'Peer Study Room Finder'
      and u.email = 'student.se.direct.candidate@uwaterloo.ca'
      and pe.status = 'exploring'
      and pe.source = 'project_interest_acceptance'
      and pe.student_commitment_confirmed_at is not null
      and pe.team_commitment_confirmed_at is not null
      and t.commitment_roster_confirmed_at is null
  ) then
    raise exception 'Demo seed invariant failed: same-course candidate must be mutually confirmed before roster submission.';
  end if;

  if not exists (
    select 1
    from capstones c
    join capstone_course_approvals cca on cca.capstone_fk = c.capstone_id
    where c.title = 'Clinical Flow Simulator'
      and c.status = 'pending_review'
      and c.approval is false
      and cca.status = 'pending'
  ) then
    raise exception 'Demo seed invariant failed: Clinical Flow Simulator must await instructor review.';
  end if;

  if not exists (
    select 1
    from capstones c
    join partner_opportunities po on po.partner_opportunity_id = c.partner_opportunity_fk
    where c.title = 'Hospital Scheduling Optimizer - BME Proposal'
      and c.status = 'pending_review'
      and c.external_partner_support_confirmed is true
      and po.title = 'Hospital Scheduling Optimizer'
      and po.status = 'published'
  ) then
    raise exception 'Demo seed invariant failed: BME proposal must retain published partner context and confirmed support.';
  end if;

  if not exists (
    select 1
    from capstones c
    where c.title = 'Unsupported Finalization Blocker'
      and coalesce((watmatch_capstone_support_summary(c.capstone_id) ->> 'requires_project_support')::boolean, false) is true
      and coalesce((watmatch_capstone_support_summary(c.capstone_id) ->> 'has_support')::boolean, false) is false
  ) then
    raise exception 'Demo seed invariant failed: finalization blocker must require and lack project support.';
  end if;

  if not exists (
    select 1
    from capstones c
    join teams t on t.team_id = c.team_fk
    where c.title = 'Transit Equity Scenario Planner'
      and c.status = 'approved'
      and c.approval is true
      and t.status = 'finalized'
  ) then
    raise exception 'Demo seed invariant failed: Transit Equity Scenario Planner must be finalized.';
  end if;

  if not exists (
    select 1
    from capstones c
    join teams t on t.team_id = c.team_fk
    where c.title = 'Clinic Intake Triage Dashboard'
      and c.status = 'complete'
      and c.approval is true
      and c.completed_at is not null
      and t.status = 'finalized'
  ) then
    raise exception 'Demo seed invariant failed: Clinic Intake Triage Dashboard must be complete.';
  end if;

  if exists (
    select 1
    from student_past_capstone_shortlists s
    join users u on u.user_id = s.student_fk
    where u.email = 'student.se.explorer@uwaterloo.ca'
  ) then
    raise exception 'Demo seed invariant failed: the explorer must start without saved past capstones.';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_admin,
    'admin',
    'demo_seed_loaded',
    'demo_seed',
    'Fall 2026',
    'Loaded deterministic demo data without writing protected catalog tables.',
    jsonb_build_object(
      'term', 'Fall 2026',
      'phase', 'exploration',
      'projects_seeded', 9,
      'note', 'Registrar/Quest updates remain manual outside WatMatch.'
    )
  );
end $$;

-- Compact sanity output for SQL consoles.
select
  'marketplace' as check_name,
  current_term || ' / ' || phase as value
from marketplace_settings
where setting_id = 1
union all
select
  'demo_users',
  count(*)::text
from users u
join (
  values
    ('admin@uwaterloo.ca'),
    ('advisor@uwaterloo.ca'),
    ('enrollment@uwaterloo.ca'),
    ('instructor.se@uwaterloo.ca'),
    ('instructor.se491@uwaterloo.ca'),
    ('instructor.mte@uwaterloo.ca'),
    ('instructor.bme@uwaterloo.ca'),
    ('instructor.syde@uwaterloo.ca'),
    ('instructor.futurecities@uwaterloo.ca'),
    ('instructor.interdisciplinary@uwaterloo.ca'),
    ('instructor.gene@uwaterloo.ca'),
    ('mentor.lee@uwaterloo.ca'),
    ('external.partner@uwaterloo.ca'),
    ('student.se.leader@uwaterloo.ca'),
    ('student.se.member@uwaterloo.ca'),
    ('student.se.explorer@uwaterloo.ca'),
    ('student.se.direct.leader@uwaterloo.ca'),
    ('student.se.direct.candidate@uwaterloo.ca'),
    ('student.se.mixed.leader@uwaterloo.ca'),
    ('student.se.unsupported@uwaterloo.ca'),
    ('student.mte.commit@uwaterloo.ca'),
    ('student.mte.review@uwaterloo.ca'),
    ('student.nocourse@uwaterloo.ca'),
    ('student.syde.final@uwaterloo.ca'),
    ('student.se.complete@uwaterloo.ca'),
    ('student.bme.partner@uwaterloo.ca'),
    ('student.futurecities@uwaterloo.ca')
) as seed(email) on seed.email = u.email
union all
select
  'capstones',
  count(*)::text
from capstones
union all
select
  'partner_opportunities',
  count(*)::text
from partner_opportunities
union all
select
  'pending_commitment_requests',
  count(*)::text
from project_commitment_requests
where status = 'pending'
union all
select
  'pending_course_requests',
  count(*)::text
from course_reassignment_requests
where status = 'pending';

commit;
