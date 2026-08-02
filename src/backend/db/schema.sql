-- Courses
create table if not exists courses (
  course_id    bigint generated always as identity primary key,
  code         text not null,          -- e.g. 'SE 390'
  name         text not null,          -- e.g. 'Design Project Planning'
  active       boolean default false,
  active_terms text[] not null default '{}',
  activation_mode text not null default 'auto',
  department_fk bigint,
  ecosystem_fk bigint,
  routing_kind text not null default 'standard',
  retired_for_routing boolean not null default false,
  marketplace_phase_override text,
  marketplace_phase_override_reason text,
  marketplace_phase_override_updated_by_fk bigint,
  marketplace_phase_override_updated_at timestamp with time zone,
  requires_project_support boolean not null default true,
  created_at   timestamp with time zone default now()
);

-- Faculties
create table if not exists faculties (
  faculty_id bigint generated always as identity primary key,
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Departments
create table if not exists departments (
  department_id bigint generated always as identity primary key,
  name          text not null unique,
  faculty_fk    bigint references faculties(faculty_id) on delete set null,
  active        boolean not null default true,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

create table if not exists project_ecosystems (
  ecosystem_id bigint generated always as identity primary key,
  name         text not null unique,
  description  text,
  active       boolean not null default true,
  marketplace_phase_override text,
  marketplace_phase_override_reason text,
  marketplace_phase_override_updated_by_fk bigint,
  marketplace_phase_override_updated_at timestamp with time zone,
  created_at   timestamp with time zone default now(),
  updated_at   timestamp with time zone default now()
);

-- Managed skill presets. Capstones and student profiles keep storing skills as
-- text arrays so custom skills remain possible without forcing global records.
create table if not exists skills (
  skill_id      bigint generated always as identity primary key,
  name          text not null unique,
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- Users
create table if not exists users (
  user_id      bigint generated always as identity primary key,
  email        text not null unique,
  role         text not null,           -- "student" | "instructor" | "admin" | "academic_advisor" | "enrollment_operator" | "external_partner" | "mentor"
  course_fk    bigint references courses(course_id) on delete set null,
  home_department_fk bigint references departments(department_id) on delete set null,
  active_team_fk bigint,
  active       boolean not null default true,
  refresh_token text,
  created_at   timestamp with time zone default now()
);

-- External Partner Profiles
create table if not exists partner_profiles (
  partner_user_fk bigint primary key references users(user_id) on delete cascade,
  display_name    text not null,
  organization    text not null,
  contact_email   text not null,
  website         text,
  bio             text,
  areas           text[] not null default '{}',
  created_at      timestamp with time zone default now(),
  updated_at      timestamp with time zone default now()
);

-- External Partner Opportunity Postings
create table if not exists partner_opportunities (
  partner_opportunity_id bigint generated always as identity primary key,
  partner_user_fk        bigint not null references users(user_id) on delete cascade,
  title                  text not null,
  organization           text not null,
  description            text not null,
  primary_contact        text,
  phone                  text,
  how_heard_about_capstone text,
  organization_description text,
  organization_size      text,
  project_start_date     text,
  problem_area           text,
  main_objectives        text,
  scope_of_work          text,
  deliverable_types      text[] not null default '{}',
  deliverables           text,
  meeting_frequency      text,
  resources_needed       text,
  disciplines            text[] not null default '{}',
  skills                 text[] not null default '{}',
  target_course_tags     text[] not null default '{}',
  preferred_team_size    text,
  max_active_teams       integer,
  contact_email          text not null,
  contact_url            text,
  ip_acknowledged        boolean not null default false,
  nda_acknowledged       boolean not null default false,
  matching_acknowledged  boolean not null default false,
  status                 text not null default 'draft',
  archived_at            timestamp with time zone,
  created_at             timestamp with time zone default now(),
  updated_at             timestamp with time zone default now()
);

create table if not exists partner_opportunity_courses (
  partner_opportunity_fk bigint not null references partner_opportunities(partner_opportunity_id) on delete cascade,
  course_fk              bigint not null references courses(course_id) on delete cascade,
  created_at             timestamp with time zone default now(),
  primary key (partner_opportunity_fk, course_fk)
);

create table if not exists course_pipeline_edges (
  course_pipeline_edge_id bigint generated always as identity primary key,
  from_course_fk bigint not null references courses(course_id) on delete cascade,
  to_course_fk bigint not null references courses(course_id) on delete cascade,
  active boolean not null default true,
  is_default boolean not null default false,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (from_course_fk, to_course_fk)
);

create table if not exists course_offerings (
  course_offering_id bigint generated always as identity primary key,
  course_fk bigint not null references courses(course_id) on delete cascade,
  term text not null,
  title_override text,
  description text,
  topic text,
  section_label text,
  status text not null default 'draft',
  routing_kind_override text,
  ecosystem_fk bigint references project_ecosystems(ecosystem_id) on delete set null,
  requires_project_support boolean,
  student_registration_notes text,
  admin_routing_notes text,
  source_url text,
  created_by_fk bigint references users(user_id) on delete set null,
  updated_by_fk bigint references users(user_id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists course_offering_held_with (
  course_offering_fk bigint not null references course_offerings(course_offering_id) on delete cascade,
  held_with_course_fk bigint not null references courses(course_id) on delete cascade,
  held_with_offering_fk bigint references course_offerings(course_offering_id) on delete set null,
  notes text,
  created_at timestamp with time zone default now(),
  primary key (course_offering_fk, held_with_course_fk)
);

drop table if exists course_offering_pipeline_edges cascade;

-- Capstones
create table if not exists capstones (
  capstone_id  bigint generated always as identity primary key,
  user_fk      bigint references users(user_id) on delete set null,
  title        text not null,
  description  text,
  project_start_date text,
  problem_area  text,
  main_objectives text,
  scope_of_work text,
  deliverables text,
  meeting_frequency text default 'weekly',
  uw_resources text,
  org_resources text,
  other_resources text,
  how_heard_about_capstone text,
  deliverable_types text[] default '{}',
  proposed_team_members text,
  success_criteria text,
  validation_plan text,
  stakeholders text,
  risks_constraints text,
  public_evaluation_acknowledged boolean not null default false,
  ip_acknowledged boolean not null default false,
  confidentiality_acknowledged boolean not null default false,
  organization_name text,
  primary_contact text,
  email text,
  phone text,
  website text,
  organization_description text,
  organization_size text,
  sector text,
  partner_opportunity_fk bigint references partner_opportunities(partner_opportunity_id) on delete set null,
  partner_opportunity_snapshot jsonb,
  external_partner_name text,
  external_partner_organization text,
  external_partner_email text,
  external_partner_website text,
  external_partner_notes text,
  external_partner_support_confirmed boolean not null default false,
  external_partner_support_confirmed_at timestamp with time zone,
  status       text not null default 'pending_review',
  disciplines  text[] default '{}',
  skills       text[] default '{}',
  approval     boolean default false,
  team_fk      bigint,                  -- if tied to a team later
  course_fk    bigint references courses(course_id) on delete set null,
  ecosystem_fk bigint references project_ecosystems(ecosystem_id) on delete set null,
  submission_track text not null default 'home_course',
  requested_course_fk bigint references courses(course_id) on delete set null,
  course_routed_by_fk bigint references users(user_id) on delete set null,
  course_routed_at timestamp with time zone,
  course_routing_notes text,
  closeout_decision text,
  closeout_decided_by_fk bigint references users(user_id) on delete set null,
  closeout_decided_at timestamp with time zone,
  closeout_applied_at timestamp with time zone,
  closeout_notes text,
  continued_to_course_fk bigint references courses(course_id) on delete set null,
  continued_to_term text,
  continued_member_enrollment_routes jsonb not null default '{}'::jsonb,
  completed_at timestamp with time zone,
  completed_by_fk bigint references users(user_id) on delete set null,
  completed_term text,
  completion_notes text,
  carry_over_read_only boolean not null default false,
  archived     boolean default false,
  archived_at  timestamp with time zone,
  archived_reason text,
  created_at   timestamp with time zone default now(),
  updated_at   timestamp with time zone default now()
);

create table if not exists capstone_departments (
  capstone_fk   bigint not null references capstones(capstone_id) on delete cascade,
  department_fk bigint not null references departments(department_id) on delete cascade,
  created_at    timestamp with time zone default now(),
  primary key (capstone_fk, department_fk)
);

-- Teams
create table if not exists teams (
  team_id      bigint generated always as identity primary key,
  leader_fk    bigint references users(user_id) on delete set null,
  capstone_fk  bigint references capstones(capstone_id) on delete set null,
  status       text default 'forming',
  course_fk    bigint references courses(course_id) on delete set null,
  ecosystem_fk bigint references project_ecosystems(ecosystem_id) on delete set null,
  commitment_roster_confirmed_at timestamp with time zone,
  commitment_roster_confirmed_by_fk bigint references users(user_id) on delete set null,
  commitment_roster_note text,
  created_at   timestamp with time zone default now()
);

alter table teams
  add column if not exists commitment_roster_confirmed_at timestamp with time zone,
  add column if not exists commitment_roster_confirmed_by_fk bigint references users(user_id) on delete set null,
  add column if not exists commitment_roster_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_active_team_fk_fkey'
  ) then
    alter table users
      add constraint users_active_team_fk_fkey
      foreign key (active_team_fk) references teams(team_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'capstones_team_fk_fkey'
  ) then
    alter table capstones
      add constraint capstones_team_fk_fkey
      foreign key (team_fk) references teams(team_id) on delete set null;
  end if;
end $$;

-- Completed Capstones
create table if not exists past_capstones (
  past_capstone_id  bigint generated always as identity primary key,
  title             text not null,
  description       text,
  department        text[] not null default '{}',
  year              text not null,
  students          text[] not null default '{}',   -- array of names (not user IDs)
  source_fk         bigint references courses(course_id) on delete set null, -- optional link
  created_at        timestamp default now()
);

create table if not exists past_watmatch_capstones (
  past_watmatch_capstone_id bigint generated always as identity primary key,
  source_capstone_fk bigint unique references capstones(capstone_id) on delete set null,
  source_team_fk bigint references teams(team_id) on delete set null,
  title text not null,
  description text,
  department text[] not null default '{}',
  year text not null,
  students text[] not null default '{}',
  source_fk bigint references courses(course_id) on delete set null,
  completed_term text,
  project_start_date text,
  problem_area text,
  main_objectives text,
  scope_of_work text,
  deliverables text,
  deliverable_types text[] not null default '{}',
  skills text[] not null default '{}',
  mentor_name text,
  external_partner_name text,
  external_partner_organization text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp default now()
);

create table if not exists student_past_capstone_shortlists (
  shortlist_id bigint generated always as identity primary key,
  student_fk bigint not null references users(user_id) on delete cascade,
  past_capstone_fk bigint references past_capstones(past_capstone_id) on delete cascade,
  past_watmatch_capstone_fk bigint references past_watmatch_capstones(past_watmatch_capstone_id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table student_past_capstone_shortlists
  add column if not exists updated_at timestamp with time zone default now();

alter table student_past_capstone_shortlists
  drop constraint if exists student_past_capstone_shortlists_one_source_check;

alter table student_past_capstone_shortlists
  add constraint student_past_capstone_shortlists_one_source_check
  check (
    (past_capstone_fk is not null and past_watmatch_capstone_fk is null)
    or (past_capstone_fk is null and past_watmatch_capstone_fk is not null)
  );

-- Compatibility columns for existing databases. These must appear before any
-- indexes, constraints, or functions that reference closeout/completion state.
alter table capstones
  add column if not exists course_routed_by_fk bigint references users(user_id) on delete set null,
  add column if not exists course_routed_at timestamp with time zone,
  add column if not exists course_routing_notes text,
  add column if not exists closeout_decision text,
  add column if not exists closeout_decided_by_fk bigint references users(user_id) on delete set null,
  add column if not exists closeout_decided_at timestamp with time zone,
  add column if not exists closeout_applied_at timestamp with time zone,
  add column if not exists closeout_notes text,
  add column if not exists continued_to_course_fk bigint references courses(course_id) on delete set null,
  add column if not exists continued_to_term text,
  add column if not exists continued_member_enrollment_routes jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamp with time zone,
  add column if not exists completed_by_fk bigint references users(user_id) on delete set null,
  add column if not exists completed_term text,
  add column if not exists completion_notes text,
  add column if not exists published_past_capstone_fk bigint references past_capstones(past_capstone_id) on delete set null,
  add column if not exists published_watmatch_past_capstone_fk bigint references past_watmatch_capstones(past_watmatch_capstone_id) on delete set null,
  add column if not exists carry_over_read_only boolean not null default false;

create table if not exists mentor_requests (
  mentor_request_id bigint generated always as identity primary key,
  capstone_fk       bigint not null references capstones(capstone_id) on delete cascade,
  team_fk           bigint not null references teams(team_id) on delete cascade,
  mentor_fk         bigint not null references users(user_id) on delete cascade,
  requested_by_fk   bigint references users(user_id) on delete set null,
  request_source    text not null default 'team_request',
  status            text not null default 'pending',
  message           text,
  response_note     text,
  decided_by_fk     bigint references users(user_id) on delete set null,
  decided_at        timestamp with time zone,
  created_at        timestamp with time zone default now(),
  updated_at        timestamp with time zone default now()
);

create table if not exists mentor_profiles (
  mentor_fk bigint primary key references users(user_id) on delete cascade,
  display_name text,
  primary_department_fk bigint references departments(department_id) on delete set null,
  affiliation text,
  bio text,
  availability_terms text[] not null default '{}',
  expertise_tags text[] not null default '{}',
  max_active_projects integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists mentor_profile_departments (
  mentor_fk bigint not null references mentor_profiles(mentor_fk) on delete cascade,
  department_fk bigint not null references departments(department_id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (mentor_fk, department_fk)
);

create or replace function watmatch_parse_past_departments(p_department text)
returns text[]
language sql
immutable
as $$
  with raw as (
    select
      case
        when nullif(btrim(coalesce(p_department, '')), '') is null then ''
        when btrim(p_department) like '{%}' then trim(both '{}' from btrim(p_department))
        else p_department
      end as value
  )
  select coalesce(
    array_agg(distinct cleaned order by cleaned),
    '{}'::text[]
  )
  from (
    select
      nullif(
        btrim(
          replace(
            replace(value, '"', ''),
            '  ',
            ' '
          )
        ),
        ''
      ) as cleaned
    from regexp_split_to_table(
      (select value from raw),
      ','
    ) as parts(value)
  ) normalized
  where cleaned is not null;
$$;

do $$
declare
  v_department_type text;
begin
  select udt_name
    into v_department_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'past_capstones'
    and column_name = 'department';

  if v_department_type = 'text' then
    execute 'alter table past_capstones alter column department drop default';
    execute 'alter table past_capstones alter column department type text[] using watmatch_parse_past_departments(department)';
    execute 'alter table past_capstones alter column department set default ''{}''::text[]';
  elsif v_department_type is not null and v_department_type <> '_text' then
    execute 'alter table past_capstones alter column department drop default';
    execute 'alter table past_capstones alter column department type text[] using watmatch_parse_past_departments(department::text)';
    execute 'alter table past_capstones alter column department set default ''{}''::text[]';
  end if;

  update past_capstones
  set department = array['Unknown Department']
  where department is null or cardinality(department) = 0;

  alter table past_capstones alter column department set not null;
  alter table past_capstones alter column department set default '{}'::text[];
end $$;

create table if not exists student_profile (
  student_fk   bigint primary key references users(user_id) on delete cascade,
  headline     text,
  about_me     text,
  skills       text[] default '{}',
  preferred_roles text[] default '{}',
  project_interests text[] default '{}',
  availability text,
  portfolio_url text,
  linkedin_url text,
  github_url text,
  profile_visibility text not null default 'team_network',
  updated_at   timestamp with time zone default now()
);

create table if not exists student_profile_departments (
  student_fk    bigint not null references student_profile(student_fk) on delete cascade,
  department_fk bigint not null references departments(department_id) on delete cascade,
  created_at    timestamp with time zone default now(),
  primary key (student_fk, department_fk)
);

create table if not exists approvals (
  approval_id      bigint generated always as identity primary key,
  capstone_fk      bigint not null references capstones(capstone_id) on delete cascade,
  instructor_fk    bigint references users(user_id) on delete set null,
  action           text not null, -- approved | rejected | changes_requested
  comments         text,
  created_at       timestamp with time zone default now()
);

create table if not exists capstone_course_approvals (
  capstone_fk      bigint not null references capstones(capstone_id) on delete cascade,
  course_fk        bigint not null references courses(course_id) on delete cascade,
  status           text not null default 'pending', -- pending | approved | rejected
  decided_by_fk    bigint references users(user_id) on delete set null,
  decided_at       timestamp with time zone,
  comments         text,
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now(),
  primary key (capstone_fk, course_fk)
);

create table if not exists course_reassignment_requests (
  request_id       bigint generated always as identity primary key,
  student_fk       bigint not null references users(user_id) on delete cascade,
  from_course_fk   bigint references courses(course_id) on delete set null,
  to_course_fk     bigint not null references courses(course_id) on delete cascade,
  team_fk          bigint references teams(team_id) on delete cascade,
  capstone_fk      bigint references capstones(capstone_id) on delete cascade,
  status           text not null default 'pending',
  requested_by_fk  bigint references users(user_id) on delete set null,
  decided_by_fk    bigint references users(user_id) on delete set null,
  decided_at       timestamp with time zone,
  comments         text,
  created_at       timestamp with time zone default now(),
  updated_at       timestamp with time zone default now()
);

create table if not exists audit_log (
  audit_id         bigint generated always as identity primary key,
  actor_fk         bigint references users(user_id) on delete set null,
  actor_role       text,
  action           text not null,
  entity_type      text not null,
  entity_id        text not null,
  reason           text,
  metadata         jsonb default '{}'::jsonb,
  created_at       timestamp with time zone default now()
);

create table if not exists team_memberships (
  user_fk          bigint primary key references users(user_id) on delete cascade,
  team_fk          bigint not null references teams(team_id) on delete cascade,
  enrollment_course_fk bigint references courses(course_id) on delete set null,
  enrollment_routed_by_fk bigint references users(user_id) on delete set null,
  enrollment_routed_at timestamp with time zone,
  enrollment_notes text,
  is_leader        boolean not null default false,
  created_at       timestamp with time zone default now()
);

-- RLS is enabled for all app tables. The frontend never calls Supabase directly;
-- FastAPI is the only application caller and must use SUPABASE_SERVICE_ROLE_KEY.
-- No anon/authenticated policies are created here on purpose.
alter table courses enable row level security;
alter table faculties enable row level security;
alter table departments enable row level security;
alter table project_ecosystems enable row level security;
alter table skills enable row level security;
alter table users enable row level security;
alter table capstones enable row level security;
alter table capstone_departments enable row level security;
alter table course_reassignment_requests enable row level security;
alter table teams enable row level security;
alter table past_capstones enable row level security;
alter table past_watmatch_capstones enable row level security;
alter table student_past_capstone_shortlists enable row level security;
alter table partner_profiles enable row level security;
alter table partner_opportunities enable row level security;
alter table partner_opportunity_courses enable row level security;
alter table mentor_requests enable row level security;
alter table mentor_profiles enable row level security;
alter table mentor_profile_departments enable row level security;
alter table student_profile enable row level security;
alter table student_profile_departments enable row level security;
alter table approvals enable row level security;
alter table capstone_course_approvals enable row level security;
alter table audit_log enable row level security;
alter table team_memberships enable row level security;
alter table course_pipeline_edges enable row level security;
alter table course_offerings enable row level security;
alter table course_offering_held_with enable row level security;

update team_memberships
set is_leader = false
where is_leader is null;

alter table team_memberships alter column is_leader set default false;
alter table team_memberships alter column is_leader set not null;

alter table users add column if not exists active boolean default true;
alter table users add column if not exists home_department_fk bigint references departments(department_id) on delete set null;
alter table users add column if not exists updated_at timestamp with time zone default now();
update users set active = true where active is null;
alter table users alter column active set default true;
alter table users alter column active set not null;

alter table departments add column if not exists active boolean not null default true;
alter table departments add column if not exists updated_at timestamp with time zone default now();
alter table departments add column if not exists faculty_fk bigint;
alter table project_ecosystems add column if not exists description text;
alter table project_ecosystems add column if not exists active boolean not null default true;
alter table project_ecosystems add column if not exists marketplace_phase_override text;
alter table project_ecosystems add column if not exists marketplace_phase_override_reason text;
alter table project_ecosystems add column if not exists marketplace_phase_override_updated_by_fk bigint;
alter table project_ecosystems add column if not exists marketplace_phase_override_updated_at timestamp with time zone;
alter table project_ecosystems add column if not exists updated_at timestamp with time zone default now();
alter table skills add column if not exists updated_at timestamp with time zone default now();
alter table skills drop column if exists active;
do $$
begin
  execute format('drop index if exists %I', 'idx_courses_active_' || 'ica' || 'pstone');
end $$;
do $$
begin
  execute format('alter table courses drop column if exists %I', 'is' || '_' || 'ica' || 'pstone');
end $$;
alter table courses add column if not exists requires_project_support boolean not null default true;
alter table courses add column if not exists active_terms text[] not null default '{}';
alter table courses add column if not exists activation_mode text not null default 'auto';
alter table courses add column if not exists department_fk bigint;
alter table courses add column if not exists ecosystem_fk bigint;
alter table courses add column if not exists routing_kind text not null default 'standard';
alter table courses add column if not exists retired_for_routing boolean not null default false;
alter table courses add column if not exists marketplace_phase_override text;
alter table courses add column if not exists marketplace_phase_override_reason text;
alter table courses add column if not exists marketplace_phase_override_updated_by_fk bigint;
alter table courses add column if not exists marketplace_phase_override_updated_at timestamp with time zone;
alter table teams add column if not exists ecosystem_fk bigint;
alter table team_memberships add column if not exists enrollment_course_fk bigint;
alter table team_memberships add column if not exists enrollment_routed_by_fk bigint;
alter table team_memberships add column if not exists enrollment_routed_at timestamp with time zone;
alter table team_memberships add column if not exists enrollment_notes text;
alter table course_offerings add column if not exists title_override text;
alter table course_offerings add column if not exists description text;
alter table course_offerings add column if not exists topic text;
alter table course_offerings add column if not exists section_label text;
alter table course_offerings add column if not exists status text not null default 'draft';
alter table course_offerings add column if not exists routing_kind_override text;
alter table course_offerings add column if not exists ecosystem_fk bigint references project_ecosystems(ecosystem_id) on delete set null;
alter table course_offerings add column if not exists requires_project_support boolean;
alter table course_offerings add column if not exists student_registration_notes text;
alter table course_offerings add column if not exists admin_routing_notes text;
alter table course_offerings add column if not exists source_url text;
alter table course_offerings add column if not exists created_by_fk bigint references users(user_id) on delete set null;
alter table course_offerings add column if not exists updated_by_fk bigint references users(user_id) on delete set null;
alter table course_offerings add column if not exists created_at timestamp with time zone default now();
alter table course_offerings add column if not exists updated_at timestamp with time zone default now();
alter table mentor_profiles add column if not exists display_name text;
alter table mentor_profiles add column if not exists primary_department_fk bigint references departments(department_id) on delete set null;
alter table mentor_profiles add column if not exists affiliation text;
alter table mentor_profiles add column if not exists bio text;
alter table mentor_profiles add column if not exists availability_terms text[] not null default '{}';
alter table mentor_profiles add column if not exists expertise_tags text[] not null default '{}';
alter table mentor_profiles add column if not exists max_active_projects integer;
alter table mentor_profiles add column if not exists created_at timestamp with time zone default now();
alter table mentor_profiles add column if not exists updated_at timestamp with time zone default now();

-- Create course indexes before adding course FK constraints or mutating course
-- rows below. Supabase/Postgres can reject CREATE INDEX on courses when earlier
-- FK work in the same SQL editor transaction has pending trigger events.
alter table courses drop constraint if exists courses_code_key;
drop index if exists idx_courses_code_unique;
drop index if exists idx_courses_code_term_unique;
create unique index if not exists idx_courses_code_unique
  on courses(upper(code));

create index if not exists idx_courses_department_fk
  on courses(department_fk);

create index if not exists idx_courses_ecosystem_fk
  on courses(ecosystem_fk);

create index if not exists idx_courses_active_routing_kind
  on courses(active, routing_kind);

create unique index if not exists idx_faculties_name_unique
  on faculties(lower(name));

create index if not exists idx_faculties_active_name
  on faculties(active, lower(name));

create unique index if not exists idx_project_ecosystems_name_unique
  on project_ecosystems(lower(name));

create index if not exists idx_project_ecosystems_active_name
  on project_ecosystems(active, lower(name));

create index if not exists idx_departments_faculty_fk
  on departments(faculty_fk);

create unique index if not exists idx_departments_name_unique
  on departments(lower(name));

create index if not exists idx_departments_active_name
  on departments(active, lower(name));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'departments_faculty_fk_fkey'
  ) then
    alter table departments
      add constraint departments_faculty_fk_fkey
      foreign key (faculty_fk) references faculties(faculty_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_department_fk_fkey'
  ) then
    alter table courses
      add constraint courses_department_fk_fkey
      foreign key (department_fk) references departments(department_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_ecosystem_fk_fkey'
  ) then
    alter table courses
      add constraint courses_ecosystem_fk_fkey
      foreign key (ecosystem_fk) references project_ecosystems(ecosystem_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'courses_marketplace_phase_override_updated_by_fk_fkey'
  ) then
    alter table courses
      add constraint courses_marketplace_phase_override_updated_by_fk_fkey
      foreign key (marketplace_phase_override_updated_by_fk) references users(user_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_ecosystems_marketplace_phase_override_updated_by_fk_fkey'
  ) then
    alter table project_ecosystems
      add constraint project_ecosystems_marketplace_phase_override_updated_by_fk_fkey
      foreign key (marketplace_phase_override_updated_by_fk) references users(user_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teams_ecosystem_fk_fkey'
  ) then
    alter table teams
      add constraint teams_ecosystem_fk_fkey
      foreign key (ecosystem_fk) references project_ecosystems(ecosystem_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_memberships_enrollment_course_fk_fkey'
  ) then
    alter table team_memberships
      add constraint team_memberships_enrollment_course_fk_fkey
      foreign key (enrollment_course_fk) references courses(course_id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_memberships_enrollment_routed_by_fk_fkey'
  ) then
    alter table team_memberships
      add constraint team_memberships_enrollment_routed_by_fk_fkey
      foreign key (enrollment_routed_by_fk) references users(user_id) on delete set null;
  end if;
end $$;

alter table courses drop constraint if exists courses_active_terms_check;
alter table courses
  add constraint courses_active_terms_check
  check (
    active_terms is not null
    and coalesce(cardinality(active_terms), 0) <= 3
    and active_terms <@ array['Winter', 'Spring', 'Fall']::text[]
  );

alter table courses drop constraint if exists courses_activation_mode_check;
alter table courses
  add constraint courses_activation_mode_check
  check (activation_mode in ('auto', 'force_active', 'force_inactive'));

alter table courses drop constraint if exists courses_routing_kind_check;
alter table courses
  add constraint courses_routing_kind_check
  check (routing_kind in ('standard', 'interdisciplinary'));

alter table courses drop constraint if exists courses_marketplace_phase_override_check;
alter table courses
  add constraint courses_marketplace_phase_override_check
  check (marketplace_phase_override is null or marketplace_phase_override in ('exploration', 'commitment', 'finalization'));

alter table courses drop constraint if exists courses_standard_phase_override_check;
alter table courses
  add constraint courses_standard_phase_override_check
  check (
    marketplace_phase_override is null
    or coalesce(routing_kind, 'standard') = 'standard'
  );

alter table course_offerings drop constraint if exists course_offerings_term_check;
alter table course_offerings
  add constraint course_offerings_term_check
  check (term ~ '^(Winter|Spring|Fall) [0-9]{4}$');

alter table course_offerings drop constraint if exists course_offerings_status_check;
alter table course_offerings
  add constraint course_offerings_status_check
  check (status in ('draft', 'active', 'inactive', 'archived'));

alter table course_offerings drop constraint if exists course_offerings_routing_kind_override_check;
alter table course_offerings
  add constraint course_offerings_routing_kind_override_check
  check (routing_kind_override is null or routing_kind_override in ('standard', 'interdisciplinary'));

create unique index if not exists idx_course_offerings_course_term_section_unique
  on course_offerings(course_fk, term, coalesce(section_label, ''));

create index if not exists idx_course_offerings_term_status
  on course_offerings(term, status, course_fk);

create index if not exists idx_course_offerings_ecosystem_fk
  on course_offerings(ecosystem_fk);

create index if not exists idx_course_offering_held_with_course
  on course_offering_held_with(held_with_course_fk);

alter table project_ecosystems drop constraint if exists project_ecosystems_marketplace_phase_override_check;
alter table project_ecosystems
  add constraint project_ecosystems_marketplace_phase_override_check
  check (marketplace_phase_override is null or marketplace_phase_override in ('exploration', 'commitment', 'finalization'));
alter table student_profile add column if not exists headline text;
alter table student_profile add column if not exists preferred_roles text[] default '{}';
alter table student_profile add column if not exists project_interests text[] default '{}';
alter table student_profile add column if not exists availability text;
alter table student_profile add column if not exists portfolio_url text;
alter table student_profile add column if not exists linkedin_url text;
alter table student_profile add column if not exists github_url text;
alter table student_profile add column if not exists profile_visibility text not null default 'team_network';

insert into faculties (name, active)
values
  ('Arts', true),
  ('Engineering', true),
  ('Environment', true),
  ('Health', true),
  ('Mathematics', true),
  ('Science', true),
  ('Cross-Faculty', true)
on conflict (name) do update
set active = excluded.active,
    updated_at = now();

insert into project_ecosystems (name, description, active)
values
  ('Departmental', 'Standard departmental capstone or design project route.', true),
  ('GENE', 'General Engineering interdisciplinary project route.', true),
  ('i-Capstone', 'Waterloo i-Capstone interdisciplinary project route.', true),
  ('Future Cities', 'Future Cities / cross-faculty urban systems project route.', true),
  ('AI + Health', 'Cross-faculty AI and health project route.', true),
  ('Other Interdisciplinary', 'Other interdisciplinary capstone route.', true)
on conflict (name) do update
set description = excluded.description,
    active = excluded.active,
    updated_at = now();

with seeded_departments (name, active, faculty_name) as (
  values
    ('Architectural Engineering', true, 'Engineering'),
    ('Electrical and Computer Engineering', true, 'Engineering'),
    ('Mechanical Engineering', true, 'Engineering'),
    ('Mechatronics Engineering', true, 'Engineering'),
    ('Chemical Engineering', true, 'Engineering'),
    ('Civil Engineering', true, 'Engineering'),
    ('Environmental Engineering', true, 'Engineering'),
    ('Geological Engineering', true, 'Engineering'),
    ('Civil, Environmental, and Geological Engineering', true, 'Engineering'),
    ('Nanotechnology Engineering', true, 'Engineering'),
    ('Software Engineering', true, 'Engineering'),
    ('Systems Design Engineering', true, 'Engineering'),
    ('Civil and Environmental Engineering', true, 'Engineering'),
    ('Geological and Architectural Engineering', true, 'Engineering'),
    ('Management Engineering', true, 'Engineering'),
    ('Biomedical Engineering', true, 'Engineering'),
    ('Architecture', true, 'Engineering'),
    ('Interdisciplinary', true, 'Cross-Faculty'),
    ('Arts', true, 'Arts'),
    ('Environment', true, 'Environment'),
    ('School of Planning', true, 'Environment'),
    ('Health', true, 'Health'),
    ('School of Public Health Sciences', true, 'Health'),
    ('Mathematics', true, 'Mathematics'),
    ('David R. Cheriton School of Computer Science', true, 'Mathematics'),
    ('Science', true, 'Science'),
    ('Sustainability and Financial Management', true, 'Arts')
)
insert into departments (name, active, faculty_fk, updated_at)
select seeded_departments.name, seeded_departments.active, f.faculty_id, now()
from seeded_departments
left join faculties f on lower(f.name) = lower(seeded_departments.faculty_name)
on conflict (name) do update
set active = excluded.active,
    faculty_fk = excluded.faculty_fk,
    updated_at = now();

do $$
declare
  v_skill_name text;
begin
  delete from skills s
  using (
    select
      skill_id,
      row_number() over (
        partition by lower(name)
        order by skill_id
      ) as duplicate_rank
    from skills
  ) ranked
  where s.skill_id = ranked.skill_id
    and ranked.duplicate_rank > 1;

  for v_skill_name in
    select seeded.name
    from (
      values
        ('Research'),
        ('Machining'),
        ('Ethics Training'),
        ('Data Analysis'),
        ('Programming'),
        ('Design'),
        ('Project Management'),
        ('Communication'),
        ('Leadership'),
        ('Presentation'),
        ('Writing'),
        ('Teamwork'),
        ('Problem Solving'),
        ('Critical Thinking'),
        ('Time Management'),
        ('Budgeting'),
        ('Testing'),
        ('Documentation'),
        ('Prototyping'),
        ('Field Work'),
        ('Surveying'),
        ('Statistical Analysis'),
        ('CAD'),
        ('Simulation'),
        ('Networking'),
        ('Mentoring'),
        ('3D CAD'),
        ('FEA analysis'),
        ('Circuit design'),
        ('Hydraulics'),
        ('Pneumatics'),
        ('Control systems'),
        ('CNC programming'),
        ('PCB layout'),
        ('Mass spectrometry'),
        ('HPLC'),
        ('Electron microscopy'),
        ('PCR'),
        ('Cell culture'),
        ('Experimental design'),
        ('Statistical modeling'),
        ('Python'),
        ('Java'),
        ('C++'),
        ('JavaScript'),
        ('Go'),
        ('Rust'),
        ('React.js'),
        ('Node.js'),
        ('AWS'),
        ('TensorFlow'),
        ('Pen testing'),
        ('SQL'),
        ('Kubernetes'),
        ('Tableau'),
        ('Power BI'),
        ('Predictive modeling'),
        ('Spark'),
        ('Time series'),
        ('A/B testing'),
        ('R'),
        ('MATLAB'),
        ('Illustrator'),
        ('Photoshop'),
        ('Figma'),
        ('Blender'),
        ('After Effects'),
        ('Unity AR/VR'),
        ('Solar design'),
        ('Wind modeling'),
        ('Impact assessment'),
        ('ArcGIS'),
        ('Water testing'),
        ('Energy modeling'),
        ('NGS analysis'),
        ('Bioinformatics'),
        ('Medical imaging'),
        ('ELISA'),
        ('Lab automation'),
        ('Financial forecasting'),
        ('SAP ERP'),
        ('RPA'),
        ('BI reporting'),
        ('Risk modeling'),
        ('Solidity'),
        ('IoT deployment'),
        ('Quantum algorithms'),
        ('Drone programming'),
        ('Autonomous calibration')
    ) as seeded(name)
  loop
    update skills
    set name = v_skill_name,
        updated_at = now()
    where lower(name) = lower(v_skill_name)
      and name is distinct from v_skill_name;

    insert into skills (name)
    select v_skill_name
    where not exists (
      select 1
      from skills
      where lower(name) = lower(v_skill_name)
    );
  end loop;
end $$;

update users
set role = lower(btrim(role)),
    email = lower(btrim(email));

alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('student', 'instructor', 'admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor'));

alter table capstones add column if not exists partner_opportunity_fk bigint references partner_opportunities(partner_opportunity_id) on delete set null;
alter table capstones add column if not exists partner_opportunity_snapshot jsonb;
alter table capstones add column if not exists external_partner_name text;
alter table capstones add column if not exists external_partner_organization text;
alter table capstones add column if not exists external_partner_email text;
alter table capstones add column if not exists external_partner_website text;
alter table capstones add column if not exists external_partner_notes text;
alter table capstones add column if not exists external_partner_support_confirmed boolean not null default false;
alter table capstones add column if not exists external_partner_support_confirmed_at timestamp with time zone;
alter table capstones add column if not exists how_heard_about_capstone text;
alter table capstones add column if not exists deliverable_types text[] default '{}';
alter table capstones add column if not exists proposed_team_members text;
alter table capstones add column if not exists success_criteria text;
alter table capstones add column if not exists validation_plan text;
alter table capstones add column if not exists stakeholders text;
alter table capstones add column if not exists risks_constraints text;
alter table capstones add column if not exists public_evaluation_acknowledged boolean not null default false;
alter table capstones add column if not exists ip_acknowledged boolean not null default false;
alter table capstones add column if not exists confidentiality_acknowledged boolean not null default false;
alter table capstones add column if not exists ecosystem_fk bigint references project_ecosystems(ecosystem_id) on delete set null;
alter table capstones add column if not exists submission_track text not null default 'home_course';
alter table capstones add column if not exists requested_course_fk bigint references courses(course_id) on delete set null;

update capstones
set submission_track = 'home_course'
where submission_track is null;

update capstones
set submission_track = 'interdisciplinary'
where submission_track not in ('home_course', 'interdisciplinary');

alter table partner_opportunities add column if not exists primary_contact text;
alter table partner_opportunities add column if not exists phone text;
alter table partner_opportunities add column if not exists how_heard_about_capstone text;
alter table partner_opportunities add column if not exists organization_description text;
alter table partner_opportunities add column if not exists organization_size text;
alter table partner_opportunities add column if not exists project_start_date text;
alter table partner_opportunities add column if not exists problem_area text;
alter table partner_opportunities add column if not exists main_objectives text;
alter table partner_opportunities add column if not exists scope_of_work text;
alter table partner_opportunities add column if not exists deliverable_types text[] not null default '{}';
alter table partner_opportunities add column if not exists deliverables text;
alter table partner_opportunities add column if not exists meeting_frequency text;
alter table partner_opportunities add column if not exists resources_needed text;
alter table partner_opportunities add column if not exists ip_acknowledged boolean not null default false;
alter table partner_opportunities add column if not exists nda_acknowledged boolean not null default false;
alter table partner_opportunities add column if not exists matching_acknowledged boolean not null default false;

alter table partner_profiles drop constraint if exists partner_profiles_content_check;
alter table partner_profiles
  add constraint partner_profiles_content_check
  check (
    length(btrim(display_name)) between 1 and 200
    and length(btrim(organization)) between 1 and 200
    and length(btrim(contact_email)) between 3 and 320
    and (website is null or length(website) <= 500)
    and (bio is null or length(bio) <= 5000)
    and cardinality(areas) <= 50
  );

alter table partner_opportunities drop constraint if exists partner_opportunities_status_check;
alter table partner_opportunities
  add constraint partner_opportunities_status_check
  check (status in ('draft', 'published', 'archived'));

alter table partner_opportunities drop constraint if exists partner_opportunities_content_check;
alter table partner_opportunities
  add constraint partner_opportunities_content_check
  check (
    length(btrim(title)) between 1 and 300
    and length(btrim(organization)) between 1 and 200
    and length(btrim(description)) between 1 and 10000
    and length(btrim(contact_email)) between 3 and 320
    and (primary_contact is null or length(primary_contact) <= 200)
    and (phone is null or length(phone) <= 50)
    and (how_heard_about_capstone is null or length(how_heard_about_capstone) <= 1000)
    and (organization_description is null or length(organization_description) <= 5000)
    and (organization_size is null or length(organization_size) <= 100)
    and (project_start_date is null or length(project_start_date) <= 100)
    and (problem_area is null or length(problem_area) <= 1000)
    and (main_objectives is null or length(main_objectives) <= 3000)
    and (scope_of_work is null or length(scope_of_work) <= 3000)
    and cardinality(coalesce(deliverable_types, '{}'::text[])) <= 25
    and (deliverables is null or length(deliverables) <= 3000)
    and (meeting_frequency is null or length(meeting_frequency) <= 100)
    and (resources_needed is null or length(resources_needed) <= 2000)
    and cardinality(disciplines) <= 50
    and cardinality(skills) <= 100
    and cardinality(target_course_tags) <= 50
    and (preferred_team_size is null or length(preferred_team_size) <= 100)
    and (contact_url is null or length(contact_url) <= 500)
    and (max_active_teams is null or max_active_teams > 0)
  );

alter table partner_opportunities drop constraint if exists partner_opportunities_archive_status_consistency;
alter table partner_opportunities
  add constraint partner_opportunities_archive_status_consistency
  check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived')
  );

alter table student_profile drop constraint if exists student_profile_content_check;
alter table student_profile
  add constraint student_profile_content_check
  check (
    (headline is null or length(headline) <= 120)
    and (about_me is null or length(about_me) <= 600)
    and cardinality(coalesce(skills, '{}'::text[])) <= 25
    and cardinality(coalesce(preferred_roles, '{}'::text[])) <= 8
    and cardinality(coalesce(project_interests, '{}'::text[])) <= 10
    and (availability is null or length(availability) <= 80)
    and (portfolio_url is null or length(portfolio_url) <= 500)
    and (linkedin_url is null or length(linkedin_url) <= 500)
    and (github_url is null or length(github_url) <= 500)
    and profile_visibility in ('team_network', 'students', 'private')
  );

alter table users drop constraint if exists users_email_uwaterloo_check;
alter table users
  add constraint users_email_uwaterloo_check
  check (
    lower(coalesce(role, '')) = 'external_partner'
    or email ~ '^[^@[:space:]]+@uwaterloo[.]ca$'
  );

alter table courses alter column active set default false;
alter table courses alter column active set not null;

-- Performance indexes for workflow + audit endpoints
create index if not exists idx_team_memberships_team_fk
  on team_memberships(team_fk);

create index if not exists idx_team_memberships_enrollment_course_fk
  on team_memberships(enrollment_course_fk);

create index if not exists idx_capstones_team_fk
  on capstones(team_fk);

create index if not exists idx_capstones_ecosystem_fk
  on capstones(ecosystem_fk);

create unique index if not exists idx_capstones_one_active_per_team
  on capstones(team_fk)
  where team_fk is not null and archived is not true;

create unique index if not exists idx_team_memberships_one_leader_per_team
  on team_memberships(team_fk)
  where is_leader is true;

update courses
set activation_mode = 'auto'
where activation_mode is null
   or activation_mode not in ('auto', 'force_active', 'force_inactive');

with seeded_courses (
  code,
  name,
  active_terms,
  department_name,
  routing_kind
) as (
  values
    ('AE 400', 'Project Studio 1', array['Spring']::text[], 'Architectural Engineering', 'standard'),
    ('AE 425', 'Project Studio 2', array['Winter']::text[], 'Architectural Engineering', 'standard'),
    ('BME 461', 'Biomedical Engineering Design Workshop 2', array['Fall']::text[], 'Biomedical Engineering', 'standard'),
    ('BME 462', 'Biomedical Engineering Design Workshop 3', array['Winter']::text[], 'Biomedical Engineering', 'standard'),
    ('CHE 482', 'Group Design Project', array['Fall']::text[], 'Chemical Engineering', 'standard'),
    ('CHE 483', 'Group Design Project and Symposium', array['Winter']::text[], 'Chemical Engineering', 'standard'),
    ('CIVE 400', 'Civil Engineering Design Project 1', array['Spring']::text[], 'Civil Engineering', 'standard'),
    ('CIVE 401', 'Civil Engineering Design Project 2', array['Winter']::text[], 'Civil Engineering', 'standard'),
    ('ECE 498A', 'Engineering Design Project', array['Spring']::text[], 'Electrical and Computer Engineering', 'standard'),
    ('ECE 498B', 'Engineering Design Project', array['Winter']::text[], 'Electrical and Computer Engineering', 'standard'),
    ('ENVE 400', 'Environmental Engineering Design Project 1', array['Fall']::text[], 'Environmental Engineering', 'standard'),
    ('ENVE 401', 'Environmental Engineering Design Project 2', array['Winter']::text[], 'Environmental Engineering', 'standard'),
    ('GEOE 400', 'Geological Engineering Design Project 1', array['Fall']::text[], 'Geological Engineering', 'standard'),
    ('GEOE 401', 'Geological Engineering Design Project 2', array['Winter']::text[], 'Geological Engineering', 'standard'),
    ('MSCI 401', 'Management Engineering Design Project 1', array['Spring']::text[], 'Management Engineering', 'standard'),
    ('MSCI 402', 'Management Engineering Design Project 2', array['Winter']::text[], 'Management Engineering', 'standard'),
    ('ME 481', 'Mechanical Engineering Design Project 1', array['Fall', 'Spring']::text[], 'Mechanical Engineering', 'standard'),
    ('ME 482', 'Mechanical Engineering Design Project 2', array['Winter']::text[], 'Mechanical Engineering', 'standard'),
    ('MTE 481', 'Mechatronics Engineering Design Project', array['Fall']::text[], 'Mechatronics Engineering', 'standard'),
    ('MTE 482', 'Mechatronics Engineering Project', array['Winter']::text[], 'Mechatronics Engineering', 'standard'),
    ('NE 408', 'Nanosystems Design Project', array['Fall']::text[], 'Nanotechnology Engineering', 'standard'),
    ('NE 409', 'Nanosystems Design Project and Symposium', array['Winter']::text[], 'Nanotechnology Engineering', 'standard'),
    ('SE 390', 'Design Project Planning', array['Fall']::text[], 'Software Engineering', 'standard'),
    ('SE 490', 'Design Project 1', array['Spring', 'Fall']::text[], 'Software Engineering', 'standard'),
    ('SE 491', 'Design Project 2', array['Winter']::text[], 'Software Engineering', 'standard'),
    ('SYDE 461', 'Systems Design Capstone Project 1', array['Fall']::text[], 'Systems Design Engineering', 'standard'),
    ('SYDE 462', 'Systems Design Capstone Project 2', array['Winter']::text[], 'Systems Design Engineering', 'standard'),
    ('GENE 403', 'Interdisciplinary Design Project 1', array['Winter', 'Spring', 'Fall']::text[], 'Interdisciplinary', 'interdisciplinary'),
    ('GENE 404', 'Interdisciplinary Design Project 2', array['Winter', 'Spring', 'Fall']::text[], 'Interdisciplinary', 'interdisciplinary'),
    ('ARTS 450', 'Global Engagement Seminar', array['Fall']::text[], 'Arts', 'interdisciplinary'),
    ('ARTS 490', 'Topics: Fourth-Year Arts - Global Engagement Continuation', array['Winter']::text[], 'Arts', 'interdisciplinary'),
    ('ENVS 403A', 'Interdisciplinary Project', array['Fall']::text[], 'Environment', 'interdisciplinary'),
    ('ENVS 403B', 'Interdisciplinary Project', array['Winter']::text[], 'Environment', 'interdisciplinary'),
    ('ENVS 404', 'Interdisciplinary Project', array['Fall']::text[], 'Environment', 'interdisciplinary'),
    ('HEALTH 490', 'Interdisciplinary Health Topics', array['Fall']::text[], 'Health', 'interdisciplinary'),
    ('MTHEL 398', 'Future Cities Capstone', array['Fall']::text[], 'Mathematics', 'interdisciplinary'),
    ('MTHEL 498', 'Mathematics Elective Topics 4 - Global Engagement Continuation', array['Winter']::text[], 'Mathematics', 'interdisciplinary'),
    ('SCI 300', 'Capstone Project', array['Fall', 'Winter']::text[], 'Science', 'interdisciplinary'),
    ('SFM 403', 'Integrated Planning, Reporting, and Risk Management for Sustainability', array['Fall']::text[], 'Sustainability and Financial Management', 'interdisciplinary'),
    ('SFM 413', 'Integrating Systems in Finance', array['Fall']::text[], 'Sustainability and Financial Management', 'interdisciplinary'),
    ('CS 497', 'AI Transformation in Organizations: Healthcare', array['Fall']::text[], 'David R. Cheriton School of Computer Science', 'interdisciplinary'),
    ('HLTH 480', 'Competencies in Health', array['Fall']::text[], 'Health', 'interdisciplinary'),
    ('PLAN 405', 'Integrated Planning Project', array['Fall']::text[], 'School of Planning', 'interdisciplinary'),
    ('ENVS 474', 'Future Cities Capstone', array['Fall']::text[], 'Environment', 'interdisciplinary')
  )
insert into courses (
  code,
  name,
  active,
  active_terms,
  activation_mode,
  department_fk,
  routing_kind,
  requires_project_support
)
select
  seeded_courses.code,
  seeded_courses.name,
  false,
  seeded_courses.active_terms,
  'auto',
  d.department_id,
  seeded_courses.routing_kind,
  true
from seeded_courses
left join departments d
  on lower(d.name) = lower(seeded_courses.department_name)
on conflict ((upper(code))) do update
set name = excluded.name,
    active_terms = case
      when courses.active_terms is null or cardinality(courses.active_terms) = 0 then excluded.active_terms
      else courses.active_terms
    end,
    department_fk = coalesce(courses.department_fk, excluded.department_fk),
    routing_kind = case
      when coalesce(courses.routing_kind, 'standard') = 'standard'
           and excluded.routing_kind = 'interdisciplinary' then excluded.routing_kind
      else coalesce(courses.routing_kind, excluded.routing_kind)
    end,
    requires_project_support = courses.requires_project_support;

with course_ecosystem_map (course_code, ecosystem_name) as (
  values
    ('GENE 403', 'GENE'),
    ('GENE 404', 'GENE'),
    ('MTHEL 398', 'Future Cities'),
    ('PLAN 405', 'Future Cities'),
    ('ENVS 474', 'Future Cities')
)
update courses c
set ecosystem_fk = e.ecosystem_id
from course_ecosystem_map m
join project_ecosystems e on lower(e.name) = lower(m.ecosystem_name)
where upper(c.code) = upper(m.course_code)
  and (
    c.ecosystem_fk is null
    or exists (
      select 1
      from project_ecosystems current_e
      where current_e.ecosystem_id = c.ecosystem_fk
        and lower(coalesce(current_e.name, '')) = 'departmental'
    )
  );

update courses
set ecosystem_fk = (
  select ecosystem_id from project_ecosystems where name = 'Departmental'
)
where ecosystem_fk is null;

with seeded_course_offerings (
  group_key,
  course_code,
  term,
  title_override,
  description,
  topic,
  section_label,
  status,
  routing_kind_override,
  ecosystem_name,
  requires_project_support,
  student_registration_notes,
  admin_routing_notes,
  source_url
) as (
  values
    (
      'ai_health_fall_2026',
      'CS 497',
      'Fall 2026',
      'AI Transformation in Organizations: Healthcare',
      'Offering-level AI and Health interdisciplinary capstone grouping.',
      'AI and Health',
      null,
      'active',
      'interdisciplinary',
      'AI + Health',
      true,
      'Students remain enrolled in their approved transcript course; WatMatch records the intended route only.',
      'Confirm the live held-with/topic details in Waterloo Schedule of Classes before opening the marketplace.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'ai_health_fall_2026',
      'HLTH 480',
      'Fall 2026',
      'Competencies in Health',
      'Offering-level AI and Health interdisciplinary capstone grouping.',
      'AI and Health',
      null,
      'active',
      'interdisciplinary',
      'AI + Health',
      true,
      'Students remain enrolled in their approved transcript course; WatMatch records the intended route only.',
      'Confirm the live held-with/topic details in Waterloo Schedule of Classes before opening the marketplace.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'future_cities_fall_2026',
      'MTHEL 398',
      'Fall 2026',
      'Future Cities Capstone',
      'Future Cities-capable interdisciplinary capstone offering.',
      'Future Cities',
      null,
      'active',
      'interdisciplinary',
      'Future Cities',
      true,
      'Students use their approved Future Cities transcript course; registrar-side enrollment is handled outside WatMatch.',
      'Confirm whether this offering is active for the term before routing students.',
      'https://uwaterloo.ca/future-cities-institute/plan405-mthel398'
    ),
    (
      'future_cities_fall_2026',
      'PLAN 405',
      'Fall 2026',
      'Integrated Planning Project',
      'Future Cities-capable interdisciplinary capstone offering.',
      'Future Cities',
      null,
      'active',
      'interdisciplinary',
      'Future Cities',
      true,
      'Students use their approved Future Cities transcript course; registrar-side enrollment is handled outside WatMatch.',
      'Confirm whether this offering is active for the term before routing students.',
      'https://uwaterloo.ca/future-cities-institute/plan405-mthel398'
    ),
    (
      'future_cities_fall_2026',
      'ENVS 474',
      'Fall 2026',
      'Future Cities Capstone',
      'Future Cities-capable interdisciplinary capstone offering.',
      'Future Cities',
      null,
      'active',
      'interdisciplinary',
      'Future Cities',
      true,
      'Students use their approved Future Cities transcript course; registrar-side enrollment is handled outside WatMatch.',
      'Confirm whether this offering is active for the term before routing students.',
      'https://uwaterloo.ca/future-cities-institute/plan405-mthel398'
    ),
    (
      'global_engagement_fall_2026',
      'ARTS 450',
      'Fall 2026',
      'Global Engagement Seminar',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_fall_2026',
      'ENVS 403A',
      'Fall 2026',
      'Interdisciplinary Project',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_fall_2026',
      'ENVS 404',
      'Fall 2026',
      'Interdisciplinary Project',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_fall_2026',
      'GENE 403',
      'Fall 2026',
      'Interdisciplinary Design Project 1',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_fall_2026',
      'HEALTH 490',
      'Fall 2026',
      'Interdisciplinary Health Topics',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_fall_2026',
      'SCI 300',
      'Fall 2026',
      'Capstone Project',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_fall_2026',
      'SFM 403',
      'Fall 2026',
      'Integrated Planning, Reporting, and Risk Management for Sustainability',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_fall_2026',
      'SFM 413',
      'Fall 2026',
      'Integrating Systems in Finance',
      'Term-specific global engagement interdisciplinary capstone offering.',
      'Global Engagement',
      null,
      'active',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Review Schedule of Classes held-with rows and update WatMatch plus registrar records together.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_winter_2027',
      'ARTS 490',
      'Winter 2027',
      'Topics: Fourth-Year Arts - Global Engagement Continuation',
      'Term-specific continuation offering for global engagement interdisciplinary capstones.',
      'Global Engagement Continuation',
      null,
      'draft',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Winter 2027 draft follows the Winter 2026 Global Engagement continuation pattern; confirm the Schedule of Classes before activation and registrar routing.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_winter_2027',
      'ENVS 403B',
      'Winter 2027',
      'Interdisciplinary Project',
      'Term-specific continuation offering for global engagement interdisciplinary capstones.',
      'Global Engagement Continuation',
      null,
      'draft',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Winter 2027 draft follows the Winter 2026 Global Engagement continuation pattern; confirm the Schedule of Classes before activation and registrar routing.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_winter_2027',
      'GENE 403',
      'Winter 2027',
      'Interdisciplinary Design Project 1',
      'Term-specific continuation offering for global engagement interdisciplinary capstones.',
      'Global Engagement Continuation',
      null,
      'draft',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Winter 2027 draft follows the Winter 2026 Global Engagement continuation pattern; confirm the Schedule of Classes before activation and registrar routing.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_winter_2027',
      'GENE 404',
      'Winter 2027',
      'Interdisciplinary Design Project 2',
      'Term-specific continuation offering for global engagement interdisciplinary capstones.',
      'Global Engagement Continuation',
      null,
      'draft',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Winter 2027 draft follows the Winter 2026 Global Engagement continuation pattern; confirm the Schedule of Classes before activation and registrar routing.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_winter_2027',
      'MTHEL 498',
      'Winter 2027',
      'Mathematics Elective Topics 4 - Global Engagement Continuation',
      'Term-specific continuation offering for global engagement interdisciplinary capstones.',
      'Global Engagement Continuation',
      null,
      'draft',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Winter 2027 draft follows the Winter 2026 Global Engagement continuation pattern; confirm the Schedule of Classes before activation and registrar routing.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    ),
    (
      'global_engagement_winter_2027',
      'SCI 300',
      'Winter 2027',
      'Capstone Project',
      'Term-specific continuation offering for global engagement interdisciplinary capstones.',
      'Global Engagement Continuation',
      null,
      'draft',
      'interdisciplinary',
      'i-Capstone',
      true,
      'Students retain the enrollment route approved for their home program.',
      'Winter 2027 draft follows the Winter 2026 Global Engagement continuation pattern; confirm the Schedule of Classes before activation and registrar routing.',
      'https://uwaterloo.ca/centre-for-work-integrated-learning/courses/capstone'
    )
),
offering_targets as (
  select
    seeded.group_key,
    c.course_id,
    seeded.term,
    seeded.title_override,
    seeded.description,
    seeded.topic,
    seeded.section_label,
    seeded.status,
    seeded.routing_kind_override,
    e.ecosystem_id,
    seeded.requires_project_support,
    seeded.student_registration_notes,
    seeded.admin_routing_notes,
    seeded.source_url
  from seeded_course_offerings seeded
  join courses c on upper(c.code) = upper(seeded.course_code)
  join project_ecosystems e on lower(e.name) = lower(seeded.ecosystem_name)
),
updated_offerings as (
  update course_offerings offering
  set title_override = target.title_override,
      description = target.description,
      topic = target.topic,
      status = target.status,
      routing_kind_override = target.routing_kind_override,
      ecosystem_fk = target.ecosystem_id,
      requires_project_support = target.requires_project_support,
      student_registration_notes = target.student_registration_notes,
      admin_routing_notes = target.admin_routing_notes,
      source_url = target.source_url,
      updated_at = now()
  from offering_targets target
  where offering.course_fk = target.course_id
    and offering.term = target.term
    and coalesce(offering.section_label, '') = coalesce(target.section_label, '')
  returning offering.course_offering_id
)
insert into course_offerings (
  course_fk,
  term,
  title_override,
  description,
  topic,
  section_label,
  status,
  routing_kind_override,
  ecosystem_fk,
  requires_project_support,
  student_registration_notes,
  admin_routing_notes,
  source_url
)
select
  target.course_id,
  target.term,
  target.title_override,
  target.description,
  target.topic,
  target.section_label,
  target.status,
  target.routing_kind_override,
  target.ecosystem_id,
  target.requires_project_support,
  target.student_registration_notes,
  target.admin_routing_notes,
  target.source_url
from offering_targets target
where not exists (
  select 1
  from course_offerings offering
  where offering.course_fk = target.course_id
    and offering.term = target.term
    and coalesce(offering.section_label, '') = coalesce(target.section_label, '')
);

with seeded_offering_groups (group_key, course_code, term) as (
  values
    ('ai_health_fall_2026', 'CS 497', 'Fall 2026'),
    ('ai_health_fall_2026', 'HLTH 480', 'Fall 2026'),
    ('future_cities_fall_2026', 'MTHEL 398', 'Fall 2026'),
    ('future_cities_fall_2026', 'PLAN 405', 'Fall 2026'),
    ('future_cities_fall_2026', 'ENVS 474', 'Fall 2026'),
    ('global_engagement_fall_2026', 'ARTS 450', 'Fall 2026'),
    ('global_engagement_fall_2026', 'ENVS 403A', 'Fall 2026'),
    ('global_engagement_fall_2026', 'ENVS 404', 'Fall 2026'),
    ('global_engagement_fall_2026', 'GENE 403', 'Fall 2026'),
    ('global_engagement_fall_2026', 'HEALTH 490', 'Fall 2026'),
    ('global_engagement_fall_2026', 'MTHEL 398', 'Fall 2026'),
    ('global_engagement_fall_2026', 'SCI 300', 'Fall 2026'),
    ('global_engagement_fall_2026', 'SFM 403', 'Fall 2026'),
    ('global_engagement_fall_2026', 'SFM 413', 'Fall 2026'),
    ('global_engagement_winter_2027', 'ARTS 490', 'Winter 2027'),
    ('global_engagement_winter_2027', 'ENVS 403B', 'Winter 2027'),
    ('global_engagement_winter_2027', 'GENE 403', 'Winter 2027'),
    ('global_engagement_winter_2027', 'GENE 404', 'Winter 2027'),
    ('global_engagement_winter_2027', 'MTHEL 498', 'Winter 2027'),
    ('global_engagement_winter_2027', 'SCI 300', 'Winter 2027')
),
seeded_offerings as (
  select
    seeded.group_key,
    c.course_id,
    offering.course_offering_id
  from seeded_offering_groups seeded
  join courses c on upper(c.code) = upper(seeded.course_code)
  join course_offerings offering
    on offering.course_fk = c.course_id
   and offering.term = seeded.term
   and offering.status <> 'archived'
)
insert into course_offering_held_with (
  course_offering_fk,
  held_with_course_fk,
  held_with_offering_fk,
  notes
)
select
  source.course_offering_id,
  target.course_id,
  target.course_offering_id,
  'Seeded term held-with relationship. Confirm against Waterloo Schedule of Classes for the active term.'
from seeded_offerings source
join seeded_offerings target
  on target.group_key = source.group_key
 and target.course_id <> source.course_id
on conflict (course_offering_fk, held_with_course_fk) do update
set held_with_offering_fk = excluded.held_with_offering_fk,
    notes = excluded.notes;

update teams t
set ecosystem_fk = c.ecosystem_fk
from courses c
where c.course_id = t.course_fk
  and c.ecosystem_fk is not null
  and (
    t.ecosystem_fk is null
    or exists (
      select 1
      from project_ecosystems current_e
      where current_e.ecosystem_id = t.ecosystem_fk
        and lower(coalesce(current_e.name, '')) = 'departmental'
    )
  );

with capstone_ecosystem_targets as (
  select
    cap.capstone_id,
    coalesce(c.ecosystem_fk, t.ecosystem_fk) as ecosystem_fk
  from capstones cap
  join courses c on c.course_id = cap.course_fk
  left join teams t on t.team_id = cap.team_fk
  where coalesce(c.ecosystem_fk, t.ecosystem_fk) is not null
)
update capstones cap
set ecosystem_fk = targets.ecosystem_fk
from capstone_ecosystem_targets targets
where targets.capstone_id = cap.capstone_id
  and (
    cap.ecosystem_fk is null
    or exists (
      select 1
      from project_ecosystems current_e
      where current_e.ecosystem_id = cap.ecosystem_fk
        and lower(coalesce(current_e.name, '')) = 'departmental'
    )
  );

do $$
begin
  perform set_config('watmatch.allow_membership_enrollment_reroute', 'true', true);

  update team_memberships tm
  set enrollment_course_fk = u.course_fk
  from users u
  join courses c on c.course_id = u.course_fk
  where tm.enrollment_course_fk is null
    and u.user_id = tm.user_fk
    and u.course_fk is not null
    and c.active is true
    and exists (
      select 1
      from users instructor
      where instructor.course_fk = c.course_id
        and instructor.active is true
        and lower(coalesce(instructor.role, '')) = 'instructor'
    );

  perform set_config('watmatch.allow_membership_enrollment_reroute', 'false', true);
end $$;

update courses
set active = false,
    activation_mode = 'force_inactive',
    retired_for_routing = true
where upper(code) in ('DEMO 101', 'TEST 390', 'TEST 490');

alter table course_pipeline_edges drop constraint if exists course_pipeline_edges_notes_len_check;
alter table course_pipeline_edges
  add constraint course_pipeline_edges_notes_len_check
  check (notes is null or char_length(notes) <= 1000);

create unique index if not exists idx_course_pipeline_edges_one_default
  on course_pipeline_edges(from_course_fk)
  where active is true and is_default is true;

create index if not exists idx_course_pipeline_edges_from_active
  on course_pipeline_edges(from_course_fk, active, is_default);

create index if not exists idx_course_pipeline_edges_to_active
  on course_pipeline_edges(to_course_fk, active);

with seeded_edges (
  from_code,
  to_code,
  is_default,
  notes
) as (
  values
    ('AE 400', 'AE 425', true, 'Standard Architectural Engineering capstone continuation.'),
    ('BME 461', 'BME 462', true, 'Standard Biomedical Engineering capstone continuation.'),
    ('CHE 482', 'CHE 483', true, 'Standard Chemical Engineering capstone continuation.'),
    ('CIVE 400', 'CIVE 401', true, 'Standard Civil Engineering capstone continuation.'),
    ('ECE 498A', 'ECE 498B', true, 'Standard Electrical and Computer Engineering capstone continuation.'),
    ('ENVE 400', 'ENVE 401', true, 'Standard Environmental Engineering capstone continuation.'),
    ('GEOE 400', 'GEOE 401', true, 'Standard Geological Engineering capstone continuation.'),
    ('MSCI 401', 'MSCI 402', true, 'Standard Management Engineering capstone continuation.'),
    ('ME 481', 'ME 482', true, 'Standard Mechanical Engineering capstone continuation.'),
    ('MTE 481', 'MTE 482', true, 'Standard Mechatronics Engineering capstone continuation.'),
    ('NE 408', 'NE 409', true, 'Standard Nanotechnology Engineering capstone continuation.'),
    ('SE 390', 'SE 490', true, 'Software Engineering planning projects continue into SE 490.'),
    ('SE 490', 'SE 491', true, 'Standard Software Engineering capstone continuation.'),
    ('SYDE 461', 'SYDE 462', true, 'Standard Systems Design Engineering capstone continuation.'),
    ('GENE 403', 'GENE 404', true, 'Standard interdisciplinary capstone continuation.'),
    ('ARTS 450', 'ARTS 490', true, 'Global Engagement continuation into Winter.'),
    ('ENVS 403A', 'ENVS 403B', true, 'Environment interdisciplinary continuation into Winter.'),
    ('MTHEL 398', 'MTHEL 498', true, 'Future Cities mathematics continuation into Winter.'),
    ('SCI 300', 'SCI 300', true, 'SCI 300 Fall/Winter continuation within the same transcript course.'),
    ('SE 490', 'SE 490', false, 'Optional Spring-to-Fall SE 490 continuation for rare cases.')
  )
insert into course_pipeline_edges (
  from_course_fk,
  to_course_fk,
  active,
  is_default,
  notes,
  updated_at
)
select
  source_course.course_id,
  target_course.course_id,
  true,
  seeded_edges.is_default,
  seeded_edges.notes,
  now()
from seeded_edges
join courses source_course
  on upper(source_course.code) = upper(seeded_edges.from_code)
join courses target_course
  on upper(target_course.code) = upper(seeded_edges.to_code)
on conflict (from_course_fk, to_course_fk) do update
set active = true,
    is_default = excluded.is_default,
    notes = excluded.notes,
    updated_at = now();

create unique index if not exists idx_skills_name_unique
  on skills(lower(name));

drop index if exists idx_skills_active_name;

create unique index if not exists idx_users_email_unique
  on users(email);

create index if not exists idx_users_home_department_fk
  on users(home_department_fk);

create index if not exists idx_users_active_instructors_course_fk
  on users(course_fk)
  where active is true and lower(role) = 'instructor';

create unique index if not exists idx_student_profile_student_unique
  on student_profile(student_fk);

create index if not exists idx_student_profile_departments_department_fk
  on student_profile_departments(department_fk);

create index if not exists idx_partner_opportunities_status_created
  on partner_opportunities(status, created_at desc);

create index if not exists idx_partner_opportunities_partner_status
  on partner_opportunities(partner_user_fk, status);

create index if not exists idx_partner_opportunity_courses_course_fk
  on partner_opportunity_courses(course_fk);

create index if not exists idx_capstones_partner_opportunity_fk
  on capstones(partner_opportunity_fk);

alter table mentor_requests drop constraint if exists mentor_requests_status_check;
alter table mentor_requests
  add constraint mentor_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled'));

alter table mentor_requests drop constraint if exists mentor_requests_source_check;
alter table mentor_requests
  add constraint mentor_requests_source_check
  check (request_source in ('team_request', 'staff_request', 'mentor_offer'));

alter table mentor_requests drop constraint if exists mentor_requests_decision_metadata_check;
alter table mentor_requests
  add constraint mentor_requests_decision_metadata_check
  check (
    (
      status = 'pending'
      and decided_by_fk is null
      and decided_at is null
    )
    or (
      status in ('accepted', 'declined', 'cancelled')
      and decided_at is not null
    )
  );

create index if not exists idx_mentor_requests_capstone_status
  on mentor_requests(capstone_fk, status, created_at desc);

create index if not exists idx_mentor_requests_team_status
  on mentor_requests(team_fk, status, created_at desc);

create index if not exists idx_mentor_requests_mentor_status
  on mentor_requests(mentor_fk, status, created_at desc);

create index if not exists idx_mentor_profiles_primary_department_fk
  on mentor_profiles(primary_department_fk);

create index if not exists idx_mentor_profile_departments_department_fk
  on mentor_profile_departments(department_fk);

alter table mentor_profiles drop constraint if exists mentor_profiles_content_check;
alter table mentor_profiles
  add constraint mentor_profiles_content_check
  check (
    (display_name is null or length(display_name) <= 200)
    and (affiliation is null or length(affiliation) <= 300)
    and (bio is null or length(bio) <= 5000)
    and cardinality(availability_terms) <= 3
    and availability_terms <@ array['Winter', 'Spring', 'Fall']::text[]
    and cardinality(expertise_tags) <= 50
    and (max_active_projects is null or max_active_projects between 0 and 25)
  );

update mentor_requests mr
set status = 'cancelled',
    response_note = coalesce(response_note, 'Mentor account is inactive.'),
    decided_at = now(),
    updated_at = now()
from users u
join capstones c on true
left join teams t on t.team_id = c.team_fk
where mr.mentor_fk = u.user_id
  and mr.capstone_fk = c.capstone_id
  and mr.status = 'accepted'
  and u.active is false
  and coalesce(t.status, '') <> 'finalized';

create unique index if not exists idx_mentor_requests_one_accepted_per_capstone
  on mentor_requests(capstone_fk)
  where status = 'accepted';

create unique index if not exists idx_mentor_requests_one_pending_per_capstone_mentor
  on mentor_requests(capstone_fk, mentor_fk)
  where status = 'pending';

create index if not exists idx_capstone_departments_department_fk
  on capstone_departments(department_fk);

create index if not exists idx_capstone_departments_capstone_fk
  on capstone_departments(capstone_fk);

create unique index if not exists idx_capstone_course_approvals_capstone_course_unique
  on capstone_course_approvals(capstone_fk, course_fk);

create unique index if not exists idx_team_memberships_user_unique
  on team_memberships(user_fk);

create index if not exists idx_capstones_status_archived
  on capstones(status, archived);

create index if not exists idx_capstones_closeout_state
  on capstones(closeout_decision, closeout_applied_at, status, archived);

create index if not exists idx_past_watmatch_capstones_year
  on past_watmatch_capstones(year desc, created_at desc);

create index if not exists idx_past_watmatch_capstones_source_course
  on past_watmatch_capstones(source_fk);

create unique index if not exists idx_student_past_shortlists_imported_unique
  on student_past_capstone_shortlists(student_fk, past_capstone_fk)
  where past_capstone_fk is not null;

create unique index if not exists idx_student_past_shortlists_watmatch_unique
  on student_past_capstone_shortlists(student_fk, past_watmatch_capstone_fk)
  where past_watmatch_capstone_fk is not null;

create index if not exists idx_student_past_shortlists_student_created
  on student_past_capstone_shortlists(student_fk, created_at desc);

create index if not exists idx_audit_log_actor_fk
  on audit_log(actor_fk);

create index if not exists idx_audit_log_action
  on audit_log(action);

create index if not exists idx_audit_log_entity
  on audit_log(entity_type, entity_id);

create index if not exists idx_audit_log_created_at
  on audit_log(created_at desc);

create index if not exists idx_audit_log_metadata_gin
  on audit_log using gin(metadata);

create index if not exists idx_course_reassignment_requests_status
  on course_reassignment_requests(status, created_at desc);

create index if not exists idx_course_reassignment_requests_student_fk
  on course_reassignment_requests(student_fk);

create index if not exists idx_course_reassignment_requests_capstone_fk
  on course_reassignment_requests(capstone_fk);

alter table course_reassignment_requests
  add column if not exists request_type text not null default 'course_reassignment',
  add column if not exists request_source text,
  add column if not exists proposal_payload jsonb;

update course_reassignment_requests older
set status = 'cancelled',
    decided_at = coalesce(decided_at, now()),
    comments = coalesce(comments, 'Superseded duplicate pending course routing request.'),
    updated_at = now()
where older.status = 'pending'
  and older.capstone_fk is not null
  and exists (
    select 1
    from course_reassignment_requests newer
    where newer.request_id <> older.request_id
      and newer.status = 'pending'
      and newer.capstone_fk = older.capstone_fk
      and newer.student_fk = older.student_fk
      and newer.request_id > older.request_id
  );

create unique index if not exists idx_course_reassignment_requests_one_pending_per_capstone_student
  on course_reassignment_requests(capstone_fk, student_fk)
  where status = 'pending';

create unique index if not exists idx_course_reassignment_requests_one_pending_submission_enrollment_per_student
  on course_reassignment_requests(student_fk)
  where status = 'pending'
    and request_type = 'project_submission_enrollment';

alter table capstones alter column carry_over_read_only set default false;
update capstones set carry_over_read_only = false where carry_over_read_only is null;
alter table capstones alter column carry_over_read_only set not null;

alter table capstones drop constraint if exists capstones_closeout_decision_check;
alter table capstones
  add constraint capstones_closeout_decision_check
  check (
    closeout_decision is null
    or closeout_decision in ('continue_to_course', 'publish_completed', 'carry_over_read_only', 'archive')
  );

create or replace function watmatch_course_available_for_term(
  p_course_id bigint,
  p_target_term text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course courses%rowtype;
  v_target_season text := split_part(coalesce(p_target_term, ''), ' ', 1);
begin
  if p_course_id is null
     or p_target_term is null
     or p_target_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    return false;
  end if;

  select *
    into v_course
  from courses
  where course_id = p_course_id;

  if not found
     or coalesce(v_course.retired_for_routing, false) is true
     or coalesce(v_course.activation_mode, 'auto') = 'force_inactive' then
    return false;
  end if;

  if watmatch_course_has_term_offering(v_course.course_id, p_target_term) then
    return watmatch_course_has_active_term_offering(v_course.course_id, p_target_term)
      and watmatch_course_has_active_instructor(v_course.course_id);
  end if;

  if coalesce(v_course.activation_mode, 'auto') <> 'force_active'
     and not (coalesce(v_course.active_terms, '{}'::text[]) @> array[v_target_season]::text[]) then
    return false;
  end if;

  return watmatch_course_has_active_instructor(v_course.course_id);
end;
$$;

create or replace function watmatch_default_continuation_enrollment_course(
  p_current_enrollment_course_id bigint,
  p_target_course_id bigint,
  p_target_term text
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id bigint;
begin
  if p_target_term is null then
    return null;
  end if;

  if p_current_enrollment_course_id is not null then
    select edge.to_course_fk
      into v_course_id
    from course_pipeline_edges edge
    where edge.from_course_fk = p_current_enrollment_course_id
      and edge.active is true
      and watmatch_course_available_for_term(edge.to_course_fk, p_target_term)
    order by edge.is_default desc, edge.course_pipeline_edge_id
    limit 1;

    if v_course_id is not null then
      return v_course_id;
    end if;

    if watmatch_course_available_for_term(p_current_enrollment_course_id, p_target_term) then
      return p_current_enrollment_course_id;
    end if;
  end if;

  if watmatch_course_available_for_term(p_target_course_id, p_target_term) then
    return p_target_course_id;
  end if;

  return null;
end;
$$;

create or replace function watmatch_resolve_continuation_member_routes(
  p_team_id bigint,
  p_target_course_id bigint,
  p_target_term text,
  p_member_enrollment_routes jsonb default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  member_row record;
  v_routes jsonb := coalesce(p_member_enrollment_routes, '{}'::jsonb);
  v_result jsonb := '{}'::jsonb;
  v_route_text text;
  v_route_course_id bigint;
  v_member_count integer := 0;
begin
  if p_team_id is null or p_target_course_id is null or p_target_term is null then
    raise exception 'Team, coordinating course, and target term are required for continuation routing.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_routes) is distinct from 'object' then
    raise exception 'Member enrollment routes must be an object keyed by student ID.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_routes) as route_keys(route_key)
    where route_key !~ '^[0-9]+$'
  ) then
    raise exception 'Continuation enrollment route keys must be student IDs.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_routes) as route_keys(route_key)
    where case
      when route_key ~ '^[0-9]+$' then not exists (
          select 1
          from team_memberships tm
          where tm.team_fk = p_team_id
            and tm.user_fk = route_key::bigint
        )
      else false
    end
  ) then
    raise exception 'Continuation enrollment routes can only include current official team members.'
      using errcode = '23514';
  end if;

  for member_row in
    select
      tm.user_fk,
      tm.enrollment_course_fk,
      u.course_fk,
      u.email
    from team_memberships tm
    join users u on u.user_id = tm.user_fk
    where tm.team_fk = p_team_id
    order by tm.is_leader desc, u.email, u.user_id
  loop
    v_member_count := v_member_count + 1;
    v_route_text := nullif(btrim(coalesce(v_routes ->> member_row.user_fk::text, '')), '');

    if v_route_text is not null and v_route_text !~ '^[0-9]+$' then
      raise exception 'Continuation enrollment route for % must be a course ID.',
        coalesce(member_row.email, member_row.user_fk::text)
        using errcode = '22023';
    end if;

    v_route_course_id := coalesce(
      v_route_text::bigint,
      watmatch_default_continuation_enrollment_course(
        coalesce(member_row.enrollment_course_fk, member_row.course_fk),
        p_target_course_id,
        p_target_term
      )
    );

    if v_route_course_id is null then
      raise exception 'Choose a continuation enrollment course for %.',
        coalesce(member_row.email, member_row.user_fk::text)
        using errcode = '23514';
    end if;

    if not watmatch_course_available_for_term(v_route_course_id, p_target_term) then
      raise exception 'Continuation enrollment course % is not available for %.',
        v_route_course_id,
        p_target_term
        using errcode = '23514';
    end if;

    v_result := v_result || jsonb_build_object(member_row.user_fk::text, v_route_course_id);
  end loop;

  if v_member_count = 0 then
    raise exception 'Continuation requires at least one official team member.'
      using errcode = '23514';
  end if;

  return v_result;
end;
$$;

create or replace function watmatch_continuation_member_routes_ready(
  p_team_id bigint,
  p_target_course_id bigint,
  p_target_term text,
  p_member_enrollment_routes jsonb default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform watmatch_resolve_continuation_member_routes(
    p_team_id,
    p_target_course_id,
    p_target_term,
    p_member_enrollment_routes
  );
  return true;
exception
  when others then
    return false;
end;
$$;

alter table capstones drop constraint if exists capstones_continued_to_term_check;
alter table capstones
  add constraint capstones_continued_to_term_check
  check (
    continued_to_term is null
    or continued_to_term ~ '^(Winter|Spring|Fall) [0-9]{4}$'
  );

alter table capstones drop constraint if exists capstones_completed_term_check;
alter table capstones
  add constraint capstones_completed_term_check
  check (
    completed_term is null
    or completed_term ~ '^(Winter|Spring|Fall) [0-9]{4}$'
  );

alter table capstones drop constraint if exists capstones_completion_metadata_check;
alter table capstones
  add constraint capstones_completion_metadata_check
  check (
    status <> 'complete'
    or (
      completed_at is not null
      and completed_by_fk is not null
      and completed_term is not null
    )
  );

create index if not exists idx_capstones_continued_to_term
  on capstones(continued_to_term)
  where closeout_decision = 'continue_to_course'
    and closeout_applied_at is null;

alter table course_reassignment_requests drop constraint if exists course_reassignment_requests_status_check;
alter table course_reassignment_requests
  add constraint course_reassignment_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

alter table course_reassignment_requests drop constraint if exists course_reassignment_requests_type_check;
alter table course_reassignment_requests
  add constraint course_reassignment_requests_type_check
  check (request_type in ('course_reassignment', 'project_submission_enrollment'));

alter table capstones drop constraint if exists capstones_status_check;
alter table capstones alter column approval set default false;
alter table capstones alter column approval set not null;
alter table capstones alter column archived set default false;
alter table capstones alter column archived set not null;
alter table capstones
  add constraint capstones_status_check
  check (
    status in (
      'draft',
      'approved_recruiting',
      'pending_review',
      'pending_admin_course_routing',
      'changes_requested',
      'rejected',
      'approved',
      'complete',
      'archived'
    )
  );

alter table capstones drop constraint if exists capstones_submission_track_check;
alter table capstones
  add constraint capstones_submission_track_check
  check (submission_track in ('home_course', 'interdisciplinary'));

alter table capstones drop constraint if exists capstones_approval_status_consistency;
alter table capstones
  add constraint capstones_approval_status_consistency
  check (
    (
      status in ('approved', 'approved_recruiting', 'complete')
      and approval is true
      and archived is false
    )
    or (
      status not in ('approved', 'approved_recruiting', 'complete')
      and approval is false
    )
  );

alter table capstones drop constraint if exists capstones_archive_status_consistency;
alter table capstones
  add constraint capstones_archive_status_consistency
  check (
    (
      status = 'archived'
      and archived is true
      and archived_at is not null
    )
    or (
      status <> 'archived'
      and archived is false
    )
  );

alter table teams drop constraint if exists teams_status_check;
alter table teams
  add constraint teams_status_check
  check (status in ('forming', 'finalized', 'archived'));

alter table capstone_course_approvals drop constraint if exists capstone_course_approvals_status_check;
alter table capstone_course_approvals
  add constraint capstone_course_approvals_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table capstone_course_approvals drop constraint if exists capstone_course_approvals_decision_metadata_check;
alter table capstone_course_approvals
  add constraint capstone_course_approvals_decision_metadata_check
  check (
    (
      status = 'pending'
      and decided_by_fk is null
      and decided_at is null
    )
    or (
      status in ('approved', 'rejected')
      and decided_by_fk is not null
      and decided_at is not null
    )
  );

alter table capstones drop constraint if exists capstones_text_lengths_check;
alter table capstones
  add constraint capstones_text_lengths_check
  check (
    char_length(title) between 1 and 200
    and (description is null or char_length(description) <= 5000)
    and (project_start_date is null or char_length(project_start_date) <= 100)
    and (problem_area is null or char_length(problem_area) <= 1000)
    and (main_objectives is null or char_length(main_objectives) <= 3000)
    and (scope_of_work is null or char_length(scope_of_work) <= 3000)
    and (deliverables is null or char_length(deliverables) <= 3000)
    and (meeting_frequency is null or char_length(meeting_frequency) <= 100)
    and (uw_resources is null or char_length(uw_resources) <= 2000)
    and (org_resources is null or char_length(org_resources) <= 2000)
    and (other_resources is null or char_length(other_resources) <= 2000)
    and (how_heard_about_capstone is null or char_length(how_heard_about_capstone) <= 1000)
    and coalesce(array_length(deliverable_types, 1), 0) <= 25
    and (proposed_team_members is null or char_length(proposed_team_members) <= 2000)
    and (success_criteria is null or char_length(success_criteria) <= 3000)
    and (validation_plan is null or char_length(validation_plan) <= 3000)
    and (stakeholders is null or char_length(stakeholders) <= 2000)
    and (risks_constraints is null or char_length(risks_constraints) <= 3000)
    and (organization_name is null or char_length(organization_name) <= 200)
    and (primary_contact is null or char_length(primary_contact) <= 200)
    and (email is null or char_length(email) <= 320)
    and (phone is null or char_length(phone) <= 50)
    and (website is null or char_length(website) <= 500)
    and (organization_description is null or char_length(organization_description) <= 5000)
    and (organization_size is null or char_length(organization_size) <= 100)
    and (sector is null or char_length(sector) <= 200)
    and coalesce(array_length(disciplines, 1), 0) <= 25
    and coalesce(array_length(skills, 1), 0) <= 50
  );

alter table student_profile drop constraint if exists student_profile_content_len_check;
alter table student_profile
  add constraint student_profile_content_len_check
  check (
    (headline is null or char_length(headline) <= 120)
    and (about_me is null or char_length(about_me) <= 600)
    and coalesce(array_length(skills, 1), 0) <= 25
    and coalesce(array_length(preferred_roles, 1), 0) <= 8
    and coalesce(array_length(project_interests, 1), 0) <= 10
    and (availability is null or char_length(availability) <= 80)
    and (portfolio_url is null or char_length(portfolio_url) <= 500)
    and (linkedin_url is null or char_length(linkedin_url) <= 500)
    and (github_url is null or char_length(github_url) <= 500)
    and profile_visibility in ('team_network', 'students', 'private')
  );

alter table approvals drop constraint if exists approvals_comments_len_check;
alter table approvals
  add constraint approvals_comments_len_check
  check (comments is null or char_length(comments) <= 2000);

alter table capstone_course_approvals drop constraint if exists capstone_course_approvals_comments_len_check;
alter table capstone_course_approvals
  add constraint capstone_course_approvals_comments_len_check
  check (comments is null or char_length(comments) <= 2000);

alter table audit_log drop constraint if exists audit_log_reason_len_check;
alter table audit_log
  add constraint audit_log_reason_len_check
  check (reason is null or char_length(reason) <= 2000);

create or replace function watmatch_cancel_pending_submission_enrollment_requests(
  p_student_id bigint,
  p_actor_id bigint default null,
  p_actor_role text default 'system',
  p_reason text default 'Project submission enrollment request is no longer actionable.'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Project submission enrollment request is no longer actionable.');
  v_actor_role text := coalesce(nullif(btrim(coalesce(p_actor_role, '')), ''), 'system');
  v_count integer := 0;
begin
  if p_student_id is null then
    return 0;
  end if;

  with cancelled as (
    update course_reassignment_requests crr
    set status = 'cancelled',
        decided_by_fk = p_actor_id,
        decided_at = now(),
        comments = v_reason,
        updated_at = now()
    where crr.status = 'pending'
      and crr.request_type = 'project_submission_enrollment'
      and crr.student_fk = p_student_id
    returning *
  ),
  audited as (
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    select
      p_actor_id,
      v_actor_role,
      'project_submission_enrollment_cancelled',
      'course_reassignment_request',
      cancelled.request_id::text,
      v_reason,
      jsonb_build_object(
        'request_id', cancelled.request_id,
        'student_fk', cancelled.student_fk,
        'requested_course_fk', cancelled.to_course_fk
      )
    from cancelled
    returning 1
  )
  select count(*)
    into v_count
  from cancelled;

  return v_count;
end;
$$;

create or replace function watmatch_clear_interest_when_not_approved_recruiting()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

create or replace function watmatch_get_recruiting_capstones(
  p_page integer default null,
  p_page_size integer default null,
  p_search text default null,
  p_department text default null,
  p_year text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := case when p_page is not null and p_page > 0 then p_page else null end;
  v_page_size integer := case when p_page_size is not null and p_page_size > 0 then p_page_size else null end;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_pattern text;
  v_department text := nullif(lower(btrim(coalesce(p_department, ''))), '');
  v_year text := nullif(btrim(coalesce(p_year, '')), '');
  v_limit integer := case when v_page is not null and v_page_size is not null then v_page_size else null end;
  v_offset integer := case when v_page is not null and v_page_size is not null then (v_page - 1) * v_page_size else 0 end;
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if v_department = 'all' then
    v_department := null;
  end if;

  if lower(coalesce(v_year, '')) = 'all' then
    v_year := null;
  end if;
  if v_year is not null and v_year !~ '^[0-9]{4}$' then
    v_year := null;
  end if;

  if v_search is not null then
    v_search_pattern := '%' || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_') || '%';
  end if;

  with filtered as (
    select
      c.*,
      c.external_partner_name as public_external_partner_name,
      c.external_partner_organization as public_external_partner_organization,
      case
        when c.partner_opportunity_fk is null or partner_user.active is true
        then c.external_partner_email
        else null
      end as public_external_partner_email,
      case
        when c.partner_opportunity_fk is null or partner_user.active is true
        then c.external_partner_website
        else null
      end as public_external_partner_website
    from capstones c
    left join partner_opportunities po
      on po.partner_opportunity_id = c.partner_opportunity_fk
    left join users partner_user
      on partner_user.user_id = po.partner_user_fk
    where c.status = 'approved_recruiting'
      and c.archived is false
      and (
        v_search is null
        or c.title ilike v_search_pattern escape '!'
        or c.description ilike v_search_pattern escape '!'
      )
      and (
        v_department is null
        or exists (
          select 1
          from unnest(coalesce(c.disciplines, '{}'::text[])) as discipline(value)
          where lower(btrim(discipline.value)) = v_department
        )
      )
      and (
        v_year is null
        or (
          v_year ~ '^[0-9]{4}$'
          and c.created_at >= make_timestamptz(v_year::integer, 1, 1, 0, 0, 0, 'UTC')
          and c.created_at < make_timestamptz(v_year::integer + 1, 1, 1, 0, 0, 0, 'UTC')
        )
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, capstone_id desc
    offset v_offset
    limit v_limit
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'capstone_id', paged.capstone_id,
            'title', paged.title,
            'description', paged.description,
            'public_status', 'recruiting',
            'disciplines', coalesce(to_jsonb(paged.disciplines), '[]'::jsonb),
            'department_ids', coalesce(
              (
                select jsonb_agg(cd.department_fk order by d.name)
                from capstone_departments cd
                join departments d on d.department_id = cd.department_fk
                where cd.capstone_fk = paged.capstone_id
              ),
              '[]'::jsonb
            ),
            'departments', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'department_id', d.department_id,
                    'name', d.name,
                    'active', d.active
                  )
                  order by d.name
                )
                from capstone_departments cd
                join departments d on d.department_id = cd.department_fk
                where cd.capstone_fk = paged.capstone_id
              ),
              '[]'::jsonb
            ),
            'skills', coalesce(to_jsonb(paged.skills), '[]'::jsonb),
            'created_at', paged.created_at,
            'closeout_decision', paged.closeout_decision,
            'closeout_decided_at', paged.closeout_decided_at,
            'closeout_applied_at', paged.closeout_applied_at,
            'continued_to_course_fk', paged.continued_to_course_fk,
            'continued_to_term', paged.continued_to_term,
            'published_past_capstone_fk', paged.published_past_capstone_fk,
            'published_watmatch_past_capstone_fk', paged.published_watmatch_past_capstone_fk,
            'carry_over_read_only', coalesce(paged.carry_over_read_only, false),
            'marketplace_phase', watmatch_effective_marketplace_phase_for_capstone(paged.capstone_id),
            'marketplace_phase_context', watmatch_marketplace_phase_context_for_capstone(paged.capstone_id),
            'can_express_interest', watmatch_capstone_accepts_marketplace_activity(paged.capstone_id),
            'marketplace_action_state', case
              when watmatch_capstone_accepts_marketplace_activity(paged.capstone_id) then 'actionable'
              else 'read_only'
            end,
            'read_only_reason', watmatch_capstone_marketplace_read_only_reason(paged.capstone_id),
            'external_partner_name', paged.public_external_partner_name,
            'external_partner_organization', paged.public_external_partner_organization,
            'external_partner_email', paged.public_external_partner_email,
            'external_partner_website', paged.public_external_partner_website,
            'support_summary', watmatch_capstone_support_summary(paged.capstone_id)
          )
          order by paged.created_at desc, paged.capstone_id desc
        )
        from paged
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

create or replace function watmatch_get_finalized_capstones(
  p_page integer default null,
  p_page_size integer default null,
  p_search text default null,
  p_department text default null,
  p_year text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := case when p_page is not null and p_page > 0 then p_page else null end;
  v_page_size integer := case when p_page_size is not null and p_page_size > 0 then p_page_size else null end;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_pattern text;
  v_department text := nullif(lower(btrim(coalesce(p_department, ''))), '');
  v_year text := nullif(btrim(coalesce(p_year, '')), '');
  v_limit integer := case when v_page is not null and v_page_size is not null then v_page_size else null end;
  v_offset integer := case when v_page is not null and v_page_size is not null then (v_page - 1) * v_page_size else 0 end;
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if v_department = 'all' then
    v_department := null;
  end if;

  if lower(coalesce(v_year, '')) = 'all' then
    v_year := null;
  end if;
  if v_year is not null and v_year !~ '^[0-9]{4}$' then
    v_year := null;
  end if;

  if v_search is not null then
    v_search_pattern := '%' || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_') || '%';
  end if;

  with filtered as (
    select
      c.*,
      c.external_partner_name as public_external_partner_name,
      c.external_partner_organization as public_external_partner_organization,
      case
        when c.partner_opportunity_fk is null or partner_user.active is true
        then c.external_partner_email
        else null
      end as public_external_partner_email,
      case
        when c.partner_opportunity_fk is null or partner_user.active is true
        then c.external_partner_website
        else null
      end as public_external_partner_website
    from capstones c
    join teams t on t.team_id = c.team_fk
    left join partner_opportunities po
      on po.partner_opportunity_id = c.partner_opportunity_fk
    left join users partner_user
      on partner_user.user_id = po.partner_user_fk
    where c.status in ('approved', 'complete')
      and c.approval is true
      and c.archived is false
      and t.status = 'finalized'
      and (
        v_search is null
        or c.title ilike v_search_pattern escape '!'
        or c.description ilike v_search_pattern escape '!'
      )
      and (
        v_department is null
        or exists (
          select 1
          from unnest(coalesce(c.disciplines, '{}'::text[])) as discipline(value)
          where lower(btrim(discipline.value)) = v_department
        )
      )
      and (
        v_year is null
        or (
          v_year ~ '^[0-9]{4}$'
          and c.created_at >= make_timestamptz(v_year::integer, 1, 1, 0, 0, 0, 'UTC')
          and c.created_at < make_timestamptz(v_year::integer + 1, 1, 1, 0, 0, 0, 'UTC')
        )
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by updated_at desc, created_at desc, capstone_id desc
    offset v_offset
    limit v_limit
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'capstone_id', paged.capstone_id,
            'title', paged.title,
            'description', paged.description,
            'public_status', case when paged.status = 'complete' then 'complete' else 'finalized' end,
            'status', paged.status,
            'disciplines', coalesce(to_jsonb(paged.disciplines), '[]'::jsonb),
            'department_ids', coalesce(
              (
                select jsonb_agg(cd.department_fk order by d.name)
                from capstone_departments cd
                join departments d on d.department_id = cd.department_fk
                where cd.capstone_fk = paged.capstone_id
              ),
              '[]'::jsonb
            ),
            'departments', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'department_id', d.department_id,
                    'name', d.name,
                    'active', d.active
                  )
                  order by d.name
                )
                from capstone_departments cd
                join departments d on d.department_id = cd.department_fk
                where cd.capstone_fk = paged.capstone_id
              ),
              '[]'::jsonb
            ),
            'skills', coalesce(to_jsonb(paged.skills), '[]'::jsonb),
            'created_at', paged.created_at,
            'updated_at', paged.updated_at,
            'completed_at', paged.completed_at,
            'completed_by_fk', paged.completed_by_fk,
            'completed_term', paged.completed_term,
            'completion_notes', paged.completion_notes,
            'closeout_decision', paged.closeout_decision,
            'closeout_decided_at', paged.closeout_decided_at,
            'closeout_applied_at', paged.closeout_applied_at,
            'continued_to_course_fk', paged.continued_to_course_fk,
            'continued_to_term', paged.continued_to_term,
            'published_past_capstone_fk', paged.published_past_capstone_fk,
            'published_watmatch_past_capstone_fk', paged.published_watmatch_past_capstone_fk,
            'carry_over_read_only', coalesce(paged.carry_over_read_only, false),
            'marketplace_phase', watmatch_effective_marketplace_phase_for_capstone(paged.capstone_id),
            'marketplace_phase_context', watmatch_marketplace_phase_context_for_capstone(paged.capstone_id),
            'can_express_interest', false,
            'marketplace_action_state', 'finalized',
            'read_only_reason', case
              when paged.status = 'complete' then 'This capstone has been completed and is available for browsing only.'
              else 'This capstone has been finalized and is available for browsing only.'
            end,
            'external_partner_name', paged.public_external_partner_name,
            'external_partner_organization', paged.public_external_partner_organization,
            'external_partner_email', paged.public_external_partner_email,
            'external_partner_website', paged.public_external_partner_website,
            'support_summary', watmatch_capstone_support_summary(paged.capstone_id)
          )
          order by paged.updated_at desc, paged.created_at desc, paged.capstone_id desc
        )
        from paged
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

create or replace function watmatch_get_finalized_capstone_metadata()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departments jsonb := '[]'::jsonb;
  v_years jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(name order by lower(name)), '[]'::jsonb)
  into v_departments
  from departments
  where active is true;

  with distinct_years as (
    select distinct to_char(c.created_at, 'YYYY') as year
    from capstones c
    join teams t on t.team_id = c.team_fk
    where c.status in ('approved', 'complete')
      and c.approval is true
      and c.archived is false
      and t.status = 'finalized'
      and c.created_at is not null
  )
  select coalesce(jsonb_agg(year order by year desc), '[]'::jsonb)
  into v_years
  from distinct_years;

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'departments', v_departments,
      'years', v_years
    )
  );
end;
$$;

create or replace function watmatch_get_recruiting_capstone_metadata()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departments jsonb := '[]'::jsonb;
  v_years jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(name order by lower(name)), '[]'::jsonb)
  into v_departments
  from departments
  where active is true;

  with distinct_years as (
    select distinct to_char(created_at, 'YYYY') as year
    from capstones
    where status = 'approved_recruiting'
      and archived is false
      and created_at is not null
  )
  select coalesce(jsonb_agg(year order by year desc), '[]'::jsonb)
  into v_years
  from distinct_years;

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'departments', v_departments,
      'years', v_years
    )
  );
end;
$$;

drop function if exists watmatch_get_past_capstones(integer, integer, text, text, text);

create or replace function watmatch_get_past_capstones(
  p_page integer default 1,
  p_page_size integer default 20,
  p_search text default null,
  p_department text default null,
  p_year text default null,
  p_student_id bigint default null,
  p_saved_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_pattern text;
  v_department text := nullif(lower(btrim(coalesce(p_department, ''))), '');
  v_year text := nullif(btrim(coalesce(p_year, '')), '');
  v_saved_only boolean := coalesce(p_saved_only, false);
  v_offset integer := (v_page - 1) * v_page_size;
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if v_department = 'all' then
    v_department := null;
  end if;

  if lower(coalesce(v_year, '')) = 'all' then
    v_year := null;
  end if;

  if v_search is not null then
    v_search_pattern := '%' || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_') || '%';
  end if;

  with filtered as (
    select
      p.*,
      (s.shortlist_id is not null) as is_shortlisted,
      s.created_at as shortlisted_at
    from past_capstones p
    left join student_past_capstone_shortlists s
      on s.past_capstone_fk = p.past_capstone_id
     and s.student_fk = p_student_id
    where (
        v_year is null
        or p.year = v_year
      )
      and (
        v_search is null
        or p.title ilike v_search_pattern escape '!'
        or p.description ilike v_search_pattern escape '!'
      )
      and (
        v_department is null
        or exists (
          select 1
          from unnest(coalesce(p.department, '{}'::text[])) as department(value)
          where lower(btrim(department.value)) = v_department
        )
      )
      and (
        not v_saved_only
        or s.shortlist_id is not null
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by year desc, created_at desc, past_capstone_id desc
    offset v_offset
    limit v_page_size
  )
  select
    coalesce((select total from counted), 0),
    coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb)
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', case when v_page_size > 0 then ceil(v_total::numeric / v_page_size)::integer else 1 end
  );
end;
$$;

create or replace function watmatch_get_past_capstone_metadata()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departments jsonb := '[]'::jsonb;
  v_years jsonb := '[]'::jsonb;
  v_courses jsonb := '[]'::jsonb;
begin
  with department_values as (
    select nullif(btrim(department.value), '') as department
    from past_capstones p
    cross join lateral unnest(coalesce(p.department, '{}'::text[])) as department(value)
  ),
  distinct_departments as (
    select distinct department
    from department_values
    where department is not null
  )
  select coalesce(jsonb_agg(department order by lower(department)), '[]'::jsonb)
  into v_departments
  from distinct_departments;

  with distinct_years as (
    select distinct year
    from past_capstones
    where year is not null
  )
  select coalesce(jsonb_agg(year order by year desc), '[]'::jsonb)
  into v_years
  from distinct_years;

  with source_courses as (
    select distinct source_fk
    from past_capstones
    where source_fk is not null
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by c.code, c.name, c.course_id), '[]'::jsonb)
  into v_courses
  from courses c
  where c.course_id in (select source_fk from source_courses);

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'departments', v_departments,
      'years', v_years,
      'courses', v_courses
    )
  );
end;
$$;

drop function if exists watmatch_get_past_watmatch_capstones(integer, integer, text, text, text);

create or replace function watmatch_get_past_watmatch_capstones(
  p_page integer default 1,
  p_page_size integer default 20,
  p_search text default null,
  p_department text default null,
  p_year text default null,
  p_student_id bigint default null,
  p_saved_only boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_pattern text;
  v_department text := nullif(lower(btrim(coalesce(p_department, ''))), '');
  v_year text := nullif(btrim(coalesce(p_year, '')), '');
  v_saved_only boolean := coalesce(p_saved_only, false);
  v_offset integer := (v_page - 1) * v_page_size;
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if v_department = 'all' then
    v_department := null;
  end if;

  if lower(coalesce(v_year, '')) = 'all' then
    v_year := null;
  end if;

  if v_search is not null then
    v_search_pattern := '%' || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_') || '%';
  end if;

  with filtered as (
    select
      p.*,
      (s.shortlist_id is not null) as is_shortlisted,
      s.created_at as shortlisted_at
    from past_watmatch_capstones p
    left join student_past_capstone_shortlists s
      on s.past_watmatch_capstone_fk = p.past_watmatch_capstone_id
     and s.student_fk = p_student_id
    where (
        v_year is null
        or p.year = v_year
      )
      and (
        v_search is null
        or p.title ilike v_search_pattern escape '!'
        or p.description ilike v_search_pattern escape '!'
        or p.problem_area ilike v_search_pattern escape '!'
        or p.main_objectives ilike v_search_pattern escape '!'
      )
      and (
        v_department is null
        or exists (
          select 1
          from unnest(coalesce(p.department, '{}'::text[])) as department(value)
          where lower(btrim(department.value)) = v_department
        )
      )
      and (
        not v_saved_only
        or s.shortlist_id is not null
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by year desc, created_at desc, past_watmatch_capstone_id desc
    offset v_offset
    limit v_page_size
  )
  select
    coalesce((select total from counted), 0),
    coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb)
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', case when v_page_size > 0 then ceil(v_total::numeric / v_page_size)::integer else 1 end
  );
end;
$$;

create or replace function watmatch_get_past_watmatch_capstone_metadata()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departments jsonb := '[]'::jsonb;
  v_years jsonb := '[]'::jsonb;
  v_courses jsonb := '[]'::jsonb;
begin
  with department_values as (
    select nullif(btrim(department.value), '') as department
    from past_watmatch_capstones p
    cross join lateral unnest(coalesce(p.department, '{}'::text[])) as department(value)
  ),
  distinct_departments as (
    select distinct department
    from department_values
    where department is not null
  )
  select coalesce(jsonb_agg(department order by lower(department)), '[]'::jsonb)
  into v_departments
  from distinct_departments;

  with distinct_years as (
    select distinct year
    from past_watmatch_capstones
    where year is not null
  )
  select coalesce(jsonb_agg(year order by year desc), '[]'::jsonb)
  into v_years
  from distinct_years;

  with source_courses as (
    select distinct source_fk
    from past_watmatch_capstones
    where source_fk is not null
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by c.code, c.name, c.course_id), '[]'::jsonb)
  into v_courses
  from courses c
  where c.course_id in (select source_fk from source_courses);

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'departments', v_departments,
      'years', v_years,
      'courses', v_courses
    )
  );
end;
$$;

drop function if exists watmatch_upsert_past_capstone_shortlist(bigint, text, bigint);

create or replace function watmatch_upsert_past_capstone_shortlist(
  p_student_id bigint,
  p_source_type text,
  p_source_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
  v_source_type text := lower(btrim(coalesce(p_source_type, '')));
  v_shortlist student_past_capstone_shortlists%rowtype;
begin
  if p_student_id is null or p_source_id is null or p_source_id <= 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid past capstone shortlist request.', 'data', null);
  end if;

  if v_source_type in ('scraped', 'historical', 'imported', 'past') then
    v_source_type := 'historical';
  elsif v_source_type in ('watmatch', 'completed', 'watmatch_completed') then
    v_source_type := 'watmatch';
  else
    return jsonb_build_object('success', false, 'message', 'Unsupported past capstone source.', 'data', null);
  end if;

  select *
    into v_student
  from users
  where user_id = p_student_id;

  if not found or lower(coalesce(v_student.role, '')) <> 'student' or v_student.active is not true then
    return jsonb_build_object('success', false, 'message', 'Student access required.', 'data', null);
  end if;

  if v_source_type = 'historical' then
    if not exists (select 1 from past_capstones where past_capstone_id = p_source_id) then
      return jsonb_build_object('success', false, 'message', 'Past capstone not found.', 'data', null);
    end if;

    insert into student_past_capstone_shortlists (student_fk, past_capstone_fk)
    values (p_student_id, p_source_id)
    on conflict (student_fk, past_capstone_fk) where past_capstone_fk is not null
    do update set updated_at = now()
    returning * into v_shortlist;
  else
    if not exists (select 1 from past_watmatch_capstones where past_watmatch_capstone_id = p_source_id) then
      return jsonb_build_object('success', false, 'message', 'Completed WatMatch capstone not found.', 'data', null);
    end if;

    insert into student_past_capstone_shortlists (student_fk, past_watmatch_capstone_fk)
    values (p_student_id, p_source_id)
    on conflict (student_fk, past_watmatch_capstone_fk) where past_watmatch_capstone_fk is not null
    do update set updated_at = now()
    returning * into v_shortlist;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Past capstone saved.',
    'data', jsonb_build_object(
      'shortlist_id', v_shortlist.shortlist_id,
      'source_type', v_source_type,
      'source_id', p_source_id,
      'past_capstone_id', v_shortlist.past_capstone_fk,
      'past_watmatch_capstone_id', v_shortlist.past_watmatch_capstone_fk,
      'is_shortlisted', true,
      'shortlisted_at', v_shortlist.created_at
    )
  );
end;
$$;

drop function if exists watmatch_delete_past_capstone_shortlist(bigint, text, bigint);

create or replace function watmatch_delete_past_capstone_shortlist(
  p_student_id bigint,
  p_source_type text,
  p_source_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
  v_source_type text := lower(btrim(coalesce(p_source_type, '')));
  v_deleted student_past_capstone_shortlists%rowtype;
begin
  if p_student_id is null or p_source_id is null or p_source_id <= 0 then
    return jsonb_build_object('success', false, 'message', 'Invalid past capstone shortlist request.', 'data', null);
  end if;

  if v_source_type in ('scraped', 'historical', 'imported', 'past') then
    v_source_type := 'historical';
  elsif v_source_type in ('watmatch', 'completed', 'watmatch_completed') then
    v_source_type := 'watmatch';
  else
    return jsonb_build_object('success', false, 'message', 'Unsupported past capstone source.', 'data', null);
  end if;

  select *
    into v_student
  from users
  where user_id = p_student_id;

  if not found or lower(coalesce(v_student.role, '')) <> 'student' or v_student.active is not true then
    return jsonb_build_object('success', false, 'message', 'Student access required.', 'data', null);
  end if;

  if v_source_type = 'historical' then
    delete from student_past_capstone_shortlists
    where student_fk = p_student_id
      and past_capstone_fk = p_source_id
    returning * into v_deleted;
  else
    delete from student_past_capstone_shortlists
    where student_fk = p_student_id
      and past_watmatch_capstone_fk = p_source_id
    returning * into v_deleted;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', case when v_deleted.shortlist_id is null then 'Past capstone was not saved.' else 'Past capstone removed from saved list.' end,
    'data', jsonb_build_object(
      'source_type', v_source_type,
      'source_id', p_source_id,
      'is_shortlisted', false,
      'removed', v_deleted.shortlist_id is not null
    )
  );
end;
$$;

drop function if exists watmatch_list_student_past_capstone_shortlists(bigint, integer);

create or replace function watmatch_list_student_past_capstone_shortlists(
  p_student_id bigint,
  p_limit integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 6), 1), 50);
  v_data jsonb := '[]'::jsonb;
begin
  if p_student_id is null then
    return jsonb_build_object('success', false, 'message', 'Invalid student identity.', 'data', null);
  end if;

  select *
    into v_student
  from users
  where user_id = p_student_id;

  if not found or lower(coalesce(v_student.role, '')) <> 'student' or v_student.active is not true then
    return jsonb_build_object('success', false, 'message', 'Student access required.', 'data', null);
  end if;

  with saved_items as (
    select
      s.shortlist_id,
      'historical'::text as source_type,
      p.past_capstone_id as source_id,
      p.past_capstone_id,
      null::bigint as past_watmatch_capstone_id,
      s.created_at as shortlisted_at,
      true as is_shortlisted,
      p.title,
      p.description,
      p.department,
      p.year,
      p.students,
      p.source_fk,
      null::text as completed_term,
      '{}'::text[] as skills,
      '{}'::text[] as deliverable_types,
      null::text as mentor_name,
      null::text as external_partner_name,
      null::text as external_partner_organization
    from student_past_capstone_shortlists s
    join past_capstones p on p.past_capstone_id = s.past_capstone_fk
    where s.student_fk = p_student_id
      and s.past_capstone_fk is not null

    union all

    select
      s.shortlist_id,
      'watmatch'::text as source_type,
      p.past_watmatch_capstone_id as source_id,
      null::bigint as past_capstone_id,
      p.past_watmatch_capstone_id,
      s.created_at as shortlisted_at,
      true as is_shortlisted,
      p.title,
      p.description,
      p.department,
      p.year,
      p.students,
      p.source_fk,
      p.completed_term,
      p.skills,
      p.deliverable_types,
      p.mentor_name,
      p.external_partner_name,
      p.external_partner_organization
    from student_past_capstone_shortlists s
    join past_watmatch_capstones p on p.past_watmatch_capstone_id = s.past_watmatch_capstone_fk
    where s.student_fk = p_student_id
      and s.past_watmatch_capstone_fk is not null
  ),
  paged as (
    select *
    from saved_items
    order by shortlisted_at desc, shortlist_id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(to_jsonb(paged) order by shortlisted_at desc, shortlist_id desc), '[]'::jsonb)
  into v_data
  from paged;

  return jsonb_build_object(
    'success', true,
    'message', 'Saved past capstones retrieved.',
    'data', v_data
  );
end;
$$;

create or replace function watmatch_target_course_fk(
  p_capstone_id bigint,
  p_team_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_fk bigint;
begin
  select course_fk
    into v_course_fk
  from capstones
  where capstone_id = p_capstone_id;

  if v_course_fk is not null then
    return v_course_fk;
  end if;

  select course_fk
    into v_course_fk
  from teams
  where team_id = p_team_id;

  if v_course_fk is not null then
    return v_course_fk;
  end if;

  select u.course_fk
    into v_course_fk
  from teams t
  join users u on u.user_id = t.leader_fk
  where t.team_id = p_team_id;

  return v_course_fk;
end;
$$;

create or replace function watmatch_team_has_course_mismatch(
  p_team_id bigint,
  p_target_course_fk bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_team_id is null or p_target_course_fk is null then
    return false;
  end if;

  return exists (
    select 1
    from team_memberships tm
    where tm.team_fk = p_team_id
      and tm.enrollment_course_fk is not null
      and tm.enrollment_course_fk <> p_target_course_fk
  );
end;
$$;

create or replace function watmatch_sync_course_reassignment_requests(
  p_capstone_id bigint,
  p_team_id bigint,
  p_target_course_fk bigint,
  p_requested_by_fk bigint,
  p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_capstone_id is null or p_team_id is null or p_target_course_fk is null then
    return;
  end if;

  update course_reassignment_requests crr
  set status = 'cancelled',
      decided_by_fk = p_requested_by_fk,
      decided_at = v_now,
      comments = coalesce(p_comments, 'Legacy same-course reassignment signal cleared; official enrollment is tracked per team member.'),
      updated_at = v_now
  where crr.capstone_fk = p_capstone_id
    and crr.status = 'pending'
    and crr.request_type = 'course_reassignment';
end;
$$;

create or replace function watmatch_apply_course_reassignment_requests(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_current_course_fk bigint;
  v_now timestamptz := now();
begin
  for v_request in
    select *
    from course_reassignment_requests
    where capstone_fk = p_capstone_id
      and status = 'pending'
      and request_type = 'course_reassignment'
    for update
  loop
    select course_fk
      into v_current_course_fk
    from users
    where user_id = v_request.student_fk
    for update;

    perform watmatch_assert_course_ready_for_review(
      v_request.to_course_fk,
      'Pending reassignment target course'
    );

    if v_current_course_fk is distinct from v_request.to_course_fk then
      update users
      set course_fk = v_request.to_course_fk,
          updated_at = v_now
      where user_id = v_request.student_fk;
    end if;

    update course_reassignment_requests
    set status = 'approved',
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        comments = coalesce(p_comments, comments),
        updated_at = v_now
    where request_id = v_request.request_id;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      lower(coalesce(p_actor_role, '')),
      'student_course_reassigned_for_capstone',
      'user',
      v_request.student_fk::text,
      'Student course reassigned after routed capstone approval.',
      jsonb_build_object(
        'capstone_fk', p_capstone_id,
        'team_fk', v_request.team_fk,
        'from_course_fk', v_current_course_fk,
        'to_course_fk', v_request.to_course_fk,
        'request_id', v_request.request_id
      )
    );
  end loop;
end;
$$;

create or replace function watmatch_route_capstone_status(
  p_capstone_id bigint,
  p_team_id bigint,
  p_actor_id bigint default null,
  p_force_admin_routing boolean default false
)
returns capstones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_target_course_fk bigint;
  v_status text;
  v_now timestamptz := now();
begin
  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
  end if;

  v_target_course_fk := watmatch_target_course_fk(p_capstone_id, p_team_id);

  if v_target_course_fk is null then
    raise exception 'No target course found for this capstone.' using errcode = '23514';
  end if;

  perform watmatch_reset_capstone_course_requirements(p_capstone_id, p_team_id);

  if p_force_admin_routing
     or (
       watmatch_team_has_course_mismatch(p_team_id, v_target_course_fk)
       and v_capstone.course_routed_at is null
     ) then
    v_status := 'pending_admin_course_routing';
    update course_reassignment_requests
    set status = 'cancelled',
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        comments = 'Capstone is awaiting course routing.',
        updated_at = v_now
    where capstone_fk = p_capstone_id
      and status = 'pending';
  else
    v_status := 'pending_review';
    perform watmatch_assert_course_ready_for_review(v_target_course_fk, 'Target course');
    perform watmatch_sync_course_reassignment_requests(
      p_capstone_id,
      p_team_id,
      v_target_course_fk,
      coalesce(v_capstone.course_routed_by_fk, p_actor_id),
      v_capstone.course_routing_notes
    );
  end if;

  update capstones
  set approval = false,
      status = v_status,
      course_fk = v_target_course_fk,
      course_routed_by_fk = case when v_status = 'pending_admin_course_routing' then null else course_routed_by_fk end,
      course_routed_at = case when v_status = 'pending_admin_course_routing' then null else course_routed_at end,
      course_routing_notes = case when v_status = 'pending_admin_course_routing' then null else course_routing_notes end,
      updated_at = v_now
  where capstone_id = p_capstone_id
  returning * into v_capstone;

  update teams
  set course_fk = v_target_course_fk
  where team_id = p_team_id;

  return v_capstone;
end;
$$;

create or replace function watmatch_course_has_active_instructor(p_course_id bigint)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from users u
    where u.course_fk = p_course_id
      and u.active is true
      and lower(coalesce(u.role, '')) = 'instructor'
  );
$$;

create or replace function watmatch_season_from_term(p_term text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(split_part(coalesce(p_term, ''), ' ', 1), '') in ('Winter', 'Spring', 'Fall')
      then split_part(p_term, ' ', 1)
    else null
  end;
$$;

create or replace function watmatch_current_marketplace_term()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_term text;
begin
  if to_regclass('public.marketplace_settings') is not null then
    select current_term
      into v_term
    from marketplace_settings
    where setting_id = 1;
  end if;

  v_term := nullif(btrim(coalesce(v_term, '')), '');
  if v_term is not null and v_term ~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    return v_term;
  end if;

  return watmatch_default_marketplace_term();
end;
$$;

create or replace function watmatch_current_marketplace_season()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_term text;
  v_month integer := extract(month from current_date)::integer;
begin
  if to_regclass('public.marketplace_settings') is not null then
    select current_term
      into v_term
    from marketplace_settings
    where setting_id = 1;
  end if;

  v_term := nullif(btrim(coalesce(v_term, '')), '');
  if v_term is not null then
    return watmatch_season_from_term(v_term);
  end if;

  return case
    when v_month between 1 and 4 then 'Winter'
    when v_month between 5 and 8 then 'Spring'
    else 'Fall'
  end;
end;
$$;

create or replace function watmatch_course_has_term_offering(
  p_course_id bigint,
  p_target_term text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from course_offerings offering
    where offering.course_fk = p_course_id
      and offering.term = p_target_term
      and offering.status <> 'archived'
  );
$$;

create or replace function watmatch_course_has_active_term_offering(
  p_course_id bigint,
  p_target_term text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from course_offerings offering
    where offering.course_fk = p_course_id
      and offering.term = p_target_term
      and offering.status = 'active'
  );
$$;

create or replace function watmatch_current_course_offering_json(p_course_id bigint)
returns jsonb
language sql
stable
set search_path = public
as $$
  select to_jsonb(offering_row)
  from (
    select
      offering.*,
      case
        when ecosystem.ecosystem_id is null then null
        else jsonb_build_object(
          'ecosystem_id', ecosystem.ecosystem_id,
          'name', ecosystem.name,
          'description', ecosystem.description,
          'active', ecosystem.active
        )
      end as ecosystem,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'course_id', held_course.course_id,
              'code', held_course.code,
              'name', held_course.name,
              'notes', held.notes
            )
            order by held_course.code, held_course.name
          )
          from course_offering_held_with held
          join courses held_course on held_course.course_id = held.held_with_course_fk
          where held.course_offering_fk = offering.course_offering_id
        ),
        '[]'::jsonb
      ) as held_with_courses
    from course_offerings offering
    left join project_ecosystems ecosystem on ecosystem.ecosystem_id = offering.ecosystem_fk
    where offering.course_fk = p_course_id
      and offering.term = watmatch_current_marketplace_term()
      and offering.status <> 'archived'
    order by
      case offering.status
        when 'active' then 0
        when 'draft' then 1
        when 'inactive' then 2
        else 3
      end,
      offering.updated_at desc nulls last,
      offering.course_offering_id desc
    limit 1
  ) offering_row;
$$;

create or replace function watmatch_normalize_course_active_terms(p_active_terms text[])
returns text[]
language sql
immutable
set search_path = public
as $$
  with raw_terms as (
    select distinct btrim(term) as season
    from unnest(coalesce(p_active_terms, '{}'::text[])) as term
    where btrim(term) in ('Winter', 'Spring', 'Fall')
  )
  select coalesce(
    array_agg(season order by array_position(array['Winter', 'Spring', 'Fall']::text[], season)),
    '{}'::text[]
  )
  from raw_terms;
$$;

create or replace function watmatch_course_should_be_active(
  p_active_terms text[],
  p_activation_mode text,
  p_course_id bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text := lower(coalesce(nullif(btrim(p_activation_mode), ''), 'auto'));
  v_terms text[] := watmatch_normalize_course_active_terms(p_active_terms);
  v_current_term text := watmatch_current_marketplace_term();
  v_current_season text := watmatch_current_marketplace_season();
begin
  if v_mode = 'force_inactive'
     or exists (
       select 1
       from courses c
       where c.course_id = p_course_id
         and coalesce(c.retired_for_routing, false) is true
     ) then
    return false;
  end if;

  if p_course_id is null or not watmatch_course_has_active_instructor(p_course_id) then
    return false;
  end if;

  if watmatch_course_has_term_offering(p_course_id, v_current_term) then
    return watmatch_course_has_active_term_offering(p_course_id, v_current_term);
  end if;

  if v_mode = 'force_active' then
    return true;
  end if;

  return v_current_season = any(v_terms);
end;
$$;

create or replace function watmatch_sync_single_course_activation(p_course_id bigint)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses%rowtype;
  v_next_active boolean;
begin
  if p_course_id is null then
    return null;
  end if;

  select *
    into v_course
  from courses
  where course_id = p_course_id
  for update;

  if not found then
    return null;
  end if;

  v_next_active := watmatch_course_should_be_active(
    v_course.active_terms,
    v_course.activation_mode,
    v_course.course_id
  );

  update courses
  set active = v_next_active
  where course_id = v_course.course_id
    and active is distinct from v_next_active;

  select *
    into v_course
  from courses
  where course_id = p_course_id;

  return v_course;
end;
$$;

create or replace function watmatch_sync_course_activation_for_current_term(
  p_actor_id bigint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
  v_current_season text := watmatch_current_marketplace_season();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_blocked_courses text;
begin
  select string_agg(coalesce(c.code, c.course_id::text), ', ' order by c.code, c.course_id)
    into v_blocked_courses
  from courses c
  where c.active is true
    and watmatch_course_should_be_active(c.active_terms, c.activation_mode, c.course_id) is false
    and exists (
      select 1
      from capstones cap
      where cap.course_fk = c.course_id
        and cap.archived is false
        and cap.status = 'pending_review'
    );

  if v_blocked_courses is not null then
    raise exception 'Resolve pending capstone reviews before changing the active marketplace term. Blocked course(s): %', v_blocked_courses
      using errcode = '23514';
  end if;

  with updated as (
    update courses c
    set active = watmatch_course_should_be_active(
      c.active_terms,
      c.activation_mode,
      c.course_id
    )
    where c.active is distinct from watmatch_course_should_be_active(
      c.active_terms,
      c.activation_mode,
      c.course_id
    )
    returning c.course_id
  )
  select count(*)::integer into v_updated_count from updated;

  update project_explorations pe
  set status = 'expired',
      decided_at = coalesce(pe.decided_at, now()),
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = now()
  from capstones c
  where pe.capstone_fk = c.capstone_id
    and pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
    and not watmatch_capstone_accepts_marketplace_activity(c.capstone_id);

  update project_commitment_requests pcr
  set status = 'cancelled',
      decided_at = coalesce(pcr.decided_at, now()),
      comments = coalesce(pcr.comments, 'Marketplace term changed; this commitment is no longer actionable.'),
      updated_at = now()
  from capstones c
  where pcr.capstone_fk = c.capstone_id
    and pcr.status = 'pending'
    and not watmatch_capstone_accepts_marketplace_activity(c.capstone_id);

  perform watmatch_clear_team_commitment_roster_if_idle(t.team_id)
  from teams t
  join capstones c on c.team_fk = t.team_id
  where not watmatch_capstone_accepts_marketplace_activity(c.capstone_id);

  if p_actor_id is not null then
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    select
      p_actor_id,
      coalesce(u.role, 'system'),
      'course_activation_synced',
      'course',
      'all',
      v_reason,
      jsonb_build_object(
        'current_season', v_current_season,
        'updated_count', v_updated_count
      )
    from users u
    where u.user_id = p_actor_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'current_season', v_current_season,
    'updated_count', v_updated_count
  );
end;
$$;

create or replace function watmatch_assert_course_ready_for_review(
  p_course_id bigint,
  p_label text default 'Target course'
)
returns courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses%rowtype;
  v_label text := coalesce(nullif(btrim(p_label), ''), 'Target course');
  v_current_term text := watmatch_current_marketplace_term();
begin
  if p_course_id is null then
    raise exception '% is required.', v_label using errcode = '22023';
  end if;

  select *
    into v_course
  from courses
  where course_id = p_course_id;

  if not found
     or coalesce(v_course.retired_for_routing, false) is true
     or coalesce(v_course.activation_mode, 'auto') = 'force_inactive' then
    raise exception '% is not active or does not exist.', v_label using errcode = 'P0002';
  end if;

  if watmatch_course_has_term_offering(p_course_id, v_current_term)
     and not watmatch_course_has_active_term_offering(p_course_id, v_current_term) then
    raise exception '% does not have an active course offering for the current marketplace term.', v_label
      using errcode = '23514';
  end if;

  if not watmatch_course_has_active_instructor(p_course_id) then
    raise exception '% must have an active instructor assigned before capstones can be routed for review.', v_label
      using errcode = '23514';
  end if;

  if not watmatch_course_available_for_term(p_course_id, v_current_term) then
    raise exception '% is not available for the current marketplace term.', v_label
      using errcode = '23514';
  end if;

  return v_course;
end;
$$;

create or replace function watmatch_capstone_accepts_marketplace_activity(p_capstone_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_target_course_fk bigint;
begin
  if p_capstone_id is null then
    return false;
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found
     or v_capstone.archived is true
     or v_capstone.status <> 'approved_recruiting'
     or v_capstone.team_fk is null
     or coalesce(v_capstone.carry_over_read_only, false) is true
     or v_capstone.closeout_decision is not null then
    return false;
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk;

  if not found or v_team.status in ('archived', 'finalized') then
    return false;
  end if;

  v_target_course_fk := watmatch_target_course_fk(v_capstone.capstone_id, v_team.team_id);

  if v_target_course_fk is null then
    return false;
  end if;

  return watmatch_course_available_for_term(
    v_target_course_fk,
    watmatch_current_marketplace_term()
  );
end;
$$;

create or replace function watmatch_capstone_marketplace_read_only_reason(p_capstone_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_target_course courses%rowtype;
  v_target_course_fk bigint;
  v_current_term text := watmatch_current_marketplace_term();
begin
  if p_capstone_id is null then
    return 'This capstone is not available for marketplace activity.';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found or v_capstone.archived is true then
    return 'This capstone is archived.';
  end if;

  if v_capstone.status <> 'approved_recruiting' then
    if v_capstone.status = 'complete' then
      return 'This capstone has been completed and is available for browsing only.';
    end if;
    if v_capstone.status = 'approved' then
      return 'This capstone has been finalized and is available for browsing only.';
    end if;
    return 'This capstone is not in the recruiting marketplace right now.';
  end if;

  if coalesce(v_capstone.carry_over_read_only, false) is true then
    return 'This capstone is carried over from another term and is available for browsing only.';
  end if;

  if v_capstone.closeout_decision is not null then
    return 'This capstone has a term closeout decision and is no longer accepting marketplace activity.';
  end if;

  if v_capstone.team_fk is null then
    return 'This capstone is not attached to a team.';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk;

  if not found or v_team.status in ('archived', 'finalized') then
    return 'This capstone team is no longer recruiting.';
  end if;

  v_target_course_fk := watmatch_target_course_fk(v_capstone.capstone_id, v_team.team_id);
  if v_target_course_fk is null then
    return 'This capstone does not have an official review course yet.';
  end if;

  select *
    into v_target_course
  from courses
  where course_id = v_target_course_fk;

  if not found then
    return 'This capstone course is no longer available.';
  end if;

  if not watmatch_course_available_for_term(v_target_course.course_id, v_current_term) then
    if watmatch_course_has_term_offering(v_target_course.course_id, v_current_term)
       and not watmatch_course_has_active_term_offering(v_target_course.course_id, v_current_term) then
      return 'This capstone is read-only because its current-term course offering is not active.';
    end if;

    if not watmatch_course_has_active_instructor(v_target_course.course_id) then
      return 'This capstone is read-only because its course does not have an active instructor assigned.';
    end if;

    return 'This capstone is read-only because its course is not available for the current marketplace term.';
  end if;

  return null;
end;
$$;

create or replace function watmatch_assert_instructor_can_leave_course(
  p_user_id bigint,
  p_next_course_id bigint,
  p_next_role text,
  p_next_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_role text;
  v_next_role text := lower(coalesce(p_next_role, ''));
  v_pending_count integer;
  v_other_instructor_count integer;
  v_course_active boolean := false;
begin
  if p_user_id is null then
    return;
  end if;

  select *
    into v_user
  from users
  where user_id = p_user_id;

  if not found then
    return;
  end if;

  v_role := lower(coalesce(v_user.role, ''));

  if v_role <> 'instructor'
     or v_user.active is not true
     or v_user.course_fk is null then
    return;
  end if;

  if v_next_role = 'instructor'
     and coalesce(p_next_active, true) is true
     and p_next_course_id is not distinct from v_user.course_fk then
    return;
  end if;

  select active is true
    into v_course_active
  from courses
  where course_id = v_user.course_fk;

  if coalesce(v_course_active, false) is not true then
    return;
  end if;

  select count(*)
    into v_other_instructor_count
  from users
  where user_id <> p_user_id
    and course_fk = v_user.course_fk
    and active is true
    and lower(coalesce(role, '')) = 'instructor';

  if v_other_instructor_count = 0 then
    select count(*)
      into v_pending_count
    from capstones
    where course_fk = v_user.course_fk
      and archived is false
      and status = 'pending_review';

    raise exception '%',
      case
        when v_pending_count > 0 then 'Cannot remove the last active instructor from an active course with pending capstone reviews.'
        else 'Cannot remove the last active instructor from an active course. Deactivate the course first or assign another active instructor.'
      end
      using errcode = '23514';
  end if;
end;
$$;

create or replace function watmatch_assert_active_course_instructor_invariant(p_course_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course courses%rowtype;
begin
  if p_course_id is null then
    return;
  end if;

  select *
    into v_course
  from courses
  where course_id = p_course_id;

  if not found or v_course.active is not true then
    return;
  end if;

  if not watmatch_course_has_active_instructor(p_course_id) then
    raise exception 'Active courses must have at least one active instructor assigned.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function watmatch_enforce_active_course_instructor_on_course()
returns trigger
language plpgsql
as $$
begin
  if new.active is true then
    perform watmatch_assert_active_course_instructor_invariant(new.course_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_courses_active_instructor_invariant on courses;
create constraint trigger trg_courses_active_instructor_invariant
after insert or update of active on courses
deferrable initially deferred
for each row
execute function watmatch_enforce_active_course_instructor_on_course();

create or replace function watmatch_enforce_active_course_instructor_on_user()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform watmatch_assert_instructor_can_leave_course(old.user_id, null, null, false);
    return old;
  end if;

  perform watmatch_assert_instructor_can_leave_course(new.user_id, new.course_fk, new.role, new.active);
  return new;
end;
$$;

drop trigger if exists trg_users_active_course_instructor_invariant on users;
create trigger trg_users_active_course_instructor_invariant
before update of course_fk, role, active or delete on users
for each row
execute function watmatch_enforce_active_course_instructor_on_user();

create or replace function watmatch_sync_course_activation_on_user_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.course_fk is not null then
    perform watmatch_sync_single_course_activation(old.course_fk);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.course_fk is not null then
    perform watmatch_sync_single_course_activation(new.course_fk);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_sync_course_activation on users;
create trigger trg_users_sync_course_activation
after insert or update of course_fk, role, active or delete on users
for each row
execute function watmatch_sync_course_activation_on_user_change();

update courses c
set active = false
where c.active is true
  and not watmatch_course_has_active_instructor(c.course_id);

create or replace function watmatch_get_review_capstones(
  p_actor_id bigint,
  p_actor_role text,
  p_page integer default null,
  p_page_size integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_actor_course bigint;
  v_page integer := case when p_page is not null and p_page > 0 then p_page else null end;
  v_page_size integer := case when p_page_size is not null and p_page_size > 0 then p_page_size else null end;
  v_limit integer := case when v_page is not null and v_page_size is not null then v_page_size else null end;
  v_offset integer := case when v_page is not null and v_page_size is not null then (v_page - 1) * v_page_size else 0 end;
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if v_role not in ('admin', 'instructor') then
    raise exception 'Instructor/admin access required' using errcode = '42501';
  end if;

  if v_role = 'instructor' then
    select course_fk
      into v_actor_course
    from users
    where user_id = p_actor_id;

    if v_actor_course is null then
      return jsonb_build_object(
        'success', true,
        'data', '[]'::jsonb,
        'total', 0,
        'page', v_page,
        'page_size', v_page_size
      );
    end if;
  end if;

  with filtered as (
    select c.*
    from capstones c
    where c.approval is false
      and c.archived is false
      and c.status = 'pending_review'
      and (
        v_role = 'admin'
        or exists (
          select 1
          from capstone_course_approvals cca
          where cca.capstone_fk = c.capstone_id
            and cca.course_fk = v_actor_course
            and cca.status = 'pending'
        )
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, capstone_id desc
    offset v_offset
    limit v_limit
  )
  select
    coalesce((select total from counted), 0),
    coalesce((select jsonb_agg(to_jsonb(paged)) from paged), '[]'::jsonb)
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

drop function if exists watmatch_get_course_routing_capstones(bigint, text, integer, integer);

create or replace function watmatch_get_course_routing_capstones(
  p_actor_id bigint,
  p_actor_role text,
  p_page integer default null,
  p_page_size integer default null,
  p_search text default null,
  p_course_id bigint default null,
  p_department_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_page integer := case when p_page is not null and p_page > 0 then p_page else null end;
  v_page_size integer := case when p_page_size is not null and p_page_size > 0 then p_page_size else null end;
  v_limit integer := case when v_page is not null and v_page_size is not null then v_page_size else null end;
  v_offset integer := case when v_page is not null and v_page_size is not null then (v_page - 1) * v_page_size else 0 end;
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if v_role not in ('admin', 'academic_advisor', 'enrollment_operator') then
    raise exception 'Course routing access required' using errcode = '42501';
  end if;

  with filtered as (
    select c.*
    from capstones c
    left join teams t on t.team_id = c.team_fk
    left join courses target_course on target_course.course_id = watmatch_target_course_fk(c.capstone_id, c.team_fk)
    where c.approval is false
      and c.archived is false
      and c.status = 'pending_admin_course_routing'
      and (
        p_course_id is null
        or p_course_id in (c.course_fk, c.requested_course_fk, t.course_fk, target_course.course_id)
        or exists (
          select 1
          from team_memberships tm
          join users u on u.user_id = tm.user_fk
          where tm.team_fk = c.team_fk
            and coalesce(tm.enrollment_course_fk, u.course_fk) = p_course_id
        )
      )
      and (
        p_department_id is null
        or target_course.department_fk = p_department_id
        or exists (
          select 1
          from team_memberships tm
          join users u on u.user_id = tm.user_fk
          where tm.team_fk = c.team_fk
            and u.home_department_fk = p_department_id
        )
      )
      and (
        v_search is null
        or lower(
          coalesce(c.title, '') || ' ' ||
          coalesce(c.description, '') || ' ' ||
          coalesce(c.problem_area, '') || ' ' ||
          coalesce(target_course.code, '') || ' ' ||
          coalesce(target_course.name, '')
        ) like '%' || v_search || '%'
        or exists (
          select 1
          from team_memberships tm
          join users u on u.user_id = tm.user_fk
          where tm.team_fk = c.team_fk
            and lower(coalesce(u.email, '')) like '%' || v_search || '%'
        )
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, capstone_id desc
    offset v_offset
    limit v_limit
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'capstone', to_jsonb(p),
            'team', to_jsonb(t),
            'target_course', to_jsonb(tc),
            'members', coalesce(m.members, '[]'::jsonb),
            'pending_reassignments', coalesce(r.pending_reassignments, '[]'::jsonb)
          )
          order by p.created_at desc, p.capstone_id desc
        )
        from paged p
        left join teams t on t.team_id = p.team_fk
        left join courses tc on tc.course_id = watmatch_target_course_fk(p.capstone_id, p.team_fk)
        left join lateral (
          select jsonb_agg(
            jsonb_build_object(
              'user_id', u.user_id,
              'email', u.email,
              'role', u.role,
              'is_leader', tm.is_leader,
              'course_id', coalesce(tm.enrollment_course_fk, u.course_fk),
              'enrollment_course_fk', tm.enrollment_course_fk,
              'course_code', c.code,
              'course_name', c.name,
              'home_department_id', u.home_department_fk,
              'home_department', d.name
            )
            order by tm.is_leader desc, u.email
          ) as members
          from team_memberships tm
          join users u on u.user_id = tm.user_fk
          left join courses c on c.course_id = coalesce(tm.enrollment_course_fk, u.course_fk)
          left join departments d on d.department_id = u.home_department_fk
          where tm.team_fk = p.team_fk
        ) m on true
        left join lateral (
          select jsonb_agg(to_jsonb(crr) order by crr.created_at desc) as pending_reassignments
          from course_reassignment_requests crr
          where crr.capstone_fk = p.capstone_id
            and crr.status = 'pending'
        ) r on true
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

create or replace function watmatch_admin_route_capstone_course(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_target_course_id bigint,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_course courses%rowtype;
  v_previous_course_id bigint;
  v_now timestamptz := now();
begin
  if v_role not in ('admin', 'academic_advisor', 'enrollment_operator') then
    raise exception 'Course routing access required' using errcode = '42501';
  end if;

  if p_capstone_id is null or p_target_course_id is null then
    raise exception 'Capstone and target course are required.' using errcode = '22023';
  end if;

  v_course := watmatch_assert_course_ready_for_review(p_target_course_id, 'Target course');

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
  end if;

  if v_capstone.archived is true or v_capstone.status <> 'pending_admin_course_routing' then
    raise exception 'This capstone is not awaiting course routing.' using errcode = '23514';
  end if;

  if v_capstone.team_fk is null then
    raise exception 'Capstone is not attached to a team.' using errcode = '23514';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found then
    raise exception 'Linked team not found.' using errcode = 'P0002';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer editable.' using errcode = '23514';
  end if;

  v_previous_course_id := coalesce(v_capstone.requested_course_fk, v_team.course_fk, v_capstone.course_fk);

  if v_comments is null
     and v_previous_course_id is not null
     and p_target_course_id is distinct from v_previous_course_id then
    raise exception 'Decision notes are required when routing changes the intended course.' using errcode = '23514';
  end if;

  update teams
  set course_fk = p_target_course_id
  where team_id = v_team.team_id
  returning * into v_team;

  update capstones
  set course_fk = p_target_course_id,
      approval = false,
      status = 'pending_review',
      course_routed_by_fk = p_actor_id,
      course_routed_at = v_now,
      course_routing_notes = coalesce(v_comments, course_routing_notes),
      updated_at = v_now
  where capstone_id = p_capstone_id
  returning * into v_capstone;

  perform watmatch_reset_capstone_course_requirements(p_capstone_id, v_team.team_id);
  perform watmatch_sync_course_reassignment_requests(
    p_capstone_id,
    v_team.team_id,
    p_target_course_id,
    p_actor_id,
    coalesce(v_comments, 'Capstone routed to target course.')
  );

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (
    p_capstone_id,
    p_actor_id,
    'course_routed',
    coalesce(v_comments, 'Routed to ' || v_course.code || ' for instructor review.')
  );

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'capstone_course_routed',
    'capstone',
    p_capstone_id::text,
    coalesce(v_comments, 'Capstone routed to target course.'),
    jsonb_build_object(
      'team_fk', v_team.team_id,
      'previous_course_fk', v_previous_course_id,
      'target_course_fk', p_target_course_id,
      'target_course_code', v_course.code
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone routed for target-course instructor review.',
    'data', jsonb_build_object('capstone', to_jsonb(v_capstone), 'team', to_jsonb(v_team))
  );
end;
$$;

create or replace function watmatch_create_project_submission_enrollment_request(
  p_student_id bigint,
  p_target_course_id bigint,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
  v_course courses%rowtype;
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_request course_reassignment_requests%rowtype;
  v_now timestamptz := now();
  v_phase text := watmatch_current_marketplace_phase();
  v_assigned_course_ready boolean := false;
  v_assigned_course_error text := null;
begin
  if p_student_id is null or p_target_course_id is null then
    raise exception 'Student and requested course are required.' using errcode = '22023';
  end if;

  v_student := watmatch_assert_active_student(p_student_id);

  if v_student.course_fk is not null then
    begin
      perform watmatch_assert_course_ready_for_review(v_student.course_fk, 'Your assigned course');
      v_assigned_course_ready := true;
    exception when others then
      v_assigned_course_ready := false;
      v_assigned_course_error := sqlerrm;
    end;

    if v_assigned_course_ready then
      raise exception 'Your account is already assigned to an active staffed course.' using errcode = '23514';
    end if;
  end if;

  if exists (select 1 from team_memberships where user_fk = p_student_id) then
    raise exception 'Students already in a team do not need a submission enrollment request.' using errcode = '23505';
  end if;

  v_course := watmatch_assert_course_ready_for_review(p_target_course_id, 'Requested course');

  v_phase := watmatch_effective_marketplace_phase_for_course(v_course.course_id);
  if v_phase = 'finalization' then
    raise exception 'Project submission enrollment requests are closed during finalization. Contact an admin if this is an exception.'
      using errcode = '23514';
  end if;

  insert into course_reassignment_requests (
    student_fk,
    from_course_fk,
    to_course_fk,
    request_type,
    request_source,
    status,
    requested_by_fk,
    comments,
    updated_at
  )
  values (
    p_student_id,
    v_student.course_fk,
    v_course.course_id,
    'project_submission_enrollment',
    'capstone_submission',
    'pending',
    p_student_id,
    v_comments,
    v_now
  )
  on conflict (student_fk)
  where status = 'pending'
    and request_type = 'project_submission_enrollment'
  do update
    set to_course_fk = excluded.to_course_fk,
        requested_by_fk = excluded.requested_by_fk,
        comments = excluded.comments,
        updated_at = v_now
  returning * into v_request;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_student_id,
    'student',
    'project_submission_enrollment_requested',
    'course_reassignment_request',
    v_request.request_id::text,
    v_comments,
    jsonb_build_object(
      'request_id', v_request.request_id,
      'student_fk', p_student_id,
      'from_course_fk', v_student.course_fk,
      'assigned_course_blocker', v_assigned_course_error,
      'requested_course', to_jsonb(v_course)
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Course enrollment request submitted.',
    'data', jsonb_build_object(
      'request', to_jsonb(v_request),
      'requested_course', to_jsonb(v_course),
      'assigned_course_blocker', v_assigned_course_error,
      'student', to_jsonb(v_student)
    )
  );
end;
$$;

create or replace function watmatch_queue_finalization_exception_proposal(
  p_student_id bigint,
  p_target_course_id bigint,
  p_requested_by_fk bigint,
  p_reason text,
  p_payload jsonb,
  p_team_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
  v_course courses%rowtype;
  v_request course_reassignment_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_now timestamptz := now();
  v_submission_track text := 'home_course';
begin
  if p_student_id is null or p_target_course_id is null or p_requested_by_fk is null then
    raise exception 'Student, target course, and admin actor are required for a finalization exception.'
      using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'Finalization exception requires an audit reason.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from users
    where user_id = p_requested_by_fk
      and active is true
      and lower(coalesce(role, '')) = 'admin'
  ) then
    raise exception 'Only an active admin can create a finalization exception proposal.'
      using errcode = '42501';
  end if;

  v_student := watmatch_assert_active_student(p_student_id);
  v_course := watmatch_assert_course_ready_for_review(p_target_course_id, 'Selected exception course');
  v_submission_track := case
    when coalesce(v_course.routing_kind, 'standard') = 'interdisciplinary' then 'interdisciplinary'
    else 'home_course'
  end;

  v_payload := v_payload
    || jsonb_build_object(
      'admin_finalization_override', true,
      'admin_finalization_override_actor_id', p_requested_by_fk,
      'admin_finalization_override_reason', v_reason,
      'requested_course_id', v_course.course_id,
      'submission_track', v_submission_track,
      'team_id', p_team_id
    );

  insert into course_reassignment_requests (
    student_fk,
    from_course_fk,
    to_course_fk,
    team_fk,
    request_type,
    request_source,
    status,
    requested_by_fk,
    comments,
    proposal_payload,
    updated_at
  )
  values (
    p_student_id,
    v_student.course_fk,
    v_course.course_id,
    p_team_id,
    'project_submission_enrollment',
    'finalization_exception_proposal',
    'pending',
    p_requested_by_fk,
    v_reason,
    v_payload,
    v_now
  )
  on conflict (student_fk)
  where status = 'pending'
    and request_type = 'project_submission_enrollment'
  do update
    set from_course_fk = excluded.from_course_fk,
        to_course_fk = excluded.to_course_fk,
        team_fk = excluded.team_fk,
        request_source = excluded.request_source,
        requested_by_fk = excluded.requested_by_fk,
        comments = excluded.comments,
        proposal_payload = excluded.proposal_payload,
        updated_at = v_now
  returning * into v_request;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_requested_by_fk,
    'admin',
    'finalization_exception_proposal_queued',
    'course_reassignment_request',
    v_request.request_id::text,
    v_reason,
    jsonb_build_object(
      'request', to_jsonb(v_request),
      'student_fk', p_student_id,
      'requested_course', to_jsonb(v_course),
      'team_fk', p_team_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Finalization exception proposal queued for staff routing.',
    'data', jsonb_build_object(
      'request', to_jsonb(v_request),
      'student', to_jsonb(v_student),
      'requested_course', to_jsonb(v_course)
    )
  );
end;
$$;

drop function if exists watmatch_get_project_submission_enrollment_requests(bigint, text, integer, integer);

create or replace function watmatch_get_project_submission_enrollment_requests(
  p_actor_id bigint,
  p_actor_role text,
  p_page integer default null,
  p_page_size integer default null,
  p_search text default null,
  p_course_id bigint default null,
  p_department_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_page integer := case when p_page is not null and p_page > 0 then p_page else null end;
  v_page_size integer := case when p_page_size is not null and p_page_size > 0 then p_page_size else null end;
  v_limit integer := case when v_page is not null and v_page_size is not null then v_page_size else null end;
  v_offset integer := case when v_page is not null and v_page_size is not null then (v_page - 1) * v_page_size else 0 end;
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if v_role not in ('admin', 'academic_advisor', 'enrollment_operator')
     or not exists (
       select 1
       from users
       where user_id = p_actor_id
         and active is true
         and lower(coalesce(role, '')) = v_role
     ) then
    raise exception 'Course enrollment routing access required.' using errcode = '42501';
  end if;

  with filtered as (
    select crr.*
    from course_reassignment_requests crr
    join users u on u.user_id = crr.student_fk
    left join departments d on d.department_id = u.home_department_fk
    left join courses rc on rc.course_id = crr.to_course_fk
    left join courses fc on fc.course_id = crr.from_course_fk
    left join users requester on requester.user_id = crr.requested_by_fk
    where crr.status = 'pending'
      and crr.request_type = 'project_submission_enrollment'
      and (
        p_course_id is null
        or p_course_id in (crr.from_course_fk, crr.to_course_fk, u.course_fk)
      )
      and (
        p_department_id is null
        or u.home_department_fk = p_department_id
        or rc.department_fk = p_department_id
      )
      and (
        v_search is null
        or lower(
          coalesce(u.email, '') || ' ' ||
          coalesce(requester.email, '') || ' ' ||
          coalesce(fc.code, '') || ' ' ||
          coalesce(fc.name, '') || ' ' ||
          coalesce(rc.code, '') || ' ' ||
          coalesce(rc.name, '') || ' ' ||
          coalesce(d.name, '') || ' project submission enrollment'
        ) like '%' || v_search || '%'
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at asc, request_id asc
    offset v_offset
    limit v_limit
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'request', to_jsonb(p),
            'student', jsonb_build_object(
              'user_id', u.user_id,
              'email', u.email,
              'course_fk', u.course_fk,
              'home_department_id', u.home_department_fk,
              'home_department', d.name
            ),
            'from_course', to_jsonb(fc),
            'requested_course', to_jsonb(rc),
            'requested_by', jsonb_build_object(
              'user_id', requester.user_id,
              'email', requester.email,
              'role', requester.role
            )
          )
          order by p.created_at asc, p.request_id asc
        )
        from paged p
        join users u on u.user_id = p.student_fk
        left join departments d on d.department_id = u.home_department_fk
        left join courses fc on fc.course_id = p.from_course_fk
        left join courses rc on rc.course_id = p.to_course_fk
        left join users requester on requester.user_id = p.requested_by_fk
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', case when v_page_size is not null and v_page_size > 0 then ceil(v_total::numeric / v_page_size)::integer else null end
  );
end;
$$;

create or replace function watmatch_decide_project_submission_enrollment_request(
  p_request_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_decision text,
  p_target_course_id bigint default null,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_decision text := lower(nullif(btrim(coalesce(p_decision, '')), ''));
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_request course_reassignment_requests%rowtype;
  v_student users%rowtype;
  v_course courses%rowtype;
  v_now timestamptz := now();
  v_proposal_payload jsonb := '{}'::jsonb;
  v_capstone_payload jsonb := '{}'::jsonb;
  v_created_result jsonb := null;
  v_created_data jsonb := null;
  v_is_finalization_exception boolean := false;
  v_submission_track text := 'home_course';
  v_team_id bigint := null;
  v_assigned_course_ready boolean := false;
  v_assigned_course_error text := null;
begin
  if v_role not in ('admin', 'academic_advisor', 'enrollment_operator')
     or not exists (
       select 1
       from users
       where user_id = p_actor_id
         and active is true
         and lower(coalesce(role, '')) = v_role
     ) then
    raise exception 'Course enrollment routing access required.' using errcode = '42501';
  end if;

  if v_decision not in ('approve', 'reject', 'cancel') then
    raise exception 'Decision must be approve, reject, or cancel.' using errcode = '23514';
  end if;

  select *
    into v_request
  from course_reassignment_requests
  where request_id = p_request_id
  for update;

  if not found
     or v_request.status <> 'pending'
     or v_request.request_type <> 'project_submission_enrollment' then
    raise exception 'Pending project submission enrollment request not found.' using errcode = 'P0002';
  end if;

  select *
    into v_student
  from users
  where user_id = v_request.student_fk
  for update;

  if not found
     or lower(coalesce(v_student.role, '')) <> 'student'
     or v_student.active is not true then
    raise exception 'Student is no longer eligible for course enrollment.' using errcode = '23514';
  end if;

  if v_decision in ('reject', 'cancel') then
    if v_comments is null then
      raise exception 'Decision notes are required when rejecting or cancelling a project submission enrollment request.'
        using errcode = '23514';
    end if;

    update course_reassignment_requests
    set status = case when v_decision = 'cancel' then 'cancelled' else 'rejected' end,
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        comments = v_comments,
        updated_at = v_now
    where request_id = p_request_id
    returning * into v_request;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      case when v_decision = 'cancel' then 'project_submission_enrollment_cancelled' else 'project_submission_enrollment_rejected' end,
      'course_reassignment_request',
      v_request.request_id::text,
      v_comments,
      to_jsonb(v_request)
    );

    return jsonb_build_object(
      'success', true,
      'message', 'Project submission enrollment request updated.',
      'data', jsonb_build_object('request', to_jsonb(v_request), 'student', to_jsonb(v_student))
    );
  end if;

  v_is_finalization_exception := coalesce(v_request.request_source, '') = 'finalization_exception_proposal';

  if v_student.course_fk is not null and v_is_finalization_exception is false then
    begin
      perform watmatch_assert_course_ready_for_review(v_student.course_fk, 'Current assigned course');
      v_assigned_course_ready := true;
    exception when others then
      v_assigned_course_ready := false;
      v_assigned_course_error := sqlerrm;
    end;

    if v_assigned_course_ready then
      update course_reassignment_requests
      set status = 'cancelled',
          decided_by_fk = p_actor_id,
          decided_at = v_now,
          comments = coalesce(v_comments, 'Student already has an active staffed course assignment.'),
          updated_at = v_now
      where request_id = p_request_id
      returning * into v_request;

      insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
      values (
        p_actor_id,
        v_role,
        'project_submission_enrollment_cancelled',
        'course_reassignment_request',
        v_request.request_id::text,
        coalesce(v_comments, 'Student already has an active staffed course assignment.'),
        jsonb_build_object(
          'request', to_jsonb(v_request),
          'student_fk', v_student.user_id,
          'current_course_fk', v_student.course_fk
        )
      );

      return jsonb_build_object(
        'success', true,
        'message', 'Request cancelled because the student already has an active staffed course assignment.',
        'data', jsonb_build_object('request', to_jsonb(v_request), 'student', to_jsonb(v_student))
      );
    end if;
  end if;

  v_course := watmatch_assert_course_ready_for_review(
    coalesce(p_target_course_id, v_request.to_course_fk),
    'Target course'
  );

  if v_request.to_course_fk is not null
     and v_course.course_id is distinct from v_request.to_course_fk
     and v_comments is null then
    raise exception 'Decision notes are required when approving a different enrollment course.'
      using errcode = '23514';
  end if;

  v_submission_track := case
    when coalesce(v_course.routing_kind, 'standard') = 'interdisciplinary' then 'interdisciplinary'
    else 'home_course'
  end;

  update users
  set course_fk = v_course.course_id,
      updated_at = v_now
  where user_id = v_student.user_id
  returning * into v_student;

  perform watmatch_reconcile_marketplace_commitments_after_course_assignment(
    v_student.user_id,
    p_actor_id,
    v_role,
    'Student was assigned to a course through project submission enrollment approval.'
  );

  update course_reassignment_requests
  set to_course_fk = v_course.course_id,
      status = 'approved',
      decided_by_fk = p_actor_id,
      decided_at = v_now,
      comments = coalesce(v_comments, v_request.comments),
      updated_at = v_now
  where request_id = p_request_id
  returning * into v_request;

  if v_is_finalization_exception then
    v_proposal_payload := coalesce(v_request.proposal_payload, '{}'::jsonb);
    if v_proposal_payload = '{}'::jsonb then
      raise exception 'Finalization exception proposal is missing its saved capstone payload.'
        using errcode = '23514';
    end if;

    v_team_id := nullif(coalesce(v_proposal_payload ->> 'team_id', ''), '')::bigint;
    v_capstone_payload := v_proposal_payload
      || jsonb_build_object(
        'admin_finalization_override', true,
        'admin_finalization_override_approved', true,
        'admin_finalization_override_actor_id', p_actor_id,
        'admin_finalization_override_reason', coalesce(v_comments, v_request.comments, 'Approved finalization exception proposal.'),
        'requested_course_id', v_course.course_id,
        'submission_track', v_submission_track
      );

    if v_team_id is null then
      v_created_result := watmatch_create_capstone_with_new_team(
        v_student.user_id,
        v_course.course_id,
        v_capstone_payload
      );
    else
      v_created_result := watmatch_create_capstone_for_existing_team(
        v_student.user_id,
        v_team_id,
        v_course.course_id,
        v_capstone_payload
      );
    end if;

    if coalesce((v_created_result ->> 'success')::boolean, false) is not true then
      raise exception 'Could not materialize finalization exception proposal.'
        using errcode = '23514';
    end if;

    v_created_data := v_created_result -> 'data';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'project_submission_enrollment_approved',
    'course_reassignment_request',
    v_request.request_id::text,
    coalesce(v_comments, v_request.comments),
    jsonb_build_object(
      'request', to_jsonb(v_request),
      'student_fk', v_student.user_id,
      'target_course', to_jsonb(v_course),
      'assigned_course_blocker', v_assigned_course_error,
      'finalization_exception_materialized', v_is_finalization_exception,
      'created', v_created_data
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', case
      when v_is_finalization_exception then 'Finalization exception approved, student assigned, and capstone submitted for review.'
      else 'Student assigned to course for capstone submission.'
    end,
    'data', jsonb_build_object(
      'request', to_jsonb(v_request),
      'student', to_jsonb(v_student),
      'target_course', to_jsonb(v_course),
      'created', v_created_data
    )
  );
end;
$$;

drop trigger if exists trg_capstones_clear_interest_when_not_recruiting on capstones;
drop trigger if exists trg_capstones_clear_interest_when_not_approved_recruiting on capstones;
create trigger trg_capstones_clear_interest_when_not_approved_recruiting
after insert or update of status, archived, team_fk on capstones
for each row
execute function watmatch_clear_interest_when_not_approved_recruiting();

create or replace function watmatch_prevent_locked_team_membership_change()
returns trigger
language plpgsql
as $$
declare
  target_team_fk bigint;
  target_user_fk bigint;
  target_capstone_fk bigint;
  locked_team_capstone_fk bigint;
  target_team_status text;
  linked_status text;
  target_user_role text;
  target_user_course_fk bigint;
  target_enrollment_course_fk bigint;
  allow_enrollment_reroute text := lower(coalesce(current_setting('watmatch.allow_membership_enrollment_reroute', true), 'false'));
begin
  if tg_op = 'DELETE' then
    target_team_fk := old.team_fk;
    target_user_fk := old.user_fk;
  else
    target_team_fk := new.team_fk;
    target_user_fk := new.user_fk;
  end if;

  if target_team_fk is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select capstone_fk
    into target_capstone_fk
  from teams
  where team_id = target_team_fk;

  if target_capstone_fk is not null then
    select c.status
      into linked_status
    from capstones c
    where c.capstone_id = target_capstone_fk
      and c.archived is not true
    for update;
  end if;

  select status, capstone_fk
    into target_team_status, locked_team_capstone_fk
  from teams
  where team_id = target_team_fk
  for update;

  if locked_team_capstone_fk is distinct from target_capstone_fk then
    raise exception 'Team changed while membership update was starting. Please retry.'
      using errcode = '40001';
  end if;

  if tg_op = 'UPDATE' and allow_enrollment_reroute in ('true', '1', 'yes', 'on') then
    if new.team_fk is distinct from old.team_fk
       or new.user_fk is distinct from old.user_fk
       or new.is_leader is distinct from old.is_leader then
      raise exception 'Continuation enrollment reroute cannot change team identity or leadership.'
        using errcode = '23514';
    end if;

    if new.enrollment_course_fk is null then
      raise exception 'Official team members must have an enrollment course.'
        using errcode = '23514';
    end if;

    perform watmatch_assert_course_ready_for_review(new.enrollment_course_fk, 'Enrollment course');
    return new;
  end if;

  if target_team_status = 'finalized' then
    raise exception 'Team membership is locked after the team is finalized.'
      using errcode = '23514';
  end if;

  if linked_status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing') then
    raise exception 'Team membership is locked while capstone status is %', linked_status
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' then
    target_enrollment_course_fk := new.enrollment_course_fk;

    select role, course_fk
      into target_user_role, target_user_course_fk
    from users
    where user_id = target_user_fk
    for update;

    if not found or lower(coalesce(target_user_role, '')) <> 'student' then
      raise exception 'Only students can be team members.'
        using errcode = '23514';
    end if;

    if target_user_course_fk is null then
      raise exception 'Student must be assigned to a course before joining a team.'
        using errcode = '23514';
    end if;

    if target_enrollment_course_fk is null then
      raise exception 'Official team members must have an enrollment course.'
        using errcode = '23514';
    end if;

    perform watmatch_assert_course_ready_for_review(target_enrollment_course_fk, 'Enrollment course');
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_memberships_prevent_locked_change on team_memberships;
create trigger trg_team_memberships_prevent_locked_change
before insert or update or delete on team_memberships
for each row
execute function watmatch_prevent_locked_team_membership_change();

create or replace function watmatch_validate_user_active_team_membership()
returns trigger
language plpgsql
as $$
begin
  if new.active_team_fk is not null
     and not exists (
       select 1
       from team_memberships tm
       where tm.user_fk = new.user_id
         and tm.team_fk = new.active_team_fk
     ) then
    raise exception 'users.active_team_fk must match team_memberships'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_validate_active_team_fk on users;
create trigger trg_users_validate_active_team_fk
before insert or update of active_team_fk on users
for each row
execute function watmatch_validate_user_active_team_membership();

create or replace function watmatch_cleanup_marketplace_for_official_membership(
  p_student_id bigint,
  p_team_id bigint,
  p_actor_id bigint default null,
  p_actor_role text default 'system',
  p_reason text default 'Student joined an official capstone team.'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_capstone_id bigint;
  v_reason text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Student joined an official capstone team.');
  v_skip text := lower(coalesce(current_setting('watmatch.skip_membership_marketplace_cleanup', true), 'false'));
begin
  if p_student_id is null or p_team_id is null or v_skip in ('true', '1', 'yes', 'on') then
    return;
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if to_regclass('public.project_explorations') is not null then
    if v_capstone_id is not null then
      execute $cleanup$
        update project_explorations
        set status = 'committed',
            decided_by_fk = coalesce($1, decided_by_fk),
            decided_at = coalesce(decided_at, $2),
            updated_at = $2
        where student_fk = $3
          and team_fk = $4
          and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
      $cleanup$
      using p_actor_id, v_now, p_student_id, p_team_id;
    end if;

    execute $cleanup$
      update project_explorations
      set status = 'not_selected',
          decided_by_fk = coalesce($1, decided_by_fk),
          decided_at = coalesce(decided_at, $2),
          student_commitment_confirmed_at = null,
          student_commitment_confirmed_by_fk = null,
          team_commitment_confirmed_at = null,
          team_commitment_confirmed_by_fk = null,
          updated_at = $2
      where student_fk = $3
        and team_fk <> $4
        and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
    $cleanup$
    using p_actor_id, v_now, p_student_id, p_team_id;
  end if;

  if to_regclass('public.project_commitment_requests') is not null then
    execute $cleanup$
      update project_commitment_requests
      set status = 'cancelled',
          decided_by_fk = coalesce($1, decided_by_fk),
          decided_at = coalesce(decided_at, $2),
          comments = coalesce(comments, $3),
          updated_at = $2
      where student_fk = $4
        and status = 'pending'
    $cleanup$
    using p_actor_id, v_now, v_reason, p_student_id;
  end if;

end;
$$;

create or replace function watmatch_cleanup_marketplace_for_unavailable_student(
  p_student_id bigint,
  p_actor_id bigint default null,
  p_actor_role text default 'system',
  p_reason text default 'Student is no longer eligible for marketplace activity.'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_reason text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Student is no longer eligible for marketplace activity.');
begin
  if p_student_id is null then
    return;
  end if;

  if to_regclass('public.project_explorations') is not null then
    execute $cleanup$
      update project_explorations
      set status = 'expired',
          decided_by_fk = coalesce($2, decided_by_fk),
          decided_at = coalesce(decided_at, $3),
          student_commitment_confirmed_at = null,
          student_commitment_confirmed_by_fk = null,
          team_commitment_confirmed_at = null,
          team_commitment_confirmed_by_fk = null,
          updated_at = $3
      where student_fk = $1
        and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
    $cleanup$
    using p_student_id, p_actor_id, v_now;
  end if;

  if to_regclass('public.project_commitment_requests') is not null then
    execute $cleanup$
      update project_commitment_requests
      set status = 'cancelled',
          decided_by_fk = coalesce($1, decided_by_fk),
          decided_at = coalesce(decided_at, $2),
          comments = coalesce(comments, $3),
          updated_at = $2
      where student_fk = $4
        and status = 'pending'
    $cleanup$
    using p_actor_id, v_now, v_reason, p_student_id;
  end if;

end;
$$;

create or replace function watmatch_sync_membership_caches()
returns trigger
language plpgsql
as $$
declare
  target_team_status text;
  canonical_leader bigint;
  target_team_fk bigint;
  allow_enrollment_reroute text := lower(coalesce(current_setting('watmatch.allow_membership_enrollment_reroute', true), 'false'));
begin
  if tg_op = 'DELETE' then
    target_team_fk := old.team_fk;
  else
    target_team_fk := new.team_fk;
  end if;

  if tg_op = 'DELETE' then
    update users
    set active_team_fk = null
    where user_id = old.user_fk
      and active_team_fk = old.team_fk;

    select status
      into target_team_status
    from teams
    where team_id = old.team_fk;

    if target_team_status <> 'archived' then
      update teams
      set leader_fk = null
      where team_id = old.team_fk
        and leader_fk = old.user_fk;
    end if;
  elsif tg_op = 'UPDATE'
        and old.user_fk is distinct from new.user_fk then
    update users
    set active_team_fk = null
    where user_id = old.user_fk
      and active_team_fk = old.team_fk;
  end if;

  if tg_op <> 'DELETE' then
    update users
    set active_team_fk = new.team_fk
    where user_id = new.user_fk;

    perform watmatch_cleanup_marketplace_for_official_membership(
      new.user_fk,
      new.team_fk,
      null,
      'system',
      'Student joined an official capstone team.'
    );

  end if;

  if pg_trigger_depth() < 2
     and target_team_fk is not null
     and allow_enrollment_reroute not in ('true', '1', 'yes', 'on') then
    select leader_fk
      into canonical_leader
    from teams
    where team_id = target_team_fk;

    update team_memberships
    set is_leader = false
    where team_fk = target_team_fk
      and is_leader is true;

    if canonical_leader is not null then
      update team_memberships
      set is_leader = true
      where team_fk = target_team_fk
        and user_fk = canonical_leader
        and is_leader is distinct from true;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_memberships_sync_caches on team_memberships;
create trigger trg_team_memberships_sync_caches
after insert or update or delete on team_memberships
for each row
execute function watmatch_sync_membership_caches();

create or replace function watmatch_sync_leader_flags_from_team()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() < 2 then
    update team_memberships
    set is_leader = false
    where team_fk = new.team_id
      and is_leader is true;

    if new.leader_fk is not null then
      update team_memberships
      set is_leader = true
      where team_fk = new.team_id
        and user_fk = new.leader_fk
        and is_leader is distinct from true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_teams_sync_leader_flags on teams;
create trigger trg_teams_sync_leader_flags
after update of leader_fk on teams
for each row
execute function watmatch_sync_leader_flags_from_team();

create or replace function watmatch_validate_team_identity()
returns trigger
language plpgsql
as $$
declare
  old_linked_status text;
  linked_team_fk bigint;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'finalized'
       and new.status is distinct from 'archived'
       and (
         old.leader_fk is distinct from new.leader_fk
         or old.capstone_fk is distinct from new.capstone_fk
       ) then
      raise exception 'Team identity is locked after the team is finalized.'
        using errcode = '23514';
    end if;

    select c.status
      into old_linked_status
    from capstones c
    where c.capstone_id = old.capstone_fk
      and c.archived is not true
    limit 1;

    if old_linked_status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing')
       and (
         old.leader_fk is distinct from new.leader_fk
         or old.capstone_fk is distinct from new.capstone_fk
       ) then
      raise exception 'Team identity is locked while capstone status is %', old_linked_status
        using errcode = '23514';
    end if;
  end if;

  if new.leader_fk is not null
     and not exists (
       select 1
       from team_memberships tm
       where tm.user_fk = new.leader_fk
         and tm.team_fk = new.team_id
     ) then
    raise exception 'teams.leader_fk must be a current team member'
      using errcode = '23514';
  end if;

  if new.capstone_fk is not null then
    select c.team_fk
      into linked_team_fk
    from capstones c
    where c.capstone_id = new.capstone_fk;

    if linked_team_fk is not null
       and linked_team_fk <> new.team_id then
      raise exception 'teams.capstone_fk and capstones.team_fk disagree'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_teams_validate_identity on teams;
create trigger trg_teams_validate_identity
before insert or update of leader_fk, capstone_fk on teams
for each row
execute function watmatch_validate_team_identity();

create or replace function watmatch_cleanup_marketplace_activity_when_team_unavailable()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('archived', 'finalized') then
    update project_explorations
    set status = 'expired',
        decided_at = coalesce(decided_at, now()),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = now()
    where team_fk = new.team_id
      and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

    update project_commitment_requests
    set status = 'cancelled',
        decided_at = now(),
        comments = coalesce(comments, 'Team is no longer accepting marketplace commitments.'),
        updated_at = now()
    where team_fk = new.team_id
      and status = 'pending';

    perform watmatch_clear_team_commitment_roster_if_idle(new.team_id);

  elsif tg_op = 'UPDATE' then
    if old.capstone_fk is distinct from new.capstone_fk then
      update project_explorations
      set status = 'expired',
          decided_at = coalesce(decided_at, now()),
          student_commitment_confirmed_at = null,
          student_commitment_confirmed_by_fk = null,
          team_commitment_confirmed_at = null,
          team_commitment_confirmed_by_fk = null,
          updated_at = now()
      where team_fk = new.team_id
        and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

      update project_commitment_requests
      set status = 'cancelled',
          decided_at = now(),
          comments = coalesce(comments, 'Team capstone link changed.'),
          updated_at = now()
      where team_fk = new.team_id
        and status = 'pending';

      perform watmatch_clear_team_commitment_roster_if_idle(new.team_id);

    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  v_trigger_name text;
begin
  for v_trigger_name in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.teams'::regclass
      and p.proname = 'watmatch_expire_marketplace_activity_when_team_unavailable'
  loop
    execute format('drop trigger if exists %I on public.teams', v_trigger_name);
  end loop;
end $$;

drop function if exists watmatch_expire_marketplace_activity_when_team_unavailable();
drop trigger if exists trg_teams_cleanup_marketplace_activity_when_unavailable on teams;
create trigger trg_teams_cleanup_marketplace_activity_when_unavailable
after insert or update of status, capstone_fk on teams
for each row
execute function watmatch_cleanup_marketplace_activity_when_team_unavailable();

create or replace function watmatch_validate_capstone_team_link()
returns trigger
language plpgsql
as $$
declare
  linked_capstone_fk bigint;
begin
  if new.team_fk is not null then
    select t.capstone_fk
      into linked_capstone_fk
    from teams t
    where t.team_id = new.team_fk;

    if linked_capstone_fk is not null
       and linked_capstone_fk <> new.capstone_id then
      raise exception 'capstones.team_fk and teams.capstone_fk disagree'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_capstones_validate_team_link on capstones;
create trigger trg_capstones_validate_team_link
before insert or update of team_fk on capstones
for each row
execute function watmatch_validate_capstone_team_link();

create or replace function watmatch_enforce_finalized_status_invariant()
returns trigger
language plpgsql
as $$
declare
  target_team_id bigint;
  target_capstone_id bigint;
begin
  if tg_table_name = 'teams' then
    target_team_id := new.team_id;

    if new.status = 'finalized' then
      if new.capstone_fk is null then
        raise exception 'Finalized teams must be linked to an approved capstone.'
          using errcode = '23514';
      end if;

      if not exists (
        select 1
        from capstones c
        where c.capstone_id = new.capstone_fk
          and c.team_fk = new.team_id
          and c.status in ('approved', 'complete')
          and c.approval is true
          and c.archived is false
      ) then
        raise exception 'Finalized teams must be linked to an approved capstone.'
          using errcode = '23514';
      end if;
    end if;

    if exists (
      select 1
      from capstones c
      where c.team_fk = target_team_id
        and c.status in ('approved', 'complete')
        and c.approval is true
        and c.archived is false
        and new.status <> 'finalized'
    ) then
      raise exception 'Approved capstones must be linked to a finalized team.'
        using errcode = '23514';
    end if;

    return new;
  end if;

  target_capstone_id := new.capstone_id;

  if new.status in ('approved', 'complete') then
    if new.team_fk is null then
      raise exception 'Approved or complete capstones must be linked to a finalized team.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from teams t
      where t.team_id = new.team_fk
        and t.capstone_fk = new.capstone_id
        and t.status = 'finalized'
    ) then
      raise exception 'Approved or complete capstones must be linked to a finalized team.'
        using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from teams t
    where t.capstone_fk = target_capstone_id
      and t.status = 'finalized'
      and new.status not in ('approved', 'complete')
      and new.archived is false
  ) then
    raise exception 'Finalized teams must be linked to an approved or complete capstone.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_teams_finalized_status_invariant on teams;
create constraint trigger trg_teams_finalized_status_invariant
after insert or update of status, capstone_fk on teams
deferrable initially deferred
for each row
execute function watmatch_enforce_finalized_status_invariant();

drop trigger if exists trg_capstones_finalized_status_invariant on capstones;
create constraint trigger trg_capstones_finalized_status_invariant
after insert or update of status, approval, archived, team_fk on capstones
deferrable initially deferred
for each row
execute function watmatch_enforce_finalized_status_invariant();

create or replace function watmatch_review_capstone(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_decision text,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_decision text := lower(coalesce(p_decision, ''));
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_actor_course bigint;
  v_target_course bigint;
  v_member_ids bigint[];
  v_existing_status text;
  v_decision_newly_recorded boolean := true;
  v_updated capstones%rowtype;
  v_archived_ids bigint[] := '{}'::bigint[];
  v_now timestamptz := now();
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor') then
    raise exception 'Forbidden. Only instructors/admins can review capstones.' using errcode = '42501';
  end if;

  if v_decision not in ('approve', 'reject', 'request_changes') then
    raise exception 'Invalid review decision.' using errcode = '22023';
  end if;

  if v_decision in ('request_changes', 'reject') and v_comments is null then
    raise exception 'comments are required when requesting changes or rejecting a capstone' using errcode = '22023';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
  end if;

  if v_capstone.archived is true then
    raise exception 'This capstone is not open for instructor review.' using errcode = '23514';
  end if;

  if v_capstone.team_fk is null then
    raise exception 'Capstone is not attached to a team.' using errcode = '23514';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found then
    raise exception 'Linked team not found.' using errcode = 'P0002';
  end if;

  select course_fk
    into v_actor_course
  from users
  where user_id = p_actor_id;

  v_target_course := watmatch_target_course_fk(p_capstone_id, v_team.team_id);

  if v_target_course is null then
    raise exception 'No target course is assigned for this capstone.' using errcode = '23514';
  end if;

  if v_role = 'instructor' then
    if v_actor_course is null then
      raise exception 'Instructor must be assigned to a course.' using errcode = '23514';
    end if;

    if v_actor_course <> v_target_course then
      raise exception 'Forbidden. You can only review capstones routed to your course.'
        using errcode = '42501';
    end if;
  end if;

  if v_team.status = 'archived' then
    raise exception 'Linked team is archived and cannot be reviewed.' using errcode = '23514';
  end if;

  if v_decision = 'approve' and v_capstone.status = 'approved_recruiting' then
    return jsonb_build_object(
      'success', true,
      'message', 'Capstone was already approved and is visible for student interest.',
      'capstone', to_jsonb(v_capstone),
      'email_decision', null
    );
  end if;

  if v_decision = 'approve' and v_capstone.status = 'approved' then
    return jsonb_build_object(
      'success', true,
      'message', 'Capstone was already finalized.',
      'capstone', to_jsonb(v_capstone),
      'email_decision', null
    );
  end if;

  if v_capstone.status <> 'pending_review' then
    raise exception 'This capstone is not open for instructor review.' using errcode = '23514';
  end if;

  if v_team.status = 'finalized' then
    raise exception 'Linked team is finalized and cannot be reviewed.' using errcode = '23514';
  end if;

  perform watmatch_assert_team_members_valid(v_team.team_id);

  insert into capstone_course_approvals (capstone_fk, course_fk, status)
  values (p_capstone_id, v_target_course, 'pending')
  on conflict (capstone_fk, course_fk) do nothing;

  delete from capstone_course_approvals
  where capstone_fk = p_capstone_id
    and course_fk <> v_target_course;

  perform watmatch_sync_course_reassignment_requests(
    p_capstone_id,
    v_team.team_id,
    v_target_course,
    coalesce(v_capstone.course_routed_by_fk, p_actor_id),
    v_capstone.course_routing_notes
  );

  perform 1
  from capstone_course_approvals
  where capstone_fk = p_capstone_id
  for update;

  if v_role = 'instructor' then
    select status
      into v_existing_status
    from capstone_course_approvals
    where capstone_fk = p_capstone_id
      and course_fk = v_target_course
    for update;

    if v_existing_status is null then
      raise exception 'No target-course approval row found for this instructor.' using errcode = 'P0002';
    end if;

    if v_decision = 'approve' then
      if v_existing_status = 'approved' then
        v_decision_newly_recorded := false;
      elsif v_existing_status = 'pending' then
        update capstone_course_approvals
        set status = 'approved',
            decided_by_fk = p_actor_id,
            decided_at = v_now,
            comments = v_comments,
            updated_at = v_now
        where capstone_fk = p_capstone_id
          and course_fk = v_target_course;
      else
        raise exception 'Your course has already made a final decision for this capstone.'
          using errcode = '23514';
      end if;
    else
      if v_existing_status <> 'pending' then
        raise exception 'Your course has already made a final decision for this capstone.'
          using errcode = '23514';
      end if;

      if v_decision = 'reject' then
        update capstone_course_approvals
        set status = 'rejected',
            decided_by_fk = p_actor_id,
            decided_at = v_now,
            comments = v_comments,
            updated_at = v_now
        where capstone_fk = p_capstone_id
          and course_fk = v_target_course;
      end if;
    end if;
  elsif v_decision = 'approve' then
    select status
      into v_existing_status
    from capstone_course_approvals
    where capstone_fk = p_capstone_id
      and course_fk = v_target_course
    for update;

    if v_existing_status = 'approved' then
      v_decision_newly_recorded := false;
    else
      update capstone_course_approvals
      set status = 'approved',
          decided_by_fk = p_actor_id,
          decided_at = v_now,
          comments = v_comments,
          updated_at = v_now
      where capstone_fk = p_capstone_id
        and course_fk = v_target_course;
    end if;
  elsif v_decision = 'reject' then
    update capstone_course_approvals
    set status = 'rejected',
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        comments = v_comments,
        updated_at = v_now
    where capstone_fk = p_capstone_id
      and course_fk = v_target_course;
  end if;

  if v_decision = 'request_changes' then
    update capstone_course_approvals
    set status = 'pending',
        decided_by_fk = null,
        decided_at = null,
        comments = null,
        updated_at = v_now
    where capstone_fk = p_capstone_id;

    update capstones
    set approval = false,
        status = 'changes_requested',
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_updated;

    insert into approvals (capstone_fk, instructor_fk, action, comments)
    values (p_capstone_id, p_actor_id, 'changes_requested', v_comments);

    return jsonb_build_object(
      'success', true,
      'message', 'Changes requested successfully',
      'capstone', to_jsonb(v_updated),
      'email_decision', 'changes_requested'
    );
  end if;

  if v_decision_newly_recorded then
    insert into approvals (capstone_fk, instructor_fk, action, comments)
    values (
      p_capstone_id,
      p_actor_id,
      case when v_decision = 'approve' then 'approved' else 'rejected' end,
      v_comments
    );
  end if;

  if v_decision = 'reject' then
    update course_reassignment_requests
    set status = 'rejected',
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        comments = v_comments,
        updated_at = v_now
    where capstone_fk = p_capstone_id
      and status = 'pending';

    update capstones
    set approval = false,
        status = 'rejected',
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_updated;

    return jsonb_build_object(
      'success', true,
      'message', 'Capstone rejected successfully',
      'capstone', to_jsonb(v_updated),
      'email_decision', 'rejected'
    );
  end if;

  if v_decision = 'approve' then
    perform watmatch_apply_course_reassignment_requests(p_capstone_id, p_actor_id, v_role, v_comments);

    update capstones
    set approval = true,
        status = 'approved_recruiting',
        archived = false,
        submission_track = case
          when exists (
            select 1
            from courses c
            where c.course_id = v_target_course
              and c.routing_kind = 'interdisciplinary'
          )
          then 'interdisciplinary'
          else 'home_course'
        end,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_updated;

    select coalesce(array_agg(user_fk), '{}'::bigint[])
      into v_member_ids
    from team_memberships
    where team_fk = v_team.team_id;

    with archived_rows as (
      update capstones c
      set approval = false,
          status = 'archived',
          archived = true,
          archived_at = coalesce(c.archived_at, v_now),
          archived_reason = 'another_capstone_' || p_capstone_id || '_approved',
          updated_at = v_now
      where c.capstone_id <> p_capstone_id
        and c.archived is not true
        and c.approval is false
        and c.user_fk = any(v_member_ids)
      returning c.capstone_id
    )
    select coalesce(array_agg(capstone_id), '{}'::bigint[])
      into v_archived_ids
    from archived_rows;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      'capstone_approved_recruiting',
      'capstone',
      p_capstone_id::text,
      'capstone approved and opened for student interest',
      jsonb_build_object('team_fk', v_team.team_id, 'archived_alternatives', to_jsonb(v_archived_ids))
    );

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    select
      p_actor_id,
      v_role,
      'capstone_archived',
      'capstone',
      archived_id::text,
      'another capstone approved',
      jsonb_build_object('approved_capstone_id', p_capstone_id)
    from unnest(v_archived_ids) as archived_id;

    if not exists (
      select 1
      from approvals
      where capstone_fk = p_capstone_id
        and action = 'capstone_approved_recruiting'
    ) then
      insert into approvals (capstone_fk, instructor_fk, action, comments)
      values (
        p_capstone_id,
        null,
        'capstone_approved_recruiting',
        'Review completed. This capstone is now visible for student interest.'
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'message', 'Capstone approved and opened for student interest.',
      'capstone', to_jsonb(v_updated),
      'email_decision', 'approved'
    );
  end if;
end;
$$;

-- Transactional membership workflow RPCs.
create or replace function watmatch_required_course_fks(p_team_id bigint)
returns bigint[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course bigint;
begin
  v_course := watmatch_target_course_fk(null, p_team_id);
  if v_course is null then
    return '{}'::bigint[];
  end if;
  return array[v_course]::bigint[];
end;
$$;

create or replace function watmatch_reset_capstone_course_requirements(
  p_capstone_id bigint,
  p_team_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course bigint := watmatch_target_course_fk(p_capstone_id, p_team_id);
  v_now timestamptz := now();
begin
  if v_course is null then
    raise exception 'No target-course approval requirement found.' using errcode = '23514';
  end if;

  insert into capstone_course_approvals (capstone_fk, course_fk, status)
  values (p_capstone_id, v_course, 'pending')
  on conflict (capstone_fk, course_fk) do update
    set status = 'pending',
        decided_by_fk = null,
        decided_at = null,
        comments = null,
        updated_at = v_now;

  delete from capstone_course_approvals
  where capstone_fk = p_capstone_id
    and course_fk <> v_course;
end;
$$;

create or replace function watmatch_reopen_capstone_review_after_membership_change(
  p_capstone_id bigint,
  p_team_id bigint
)
returns capstones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_target_course bigint;
  v_now timestamptz := now();
begin
  if p_capstone_id is null then
    return null;
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Linked capstone not found.' using errcode = 'P0002';
  end if;

  if v_capstone.archived is true then
    raise exception 'This capstone is archived.' using errcode = '23514';
  end if;

  if v_capstone.status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing') then
    raise exception 'Team membership is locked while capstone status is %', v_capstone.status
      using errcode = '23514';
  end if;

  if v_capstone.status = 'approved_recruiting' then
    v_target_course := watmatch_target_course_fk(p_capstone_id, p_team_id);

    if v_target_course is null then
      raise exception 'No target-course approval requirement found.' using errcode = '23514';
    end if;

    if watmatch_team_has_course_mismatch(p_team_id, v_target_course) then
      update capstones
      set approval = false,
          status = 'pending_admin_course_routing',
          course_routed_by_fk = null,
          course_routed_at = null,
          course_routing_notes = null,
          updated_at = v_now
      where capstone_id = p_capstone_id
      returning * into v_capstone;

      perform watmatch_reset_capstone_course_requirements(p_capstone_id, p_team_id);

      update course_reassignment_requests
      set status = 'cancelled',
          decided_at = v_now,
          comments = 'Team roster changed before routed approval.',
          updated_at = v_now
      where capstone_fk = p_capstone_id
        and status = 'pending';

      insert into approvals (capstone_fk, instructor_fk, action, comments)
      values (
        p_capstone_id,
        null,
        'team_roster_changed_course_routing_required',
        'The team roster was updated. Course routing is required before instructor review.'
      );
    else
      perform watmatch_reset_capstone_course_requirements(p_capstone_id, p_team_id);
      perform watmatch_assert_course_ready_for_review(v_target_course, 'Target course');
      perform watmatch_sync_course_reassignment_requests(
        p_capstone_id,
        p_team_id,
        v_target_course,
        coalesce(v_capstone.course_routed_by_fk, v_capstone.user_fk),
        v_capstone.course_routing_notes
      );

      update capstones
      set approval = false,
          status = 'pending_review',
          updated_at = v_now
      where capstone_id = p_capstone_id
      returning * into v_capstone;

      insert into approvals (capstone_fk, instructor_fk, action, comments)
      values (
        p_capstone_id,
        null,
        'team_roster_changed_review_required',
        'The team roster was updated. This project is back under instructor review.'
      );
    end if;
  elsif v_capstone.status in ('changes_requested', 'rejected') then
    v_capstone := watmatch_route_capstone_status(p_capstone_id, p_team_id, null, false);

    insert into approvals (capstone_fk, instructor_fk, action, comments)
    values (
      p_capstone_id,
      null,
      'team_roster_changed',
      'The team roster was updated.'
    );
  elsif v_capstone.status = 'draft' then
    update capstones
    set approval = false,
        course_routed_by_fk = null,
        course_routed_at = null,
        course_routing_notes = null,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_capstone;

    delete from capstone_course_approvals
    where capstone_fk = p_capstone_id;

    insert into approvals (capstone_fk, instructor_fk, action, comments)
    values (
      p_capstone_id,
      null,
      'team_roster_changed',
      'The team roster was updated.'
    );
  else
    raise exception 'This capstone status does not allow membership changes.' using errcode = '23514';
  end if;

  return v_capstone;
end;
$$;

create or replace function watmatch_actor_can_manage_team(
  p_team_id bigint,
  p_actor_id bigint,
  p_actor_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_actor_course bigint;
  v_target_course bigint;
begin
  if v_role = 'admin' then
    return true;
  end if;

  if v_role <> 'instructor' then
    return false;
  end if;

  select u.course_fk
    into v_actor_course
  from users u
  where u.user_id = p_actor_id
    and u.active is true;

  if v_actor_course is null then
    return false;
  end if;

  v_target_course := watmatch_target_course_fk(null, p_team_id);

  return v_target_course is not null and v_target_course = v_actor_course;
end;
$$;

create or replace function watmatch_assert_student_with_course(
  p_student_id bigint
)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
begin
  if p_student_id is null then
    raise exception 'Invalid student identity.' using errcode = '22023';
  end if;

  select *
    into v_student
  from users
  where user_id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_student.role, '')) <> 'student' then
    raise exception 'Only students can be added to teams.' using errcode = '23514';
  end if;

  if v_student.active is not true then
    raise exception 'Student account is inactive.' using errcode = '23514';
  end if;

  if v_student.course_fk is null then
    raise exception 'Student must be assigned to a course before joining a team.'
      using errcode = '23514';
  end if;

  return v_student;
end;
$$;

create or replace function watmatch_assert_active_student(
  p_student_id bigint
)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
begin
  if p_student_id is null then
    raise exception 'Invalid student identity.' using errcode = '22023';
  end if;

  select *
    into v_student
  from users
  where user_id = p_student_id
  for update;

  if not found then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_student.role, '')) <> 'student' then
    raise exception 'Only students can be added to teams.' using errcode = '23514';
  end if;

  if v_student.active is not true then
    raise exception 'Student account is inactive.' using errcode = '23514';
  end if;

  return v_student;
end;
$$;

drop function if exists watmatch_assert_team_courses_active(bigint);

create or replace function watmatch_assert_team_members_valid(
  p_team_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_team_id is null then
    raise exception 'Invalid team identity.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from team_memberships tm
    join users u on u.user_id = tm.user_fk
    left join courses c on c.course_id = tm.enrollment_course_fk
    where tm.team_fk = p_team_id
      and (
        u.active is not true
        or tm.enrollment_course_fk is null
        or c.course_id is null
        or c.active is not true
        or not watmatch_course_has_active_instructor(c.course_id)
      )
  ) then
    raise exception 'This team has a member whose official enrollment course is missing, inactive, unstaffed, or invalid.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function watmatch_assert_no_cross_pending_team_relationship(
  p_team_id bigint,
  p_student_id bigint,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(coalesce(p_action, ''));
begin
  if p_team_id is null or p_student_id is null then
    raise exception 'Invalid team relationship request.' using errcode = '22023';
  end if;

  if v_action = 'interest'
     and exists (
       select 1
       from project_explorations
       where team_fk = p_team_id
         and student_fk = p_student_id
         and status = 'invited'
     ) then
    raise exception 'You already have an invite to this capstone. Accept or decline the invite instead.'
      using errcode = '23505';
  end if;

  if v_action = 'invite'
     and exists (
       select 1
       from project_explorations
       where team_fk = p_team_id
         and student_fk = p_student_id
         and status = 'interested'
     ) then
    raise exception 'This student has already expressed interest in this capstone. Accept or reject their interest instead.'
      using errcode = '23505';
  end if;
end;
$$;

create or replace function watmatch_claim_team_membership(
  p_team_id bigint,
  p_student_id bigint,
  p_is_leader boolean default false,
  p_enrollment_course_id bigint default null,
  p_actor_id bigint default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_team bigint;
  v_student users%rowtype;
  v_enrollment_course_id bigint;
begin
  v_student := watmatch_assert_student_with_course(p_student_id);
  v_enrollment_course_id := coalesce(p_enrollment_course_id, v_student.course_fk);
  perform watmatch_assert_course_ready_for_review(v_enrollment_course_id, 'Enrollment course');

  select team_fk
    into v_existing_team
  from team_memberships
  where user_fk = p_student_id
  for update;

  if v_existing_team is not null and v_existing_team <> p_team_id then
    raise exception 'This student is already enrolled in another active team.' using errcode = '23505';
  end if;

  insert into team_memberships (
    user_fk,
    team_fk,
    enrollment_course_fk,
    enrollment_routed_by_fk,
    enrollment_routed_at,
    enrollment_notes,
    is_leader
  )
  values (
    p_student_id,
    p_team_id,
    v_enrollment_course_id,
    p_actor_id,
    case when p_actor_id is null then null else now() end,
    nullif(btrim(coalesce(p_notes, '')), ''),
    coalesce(p_is_leader, false)
  )
  on conflict (user_fk) do update
    set team_fk = excluded.team_fk,
        enrollment_course_fk = coalesce(excluded.enrollment_course_fk, team_memberships.enrollment_course_fk),
        enrollment_routed_by_fk = coalesce(excluded.enrollment_routed_by_fk, team_memberships.enrollment_routed_by_fk),
        enrollment_routed_at = coalesce(excluded.enrollment_routed_at, team_memberships.enrollment_routed_at),
        enrollment_notes = coalesce(excluded.enrollment_notes, team_memberships.enrollment_notes),
        is_leader = excluded.is_leader
  where team_memberships.team_fk = excluded.team_fk;

  if not exists (
    select 1
    from team_memberships
    where user_fk = p_student_id
      and team_fk = p_team_id
  ) then
    raise exception 'This student is already enrolled in another active team.' using errcode = '23505';
  end if;
end;
$$;

-- Legacy table-backed team interest/invite RPCs removed.
-- Marketplace relationships now live only in project_explorations.

create or replace function watmatch_privileged_add_team_member(
  p_team_id bigint,
  p_student_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_capstone_id bigint;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor') then
    raise exception 'Forbidden. Only instructors/admins can reorganize teams.' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Privileged member add requires an audit reason.' using errcode = '23514';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_capstone_id is not null then
    perform 1
    from capstones
    where capstone_id = v_capstone_id
    for update;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while member add was starting. Please retry.' using errcode = '40001';
  end if;

  if not watmatch_actor_can_manage_team(p_team_id, p_actor_id, v_role) then
    raise exception 'Forbidden. You can only modify teams routed to your course.'
      using errcode = '42501';
  end if;

  perform watmatch_claim_team_membership(
    p_team_id,
    p_student_id,
    false,
    null,
    p_actor_id,
    coalesce(v_reason, 'Privileged member enrollment routed.')
  );

  if v_team.capstone_fk is not null then
    perform watmatch_reopen_capstone_review_after_membership_change(v_team.capstone_fk, p_team_id);
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'team_member_added',
    'team',
    p_team_id::text,
    v_reason,
    jsonb_build_object('student_id', p_student_id)
  );

  select *
    into v_team
  from teams
  where team_id = p_team_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Student added to team.',
    'data', to_jsonb(v_team)
  );
end;
$$;

create or replace function watmatch_privileged_remove_team_member(
  p_team_id bigint,
  p_student_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_capstone_id bigint;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor') then
    raise exception 'Forbidden. Only instructors/admins can reorganize teams.' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Privileged member removal requires an audit reason.' using errcode = '23514';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_capstone_id is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_capstone_id
    for update;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while member removal was starting. Please retry.' using errcode = '40001';
  end if;

  if not watmatch_actor_can_manage_team(p_team_id, p_actor_id, v_role) then
    raise exception 'Forbidden. You can only modify teams routed to your course.'
      using errcode = '42501';
  end if;

  if v_team.leader_fk is not null and v_team.leader_fk = p_student_id then
    raise exception 'Cannot remove team leader via member removal. Reassign leader first.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from team_memberships
    where team_fk = p_team_id
      and user_fk = p_student_id
  ) then
    raise exception 'Student is not a member of this team.' using errcode = 'P0002';
  end if;

  if v_team.capstone_fk is not null then
    if v_capstone.capstone_id is null then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;

    if v_capstone.archived is true then
      raise exception 'This capstone is archived.' using errcode = '23514';
    end if;

    if v_capstone.status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing') then
      raise exception 'Team membership is locked while capstone status is %', v_capstone.status
        using errcode = '23514';
    end if;
  end if;

  delete from team_memberships
  where team_fk = p_team_id
    and user_fk = p_student_id;

  if v_team.capstone_fk is not null then
    perform watmatch_reopen_capstone_review_after_membership_change(v_team.capstone_fk, p_team_id);
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'team_member_removed',
    'team',
    p_team_id::text,
    v_reason,
    jsonb_build_object('student_id', p_student_id)
  );

  select *
    into v_team
  from teams
  where team_id = p_team_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Student removed from team.',
    'data', to_jsonb(v_team)
  );
end;
$$;

create or replace function watmatch_leave_team(
  p_team_id bigint,
  p_user_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_capstone_id bigint;
  v_member_count integer;
begin
  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '28000';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_capstone_id is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_capstone_id
    for update;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while leave was starting. Please retry.' using errcode = '40001';
  end if;

  if not exists (
    select 1
    from team_memberships
    where team_fk = p_team_id
      and user_fk = p_user_id
  ) then
    raise exception 'User is not a member of this team.' using errcode = '42501';
  end if;

  select count(*)
    into v_member_count
  from team_memberships
  where team_fk = p_team_id;

  if v_team.leader_fk is not null and v_team.leader_fk = p_user_id then
    if v_member_count = 1 then
      return watmatch_disband_team(p_team_id, p_user_id, 'student', 'leader_left');
    end if;

    raise exception 'Leader cannot leave while other members exist. Appoint a new leader first.'
      using errcode = '23514';
  end if;

  if v_team.capstone_fk is not null then
    if v_capstone.capstone_id is null then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;

    if v_capstone.archived is true then
      raise exception 'This capstone is archived.' using errcode = '23514';
    end if;

    if v_capstone.status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing') then
      raise exception 'Team membership is locked while capstone status is %', v_capstone.status
        using errcode = '23514';
    end if;
  end if;

  delete from team_memberships
  where team_fk = p_team_id
    and user_fk = p_user_id;

  if v_team.capstone_fk is not null then
    perform watmatch_reopen_capstone_review_after_membership_change(v_team.capstone_fk, p_team_id);
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id;

  return jsonb_build_object(
    'success', true,
    'message', 'User successfully left the team.',
    'data', to_jsonb(v_team)
  );
end;
$$;

create or replace function watmatch_leader_remove_team_member(
  p_team_id bigint,
  p_student_id bigint,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_capstone_id bigint;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_capstone_id is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_capstone_id
    for update;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while member removal was starting. Please retry.' using errcode = '40001';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can remove members.' using errcode = '42501';
  end if;

  if p_student_id = p_actor_id then
    raise exception 'Cannot remove the team leader. Leader must leave the team instead.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from team_memberships
    where team_fk = p_team_id
      and user_fk = p_student_id
  ) then
    raise exception 'Student is not a member of this team.' using errcode = 'P0002';
  end if;

  if v_team.capstone_fk is not null then
    if v_capstone.capstone_id is null then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;

    if v_capstone.archived is true then
      raise exception 'This capstone is archived.' using errcode = '23514';
    end if;

    if v_capstone.status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing') then
      raise exception 'Team membership is locked while capstone status is %', v_capstone.status
        using errcode = '23514';
    end if;
  end if;

  delete from team_memberships
  where team_fk = p_team_id
    and user_fk = p_student_id;

  if v_team.capstone_fk is not null then
    perform watmatch_reopen_capstone_review_after_membership_change(v_team.capstone_fk, p_team_id);
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Member removed from the team.',
    'data', to_jsonb(v_team)
  );
end;
$$;

create or replace function watmatch_disband_team(
  p_team_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_actor_course bigint;
  v_capstone_id bigint;
  v_now timestamptz := now();
  v_was_archived boolean := false;
  v_phase text := watmatch_current_marketplace_phase();
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor', 'student') then
    raise exception 'Forbidden. Unauthorized role for team disband.' using errcode = '42501';
  end if;

  if v_role in ('admin', 'instructor') and v_reason is null then
    raise exception 'Privileged team disband requires an audit reason.' using errcode = '23514';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_capstone_id is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_capstone_id
    for update;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while disband was starting. Please retry.' using errcode = '40001';
  end if;

  v_phase := watmatch_effective_marketplace_phase_for_team(p_team_id);
  v_was_archived := v_team.status = 'archived';

  select course_fk
    into v_actor_course
  from users
  where user_id = p_actor_id;

  if v_role = 'instructor' then
    if v_actor_course is null then
      raise exception 'Instructor must be assigned to a course.' using errcode = '23514';
    end if;

    if not watmatch_actor_can_manage_team(p_team_id, p_actor_id, v_role) then
      raise exception 'Forbidden. You can only disband teams routed to your course.'
        using errcode = '42501';
    end if;
  elsif v_role = 'student' then
    if v_team.leader_fk is distinct from p_actor_id then
      raise exception 'Forbidden. Only the sole team leader can leave and disband this team.'
        using errcode = '42501';
    end if;

    if (
      select count(*)
      from team_memberships
      where team_fk = p_team_id
    ) <> 1 then
      raise exception 'Leader cannot leave while other members exist. Appoint a new leader first.'
        using errcode = '23514';
    end if;
  end if;

  if v_capstone.capstone_id is not null then
    if v_role = 'student'
       and v_capstone.archived is not true
       and v_capstone.status in ('approved', 'complete', 'approved_recruiting', 'pending_review', 'pending_admin_course_routing')
       and not (
         v_reason = 'solo_leader_abandon'
         and v_phase in ('exploration', 'commitment')
         and v_capstone.status in ('approved_recruiting', 'draft', 'changes_requested', 'rejected')
       ) then
      raise exception 'This team is locked because its capstone is under review, recruiting, or finalized.'
        using errcode = '23514';
    end if;

    if v_capstone.archived is not true then
      update capstones
      set approval = false,
          status = 'archived',
          archived = true,
          archived_at = coalesce(archived_at, v_now),
          archived_reason = coalesce(v_reason, 'team_disbanded'),
          updated_at = v_now
      where capstone_id = v_capstone.capstone_id;
    end if;
  end if;

  update project_explorations
  set status = 'expired',
      decided_by_fk = p_actor_id,
      decided_at = coalesce(decided_at, v_now),
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = v_now
  where team_fk = p_team_id
    and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

  update project_commitment_requests
  set status = 'cancelled',
      decided_by_fk = p_actor_id,
      decided_at = v_now,
      comments = coalesce(comments, 'Team was disbanded.'),
      updated_at = v_now
  where team_fk = p_team_id
    and status = 'pending';

  if v_capstone_id is not null then
    update mentor_requests
    set status = 'cancelled',
        response_note = coalesce(v_reason, 'Team was disbanded.'),
        decided_by_fk = p_actor_id,
        decided_at = coalesce(decided_at, v_now),
        updated_at = v_now
    where capstone_fk = v_capstone_id
      and status = 'pending';
  end if;

  update teams
  set status = 'archived',
      leader_fk = null,
      commitment_roster_confirmed_at = null,
      commitment_roster_confirmed_by_fk = null,
      commitment_roster_note = null
  where team_id = p_team_id;

  delete from team_memberships
  where team_fk = p_team_id;

  update users
  set active_team_fk = null
  where active_team_fk = p_team_id;

  if not v_was_archived then
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      'team_disbanded',
      'team',
      p_team_id::text,
      v_reason,
      jsonb_build_object('capstone_id', v_team.capstone_fk)
    );

    if v_team.capstone_fk is not null then
      insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
      values (
        p_actor_id,
        v_role,
        'capstone_archived_via_team_disband',
        'capstone',
        v_team.capstone_fk::text,
        v_reason,
        jsonb_build_object('team_id', p_team_id)
      );

      insert into approvals (capstone_fk, instructor_fk, action, comments)
      values (v_team.capstone_fk, p_actor_id, 'capstone_archived_via_team_disband', v_reason);
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'message', case when v_was_archived then 'Team was already disbanded; workflow state repaired.' when v_team.capstone_fk is null then 'Team disbanded successfully.' else 'Team disbanded and linked capstone archived.' end,
    'data', jsonb_build_object('team_id', p_team_id, 'capstone_id', v_team.capstone_fk, 'capstone_archived', v_team.capstone_fk is not null)
  );
end;
$$;

create or replace function watmatch_student_abandon_solo_project(
  p_team_id bigint,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase text := watmatch_current_marketplace_phase();
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_member_count integer := 0;
begin
  if p_team_id is null or p_actor_id is null then
    raise exception 'Invalid abandon request.' using errcode = '22023';
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  v_phase := watmatch_effective_marketplace_phase_for_team(p_team_id);

  if v_phase not in ('exploration', 'commitment') then
    raise exception 'Projects can only be abandoned by the solo leader during exploration or commitment. Contact an instructor during finalization.'
      using errcode = '23514';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the solo team leader can abandon this project.' using errcode = '42501';
  end if;

  select count(*)::integer
    into v_member_count
  from team_memberships
  where team_fk = p_team_id;

  if v_member_count <> 1 then
    raise exception 'Only solo leaders can abandon a project. Reassign or resolve teammates first.'
      using errcode = '23514';
  end if;

  if v_team.capstone_fk is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_team.capstone_fk
    for update;

    if not found then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;

    if v_capstone.archived is true then
      raise exception 'This capstone is archived.' using errcode = '23514';
    end if;

    if v_capstone.status in ('pending_review', 'pending_admin_course_routing', 'approved') then
      raise exception 'This project is already in official review or approval. Contact an instructor to disband it.'
        using errcode = '23514';
    end if;
  end if;

  return watmatch_disband_team(p_team_id, p_actor_id, 'student', 'solo_leader_abandon');
end;
$$;

create or replace function watmatch_reassign_team_leader(
  p_team_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_new_leader_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_capstone_id bigint;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_previous_leader bigint;
  v_new_leader users%rowtype;
  v_now timestamptz := now();
begin
  if v_role not in ('student', 'instructor', 'admin') then
    raise exception 'Forbidden role.' using errcode = '42501';
  end if;

  if v_role in ('admin', 'instructor') and v_reason is null then
    raise exception 'Privileged leader reassignment requires an audit reason.' using errcode = '23514';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_capstone_id is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_capstone_id
    for update;

    if not found then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while leader reassignment was starting. Please retry.' using errcode = '40001';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'Team leadership cannot be changed after the team is archived or finalized.'
      using errcode = '23514';
  end if;

  perform watmatch_assert_team_members_valid(p_team_id);

  if v_role = 'student' then
    if v_team.leader_fk is distinct from p_actor_id then
      raise exception 'Forbidden. Only the current leader can reassign leadership.'
        using errcode = '42501';
    end if;
  elsif not watmatch_actor_can_manage_team(p_team_id, p_actor_id, v_role) then
    raise exception 'Forbidden. You are not scoped to this team.' using errcode = '42501';
  end if;

  if v_capstone_id is not null then
    if v_capstone.archived is not true
       and v_capstone.status in ('approved', 'complete', 'pending_review', 'pending_admin_course_routing') then
      raise exception 'Team leadership is locked while capstone status is %', v_capstone.status
        using errcode = '23514';
    end if;
  end if;

  if not exists (
    select 1
    from team_memberships
    where team_fk = p_team_id
      and user_fk = p_new_leader_id
  ) then
    raise exception 'New leader must be an existing team member.' using errcode = '23514';
  end if;

  select *
    into v_new_leader
  from users
  where user_id = p_new_leader_id
  for update;

  if not found then
    raise exception 'New leader user not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_new_leader.role, '')) <> 'student' then
    raise exception 'New leader must be a student.' using errcode = '23514';
  end if;

  if v_new_leader.course_fk is null then
    raise exception 'New leader must be assigned to a course.' using errcode = '23514';
  end if;

  v_previous_leader := v_team.leader_fk;
  if v_previous_leader is distinct from p_new_leader_id then
    update teams
    set leader_fk = p_new_leader_id,
        course_fk = v_new_leader.course_fk
    where team_id = p_team_id
    returning * into v_team;

    if v_capstone_id is not null then
      update capstones
      set course_fk = v_new_leader.course_fk,
          updated_at = v_now
      where capstone_id = v_capstone_id
        and course_fk is distinct from v_new_leader.course_fk;
    end if;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      'team_leader_reassigned',
      'team',
      p_team_id::text,
      v_reason,
      jsonb_build_object(
        'previous_leader_id', v_previous_leader,
        'new_leader_id', p_new_leader_id,
        'new_course_fk', v_new_leader.course_fk
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Team leader reassigned successfully.',
    'data', to_jsonb(v_team)
  );
end;
$$;

create or replace function watmatch_assert_active_mentor_user(p_mentor_id bigint)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mentor users%rowtype;
begin
  if p_mentor_id is null then
    raise exception 'Mentor is required.' using errcode = '22023';
  end if;

  select *
    into v_mentor
  from users
  where user_id = p_mentor_id
    and active is true
    and lower(coalesce(role, '')) = 'mentor';

  if not found then
    raise exception 'Active mentor not found.' using errcode = 'P0002';
  end if;

  return v_mentor;
end;
$$;

create or replace function watmatch_can_manage_capstone_mentors(
  p_capstone_id bigint,
  p_team_id bigint,
  p_actor_id bigint,
  p_actor_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_actor_course bigint;
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
begin
  if p_capstone_id is null or p_team_id is null or p_actor_id is null then
    return false;
  end if;

  if v_role = 'admin' then
    return true;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found or v_team.team_id is null then
    return false;
  end if;

  if v_role = 'student' then
    return v_team.leader_fk is not distinct from p_actor_id;
  end if;

  if v_role = 'instructor' then
    select course_fk
      into v_actor_course
    from users
    where user_id = p_actor_id
      and active is true
      and lower(coalesce(role, '')) = 'instructor';

    if v_actor_course is null then
      return false;
    end if;

    return v_actor_course is not distinct from v_team.course_fk
      or v_actor_course is not distinct from v_capstone.course_fk
      or exists (
        select 1
        from capstone_course_approvals cca
        where cca.capstone_fk = p_capstone_id
          and cca.course_fk = v_actor_course
      );
  end if;

  return false;
end;
$$;

create or replace function watmatch_mentor_request_json(p_request mentor_requests)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'mentor_request_id', p_request.mentor_request_id,
    'capstone_fk', p_request.capstone_fk,
    'team_fk', p_request.team_fk,
    'mentor_fk', p_request.mentor_fk,
    'requested_by_fk', p_request.requested_by_fk,
    'request_source', p_request.request_source,
    'status', p_request.status,
    'message', p_request.message,
    'response_note', p_request.response_note,
    'decided_by_fk', p_request.decided_by_fk,
    'decided_at', p_request.decided_at,
    'created_at', p_request.created_at,
    'updated_at', p_request.updated_at,
    'mentor', (
      select jsonb_build_object(
        'user_id', u.user_id,
        'email', u.email,
        'active', u.active,
        'profile', watmatch_mentor_profile_json(u.user_id)
      )
      from users u
      where u.user_id = p_request.mentor_fk
    ),
    'requested_by', (
      select jsonb_build_object(
        'user_id', u.user_id,
        'email', u.email,
        'role', u.role
      )
      from users u
      where u.user_id = p_request.requested_by_fk
    ),
    'capstone', (
      select to_jsonb(c)
        || jsonb_build_object(
          'capstone_id', c.capstone_id,
          'title', c.title,
          'description', c.description,
          'public_status', case
            when c.status = 'approved_recruiting' then 'recruiting'
            when c.status = 'complete' then 'complete'
            when exists (
              select 1
              from teams project_team
              where project_team.team_id = c.team_fk
                and project_team.status = 'finalized'
            ) then 'finalized'
            else c.status
          end,
          'disciplines', coalesce(to_jsonb(c.disciplines), '[]'::jsonb),
          'department_ids', coalesce(
            (
              select jsonb_agg(cd.department_fk order by d.name)
              from capstone_departments cd
              join departments d on d.department_id = cd.department_fk
              where cd.capstone_fk = c.capstone_id
            ),
            '[]'::jsonb
          ),
          'departments', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'department_id', d.department_id,
                  'name', d.name,
                  'active', d.active
                )
                order by d.name
              )
              from capstone_departments cd
              join departments d on d.department_id = cd.department_fk
              where cd.capstone_fk = c.capstone_id
            ),
            '[]'::jsonb
          ),
          'department', coalesce(
            (
              select string_agg(d.name, ', ' order by d.name)
              from capstone_departments cd
              join departments d on d.department_id = cd.department_fk
              where cd.capstone_fk = c.capstone_id
            ),
            nullif(array_to_string(coalesce(c.disciplines, '{}'::text[]), ', '), '')
          ),
          'skills', coalesce(to_jsonb(c.skills), '[]'::jsonb),
          'marketplace_phase', watmatch_effective_marketplace_phase_for_capstone(c.capstone_id),
          'marketplace_phase_context', watmatch_marketplace_phase_context_for_capstone(c.capstone_id),
          'marketplace_action_state', case
            when watmatch_capstone_accepts_marketplace_activity(c.capstone_id) then 'actionable'
            when exists (
              select 1
              from teams project_team
              where project_team.team_id = c.team_fk
                and project_team.status = 'finalized'
            ) then 'finalized'
            else 'read_only'
          end,
          'read_only_reason', watmatch_capstone_marketplace_read_only_reason(c.capstone_id),
          'support_summary', watmatch_capstone_support_summary(c.capstone_id)
        )
      from capstones c
      where c.capstone_id = p_request.capstone_fk
    ),
    'team', (
      select jsonb_build_object(
        'team_id', t.team_id,
        'leader_fk', t.leader_fk,
        'status', t.status,
        'course_fk', t.course_fk
      )
      from teams t
      where t.team_id = p_request.team_fk
    )
  );
end;
$$;

create or replace function watmatch_capstone_support_summary(p_capstone_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_course courses%rowtype;
  v_team teams%rowtype;
  v_accepted jsonb := null;
  v_pending_requests integer := 0;
  v_pending_offers integer := 0;
begin
  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found then
    return jsonb_build_object(
      'has_support', false,
      'accepted_mentor', null,
      'external_partner_support_confirmed', false
    );
  end if;

  if v_capstone.team_fk is not null then
    select *
      into v_team
    from teams
    where team_id = v_capstone.team_fk;
  end if;

  if coalesce(v_capstone.course_fk, v_team.course_fk) is not null then
    select *
      into v_course
    from courses
    where course_id = coalesce(v_capstone.course_fk, v_team.course_fk);
  end if;

  select jsonb_build_object(
      'mentor_request_id', mr.mentor_request_id,
      'mentor_fk', mr.mentor_fk,
      'mentor_email', u.email,
      'email', u.email,
      'accepted_at', mr.decided_at,
      'profile', watmatch_mentor_profile_json(u.user_id)
    )
    into v_accepted
  from mentor_requests mr
  join users u on u.user_id = mr.mentor_fk
  where mr.capstone_fk = p_capstone_id
    and mr.status = 'accepted'
    and (
      u.active is true
      or coalesce(v_team.status, '') = 'finalized'
    )
  order by mr.decided_at desc nulls last, mr.updated_at desc
  limit 1;

  select count(*)::integer
    into v_pending_requests
  from mentor_requests
  where capstone_fk = p_capstone_id
    and status = 'pending'
    and request_source <> 'mentor_offer';

  select count(*)::integer
    into v_pending_offers
  from mentor_requests
  where capstone_fk = p_capstone_id
    and status = 'pending'
    and request_source = 'mentor_offer';

  return jsonb_build_object(
    'requires_project_support', coalesce(v_course.requires_project_support, true),
    'has_support', v_accepted is not null or v_capstone.external_partner_support_confirmed is true,
    'accepted_mentor', v_accepted,
    'pending_mentor_request_count', v_pending_requests,
    'pending_mentor_offer_count', v_pending_offers,
    'external_partner_support_confirmed', coalesce(v_capstone.external_partner_support_confirmed, false),
    'external_partner_support_confirmed_at', v_capstone.external_partner_support_confirmed_at,
    'external_partner', jsonb_build_object(
      'name', v_capstone.external_partner_name,
      'organization', v_capstone.external_partner_organization,
      'email', v_capstone.external_partner_email,
      'website', v_capstone.external_partner_website
    )
  );
end;
$$;

create or replace function watmatch_cancel_pending_mentor_requests_for_capstone(
  p_capstone_id bigint,
  p_excluding_request_id bigint default null,
  p_actor_id bigint default null,
  p_actor_role text default 'system',
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mentor_requests
  set status = 'cancelled',
      response_note = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), response_note, 'Mentor request is no longer needed.'),
      decided_by_fk = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where capstone_fk = p_capstone_id
    and status = 'pending'
    and (
      p_excluding_request_id is null
      or mentor_request_id <> p_excluding_request_id
    );
end;
$$;

create or replace function watmatch_mentor_profile_json(p_mentor_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile mentor_profiles%rowtype;
  v_primary_department jsonb := null;
  v_departments jsonb := '[]'::jsonb;
  v_active_project_count integer := 0;
begin
  select *
    into v_profile
  from mentor_profiles
  where mentor_fk = p_mentor_id;

  if v_profile.primary_department_fk is not null then
    select jsonb_build_object(
        'department_id', d.department_id,
        'name', d.name,
        'active', d.active
      )
      into v_primary_department
    from departments d
    where d.department_id = v_profile.primary_department_fk;
  end if;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'department_id', d.department_id,
        'name', d.name,
        'active', d.active
      )
      order by d.name
    ), '[]'::jsonb)
    into v_departments
  from mentor_profile_departments mpd
  join departments d on d.department_id = mpd.department_fk
  where mpd.mentor_fk = p_mentor_id;

  select count(*)::integer
    into v_active_project_count
  from mentor_requests mr
  join capstones c on c.capstone_id = mr.capstone_fk
  left join teams t on t.team_id = mr.team_fk
  where mr.mentor_fk = p_mentor_id
    and mr.status = 'accepted'
    and c.archived is false
    and c.status <> 'complete'
    and coalesce(t.status, '') <> 'archived';

  return jsonb_build_object(
    'mentor_fk', p_mentor_id,
    'display_name', v_profile.display_name,
    'primary_department_fk', v_profile.primary_department_fk,
    'primary_department', v_primary_department,
    'departments', v_departments,
    'affiliation', v_profile.affiliation,
    'bio', v_profile.bio,
    'availability_terms', coalesce(v_profile.availability_terms, '{}'::text[]),
    'expertise_tags', coalesce(v_profile.expertise_tags, '{}'::text[]),
    'max_active_projects', v_profile.max_active_projects,
    'active_project_count', v_active_project_count,
    'updated_at', v_profile.updated_at
  );
end;
$$;

create or replace function watmatch_upsert_mentor_profile(
  p_actor_id bigint,
  p_actor_role text,
  p_mentor_id bigint default null,
  p_display_name text default null,
  p_primary_department_id bigint default null,
  p_department_ids bigint[] default null,
  p_affiliation text default null,
  p_bio text default null,
  p_availability_terms text[] default null,
  p_expertise_tags text[] default null,
  p_max_active_projects integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_mentor_id bigint := coalesce(p_mentor_id, p_actor_id);
  v_department_ids bigint[] := '{}'::bigint[];
  v_availability_terms text[] := watmatch_normalize_course_active_terms(p_availability_terms);
  v_expertise_tags text[] := '{}'::text[];
  v_profile mentor_profiles%rowtype;
begin
  if v_role not in ('mentor', 'admin') then
    raise exception 'Mentor or admin access required.' using errcode = '42501';
  end if;

  if v_role = 'mentor' and v_mentor_id is distinct from p_actor_id then
    raise exception 'Mentors can only edit their own profile.' using errcode = '42501';
  end if;

  perform watmatch_assert_active_mentor_user(v_mentor_id);

  if p_primary_department_id is not null and not exists (
    select 1 from departments where department_id = p_primary_department_id
  ) then
    raise exception 'Primary department not found.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct department_id order by department_id), '{}'::bigint[])
    into v_department_ids
  from (
    select unnest(coalesce(p_department_ids, '{}'::bigint[])) as department_id
    union all
    select p_primary_department_id where p_primary_department_id is not null
  ) raw
  where department_id is not null
    and exists (
      select 1 from departments d where d.department_id = raw.department_id
    );

  select coalesce(array_agg(tag order by tag), '{}'::text[])
    into v_expertise_tags
  from (
    select distinct nullif(btrim(value), '') as tag
    from unnest(coalesce(p_expertise_tags, '{}'::text[])) as value
  ) normalized
  where tag is not null;

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
  values (
    v_mentor_id,
    nullif(btrim(coalesce(p_display_name, '')), ''),
    p_primary_department_id,
    nullif(btrim(coalesce(p_affiliation, '')), ''),
    nullif(btrim(coalesce(p_bio, '')), ''),
    coalesce(v_availability_terms, '{}'::text[]),
    coalesce(v_expertise_tags, '{}'::text[]),
    p_max_active_projects,
    now()
  )
  on conflict (mentor_fk) do update
    set display_name = excluded.display_name,
        primary_department_fk = excluded.primary_department_fk,
        affiliation = excluded.affiliation,
        bio = excluded.bio,
        availability_terms = excluded.availability_terms,
        expertise_tags = excluded.expertise_tags,
        max_active_projects = excluded.max_active_projects,
        updated_at = excluded.updated_at
  returning * into v_profile;

  delete from mentor_profile_departments
  where mentor_fk = v_mentor_id;

  insert into mentor_profile_departments (mentor_fk, department_fk)
  select v_mentor_id, department_id
  from unnest(v_department_ids) as department_id
  on conflict do nothing;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'mentor_profile_updated',
    'mentor_profile',
    v_mentor_id::text,
    null,
    watmatch_mentor_profile_json(v_mentor_id)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Mentor profile saved.',
    'data', watmatch_mentor_profile_json(v_mentor_id)
  );
end;
$$;

create or replace function watmatch_active_mentor_users(
  p_actor_id bigint,
  p_actor_role text,
  p_search text default null,
  p_department_id bigint default null,
  p_availability_term text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_availability_term text := nullif(btrim(coalesce(p_availability_term, '')), '');
  v_pattern text;
  v_data jsonb := '[]'::jsonb;
begin
  if v_role not in ('student', 'instructor', 'admin') then
    raise exception 'Student, instructor, or admin access required.' using errcode = '42501';
  end if;

  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_') || '%';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', u.user_id,
        'email', u.email,
        'active', u.active,
        'profile', watmatch_mentor_profile_json(u.user_id)
      )
      order by coalesce(mp.display_name, u.email), u.email
    ),
    '[]'::jsonb
  )
  into v_data
  from users u
  left join mentor_profiles mp on mp.mentor_fk = u.user_id
  where u.active is true
    and lower(coalesce(u.role, '')) = 'mentor'
    and (
      v_search is null
      or u.email ilike v_pattern escape '!'
      or mp.display_name ilike v_pattern escape '!'
      or mp.affiliation ilike v_pattern escape '!'
      or exists (
        select 1
        from unnest(coalesce(mp.expertise_tags, '{}'::text[])) tag
        where tag ilike v_pattern escape '!'
      )
    )
    and (
      p_department_id is null
      or mp.primary_department_fk = p_department_id
      or exists (
        select 1
        from mentor_profile_departments mpd
        where mpd.mentor_fk = u.user_id
          and mpd.department_fk = p_department_id
      )
    )
    and (
      v_availability_term is null
      or coalesce(mp.availability_terms, '{}'::text[]) @> array[v_availability_term]::text[]
    );

  return jsonb_build_object('success', true, 'data', v_data);
end;
$$;

create or replace function watmatch_capstone_accepts_mentor_support(
  p_capstone_id bigint,
  p_for_mentor_offer boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from capstones c
    join teams t on t.team_id = c.team_fk
    where c.capstone_id = p_capstone_id
      and c.archived is not true
      and t.status <> 'archived'
      and c.status <> 'complete'
      and (
        (
          p_for_mentor_offer is not true
          and t.status <> 'finalized'
          and c.status in ('draft', 'changes_requested', 'pending_review', 'pending_admin_course_routing', 'approved_recruiting')
        )
        or (
          p_for_mentor_offer is true
          and t.status <> 'finalized'
          and c.status = 'approved_recruiting'
        )
        or (
          coalesce(c.carry_over_read_only, false) is true
          and c.status in ('approved_recruiting', 'approved')
          and c.closeout_decision in ('carry_over_read_only', 'continue_to_course')
        )
      )
  );
$$;

create or replace function watmatch_create_mentor_request(
  p_capstone_id bigint,
  p_mentor_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_mentor users%rowtype;
  v_existing mentor_requests%rowtype;
  v_request mentor_requests%rowtype;
  v_source text;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if p_capstone_id is null or p_actor_id is null then
    raise exception 'Invalid mentor request.' using errcode = '22023';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found or v_capstone.team_fk is null then
    raise exception 'Capstone not found.' using errcode = 'P0002';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found or v_team.capstone_fk is distinct from v_capstone.capstone_id then
    raise exception 'Linked team not found.' using errcode = 'P0002';
  end if;

  if not watmatch_capstone_accepts_mentor_support(v_capstone.capstone_id, false) then
    raise exception 'This capstone is not accepting mentor requests right now.' using errcode = '23514';
  end if;

  if not watmatch_can_manage_capstone_mentors(v_capstone.capstone_id, v_team.team_id, p_actor_id, v_role) then
    raise exception 'Forbidden. Team leader, scoped instructor, or admin access required.' using errcode = '42501';
  end if;

  v_mentor := watmatch_assert_active_mentor_user(p_mentor_id);
  v_source := case when v_role = 'student' then 'team_request' else 'staff_request' end;

  if exists (
    select 1
    from mentor_requests
    where capstone_fk = v_capstone.capstone_id
      and status = 'accepted'
  ) then
    raise exception 'This capstone already has an accepted mentor.' using errcode = '23514';
  end if;

  select *
    into v_existing
  from mentor_requests
  where capstone_fk = v_capstone.capstone_id
    and mentor_fk = v_mentor.user_id
    and status = 'pending'
  for update;

  if found and v_existing.request_source = 'mentor_offer' then
    update mentor_requests
    set status = 'accepted',
        response_note = coalesce(v_message, 'Team accepted the mentor offer by requesting this mentor.'),
        decided_by_fk = p_actor_id,
        decided_at = now(),
        updated_at = now()
    where mentor_request_id = v_existing.mentor_request_id
    returning * into v_request;

    perform watmatch_cancel_pending_mentor_requests_for_capstone(
      v_capstone.capstone_id,
      v_request.mentor_request_id,
      p_actor_id,
      v_role,
      'Another mentor was accepted.'
    );
  elsif found then
    update mentor_requests
    set request_source = v_source,
        requested_by_fk = p_actor_id,
        message = coalesce(v_message, message),
        updated_at = now()
    where mentor_request_id = v_existing.mentor_request_id
    returning * into v_request;
  else
    insert into mentor_requests (
      capstone_fk,
      team_fk,
      mentor_fk,
      requested_by_fk,
      request_source,
      status,
      message
    )
    values (
      v_capstone.capstone_id,
      v_team.team_id,
      v_mentor.user_id,
      p_actor_id,
      v_source,
      'pending',
      v_message
    )
    returning * into v_request;
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    case when v_request.status = 'accepted' then 'mentor_offer_accepted' else 'mentor_requested' end,
    'mentor_request',
    v_request.mentor_request_id::text,
    v_message,
    watmatch_mentor_request_json(v_request)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when v_request.status = 'accepted' then 'Mentor offer accepted.' else 'Mentor request sent.' end,
    'data', watmatch_mentor_request_json(v_request)
  );
end;
$$;

create or replace function watmatch_create_mentor_offer(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_existing mentor_requests%rowtype;
  v_request mentor_requests%rowtype;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  v_actor := watmatch_assert_active_mentor_user(p_actor_id);

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found or v_capstone.team_fk is null then
    raise exception 'Capstone not found.' using errcode = 'P0002';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found or v_team.capstone_fk is distinct from v_capstone.capstone_id then
    raise exception 'Linked team not found.' using errcode = 'P0002';
  end if;

  if not watmatch_capstone_accepts_mentor_support(v_capstone.capstone_id, true) then
    raise exception 'Mentors can only offer support on recruiting or read-only carried-over capstones.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from mentor_requests
    where capstone_fk = v_capstone.capstone_id
      and status = 'accepted'
  ) then
    raise exception 'This capstone already has an accepted mentor.' using errcode = '23514';
  end if;

  select *
    into v_existing
  from mentor_requests
  where capstone_fk = v_capstone.capstone_id
    and mentor_fk = v_actor.user_id
    and status = 'pending'
  for update;

  if found and v_existing.request_source <> 'mentor_offer' then
    update mentor_requests
    set status = 'accepted',
        response_note = coalesce(v_message, 'Mentor accepted the team request.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    where mentor_request_id = v_existing.mentor_request_id
    returning * into v_request;

    perform watmatch_cancel_pending_mentor_requests_for_capstone(
      v_capstone.capstone_id,
      v_request.mentor_request_id,
      v_actor.user_id,
      'mentor',
      'Another mentor was accepted.'
    );
  elsif found then
    update mentor_requests
    set message = coalesce(v_message, message),
        updated_at = now()
    where mentor_request_id = v_existing.mentor_request_id
    returning * into v_request;
  else
    insert into mentor_requests (
      capstone_fk,
      team_fk,
      mentor_fk,
      requested_by_fk,
      request_source,
      status,
      message
    )
    values (
      v_capstone.capstone_id,
      v_team.team_id,
      v_actor.user_id,
      v_actor.user_id,
      'mentor_offer',
      'pending',
      v_message
    )
    returning * into v_request;
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    'mentor',
    case when v_request.status = 'accepted' then 'mentor_request_accepted' else 'mentor_offered' end,
    'mentor_request',
    v_request.mentor_request_id::text,
    v_message,
    watmatch_mentor_request_json(v_request)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when v_request.status = 'accepted' then 'Mentor request accepted.' else 'Mentor offer sent.' end,
    'data', watmatch_mentor_request_json(v_request)
  );
end;
$$;

create or replace function watmatch_decide_mentor_request(
  p_request_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_decision text,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := nullif(btrim(coalesce(p_response_note, '')), '');
  v_request mentor_requests%rowtype;
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_status text;
begin
  if v_role <> 'mentor' then
    raise exception 'Mentor access required.' using errcode = '42501';
  end if;

  select *
    into v_request
  from mentor_requests
  where mentor_request_id = p_request_id
  for update;

  if not found then
    raise exception 'Mentor request not found.' using errcode = 'P0002';
  end if;

  if v_request.mentor_fk is distinct from p_actor_id then
    raise exception 'This mentor request is not assigned to you.' using errcode = '42501';
  end if;

  if v_request.request_source = 'mentor_offer' then
    raise exception 'Mentor offers must be decided by the team or staff.' using errcode = '23514';
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object(
      'success', true,
      'message', 'Mentor request was already decided.',
      'data', watmatch_mentor_request_json(v_request)
    );
  end if;

  if v_decision in ('accept', 'approve', 'accepted', 'approved') then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_request.capstone_fk
    for update;

    if not found then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;

    select *
      into v_team
    from teams
    where team_id = v_request.team_fk
    for update;

    if not found then
      raise exception 'Linked team not found.' using errcode = 'P0002';
    end if;

    if not watmatch_capstone_accepts_mentor_support(v_capstone.capstone_id, false) then
      raise exception 'This capstone is no longer accepting mentor approvals.' using errcode = '23514';
    end if;

    if exists (
      select 1
      from mentor_requests
      where capstone_fk = v_request.capstone_fk
        and status = 'accepted'
        and mentor_request_id <> v_request.mentor_request_id
    ) then
      raise exception 'This capstone already has an accepted mentor.' using errcode = '23514';
    end if;
    v_status := 'accepted';
  elsif v_decision in ('decline', 'reject', 'declined', 'rejected') then
    v_status := 'declined';
  else
    raise exception 'Decision must be accept or decline.' using errcode = '22023';
  end if;

  update mentor_requests
  set status = v_status,
      response_note = v_note,
      decided_by_fk = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where mentor_request_id = v_request.mentor_request_id
  returning * into v_request;

  if v_status = 'accepted' then
    perform watmatch_cancel_pending_mentor_requests_for_capstone(
      v_request.capstone_fk,
      v_request.mentor_request_id,
      p_actor_id,
      v_role,
      'Another mentor was accepted.'
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    case when v_status = 'accepted' then 'mentor_request_accepted' else 'mentor_request_declined' end,
    'mentor_request',
    v_request.mentor_request_id::text,
    v_note,
    watmatch_mentor_request_json(v_request)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when v_status = 'accepted' then 'Mentor request accepted.' else 'Mentor request declined.' end,
    'data', watmatch_mentor_request_json(v_request)
  );
end;
$$;

create or replace function watmatch_decide_mentor_offer(
  p_request_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_decision text,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := nullif(btrim(coalesce(p_response_note, '')), '');
  v_request mentor_requests%rowtype;
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_status text;
begin
  select *
    into v_request
  from mentor_requests
  where mentor_request_id = p_request_id
  for update;

  if not found then
    raise exception 'Mentor offer not found.' using errcode = 'P0002';
  end if;

  if v_request.request_source <> 'mentor_offer' then
    raise exception 'This mentor request must be decided by the mentor.' using errcode = '23514';
  end if;

  if not watmatch_can_manage_capstone_mentors(v_request.capstone_fk, v_request.team_fk, p_actor_id, v_role) then
    raise exception 'Forbidden. Team leader, scoped instructor, or admin access required.' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object(
      'success', true,
      'message', 'Mentor offer was already decided.',
      'data', watmatch_mentor_request_json(v_request)
    );
  end if;

  if v_decision in ('accept', 'approve', 'accepted', 'approved') then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_request.capstone_fk
    for update;

    if not found then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;

    select *
      into v_team
    from teams
    where team_id = v_request.team_fk
    for update;

    if not found then
      raise exception 'Linked team not found.' using errcode = 'P0002';
    end if;

    if not watmatch_capstone_accepts_mentor_support(v_capstone.capstone_id, true) then
      raise exception 'This mentor offer is no longer actionable.' using errcode = '23514';
    end if;

    if exists (
      select 1
      from mentor_requests
      where capstone_fk = v_request.capstone_fk
        and status = 'accepted'
        and mentor_request_id <> v_request.mentor_request_id
    ) then
      raise exception 'This capstone already has an accepted mentor.' using errcode = '23514';
    end if;
    v_status := 'accepted';
  elsif v_decision in ('decline', 'reject', 'declined', 'rejected') then
    v_status := 'declined';
  else
    raise exception 'Decision must be accept or decline.' using errcode = '22023';
  end if;

  update mentor_requests
  set status = v_status,
      response_note = v_note,
      decided_by_fk = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where mentor_request_id = v_request.mentor_request_id
  returning * into v_request;

  if v_status = 'accepted' then
    perform watmatch_cancel_pending_mentor_requests_for_capstone(
      v_request.capstone_fk,
      v_request.mentor_request_id,
      p_actor_id,
      v_role,
      'Another mentor was accepted.'
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    case when v_status = 'accepted' then 'mentor_offer_accepted' else 'mentor_offer_declined' end,
    'mentor_request',
    v_request.mentor_request_id::text,
    v_note,
    watmatch_mentor_request_json(v_request)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when v_status = 'accepted' then 'Mentor offer accepted.' else 'Mentor offer declined.' end,
    'data', watmatch_mentor_request_json(v_request)
  );
end;
$$;

create or replace function watmatch_cancel_mentor_request(
  p_request_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request mentor_requests%rowtype;
begin
  select *
    into v_request
  from mentor_requests
  where mentor_request_id = p_request_id
  for update;

  if not found then
    raise exception 'Mentor request not found.' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    return jsonb_build_object(
      'success', true,
      'message', 'Mentor request was already decided.',
      'data', watmatch_mentor_request_json(v_request)
    );
  end if;

  if not (
    watmatch_can_manage_capstone_mentors(v_request.capstone_fk, v_request.team_fk, p_actor_id, v_role)
    or (
      v_role = 'mentor'
      and v_request.request_source = 'mentor_offer'
      and v_request.mentor_fk is not distinct from p_actor_id
    )
  ) then
    raise exception 'Forbidden. You cannot cancel this mentor request.' using errcode = '42501';
  end if;

  update mentor_requests
  set status = 'cancelled',
      response_note = coalesce(v_reason, response_note),
      decided_by_fk = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where mentor_request_id = v_request.mentor_request_id
  returning * into v_request;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'mentor_request_cancelled',
    'mentor_request',
    v_request.mentor_request_id::text,
    v_reason,
    watmatch_mentor_request_json(v_request)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Mentor request cancelled.',
    'data', watmatch_mentor_request_json(v_request)
  );
end;
$$;

create or replace function watmatch_get_mentor_dashboard(
  p_actor_id bigint,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_pending jsonb := '[]'::jsonb;
  v_accepted jsonb := '[]'::jsonb;
  v_offers jsonb := '[]'::jsonb;
begin
  v_actor := watmatch_assert_active_mentor_user(p_actor_id);

  if lower(coalesce(p_actor_role, '')) <> 'mentor' then
    raise exception 'Mentor access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(watmatch_mentor_request_json(mr) order by mr.created_at desc), '[]'::jsonb)
    into v_pending
  from mentor_requests mr
  join capstones c on c.capstone_id = mr.capstone_fk
  join teams t on t.team_id = mr.team_fk
  where mr.mentor_fk = v_actor.user_id
    and mr.status = 'pending'
    and mr.request_source <> 'mentor_offer'
    and c.archived is false
    and t.status <> 'archived';

  select coalesce(jsonb_agg(watmatch_mentor_request_json(mr) order by mr.decided_at desc nulls last, mr.updated_at desc), '[]'::jsonb)
    into v_accepted
  from mentor_requests mr
  join capstones c on c.capstone_id = mr.capstone_fk
  where mr.mentor_fk = v_actor.user_id
    and mr.status = 'accepted'
    and c.archived is false;

  select coalesce(jsonb_agg(watmatch_mentor_request_json(mr) order by mr.created_at desc), '[]'::jsonb)
    into v_offers
  from mentor_requests mr
  join capstones c on c.capstone_id = mr.capstone_fk
  where mr.mentor_fk = v_actor.user_id
    and mr.request_source = 'mentor_offer'
    and c.archived is false;

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'profile', watmatch_mentor_profile_json(v_actor.user_id),
      'pending_requests', v_pending,
      'accepted_projects', v_accepted,
      'offers', v_offers
    )
  );
end;
$$;

create or replace function watmatch_get_capstone_mentor_requests(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_capstone capstones%rowtype;
  v_data jsonb := '[]'::jsonb;
begin
  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found or v_capstone.team_fk is null then
    raise exception 'Capstone not found.' using errcode = 'P0002';
  end if;

  if not (
    watmatch_can_manage_capstone_mentors(v_capstone.capstone_id, v_capstone.team_fk, p_actor_id, v_role)
    or exists (
      select 1
      from mentor_requests mr
      where mr.capstone_fk = v_capstone.capstone_id
        and mr.mentor_fk = p_actor_id
        and v_role = 'mentor'
    )
  ) then
    raise exception 'Forbidden. You cannot view mentor requests for this capstone.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(watmatch_mentor_request_json(mr) order by mr.status = 'accepted' desc, mr.created_at desc), '[]'::jsonb)
    into v_data
  from mentor_requests mr
  where mr.capstone_fk = v_capstone.capstone_id;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'support_summary', watmatch_capstone_support_summary(v_capstone.capstone_id)
  );
end;
$$;

create or replace function watmatch_finalize_team(
  p_team_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_capstone_id bigint;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_now timestamptz := now();
  v_course courses%rowtype;
  v_support_summary jsonb;
  v_is_staff_override boolean := false;
begin
  if v_role not in ('student', 'instructor', 'admin') then
    raise exception 'Forbidden. Team leader, scoped instructor, or admin access required to finalize recruiting.'
      using errcode = '42501';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = p_team_id;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_capstone_id is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_capstone_id
    for update;

    if not found then
      raise exception 'Linked capstone not found.' using errcode = 'P0002';
    end if;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while finalization was starting. Please retry.' using errcode = '40001';
  end if;

  if v_team.status = 'archived' then
    raise exception 'Archived teams cannot be finalized.' using errcode = '23514';
  end if;

  v_is_staff_override := v_role in ('instructor', 'admin');

  if v_role = 'student' then
    if v_team.leader_fk is distinct from p_actor_id then
      raise exception 'Forbidden. Only the team leader can finalize recruiting.'
        using errcode = '42501';
    end if;
  elsif watmatch_actor_can_manage_team(p_team_id, p_actor_id, v_role) is not true then
    raise exception 'Forbidden. You are not scoped to finalize this team.'
      using errcode = '42501';
  elsif v_reason is null then
    raise exception 'Staff finalization requires an audit reason.'
      using errcode = '23514';
  end if;

  perform watmatch_assert_team_members_valid(p_team_id);

  if v_team.leader_fk is null
     or not exists (
       select 1
       from team_memberships tm
       join users u on u.user_id = tm.user_fk
       where tm.team_fk = p_team_id
         and tm.user_fk = v_team.leader_fk
         and u.active is true
     ) then
    raise exception 'This team must have an active official leader before finalization.'
      using errcode = '23514';
  end if;

  if v_team.capstone_fk is null then
    raise exception 'Only teams with an approved recruiting capstone can be finalized.'
      using errcode = '23514';
  end if;

  if v_capstone.archived is true then
    raise exception 'Archived capstones cannot be finalized.' using errcode = '23514';
  end if;

  if v_capstone.status in ('approved', 'complete') then
    update teams
    set status = 'finalized'
    where team_id = p_team_id
      and status <> 'finalized';

    select *
      into v_team
    from teams
    where team_id = p_team_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Team was already finalized.',
      'data', to_jsonb(v_team),
      'capstone', to_jsonb(v_capstone)
    );
  end if;

  if v_capstone.status <> 'approved_recruiting' then
    raise exception 'Only approved recruiting capstones can be finalized.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from project_commitment_requests pcr
    where pcr.team_fk = p_team_id
      and pcr.status = 'pending'
  ) or exists (
    select 1
    from project_explorations pe
    where pe.team_fk = p_team_id
      and pe.status = 'pending_commitment'
  ) or exists (
    select 1
    from project_explorations pe
    where pe.team_fk = p_team_id
      and pe.status in ('exploring', 'pending_commitment')
      and pe.student_commitment_confirmed_at is not null
      and pe.team_commitment_confirmed_at is not null
  ) then
    raise exception 'Resolve pending marketplace commitments before finalizing this team.'
      using errcode = '23514';
  end if;

  if v_capstone.course_fk is not null then
    select *
      into v_course
    from courses
    where course_id = v_capstone.course_fk;
  elsif v_team.course_fk is not null then
    select *
      into v_course
    from courses
    where course_id = v_team.course_fk;
  end if;

  v_support_summary := watmatch_capstone_support_summary(v_capstone.capstone_id);

  if coalesce(v_course.requires_project_support, true) is true
     and coalesce((v_support_summary ->> 'has_support')::boolean, false) is not true then
    raise exception 'This course requires either an accepted mentor or confirmed external partner support before finalization.'
      using errcode = '23514';
  end if;

  update capstones
  set status = 'approved',
      approval = true,
      archived = false,
      updated_at = v_now
  where capstone_id = v_capstone.capstone_id
  returning * into v_capstone;

  update teams
  set status = 'finalized'
  where team_id = p_team_id
  returning * into v_team;

  perform watmatch_cancel_pending_mentor_requests_for_capstone(
    v_capstone.capstone_id,
    (
      select mentor_request_id
      from mentor_requests
      where capstone_fk = v_capstone.capstone_id
        and status = 'accepted'
      order by decided_at desc nulls last, updated_at desc
      limit 1
    ),
    p_actor_id,
    v_role,
    'Capstone team was finalized.'
  );

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (
    v_capstone.capstone_id,
    p_actor_id,
    case when v_is_staff_override then 'capstone_finalized_staff_override' else 'capstone_finalized' end,
    coalesce(v_reason, 'Recruiting closed; team finalized.')
  );

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    case when v_is_staff_override then 'team_finalized_staff_override' else 'team_finalized' end,
    'team',
    p_team_id::text,
    v_reason,
    jsonb_build_object(
      'capstone_id', v_capstone.capstone_id,
      'finalized_at', v_now,
      'staff_override', v_is_staff_override
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Team finalized successfully.',
    'data', to_jsonb(v_team),
    'capstone', to_jsonb(v_capstone)
  );
end;
$$;

create or replace function watmatch_complete_capstone(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_notes text default null,
  p_completed_term text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_completed_term text := nullif(btrim(coalesce(p_completed_term, '')), '');
  v_current_term text := coalesce((select current_term from marketplace_settings where setting_id = 1), watmatch_default_marketplace_term());
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_now timestamptz := now();
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  v_completed_term := coalesce(v_completed_term, v_current_term);
  if v_completed_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    raise exception 'Completion term must use Winter <year>, Spring <year>, or Fall <year>.' using errcode = '23514';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found or v_capstone.archived is true then
    raise exception 'Capstone not found or already archived.' using errcode = 'P0002';
  end if;

  if v_capstone.status = 'complete' then
    return jsonb_build_object(
      'success', true,
      'message', 'Capstone is already marked complete.',
      'data', to_jsonb(v_capstone)
    );
  end if;

  if v_notes is null then
    raise exception 'Capstone completion notes are required.' using errcode = '23514';
  end if;

  if v_capstone.status <> 'approved' or v_capstone.approval is not true then
    raise exception 'Only finalized capstones can be marked complete.' using errcode = '23514';
  end if;

  if v_capstone.closeout_decision is not null or coalesce(v_capstone.carry_over_read_only, false) is true then
    raise exception 'Resolve or clear the existing closeout decision before marking this capstone complete.' using errcode = '23514';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found or v_team.status <> 'finalized' then
    raise exception 'Only capstones linked to a finalized team can be marked complete.' using errcode = '23514';
  end if;

  if v_role = 'admin' then
    null;
  elsif v_role = 'instructor' then
    if watmatch_actor_can_manage_team(v_team.team_id, p_actor_id, v_role) is not true then
      raise exception 'Forbidden. You are not scoped to this finalized team.' using errcode = '42501';
    end if;
  else
    raise exception 'Forbidden. Instructor or admin access required.' using errcode = '42501';
  end if;

  update capstones
  set status = 'complete',
      approval = true,
      completed_at = v_now,
      completed_by_fk = p_actor_id,
      completed_term = v_completed_term,
      completion_notes = v_notes,
      updated_at = v_now
  where capstone_id = p_capstone_id
  returning * into v_capstone;

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (p_capstone_id, p_actor_id, 'capstone_completed', v_notes);

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'capstone_completed',
    'capstone',
    p_capstone_id::text,
    v_notes,
    jsonb_build_object('completed_term', v_completed_term, 'completed_at', v_now, 'team_id', v_team.team_id)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone marked complete.',
    'data', to_jsonb(v_capstone)
  );
end;
$$;

create or replace function watmatch_archive_capstone(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_capstone capstones%rowtype;
  v_actor_course bigint;
  v_now timestamptz := now();
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor') then
    raise exception 'Forbidden. Only instructors/admins can archive capstones.' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Privileged capstone archive requires an audit reason.' using errcode = '23514';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
  end if;

  if v_capstone.team_fk is not null then
    return watmatch_disband_team(v_capstone.team_fk, p_actor_id, v_role, v_reason);
  end if;

  if v_capstone.archived is true then
    return jsonb_build_object(
      'success', true,
      'message', 'Capstone is already archived.',
      'data', jsonb_build_object('capstone_id', p_capstone_id, 'team_fk', null, 'archived', true)
    );
  end if;

  if v_role = 'instructor' then
    select course_fk
      into v_actor_course
    from users
    where user_id = p_actor_id;

    if v_actor_course is null or v_capstone.course_fk is distinct from v_actor_course then
      raise exception 'Forbidden. You can only archive capstones in your course.'
        using errcode = '42501';
    end if;
  end if;

  update capstones
  set approval = false,
      status = 'archived',
      archived = true,
      archived_at = coalesce(archived_at, v_now),
      archived_reason = v_reason,
      updated_at = v_now
  where capstone_id = p_capstone_id;

  if v_capstone.team_fk is not null then
    update project_explorations
    set status = 'expired',
        decided_by_fk = p_actor_id,
        decided_at = coalesce(decided_at, v_now),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = v_now
    where team_fk = v_capstone.team_fk
      and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

    update project_commitment_requests
    set status = 'cancelled',
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        comments = coalesce(comments, 'Capstone was archived.'),
        updated_at = v_now
    where team_fk = v_capstone.team_fk
      and status = 'pending';
  end if;

  perform watmatch_cancel_pending_mentor_requests_for_capstone(
    p_capstone_id,
    null,
    p_actor_id,
    v_role,
    v_reason
  );

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (p_actor_id, v_role, 'capstone_archived', 'capstone', p_capstone_id::text, v_reason, '{}'::jsonb);

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (p_capstone_id, p_actor_id, 'capstone_archived', v_reason);

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone archived successfully.',
    'data', jsonb_build_object('capstone_id', p_capstone_id, 'team_fk', null, 'archived', true)
  );
end;
$$;

-- Final transactional capstone submission RPCs and artifact guards.
create or replace function watmatch_payload_text(p_payload jsonb, p_key text)
returns text
language plpgsql
immutable
as $$
declare
  v_text text;
begin
  v_text := nullif(btrim(coalesce(p_payload ->> p_key, '')), '');
  return v_text;
end;
$$;

create or replace function watmatch_payload_nullable_text(p_payload jsonb, p_key text)
returns text
language plpgsql
immutable
as $$
begin
  if not (p_payload ? p_key) then
    return null;
  end if;

  return nullif(btrim(coalesce(p_payload ->> p_key, '')), '');
end;
$$;

create or replace function watmatch_payload_text_array(p_payload jsonb, p_key text)
returns text[]
language plpgsql
immutable
as $$
begin
  if jsonb_typeof(p_payload -> p_key) <> 'array' then
    return '{}'::text[];
  end if;

  return coalesce(
    array(
      select elem.value
      from jsonb_array_elements_text(p_payload -> p_key) as elem(value)
      where nullif(btrim(elem.value), '') is not null
    ),
    '{}'::text[]
  );
end;
$$;

create or replace function watmatch_payload_bigint_array(p_payload jsonb, p_key text)
returns bigint[]
language plpgsql
immutable
as $$
begin
  if jsonb_typeof(p_payload -> p_key) <> 'array' then
    return '{}'::bigint[];
  end if;

  return coalesce(
    array(
      select distinct elem.value::bigint
      from jsonb_array_elements_text(p_payload -> p_key) as elem(value)
      where nullif(btrim(elem.value), '') is not null
      order by elem.value::bigint
    ),
    '{}'::bigint[]
  );
exception when invalid_text_representation then
  raise exception 'Invalid department ID.' using errcode = '22023';
end;
$$;

create or replace function watmatch_payload_bigint(p_payload jsonb, p_key text)
returns bigint
language plpgsql
immutable
as $$
declare
  v_text text;
begin
  v_text := nullif(btrim(coalesce(p_payload ->> p_key, '')), '');
  if v_text is null then
    return null;
  end if;
  return v_text::bigint;
exception when invalid_text_representation then
  raise exception 'Invalid numeric value for %.', p_key using errcode = '22023';
end;
$$;

create or replace function watmatch_payload_boolean(p_payload jsonb, p_key text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_value jsonb;
  v_text text;
begin
  if not (p_payload ? p_key) then
    return null;
  end if;

  v_value := p_payload -> p_key;
  if jsonb_typeof(v_value) = 'boolean' then
    return (v_value::text)::boolean;
  end if;

  v_text := lower(nullif(btrim(coalesce(p_payload ->> p_key, '')), ''));
  if v_text is null then
    return null;
  end if;

  if v_text in ('true', 't', '1', 'yes', 'y') then
    return true;
  end if;
  if v_text in ('false', 'f', '0', 'no', 'n') then
    return false;
  end if;

  raise exception 'Invalid boolean value for %.', p_key using errcode = '22023';
end;
$$;

create or replace function watmatch_department_names_from_ids(p_department_ids bigint[])
returns text[]
language plpgsql
stable
as $$
declare
  v_ids bigint[] := coalesce(p_department_ids, '{}'::bigint[]);
  v_names text[];
  v_count integer;
begin
  if cardinality(v_ids) = 0 then
    return '{}'::text[];
  end if;

  select coalesce(array_agg(d.name order by d.name), '{}'::text[]), count(*)::integer
    into v_names, v_count
  from departments d
  where d.department_id = any(v_ids)
    and d.active is true;

  if v_count <> cardinality(v_ids) then
    raise exception 'One or more departments are inactive or missing.' using errcode = 'P0002';
  end if;

  return v_names;
end;
$$;

create or replace function watmatch_resolve_payload_departments(p_payload jsonb)
returns text[]
language plpgsql
stable
as $$
declare
  v_department_ids bigint[] := watmatch_payload_bigint_array(p_payload, 'department_ids');
begin
  if cardinality(v_department_ids) > 0 then
    return watmatch_department_names_from_ids(v_department_ids);
  end if;

  return watmatch_payload_text_array(p_payload, 'disciplines');
end;
$$;

create or replace function watmatch_sync_capstone_departments(
  p_capstone_id bigint,
  p_department_names text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from capstone_departments
  where capstone_fk = p_capstone_id;

  insert into capstone_departments (capstone_fk, department_fk)
  select distinct p_capstone_id, d.department_id
  from departments d
  join unnest(coalesce(p_department_names, '{}'::text[])) as selected(name)
    on lower(btrim(d.name)) = lower(btrim(selected.name))
  where nullif(btrim(selected.name), '') is not null
  on conflict do nothing;
end;
$$;

create or replace function watmatch_course_labels_from_ids(p_course_ids bigint[])
returns text[]
language plpgsql
stable
as $$
declare
  v_ids bigint[] := coalesce(p_course_ids, '{}'::bigint[]);
  v_labels text[];
  v_count integer;
begin
  if cardinality(v_ids) = 0 then
    return '{}'::text[];
  end if;

  select coalesce(
           array_agg(
             c.code || ' - ' || c.name
             order by c.code, c.name
           ),
           '{}'::text[]
         ),
         count(*)::integer
    into v_labels, v_count
  from courses c
  where c.course_id = any(v_ids);

  if v_count <> cardinality(v_ids) then
    raise exception 'One or more target courses are missing.' using errcode = 'P0002';
  end if;

  return v_labels;
end;
$$;

create or replace function watmatch_partner_target_course_ids(p_opportunity_id bigint)
returns bigint[]
language sql
stable
as $$
  select coalesce(array_agg(course_fk order by course_fk), '{}'::bigint[])
  from partner_opportunity_courses
  where partner_opportunity_fk = p_opportunity_id;
$$;

create or replace function watmatch_partner_target_courses_json(p_opportunity_id bigint)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'course_id', c.course_id,
        'code', c.code,
        'name', c.name,
        'active', c.active,
        'active_terms', coalesce(to_jsonb(c.active_terms), '[]'::jsonb),
        'activation_mode', c.activation_mode,
        'department_id', c.department_fk,
        'department_fk', c.department_fk,
        'department', case
          when d.department_id is null then null
          else jsonb_build_object(
            'department_id', d.department_id,
            'name', d.name,
            'active', d.active
          )
        end,
        'routing_kind', c.routing_kind,
        'requires_project_support', c.requires_project_support,
        'active_instructor_count', (
          select count(*)::integer
          from users u
          where u.course_fk = c.course_id
            and u.active is true
            and lower(coalesce(u.role, '')) = 'instructor'
        )
      )
      order by c.code, c.name
    ),
    '[]'::jsonb
  )
  from partner_opportunity_courses poc
  join courses c on c.course_id = poc.course_fk
  left join departments d on d.department_id = c.department_fk
  where poc.partner_opportunity_fk = p_opportunity_id;
$$;

create or replace function watmatch_sync_partner_opportunity_courses(
  p_opportunity_id bigint,
  p_course_ids bigint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids bigint[];
begin
  select coalesce(array_agg(distinct id order by id), '{}'::bigint[])
    into v_ids
  from unnest(coalesce(p_course_ids, '{}'::bigint[])) as selected(id)
  where selected.id is not null;

  delete from partner_opportunity_courses
  where partner_opportunity_fk = p_opportunity_id;

  insert into partner_opportunity_courses (partner_opportunity_fk, course_fk)
  select p_opportunity_id, c.course_id
  from courses c
  where c.course_id = any(v_ids)
  on conflict do nothing;

  if cardinality(v_ids) <> (
    select count(*)::integer
    from partner_opportunity_courses
    where partner_opportunity_fk = p_opportunity_id
  ) then
    raise exception 'One or more target courses are missing.' using errcode = 'P0002';
  end if;
end;
$$;

insert into partner_opportunity_courses (partner_opportunity_fk, course_fk)
select po.partner_opportunity_id, c.course_id
from partner_opportunities po
join courses c
  on exists (
    select 1
    from unnest(coalesce(po.target_course_tags, '{}'::text[])) as tag(value)
    where lower(btrim(tag.value)) in (
      lower(btrim(c.code)),
      lower(btrim(c.code || ' - ' || c.name)),
      lower(btrim(c.code || ' - ' || c.name))
    )
  )
on conflict do nothing;

create or replace function watmatch_try_bigint(p_value text)
returns bigint
language plpgsql
immutable
as $$
declare
  v_text text := nullif(btrim(coalesce(p_value, '')), '');
begin
  if v_text is null or v_text !~ '^[0-9]+$' then
    return null;
  end if;
  return v_text::bigint;
exception when invalid_text_representation or numeric_value_out_of_range then
  return null;
end;
$$;

create or replace function watmatch_partner_opportunity_snapshot(p_opportunity partner_opportunities, p_profile partner_profiles)
returns jsonb
language plpgsql
immutable
as $$
begin
  return jsonb_build_object(
    'partner_opportunity_id', p_opportunity.partner_opportunity_id,
    'partner_user_fk', p_opportunity.partner_user_fk,
    'title', p_opportunity.title,
    'organization', p_opportunity.organization,
    'description', p_opportunity.description,
    'primary_contact', p_opportunity.primary_contact,
    'phone', p_opportunity.phone,
    'how_heard_about_capstone', p_opportunity.how_heard_about_capstone,
    'organization_description', p_opportunity.organization_description,
    'organization_size', p_opportunity.organization_size,
    'project_start_date', p_opportunity.project_start_date,
    'problem_area', p_opportunity.problem_area,
    'main_objectives', p_opportunity.main_objectives,
    'scope_of_work', p_opportunity.scope_of_work,
    'deliverable_types', coalesce(p_opportunity.deliverable_types, '{}'::text[]),
    'deliverables', p_opportunity.deliverables,
    'meeting_frequency', p_opportunity.meeting_frequency,
    'resources_needed', p_opportunity.resources_needed,
    'disciplines', coalesce(p_opportunity.disciplines, '{}'::text[]),
    'skills', coalesce(p_opportunity.skills, '{}'::text[]),
    'target_course_tags', coalesce(p_opportunity.target_course_tags, '{}'::text[]),
    'preferred_team_size', p_opportunity.preferred_team_size,
    'contact_email', p_opportunity.contact_email,
    'contact_url', p_opportunity.contact_url,
    'partner_display_name', p_profile.display_name
  );
end;
$$;

create or replace function watmatch_prepare_partner_capstone_link(
  p_payload jsonb,
  p_current_capstone_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opportunity_id bigint := watmatch_payload_bigint(p_payload, 'partner_opportunity_id');
  v_opportunity partner_opportunities%rowtype;
  v_partner_user users%rowtype;
  v_profile partner_profiles%rowtype;
  v_current capstones%rowtype;
  v_active_count integer := 0;
  v_snapshot jsonb := null;
  v_has_partner boolean;
  v_confirmed boolean;
  v_preserving_existing_link boolean := false;
begin
  v_has_partner := v_opportunity_id is not null
    or watmatch_payload_nullable_text(p_payload, 'external_partner_name') is not null
    or watmatch_payload_nullable_text(p_payload, 'external_partner_organization') is not null
    or watmatch_payload_nullable_text(p_payload, 'external_partner_email') is not null
    or watmatch_payload_nullable_text(p_payload, 'external_partner_website') is not null
    or watmatch_payload_nullable_text(p_payload, 'external_partner_notes') is not null;

  v_confirmed := lower(coalesce(p_payload ->> 'external_partner_confirmed', 'false')) in ('true', '1', 'yes');

  if v_has_partner and not v_confirmed then
    raise exception 'External partner submissions require confirmation that the partner has agreed to support the capstone.'
      using errcode = '23514';
  end if;

  if v_opportunity_id is not null then
    if p_current_capstone_id is not null then
      select *
        into v_current
      from capstones
      where capstone_id = p_current_capstone_id;

      v_preserving_existing_link := found
        and v_current.partner_opportunity_fk = v_opportunity_id;
    end if;

    select *
      into v_opportunity
    from partner_opportunities
    where partner_opportunity_id = v_opportunity_id
    for update;

    if not found then
      raise exception 'External partner opportunity not found.' using errcode = 'P0002';
    end if;

    select *
      into v_partner_user
    from users
    where user_id = v_opportunity.partner_user_fk
    for update;

    if not found
       or lower(coalesce(v_partner_user.role, '')) <> 'external_partner'
       or (v_partner_user.active is not true and not v_preserving_existing_link) then
      raise exception 'External partner opportunity is not available.' using errcode = '23514';
    end if;

    if v_opportunity.status <> 'published'
       and not v_preserving_existing_link then
      raise exception 'External partner opportunity is not published.' using errcode = '23514';
    end if;

    if v_opportunity.max_active_teams is not null and not v_preserving_existing_link then
      select count(*)
        into v_active_count
      from capstones
      where partner_opportunity_fk = v_opportunity.partner_opportunity_id
        and archived is not true
        and status not in ('archived', 'rejected')
        and (
          p_current_capstone_id is null
          or capstone_id <> p_current_capstone_id
        );

      if v_active_count >= v_opportunity.max_active_teams then
        raise exception 'This external partner opportunity has reached its active team limit.'
          using errcode = '23514';
      end if;
    end if;

    select *
      into v_profile
    from partner_profiles
    where partner_user_fk = v_opportunity.partner_user_fk;

    v_snapshot := case
      when v_preserving_existing_link
           and v_current.partner_opportunity_snapshot is not null
      then v_current.partner_opportunity_snapshot
      else watmatch_partner_opportunity_snapshot(v_opportunity, v_profile)
    end;

    return jsonb_build_object(
      'partner_opportunity_fk', v_opportunity.partner_opportunity_id,
      'partner_opportunity_snapshot', v_snapshot,
      'external_partner_name', coalesce(watmatch_payload_nullable_text(p_payload, 'external_partner_name'), v_current.external_partner_name, v_profile.display_name),
      'external_partner_organization', coalesce(watmatch_payload_nullable_text(p_payload, 'external_partner_organization'), v_current.external_partner_organization, v_opportunity.organization),
      'external_partner_email', coalesce(watmatch_payload_nullable_text(p_payload, 'external_partner_email'), v_current.external_partner_email, v_opportunity.contact_email),
      'external_partner_website', coalesce(watmatch_payload_nullable_text(p_payload, 'external_partner_website'), v_current.external_partner_website, v_opportunity.contact_url),
      'external_partner_notes', coalesce(watmatch_payload_nullable_text(p_payload, 'external_partner_notes'), v_current.external_partner_notes),
      'external_partner_support_confirmed', v_confirmed,
      'external_partner_support_confirmed_at', case when v_confirmed then now() else null end
    );
  end if;

  return jsonb_build_object(
    'partner_opportunity_fk', null,
    'partner_opportunity_snapshot', null,
    'external_partner_name', watmatch_payload_nullable_text(p_payload, 'external_partner_name'),
    'external_partner_organization', watmatch_payload_nullable_text(p_payload, 'external_partner_organization'),
    'external_partner_email', watmatch_payload_nullable_text(p_payload, 'external_partner_email'),
    'external_partner_website', watmatch_payload_nullable_text(p_payload, 'external_partner_website'),
    'external_partner_notes', watmatch_payload_nullable_text(p_payload, 'external_partner_notes'),
    'external_partner_support_confirmed', v_has_partner and v_confirmed,
    'external_partner_support_confirmed_at', case when v_has_partner and v_confirmed then now() else null end
  );
end;
$$;

create or replace function watmatch_capstone_snapshot(p_capstone capstones)
returns jsonb
language plpgsql
immutable
as $$
begin
  return jsonb_build_object(
    'title', p_capstone.title,
    'description', p_capstone.description,
    'project_start_date', p_capstone.project_start_date,
    'project_disciplines', coalesce(p_capstone.disciplines, '{}'::text[]),
    'skills_required', coalesce(p_capstone.skills, '{}'::text[]),
    'problem_area', p_capstone.problem_area,
    'main_objectives', p_capstone.main_objectives,
    'scope_of_work', p_capstone.scope_of_work,
    'deliverables', p_capstone.deliverables,
    'meeting_frequency', p_capstone.meeting_frequency,
    'uw_resources', p_capstone.uw_resources,
    'org_resources', p_capstone.org_resources,
    'other_resources', p_capstone.other_resources,
    'how_heard_about_capstone', p_capstone.how_heard_about_capstone,
    'deliverable_types', coalesce(p_capstone.deliverable_types, '{}'::text[]),
    'proposed_team_members', p_capstone.proposed_team_members,
    'success_criteria', p_capstone.success_criteria,
    'validation_plan', p_capstone.validation_plan,
    'stakeholders', p_capstone.stakeholders,
    'risks_constraints', p_capstone.risks_constraints,
    'public_evaluation_acknowledged', p_capstone.public_evaluation_acknowledged,
    'ip_acknowledged', p_capstone.ip_acknowledged,
    'confidentiality_acknowledged', p_capstone.confidentiality_acknowledged,
    'organization_name', p_capstone.organization_name,
    'primary_contact', p_capstone.primary_contact,
    'email', p_capstone.email,
    'phone', p_capstone.phone,
    'website', p_capstone.website,
    'organization_description', p_capstone.organization_description,
    'organization_size', p_capstone.organization_size,
    'sector', p_capstone.sector,
    'partner_opportunity_fk', p_capstone.partner_opportunity_fk,
    'partner_opportunity_snapshot', p_capstone.partner_opportunity_snapshot,
    'external_partner_name', p_capstone.external_partner_name,
    'external_partner_organization', p_capstone.external_partner_organization,
    'external_partner_email', p_capstone.external_partner_email,
    'external_partner_website', p_capstone.external_partner_website,
    'external_partner_notes', p_capstone.external_partner_notes,
    'external_partner_support_confirmed', p_capstone.external_partner_support_confirmed,
    'submission_track', p_capstone.submission_track,
    'requested_course_fk', p_capstone.requested_course_fk,
    'ecosystem_fk', p_capstone.ecosystem_fk
  );
end;
$$;

create or replace function watmatch_insert_capstone_from_payload(
  p_user_id bigint,
  p_course_id bigint,
  p_payload jsonb
)
returns capstones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := watmatch_payload_text(p_payload, 'title');
  v_capstone capstones%rowtype;
  v_partner jsonb := watmatch_prepare_partner_capstone_link(p_payload, null);
  v_departments text[] := watmatch_resolve_payload_departments(p_payload);
  v_submission_track text := lower(coalesce(watmatch_payload_text(p_payload, 'submission_track'), 'home_course'));
  v_requested_course_fk bigint := coalesce(watmatch_payload_bigint(p_payload, 'requested_course_id'), p_course_id);
  v_ecosystem_fk bigint;
begin
  if v_submission_track not in ('home_course', 'interdisciplinary') then
    raise exception 'Unsupported capstone submission track.' using errcode = '22023';
  end if;

  if v_title is null then
    raise exception 'Title is required and cannot be empty.' using errcode = '22023';
  end if;

  select ecosystem_fk
    into v_ecosystem_fk
  from courses
  where course_id = p_course_id;

  insert into capstones (
    user_fk,
    title,
    description,
    disciplines,
    skills,
    approval,
    status,
    course_fk,
    project_start_date,
    problem_area,
    main_objectives,
    scope_of_work,
    deliverables,
    meeting_frequency,
    uw_resources,
    org_resources,
    other_resources,
    how_heard_about_capstone,
    deliverable_types,
    proposed_team_members,
    success_criteria,
    validation_plan,
    stakeholders,
    risks_constraints,
    public_evaluation_acknowledged,
    ip_acknowledged,
    confidentiality_acknowledged,
    organization_name,
    primary_contact,
    email,
    phone,
    website,
    organization_description,
    organization_size,
    sector,
    partner_opportunity_fk,
    partner_opportunity_snapshot,
    external_partner_name,
    external_partner_organization,
    external_partner_email,
    external_partner_website,
    external_partner_notes,
    external_partner_support_confirmed,
    external_partner_support_confirmed_at,
    ecosystem_fk,
    submission_track,
    requested_course_fk
  )
  values (
    p_user_id,
    v_title,
    watmatch_payload_text(p_payload, 'description'),
    v_departments,
    watmatch_payload_text_array(p_payload, 'skills'),
    false,
    'pending_review',
    p_course_id,
    watmatch_payload_text(p_payload, 'project_start_date'),
    watmatch_payload_text(p_payload, 'problem_area'),
    watmatch_payload_text(p_payload, 'main_objectives'),
    watmatch_payload_text(p_payload, 'scope_of_work'),
    watmatch_payload_text(p_payload, 'deliverables'),
    coalesce(watmatch_payload_text(p_payload, 'meeting_frequency'), 'weekly'),
    watmatch_payload_text(p_payload, 'uw_resources'),
    watmatch_payload_text(p_payload, 'org_resources'),
    watmatch_payload_text(p_payload, 'other_resources'),
    watmatch_payload_text(p_payload, 'how_heard_about_capstone'),
    watmatch_payload_text_array(p_payload, 'deliverable_types'),
    watmatch_payload_text(p_payload, 'proposed_team_members'),
    watmatch_payload_text(p_payload, 'success_criteria'),
    watmatch_payload_text(p_payload, 'validation_plan'),
    watmatch_payload_text(p_payload, 'stakeholders'),
    watmatch_payload_text(p_payload, 'risks_constraints'),
    coalesce(watmatch_payload_boolean(p_payload, 'public_evaluation_acknowledged'), false),
    coalesce(watmatch_payload_boolean(p_payload, 'ip_acknowledged'), false),
    coalesce(watmatch_payload_boolean(p_payload, 'confidentiality_acknowledged'), false),
    watmatch_payload_text(p_payload, 'organization_name'),
    watmatch_payload_text(p_payload, 'primary_contact'),
    watmatch_payload_text(p_payload, 'email'),
    watmatch_payload_text(p_payload, 'phone'),
    watmatch_payload_text(p_payload, 'website'),
    watmatch_payload_text(p_payload, 'organization_description'),
    watmatch_payload_text(p_payload, 'organization_size'),
    watmatch_payload_text(p_payload, 'sector'),
    watmatch_payload_bigint(v_partner, 'partner_opportunity_fk'),
    v_partner -> 'partner_opportunity_snapshot',
    watmatch_payload_nullable_text(v_partner, 'external_partner_name'),
    watmatch_payload_nullable_text(v_partner, 'external_partner_organization'),
    watmatch_payload_nullable_text(v_partner, 'external_partner_email'),
    watmatch_payload_nullable_text(v_partner, 'external_partner_website'),
    watmatch_payload_nullable_text(v_partner, 'external_partner_notes'),
    coalesce((v_partner ->> 'external_partner_support_confirmed')::boolean, false),
    case
      when coalesce((v_partner ->> 'external_partner_support_confirmed')::boolean, false)
      then now()
      else null
    end,
    v_ecosystem_fk,
    v_submission_track,
    v_requested_course_fk
  )
  returning * into v_capstone;

  perform watmatch_sync_capstone_departments(v_capstone.capstone_id, v_departments);

  return v_capstone;
end;
$$;

create or replace function watmatch_update_capstone_from_payload(
  p_capstone_id bigint,
  p_payload jsonb
)
returns capstones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_partner jsonb := null;
  v_departments text[] := null;
  v_ecosystem_fk bigint := null;
begin
  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
  end if;

  select ecosystem_fk
    into v_ecosystem_fk
  from courses
  where course_id = v_capstone.course_fk;

  if p_payload ? 'department_ids' or p_payload ? 'disciplines' then
    v_departments := watmatch_resolve_payload_departments(p_payload);
  end if;

  if p_payload ? 'partner_opportunity_id'
     or p_payload ? 'external_partner_name'
     or p_payload ? 'external_partner_organization'
     or p_payload ? 'external_partner_email'
     or p_payload ? 'external_partner_website'
     or p_payload ? 'external_partner_notes' then
    v_partner := watmatch_prepare_partner_capstone_link(p_payload, p_capstone_id);
  end if;

  update capstones
  set title = coalesce(watmatch_payload_text(p_payload, 'title'), title),
      description = case when p_payload ? 'description' then watmatch_payload_nullable_text(p_payload, 'description') else description end,
      project_start_date = case when p_payload ? 'project_start_date' then watmatch_payload_nullable_text(p_payload, 'project_start_date') else project_start_date end,
      disciplines = case when v_departments is not null then v_departments else disciplines end,
      skills = case when p_payload ? 'skills' then watmatch_payload_text_array(p_payload, 'skills') else skills end,
      problem_area = case when p_payload ? 'problem_area' then watmatch_payload_nullable_text(p_payload, 'problem_area') else problem_area end,
      main_objectives = case when p_payload ? 'main_objectives' then watmatch_payload_nullable_text(p_payload, 'main_objectives') else main_objectives end,
      scope_of_work = case when p_payload ? 'scope_of_work' then watmatch_payload_nullable_text(p_payload, 'scope_of_work') else scope_of_work end,
      deliverables = case when p_payload ? 'deliverables' then watmatch_payload_nullable_text(p_payload, 'deliverables') else deliverables end,
      meeting_frequency = case when p_payload ? 'meeting_frequency' then coalesce(watmatch_payload_text(p_payload, 'meeting_frequency'), 'weekly') else meeting_frequency end,
      uw_resources = case when p_payload ? 'uw_resources' then watmatch_payload_nullable_text(p_payload, 'uw_resources') else uw_resources end,
      org_resources = case when p_payload ? 'org_resources' then watmatch_payload_nullable_text(p_payload, 'org_resources') else org_resources end,
      other_resources = case when p_payload ? 'other_resources' then watmatch_payload_nullable_text(p_payload, 'other_resources') else other_resources end,
      how_heard_about_capstone = case when p_payload ? 'how_heard_about_capstone' then watmatch_payload_nullable_text(p_payload, 'how_heard_about_capstone') else how_heard_about_capstone end,
      deliverable_types = case when p_payload ? 'deliverable_types' then watmatch_payload_text_array(p_payload, 'deliverable_types') else deliverable_types end,
      proposed_team_members = case when p_payload ? 'proposed_team_members' then watmatch_payload_nullable_text(p_payload, 'proposed_team_members') else proposed_team_members end,
      success_criteria = case when p_payload ? 'success_criteria' then watmatch_payload_nullable_text(p_payload, 'success_criteria') else success_criteria end,
      validation_plan = case when p_payload ? 'validation_plan' then watmatch_payload_nullable_text(p_payload, 'validation_plan') else validation_plan end,
      stakeholders = case when p_payload ? 'stakeholders' then watmatch_payload_nullable_text(p_payload, 'stakeholders') else stakeholders end,
      risks_constraints = case when p_payload ? 'risks_constraints' then watmatch_payload_nullable_text(p_payload, 'risks_constraints') else risks_constraints end,
      public_evaluation_acknowledged = case when p_payload ? 'public_evaluation_acknowledged' then coalesce(watmatch_payload_boolean(p_payload, 'public_evaluation_acknowledged'), false) else public_evaluation_acknowledged end,
      ip_acknowledged = case when p_payload ? 'ip_acknowledged' then coalesce(watmatch_payload_boolean(p_payload, 'ip_acknowledged'), false) else ip_acknowledged end,
      confidentiality_acknowledged = case when p_payload ? 'confidentiality_acknowledged' then coalesce(watmatch_payload_boolean(p_payload, 'confidentiality_acknowledged'), false) else confidentiality_acknowledged end,
      ecosystem_fk = coalesce(v_ecosystem_fk, ecosystem_fk),
      organization_name = case when p_payload ? 'organization_name' then watmatch_payload_nullable_text(p_payload, 'organization_name') else organization_name end,
      primary_contact = case when p_payload ? 'primary_contact' then watmatch_payload_nullable_text(p_payload, 'primary_contact') else primary_contact end,
      email = case when p_payload ? 'email' then watmatch_payload_nullable_text(p_payload, 'email') else email end,
      phone = case when p_payload ? 'phone' then watmatch_payload_nullable_text(p_payload, 'phone') else phone end,
      website = case when p_payload ? 'website' then watmatch_payload_nullable_text(p_payload, 'website') else website end,
      organization_description = case when p_payload ? 'organization_description' then watmatch_payload_nullable_text(p_payload, 'organization_description') else organization_description end,
      organization_size = case when p_payload ? 'organization_size' then watmatch_payload_nullable_text(p_payload, 'organization_size') else organization_size end,
      sector = case when p_payload ? 'sector' then watmatch_payload_nullable_text(p_payload, 'sector') else sector end,
      partner_opportunity_fk = case when v_partner is not null then watmatch_payload_bigint(v_partner, 'partner_opportunity_fk') else partner_opportunity_fk end,
      partner_opportunity_snapshot = case when v_partner is not null then v_partner -> 'partner_opportunity_snapshot' else partner_opportunity_snapshot end,
      external_partner_name = case when v_partner is not null then watmatch_payload_nullable_text(v_partner, 'external_partner_name') else external_partner_name end,
      external_partner_organization = case when v_partner is not null then watmatch_payload_nullable_text(v_partner, 'external_partner_organization') else external_partner_organization end,
      external_partner_email = case when v_partner is not null then watmatch_payload_nullable_text(v_partner, 'external_partner_email') else external_partner_email end,
      external_partner_website = case when v_partner is not null then watmatch_payload_nullable_text(v_partner, 'external_partner_website') else external_partner_website end,
      external_partner_notes = case when v_partner is not null then watmatch_payload_nullable_text(v_partner, 'external_partner_notes') else external_partner_notes end,
      external_partner_support_confirmed = case
        when v_partner is not null then coalesce((v_partner ->> 'external_partner_support_confirmed')::boolean, false)
        else false
      end,
      external_partner_support_confirmed_at = case
        when v_partner is not null and coalesce((v_partner ->> 'external_partner_support_confirmed')::boolean, false) then now()
        when v_partner is not null then null
        else null
      end,
      approval = false,
      status = 'pending_review',
      updated_at = now()
  where capstone_id = p_capstone_id
  returning * into v_capstone;

  if v_departments is not null then
    perform watmatch_sync_capstone_departments(v_capstone.capstone_id, v_departments);
  end if;

  if v_capstone.team_fk is not null then
    update teams
    set ecosystem_fk = coalesce(v_capstone.ecosystem_fk, ecosystem_fk)
    where team_id = v_capstone.team_fk;
  end if;

  return v_capstone;
end;
$$;

create or replace function watmatch_create_capstone_with_new_team(
  p_user_id bigint,
  p_course_id bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_effective_course bigint;
  v_requested_course courses%rowtype;
  v_submission_track text := lower(coalesce(watmatch_payload_text(p_payload, 'submission_track'), 'home_course'));
  v_active_submission_track text := 'home_course';
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_admin_finalization_override boolean := coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override')::boolean, false);
  v_admin_finalization_override_approved boolean := coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override_approved')::boolean, false);
  v_admin_override_actor_id bigint := nullif(coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override_actor_id'), ''), '')::bigint;
  v_admin_override_reason text := nullif(btrim(coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override_reason'), '')), '');
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_phase text := watmatch_current_marketplace_phase();
begin
  if p_user_id is null then
    raise exception 'Invalid user ID.' using errcode = '28000';
  end if;

  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User with ID % not found.', p_user_id using errcode = 'P0002';
  end if;

  if lower(coalesce(v_user.role, '')) <> 'student'
     or v_user.active is not true then
    raise exception 'Only active students can create capstones.' using errcode = '42501';
  end if;

  if v_admin_finalization_override is true
     and (v_admin_override_actor_id is null or v_admin_override_reason is null) then
    raise exception 'Admin finalization override requires an admin actor and audit reason.'
      using errcode = '23514';
  end if;

  if exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'You are already part of a team. Submit your capstone through your existing team.'
      using errcode = '23514';
  end if;

  if v_submission_track not in ('home_course', 'interdisciplinary') then
    raise exception 'Unsupported capstone submission track.' using errcode = '22023';
  end if;

  if v_admin_finalization_override is true then
    if p_course_id is null then
      raise exception 'Choose a staffed active course for the finalization exception proposal.' using errcode = '22023';
    end if;

    v_requested_course := watmatch_assert_course_ready_for_review(
      p_course_id,
      'Selected override course'
    );
    v_effective_course := v_requested_course.course_id;
    v_active_submission_track := case
      when v_requested_course.routing_kind = 'interdisciplinary' then 'interdisciplinary'
      else 'home_course'
    end;

    v_phase := watmatch_effective_marketplace_phase_for_course(v_effective_course);
    if v_phase <> 'finalization' then
      raise exception 'Finalization exception proposals can only be created for a course or ecosystem currently in finalization.'
        using errcode = '23514';
    end if;

    if v_admin_finalization_override_approved is not true then
      return watmatch_queue_finalization_exception_proposal(
        p_user_id,
        v_requested_course.course_id,
        v_admin_override_actor_id,
        v_admin_override_reason,
        v_payload,
        null
      );
    end if;

    update users
    set course_fk = v_effective_course,
        updated_at = now()
    where user_id = p_user_id
    returning * into v_user;
  else
    v_effective_course := v_user.course_fk;
    if v_effective_course is null then
      raise exception 'Your account must be assigned to a course before submitting a capstone.' using errcode = '23514';
    end if;

    select case
        when c.routing_kind = 'interdisciplinary' then 'interdisciplinary'
        else 'home_course'
      end
      into v_active_submission_track
    from courses c
    where c.course_id = v_user.course_fk;

    if v_submission_track = 'home_course' then
      if p_course_id is not null and p_course_id <> v_effective_course then
        raise exception 'Submitted course does not match your assigned course.' using errcode = '23514';
      end if;
    else
      if p_course_id is null then
        raise exception 'Choose an interdisciplinary course before submitting.' using errcode = '22023';
      end if;

      v_requested_course := watmatch_assert_course_ready_for_review(
        p_course_id,
        'Selected interdisciplinary course'
      );

      if v_requested_course.routing_kind <> 'interdisciplinary' then
        raise exception 'Selected course is not an active interdisciplinary course.' using errcode = '23514';
      end if;

      v_effective_course := v_requested_course.course_id;
      v_active_submission_track := 'interdisciplinary';
    end if;

    if v_submission_track = 'home_course' then
      v_requested_course := watmatch_assert_course_ready_for_review(
        v_effective_course,
        'Your assigned course'
      );
    end if;

    v_phase := watmatch_effective_marketplace_phase_for_course(v_effective_course);
    if v_phase = 'finalization' then
      raise exception 'Project submission is closed during finalization. Contact an admin if this is an exception.'
        using errcode = '23514';
    end if;
  end if;

  v_payload := jsonb_set(v_payload, '{submission_track}', to_jsonb(coalesce(v_active_submission_track, 'home_course')), true);
  v_payload := jsonb_set(v_payload, '{requested_course_id}', to_jsonb(v_effective_course), true);

  v_capstone := watmatch_insert_capstone_from_payload(p_user_id, v_effective_course, v_payload);

  insert into teams (leader_fk, capstone_fk, course_fk, status)
  values (null, null, v_effective_course, 'forming')
  returning * into v_team;

  perform watmatch_claim_team_membership(v_team.team_id, p_user_id, true);

  update teams
  set leader_fk = p_user_id
  where team_id = v_team.team_id
  returning * into v_team;

  update capstones
  set team_fk = v_team.team_id,
      updated_at = now()
  where capstone_id = v_capstone.capstone_id
  returning * into v_capstone;

  update teams
  set capstone_fk = v_capstone.capstone_id,
      ecosystem_fk = coalesce(v_capstone.ecosystem_fk, ecosystem_fk)
  where team_id = v_team.team_id
  returning * into v_team;

  v_capstone := watmatch_route_capstone_status(v_capstone.capstone_id, v_team.team_id, p_user_id, false);

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (v_capstone.capstone_id, p_user_id, 'initial_submission', watmatch_capstone_snapshot(v_capstone)::text);

  if v_admin_finalization_override is true then
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      v_admin_override_actor_id,
      'admin',
      'capstone_finalization_exception_created',
      'capstone',
      v_capstone.capstone_id::text,
      v_admin_override_reason,
      jsonb_build_object(
        'student_id', p_user_id,
        'team_id', v_team.team_id,
        'course_id', v_effective_course,
        'submission_track', v_active_submission_track
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone project and team created successfully',
    'data', jsonb_build_object('capstone', to_jsonb(v_capstone), 'team', to_jsonb(v_team))
  );
end;
$$;

create or replace function watmatch_create_capstone_for_existing_team(
  p_user_id bigint,
  p_team_id bigint,
  p_course_id bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_team teams%rowtype;
  v_effective_course bigint;
  v_requested_course courses%rowtype;
  v_submission_track text := lower(coalesce(watmatch_payload_text(p_payload, 'submission_track'), 'home_course'));
  v_active_submission_track text := 'home_course';
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_admin_finalization_override boolean := coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override')::boolean, false);
  v_admin_finalization_override_approved boolean := coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override_approved')::boolean, false);
  v_admin_override_actor_id bigint := nullif(coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override_actor_id'), ''), '')::bigint;
  v_admin_override_reason text := nullif(btrim(coalesce((coalesce(p_payload, '{}'::jsonb) ->> 'admin_finalization_override_reason'), '')), '');
  v_capstone capstones%rowtype;
  v_phase text := watmatch_current_marketplace_phase();
begin
  if p_user_id is null or p_team_id is null then
    raise exception 'Invalid capstone submission request.' using errcode = '22023';
  end if;

  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User with ID % not found.', p_user_id using errcode = 'P0002';
  end if;

  if lower(coalesce(v_user.role, '')) <> 'student'
     or v_user.active is not true then
    raise exception 'Only active students can create capstones.' using errcode = '42501';
  end if;

  if v_admin_finalization_override is true
     and (v_admin_override_actor_id is null or v_admin_override_reason is null) then
    raise exception 'Admin finalization override requires an admin actor and audit reason.'
      using errcode = '23514';
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.leader_fk is distinct from p_user_id then
    raise exception 'Only the team leader can submit a capstone on behalf of the team.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from team_memberships
    where team_fk = p_team_id
      and user_fk = p_user_id
  ) then
    raise exception 'Only a member of this team can submit a capstone for it.'
      using errcode = '42501';
  end if;

  if v_team.capstone_fk is not null then
    raise exception 'This team already has a capstone idea. Only one capstone per team is allowed.'
      using errcode = '23514';
  end if;

  if v_submission_track not in ('home_course', 'interdisciplinary') then
    raise exception 'Unsupported capstone submission track.' using errcode = '22023';
  end if;

  if v_admin_finalization_override is true then
    if p_course_id is null then
      raise exception 'Choose a staffed active course for the finalization exception proposal.' using errcode = '22023';
    end if;

    v_requested_course := watmatch_assert_course_ready_for_review(
      p_course_id,
      'Selected override course'
    );
    v_effective_course := v_requested_course.course_id;
    v_active_submission_track := case
      when v_requested_course.routing_kind = 'interdisciplinary' then 'interdisciplinary'
      else 'home_course'
    end;

    v_phase := watmatch_effective_marketplace_phase_for_course(v_effective_course);
    if v_phase <> 'finalization' then
      raise exception 'Finalization exception proposals can only be created for a course or ecosystem currently in finalization.'
        using errcode = '23514';
    end if;

    if v_admin_finalization_override_approved is not true then
      v_payload := jsonb_set(v_payload, '{team_id}', to_jsonb(p_team_id), true);
      return watmatch_queue_finalization_exception_proposal(
        p_user_id,
        v_requested_course.course_id,
        v_admin_override_actor_id,
        v_admin_override_reason,
        v_payload,
        p_team_id
      );
    end if;

    update users
    set course_fk = v_effective_course,
        updated_at = now()
    where user_id in (
      select tm.user_fk
      from team_memberships tm
      where tm.team_fk = p_team_id
    );

    select *
      into v_user
    from users
    where user_id = p_user_id;
  else
    v_effective_course := v_user.course_fk;
    if v_effective_course is null then
      raise exception 'Your account must be assigned to a course before submitting a capstone.' using errcode = '23514';
    end if;

    select case
        when c.routing_kind = 'interdisciplinary' then 'interdisciplinary'
        else 'home_course'
      end
      into v_active_submission_track
    from courses c
    where c.course_id = v_user.course_fk;

    if v_submission_track = 'home_course' then
      if p_course_id is not null and p_course_id <> v_effective_course then
        raise exception 'Submitted course does not match your assigned course.' using errcode = '23514';
      end if;
    else
      if p_course_id is null then
        raise exception 'Choose an interdisciplinary course before submitting.' using errcode = '22023';
      end if;

      v_requested_course := watmatch_assert_course_ready_for_review(
        p_course_id,
        'Selected interdisciplinary course'
      );

      if v_requested_course.routing_kind <> 'interdisciplinary' then
        raise exception 'Selected course is not an active interdisciplinary course.' using errcode = '23514';
      end if;

      v_effective_course := v_requested_course.course_id;
      v_active_submission_track := 'interdisciplinary';
    end if;

    if v_submission_track = 'home_course' then
      v_requested_course := watmatch_assert_course_ready_for_review(
        v_effective_course,
        'Your assigned course'
      );
    end if;

    v_phase := watmatch_effective_marketplace_phase_for_course(v_effective_course);
    if v_phase = 'finalization' then
      raise exception 'Project submission is closed during finalization. Contact an admin if this is an exception.'
        using errcode = '23514';
    end if;
  end if;

  v_payload := jsonb_set(v_payload, '{submission_track}', to_jsonb(coalesce(v_active_submission_track, 'home_course')), true);
  v_payload := jsonb_set(v_payload, '{requested_course_id}', to_jsonb(v_effective_course), true);

  v_capstone := watmatch_insert_capstone_from_payload(p_user_id, v_effective_course, v_payload);

  update teams
  set capstone_fk = v_capstone.capstone_id,
      ecosystem_fk = coalesce(v_capstone.ecosystem_fk, ecosystem_fk)
  where team_id = p_team_id
    and capstone_fk is null
  returning * into v_team;

  if not found then
    raise exception 'This team already has a capstone idea. Only one capstone per team is allowed.'
      using errcode = '23514';
  end if;

  if v_team.course_fk is distinct from v_effective_course then
    update teams
    set course_fk = v_effective_course,
        ecosystem_fk = coalesce(v_capstone.ecosystem_fk, ecosystem_fk)
    where team_id = p_team_id
    returning * into v_team;
  elsif v_team.ecosystem_fk is distinct from v_capstone.ecosystem_fk then
    update teams
    set ecosystem_fk = coalesce(v_capstone.ecosystem_fk, ecosystem_fk)
    where team_id = p_team_id
    returning * into v_team;
  end if;

  update capstones
  set team_fk = p_team_id,
      updated_at = now()
  where capstone_id = v_capstone.capstone_id
  returning * into v_capstone;

  v_capstone := watmatch_route_capstone_status(v_capstone.capstone_id, p_team_id, p_user_id, false);

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (v_capstone.capstone_id, p_user_id, 'initial_submission', watmatch_capstone_snapshot(v_capstone)::text);

  if v_admin_finalization_override is true then
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      v_admin_override_actor_id,
      'admin',
      'capstone_finalization_exception_created',
      'capstone',
      v_capstone.capstone_id::text,
      v_admin_override_reason,
      jsonb_build_object(
        'student_id', p_user_id,
        'team_id', v_team.team_id,
        'course_id', v_effective_course,
        'submission_track', v_active_submission_track
      )
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone created and linked to existing team successfully',
    'data', jsonb_build_object('capstone', to_jsonb(v_capstone), 'team', to_jsonb(v_team))
  );
end;
$$;

create or replace function watmatch_resubmit_capstone(
  p_capstone_id bigint,
  p_student_id bigint,
  p_payload jsonb,
  p_change_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary text := nullif(btrim(coalesce(p_change_summary, '')), '');
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_phase text := watmatch_current_marketplace_phase();
begin
  if p_capstone_id is null or p_student_id is null then
    raise exception 'Invalid resubmission request.' using errcode = '22023';
  end if;

  if v_summary is null then
    raise exception 'change_summary is required' using errcode = '22023';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
  end if;

  if v_capstone.team_fk is not null then
    select *
      into v_team
    from teams
    where team_id = v_capstone.team_fk
    for update;

    if not found then
      raise exception 'Linked team not found.' using errcode = 'P0002';
    end if;

    if v_team.leader_fk is distinct from p_student_id then
      raise exception 'Only the current team leader can resubmit this project'
        using errcode = '42501';
    end if;
  elsif v_capstone.user_fk is distinct from p_student_id then
    raise exception 'Only the current team leader can resubmit this project'
      using errcode = '42501';
  end if;

  if v_capstone.archived is true
     or v_capstone.status in ('approved', 'archived')
     or v_capstone.status not in ('draft', 'rejected', 'changes_requested') then
    raise exception 'This capstone cannot be resubmitted in its current state.'
      using errcode = '23514';
  end if;

  v_phase := watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id);
  if v_phase = 'finalization' then
    raise exception 'Project resubmission is closed during finalization. Contact an admin if this is an exception.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from users u
    where u.user_id = p_student_id
      and u.active is true
      and u.course_fk is not null
  ) then
    raise exception 'Your account must be active and assigned to a course before resubmitting.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from approvals
    where capstone_fk = p_capstone_id
      and action = 'initial_submission'
  ) then
    insert into approvals (capstone_fk, instructor_fk, action, comments)
    values (p_capstone_id, p_student_id, 'initial_submission', watmatch_capstone_snapshot(v_capstone)::text);
  end if;

  v_capstone := watmatch_update_capstone_from_payload(p_capstone_id, p_payload);

  if v_capstone.team_fk is not null then
    v_capstone := watmatch_route_capstone_status(v_capstone.capstone_id, v_capstone.team_fk, p_student_id, false);
  end if;

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (p_capstone_id, p_student_id, 'student_resubmitted', v_summary);

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone resubmitted for instructor review',
    'data', to_jsonb(v_capstone)
  );
end;
$$;

create or replace function watmatch_withdraw_capstone_review(
  p_capstone_id bigint,
  p_student_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_now timestamptz := now();
begin
  if p_capstone_id is null or p_student_id is null then
    raise exception 'Invalid withdrawal request.' using errcode = '22023';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
  end if;

  if v_capstone.archived is true or v_capstone.status = 'archived' then
    raise exception 'Archived capstones cannot be reopened for edits.' using errcode = '23514';
  end if;

  if v_capstone.team_fk is not null then
    select *
      into v_team
    from teams
    where team_id = v_capstone.team_fk
    for update;

    if not found then
      raise exception 'Linked team not found.' using errcode = 'P0002';
    end if;

    if v_team.status in ('archived', 'finalized') then
      raise exception 'This team is no longer editable.' using errcode = '23514';
    end if;

    if v_team.leader_fk is distinct from p_student_id then
      raise exception 'Only the current team leader can reopen this project for edits.'
        using errcode = '42501';
    end if;
  elsif v_capstone.user_fk is distinct from p_student_id then
    raise exception 'Only the current team leader can reopen this project for edits.'
      using errcode = '42501';
  end if;

  if v_capstone.status = 'draft' then
    return jsonb_build_object(
      'success', true,
      'message', 'Capstone is already editable.',
      'data', to_jsonb(v_capstone)
    );
  end if;

  if v_capstone.status not in ('approved_recruiting', 'pending_review', 'pending_admin_course_routing') then
    raise exception 'Only capstones in review or accepting-interest states can be reopened for edits.'
      using errcode = '23514';
  end if;

  update capstones
  set approval = false,
      status = 'draft',
      updated_at = v_now
  where capstone_id = p_capstone_id
  returning * into v_capstone;

  delete from capstone_course_approvals
  where capstone_fk = p_capstone_id;

  update course_reassignment_requests
  set status = 'cancelled',
      decided_by_fk = p_student_id,
      decided_at = v_now,
      comments = 'Capstone review was withdrawn.',
      updated_at = v_now
  where capstone_fk = p_capstone_id
    and status = 'pending';

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (
    p_capstone_id,
    p_student_id,
    'review_withdrawn',
    'Team leader reopened the capstone for edits.'
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone reopened for edits.',
    'data', to_jsonb(v_capstone)
  );
end;
$$;

create or replace function watmatch_assert_admin_actor(p_actor_id bigint)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  select *
    into v_actor
  from users
  where user_id = p_actor_id;

  if not found or lower(coalesce(v_actor.role, '')) <> 'admin' then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

drop function if exists watmatch_admin_create_student(text, bigint, bigint, text);
drop function if exists watmatch_admin_set_student_course(bigint, bigint, bigint, text);
drop function if exists watmatch_admin_create_user(text, text, bigint, bigint, text);
drop function if exists watmatch_admin_create_user(text, text, bigint, bigint, boolean, text);
drop function if exists watmatch_admin_update_user(bigint, text, text, bigint, boolean, bigint, text);
drop function if exists watmatch_validate_admin_managed_user(text, text, bigint);

create or replace function watmatch_validate_admin_managed_user(
  p_email text,
  p_role text,
  p_course_id bigint,
  p_home_department_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role text := lower(btrim(coalesce(p_role, '')));
  v_course courses%rowtype;
  v_department departments%rowtype;
begin
  if v_email = '' then
    raise exception 'Email is required.' using errcode = '22023';
  end if;

  if v_role not in ('student', 'instructor', 'admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then
    raise exception 'Role must be student, instructor, admin, academic_advisor, enrollment_operator, external_partner, or mentor.' using errcode = '23514';
  end if;

  if v_role <> 'external_partner' and v_email !~ '^[^@[:space:]]+@uwaterloo[.]ca$' then
    raise exception 'Email must be a valid @uwaterloo.ca address.' using errcode = '23514';
  end if;

  if v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') and p_course_id is not null then
    raise exception 'Admin, academic advisor, enrollment operator, external partner, and mentor users cannot be enrolled in a course.' using errcode = '23514';
  end if;

  if v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') and p_home_department_id is not null then
    raise exception 'Admin, academic advisor, enrollment operator, external partner, and mentor users cannot be assigned a home department.' using errcode = '23514';
  end if;

  if v_role in ('student', 'instructor') and p_home_department_id is null then
    raise exception 'Home department is required for students and instructors.' using errcode = '23514';
  end if;

  if v_role in ('student', 'instructor') and p_course_id is not null then
    select *
      into v_course
    from courses
    where course_id = p_course_id;

    if not found then
      raise exception 'Course not found.' using errcode = 'P0002';
    end if;

  end if;

  if v_role in ('student', 'instructor') then
    select *
      into v_department
    from departments
    where department_id = p_home_department_id;

    if not found then
      raise exception 'Home department not found.' using errcode = 'P0002';
    end if;

    if v_department.active is not true then
      raise exception 'Home department is inactive.' using errcode = '23514';
    end if;
  end if;

  return jsonb_build_object('email', v_email, 'role', v_role);
end;
$$;

create or replace function watmatch_admin_create_user(
  p_email text,
  p_role text,
  p_course_id bigint,
  p_home_department_id bigint,
  p_actor_id bigint,
  p_active boolean default true,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_validated jsonb;
  v_email text;
  v_role text;
  v_existing users%rowtype;
  v_user users%rowtype;
  v_active boolean := coalesce(p_active, false);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);
  v_validated := watmatch_validate_admin_managed_user(p_email, p_role, p_course_id, p_home_department_id);
  v_email := v_validated ->> 'email';
  v_role := v_validated ->> 'role';

  if v_reason is null then
    raise exception 'Admin user creation requires an audit reason.' using errcode = '23514';
  end if;

  select *
    into v_existing
  from users
  where email = v_email
  for update;

  if found then
    if lower(coalesce(v_existing.role, '')) <> v_role then
      raise exception 'A user with this email already exists with a different role.' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'success', true,
      'message', 'User already exists.',
      'data', to_jsonb(v_existing),
      'already_existed', true
    );
  end if;

  insert into users (email, role, course_fk, home_department_fk, active)
  values (
    v_email,
    v_role,
    case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_course_id end,
    case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_home_department_id end,
    v_active
  )
  returning * into v_user;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'user_created',
    'user',
    v_user.user_id::text,
    v_reason,
    jsonb_build_object(
      'email', v_email,
      'role', v_role,
      'course_fk', v_user.course_fk,
      'home_department_fk', v_user.home_department_fk,
      'active', v_user.active
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'User created.',
    'data', to_jsonb(v_user),
    'already_existed', false
  );
end;
$$;

create or replace function watmatch_admin_set_user_course(
  p_user_id bigint,
  p_course_id bigint,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_user users%rowtype;
  v_course courses%rowtype;
  v_role text;
  v_old_course_fk bigint;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Admin user course changes require an audit reason.' using errcode = '23514';
  end if;

  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;

  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  v_role := lower(coalesce(v_user.role, ''));
  if v_role not in ('student', 'instructor') then
    raise exception 'Only students and instructors can be assigned to courses.' using errcode = '23514';
  end if;

  if p_course_id is not null then
    select *
      into v_course
    from courses
    where course_id = p_course_id;

    if not found then
      raise exception 'Course not found.' using errcode = 'P0002';
    end if;

  end if;

  if v_user.course_fk is not distinct from p_course_id then
    if v_role = 'student' and p_course_id is not null then
      perform watmatch_cancel_pending_submission_enrollment_requests(
        p_user_id,
        v_actor.user_id,
        v_actor.role,
        'Student already has this course assignment.'
      );

      perform watmatch_reconcile_marketplace_commitments_after_course_assignment(
        p_user_id,
        v_actor.user_id,
        v_actor.role,
        'Student already has this course assignment.'
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'message', 'User course assignment is already up to date.',
      'data', to_jsonb(v_user)
    );
  end if;

  if v_role = 'student'
     and exists (select 1 from team_memberships tm where tm.user_fk = p_user_id) then
    raise exception 'Cannot change course assignment while the student is in an active team.'
      using errcode = '23514';
  end if;

  v_old_course_fk := v_user.course_fk;

  perform watmatch_assert_instructor_can_leave_course(
    p_user_id,
    p_course_id,
    v_role,
    v_user.active
  );

  update users
  set course_fk = p_course_id
  where user_id = p_user_id
  returning * into v_user;

  if v_role = 'student' and p_course_id is not null then
    perform watmatch_cancel_pending_submission_enrollment_requests(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student was manually assigned to a course.'
    );

    perform watmatch_reconcile_marketplace_commitments_after_course_assignment(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student was manually assigned to a course.'
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    case when p_course_id is null then 'user_course_cleared' else 'user_course_assigned' end,
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object('old_course_fk', v_old_course_fk, 'new_course_fk', p_course_id, 'role', v_role)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_course_id is null then 'User course assignment cleared.' else 'User assigned to course.' end,
    'data', to_jsonb(v_user)
  );
end;
$$;

create or replace function watmatch_admin_set_user_active(
  p_user_id bigint,
  p_active boolean,
  p_actor_id bigint,
  p_force boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_user users%rowtype;
  v_role text;
  v_active boolean := coalesce(p_active, true);
  v_active_admin_count integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_archived_partner_opportunity_ids bigint[] := '{}'::bigint[];
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Admin user active-status changes require an audit reason.' using errcode = '23514';
  end if;

  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;

  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if v_user.user_id = v_actor.user_id and v_active is false then
    raise exception 'Admins cannot deactivate their own account.' using errcode = '23514';
  end if;

  v_role := lower(coalesce(v_user.role, ''));
  if v_role = 'admin' and v_active is false then
    select count(*)
      into v_active_admin_count
    from users
    where lower(coalesce(role, '')) = 'admin'
      and active is true
      and user_id <> p_user_id;

    if v_active_admin_count = 0 then
      raise exception 'Cannot deactivate the last active admin.' using errcode = '23514';
    end if;
  end if;

  if v_role = 'student'
     and v_active is false
     and exists (select 1 from team_memberships tm where tm.user_fk = p_user_id) then
    raise exception 'Cannot deactivate a student while they are in an active team.'
      using errcode = '23514';
  end if;

  if v_role = 'external_partner' and v_active is false then
    select coalesce(array_agg(partner_opportunity_id order by partner_opportunity_id), '{}'::bigint[])
      into v_archived_partner_opportunity_ids
    from partner_opportunities
    where partner_user_fk = p_user_id
      and status <> 'archived';

    update partner_opportunities
    set status = 'archived',
        archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where partner_user_fk = p_user_id
      and status <> 'archived';
  end if;

  if v_role = 'mentor' and v_active is false then
    update mentor_requests
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    where mentor_fk = p_user_id
      and status = 'pending';

    update mentor_requests mr
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    from capstones c
    left join teams t on t.team_id = c.team_fk
    where mr.mentor_fk = p_user_id
      and mr.capstone_fk = c.capstone_id
      and mr.status = 'accepted'
      and coalesce(t.status, '') <> 'finalized';
  end if;

  perform watmatch_assert_instructor_can_leave_course(
    p_user_id,
    v_user.course_fk,
    v_role,
    v_active
  );

  if v_user.active is not distinct from v_active then
    if v_role = 'student' and v_active is false then
      perform watmatch_cancel_pending_submission_enrollment_requests(
        p_user_id,
        v_actor.user_id,
        v_actor.role,
        'Student account is inactive.'
      );

      perform watmatch_cleanup_marketplace_for_unavailable_student(
        p_user_id,
        v_actor.user_id,
        v_actor.role,
        'Student account is inactive.'
      );
    end if;

    if coalesce(array_length(v_archived_partner_opportunity_ids, 1), 0) > 0 then
      insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
      values (
        v_actor.user_id,
        v_actor.role,
        'external_partner_opportunities_archived',
        'user',
        p_user_id::text,
        v_reason,
        jsonb_build_object('archived_partner_opportunity_ids', v_archived_partner_opportunity_ids)
      );
    end if;

    return jsonb_build_object(
      'success', true,
      'message', 'User active status is already up to date.',
      'data', to_jsonb(v_user),
      'archived_partner_opportunity_ids', v_archived_partner_opportunity_ids
    );
  end if;

  update users
  set active = v_active,
      refresh_token = case when v_active is false then null else refresh_token end
  where user_id = p_user_id
  returning * into v_user;

  if v_role = 'student' and v_active is false then
    perform watmatch_cancel_pending_submission_enrollment_requests(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student account was deactivated.'
    );

    perform watmatch_cleanup_marketplace_for_unavailable_student(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student account was deactivated.'
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    case when v_active is true then 'user_activated' else 'user_deactivated' end,
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'role', v_role,
      'forced', coalesce(p_force, false),
      'archived_partner_opportunity_ids', v_archived_partner_opportunity_ids
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', case when v_active is true then 'User activated.' else 'User deactivated.' end,
    'data', to_jsonb(v_user)
  );
end;
$$;

create or replace function watmatch_admin_update_user(
  p_user_id bigint,
  p_email text,
  p_role text,
  p_course_id bigint,
  p_home_department_id bigint,
  p_active boolean,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_user users%rowtype;
  v_old_user users%rowtype;
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
  v_active boolean := coalesce(p_active, true);
  v_active_admin_count integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old_role text;
  v_archived_partner_opportunity_ids bigint[] := '{}'::bigint[];
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Admin user updates require an audit reason.' using errcode = '23514';
  end if;

  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;
  if v_email is null then
    raise exception 'User email is required.' using errcode = '22023';
  end if;
  if v_role not in ('student', 'instructor', 'admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then
    raise exception 'Role must be student, instructor, admin, academic_advisor, enrollment_operator, external_partner, or mentor.' using errcode = '23514';
  end if;
  if v_role <> 'external_partner' and v_email !~ '^[^@[:space:]]+@uwaterloo[.]ca$' then
    raise exception 'Email must be a uwaterloo.ca address.' using errcode = '23514';
  end if;
  if v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') and p_course_id is not null then
    raise exception 'Admin, academic advisor, enrollment operator, external partner, and mentor users cannot be enrolled in a course.' using errcode = '23514';
  end if;
  if v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') and p_home_department_id is not null then
    raise exception 'Admin, academic advisor, enrollment operator, external partner, and mentor users cannot be assigned a home department.' using errcode = '23514';
  end if;
  if v_role in ('student', 'instructor') and p_home_department_id is null then
    raise exception 'Home department is required for students and instructors.' using errcode = '23514';
  end if;
  if v_role in ('student', 'instructor')
     and p_course_id is not null
     and not exists (select 1 from courses where course_id = p_course_id) then
    raise exception 'Cannot assign a missing course.' using errcode = '23514';
  end if;
  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  v_old_user := v_user;
  v_old_role := lower(coalesce(v_user.role, ''));

  if v_role in ('student', 'instructor') then
    if not exists (
      select 1
      from departments
      where department_id = p_home_department_id
    ) then
      raise exception 'Cannot assign a missing home department.' using errcode = '23514';
    end if;

    if exists (
      select 1
      from departments
      where department_id = p_home_department_id
        and active is not true
    )
       and not (
         v_old_role in ('student', 'instructor')
         and v_user.home_department_fk is not distinct from p_home_department_id
       ) then
      raise exception 'Cannot assign an inactive home department.' using errcode = '23514';
    end if;
  end if;

  if v_user.user_id = v_actor.user_id and v_active is false then
    raise exception 'Admins cannot deactivate their own account.' using errcode = '23514';
  end if;

  if v_role <> v_old_role
     and exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'Cannot change role while the user is in an active team.' using errcode = '23514';
  end if;

  if v_role <> v_old_role
     and (v_role = 'external_partner' or v_old_role = 'external_partner')
     and (
       exists (select 1 from partner_profiles where partner_user_fk = p_user_id)
       or exists (select 1 from partner_opportunities where partner_user_fk = p_user_id)
     ) then
    raise exception 'Cannot change role for a user with external partner history. Deactivate the account instead.'
      using errcode = '23514';
  end if;

  if v_role <> v_old_role
     and (v_role = 'mentor' or v_old_role = 'mentor')
     and exists (
       select 1
       from mentor_requests
       where mentor_fk = p_user_id
          or requested_by_fk = p_user_id
          or decided_by_fk = p_user_id
     ) then
    raise exception 'Cannot change role for a user with mentor request history. Deactivate the account instead.'
      using errcode = '23514';
  end if;

  if lower(coalesce(v_user.role, '')) = 'student'
     and v_user.course_fk is distinct from p_course_id
     and exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'Cannot change course assignment while the student is in an active team.'
      using errcode = '23514';
  end if;

  if lower(coalesce(v_user.role, '')) = 'admin'
     and v_role <> 'admin'
     and v_user.active is true then
    select count(*)
      into v_active_admin_count
    from users
    where lower(coalesce(role, '')) = 'admin'
      and active is true
      and user_id <> p_user_id;

    if v_active_admin_count = 0 then
      raise exception 'Cannot remove the last active admin.' using errcode = '23514';
    end if;
  end if;

  if v_role = 'admin' and v_active is false then
    select count(*)
      into v_active_admin_count
    from users
    where lower(coalesce(role, '')) = 'admin'
      and active is true
      and user_id <> p_user_id;

    if v_active_admin_count = 0 then
      raise exception 'Cannot deactivate the last active admin.' using errcode = '23514';
    end if;
  end if;

  if lower(coalesce(v_user.role, '')) = 'student'
     and v_active is false
     and exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'Cannot deactivate a student while they are in an active team.'
      using errcode = '23514';
  end if;

  if v_old_role = 'external_partner' and v_active is false then
    select coalesce(array_agg(partner_opportunity_id order by partner_opportunity_id), '{}'::bigint[])
      into v_archived_partner_opportunity_ids
    from partner_opportunities
    where partner_user_fk = p_user_id
      and status <> 'archived';

    update partner_opportunities
    set status = 'archived',
        archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where partner_user_fk = p_user_id
      and status <> 'archived';
  end if;

  if v_old_role = 'mentor' and v_active is false then
    update mentor_requests
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    where mentor_fk = p_user_id
      and status = 'pending';

    update mentor_requests mr
    set status = 'cancelled',
        response_note = coalesce(response_note, 'Mentor account was deactivated.'),
        decided_by_fk = v_actor.user_id,
        decided_at = now(),
        updated_at = now()
    from capstones c
    left join teams t on t.team_id = c.team_fk
    where mr.mentor_fk = p_user_id
      and mr.capstone_fk = c.capstone_id
      and mr.status = 'accepted'
      and coalesce(t.status, '') <> 'finalized';
  end if;

  perform watmatch_assert_instructor_can_leave_course(
    p_user_id,
    case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_course_id end,
    v_role,
    v_active
  );

  update users
  set email = v_email,
      role = v_role,
      course_fk = case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_course_id end,
      home_department_fk = case when v_role in ('admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor') then null else p_home_department_id end,
      active = v_active,
      active_team_fk = case when v_role = 'student' then active_team_fk else null end,
      refresh_token = case when v_active is false then null else refresh_token end
  where user_id = p_user_id
  returning * into v_user;

  if v_old_role = 'student' and (v_role <> 'student' or v_active is false) then
    perform watmatch_cancel_pending_submission_enrollment_requests(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      case
        when v_role <> 'student' then 'User is no longer a student.'
        else 'Student account was deactivated.'
      end
    );

    perform watmatch_cleanup_marketplace_for_unavailable_student(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      case
        when v_role <> 'student' then 'User is no longer a student.'
        else 'Student account was deactivated.'
      end
    );
  elsif v_role = 'student' and v_user.course_fk is not null then
    perform watmatch_cancel_pending_submission_enrollment_requests(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student was manually assigned to a course.'
    );

    perform watmatch_reconcile_marketplace_commitments_after_course_assignment(
      p_user_id,
      v_actor.user_id,
      v_actor.role,
      'Student was manually assigned to a course.'
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'user_updated',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'old', jsonb_build_object(
        'email', v_old_user.email,
        'role', v_old_user.role,
        'course_fk', v_old_user.course_fk,
        'home_department_fk', v_old_user.home_department_fk,
        'active', v_old_user.active
      ),
      'new', jsonb_build_object(
        'email', v_user.email,
        'role', v_user.role,
        'course_fk', v_user.course_fk,
        'home_department_fk', v_user.home_department_fk,
        'active', v_user.active
      ),
      'archived_partner_opportunity_ids', v_archived_partner_opportunity_ids
    )
  );

  return jsonb_build_object('success', true, 'message', 'User updated.', 'data', to_jsonb(v_user));
end;
$$;

create or replace function watmatch_admin_delete_user(
  p_user_id bigint,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_user users%rowtype;
  v_active_admin_count integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Admin user deletion requires an audit reason.' using errcode = '23514';
  end if;

  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;

  select *
    into v_user
  from users
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', true, 'message', 'User was already deleted.', 'data', null);
  end if;

  if v_user.user_id = v_actor.user_id then
    raise exception 'Admins cannot delete their own account.' using errcode = '23514';
  end if;

  if lower(coalesce(v_user.role, '')) = 'admin' and v_user.active is true then
    select count(*)
      into v_active_admin_count
    from users
    where lower(coalesce(role, '')) = 'admin'
      and active is true
      and user_id <> p_user_id;

    if v_active_admin_count = 0 then
      raise exception 'Cannot delete the last active admin.' using errcode = '23514';
    end if;
  end if;

  perform watmatch_assert_instructor_can_leave_course(
    p_user_id,
    null,
    null,
    false
  );

  if exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'Cannot delete a user while they are in an active team. Disband or remove them first.'
      using errcode = '23514';
  end if;

  if lower(coalesce(v_user.role, '')) = 'external_partner'
     and (
       exists (select 1 from partner_profiles where partner_user_fk = p_user_id)
       or exists (select 1 from partner_opportunities where partner_user_fk = p_user_id)
     ) then
    raise exception 'Cannot delete an external partner with profile or opportunity history. Deactivate the account instead.'
      using errcode = '23514';
  end if;

  if exists (select 1 from capstones where user_fk = p_user_id)
     or exists (select 1 from approvals where instructor_fk = p_user_id)
     or exists (select 1 from capstone_course_approvals where decided_by_fk = p_user_id)
     or exists (select 1 from audit_log where actor_fk = p_user_id)
     or exists (select 1 from teams where leader_fk = p_user_id)
     or exists (select 1 from project_explorations where student_fk = p_user_id) then
    raise exception 'Cannot delete a user with workflow or audit history. Deactivate the account instead.'
      using errcode = '23514';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'user_deleted',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object('email', v_user.email, 'role', v_user.role, 'course_fk', v_user.course_fk, 'active', v_user.active)
  );

  delete from users
  where user_id = p_user_id;

  return jsonb_build_object('success', true, 'message', 'User deleted.', 'data', to_jsonb(v_user));
end;
$$;

create or replace function watmatch_assert_external_partner_user(
  p_partner_user_id bigint,
  p_require_active boolean default true
)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner users%rowtype;
begin
  if p_partner_user_id is null then
    raise exception 'External partner user is required.' using errcode = '22023';
  end if;

  select *
    into v_partner
  from users
  where user_id = p_partner_user_id
  for update;

  if not found then
    raise exception 'External partner user not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_partner.role, '')) <> 'external_partner' then
    raise exception 'User is not an external partner.' using errcode = '23514';
  end if;

  if coalesce(p_require_active, true) and v_partner.active is not true then
    raise exception 'External partner user is inactive.' using errcode = '23514';
  end if;

  return v_partner;
end;
$$;

create or replace function watmatch_assert_partner_actor(
  p_actor_id bigint,
  p_actor_role text
)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_actor users%rowtype;
begin
  if v_role = 'admin' then
    return watmatch_assert_admin_actor(p_actor_id);
  end if;

  if v_role <> 'external_partner' then
    raise exception 'External partner or admin access required.' using errcode = '42501';
  end if;

  select *
    into v_actor
  from users
  where user_id = p_actor_id
  for update;

  if not found or lower(coalesce(v_actor.role, '')) <> 'external_partner' then
    raise exception 'External partner access required.' using errcode = '42501';
  end if;

  if v_actor.active is not true then
    raise exception 'External partner user is inactive.' using errcode = '23514';
  end if;

  return v_actor;
end;
$$;

create or replace function watmatch_upsert_student_profile(
  p_actor_id bigint,
  p_about_me text default null,
  p_skills text[] default '{}'::text[],
  p_headline text default null,
  p_preferred_roles text[] default '{}'::text[],
  p_project_interests text[] default '{}'::text[],
  p_availability text default null,
  p_portfolio_url text default null,
  p_linkedin_url text default null,
  p_github_url text default null,
  p_profile_visibility text default 'team_network',
  p_interested_department_ids bigint[] default '{}'::bigint[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
  v_profile student_profile%rowtype;
  v_about_me text := nullif(btrim(coalesce(p_about_me, '')), '');
  v_headline text := nullif(btrim(coalesce(p_headline, '')), '');
  v_availability text := nullif(btrim(coalesce(p_availability, '')), '');
  v_portfolio_url text := nullif(btrim(coalesce(p_portfolio_url, '')), '');
  v_linkedin_url text := nullif(btrim(coalesce(p_linkedin_url, '')), '');
  v_github_url text := nullif(btrim(coalesce(p_github_url, '')), '');
  v_profile_visibility text := lower(nullif(btrim(coalesce(p_profile_visibility, 'team_network')), ''));
  v_skills text[];
  v_preferred_roles text[];
  v_project_interests text[];
  v_interested_department_ids bigint[];
begin
  if p_actor_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;

  select *
    into v_student
  from users
  where user_id = p_actor_id
  for update;

  if not found then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_student.role, '')) <> 'student' then
    raise exception 'Only students can update student profiles.' using errcode = '42501';
  end if;

  if v_student.active is not true then
    raise exception 'Student account is inactive.' using errcode = '23514';
  end if;

  if v_headline is not null and length(v_headline) > 120 then
    raise exception 'Headline must be 120 characters or fewer.' using errcode = '22023';
  end if;

  if v_about_me is not null and length(v_about_me) > 600 then
    raise exception 'About me must be 600 characters or fewer.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct nullif(btrim(value), '')) filter (where nullif(btrim(value), '') is not null), '{}'::text[])
    into v_skills
  from unnest(coalesce(p_skills, '{}'::text[])) as skill(value);

  if cardinality(v_skills) > 25 then
    raise exception 'A profile can include at most 25 skills.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_skills) as skill(value)
    where length(value) > 80
  ) then
    raise exception 'Each skill must be 80 characters or fewer.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct nullif(btrim(value), '')) filter (where nullif(btrim(value), '') is not null), '{}'::text[])
    into v_preferred_roles
  from unnest(coalesce(p_preferred_roles, '{}'::text[])) as role(value);

  if cardinality(v_preferred_roles) > 8 then
    raise exception 'A profile can include at most 8 preferred roles.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_preferred_roles) as role(value)
    where length(value) > 60
  ) then
    raise exception 'Each preferred role must be 60 characters or fewer.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct nullif(btrim(value), '')) filter (where nullif(btrim(value), '') is not null), '{}'::text[])
    into v_project_interests
  from unnest(coalesce(p_project_interests, '{}'::text[])) as interest(value);

  if cardinality(v_project_interests) > 10 then
    raise exception 'A profile can include at most 10 project interests.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_project_interests) as interest(value)
    where length(value) > 80
  ) then
    raise exception 'Each project interest must be 80 characters or fewer.' using errcode = '22023';
  end if;

  if v_availability is not null and length(v_availability) > 80 then
    raise exception 'Availability must be 80 characters or fewer.' using errcode = '22023';
  end if;

  if v_portfolio_url is not null and length(v_portfolio_url) > 500 then
    raise exception 'Portfolio URL must be 500 characters or fewer.' using errcode = '22023';
  end if;

  if v_linkedin_url is not null and length(v_linkedin_url) > 500 then
    raise exception 'LinkedIn URL must be 500 characters or fewer.' using errcode = '22023';
  end if;

  if v_github_url is not null and length(v_github_url) > 500 then
    raise exception 'GitHub URL must be 500 characters or fewer.' using errcode = '22023';
  end if;

  if v_profile_visibility not in ('team_network', 'students', 'private') then
    raise exception 'Invalid profile visibility.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct department_id), '{}'::bigint[])
    into v_interested_department_ids
  from departments
  where active is true
    and department_id = any(coalesce(p_interested_department_ids, '{}'::bigint[]));

  if cardinality(v_interested_department_ids) > 12 then
    raise exception 'A profile can include at most 12 interested departments.' using errcode = '22023';
  end if;

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
  values (
    v_student.user_id,
    v_headline,
    v_about_me,
    v_skills,
    v_preferred_roles,
    v_project_interests,
    v_availability,
    v_portfolio_url,
    v_linkedin_url,
    v_github_url,
    v_profile_visibility,
    now()
  )
  on conflict (student_fk) do update
    set headline = excluded.headline,
        about_me = excluded.about_me,
        skills = excluded.skills,
        preferred_roles = excluded.preferred_roles,
        project_interests = excluded.project_interests,
        availability = excluded.availability,
        portfolio_url = excluded.portfolio_url,
        linkedin_url = excluded.linkedin_url,
        github_url = excluded.github_url,
        profile_visibility = excluded.profile_visibility,
        updated_at = now()
  returning * into v_profile;

  delete from student_profile_departments
  where student_fk = v_student.user_id;

  insert into student_profile_departments (student_fk, department_fk)
  select v_student.user_id, department_id
  from departments
  where department_id = any(v_interested_department_ids)
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'message', 'Profile saved successfully.',
    'data',
      to_jsonb(v_profile)
      || jsonb_build_object(
        'interested_department_ids', coalesce(to_jsonb(v_interested_department_ids), '[]'::jsonb),
        'interested_departments',
          coalesce((
            select jsonb_agg(to_jsonb(d) order by d.name)
            from departments d
            where d.department_id = any(v_interested_department_ids)
          ), '[]'::jsonb)
      )
  );
end;
$$;

drop function if exists watmatch_upsert_partner_profile(
  bigint,
  text,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text[]
);

create or replace function watmatch_upsert_partner_profile(
  p_actor_id bigint,
  p_actor_role text,
  p_partner_user_id bigint,
  p_display_name text,
  p_organization text,
  p_contact_email text,
  p_website text default null,
  p_bio text default null,
  p_areas text[] default '{}'::text[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_partner_user_id bigint;
  v_partner users%rowtype;
  v_profile partner_profiles%rowtype;
  v_display_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_organization text := nullif(btrim(coalesce(p_organization, '')), '');
  v_contact_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_website text := nullif(btrim(coalesce(p_website, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_areas text[];
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_partner_actor(p_actor_id, p_actor_role);
  v_partner_user_id := case when v_role = 'admin' then p_partner_user_id else p_actor_id end;
  v_partner := watmatch_assert_external_partner_user(v_partner_user_id, true);

  if v_role = 'admin' and v_reason is null then
    raise exception 'Admin partner profile changes require an audit reason.' using errcode = '22023';
  end if;

  if v_display_name is null then
    raise exception 'Display name is required.' using errcode = '22023';
  end if;
  if v_organization is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;
  if v_contact_email is null then
    raise exception 'Contact email is required.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct nullif(btrim(value), '')) filter (where nullif(btrim(value), '') is not null), '{}'::text[])
    into v_areas
  from unnest(coalesce(p_areas, '{}'::text[])) as area(value);

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
  values (
    v_partner.user_id,
    v_display_name,
    v_organization,
    v_contact_email,
    v_website,
    v_bio,
    v_areas,
    now()
  )
  on conflict (partner_user_fk) do update
    set display_name = excluded.display_name,
        organization = excluded.organization,
        contact_email = excluded.contact_email,
        website = excluded.website,
        bio = excluded.bio,
        areas = excluded.areas,
        updated_at = now()
  returning * into v_profile;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'partner_profile_upserted',
    'partner_profile',
    v_partner.user_id::text,
    jsonb_build_object(
      'partner_user_fk', v_partner.user_id,
      'organization', v_profile.organization,
      'reason', v_reason
    )
  );

  return jsonb_build_object('success', true, 'message', 'External partner profile saved.', 'data', to_jsonb(v_profile));
end;
$$;

drop function if exists watmatch_upsert_partner_opportunity(
  bigint,
  text,
  bigint,
  bigint,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text,
  integer,
  text,
  text,
  text
);

drop function if exists watmatch_upsert_partner_opportunity(
  bigint,
  text,
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text,
  integer,
  text,
  text,
  boolean,
  boolean,
  boolean,
  text
);

create or replace function watmatch_upsert_partner_opportunity(
  p_actor_id bigint,
  p_actor_role text,
  p_opportunity_id bigint,
  p_partner_user_id bigint,
  p_title text,
  p_organization text,
  p_description text,
  p_primary_contact text default null,
  p_phone text default null,
  p_how_heard_about_capstone text default null,
  p_organization_description text default null,
  p_organization_size text default null,
  p_project_start_date text default null,
  p_problem_area text default null,
  p_main_objectives text default null,
  p_scope_of_work text default null,
  p_deliverable_types text[] default '{}'::text[],
  p_deliverables text default null,
  p_meeting_frequency text default null,
  p_resources_needed text default null,
  p_disciplines text[] default '{}'::text[],
  p_skills text[] default '{}'::text[],
  p_target_course_tags text[] default '{}'::text[],
  p_target_course_ids bigint[] default '{}'::bigint[],
  p_preferred_team_size text default null,
  p_max_active_teams integer default null,
  p_contact_email text default null,
  p_contact_url text default null,
  p_ip_acknowledged boolean default false,
  p_nda_acknowledged boolean default false,
  p_matching_acknowledged boolean default false,
  p_status text default 'draft',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_existing partner_opportunities%rowtype;
  v_partner_user_id bigint;
  v_partner users%rowtype;
  v_opportunity partner_opportunities%rowtype;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_organization text := nullif(btrim(coalesce(p_organization, '')), '');
  v_description text := coalesce(nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_problem_area, '')), ''), nullif(btrim(coalesce(p_title, '')), ''));
  v_primary_contact text := nullif(btrim(coalesce(p_primary_contact, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_how_heard_about_capstone text := nullif(btrim(coalesce(p_how_heard_about_capstone, '')), '');
  v_organization_description text := nullif(btrim(coalesce(p_organization_description, '')), '');
  v_organization_size text := nullif(btrim(coalesce(p_organization_size, '')), '');
  v_project_start_date text := nullif(btrim(coalesce(p_project_start_date, '')), '');
  v_problem_area text := nullif(btrim(coalesce(p_problem_area, '')), '');
  v_main_objectives text := nullif(btrim(coalesce(p_main_objectives, '')), '');
  v_scope_of_work text := nullif(btrim(coalesce(p_scope_of_work, '')), '');
  v_deliverables text := nullif(btrim(coalesce(p_deliverables, '')), '');
  v_meeting_frequency text := nullif(btrim(coalesce(p_meeting_frequency, '')), '');
  v_resources_needed text := nullif(btrim(coalesce(p_resources_needed, '')), '');
  v_preferred_team_size text := nullif(btrim(coalesce(p_preferred_team_size, '')), '');
  v_contact_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_contact_url text := nullif(btrim(coalesce(p_contact_url, '')), '');
  v_status text := lower(nullif(btrim(coalesce(p_status, 'draft')), ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_disciplines text[];
  v_skills text[];
  v_target_course_tags text[];
  v_target_course_ids bigint[];
  v_deliverable_types text[];
  v_action text;
begin
  v_actor := watmatch_assert_partner_actor(p_actor_id, p_actor_role);

  if v_role = 'admin' and v_reason is null then
    raise exception 'Admin partner opportunity changes require an audit reason.' using errcode = '22023';
  end if;

  if p_opportunity_id is not null then
    select *
      into v_existing
    from partner_opportunities
    where partner_opportunity_id = p_opportunity_id
    for update;

    if not found then
      raise exception 'External partner opportunity not found.' using errcode = 'P0002';
    end if;

    if v_role = 'external_partner' and v_existing.partner_user_fk <> p_actor_id then
      raise exception 'You cannot manage this opportunity.' using errcode = '42501';
    end if;
  end if;

  v_partner_user_id := case
    when v_role = 'external_partner' then p_actor_id
    when p_partner_user_id is not null then p_partner_user_id
    else v_existing.partner_user_fk
  end;
  v_partner := watmatch_assert_external_partner_user(v_partner_user_id, true);

  if v_title is null then
    raise exception 'Opportunity title is required.' using errcode = '22023';
  end if;
  if v_organization is null then
    raise exception 'Organization is required.' using errcode = '22023';
  end if;
  if v_description is null then
    raise exception 'Description is required.' using errcode = '22023';
  end if;
  if v_contact_email is null then
    raise exception 'Contact email is required.' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'published', 'archived') then
    raise exception 'Invalid opportunity status.' using errcode = '23514';
  end if;
  if p_max_active_teams is not null and p_max_active_teams <= 0 then
    raise exception 'Max active teams must be greater than zero.' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct nullif(btrim(item), '')) filter (where nullif(btrim(item), '') is not null), '{}'::text[])
    into v_deliverable_types
  from unnest(coalesce(p_deliverable_types, '{}'::text[])) as value(item);

  select coalesce(array_agg(distinct nullif(btrim(item), '')) filter (where nullif(btrim(item), '') is not null), '{}'::text[])
    into v_disciplines
  from unnest(coalesce(p_disciplines, '{}'::text[])) as value(item);

  select coalesce(array_agg(distinct nullif(btrim(item), '')) filter (where nullif(btrim(item), '') is not null), '{}'::text[])
    into v_skills
  from unnest(coalesce(p_skills, '{}'::text[])) as value(item);

  select coalesce(array_agg(distinct nullif(btrim(item), '')) filter (where nullif(btrim(item), '') is not null), '{}'::text[])
    into v_target_course_tags
  from unnest(coalesce(p_target_course_tags, '{}'::text[])) as value(item);

  select coalesce(array_agg(distinct id order by id), '{}'::bigint[])
    into v_target_course_ids
  from unnest(coalesce(p_target_course_ids, '{}'::bigint[])) as value(id)
  where id is not null;

  if cardinality(v_target_course_ids) > 50 then
    raise exception 'At most 50 target courses can be selected.' using errcode = '22023';
  end if;

  if cardinality(v_target_course_ids) > 0 then
    v_target_course_tags := (
      select coalesce(
        array_agg(distinct tag order by tag),
        '{}'::text[]
      )
      from (
        select unnest(watmatch_course_labels_from_ids(v_target_course_ids)) as tag
        union all
        select unnest(v_target_course_tags) as tag
      ) labels
      where nullif(btrim(tag), '') is not null
    );
  end if;

  if v_status = 'published' then
    if v_primary_contact is null then
      raise exception 'Primary contact is required before publishing.' using errcode = '22023';
    end if;
    if v_phone is null then
      raise exception 'Primary contact phone number is required before publishing.' using errcode = '22023';
    end if;
    if v_organization_description is null then
      raise exception 'Organization description is required before publishing.' using errcode = '22023';
    end if;
    if v_organization_size is null then
      raise exception 'Organization size is required before publishing.' using errcode = '22023';
    end if;
    if v_project_start_date is null then
      raise exception 'Project start date is required before publishing.' using errcode = '22023';
    end if;
    if v_problem_area is null then
      raise exception 'Problem area is required before publishing.' using errcode = '22023';
    end if;
    if v_main_objectives is null then
      raise exception 'Main objectives are required before publishing.' using errcode = '22023';
    end if;
    if v_scope_of_work is null then
      raise exception 'Scope of work is required before publishing.' using errcode = '22023';
    end if;
    if coalesce(array_length(v_deliverable_types, 1), 0) = 0 then
      raise exception 'At least one deliverable type is required before publishing.' using errcode = '22023';
    end if;
    if v_deliverables is null then
      raise exception 'Deliverable details are required before publishing.' using errcode = '22023';
    end if;
    if v_meeting_frequency is null then
      raise exception 'Meeting frequency is required before publishing.' using errcode = '22023';
    end if;
    if coalesce(array_length(v_skills, 1), 0) = 0 then
      raise exception 'At least one skill or training need is required before publishing.' using errcode = '22023';
    end if;
    if v_resources_needed is null then
      raise exception 'Project resources are required before publishing.' using errcode = '22023';
    end if;
    if v_role <> 'admin' and coalesce(array_length(v_target_course_ids, 1), 0) = 0 then
      raise exception 'At least one active target course is required before publishing.' using errcode = '22023';
    end if;
    if v_role = 'admin'
       and coalesce(array_length(v_target_course_ids, 1), 0) = 0
       and coalesce(array_length(v_target_course_tags, 1), 0) = 0 then
      raise exception 'At least one target course is required before publishing.' using errcode = '22023';
    end if;
    if p_ip_acknowledged is not true or p_nda_acknowledged is not true or p_matching_acknowledged is not true then
      raise exception 'All policy and project matching acknowledgements are required before publishing.' using errcode = '23514';
    end if;
  end if;

  if v_role <> 'admin'
     and exists (
       select 1
       from courses c
       where c.course_id = any(v_target_course_ids)
         and c.active is not true
     ) then
    raise exception 'External partners can only target active courses.' using errcode = '23514';
  end if;

  if p_opportunity_id is null then
    insert into partner_opportunities (
      partner_user_fk,
      title,
      organization,
      description,
      primary_contact,
      phone,
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
      archived_at,
      updated_at
    )
    values (
      v_partner.user_id,
      v_title,
      v_organization,
      v_description,
      v_primary_contact,
      v_phone,
      v_how_heard_about_capstone,
      v_organization_description,
      v_organization_size,
      v_project_start_date,
      v_problem_area,
      v_main_objectives,
      v_scope_of_work,
      v_deliverable_types,
      v_deliverables,
      v_meeting_frequency,
      v_resources_needed,
      v_disciplines,
      v_skills,
      v_target_course_tags,
      v_preferred_team_size,
      p_max_active_teams,
      v_contact_email,
      v_contact_url,
      coalesce(p_ip_acknowledged, false),
      coalesce(p_nda_acknowledged, false),
      coalesce(p_matching_acknowledged, false),
      v_status,
      case when v_status = 'archived' then now() else null end,
      now()
    )
    returning * into v_opportunity;
    v_action := 'partner_opportunity_created';
  else
    update partner_opportunities
    set partner_user_fk = v_partner.user_id,
        title = v_title,
        organization = v_organization,
        description = v_description,
        primary_contact = v_primary_contact,
        phone = v_phone,
        how_heard_about_capstone = v_how_heard_about_capstone,
        organization_description = v_organization_description,
        organization_size = v_organization_size,
        project_start_date = v_project_start_date,
        problem_area = v_problem_area,
        main_objectives = v_main_objectives,
        scope_of_work = v_scope_of_work,
        deliverable_types = v_deliverable_types,
        deliverables = v_deliverables,
        meeting_frequency = v_meeting_frequency,
        resources_needed = v_resources_needed,
        disciplines = v_disciplines,
        skills = v_skills,
        target_course_tags = v_target_course_tags,
        preferred_team_size = v_preferred_team_size,
        max_active_teams = p_max_active_teams,
        contact_email = v_contact_email,
        contact_url = v_contact_url,
        ip_acknowledged = coalesce(p_ip_acknowledged, false),
        nda_acknowledged = coalesce(p_nda_acknowledged, false),
        matching_acknowledged = coalesce(p_matching_acknowledged, false),
        status = v_status,
        archived_at = case when v_status = 'archived' then coalesce(archived_at, now()) else null end,
        updated_at = now()
    where partner_opportunity_id = p_opportunity_id
    returning * into v_opportunity;
    v_action := 'partner_opportunity_updated';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    v_action,
    'partner_opportunity',
    v_opportunity.partner_opportunity_id::text,
    jsonb_build_object(
      'partner_user_fk', v_opportunity.partner_user_fk,
      'status', v_opportunity.status,
      'max_active_teams', v_opportunity.max_active_teams,
      'reason', v_reason
    )
  );

  perform watmatch_sync_partner_opportunity_courses(
    v_opportunity.partner_opportunity_id,
    v_target_course_ids
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_opportunity_id is null then 'External opportunity created.' else 'External opportunity updated.' end,
    'data',
      to_jsonb(v_opportunity)
      || jsonb_build_object(
        'target_course_ids', watmatch_partner_target_course_ids(v_opportunity.partner_opportunity_id),
        'target_courses', watmatch_partner_target_courses_json(v_opportunity.partner_opportunity_id)
      )
  );
end;
$$;

drop function if exists watmatch_get_partner_opportunities(
  bigint,
  text,
  integer,
  integer,
  text,
  text,
  text,
  text
);

create or replace function watmatch_get_partner_opportunities(
  p_actor_id bigint,
  p_actor_role text,
  p_page integer default 1,
  p_page_size integer default 12,
  p_search text default null,
  p_discipline text default null,
  p_skill text default null,
  p_status text default 'published',
  p_target_course_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 12), 1), 50);
  v_offset integer := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 12), 1), 50);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_pattern text;
  v_discipline text := nullif(lower(btrim(coalesce(p_discipline, ''))), '');
  v_skill text := nullif(lower(btrim(coalesce(p_skill, ''))), '');
  v_status text := lower(nullif(btrim(coalesce(p_status, 'published')), ''));
  v_target_course_id bigint := p_target_course_id;
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  select *
    into v_actor
  from users
  where user_id = p_actor_id;

  if not found then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role <> lower(coalesce(v_actor.role, '')) then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_status not in ('draft', 'published', 'archived', 'all') then
    v_status := 'published';
  end if;

  if v_role <> 'admin' then
    v_status := 'published';
  end if;

  if v_search is not null then
    v_search_pattern := '%' || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_') || '%';
  end if;

  with filtered as (
    select
      po.*,
      u.email as partner_user_email,
      u.active as partner_user_active,
      watmatch_partner_target_course_ids(po.partner_opportunity_id) as target_course_ids,
      watmatch_partner_target_courses_json(po.partner_opportunity_id) as target_courses,
      usage.active_team_count,
      (
        po.max_active_teams is null
        or usage.active_team_count < po.max_active_teams
      ) as is_available
    from partner_opportunities po
    join users u on u.user_id = po.partner_user_fk
    cross join lateral (
      select count(*)::integer as active_team_count
      from capstones c
      where c.partner_opportunity_fk = po.partner_opportunity_id
        and c.archived is not true
        and c.status not in ('archived', 'rejected')
    ) usage
    where lower(coalesce(u.role, '')) = 'external_partner'
      and (
        v_role = 'admin'
        or (u.active is true and po.status = 'published')
      )
      and (
        v_status = 'all'
        or po.status = v_status
      )
      and (
        v_search is null
        or po.title ilike v_search_pattern escape '!'
        or po.organization ilike v_search_pattern escape '!'
        or po.description ilike v_search_pattern escape '!'
        or po.problem_area ilike v_search_pattern escape '!'
        or po.main_objectives ilike v_search_pattern escape '!'
        or po.scope_of_work ilike v_search_pattern escape '!'
        or po.organization_description ilike v_search_pattern escape '!'
        or po.contact_email ilike v_search_pattern escape '!'
      )
      and (
        v_discipline is null
        or exists (
          select 1
          from unnest(coalesce(po.disciplines, '{}'::text[])) as discipline(value)
          where lower(btrim(discipline.value)) = v_discipline
        )
      )
      and (
        v_skill is null
        or exists (
          select 1
          from unnest(coalesce(po.skills, '{}'::text[])) as skill(value)
          where lower(btrim(skill.value)) = v_skill
        )
      )
      and (
        v_target_course_id is null
        or exists (
          select 1
          from partner_opportunity_courses poc
          where poc.partner_opportunity_fk = po.partner_opportunity_id
            and poc.course_fk = v_target_course_id
        )
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, partner_opportunity_id desc
    offset v_offset
    limit v_page_size
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(to_jsonb(paged) order by paged.created_at desc, paged.partner_opportunity_id desc)
        from paged
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'page', v_page,
    'page_size', v_page_size,
    'total', v_total,
    'total_pages', greatest(1, ceil(v_total::numeric / v_page_size)::integer),
    'data', v_data
  );
end;
$$;

create or replace function watmatch_get_my_partner_opportunities(
  p_actor_id bigint,
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner users%rowtype;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  v_offset integer := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 10), 1), 50);
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  v_partner := watmatch_assert_external_partner_user(p_actor_id, true);

  with filtered as (
    select
      po.*,
      u.email as partner_user_email,
      u.active as partner_user_active,
      watmatch_partner_target_course_ids(po.partner_opportunity_id) as target_course_ids,
      watmatch_partner_target_courses_json(po.partner_opportunity_id) as target_courses,
      usage.active_team_count,
      (
        po.max_active_teams is null
        or usage.active_team_count < po.max_active_teams
      ) as is_available
    from partner_opportunities po
    join users u on u.user_id = po.partner_user_fk
    cross join lateral (
      select count(*)::integer as active_team_count
      from capstones c
      where c.partner_opportunity_fk = po.partner_opportunity_id
        and c.archived is not true
        and c.status not in ('archived', 'rejected')
    ) usage
    where po.partner_user_fk = v_partner.user_id
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, partner_opportunity_id desc
    offset v_offset
    limit v_page_size
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(to_jsonb(paged) order by paged.created_at desc, paged.partner_opportunity_id desc)
        from paged
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'page', v_page,
    'page_size', v_page_size,
    'total', v_total,
    'total_pages', greatest(1, ceil(v_total::numeric / v_page_size)::integer),
    'data', v_data
  );
end;
$$;

create or replace function watmatch_get_admin_partner_opportunities(
  p_actor_id bigint,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset integer := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  with filtered as (
    select
      po.*,
      u.email as partner_user_email,
      u.active as partner_user_active,
      watmatch_partner_target_course_ids(po.partner_opportunity_id) as target_course_ids,
      watmatch_partner_target_courses_json(po.partner_opportunity_id) as target_courses,
      usage.active_team_count,
      (
        po.max_active_teams is null
        or usage.active_team_count < po.max_active_teams
      ) as is_available
    from partner_opportunities po
    join users u on u.user_id = po.partner_user_fk
    cross join lateral (
      select count(*)::integer as active_team_count
      from capstones c
      where c.partner_opportunity_fk = po.partner_opportunity_id
        and c.archived is not true
        and c.status not in ('archived', 'rejected')
    ) usage
    where lower(coalesce(u.role, '')) = 'external_partner'
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, partner_opportunity_id desc
    offset v_offset
    limit v_page_size
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(to_jsonb(paged) order by paged.created_at desc, paged.partner_opportunity_id desc)
        from paged
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'page', v_page,
    'page_size', v_page_size,
    'total', v_total,
    'total_pages', greatest(1, ceil(v_total::numeric / v_page_size)::integer),
    'data', v_data
  );
end;
$$;

drop function if exists watmatch_admin_upsert_course(
  bigint,
  text,
  text,
  text,
  boolean,
  boolean,
  bigint,
  text
);

drop function if exists watmatch_admin_upsert_course(
  bigint,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  bigint,
  text
);

drop function if exists watmatch_admin_upsert_course(
  bigint,
  text,
  text,
  text,
  text[],
  text,
  boolean,
  boolean,
  bigint,
  text
);

drop function if exists watmatch_admin_upsert_course(
  bigint,
  text,
  text,
  text[],
  text,
  bigint,
  text,
  boolean,
  boolean,
  bigint,
  text
);

drop function if exists watmatch_admin_upsert_course(
  bigint,
  text,
  text,
  text[],
  text,
  bigint,
  bigint,
  text,
  boolean,
  boolean,
  bigint,
  text
);

drop function if exists watmatch_admin_upsert_course(
  bigint,
  text,
  text,
  text[],
  text,
  boolean,
  boolean,
  bigint,
  text
);

drop function if exists watmatch_admin_upsert_course(
  bigint,
  text,
  text,
  text[],
  text,
  bigint,
  bigint,
  text,
  text,
  text,
  boolean,
  bigint,
  text
);

create or replace function watmatch_admin_upsert_course(
  p_course_id bigint,
  p_code text,
  p_name text,
  p_active_terms text[],
  p_activation_mode text,
  p_department_id bigint,
  p_ecosystem_id bigint,
  p_routing_kind text,
  p_marketplace_phase_override text,
  p_marketplace_phase_override_reason text,
  p_requires_project_support boolean,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_course courses%rowtype;
  v_code text := upper(nullif(btrim(coalesce(p_code, '')), ''));
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_active_terms text[] := watmatch_normalize_course_active_terms(p_active_terms);
  v_activation_mode text := lower(coalesce(nullif(btrim(p_activation_mode), ''), 'auto'));
  v_department_id bigint := p_department_id;
  v_ecosystem_id bigint := p_ecosystem_id;
  v_routing_kind text := lower(coalesce(nullif(btrim(p_routing_kind), ''), 'standard'));
  v_phase_override text := watmatch_normalize_marketplace_phase(p_marketplace_phase_override);
  v_phase_override_reason text := nullif(btrim(coalesce(p_marketplace_phase_override_reason, '')), '');
  v_requires_project_support boolean := coalesce(p_requires_project_support, true);
  v_departmental_ecosystem_id bigint;
  v_other_interdisciplinary_ecosystem_id bigint;
  v_selected_ecosystem project_ecosystems%rowtype;
  v_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_code is null then
    raise exception 'Course code is required.' using errcode = '22023';
  end if;
  if v_name is null then
    raise exception 'Course name is required.' using errcode = '22023';
  end if;
  if v_activation_mode not in ('auto', 'force_active', 'force_inactive') then
    raise exception 'Course activation mode must be auto, force_active, or force_inactive.' using errcode = '23514';
  end if;
  if v_routing_kind not in ('standard', 'interdisciplinary') then
    raise exception 'Course routing kind must be standard or interdisciplinary.' using errcode = '23514';
  end if;

  if v_phase_override is not null and v_routing_kind <> 'standard' then
    raise exception 'Course marketplace phase overrides are only allowed for standard departmental courses. Use the project ecosystem override for interdisciplinary routes.'
      using errcode = '23514';
  end if;

  if v_phase_override is not null and v_phase_override_reason is null then
    raise exception 'A course marketplace phase override requires an audit reason.' using errcode = '23514';
  end if;

  select ecosystem_id
    into v_departmental_ecosystem_id
  from project_ecosystems
  where lower(name) = 'departmental'
  limit 1;

  select ecosystem_id
    into v_other_interdisciplinary_ecosystem_id
  from project_ecosystems
  where lower(name) = 'other interdisciplinary'
  limit 1;

  if v_departmental_ecosystem_id is null then
    raise exception 'The Departmental project ecosystem is required before managing courses.'
      using errcode = '23514';
  end if;

  if v_routing_kind = 'standard' then
    v_ecosystem_id := v_departmental_ecosystem_id;
  else
    if v_ecosystem_id is null then
      v_ecosystem_id := v_other_interdisciplinary_ecosystem_id;
    end if;

    if v_ecosystem_id is null then
      raise exception 'Choose an active non-Departmental ecosystem for interdisciplinary courses.'
        using errcode = '23514';
    end if;

    select *
      into v_selected_ecosystem
    from project_ecosystems
    where ecosystem_id = v_ecosystem_id;

    if not found then
      raise exception 'Project ecosystem not found.' using errcode = 'P0002';
    end if;

    if v_selected_ecosystem.active is not true
       or lower(coalesce(v_selected_ecosystem.name, '')) = 'departmental' then
      raise exception 'Interdisciplinary courses must use an active non-Departmental project ecosystem.'
        using errcode = '23514';
    end if;
  end if;

  if v_department_id is not null
     and not exists (
       select 1
       from departments
       where department_id = v_department_id
     ) then
    raise exception 'Course department not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from courses
    where upper(code) = v_code
      and (p_course_id is null or course_id <> p_course_id)
      and (
        p_course_id is null
        or (select upper(code) from courses where course_id = p_course_id) is distinct from v_code
      )
  ) then
    raise exception 'A course with this code already exists.' using errcode = '23505';
  end if;

  if p_course_id is null then
    insert into courses (
      code,
      name,
      active,
      active_terms,
      activation_mode,
      department_fk,
      ecosystem_fk,
      routing_kind,
      marketplace_phase_override,
      marketplace_phase_override_reason,
      marketplace_phase_override_updated_by_fk,
      marketplace_phase_override_updated_at,
      requires_project_support
    )
    values (
      v_code,
      v_name,
      false,
      v_active_terms,
      v_activation_mode,
      v_department_id,
      v_ecosystem_id,
      v_routing_kind,
      v_phase_override,
      case when v_phase_override is null then null else v_phase_override_reason end,
      case when v_phase_override is null then null else v_actor.user_id end,
      case when v_phase_override is null then null else now() end,
      v_requires_project_support
    )
    returning * into v_course;
    v_action := 'course_created';
  else
    select *
      into v_course
    from courses
    where course_id = p_course_id
    for update;

    if not found then
      raise exception 'Course not found.' using errcode = 'P0002';
    end if;

    if lower(coalesce(v_course.activation_mode, 'auto')) <> 'force_inactive'
       and v_activation_mode = 'force_inactive'
       and v_reason is null then
      raise exception 'Forcing a course inactive requires an audit reason.'
        using errcode = '23514';
    end if;

    if v_course.active is true
       and watmatch_course_should_be_active(v_active_terms, v_activation_mode, p_course_id) is false
       and exists (
         select 1
         from capstones
         where course_fk = p_course_id
           and archived is false
           and status = 'pending_review'
       ) then
      raise exception 'Cannot deactivate a course with pending capstone reviews.'
        using errcode = '23514';
    end if;

    update courses
    set code = v_code,
        name = v_name,
        active_terms = v_active_terms,
        activation_mode = v_activation_mode,
        department_fk = v_department_id,
        ecosystem_fk = v_ecosystem_id,
        routing_kind = v_routing_kind,
        marketplace_phase_override = v_phase_override,
        marketplace_phase_override_reason = case when v_phase_override is null then null else v_phase_override_reason end,
        marketplace_phase_override_updated_by_fk = case
          when v_course.marketplace_phase_override is distinct from v_phase_override
            or v_course.marketplace_phase_override_reason is distinct from case when v_phase_override is null then null else v_phase_override_reason end
          then v_actor.user_id
          else marketplace_phase_override_updated_by_fk
        end,
        marketplace_phase_override_updated_at = case
          when v_course.marketplace_phase_override is distinct from v_phase_override
            or v_course.marketplace_phase_override_reason is distinct from case when v_phase_override is null then null else v_phase_override_reason end
          then now()
          else marketplace_phase_override_updated_at
        end,
        requires_project_support = v_requires_project_support
    where course_id = p_course_id
    returning * into v_course;

    v_action := 'course_updated';
  end if;

  v_course := watmatch_sync_single_course_activation(v_course.course_id);

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    v_action,
    'course',
    v_course.course_id::text,
    v_reason,
    jsonb_build_object(
      'code', v_course.code,
      'name', v_course.name,
      'active', v_course.active,
      'active_terms', v_course.active_terms,
      'activation_mode', v_course.activation_mode,
      'department_id', v_course.department_fk,
      'ecosystem_id', v_course.ecosystem_fk,
      'routing_kind', v_course.routing_kind,
      'marketplace_phase_override', v_course.marketplace_phase_override,
      'marketplace_phase_override_reason', v_course.marketplace_phase_override_reason,
      'requires_project_support', v_course.requires_project_support
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_course_id is null then 'Course created.' else 'Course updated.' end,
    'data', to_jsonb(v_course)
  );
end;
$$;

drop function if exists watmatch_admin_upsert_course_offering(
  bigint,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  boolean,
  text,
  text,
  text,
  bigint[],
  bigint,
  text
);

create or replace function watmatch_admin_upsert_course_offering(
  p_course_offering_id bigint,
  p_course_id bigint,
  p_term text,
  p_title_override text,
  p_description text,
  p_topic text,
  p_section_label text,
  p_status text,
  p_routing_kind_override text,
  p_ecosystem_id bigint,
  p_requires_project_support boolean,
  p_student_registration_notes text,
  p_admin_routing_notes text,
  p_source_url text,
  p_held_with_course_ids bigint[] default '{}'::bigint[],
  p_actor_id bigint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_course courses%rowtype;
  v_offering course_offerings%rowtype;
  v_existing course_offerings%rowtype;
  v_term text := nullif(btrim(coalesce(p_term, '')), '');
  v_title_override text := nullif(btrim(coalesce(p_title_override, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_topic text := nullif(btrim(coalesce(p_topic, '')), '');
  v_section_label text := nullif(btrim(coalesce(p_section_label, '')), '');
  v_status text := lower(coalesce(nullif(btrim(p_status), ''), 'draft'));
  v_routing_kind_override text := lower(nullif(btrim(coalesce(p_routing_kind_override, '')), ''));
  v_student_registration_notes text := nullif(btrim(coalesce(p_student_registration_notes, '')), '');
  v_admin_routing_notes text := nullif(btrim(coalesce(p_admin_routing_notes, '')), '');
  v_source_url text := nullif(btrim(coalesce(p_source_url, '')), '');
  v_held_with_course_ids bigint[] := '{}'::bigint[];
  v_valid_held_count integer := 0;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_action text;
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  select *
    into v_course
  from courses
  where course_id = p_course_id;

  if not found then
    raise exception 'Course not found.' using errcode = '02000';
  end if;

  if v_term is null or v_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    raise exception 'Course offering term must look like Winter 2026, Spring 2026, or Fall 2026.'
      using errcode = '23514';
  end if;

  if v_status not in ('draft', 'active', 'inactive', 'archived') then
    raise exception 'Course offering status must be draft, active, inactive, or archived.'
      using errcode = '23514';
  end if;

  if v_routing_kind_override is not null
     and v_routing_kind_override not in ('standard', 'interdisciplinary') then
    raise exception 'Course offering routing override must be standard or interdisciplinary.'
      using errcode = '23514';
  end if;

  if p_ecosystem_id is not null and not exists (
    select 1
    from project_ecosystems ecosystem
    where ecosystem.ecosystem_id = p_ecosystem_id
  ) then
    raise exception 'Project ecosystem not found.' using errcode = '02000';
  end if;

  select coalesce(array_agg(distinct held_course_id order by held_course_id), '{}'::bigint[])
    into v_held_with_course_ids
  from unnest(coalesce(p_held_with_course_ids, '{}'::bigint[])) held_course_id
  where held_course_id is not null
    and held_course_id <> p_course_id;

  if cardinality(v_held_with_course_ids) > 0 then
    select count(*)::integer
      into v_valid_held_count
    from courses held_course
    where held_course.course_id = any(v_held_with_course_ids);

    if v_valid_held_count <> cardinality(v_held_with_course_ids) then
      raise exception 'One or more held-with courses were not found.' using errcode = '02000';
    end if;
  end if;

  if p_course_offering_id is null then
    insert into course_offerings (
      course_fk,
      term,
      title_override,
      description,
      topic,
      section_label,
      status,
      routing_kind_override,
      ecosystem_fk,
      requires_project_support,
      student_registration_notes,
      admin_routing_notes,
      source_url,
      created_by_fk,
      updated_by_fk,
      created_at,
      updated_at
    )
    values (
      p_course_id,
      v_term,
      v_title_override,
      v_description,
      v_topic,
      v_section_label,
      v_status,
      v_routing_kind_override,
      p_ecosystem_id,
      p_requires_project_support,
      v_student_registration_notes,
      v_admin_routing_notes,
      v_source_url,
      v_actor.user_id,
      v_actor.user_id,
      now(),
      now()
    )
    returning * into v_offering;

    v_action := 'course_offering_created';
  else
    select *
      into v_existing
    from course_offerings
    where course_offering_id = p_course_offering_id;

    if not found then
      raise exception 'Course offering not found.' using errcode = '02000';
    end if;

    update course_offerings
    set course_fk = p_course_id,
        term = v_term,
        title_override = v_title_override,
        description = v_description,
        topic = v_topic,
        section_label = v_section_label,
        status = v_status,
        routing_kind_override = v_routing_kind_override,
        ecosystem_fk = p_ecosystem_id,
        requires_project_support = p_requires_project_support,
        student_registration_notes = v_student_registration_notes,
        admin_routing_notes = v_admin_routing_notes,
        source_url = v_source_url,
        updated_by_fk = v_actor.user_id,
        updated_at = now()
    where course_offering_id = p_course_offering_id
    returning * into v_offering;

    v_action := 'course_offering_updated';
  end if;

  delete from course_offering_held_with
  where course_offering_fk = v_offering.course_offering_id;

  insert into course_offering_held_with (
    course_offering_fk,
    held_with_course_fk,
    held_with_offering_fk,
    notes
  )
  select
    v_offering.course_offering_id,
    held_course_id,
    held_offering.course_offering_id,
    null
  from unnest(v_held_with_course_ids) held_course_id
  left join lateral (
    select sibling.course_offering_id
    from course_offerings sibling
    where sibling.course_fk = held_course_id
      and sibling.term = v_term
      and sibling.status <> 'archived'
    order by
      case sibling.status
        when 'active' then 0
        when 'draft' then 1
        when 'inactive' then 2
        else 3
      end,
      sibling.updated_at desc nulls last,
      sibling.course_offering_id desc
    limit 1
  ) held_offering on true;

  perform watmatch_sync_single_course_activation(p_course_id);

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    v_action,
    'course_offering',
    v_offering.course_offering_id::text,
    v_reason,
    jsonb_build_object(
      'course_id', v_offering.course_fk,
      'course_code', v_course.code,
      'term', v_offering.term,
      'status', v_offering.status,
      'topic', v_offering.topic,
      'routing_kind_override', v_offering.routing_kind_override,
      'ecosystem_id', v_offering.ecosystem_fk,
      'requires_project_support', v_offering.requires_project_support,
      'held_with_course_ids', to_jsonb(v_held_with_course_ids),
      'source_url', v_offering.source_url,
      'manual_registrar_update_required', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_course_offering_id is null then 'Course offering created.' else 'Course offering updated.' end,
    'data', to_jsonb(v_offering)
  );
end;
$$;

drop function if exists watmatch_admin_clone_course_offerings(text, text, text, boolean, bigint, text);

create or replace function watmatch_admin_clone_course_offerings(
  p_source_term text,
  p_target_term text,
  p_target_status text,
  p_overwrite_existing boolean,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_source_term text := nullif(btrim(coalesce(p_source_term, '')), '');
  v_target_term text := nullif(btrim(coalesce(p_target_term, '')), '');
  v_target_status text := lower(coalesce(nullif(btrim(p_target_status), ''), 'draft'));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_source course_offerings%rowtype;
  v_existing course_offerings%rowtype;
  v_target course_offerings%rowtype;
  v_source_count integer := 0;
  v_created_count integer := 0;
  v_updated_count integer := 0;
  v_skipped_count integer := 0;
  v_unresolved_held_with_count integer := 0;
  v_touched_ids bigint[] := '{}'::bigint[];
  v_skipped jsonb := '[]'::jsonb;
  v_cloned_offerings jsonb := '[]'::jsonb;
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_source_term is null or v_source_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    raise exception 'Source term must look like Winter 2026, Spring 2026, or Fall 2026.'
      using errcode = '23514';
  end if;

  if v_target_term is null or v_target_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    raise exception 'Target term must look like Winter 2026, Spring 2026, or Fall 2026.'
      using errcode = '23514';
  end if;

  if v_source_term = v_target_term then
    raise exception 'Source and target terms must be different.' using errcode = '23514';
  end if;

  if v_target_status not in ('draft', 'active', 'inactive') then
    raise exception 'Cloned offerings can be created as draft, active, or inactive.'
      using errcode = '23514';
  end if;

  select count(*)::integer
    into v_source_count
  from course_offerings
  where term = v_source_term
    and status <> 'archived';

  for v_source in
    select *
    from course_offerings
    where term = v_source_term
      and status <> 'archived'
    order by course_fk, coalesce(section_label, ''), course_offering_id
  loop
    select *
      into v_existing
    from course_offerings target
    where target.course_fk = v_source.course_fk
      and target.term = v_target_term
      and coalesce(target.section_label, '') = coalesce(v_source.section_label, '')
    order by
      case target.status
        when 'active' then 0
        when 'draft' then 1
        when 'inactive' then 2
        when 'archived' then 3
        else 4
      end,
      target.updated_at desc nulls last,
      target.course_offering_id desc
    limit 1
    for update;

    if v_existing.course_offering_id is not null
       and coalesce(p_overwrite_existing, false) is not true then
      v_skipped_count := v_skipped_count + 1;
      v_skipped := v_skipped || jsonb_build_array(
        jsonb_build_object(
          'source_offering_id', v_source.course_offering_id,
          'existing_offering_id', v_existing.course_offering_id,
          'course_id', v_source.course_fk,
          'section_label', v_source.section_label
        )
      );
      continue;
    end if;

    if v_existing.course_offering_id is not null then
      update course_offerings
      set title_override = v_source.title_override,
          description = v_source.description,
          topic = v_source.topic,
          section_label = v_source.section_label,
          status = v_target_status,
          routing_kind_override = v_source.routing_kind_override,
          ecosystem_fk = v_source.ecosystem_fk,
          requires_project_support = v_source.requires_project_support,
          student_registration_notes = v_source.student_registration_notes,
          admin_routing_notes = v_source.admin_routing_notes,
          source_url = v_source.source_url,
          updated_by_fk = v_actor.user_id,
          updated_at = now()
      where course_offering_id = v_existing.course_offering_id
      returning * into v_target;
      v_updated_count := v_updated_count + 1;
    else
      insert into course_offerings (
        course_fk,
        term,
        title_override,
        description,
        topic,
        section_label,
        status,
        routing_kind_override,
        ecosystem_fk,
        requires_project_support,
        student_registration_notes,
        admin_routing_notes,
        source_url,
        created_by_fk,
        updated_by_fk,
        created_at,
        updated_at
      )
      values (
        v_source.course_fk,
        v_target_term,
        v_source.title_override,
        v_source.description,
        v_source.topic,
        v_source.section_label,
        v_target_status,
        v_source.routing_kind_override,
        v_source.ecosystem_fk,
        v_source.requires_project_support,
        v_source.student_registration_notes,
        v_source.admin_routing_notes,
        v_source.source_url,
        v_actor.user_id,
        v_actor.user_id,
        now(),
        now()
      )
      returning * into v_target;
      v_created_count := v_created_count + 1;
    end if;

    v_touched_ids := array_append(v_touched_ids, v_target.course_offering_id);

    delete from course_offering_held_with
    where course_offering_fk = v_target.course_offering_id;

    insert into course_offering_held_with (
      course_offering_fk,
      held_with_course_fk,
      held_with_offering_fk,
      notes
    )
    select
      v_target.course_offering_id,
      source_held.held_with_course_fk,
      target_held.course_offering_id,
      source_held.notes
    from course_offering_held_with source_held
    left join lateral (
      select sibling.course_offering_id
      from course_offerings sibling
      where sibling.course_fk = source_held.held_with_course_fk
        and sibling.term = v_target_term
        and sibling.status <> 'archived'
      order by
        case sibling.status
          when 'active' then 0
          when 'draft' then 1
          when 'inactive' then 2
          else 3
        end,
        sibling.updated_at desc nulls last,
        sibling.course_offering_id desc
      limit 1
    ) target_held on true
    where source_held.course_offering_fk = v_source.course_offering_id;

    perform watmatch_sync_single_course_activation(v_target.course_fk);
  end loop;

  if cardinality(v_touched_ids) > 0 then
    update course_offering_held_with target_link
    set held_with_offering_fk = resolved.held_with_offering_id
    from (
      select
        link.course_offering_fk,
        link.held_with_course_fk,
        sibling.course_offering_id as held_with_offering_id
      from course_offering_held_with link
      join course_offerings cloned_offering
        on cloned_offering.course_offering_id = link.course_offering_fk
      join lateral (
        select target_sibling.course_offering_id
        from course_offerings target_sibling
        where target_sibling.course_fk = link.held_with_course_fk
          and target_sibling.term = v_target_term
          and target_sibling.status <> 'archived'
        order by
          case target_sibling.status
            when 'active' then 0
            when 'draft' then 1
            when 'inactive' then 2
            else 3
          end,
          target_sibling.updated_at desc nulls last,
          target_sibling.course_offering_id desc
        limit 1
      ) sibling on true
      where cloned_offering.course_offering_id = any(v_touched_ids)
    ) resolved
    where target_link.course_offering_fk = resolved.course_offering_fk
      and target_link.held_with_course_fk = resolved.held_with_course_fk;

    select coalesce(jsonb_agg(to_jsonb(offering) order by offering.course_fk, offering.course_offering_id), '[]'::jsonb)
      into v_cloned_offerings
    from course_offerings offering
    where offering.course_offering_id = any(v_touched_ids);

    select count(*)::integer
      into v_unresolved_held_with_count
    from course_offering_held_with held
    where held.course_offering_fk = any(v_touched_ids)
      and held.held_with_offering_fk is null;
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'course_offerings_cloned',
    'course_offering',
    v_target_term,
    v_reason,
    jsonb_build_object(
      'source_term', v_source_term,
      'target_term', v_target_term,
      'target_status', v_target_status,
      'overwrite_existing', coalesce(p_overwrite_existing, false),
      'source_count', v_source_count,
      'created_count', v_created_count,
      'updated_count', v_updated_count,
      'skipped_count', v_skipped_count,
      'unresolved_held_with_count', v_unresolved_held_with_count,
      'created_or_updated_offering_ids', to_jsonb(v_touched_ids),
      'skipped', v_skipped,
      'manual_registrar_update_required', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', format(
      'Cloned course offerings from %s to %s: %s created, %s updated, %s skipped.',
      v_source_term,
      v_target_term,
      v_created_count,
      v_updated_count,
      v_skipped_count
    ),
    'data', jsonb_build_object(
      'source_term', v_source_term,
      'target_term', v_target_term,
      'target_status', v_target_status,
      'overwrite_existing', coalesce(p_overwrite_existing, false),
      'source_count', v_source_count,
      'created_count', v_created_count,
      'updated_count', v_updated_count,
      'skipped_count', v_skipped_count,
      'unresolved_held_with_count', v_unresolved_held_with_count,
      'created_or_updated_offering_ids', to_jsonb(v_touched_ids),
      'skipped', v_skipped,
      'offerings', v_cloned_offerings
    )
  );
end;
$$;

drop function if exists watmatch_admin_update_project_ecosystem(
  bigint,
  text,
  boolean,
  text,
  text,
  bigint,
  text
);

create or replace function watmatch_admin_update_project_ecosystem(
  p_ecosystem_id bigint,
  p_description text,
  p_active boolean,
  p_marketplace_phase_override text,
  p_marketplace_phase_override_reason text,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_ecosystem project_ecosystems%rowtype;
  v_phase_override text := watmatch_normalize_marketplace_phase(p_marketplace_phase_override);
  v_phase_override_reason text := nullif(btrim(coalesce(p_marketplace_phase_override_reason, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_active boolean;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if p_ecosystem_id is null then
    raise exception 'Project ecosystem is required.' using errcode = '22023';
  end if;

  select *
    into v_ecosystem
  from project_ecosystems
  where ecosystem_id = p_ecosystem_id
  for update;

  if not found then
    raise exception 'Project ecosystem not found.' using errcode = 'P0002';
  end if;

  v_active := coalesce(p_active, v_ecosystem.active, true);

  if coalesce(v_ecosystem.active, true) is true
     and v_active is false
     and v_reason is null then
    raise exception 'Project ecosystem deactivation requires an audit reason.'
      using errcode = '23514';
  end if;

  if lower(coalesce(v_ecosystem.name, '')) = 'departmental'
     and v_phase_override is not null then
    raise exception 'The Departmental ecosystem uses standard course overrides instead of an ecosystem override.'
      using errcode = '23514';
  end if;

  if v_active is not true then
    v_phase_override := null;
    v_phase_override_reason := null;
  end if;

  if v_phase_override is not null and v_phase_override_reason is null then
    raise exception 'An ecosystem marketplace phase override requires an audit reason.' using errcode = '23514';
  end if;

  update project_ecosystems
  set description = v_description,
      active = v_active,
      marketplace_phase_override = v_phase_override,
      marketplace_phase_override_reason = case when v_phase_override is null then null else v_phase_override_reason end,
      marketplace_phase_override_updated_by_fk = case
        when v_ecosystem.marketplace_phase_override is distinct from v_phase_override
          or v_ecosystem.marketplace_phase_override_reason is distinct from case when v_phase_override is null then null else v_phase_override_reason end
        then v_actor.user_id
        else marketplace_phase_override_updated_by_fk
      end,
      marketplace_phase_override_updated_at = case
        when v_ecosystem.marketplace_phase_override is distinct from v_phase_override
          or v_ecosystem.marketplace_phase_override_reason is distinct from case when v_phase_override is null then null else v_phase_override_reason end
        then now()
        else marketplace_phase_override_updated_at
      end,
      updated_at = now()
  where ecosystem_id = p_ecosystem_id
  returning * into v_ecosystem;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'project_ecosystem_updated',
    'project_ecosystem',
    v_ecosystem.ecosystem_id::text,
    v_reason,
    to_jsonb(v_ecosystem)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Project ecosystem updated.',
    'data', to_jsonb(v_ecosystem)
  );
end;
$$;

drop function if exists watmatch_admin_upsert_course_pipeline_edge(
  bigint,
  bigint,
  bigint,
  boolean,
  boolean,
  text,
  bigint,
  text
);

create or replace function watmatch_admin_upsert_course_pipeline_edge(
  p_edge_id bigint,
  p_from_course_id bigint,
  p_to_course_id bigint,
  p_active boolean,
  p_is_default boolean,
  p_notes text,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_edge course_pipeline_edges%rowtype;
  v_active boolean := coalesce(p_active, true);
  v_is_default boolean := coalesce(p_is_default, false);
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_action text;
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if p_from_course_id is null or p_to_course_id is null then
    raise exception 'Source and target courses are required.' using errcode = '22023';
  end if;

  if not exists (select 1 from courses where course_id = p_from_course_id) then
    raise exception 'Source course not found.' using errcode = 'P0002';
  end if;

  if not exists (select 1 from courses where course_id = p_to_course_id) then
    raise exception 'Target course not found.' using errcode = 'P0002';
  end if;

  if v_active is false then
    v_is_default := false;
  end if;

  if v_is_default is true then
    update course_pipeline_edges
    set is_default = false,
        updated_at = now()
    where from_course_fk = p_from_course_id
      and (p_edge_id is null or course_pipeline_edge_id <> p_edge_id);
  end if;

  if p_edge_id is null then
    insert into course_pipeline_edges (
      from_course_fk,
      to_course_fk,
      active,
      is_default,
      notes,
      updated_at
    )
    values (
      p_from_course_id,
      p_to_course_id,
      v_active,
      v_is_default,
      v_notes,
      now()
    )
    on conflict (from_course_fk, to_course_fk) do update
      set active = excluded.active,
          is_default = excluded.is_default,
          notes = excluded.notes,
          updated_at = now()
    returning * into v_edge;

    v_action := 'course_pipeline_edge_upserted';
  else
    select *
      into v_edge
    from course_pipeline_edges
    where course_pipeline_edge_id = p_edge_id
    for update;

    if not found then
      raise exception 'Course pipeline edge not found.' using errcode = 'P0002';
    end if;

    if v_is_default is true
       and v_edge.from_course_fk is distinct from p_from_course_id then
      update course_pipeline_edges
      set is_default = false,
          updated_at = now()
      where from_course_fk = p_from_course_id
        and course_pipeline_edge_id <> p_edge_id;
    end if;

    update course_pipeline_edges
    set from_course_fk = p_from_course_id,
        to_course_fk = p_to_course_id,
        active = v_active,
        is_default = v_is_default,
        notes = v_notes,
        updated_at = now()
    where course_pipeline_edge_id = p_edge_id
    returning * into v_edge;

    v_action := 'course_pipeline_edge_updated';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    v_action,
    'course_pipeline_edge',
    v_edge.course_pipeline_edge_id::text,
    coalesce(v_reason, 'admin_course_pipeline_management'),
    to_jsonb(v_edge)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Course pipeline edge saved.',
    'data', to_jsonb(v_edge)
  );
end;
$$;

drop function if exists watmatch_admin_upsert_department(bigint, text, boolean, bigint, text);

create or replace function watmatch_admin_upsert_department(
  p_department_id bigint,
  p_name text,
  p_active boolean,
  p_actor_id bigint,
  p_reason text default null,
  p_faculty_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_department departments%rowtype;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_active boolean := coalesce(p_active, true);
  v_existing_active boolean;
  v_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_name is null then
    raise exception 'Department name is required.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from departments
    where lower(name) = lower(v_name)
      and (p_department_id is null or department_id <> p_department_id)
  ) then
    raise exception 'A department with this name already exists.' using errcode = '23505';
  end if;

  if p_faculty_id is not null and not exists (
    select 1
    from faculties
    where faculty_id = p_faculty_id
      and active is true
  ) then
    raise exception 'Faculty not found or inactive.' using errcode = 'P0002';
  end if;

  if p_department_id is null then
    insert into departments (name, faculty_fk, active, updated_at)
    values (v_name, p_faculty_id, v_active, now())
    returning * into v_department;
    v_action := 'department_created';
  else
    select active
    into v_existing_active
    from departments
    where department_id = p_department_id;

    if not found then
      raise exception 'Department not found.' using errcode = 'P0002';
    end if;

    if v_existing_active is true and v_active is false and v_reason is null then
      raise exception 'A reason is required to deactivate a department.' using errcode = '22023';
    end if;

    update departments
    set name = v_name,
        faculty_fk = p_faculty_id,
        active = v_active,
        updated_at = now()
    where department_id = p_department_id
    returning * into v_department;

    if not found then
      raise exception 'Department not found.' using errcode = 'P0002';
    end if;
    v_action := 'department_updated';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    v_action,
    'department',
    v_department.department_id::text,
    v_reason,
    jsonb_build_object(
      'name', v_department.name,
      'faculty_fk', v_department.faculty_fk,
      'active', v_department.active
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_department_id is null then 'Department created.' else 'Department updated.' end,
    'data', to_jsonb(v_department)
  );
end;
$$;

drop function if exists watmatch_admin_upsert_skill(
  bigint,
  text,
  boolean,
  bigint,
  text
);

create or replace function watmatch_admin_upsert_skill(
  p_skill_id bigint,
  p_name text,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_skill skills%rowtype;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_action text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_name is null then
    raise exception 'Skill name is required.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from skills
    where lower(name) = lower(v_name)
      and (p_skill_id is null or skill_id <> p_skill_id)
  ) then
    raise exception 'A skill with this name already exists.' using errcode = '23505';
  end if;

  if p_skill_id is null then
    insert into skills (name, updated_at)
    values (v_name, now())
    returning * into v_skill;
    v_action := 'skill_created';
  else
    update skills
    set name = v_name,
        updated_at = now()
    where skill_id = p_skill_id
    returning * into v_skill;

    if not found then
      raise exception 'Skill not found.' using errcode = 'P0002';
    end if;
    v_action := 'skill_updated';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    v_action,
    'skill',
    v_skill.skill_id::text,
    v_reason,
    jsonb_build_object('name', v_skill.name)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_skill_id is null then 'Skill created.' else 'Skill updated.' end,
    'data', to_jsonb(v_skill)
  );
end;
$$;

create or replace function watmatch_admin_upsert_past_capstone(
  p_past_capstone_id bigint,
  p_title text,
  p_description text,
  p_department text,
  p_year text,
  p_students text[],
  p_source_fk bigint,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_departments text[] := watmatch_parse_past_departments(p_department);
  v_year text := nullif(btrim(coalesce(p_year, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_students text[];
  v_past past_capstones%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Past capstone manual changes require an audit reason.' using errcode = '23514';
  end if;

  if v_title is null then
    raise exception 'Past capstone title is required.' using errcode = '22023';
  end if;
  if cardinality(v_departments) = 0 then
    raise exception 'Past capstone department is required.' using errcode = '22023';
  end if;
  if v_year is null then
    raise exception 'Past capstone year is required.' using errcode = '22023';
  end if;

  if p_source_fk is not null and not exists (select 1 from courses where course_id = p_source_fk) then
    raise exception 'Source course not found.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct btrim(student) order by btrim(student)), '{}'::text[])
    into v_students
  from unnest(coalesce(p_students, '{}'::text[])) as raw(student)
  where nullif(btrim(student), '') is not null;

  if p_past_capstone_id is null then
    insert into past_capstones (title, description, department, year, students, source_fk)
    values (v_title, v_description, v_departments, v_year, coalesce(v_students, '{}'::text[]), p_source_fk)
    returning * into v_past;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      v_actor.user_id,
      v_actor.role,
      'past_capstone_created',
      'past_capstone',
      v_past.past_capstone_id::text,
      v_reason,
      jsonb_build_object('title', v_title, 'department', v_departments, 'year', v_year)
    );
  else
    update past_capstones
    set title = v_title,
        description = v_description,
        department = v_departments,
        year = v_year,
        students = coalesce(v_students, '{}'::text[]),
        source_fk = p_source_fk
    where past_capstone_id = p_past_capstone_id
    returning * into v_past;

    if not found then
      raise exception 'Past capstone not found.' using errcode = 'P0002';
    end if;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      v_actor.user_id,
      v_actor.role,
      'past_capstone_updated',
      'past_capstone',
      v_past.past_capstone_id::text,
      v_reason,
      jsonb_build_object('title', v_title, 'department', v_departments, 'year', v_year)
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Past capstone saved.',
    'data', to_jsonb(v_past)
  );
end;
$$;

create or replace function watmatch_admin_delete_past_capstone(
  p_past_capstone_id bigint,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_past past_capstones%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_reason is null then
    raise exception 'Past capstone deletion requires an audit reason.' using errcode = '23514';
  end if;

  if p_past_capstone_id is null then
    raise exception 'Invalid past capstone identity.' using errcode = '22023';
  end if;

  delete from past_capstones
  where past_capstone_id = p_past_capstone_id
  returning * into v_past;

  if not found then
    raise exception 'Past capstone not found.' using errcode = 'P0002';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'past_capstone_deleted',
    'past_capstone',
    p_past_capstone_id::text,
    v_reason,
    jsonb_build_object('title', v_past.title, 'department', v_past.department, 'year', v_past.year)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Past capstone deleted.',
    'data', to_jsonb(v_past)
  );
end;
$$;

-- Transactional empty-team creation RPC.
create or replace function watmatch_create_empty_team(
  p_leader_id bigint,
  p_course_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_effective_course bigint;
  v_team teams%rowtype;
begin
  if p_leader_id is null then
    raise exception 'Invalid leader ID.' using errcode = '22023';
  end if;

  select *
    into v_user
  from users
  where user_id = p_leader_id
  for update;

  if not found then
    raise exception 'User with ID % not found.', p_leader_id using errcode = 'P0002';
  end if;

  if lower(coalesce(v_user.role, '')) <> 'student' then
    raise exception 'Only students can create teams.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from team_memberships
    where user_fk = p_leader_id
  ) then
    raise exception 'You are already part of a team and cannot create another one.'
      using errcode = '23514';
  end if;

  v_effective_course := v_user.course_fk;
  if v_effective_course is null then
    raise exception 'Your account must be assigned to a course before creating a team.' using errcode = '23514';
  end if;

  if p_course_id is not null and p_course_id <> v_effective_course then
    raise exception 'Submitted course does not match your assigned course.' using errcode = '23514';
  end if;

  insert into teams (leader_fk, capstone_fk, course_fk, status)
  values (null, null, v_effective_course, 'forming')
  returning * into v_team;

  perform watmatch_claim_team_membership(v_team.team_id, p_leader_id, true);

  update teams
  set leader_fk = p_leader_id
  where team_id = v_team.team_id
  returning * into v_team;

  return jsonb_build_object(
    'success', true,
    'message', 'Team created successfully',
    'data', to_jsonb(v_team)
  );
end;
$$;

create or replace function watmatch_privileged_create_team(
  p_student_ids bigint[],
  p_leader_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor_course bigint;
  v_student_ids bigint[];
  v_student_count integer := 0;
  v_student_id bigint;
  v_leader users%rowtype;
  v_team teams%rowtype;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor') then
    raise exception 'Forbidden. Only instructors/admins can create managed teams.'
      using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Managed team creation requires an audit reason.' using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct student_id order by student_id), '{}'::bigint[])
    into v_student_ids
  from unnest(coalesce(p_student_ids, '{}'::bigint[])) as selected(student_id)
  where student_id is not null;

  if coalesce(array_length(v_student_ids, 1), 0) = 0 then
    raise exception 'At least one student must be assigned to create a team.'
      using errcode = '22023';
  end if;

  if p_leader_id is null or not (p_leader_id = any(v_student_ids)) then
    raise exception 'Leader must be one of the selected students.'
      using errcode = '22023';
  end if;

  if v_role = 'instructor' then
    select course_fk
      into v_actor_course
    from users
    where user_id = p_actor_id;

    if v_actor_course is null then
      raise exception 'Instructor must be assigned to a course.'
        using errcode = '23514';
    end if;
  end if;

  perform 1
  from users
  where user_id = any(v_student_ids)
  order by user_id
  for update;

  select count(*)
    into v_student_count
  from users
  where user_id = any(v_student_ids);

  if v_student_count <> coalesce(array_length(v_student_ids, 1), 0) then
    raise exception 'One or more selected students were not found.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from users
    where user_id = any(v_student_ids)
      and lower(coalesce(role, '')) <> 'student'
  ) then
    raise exception 'Only student users can be assigned to teams.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from users
    where user_id = any(v_student_ids)
      and course_fk is null
  ) then
    raise exception 'Every selected student must be assigned to a course before joining a team.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from team_memberships
    where user_fk = any(v_student_ids)
  ) then
    raise exception 'One or more selected students are already enrolled in an active team.'
      using errcode = '23505';
  end if;

  select *
    into v_leader
  from users
  where user_id = p_leader_id;

  if not found then
    raise exception 'Leader not found.' using errcode = 'P0002';
  end if;

  if v_role = 'instructor' and v_leader.course_fk is distinct from v_actor_course then
    raise exception 'Instructor-created teams must have a leader from the instructor''s course.'
      using errcode = '42501';
  end if;

  insert into teams (leader_fk, capstone_fk, course_fk, status)
  values (null, null, v_leader.course_fk, 'forming')
  returning * into v_team;

  foreach v_student_id in array v_student_ids
  loop
    perform watmatch_claim_team_membership(
      v_team.team_id,
      v_student_id,
      v_student_id = p_leader_id,
      null,
      p_actor_id,
      coalesce(v_reason, 'Managed team enrollment routed.')
    );
  end loop;

  update teams
  set leader_fk = p_leader_id
  where team_id = v_team.team_id
  returning * into v_team;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'team_created_by_privileged_user',
    'team',
    v_team.team_id::text,
    v_reason,
    jsonb_build_object(
      'leader_id', p_leader_id,
      'student_ids', to_jsonb(v_student_ids),
      'course_fk', v_team.course_fk
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Team created and students assigned successfully.',
    'data', to_jsonb(v_team)
  );
end;
$$;

drop function if exists watmatch_get_audit_log(bigint, text, bigint, bigint, text, text, bigint, integer);
drop function if exists watmatch_get_audit_log(bigint, text, bigint, bigint, text, text, text, bigint, integer);
drop function if exists watmatch_get_audit_log(bigint, text, bigint, bigint, text, text, text, text, bigint, integer);

create or replace function watmatch_get_audit_log(
  p_actor_id bigint,
  p_actor_role text,
  p_course_id bigint default null,
  p_team_id bigint default null,
  p_context_search text default null,
  p_entity_type text default null,
  p_action text default null,
  p_actor_search text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor users%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_course_id bigint := p_course_id;
  v_team_id bigint := p_team_id;
  v_context_search text := nullif(lower(btrim(coalesce(p_context_search, ''))), '');
  v_entity_type text := nullif(lower(btrim(coalesce(p_entity_type, ''))), '');
  v_action text := nullif(btrim(coalesce(p_action, '')), '');
  v_actor_search text := nullif(lower(btrim(coalesce(p_actor_search, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 1000);
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_entity_types jsonb := '[]'::jsonb;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  select *
    into v_actor
  from users
  where user_id = p_actor_id;

  if not found or v_role <> lower(coalesce(v_actor.role, '')) then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor') then
    raise exception 'Instructor/admin access required.' using errcode = '42501';
  end if;

  if v_course_id is not null
     and not exists (select 1 from courses where course_id = v_course_id) then
    raise exception 'Course not found.' using errcode = 'P0002';
  end if;

  if v_team_id is not null
     and not exists (select 1 from teams where team_id = v_team_id) then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

  with distinct_actions as (
    select distinct action
    from audit_log
    where nullif(btrim(action), '') is not null
  )
  select coalesce(jsonb_agg(action order by action), '[]'::jsonb)
    into v_actions
  from distinct_actions;

  with distinct_entity_types as (
    select distinct entity_type
    from audit_log
    where nullif(btrim(entity_type), '') is not null
  )
  select coalesce(jsonb_agg(entity_type order by entity_type), '[]'::jsonb)
    into v_entity_types
  from distinct_entity_types;

  with audit_base as (
    select
      a.*,
      watmatch_try_bigint(a.entity_id) as entity_pk,
      coalesce(
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'team_fk'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'team_id')
      ) as metadata_team_id,
      coalesce(
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'capstone_id'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'capstone_fk'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'approved_capstone_id')
      ) as metadata_capstone_id,
      coalesce(
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'course_fk'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'new_course_fk'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'old_course_fk'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) #>> '{new,course_fk}'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) #>> '{old,course_fk}'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'source_fk')
      ) as metadata_course_id,
      coalesce(
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'student_id'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'leader_id'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'new_leader_id'),
        watmatch_try_bigint(coalesce(a.metadata, '{}'::jsonb) ->> 'partner_user_fk')
      ) as metadata_user_id
    from audit_log a
    left join users audit_actor
      on audit_actor.user_id = a.actor_fk
    where (v_entity_type is null or lower(a.entity_type) = v_entity_type)
      and (v_action is null or a.action = v_action)
      and (
        v_actor_search is null
        or lower(coalesce(audit_actor.email, '')) like '%' || v_actor_search || '%'
        or lower(split_part(coalesce(audit_actor.email, ''), '@', 1)) like '%' || v_actor_search || '%'
      )
  ),
  context_seed as (
    select
      b.*,
      coalesce(
        case when lower(b.entity_type) = 'team' then b.entity_pk end,
        b.metadata_team_id,
        cap_entity.team_fk,
        cap_meta.team_fk
      ) as context_team_id,
      coalesce(
        case when lower(b.entity_type) = 'capstone' then b.entity_pk end,
        b.metadata_capstone_id,
        team_entity.capstone_fk,
        team_meta.capstone_fk
      ) as context_capstone_id,
      case when lower(b.entity_type) = 'course' then b.entity_pk end as entity_course_id,
      coalesce(
        b.metadata_course_id,
        team_entity.course_fk,
        team_meta.course_fk,
        cap_entity.course_fk,
        cap_meta.course_fk
      ) as primary_course_id
    from audit_base b
    left join teams team_entity
      on lower(b.entity_type) = 'team'
     and team_entity.team_id = b.entity_pk
    left join teams team_meta
      on team_meta.team_id = b.metadata_team_id
    left join capstones cap_entity
      on lower(b.entity_type) = 'capstone'
     and cap_entity.capstone_id = b.entity_pk
    left join capstones cap_meta
      on cap_meta.capstone_id = b.metadata_capstone_id
  ),
  contexted as (
    select
      cs.*,
      coalesce(course_context.course_ids, '{}'::bigint[]) as context_course_ids,
      context_capstone.title as context_capstone_title,
      case
        when cs.context_team_id is not null then 'Team ' || cs.context_team_id::text
        else null
      end as context_team_label,
      actor_user.email as actor_email
    from context_seed cs
    left join teams context_team
      on context_team.team_id = cs.context_team_id
    left join capstones context_capstone
      on context_capstone.capstone_id = coalesce(cs.context_capstone_id, context_team.capstone_fk)
    left join users actor_user
      on actor_user.user_id = cs.actor_fk
    left join lateral (
      select array_agg(distinct candidate.course_id order by candidate.course_id) as course_ids
      from (
        values (cs.entity_course_id), (cs.primary_course_id)
        union
        select cca.course_fk
        from capstone_course_approvals cca
        where cca.capstone_fk = cs.context_capstone_id
        union
        select u.course_fk
        from users u
        where lower(cs.entity_type) = 'user'
          and u.user_id = cs.entity_pk
        union
        select u.course_fk
        from users u
        where u.user_id = cs.metadata_user_id
      ) as candidate(course_id)
      where candidate.course_id is not null
    ) course_context on true
  ),
  filtered as (
    select *
    from contexted c
    where (v_team_id is null or c.context_team_id = v_team_id)
      and (v_course_id is null or v_course_id = any(c.context_course_ids))
      and (
        v_context_search is null
        or lower(coalesce(c.context_capstone_title, '')) like '%' || v_context_search || '%'
        or lower(coalesce(c.context_team_label, '')) like '%' || v_context_search || '%'
        or c.context_team_id::text = v_context_search
        or c.context_capstone_id::text = v_context_search
      )
  ),
  counted as (
    select count(*)::integer as total
    from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, audit_id desc
    limit v_limit
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'audit_id', p.audit_id,
            'actor_fk', p.actor_fk,
            'actor_email', p.actor_email,
            'actor_role', p.actor_role,
            'action', p.action,
            'entity_type', p.entity_type,
            'entity_id', p.entity_id,
            'reason', p.reason,
            'metadata', coalesce(p.metadata, '{}'::jsonb),
            'created_at', p.created_at,
            'context', jsonb_build_object(
              'team_id', p.context_team_id,
              'team_label', p.context_team_label,
              'capstone_id', p.context_capstone_id,
              'capstone_title', p.context_capstone_title,
              'course_ids', to_jsonb(p.context_course_ids),
              'courses', coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'course_id', c.course_id,
                      'code', c.code,
                      'name', c.name,
                      'active', c.active,
                      'active_terms', coalesce(to_jsonb(c.active_terms), '[]'::jsonb),
                      'activation_mode', c.activation_mode,
                      'department_id', c.department_fk,
                      'department_fk', c.department_fk,
                      'department', case
                        when d.department_id is null then null
                        else jsonb_build_object(
                          'department_id', d.department_id,
                          'name', d.name,
                          'active', d.active
                      )
                      end,
                      'routing_kind', c.routing_kind
                    )
                    order by c.code, c.course_id
                  )
                  from courses c
                  left join departments d on d.department_id = c.department_fk
                  where c.course_id = any(p.context_course_ids)
                ),
                '[]'::jsonb
              )
            )
          )
          order by p.created_at desc, p.audit_id desc
        )
        from paged p
      ),
      '[]'::jsonb
    )
    into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'limit', v_limit,
    'filters', jsonb_build_object(
      'actions', v_actions,
      'entity_types', v_entity_types
    )
  );
end;
$$;

-- Application RPCs are backend-only. The frontend must never call these
-- functions directly through anon/authenticated Supabase clients.
-- Marketplace exploration workflow
create or replace function watmatch_default_marketplace_term()
returns text
language sql
stable
set search_path = public
as $$
  select case
    when extract(month from current_date)::integer between 1 and 4 then 'Winter ' || extract(year from current_date)::integer::text
    when extract(month from current_date)::integer between 5 and 8 then 'Spring ' || extract(year from current_date)::integer::text
    else 'Fall ' || extract(year from current_date)::integer::text
  end;
$$;

create table if not exists marketplace_settings (
  setting_id smallint primary key default 1,
  current_term text not null default watmatch_default_marketplace_term(),
  phase text not null default 'exploration',
  exploration_starts_at timestamp with time zone,
  commitment_starts_at timestamp with time zone,
  finalization_starts_at timestamp with time zone,
  updated_by_fk bigint references users(user_id) on delete set null,
  updated_at timestamp with time zone default now(),
  constraint marketplace_settings_singleton_check check (setting_id = 1),
  constraint marketplace_settings_phase_check check (phase in ('exploration', 'commitment', 'finalization'))
);

alter table marketplace_settings add column if not exists finalization_starts_at timestamp with time zone;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketplace_settings'
      and column_name = 'locked_starts_at'
  ) then
    execute '
      update marketplace_settings
      set finalization_starts_at = coalesce(finalization_starts_at, locked_starts_at)
    ';
    execute 'alter table marketplace_settings drop column locked_starts_at';
  end if;
end $$;

insert into marketplace_settings (setting_id, current_term, phase)
values (1, watmatch_default_marketplace_term(), 'exploration')
on conflict (setting_id) do nothing;

update marketplace_settings
set current_term = watmatch_default_marketplace_term()
where current_term !~ '^(Winter|Spring|Fall) [0-9]{4}$';

alter table marketplace_settings drop constraint if exists marketplace_settings_phase_check;

update marketplace_settings
set phase = 'finalization'
where phase = 'locked';

alter table marketplace_settings
  alter column current_term set default watmatch_default_marketplace_term();

alter table marketplace_settings drop constraint if exists marketplace_settings_current_term_check;
alter table marketplace_settings
  add constraint marketplace_settings_current_term_check
  check (current_term ~ '^(Winter|Spring|Fall) [0-9]{4}$');

alter table marketplace_settings
  add constraint marketplace_settings_phase_check
  check (phase in ('exploration', 'commitment', 'finalization'));

create table if not exists project_explorations (
  exploration_id bigint generated always as identity primary key,
  capstone_fk bigint not null references capstones(capstone_id) on delete cascade,
  team_fk bigint not null references teams(team_id) on delete cascade,
  student_fk bigint not null references users(user_id) on delete cascade,
  status text not null default 'interested',
  source text not null default 'student_marketplace',
  priority_rank integer,
  message text,
  created_by_fk bigint references users(user_id) on delete set null,
  decided_by_fk bigint references users(user_id) on delete set null,
  decided_at timestamp with time zone,
  student_commitment_confirmed_at timestamp with time zone,
  student_commitment_confirmed_by_fk bigint references users(user_id) on delete set null,
  team_commitment_confirmed_at timestamp with time zone,
  team_commitment_confirmed_by_fk bigint references users(user_id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table project_explorations
  add column if not exists student_commitment_confirmed_at timestamp with time zone;

alter table project_explorations
  add column if not exists student_commitment_confirmed_by_fk bigint references users(user_id) on delete set null;

alter table project_explorations
  add column if not exists team_commitment_confirmed_at timestamp with time zone;

alter table project_explorations
  add column if not exists team_commitment_confirmed_by_fk bigint references users(user_id) on delete set null;

alter table project_explorations
  alter column source set default 'student_marketplace';

create table if not exists project_commitment_requests (
  commitment_request_id bigint generated always as identity primary key,
  exploration_fk bigint references project_explorations(exploration_id) on delete set null,
  capstone_fk bigint not null references capstones(capstone_id) on delete cascade,
  team_fk bigint not null references teams(team_id) on delete cascade,
  student_fk bigint not null references users(user_id) on delete cascade,
  status text not null default 'pending',
  requested_by_fk bigint references users(user_id) on delete set null,
  decision_route text,
  target_course_fk bigint references courses(course_id) on delete set null,
  comments text,
  decided_by_fk bigint references users(user_id) on delete set null,
  decided_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table marketplace_settings enable row level security;
alter table project_explorations enable row level security;
alter table project_commitment_requests enable row level security;
drop table if exists team_collaborators cascade;

alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('student', 'instructor', 'admin', 'academic_advisor', 'enrollment_operator', 'external_partner', 'mentor'));

alter table project_explorations drop constraint if exists project_explorations_status_check;
alter table project_explorations
  add constraint project_explorations_status_check
  check (status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment', 'withdrawn', 'declined', 'not_selected', 'expired', 'committed'));

alter table project_explorations drop constraint if exists project_explorations_message_len_check;
alter table project_explorations
  add constraint project_explorations_message_len_check
  check (message is null or char_length(message) <= 1000);

alter table project_explorations drop constraint if exists project_explorations_rank_check;
alter table project_explorations
  add constraint project_explorations_rank_check
  check (priority_rank is null or priority_rank between 1 and 99);

update project_explorations
set source = 'student_marketplace'
where source = 'student_interest';

alter table project_commitment_requests drop constraint if exists project_commitment_requests_status_check;
alter table project_commitment_requests
  add constraint project_commitment_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

alter table project_commitment_requests drop constraint if exists project_commitment_requests_route_check;
update project_commitment_requests
set decision_route = 'interdisciplinary'
where decision_route is not null
  and decision_route not in ('course_enrolled', 'interdisciplinary', 'other_course');
alter table project_commitment_requests
  add constraint project_commitment_requests_route_check
  check (
    decision_route is null
    or decision_route in ('course_enrolled', 'interdisciplinary', 'other_course')
  );

alter table project_commitment_requests drop constraint if exists project_commitment_requests_comments_len_check;
alter table project_commitment_requests
  add constraint project_commitment_requests_comments_len_check
  check (comments is null or char_length(comments) <= 2000);

create unique index if not exists idx_project_explorations_capstone_student_unique
  on project_explorations(capstone_fk, student_fk);

create index if not exists idx_project_explorations_student_status
  on project_explorations(student_fk, status, updated_at desc);

create index if not exists idx_project_explorations_team_status
  on project_explorations(team_fk, status, updated_at desc);

create unique index if not exists idx_project_commitment_requests_one_pending_per_student
  on project_commitment_requests(student_fk)
  where status = 'pending';

create index if not exists idx_project_commitment_requests_status_created
  on project_commitment_requests(status, created_at desc);

create index if not exists idx_project_commitment_requests_team_status
  on project_commitment_requests(team_fk, status, created_at desc);

create or replace function watmatch_clear_team_commitment_roster_if_idle(
  p_team_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_team_id is null then
    return;
  end if;

  update teams t
  set commitment_roster_confirmed_at = null,
      commitment_roster_confirmed_by_fk = null,
      commitment_roster_note = null
  where t.team_id = p_team_id
    and (
      t.commitment_roster_confirmed_at is not null
      or t.commitment_roster_confirmed_by_fk is not null
      or t.commitment_roster_note is not null
    )
    and not exists (
      select 1
      from project_commitment_requests pcr
      where pcr.team_fk = t.team_id
        and pcr.status = 'pending'
    )
    and not exists (
      select 1
      from project_explorations pe
      where pe.team_fk = t.team_id
        and pe.status in ('exploring', 'pending_commitment')
        and (
          pe.student_commitment_confirmed_at is not null
          or pe.team_commitment_confirmed_at is not null
        )
    );
end;
$$;

select watmatch_sync_course_activation_for_current_term(null, 'schema_marketplace_term_sync');

update project_explorations pe
set status = 'pending_commitment',
    student_commitment_confirmed_at = coalesce(pe.student_commitment_confirmed_at, pcr.created_at, now()),
    student_commitment_confirmed_by_fk = coalesce(pe.student_commitment_confirmed_by_fk, pcr.requested_by_fk),
    team_commitment_confirmed_at = coalesce(pe.team_commitment_confirmed_at, pcr.created_at, now()),
    team_commitment_confirmed_by_fk = coalesce(pe.team_commitment_confirmed_by_fk, pcr.requested_by_fk),
    updated_at = now()
from project_commitment_requests pcr
where pcr.exploration_fk = pe.exploration_id
  and pcr.status = 'pending'
  and pe.status = 'committed';

create or replace function watmatch_marketplace_settings_json()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings marketplace_settings%rowtype;
begin
  select *
    into v_settings
  from marketplace_settings
  where setting_id = 1;

  if not found then
    insert into marketplace_settings (setting_id, current_term, phase)
    values (1, watmatch_default_marketplace_term(), 'exploration')
    returning * into v_settings;
  end if;

  return jsonb_build_object(
    'setting_id', v_settings.setting_id,
    'current_term', v_settings.current_term,
    'current_season', watmatch_season_from_term(v_settings.current_term),
    'phase', v_settings.phase,
    'exploration_starts_at', v_settings.exploration_starts_at,
    'commitment_starts_at', v_settings.commitment_starts_at,
    'finalization_starts_at', v_settings.finalization_starts_at,
    'updated_by_fk', v_settings.updated_by_fk,
    'updated_at', v_settings.updated_at,
    'can_shortlist', v_settings.phase = 'exploration',
    'can_express_interest', v_settings.phase = 'exploration',
    'can_invite', v_settings.phase = 'exploration',
    'can_commit', v_settings.phase in ('exploration', 'commitment'),
    'can_student_abandon_solo_project', v_settings.phase in ('exploration', 'commitment')
  );
end;
$$;

create or replace function watmatch_current_marketplace_phase()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase text;
begin
  select phase
    into v_phase
  from marketplace_settings
  where setting_id = 1;

  return coalesce(v_phase, 'exploration');
end;
$$;

create or replace function watmatch_normalize_marketplace_phase(p_phase text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_phase text := lower(nullif(btrim(coalesce(p_phase, '')), ''));
begin
  if v_phase is null then
    return null;
  end if;

  if v_phase = 'locked' then
    return 'finalization';
  end if;

  if v_phase not in ('exploration', 'commitment', 'finalization') then
    raise exception 'Marketplace phase must be exploration, commitment, or finalization.' using errcode = '23514';
  end if;

  return v_phase;
end;
$$;

create or replace function watmatch_effective_marketplace_phase_for_ecosystem(p_ecosystem_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global_phase text := watmatch_current_marketplace_phase();
  v_ecosystem project_ecosystems%rowtype;
begin
  if p_ecosystem_id is null then
    return v_global_phase;
  end if;

  select *
    into v_ecosystem
  from project_ecosystems
  where ecosystem_id = p_ecosystem_id;

  if not found
     or v_ecosystem.active is not true
     or lower(coalesce(v_ecosystem.name, '')) = 'departmental'
     or v_ecosystem.marketplace_phase_override is null then
    return v_global_phase;
  end if;

  return watmatch_normalize_marketplace_phase(v_ecosystem.marketplace_phase_override);
end;
$$;

create or replace function watmatch_effective_marketplace_phase_for_course(p_course_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global_phase text := watmatch_current_marketplace_phase();
  v_course courses%rowtype;
begin
  if p_course_id is null then
    return v_global_phase;
  end if;

  select *
    into v_course
  from courses
  where course_id = p_course_id;

  if not found then
    return v_global_phase;
  end if;

  if coalesce(v_course.routing_kind, 'standard') = 'interdisciplinary' then
    return watmatch_effective_marketplace_phase_for_ecosystem(v_course.ecosystem_fk);
  end if;

  if v_course.marketplace_phase_override is null then
    return v_global_phase;
  end if;

  return watmatch_normalize_marketplace_phase(v_course.marketplace_phase_override);
end;
$$;

create or replace function watmatch_effective_marketplace_phase_for_capstone(p_capstone_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global_phase text := watmatch_current_marketplace_phase();
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_course_fk bigint;
begin
  if p_capstone_id is null then
    return v_global_phase;
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found then
    return v_global_phase;
  end if;

  if v_capstone.team_fk is not null then
    select *
      into v_team
    from teams
    where team_id = v_capstone.team_fk;
  end if;

  v_course_fk := watmatch_target_course_fk(v_capstone.capstone_id, v_team.team_id);
  if v_course_fk is null then
    v_course_fk := v_capstone.course_fk;
  end if;

  if v_course_fk is not null then
    return watmatch_effective_marketplace_phase_for_course(v_course_fk);
  end if;

  if v_capstone.ecosystem_fk is not null then
    return watmatch_effective_marketplace_phase_for_ecosystem(v_capstone.ecosystem_fk);
  end if;

  return v_global_phase;
end;
$$;

create or replace function watmatch_effective_marketplace_phase_for_team(p_team_id bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global_phase text := watmatch_current_marketplace_phase();
  v_team teams%rowtype;
begin
  if p_team_id is null then
    return v_global_phase;
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id;

  if not found then
    return v_global_phase;
  end if;

  if v_team.capstone_fk is not null then
    return watmatch_effective_marketplace_phase_for_capstone(v_team.capstone_fk);
  end if;

  return watmatch_effective_marketplace_phase_for_course(v_team.course_fk);
end;
$$;

create or replace function watmatch_marketplace_phase_context_for_course(p_course_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global_phase text := watmatch_current_marketplace_phase();
  v_effective_phase text := v_global_phase;
  v_course courses%rowtype;
  v_ecosystem project_ecosystems%rowtype;
  v_source text := 'global';
begin
  if p_course_id is not null then
    select *
      into v_course
    from courses
    where course_id = p_course_id;

    if found then
      if coalesce(v_course.routing_kind, 'standard') = 'interdisciplinary' then
        select *
          into v_ecosystem
        from project_ecosystems
        where ecosystem_id = v_course.ecosystem_fk;

        if found
           and v_ecosystem.active is true
           and lower(coalesce(v_ecosystem.name, '')) <> 'departmental'
           and v_ecosystem.marketplace_phase_override is not null then
          v_effective_phase := watmatch_normalize_marketplace_phase(v_ecosystem.marketplace_phase_override);
          v_source := 'ecosystem';
        end if;
      elsif v_course.marketplace_phase_override is not null then
        v_effective_phase := watmatch_normalize_marketplace_phase(v_course.marketplace_phase_override);
        v_source := 'course';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'global_phase', v_global_phase,
    'effective_phase', v_effective_phase,
    'override_source', v_source,
    'course_id', case when v_source = 'course' then p_course_id else null end,
    'ecosystem_id', case when v_source = 'ecosystem' then v_ecosystem.ecosystem_id else null end,
    'reason', case
      when v_source = 'course' then v_course.marketplace_phase_override_reason
      when v_source = 'ecosystem' then v_ecosystem.marketplace_phase_override_reason
      else null
    end,
    'updated_by_fk', case
      when v_source = 'course' then v_course.marketplace_phase_override_updated_by_fk
      when v_source = 'ecosystem' then v_ecosystem.marketplace_phase_override_updated_by_fk
      else null
    end,
    'updated_at', case
      when v_source = 'course' then v_course.marketplace_phase_override_updated_at
      when v_source = 'ecosystem' then v_ecosystem.marketplace_phase_override_updated_at
      else null
    end
  );
end;
$$;

create or replace function watmatch_marketplace_phase_context_for_capstone(p_capstone_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_global_phase text := watmatch_current_marketplace_phase();
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_course_fk bigint;
begin
  if p_capstone_id is null then
    return jsonb_build_object(
      'global_phase', v_global_phase,
      'effective_phase', v_global_phase,
      'override_source', 'global',
      'course_id', null,
      'ecosystem_id', null,
      'reason', null,
      'updated_by_fk', null,
      'updated_at', null
    );
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found then
    return jsonb_build_object(
      'global_phase', v_global_phase,
      'effective_phase', v_global_phase,
      'override_source', 'global',
      'course_id', null,
      'ecosystem_id', null,
      'reason', null,
      'updated_by_fk', null,
      'updated_at', null
    );
  end if;

  if v_capstone.team_fk is not null then
    select *
      into v_team
    from teams
    where team_id = v_capstone.team_fk;
  end if;

  v_course_fk := watmatch_target_course_fk(v_capstone.capstone_id, v_team.team_id);
  if v_course_fk is null then
    v_course_fk := v_capstone.course_fk;
  end if;

  if v_course_fk is not null then
    return watmatch_marketplace_phase_context_for_course(v_course_fk);
  end if;

  if v_capstone.ecosystem_fk is not null then
    return watmatch_marketplace_phase_context_for_ecosystem(v_capstone.ecosystem_fk);
  end if;

  return jsonb_build_object(
    'global_phase', v_global_phase,
    'effective_phase', v_global_phase,
    'override_source', 'global',
    'course_id', null,
    'ecosystem_id', null,
    'reason', null,
    'updated_by_fk', null,
    'updated_at', null
  );
end;
$$;

create or replace function watmatch_actor_can_manage_marketplace_settings(
  p_actor_id bigint,
  p_actor_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('admin', 'enrollment_operator') then
    return false;
  end if;

  return exists (
    select 1
    from users
    where user_id = p_actor_id
      and active is true
      and lower(coalesce(role, '')) = v_role
  );
end;
$$;

create or replace function watmatch_actor_can_route_commitments(
  p_actor_id bigint,
  p_actor_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
begin
  if v_role not in ('admin', 'academic_advisor', 'enrollment_operator') then
    return false;
  end if;

  return exists (
    select 1
    from users
    where user_id = p_actor_id
      and active is true
      and lower(coalesce(role, '')) = v_role
  );
end;
$$;

create or replace function watmatch_get_marketplace_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'success', true,
    'data', watmatch_marketplace_settings_json()
  );
end;
$$;

create or replace function watmatch_cleanup_unavailable_project_commitments(
  p_actor_id bigint default null,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_reason text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Marketplace commitment is no longer actionable.');
  v_actor_role text := 'system';
begin
  if p_actor_id is not null then
    select lower(coalesce(role, 'system'))
      into v_actor_role
    from users
    where user_id = p_actor_id;
    v_actor_role := coalesce(nullif(v_actor_role, ''), 'system');
  end if;

  with unavailable_candidates as (
    select pcr.commitment_request_id, pcr.exploration_fk
    from project_commitment_requests pcr
    left join project_explorations pe on pe.exploration_id = pcr.exploration_fk
    left join users u on u.user_id = pcr.student_fk
    left join teams t on t.team_id = pcr.team_fk
    left join capstones c on c.capstone_id = pcr.capstone_fk
    where pcr.status = 'pending'
      and (
        pe.exploration_id is null
        or pe.status <> 'pending_commitment'
        or u.user_id is null
        or lower(coalesce(u.role, '')) <> 'student'
        or u.active is not true
        or exists (
          select 1
          from team_memberships tm
          where tm.user_fk = pcr.student_fk
        )
        or t.team_id is null
        or t.status in ('archived', 'finalized')
        or c.capstone_id is null
        or c.archived is true
        or c.status <> 'approved_recruiting'
        or c.team_fk is distinct from pcr.team_fk
        or not watmatch_capstone_accepts_marketplace_activity(c.capstone_id)
      )
  ),
  unavailable as (
    update project_commitment_requests pcr
    set status = 'cancelled',
        decided_by_fk = coalesce(p_actor_id, pcr.decided_by_fk),
        decided_at = coalesce(pcr.decided_at, now()),
        comments = coalesce(pcr.comments, v_reason),
        updated_at = now()
    from unavailable_candidates sc
    where pcr.commitment_request_id = sc.commitment_request_id
    returning pcr.commitment_request_id, pcr.exploration_fk
  ),
  expired_unavailable_explorations as (
    update project_explorations pe
    set status = 'expired',
        decided_by_fk = coalesce(p_actor_id, pe.decided_by_fk),
        decided_at = coalesce(pe.decided_at, now()),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = now()
    from unavailable s
    where pe.exploration_id = s.exploration_fk
      and pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
    returning pe.exploration_id
  ),
  cleanup_counts as (
    select
      (select count(*)::integer from unavailable) as unavailable_count,
      (select count(*)::integer from expired_unavailable_explorations) as expired_count
  )
  select unavailable_count
    into v_count
  from cleanup_counts;

  if v_count > 0 then
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_actor_role,
      'marketplace_commitment_cleanup',
      'marketplace',
      'project_commitment_requests',
      v_reason,
      jsonb_build_object('cancelled_commitment_requests', v_count)
    );
  end if;

  return v_count;
end;
$$;

create or replace function watmatch_capstone_closeout_summary_json(p_capstone capstones)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
begin
  if p_capstone.capstone_id is null then
    return null;
  end if;

  if p_capstone.team_fk is not null then
    select * into v_team from teams where team_id = p_capstone.team_fk;
  end if;

  return jsonb_build_object(
    'capstone_id', p_capstone.capstone_id,
    'title', p_capstone.title,
    'status', p_capstone.status,
    'approval', p_capstone.approval,
    'course_fk', p_capstone.course_fk,
    'team_fk', p_capstone.team_fk,
    'team_status', v_team.status,
    'created_at', p_capstone.created_at,
    'updated_at', p_capstone.updated_at,
    'completed_at', p_capstone.completed_at,
    'completed_by_fk', p_capstone.completed_by_fk,
    'completed_term', p_capstone.completed_term,
    'completion_notes', p_capstone.completion_notes,
    'closeout_decision', p_capstone.closeout_decision,
    'closeout_decided_at', p_capstone.closeout_decided_at,
    'closeout_applied_at', p_capstone.closeout_applied_at,
    'closeout_notes', p_capstone.closeout_notes,
    'continued_to_course_fk', p_capstone.continued_to_course_fk,
    'continued_to_term', p_capstone.continued_to_term,
    'continued_member_enrollment_routes', coalesce(p_capstone.continued_member_enrollment_routes, '{}'::jsonb),
    'published_past_capstone_fk', p_capstone.published_past_capstone_fk,
    'published_watmatch_past_capstone_fk', p_capstone.published_watmatch_past_capstone_fk,
    'carry_over_read_only', coalesce(p_capstone.carry_over_read_only, false),
    'support_summary', watmatch_capstone_support_summary(p_capstone.capstone_id),
    'departments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'department_id', d.department_id,
            'name', d.name,
            'active', d.active
          )
          order by d.name
        )
        from capstone_departments cd
        join departments d on d.department_id = cd.department_fk
        where cd.capstone_fk = p_capstone.capstone_id
      ),
      '[]'::jsonb
    ),
    'members', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', u.user_id,
            'email', u.email,
            'course_fk', u.course_fk,
            'enrollment_course_fk', tm.enrollment_course_fk,
            'enrollment_course', case
              when ec.course_id is null then null
              else jsonb_build_object(
                'course_id', ec.course_id,
                'code', ec.code,
                'name', ec.name,
                'active', ec.active,
                'routing_kind', ec.routing_kind,
                'ecosystem_fk', ec.ecosystem_fk
              )
            end,
            'is_leader', u.user_id = v_team.leader_fk,
            'home_department', hd.name
          )
          order by case when u.user_id = v_team.leader_fk then 0 else 1 end, u.email
        )
        from team_memberships tm
        join users u on u.user_id = tm.user_fk
        left join courses ec on ec.course_id = tm.enrollment_course_fk
        left join departments hd on hd.department_id = u.home_department_fk
        where tm.team_fk = p_capstone.team_fk
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function watmatch_closeout_required_capstone_rows()
returns setof capstones
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from capstones c
  left join teams t on t.team_id = c.team_fk
  where c.archived is false
    and c.closeout_decision is null
    and (
      c.status = 'approved_recruiting'
      or (
        c.status in ('approved', 'complete')
        and c.approval is true
        and coalesce(t.status, '') = 'finalized'
      )
    )
  order by c.updated_at desc, c.created_at desc, c.capstone_id desc;
$$;

create or replace function watmatch_course_activation_preview_json(p_target_term text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target_term text := nullif(btrim(coalesce(p_target_term, '')), '');
  v_target_season text;
begin
  if v_target_term is null or v_target_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    v_target_term := watmatch_default_marketplace_term();
  end if;
  v_target_season := split_part(v_target_term, ' ', 1);

  return (
    with course_states as (
      select
        c.course_id,
        c.code,
        c.name,
        c.active,
        coalesce(c.active_terms, '{}'::text[]) as active_terms,
        coalesce(c.activation_mode, 'auto') as activation_mode,
        coalesce(c.routing_kind, 'standard') as routing_kind,
        coalesce(c.requires_project_support, true) as requires_project_support,
        c.department_fk,
        d.name as department_name,
        d.active as department_active,
        coalesce(instructors.active_instructor_count, 0) as active_instructor_count,
        case
          when coalesce(c.activation_mode, 'auto') = 'force_inactive' then false
          when coalesce(instructors.active_instructor_count, 0) = 0 then false
          when watmatch_course_has_term_offering(c.course_id, v_target_term)
            then watmatch_course_has_active_term_offering(c.course_id, v_target_term)
          when coalesce(c.activation_mode, 'auto') = 'force_active' then true
          else coalesce(c.active_terms, '{}'::text[]) @> array[v_target_season]::text[]
        end as effective_active_after_transition,
        case
          when coalesce(c.activation_mode, 'auto') = 'force_inactive' then false
          when coalesce(instructors.active_instructor_count, 0) > 0 then false
          when watmatch_course_has_term_offering(c.course_id, v_target_term)
            then watmatch_course_has_active_term_offering(c.course_id, v_target_term)
          when coalesce(c.activation_mode, 'auto') = 'force_active' then true
          else coalesce(c.active_terms, '{}'::text[]) @> array[v_target_season]::text[]
        end as blocked_missing_instructor
      from courses c
      left join departments d on d.department_id = c.department_fk
      left join lateral (
        select count(*)::integer as active_instructor_count
        from users u
        where u.course_fk = c.course_id
          and u.active is true
          and lower(coalesce(u.role, '')) = 'instructor'
      ) instructors on true
    ),
    rows as (
      select
        course_states.*,
        jsonb_build_object(
          'course_id', course_id,
          'code', code,
          'name', name,
          'active', active,
          'active_terms', active_terms,
          'activation_mode', activation_mode,
          'department_fk', department_fk,
          'department', case
            when department_fk is null then null
            else jsonb_build_object(
              'department_id', department_fk,
              'name', department_name,
              'active', department_active
            )
          end,
          'routing_kind', routing_kind,
          'requires_project_support', requires_project_support,
          'active_instructor_count', active_instructor_count,
          'effective_active_after_transition', effective_active_after_transition,
          'blocked_missing_instructor', blocked_missing_instructor
        ) as row_json
      from course_states
    )
    select jsonb_build_object(
      'target_term', v_target_term,
      'target_season', v_target_season,
      'counts', jsonb_build_object(
        'will_activate', (select count(*)::integer from rows where active is not true and effective_active_after_transition is true),
        'will_deactivate', (select count(*)::integer from rows where active is true and effective_active_after_transition is false),
        'force_active', (select count(*)::integer from rows where activation_mode = 'force_active'),
        'force_inactive', (select count(*)::integer from rows where activation_mode = 'force_inactive'),
        'blocked_missing_instructor', (select count(*)::integer from rows where blocked_missing_instructor is true)
      ),
      'will_activate', coalesce(
        (select jsonb_agg(row_json order by code, name, course_id) from rows where active is not true and effective_active_after_transition is true),
        '[]'::jsonb
      ),
      'will_deactivate', coalesce(
        (select jsonb_agg(row_json order by code, name, course_id) from rows where active is true and effective_active_after_transition is false),
        '[]'::jsonb
      ),
      'force_active', coalesce(
        (select jsonb_agg(row_json order by code, name, course_id) from rows where activation_mode = 'force_active'),
        '[]'::jsonb
      ),
      'force_inactive', coalesce(
        (select jsonb_agg(row_json order by code, name, course_id) from rows where activation_mode = 'force_inactive'),
        '[]'::jsonb
      ),
      'blocked_missing_instructor', coalesce(
        (select jsonb_agg(row_json order by code, name, course_id) from rows where blocked_missing_instructor is true),
        '[]'::jsonb
      )
    )
  );
end;
$$;

create or replace function watmatch_course_health_rows_json(
  p_search text default null,
  p_course_id bigint default null,
  p_department_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  v_settings marketplace_settings%rowtype;
  v_target_term text;
  v_target_season text;
begin
  select * into v_settings from marketplace_settings where setting_id = 1;
  v_target_term := coalesce(v_settings.current_term, watmatch_default_marketplace_term());
  v_target_season := split_part(v_target_term, ' ', 1);

  return (
    with course_states as (
      select
        c.course_id,
        c.code,
        c.name,
        c.active,
        coalesce(c.active_terms, '{}'::text[]) as active_terms,
        coalesce(c.activation_mode, 'auto') as activation_mode,
        coalesce(c.routing_kind, 'standard') as routing_kind,
        coalesce(c.requires_project_support, true) as requires_project_support,
        c.department_fk,
        d.name as department_name,
        d.active as department_active,
        coalesce(instructors.active_instructor_count, 0) as active_instructor_count,
        coalesce(reviews.pending_review_count, 0) as pending_review_count,
        coalesce(routing.pending_routing_count, 0) as pending_routing_count,
        coalesce(commitments.pending_commitment_count, 0) as pending_commitment_count,
        coalesce(reassignments.course_reassignment_count, 0) as course_reassignment_count,
        coalesce(pipeline.pipeline_issue_count, 0) as pipeline_issue_count
      from courses c
      left join departments d on d.department_id = c.department_fk
      left join lateral (
        select count(*)::integer as active_instructor_count
        from users u
        where u.course_fk = c.course_id
          and u.active is true
          and lower(coalesce(u.role, '')) = 'instructor'
      ) instructors on true
      left join lateral (
        select count(*)::integer as pending_review_count
        from capstones cap
        where cap.archived is not true
          and cap.status = 'pending_review'
          and cap.course_fk = c.course_id
      ) reviews on true
      left join lateral (
        select count(*)::integer as pending_routing_count
        from capstones cap
        left join teams t on t.team_id = cap.team_fk
        where cap.archived is not true
          and cap.status = 'pending_admin_course_routing'
          and c.course_id in (cap.course_fk, cap.requested_course_fk, t.course_fk)
      ) routing on true
      left join lateral (
        select count(*)::integer as pending_commitment_count
        from project_commitment_requests pcr
        left join capstones cap on cap.capstone_id = pcr.capstone_fk
        left join teams t on t.team_id = pcr.team_fk
        where pcr.status = 'pending'
          and c.course_id in (pcr.target_course_fk, cap.course_fk, t.course_fk)
      ) commitments on true
      left join lateral (
        select count(*)::integer as course_reassignment_count
        from course_reassignment_requests crr
        where crr.status = 'pending'
          and c.course_id in (crr.from_course_fk, crr.to_course_fk)
      ) reassignments on true
      left join lateral (
        select count(*)::integer as pipeline_issue_count
        from course_pipeline_edges edge
        left join courses target_course on target_course.course_id = edge.to_course_fk
        where edge.from_course_fk = c.course_id
          and edge.active is true
          and (
            target_course.course_id is null
            or watmatch_course_available_for_term(target_course.course_id, v_target_term) is false
          )
      ) pipeline on true
      where (p_course_id is null or c.course_id = p_course_id)
        and (p_department_id is null or c.department_fk = p_department_id)
        and (
          v_search is null
          or lower(coalesce(c.code, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(d.name, '')) like '%' || v_search || '%'
        )
    ),
    rows as (
      select
        *,
        case
          when activation_mode = 'force_inactive' then false
          when active_instructor_count = 0 then false
          when watmatch_course_has_term_offering(course_id, v_target_term)
            then watmatch_course_has_active_term_offering(course_id, v_target_term)
          when activation_mode = 'force_active' then true
          else active_terms @> array[v_target_season]::text[]
        end as ready_for_review,
        case
          when activation_mode = 'force_inactive' then 'force_inactive'
          when active_instructor_count = 0
               and (
                 active is true
                 or activation_mode = 'force_active'
                 or (
                   watmatch_course_has_term_offering(course_id, v_target_term)
                   and watmatch_course_has_active_term_offering(course_id, v_target_term)
                 )
                 or (
                   not watmatch_course_has_term_offering(course_id, v_target_term)
                   and active_terms @> array[v_target_season]::text[]
                 )
               ) then 'missing_instructor'
          when active is not true then 'inactive'
          when pipeline_issue_count > 0 then 'pipeline_issue'
          when pending_review_count + pending_routing_count + pending_commitment_count + course_reassignment_count > 0 then 'workload'
          else 'ready'
        end as health_status
      from course_states
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'course_id', course_id,
        'code', code,
        'name', name,
        'active', active,
        'active_terms', active_terms,
        'activation_mode', activation_mode,
        'department_fk', department_fk,
        'department', case
          when department_fk is null then null
          else jsonb_build_object(
            'department_id', department_fk,
            'name', department_name,
            'active', department_active
          )
        end,
        'routing_kind', routing_kind,
        'requires_project_support', requires_project_support,
        'active_instructor_count', active_instructor_count,
        'pending_review_count', pending_review_count,
        'pending_routing_count', pending_routing_count,
        'pending_commitment_count', pending_commitment_count,
        'course_reassignment_count', course_reassignment_count,
        'pipeline_issue_count', pipeline_issue_count,
        'ready_for_review', ready_for_review,
        'health_status', health_status
      )
      order by
        case health_status
          when 'missing_instructor' then 0
          when 'pipeline_issue' then 1
          when 'workload' then 2
          when 'inactive' then 3
          when 'force_inactive' then 4
          else 5
        end,
        code,
        name,
        course_id
    ), '[]'::jsonb)
    from rows
  );
end;
$$;

create or replace function watmatch_get_marketplace_readiness(
  p_actor_id bigint,
  p_actor_role text,
  p_current_term text default null,
  p_phase text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_settings marketplace_settings%rowtype;
  v_target_term text := nullif(btrim(coalesce(p_current_term, '')), '');
  v_target_phase text := lower(nullif(btrim(coalesce(p_phase, '')), ''));
  v_term_changed boolean := false;
  v_pending_capstones jsonb := '[]'::jsonb;
  v_pending_commitments jsonb := '[]'::jsonb;
  v_pending_enrollments jsonb := '[]'::jsonb;
  v_invalid_member_enrollments jsonb := '[]'::jsonb;
  v_support_gaps jsonb := '[]'::jsonb;
  v_closeout_required jsonb := '[]'::jsonb;
  v_invalid_continuations jsonb := '[]'::jsonb;
  v_unresolved_activity jsonb := '[]'::jsonb;
  v_phase_overrides jsonb := '[]'::jsonb;
  v_activation_preview jsonb := '{}'::jsonb;
  v_counts jsonb;
  v_has_attention_items boolean;
  v_has_blockers boolean;
  v_enforce_blockers boolean := false;
  v_zero_counts jsonb := jsonb_build_object(
    'pending_capstone_reviews', 0,
    'pending_commitments', 0,
    'pending_enrollment_requests', 0,
    'invalid_member_enrollments', 0,
    'support_gaps', 0,
    'closeout_required', 0,
    'invalid_pending_continuations', 0,
    'unresolved_marketplace_activity', 0,
    'phase_overrides', 0
  );
  v_transition_normal boolean := true;
begin
  if not watmatch_actor_can_manage_marketplace_settings(p_actor_id, v_role) then
    raise exception 'Marketplace settings access required.' using errcode = '42501';
  end if;

  select * into v_settings from marketplace_settings where setting_id = 1;
  if not found then
    insert into marketplace_settings (setting_id, current_term, phase)
    values (1, watmatch_default_marketplace_term(), 'exploration')
    returning * into v_settings;
  end if;

  v_target_term := coalesce(v_target_term, v_settings.current_term);
  v_target_phase := coalesce(v_target_phase, v_settings.phase);
  v_term_changed := v_target_term is distinct from v_settings.current_term;
  v_enforce_blockers := v_target_phase = 'finalization' or v_term_changed;
  v_transition_normal := case
    when v_term_changed then v_settings.phase = 'finalization' and v_target_phase = 'exploration'
    when v_settings.phase is distinct from v_target_phase then
      (v_settings.phase = 'exploration' and v_target_phase = 'commitment')
      or (v_settings.phase = 'commitment' and v_target_phase = 'finalization')
    else true
  end;
  v_activation_preview := watmatch_course_activation_preview_json(v_target_term);

  select coalesce(jsonb_agg(row_json order by kind, label), '[]'::jsonb)
    into v_phase_overrides
  from (
    select
      'course'::text as kind,
      c.code || ' - ' || c.name as label,
      jsonb_build_object(
        'kind', 'course',
        'course_id', c.course_id,
        'code', c.code,
        'name', c.name,
        'phase', c.marketplace_phase_override,
        'reason', c.marketplace_phase_override_reason,
        'updated_by_fk', c.marketplace_phase_override_updated_by_fk,
        'updated_at', c.marketplace_phase_override_updated_at
      ) as row_json
    from courses c
    where c.marketplace_phase_override is not null
    union all
    select
      'ecosystem'::text as kind,
      e.name as label,
      jsonb_build_object(
        'kind', 'ecosystem',
        'ecosystem_id', e.ecosystem_id,
        'name', e.name,
        'phase', e.marketplace_phase_override,
        'reason', e.marketplace_phase_override_reason,
        'updated_by_fk', e.marketplace_phase_override_updated_by_fk,
        'updated_at', e.marketplace_phase_override_updated_at
      ) as row_json
    from project_ecosystems e
    where e.active is true
      and lower(coalesce(e.name, '')) <> 'departmental'
      and e.marketplace_phase_override is not null
  ) phase_rows;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'capstone_id', c.capstone_id,
      'title', c.title,
      'status', c.status,
      'course_fk', c.course_fk,
      'team_fk', c.team_fk,
      'updated_at', c.updated_at
    )
    order by c.updated_at desc, c.capstone_id desc
  ), '[]'::jsonb)
  into v_pending_capstones
  from capstones c
  where c.archived is not true
    and c.status in ('pending_review', 'pending_admin_course_routing');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'commitment_request_id', pcr.commitment_request_id,
      'capstone_fk', pcr.capstone_fk,
      'team_fk', pcr.team_fk,
      'student_fk', pcr.student_fk,
      'student_email', u.email,
      'capstone_title', c.title,
      'created_at', pcr.created_at
    )
    order by pcr.created_at asc, pcr.commitment_request_id asc
  ), '[]'::jsonb)
  into v_pending_commitments
  from project_commitment_requests pcr
  left join users u on u.user_id = pcr.student_fk
  left join capstones c on c.capstone_id = pcr.capstone_fk
  where pcr.status = 'pending';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'request_id', crr.request_id,
      'request_type', crr.request_type,
      'student_fk', crr.student_fk,
      'student_email', u.email,
      'from_course_fk', crr.from_course_fk,
      'to_course_fk', crr.to_course_fk,
      'capstone_fk', crr.capstone_fk,
      'team_fk', crr.team_fk,
      'created_at', crr.created_at
    )
    order by crr.created_at asc, crr.request_id asc
  ), '[]'::jsonb)
  into v_pending_enrollments
  from course_reassignment_requests crr
  left join users u on u.user_id = crr.student_fk
  where crr.status = 'pending';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'team_id', t.team_id,
      'capstone_id', c.capstone_id,
      'capstone_title', c.title,
      'student_fk', u.user_id,
      'student_email', u.email,
      'enrollment_course_fk', tm.enrollment_course_fk,
      'enrollment_course_code', ec.code,
      'reason', case
        when u.active is not true then 'Student account is inactive.'
        when tm.enrollment_course_fk is null then 'Missing official enrollment course.'
        when ec.course_id is null then 'Enrollment course no longer exists.'
        when ec.active is not true then 'Enrollment course is inactive.'
        when not watmatch_course_has_active_instructor(ec.course_id) then 'Enrollment course has no active instructor.'
        else 'Enrollment course is not ready.'
      end
    )
    order by c.updated_at desc, c.capstone_id desc, u.email
  ), '[]'::jsonb)
  into v_invalid_member_enrollments
  from team_memberships tm
  join users u on u.user_id = tm.user_fk
  join teams t on t.team_id = tm.team_fk
  left join capstones c on c.capstone_id = t.capstone_fk
  left join courses ec on ec.course_id = tm.enrollment_course_fk
  where coalesce(t.status, '') <> 'archived'
    and coalesce(c.archived, false) is false
    and coalesce(c.status, '') in ('approved_recruiting', 'approved', 'complete')
    and (
      u.active is not true
      or tm.enrollment_course_fk is null
      or ec.course_id is null
      or ec.active is not true
      or not watmatch_course_has_active_instructor(ec.course_id)
    );

  if v_target_phase = 'finalization' or v_term_changed then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'capstone_id', unresolved.capstone_id,
        'title', unresolved.title,
        'status', unresolved.status,
        'team_fk', unresolved.team_fk,
        'team_status', unresolved.team_status,
        'activity_count', unresolved.activity_count,
        'status_counts', unresolved.status_counts,
        'explorations', unresolved.explorations
      )
      order by unresolved.updated_at desc, unresolved.capstone_id desc
    ), '[]'::jsonb)
    into v_unresolved_activity
    from (
      select
        c.capstone_id,
        c.title,
        c.status,
        c.team_fk,
        t.status as team_status,
        max(pe.updated_at) as updated_at,
        count(*)::integer as activity_count,
        coalesce(
          (
            select jsonb_object_agg(status_counts.status, status_counts.status_count)
            from (
              select pe2.status, count(*)::integer as status_count
              from project_explorations pe2
              where pe2.capstone_fk = c.capstone_id
                and pe2.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
              group by pe2.status
            ) status_counts
          ),
          '{}'::jsonb
        ) as status_counts,
        jsonb_agg(
          jsonb_build_object(
            'exploration_id', pe.exploration_id,
            'status', pe.status,
            'student_fk', pe.student_fk,
            'student_email', u.email,
            'updated_at', pe.updated_at,
            'student_commitment_confirmed', pe.student_commitment_confirmed_at is not null,
            'team_commitment_confirmed', pe.team_commitment_confirmed_at is not null
          )
          order by pe.updated_at desc, pe.exploration_id desc
        ) as explorations
      from project_explorations pe
      join capstones c on c.capstone_id = pe.capstone_fk
      left join teams t on t.team_id = pe.team_fk
      left join users u on u.user_id = pe.student_fk
      where pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
        and c.archived is false
        and coalesce(t.status, '') not in ('archived', 'finalized')
      group by c.capstone_id, c.title, c.status, c.team_fk, t.status
    ) unresolved;
  end if;

  select coalesce(jsonb_agg(
    watmatch_capstone_closeout_summary_json(c)
    order by c.updated_at desc, c.capstone_id desc
  ), '[]'::jsonb)
  into v_support_gaps
  from capstones c
  join teams t on t.team_id = c.team_fk
  left join courses target_course on target_course.course_id = watmatch_target_course_fk(c.capstone_id, t.team_id)
  where c.archived is not true
    and c.status = 'approved_recruiting'
    and t.status not in ('archived', 'finalized')
    and c.closeout_decision is null
    and coalesce(c.carry_over_read_only, false) is false
    and coalesce(target_course.requires_project_support, true) is true
    and coalesce(c.external_partner_support_confirmed, false) is false
    and not exists (
      select 1
      from mentor_requests mr
      where mr.capstone_fk = c.capstone_id
        and mr.status = 'accepted'
    );

  if v_term_changed then
    select coalesce(jsonb_agg(
      watmatch_capstone_closeout_summary_json(c)
      order by c.updated_at desc, c.capstone_id desc
    ), '[]'::jsonb)
    into v_closeout_required
    from watmatch_closeout_required_capstone_rows() c;

    select coalesce(jsonb_agg(
      watmatch_capstone_closeout_summary_json(c)
        || jsonb_build_object(
          'invalid_reason',
          case
            when target_course.course_id is null then 'Continuation target course no longer exists.'
            when coalesce(target_course.activation_mode, 'auto') = 'force_inactive' then 'Continuation target course is force-inactive.'
            when coalesce(target_course.activation_mode, 'auto') <> 'force_active'
                 and not (coalesce(target_course.active_terms, '{}'::text[]) @> array[split_part(coalesce(c.continued_to_term, v_target_term), ' ', 1)]::text[]) then 'Continuation target course is not scheduled for the target term.'
            when not watmatch_course_has_active_instructor(target_course.course_id) then 'Continuation target course has no active instructor.'
            when not watmatch_continuation_member_routes_ready(c.team_fk, c.continued_to_course_fk, coalesce(c.continued_to_term, v_target_term), c.continued_member_enrollment_routes) then 'One or more member enrollment continuation routes are missing or unavailable.'
            else 'Continuation target course is not ready.'
          end
        )
      order by c.updated_at desc, c.capstone_id desc
    ), '[]'::jsonb)
    into v_invalid_continuations
    from capstones c
    left join courses target_course on target_course.course_id = c.continued_to_course_fk
    where c.archived is false
      and c.closeout_decision = 'continue_to_course'
      and c.closeout_applied_at is null
      and c.continued_to_course_fk is not null
      and (c.continued_to_term is null or c.continued_to_term = v_target_term)
      and (
        not watmatch_course_available_for_term(c.continued_to_course_fk, coalesce(c.continued_to_term, v_target_term))
        or not watmatch_continuation_member_routes_ready(c.team_fk, c.continued_to_course_fk, coalesce(c.continued_to_term, v_target_term), c.continued_member_enrollment_routes)
      );
  end if;

  v_counts := jsonb_build_object(
    'pending_capstone_reviews', jsonb_array_length(v_pending_capstones),
    'pending_commitments', jsonb_array_length(v_pending_commitments),
    'pending_enrollment_requests', jsonb_array_length(v_pending_enrollments),
    'invalid_member_enrollments', jsonb_array_length(v_invalid_member_enrollments),
    'support_gaps', jsonb_array_length(v_support_gaps),
    'closeout_required', jsonb_array_length(v_closeout_required),
    'invalid_pending_continuations', jsonb_array_length(v_invalid_continuations),
    'unresolved_marketplace_activity', jsonb_array_length(v_unresolved_activity),
    'phase_overrides', jsonb_array_length(v_phase_overrides)
  );

  v_has_attention_items := (v_counts ->> 'pending_capstone_reviews')::integer > 0
    or (v_counts ->> 'pending_commitments')::integer > 0
    or (v_counts ->> 'pending_enrollment_requests')::integer > 0
    or (v_counts ->> 'invalid_member_enrollments')::integer > 0
    or (v_counts ->> 'support_gaps')::integer > 0
    or (v_counts ->> 'closeout_required')::integer > 0
    or (v_counts ->> 'invalid_pending_continuations')::integer > 0
    or (v_counts ->> 'unresolved_marketplace_activity')::integer > 0
    or (v_counts ->> 'phase_overrides')::integer > 0;
  v_has_blockers := v_enforce_blockers and (
    (v_counts ->> 'pending_capstone_reviews')::integer > 0
    or (v_counts ->> 'pending_commitments')::integer > 0
    or (v_counts ->> 'pending_enrollment_requests')::integer > 0
    or (v_counts ->> 'invalid_member_enrollments')::integer > 0
    or (v_counts ->> 'support_gaps')::integer > 0
    or (v_counts ->> 'closeout_required')::integer > 0
    or (v_counts ->> 'invalid_pending_continuations')::integer > 0
    or (v_counts ->> 'unresolved_marketplace_activity')::integer > 0
  );

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'current_settings', watmatch_marketplace_settings_json(),
      'target_term', v_target_term,
      'target_phase', v_target_phase,
      'term_changed', v_term_changed,
      'transition', jsonb_build_object(
        'from_term', v_settings.current_term,
        'from_phase', v_settings.phase,
        'to_term', v_target_term,
        'to_phase', v_target_phase,
        'term_changed', v_term_changed,
        'phase_changed', v_settings.phase is distinct from v_target_phase,
        'normal', v_transition_normal,
        'override_required', v_transition_normal is false
      ),
      'course_activation_preview', v_activation_preview,
      'has_blockers', v_has_blockers,
      'has_attention_items', v_has_attention_items,
      'counts', v_counts,
      'attention_counts', v_counts,
      'blocking_counts', case
        when v_enforce_blockers then v_counts || jsonb_build_object('phase_overrides', 0)
        else v_zero_counts
      end,
      'blockers', jsonb_build_object(
        'pending_capstone_reviews', v_pending_capstones,
        'pending_commitments', v_pending_commitments,
        'pending_enrollment_requests', v_pending_enrollments,
        'invalid_member_enrollments', v_invalid_member_enrollments,
        'support_gaps', v_support_gaps,
        'closeout_required', v_closeout_required,
        'invalid_pending_continuations', v_invalid_continuations,
        'unresolved_marketplace_activity', v_unresolved_activity,
        'phase_overrides', v_phase_overrides
      )
    )
  );
end;
$$;

drop function if exists watmatch_get_enrollment_workload_summary(bigint, text);

create or replace function watmatch_get_enrollment_workload_summary(
  p_actor_id bigint,
  p_actor_role text,
  p_search text default null,
  p_course_id bigint default null,
  p_department_id bigint default null,
  p_queue_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_settings jsonb;
  v_pending_commitments integer := 0;
  v_submission_enrollments integer := 0;
  v_course_reassignments integer := 0;
  v_pending_routing integer := 0;
  v_pending_reviews integer := 0;
  v_no_course_students integer := 0;
  v_unstaffed_active_courses integer := 0;
  v_oldest_pending_at timestamptz;
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  v_queue_type text := lower(nullif(btrim(coalesce(p_queue_type, '')), ''));
  v_attention_items jsonb := '[]'::jsonb;
  v_filtered_attention_count integer := 0;
  v_global_counts jsonb;
  v_filtered_counts jsonb := '{}'::jsonb;
  v_course_health jsonb := '[]'::jsonb;
  v_cleanup_count integer := 0;
begin
  if not watmatch_actor_can_route_commitments(p_actor_id, v_role) then
    raise exception 'Advisor, enrollment operator, or admin access required.' using errcode = '42501';
  end if;

  v_cleanup_count := watmatch_cleanup_unavailable_project_commitments(
    p_actor_id,
    'Enrollment workload summary cleanup.'
  );

  v_settings := watmatch_marketplace_settings_json();
  v_course_health := watmatch_course_health_rows_json(v_search, p_course_id, p_department_id);

  select count(*)::integer
    into v_pending_commitments
  from project_commitment_requests
  where status = 'pending';

  select count(*)::integer
    into v_submission_enrollments
  from course_reassignment_requests
  where status = 'pending'
    and request_type = 'project_submission_enrollment';

  select count(*)::integer
    into v_course_reassignments
  from course_reassignment_requests
  where status = 'pending'
    and request_type = 'course_reassignment';

  select count(*)::integer
    into v_pending_routing
  from capstones
  where archived is not true
    and status = 'pending_admin_course_routing';

  select count(*)::integer
    into v_pending_reviews
  from capstones
  where archived is not true
    and status = 'pending_review';

  select count(*)::integer
    into v_no_course_students
  from users
  where active is true
    and lower(coalesce(role, '')) = 'student'
    and course_fk is null;

  select count(*)::integer
    into v_unstaffed_active_courses
  from courses c
  where c.active is true
    and not exists (
      select 1
      from users u
      where u.course_fk = c.course_id
        and u.active is true
        and lower(coalesce(u.role, '')) = 'instructor'
    );

  select min(created_at)
    into v_oldest_pending_at
  from (
    select created_at from project_commitment_requests where status = 'pending'
    union all
    select created_at from course_reassignment_requests where status = 'pending'
    union all
    select created_at from capstones where archived is not true and status in ('pending_review', 'pending_admin_course_routing')
  ) pending;

  with all_items as (
    select
      pcr.created_at,
      'commitment_routing'::text as kind,
      array_remove(array[pcr.target_course_fk, c.course_fk, t.course_fk]::bigint[], null::bigint) as course_ids,
      array_remove(array[u.home_department_fk, target_course.department_fk]::bigint[], null::bigint) as department_ids,
      lower(coalesce(u.email, '') || ' ' || coalesce(c.title, '') || ' commitment routing') as search_text,
      jsonb_build_object(
        'kind', 'commitment_routing',
        'label', 'Commitment routing',
        'entity_id', pcr.commitment_request_id,
        'student_email', u.email,
        'project_title', c.title,
        'created_at', pcr.created_at,
        'recommended_course_fk', pcr.target_course_fk
      ) as item
    from project_commitment_requests pcr
    left join users u on u.user_id = pcr.student_fk
    left join capstones c on c.capstone_id = pcr.capstone_fk
    left join teams t on t.team_id = pcr.team_fk
    left join courses target_course on target_course.course_id = coalesce(pcr.target_course_fk, c.course_fk, t.course_fk)
    where pcr.status = 'pending'

    union all

    select
      crr.created_at,
      crr.request_type::text as kind,
      array_remove(array[crr.from_course_fk, crr.to_course_fk, c.course_fk]::bigint[], null::bigint) as course_ids,
      array_remove(array[u.home_department_fk, target_course.department_fk]::bigint[], null::bigint) as department_ids,
      lower(coalesce(u.email, '') || ' ' || coalesce(c.title, '') || ' ' || coalesce(crr.request_type, 'roster routing')) as search_text,
      jsonb_build_object(
        'kind', crr.request_type,
        'label', case
          when crr.request_type = 'project_submission_enrollment' then 'Submission enrollment'
          else 'Roster routing signal'
        end,
        'entity_id', crr.request_id,
        'student_email', u.email,
        'project_title', c.title,
        'created_at', crr.created_at,
        'recommended_course_fk', crr.to_course_fk
      ) as item
    from course_reassignment_requests crr
    left join users u on u.user_id = crr.student_fk
    left join capstones c on c.capstone_id = crr.capstone_fk
    left join courses target_course on target_course.course_id = coalesce(crr.to_course_fk, crr.from_course_fk, c.course_fk)
    where crr.status = 'pending'

    union all

    select
      c.created_at,
      case
        when c.status = 'pending_admin_course_routing' then 'project_course_routing'
        else 'instructor_review'
      end::text as kind,
      array_remove(array[c.requested_course_fk, c.course_fk, t.course_fk]::bigint[], null::bigint) as course_ids,
      array_remove(array[target_course.department_fk]::bigint[], null::bigint) as department_ids,
      lower(coalesce(c.title, '') || ' ' || coalesce(c.status, '')) as search_text,
      jsonb_build_object(
        'kind', case
          when c.status = 'pending_admin_course_routing' then 'project_course_routing'
          else 'instructor_review'
        end,
        'label', case
          when c.status = 'pending_admin_course_routing' then 'Project course routing'
          else 'Instructor review'
        end,
        'entity_id', c.capstone_id,
        'project_title', c.title,
        'created_at', c.created_at,
        'recommended_course_fk', c.requested_course_fk
      ) as item
    from capstones c
    left join teams t on t.team_id = c.team_fk
    left join courses target_course on target_course.course_id = coalesce(c.requested_course_fk, c.course_fk, t.course_fk)
    where c.archived is not true
      and c.status in ('pending_review', 'pending_admin_course_routing')
  ),
  filtered_items as (
    select *
    from all_items
    where (v_queue_type is null or kind = v_queue_type)
      and (p_course_id is null or p_course_id = any(course_ids))
      and (p_department_id is null or p_department_id = any(department_ids))
      and (v_search is null or search_text like '%' || v_search || '%')
  ),
  counted as (
    select count(*)::integer as filtered_count
    from filtered_items
  )
  select
    coalesce(jsonb_agg(limited.item order by limited.created_at asc nulls last), '[]'::jsonb),
    coalesce((select filtered_count from counted), 0)
    into v_attention_items, v_filtered_attention_count
  from (
    select created_at, item
    from filtered_items
    order by created_at asc nulls last
    limit 25
  ) limited;

  with all_items as (
    select
      'commitment_routing'::text as kind,
      array_remove(array[pcr.target_course_fk, c.course_fk, t.course_fk]::bigint[], null::bigint) as course_ids,
      array_remove(array[u.home_department_fk, target_course.department_fk]::bigint[], null::bigint) as department_ids,
      lower(coalesce(u.email, '') || ' ' || coalesce(c.title, '') || ' commitment routing') as search_text
    from project_commitment_requests pcr
    left join users u on u.user_id = pcr.student_fk
    left join capstones c on c.capstone_id = pcr.capstone_fk
    left join teams t on t.team_id = pcr.team_fk
    left join courses target_course on target_course.course_id = coalesce(pcr.target_course_fk, c.course_fk, t.course_fk)
    where pcr.status = 'pending'

    union all

    select
      crr.request_type::text as kind,
      array_remove(array[crr.from_course_fk, crr.to_course_fk, c.course_fk]::bigint[], null::bigint) as course_ids,
      array_remove(array[u.home_department_fk, target_course.department_fk]::bigint[], null::bigint) as department_ids,
      lower(coalesce(u.email, '') || ' ' || coalesce(c.title, '') || ' ' || coalesce(crr.request_type, 'roster routing')) as search_text
    from course_reassignment_requests crr
    left join users u on u.user_id = crr.student_fk
    left join capstones c on c.capstone_id = crr.capstone_fk
    left join courses target_course on target_course.course_id = coalesce(crr.to_course_fk, crr.from_course_fk, c.course_fk)
    where crr.status = 'pending'

    union all

    select
      case
        when c.status = 'pending_admin_course_routing' then 'project_course_routing'
        else 'instructor_review'
      end::text as kind,
      array_remove(array[c.requested_course_fk, c.course_fk, t.course_fk]::bigint[], null::bigint) as course_ids,
      array_remove(array[target_course.department_fk]::bigint[], null::bigint) as department_ids,
      lower(coalesce(c.title, '') || ' ' || coalesce(c.status, '')) as search_text
    from capstones c
    left join teams t on t.team_id = c.team_fk
    left join courses target_course on target_course.course_id = coalesce(c.requested_course_fk, c.course_fk, t.course_fk)
    where c.archived is not true
      and c.status in ('pending_review', 'pending_admin_course_routing')
  ),
  filtered_items as (
    select *
    from all_items
    where (p_course_id is null or p_course_id = any(course_ids))
      and (p_department_id is null or p_department_id = any(department_ids))
      and (v_search is null or search_text like '%' || v_search || '%')
  )
  select jsonb_build_object(
    'pending_commitments', count(*) filter (where kind = 'commitment_routing'),
    'submission_enrollment_requests', count(*) filter (where kind = 'project_submission_enrollment'),
    'course_reassignment_requests', count(*) filter (where kind = 'course_reassignment'),
    'pending_course_routing', count(*) filter (where kind = 'project_course_routing'),
    'pending_reviews', count(*) filter (where kind = 'instructor_review'),
    'active_no_course_students', v_no_course_students,
    'unstaffed_active_courses', v_unstaffed_active_courses
  )
    into v_filtered_counts
  from filtered_items;

  v_global_counts := jsonb_build_object(
    'pending_commitments', v_pending_commitments,
    'submission_enrollment_requests', v_submission_enrollments,
    'course_reassignment_requests', v_course_reassignments,
    'pending_course_routing', v_pending_routing,
    'pending_reviews', v_pending_reviews,
    'active_no_course_students', v_no_course_students,
    'unstaffed_active_courses', v_unstaffed_active_courses
  );

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'marketplace', v_settings,
      'counts', v_global_counts,
      'global_counts', v_global_counts,
      'filtered_counts', v_filtered_counts,
      'oldest_pending_at', v_oldest_pending_at,
      'attention_items', v_attention_items,
      'filtered_attention_count', v_filtered_attention_count,
      'cleanup', jsonb_build_object(
        'cancelled_stale_commitments', coalesce(v_cleanup_count, 0)
      ),
      'filters', jsonb_build_object(
        'search', p_search,
        'course_id', p_course_id,
        'department_id', p_department_id,
        'queue_type', p_queue_type
      ),
      'course_health', v_course_health
    )
  );
end;
$$;

create or replace function watmatch_resolve_marketplace_activity_for_finalization(
  p_actor_id bigint,
  p_actor_role text,
  p_capstone_id bigint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_updated_count integer := 0;
  v_cancelled_commitment_count integer := 0;
  v_team_ids bigint[] := '{}'::bigint[];
  v_commitment_team_ids bigint[] := '{}'::bigint[];
  v_team_id bigint;
begin
  if not watmatch_actor_can_manage_marketplace_settings(p_actor_id, v_role) then
    raise exception 'Marketplace settings access required.' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Marketplace activity resolution requires an audit reason.' using errcode = '23514';
  end if;

  if p_capstone_id is not null and not exists (
    select 1 from capstones c where c.capstone_id = p_capstone_id
  ) then
    raise exception 'Capstone not found.' using errcode = 'P0002';
  end if;

  with updated as (
    update project_explorations pe
    set status = case when pe.status in ('exploring', 'pending_commitment') then 'not_selected' else 'expired' end,
        decided_by_fk = p_actor_id,
        decided_at = coalesce(pe.decided_at, now()),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = now()
    from capstones c
    left join teams t on t.team_id = c.team_fk
    where c.capstone_id = pe.capstone_fk
      and pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
      and c.archived is false
      and coalesce(t.status, '') not in ('archived', 'finalized')
      and (p_capstone_id is null or pe.capstone_fk = p_capstone_id)
    returning pe.team_fk
  )
  select count(*)::integer, coalesce(array_agg(distinct team_fk) filter (where team_fk is not null), '{}'::bigint[])
    into v_updated_count, v_team_ids
  from updated;

  with cancelled as (
    update project_commitment_requests pcr
    set status = 'cancelled',
        decided_by_fk = p_actor_id,
        decided_at = coalesce(pcr.decided_at, now()),
        comments = coalesce(pcr.comments, v_reason),
        updated_at = now()
    from capstones c
    left join teams t on t.team_id = c.team_fk
    where pcr.capstone_fk = c.capstone_id
      and pcr.status = 'pending'
      and c.archived is false
      and coalesce(t.status, '') not in ('archived', 'finalized')
      and (p_capstone_id is null or pcr.capstone_fk = p_capstone_id)
    returning pcr.team_fk
  )
  select count(*)::integer, coalesce(array_agg(distinct team_fk) filter (where team_fk is not null), '{}'::bigint[])
    into v_cancelled_commitment_count, v_commitment_team_ids
  from cancelled;

  select coalesce(array_agg(distinct team_id), '{}'::bigint[])
    into v_team_ids
  from unnest(coalesce(v_team_ids, '{}'::bigint[]) || coalesce(v_commitment_team_ids, '{}'::bigint[])) as resolved(team_id);

  foreach v_team_id in array coalesce(v_team_ids, '{}'::bigint[]) loop
    perform watmatch_clear_team_commitment_roster_if_idle(v_team_id);
  end loop;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'marketplace_activity_resolved_for_finalization',
    case when p_capstone_id is null then 'marketplace' else 'capstone' end,
    coalesce(p_capstone_id::text, 'all'),
    v_reason,
    jsonb_build_object(
      'capstone_id', p_capstone_id,
      'updated_count', v_updated_count,
      'cancelled_commitment_count', v_cancelled_commitment_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Marketplace activity resolved for finalization.',
    'resolved_count', v_updated_count,
    'cancelled_commitment_count', v_cancelled_commitment_count
  );
end;
$$;

drop function if exists watmatch_apply_pending_capstone_continuations(bigint, text);

create or replace function watmatch_apply_pending_capstone_continuations(
  p_actor_id bigint,
  p_actor_role text,
  p_capstone_id bigint default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r capstones%rowtype;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_course courses%rowtype;
  v_team teams%rowtype;
  v_current_term text := coalesce((select current_term from marketplace_settings where setting_id = 1), watmatch_default_marketplace_term());
  v_now timestamptz := now();
  v_count integer := 0;
  v_member_routes jsonb;
  v_member record;
  v_member_enrollment_course courses%rowtype;
  v_member_enrollment_course_id bigint;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  for r in
    select *
    from capstones
    where archived is false
      and closeout_decision = 'continue_to_course'
      and closeout_applied_at is null
      and continued_to_course_fk is not null
      and (continued_to_term is null or continued_to_term = v_current_term)
      and (p_capstone_id is null or capstone_id = p_capstone_id)
    for update
  loop
    v_course := watmatch_assert_course_ready_for_review(r.continued_to_course_fk, 'Continuation target course');

    select *
      into v_team
    from teams
    where team_id = r.team_fk
    for update;

    if not found or v_team.status = 'archived' then
      raise exception 'Continuation capstone % does not have an active team.', r.capstone_id using errcode = '23514';
    end if;

    v_member_routes := watmatch_resolve_continuation_member_routes(
      r.team_fk,
      v_course.course_id,
      v_current_term,
      r.continued_member_enrollment_routes
    );

    perform set_config('watmatch.allow_membership_enrollment_reroute', 'true', true);
    for v_member in
      select tm.user_fk, u.email
      from team_memberships tm
      join users u on u.user_id = tm.user_fk
      where tm.team_fk = r.team_fk
      order by tm.is_leader desc, u.email, u.user_id
    loop
      v_member_enrollment_course_id := (v_member_routes ->> v_member.user_fk::text)::bigint;
      v_member_enrollment_course := watmatch_assert_course_ready_for_review(
        v_member_enrollment_course_id,
        'Continuation enrollment course'
      );

      update users
      set course_fk = v_member_enrollment_course.course_id,
          updated_at = v_now
      where user_id = v_member.user_fk
        and course_fk is distinct from v_member_enrollment_course.course_id;

      update team_memberships
      set enrollment_course_fk = v_member_enrollment_course.course_id,
          enrollment_routed_by_fk = p_actor_id,
          enrollment_routed_at = v_now,
          enrollment_notes = coalesce(r.closeout_notes, 'Capstone continuation enrollment routed into ' || v_current_term || '.')
      where team_fk = r.team_fk
        and user_fk = v_member.user_fk;
    end loop;
    perform set_config('watmatch.allow_membership_enrollment_reroute', 'false', true);

    update capstones
    set course_fk = v_course.course_id,
        requested_course_fk = v_course.course_id,
        approval = false,
        status = 'pending_review',
        carry_over_read_only = false,
        course_routed_by_fk = p_actor_id,
        course_routed_at = v_now,
        course_routing_notes = coalesce(closeout_notes, 'Capstone continued into ' || v_current_term || '.'),
        closeout_decision = null,
        closeout_decided_by_fk = null,
        closeout_decided_at = null,
        closeout_applied_at = null,
        closeout_notes = null,
        continued_to_course_fk = null,
        continued_to_term = null,
        continued_member_enrollment_routes = '{}'::jsonb,
        published_past_capstone_fk = null,
        published_watmatch_past_capstone_fk = null,
        updated_at = v_now
    where capstone_id = r.capstone_id;

    update teams
    set course_fk = v_course.course_id,
        status = 'forming',
        commitment_roster_confirmed_at = null,
        commitment_roster_confirmed_by_fk = null,
        commitment_roster_note = null
    where team_id = r.team_fk;

    perform watmatch_reset_capstone_course_requirements(r.capstone_id, r.team_fk);
    perform watmatch_sync_course_reassignment_requests(
      r.capstone_id,
      r.team_fk,
      v_course.course_id,
      p_actor_id,
      coalesce(r.closeout_notes, 'Capstone continuation routed confirmed members to their selected enrollment courses.')
    );

    update project_explorations
    set status = 'expired',
        decided_by_fk = p_actor_id,
        decided_at = coalesce(decided_at, v_now),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = v_now
    where capstone_fk = r.capstone_id
      and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

    update project_commitment_requests
    set status = 'cancelled',
        decided_by_fk = p_actor_id,
        decided_at = coalesce(decided_at, v_now),
        comments = coalesce(comments, 'Capstone continuation changed the official course.'),
        updated_at = v_now
    where capstone_fk = r.capstone_id
      and status = 'pending';

    insert into approvals (capstone_fk, instructor_fk, action, comments)
    values (r.capstone_id, null, 'capstone_continued_to_course', coalesce(r.closeout_notes, 'Capstone continued into ' || v_current_term || '.'));

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      'capstone_continuation_applied',
      'capstone',
      r.capstone_id::text,
      r.closeout_notes,
      jsonb_build_object(
        'target_course', to_jsonb(v_course),
        'target_term', v_current_term,
        'team_id', r.team_fk,
        'member_enrollment_routes', v_member_routes
      )
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function watmatch_get_capstones_needing_closeout(
  p_actor_id bigint,
  p_actor_role text,
  p_include_carried_over boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_data jsonb := '[]'::jsonb;
begin
  if not watmatch_actor_can_manage_marketplace_settings(p_actor_id, v_role) then
    raise exception 'Marketplace settings access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    watmatch_capstone_closeout_summary_json(c)
    order by c.updated_at desc, c.capstone_id desc
  ), '[]'::jsonb)
  into v_data
  from (
    select required_rows.*
    from watmatch_closeout_required_capstone_rows() required_rows
    union all
    select c.*
    from capstones c
    where p_include_carried_over is true
      and c.archived is false
      and coalesce(c.carry_over_read_only, false) is true
      and c.closeout_decision in ('carry_over_read_only', 'continue_to_course')
      and c.status in ('approved_recruiting', 'approved')
      and not exists (
        select 1
        from watmatch_closeout_required_capstone_rows() required_rows
        where required_rows.capstone_id = c.capstone_id
      )
  ) c;

  return jsonb_build_object('success', true, 'data', v_data);
end;
$$;

drop function if exists watmatch_apply_capstone_closeout_decision(bigint, bigint, text, text, bigint, text, text);

create or replace function watmatch_apply_capstone_closeout_decision(
  p_capstone_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_decision text,
  p_target_course_id bigint default null,
  p_notes text default null,
  p_target_term text default null,
  p_member_enrollment_routes jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_decision text := lower(nullif(btrim(coalesce(p_decision, '')), ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_target_term text := nullif(btrim(coalesce(p_target_term, '')), '');
  v_target_season text;
  v_current_term text := coalesce((select current_term from marketplace_settings where setting_id = 1), watmatch_default_marketplace_term());
  v_capstone capstones%rowtype;
  v_course courses%rowtype;
  v_native_past_id bigint;
  v_year text := substring(coalesce((select current_term from marketplace_settings where setting_id = 1), watmatch_default_marketplace_term()) from '[0-9]{4}$');
  v_now timestamptz := now();
  v_students text[];
  v_departments text[];
  v_mentor_name text;
  v_applied_continuations integer := 0;
  v_previous_closeout_decision text;
  v_member_enrollment_routes jsonb := '{}'::jsonb;
begin
  if not watmatch_actor_can_manage_marketplace_settings(p_actor_id, v_role) then
    raise exception 'Marketplace settings access required.' using errcode = '42501';
  end if;

  if v_decision not in ('continue_to_course', 'publish_completed', 'carry_over_read_only', 'archive', 'clear_decision') then
    raise exception 'Unsupported closeout decision.' using errcode = '23514';
  end if;

  if v_notes is null then
    raise exception 'Closeout decision notes are required.' using errcode = '23514';
  end if;

  if v_decision in ('publish_completed', 'archive') and v_role <> 'admin' then
    raise exception 'Only admins can publish or archive capstones during closeout.' using errcode = '42501';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found or v_capstone.archived is true then
    raise exception 'Capstone not found or already archived.' using errcode = 'P0002';
  end if;

  if v_capstone.status not in ('approved_recruiting', 'approved', 'complete') then
    raise exception 'Only approved recruiting, finalized, or complete capstones can receive closeout decisions.' using errcode = '23514';
  end if;

  if v_decision = 'publish_completed' and v_capstone.status <> 'complete' then
    raise exception 'Only completed capstones can be published to WatMatch completed capstones.' using errcode = '23514';
  end if;

  if v_decision in ('continue_to_course', 'carry_over_read_only') and v_capstone.status = 'complete' then
    raise exception 'Completed capstones can only be published or archived.' using errcode = '23514';
  end if;

  if v_decision = 'clear_decision' then
    v_previous_closeout_decision := v_capstone.closeout_decision;

    if v_capstone.closeout_decision in ('publish_completed', 'archive')
       or v_capstone.published_past_capstone_fk is not null
       or v_capstone.published_watmatch_past_capstone_fk is not null then
      raise exception 'Applied archive or publish closeout decisions cannot be cleared.' using errcode = '23514';
    end if;

    update capstones
    set closeout_decision = null,
        closeout_decided_by_fk = null,
        closeout_decided_at = null,
        closeout_applied_at = null,
        closeout_notes = null,
        continued_to_course_fk = null,
        continued_to_term = null,
        continued_member_enrollment_routes = '{}'::jsonb,
        carry_over_read_only = false,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_capstone;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      'capstone_closeout_cleared',
      'capstone',
      p_capstone_id::text,
      v_notes,
      jsonb_build_object('previous_decision', v_previous_closeout_decision)
    );

    return jsonb_build_object(
      'success', true,
      'message', 'Capstone closeout decision cleared.',
      'data', watmatch_capstone_closeout_summary_json(v_capstone)
    );
  elsif v_decision = 'continue_to_course' then
    v_target_term := coalesce(v_target_term, v_current_term);
    if v_target_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
      raise exception 'Continuation target term must use Winter <year>, Spring <year>, or Fall <year>.' using errcode = '23514';
    end if;
    v_target_season := split_part(v_target_term, ' ', 1);

    if p_target_course_id is null then
      raise exception 'A target course is required for continuation.' using errcode = '22023';
    end if;

    select *
      into v_course
    from courses
    where course_id = p_target_course_id;

    if not found or coalesce(v_course.activation_mode, 'auto') = 'force_inactive' then
      raise exception 'Continuation target course is not available.' using errcode = 'P0002';
    end if;

    if coalesce(v_course.activation_mode, 'auto') <> 'force_active'
       and not (coalesce(v_course.active_terms, '{}'::text[]) @> array[v_target_season]::text[]) then
      raise exception 'Continuation target course is not scheduled for the selected target term.' using errcode = '23514';
    end if;

    if not watmatch_course_has_active_instructor(v_course.course_id) then
      raise exception 'Continuation target course must have an active instructor assigned.' using errcode = '23514';
    end if;

    v_member_enrollment_routes := watmatch_resolve_continuation_member_routes(
      v_capstone.team_fk,
      v_course.course_id,
      v_target_term,
      p_member_enrollment_routes
    );

    update capstones
    set closeout_decision = v_decision,
        closeout_decided_by_fk = p_actor_id,
        closeout_decided_at = v_now,
        closeout_applied_at = null,
        closeout_notes = v_notes,
        continued_to_course_fk = v_course.course_id,
        continued_to_term = v_target_term,
        continued_member_enrollment_routes = v_member_enrollment_routes,
        published_past_capstone_fk = null,
        published_watmatch_past_capstone_fk = null,
        carry_over_read_only = true,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_capstone;

    if v_target_term = v_current_term then
      v_applied_continuations := watmatch_apply_pending_capstone_continuations(p_actor_id, v_role, p_capstone_id);
      select * into v_capstone from capstones where capstone_id = p_capstone_id;
    end if;
  elsif v_decision = 'carry_over_read_only' then
    update capstones
    set closeout_decision = v_decision,
        closeout_decided_by_fk = p_actor_id,
        closeout_decided_at = v_now,
        closeout_applied_at = v_now,
        closeout_notes = v_notes,
        continued_to_course_fk = null,
        continued_to_term = null,
        continued_member_enrollment_routes = '{}'::jsonb,
        published_past_capstone_fk = null,
        published_watmatch_past_capstone_fk = null,
        carry_over_read_only = true,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_capstone;
  elsif v_decision = 'publish_completed' then
    v_year := substring(coalesce(v_capstone.completed_term, v_current_term) from '[0-9]{4}$');

    select coalesce(array_agg(u.email order by u.email), '{}'::text[])
      into v_students
    from team_memberships tm
    join users u on u.user_id = tm.user_fk
    where tm.team_fk = v_capstone.team_fk;

    select coalesce(array_agg(d.name order by d.name), coalesce(v_capstone.disciplines, '{}'::text[]))
      into v_departments
    from capstone_departments cd
    join departments d on d.department_id = cd.department_fk
    where cd.capstone_fk = v_capstone.capstone_id;

    select u.email
      into v_mentor_name
    from mentor_requests mr
    join users u on u.user_id = mr.mentor_fk
    where mr.capstone_fk = v_capstone.capstone_id
      and mr.status = 'accepted'
    order by mr.decided_at desc nulls last, mr.created_at desc
    limit 1;

    insert into past_watmatch_capstones (
      source_capstone_fk,
      source_team_fk,
      title,
      description,
      department,
      year,
      students,
      source_fk,
      completed_term,
      project_start_date,
      problem_area,
      main_objectives,
      scope_of_work,
      deliverables,
      deliverable_types,
      skills,
      mentor_name,
      external_partner_name,
      external_partner_organization,
      snapshot
    )
    values (
      v_capstone.capstone_id,
      v_capstone.team_fk,
      v_capstone.title,
      v_capstone.description,
      coalesce(v_departments, coalesce(v_capstone.disciplines, '{}'::text[])),
      coalesce(v_year, extract(year from current_date)::text),
      coalesce(v_students, '{}'::text[]),
      v_capstone.course_fk,
      coalesce(v_capstone.completed_term, v_current_term),
      v_capstone.project_start_date,
      v_capstone.problem_area,
      v_capstone.main_objectives,
      v_capstone.scope_of_work,
      v_capstone.deliverables,
      coalesce(v_capstone.deliverable_types, '{}'::text[]),
      coalesce(v_capstone.skills, '{}'::text[]),
      v_mentor_name,
      v_capstone.external_partner_name,
      v_capstone.external_partner_organization,
      jsonb_build_object(
        'capstone', to_jsonb(v_capstone),
        'team', (select to_jsonb(t) from teams t where t.team_id = v_capstone.team_fk),
        'members', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'user_id', u.user_id,
                'email', u.email,
                'home_department', hd.name,
                'course_fk', u.course_fk,
                'enrollment_course_fk', tm.enrollment_course_fk,
                'enrollment_course', case
                  when ec.course_id is null then null
                  else jsonb_build_object(
                    'course_id', ec.course_id,
                    'code', ec.code,
                    'name', ec.name,
                    'active', ec.active,
                    'routing_kind', ec.routing_kind,
                    'ecosystem_fk', ec.ecosystem_fk
                  )
                end,
                'is_leader', tm.is_leader
              )
              order by tm.is_leader desc, u.email
            )
            from team_memberships tm
            join users u on u.user_id = tm.user_fk
            left join courses ec on ec.course_id = tm.enrollment_course_fk
            left join departments hd on hd.department_id = u.home_department_fk
            where tm.team_fk = v_capstone.team_fk
          ),
          '[]'::jsonb
        ),
        'support_summary', watmatch_capstone_support_summary(v_capstone.capstone_id)
      )
    )
    on conflict (source_capstone_fk) do update
      set source_team_fk = excluded.source_team_fk,
          title = excluded.title,
          description = excluded.description,
          department = excluded.department,
          year = excluded.year,
          students = excluded.students,
          source_fk = excluded.source_fk,
          completed_term = excluded.completed_term,
          project_start_date = excluded.project_start_date,
          problem_area = excluded.problem_area,
          main_objectives = excluded.main_objectives,
          scope_of_work = excluded.scope_of_work,
          deliverables = excluded.deliverables,
          deliverable_types = excluded.deliverable_types,
          skills = excluded.skills,
          mentor_name = excluded.mentor_name,
          external_partner_name = excluded.external_partner_name,
          external_partner_organization = excluded.external_partner_organization,
          snapshot = excluded.snapshot
    returning past_watmatch_capstone_id into v_native_past_id;

    update capstones
    set closeout_decision = v_decision,
        closeout_decided_by_fk = p_actor_id,
        closeout_decided_at = v_now,
        closeout_applied_at = v_now,
        closeout_notes = v_notes,
        continued_to_course_fk = null,
        continued_to_term = null,
        continued_member_enrollment_routes = '{}'::jsonb,
        published_past_capstone_fk = null,
        published_watmatch_past_capstone_fk = v_native_past_id,
        carry_over_read_only = false,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_capstone;

    perform watmatch_archive_capstone(p_capstone_id, p_actor_id, 'admin', v_notes);
    select * into v_capstone from capstones where capstone_id = p_capstone_id;
  else
    update capstones
    set closeout_decision = v_decision,
        closeout_decided_by_fk = p_actor_id,
        closeout_decided_at = v_now,
        closeout_applied_at = v_now,
        closeout_notes = v_notes,
        continued_to_course_fk = null,
        continued_to_term = null,
        continued_member_enrollment_routes = '{}'::jsonb,
        published_past_capstone_fk = null,
        published_watmatch_past_capstone_fk = null,
        carry_over_read_only = false,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_capstone;

    perform watmatch_archive_capstone(p_capstone_id, p_actor_id, 'admin', v_notes);
    select * into v_capstone from capstones where capstone_id = p_capstone_id;
  end if;

  update project_explorations
  set status = 'expired',
      decided_by_fk = p_actor_id,
      decided_at = coalesce(decided_at, v_now),
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = v_now
  where capstone_fk = p_capstone_id
    and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

  update project_commitment_requests
  set status = 'cancelled',
      decided_by_fk = p_actor_id,
      decided_at = coalesce(decided_at, v_now),
      comments = coalesce(comments, 'Capstone closeout decision resolved this commitment.'),
      updated_at = v_now
  where capstone_fk = p_capstone_id
    and status = 'pending';

  perform watmatch_clear_team_commitment_roster_if_idle(v_capstone.team_fk);

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'capstone_closeout_decided',
    'capstone',
    p_capstone_id::text,
    v_notes,
    jsonb_build_object(
      'decision', v_decision,
      'target_course_id', p_target_course_id,
      'target_term', v_target_term,
      'member_enrollment_routes', v_member_enrollment_routes,
      'published_watmatch_past_capstone_id', v_native_past_id,
      'applied_continuations', v_applied_continuations
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Capstone closeout decision saved.',
    'data', watmatch_capstone_closeout_summary_json(v_capstone)
  );
end;
$$;

create or replace function watmatch_update_marketplace_settings(
  p_actor_id bigint,
  p_actor_role text,
  p_current_term text,
  p_phase text,
  p_exploration_starts_at timestamptz default null,
  p_commitment_starts_at timestamptz default null,
  p_finalization_starts_at timestamptz default null,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase text := lower(nullif(btrim(coalesce(p_phase, '')), ''));
  v_current_term text := nullif(btrim(coalesce(p_current_term, '')), '');
  v_settings marketplace_settings%rowtype;
  v_existing_settings marketplace_settings%rowtype;
  v_term_changed boolean := false;
  v_pending_capstone_count integer := 0;
  v_pending_commitment_count integer := 0;
  v_pending_enrollment_count integer := 0;
  v_invalid_member_enrollment_count integer := 0;
  v_support_gap_count integer := 0;
  v_closeout_required_count integer := 0;
  v_invalid_continuation_count integer := 0;
  v_unresolved_activity_count integer := 0;
  v_applied_continuation_count integer := 0;
  v_override_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_requires_override boolean := false;
  v_transition_kind text := 'settings_update';
begin
  if not watmatch_actor_can_manage_marketplace_settings(p_actor_id, p_actor_role) then
    raise exception 'Marketplace settings access required.' using errcode = '42501';
  end if;

  if v_phase not in ('exploration', 'commitment', 'finalization') then
    raise exception 'Marketplace phase must be exploration, commitment, or finalization.' using errcode = '23514';
  end if;

  if v_current_term is null or v_current_term !~ '^(Winter|Spring|Fall) [0-9]{4}$' then
    raise exception 'Marketplace term must use Winter <year>, Spring <year>, or Fall <year>.' using errcode = '23514';
  end if;

  select *
    into v_existing_settings
  from marketplace_settings
  where setting_id = 1;

  v_term_changed := not found or v_existing_settings.current_term is distinct from v_current_term;

  if found then
    if v_term_changed then
      v_transition_kind := 'term_transition';
      if not (
        v_existing_settings.phase = 'finalization'
        and v_phase = 'exploration'
      ) then
        v_requires_override := true;
      end if;
    elsif v_existing_settings.phase is distinct from v_phase then
      v_transition_kind := 'phase_transition';
      if not (
        (v_existing_settings.phase = 'exploration' and v_phase = 'commitment')
        or (v_existing_settings.phase = 'commitment' and v_phase = 'finalization')
      ) then
        v_requires_override := true;
      end if;
    end if;
  end if;

  if v_requires_override and v_override_reason is null then
    raise exception 'This marketplace transition is outside the normal cycle. Provide an override reason to continue.'
      using errcode = '23514';
  end if;

  if v_phase = 'finalization' or v_term_changed then
    perform watmatch_cleanup_unavailable_project_commitments(
      p_actor_id,
      'Marketplace transition readiness cleanup.'
    );

    select count(*)::integer
      into v_pending_capstone_count
    from capstones c
    where c.archived is not true
      and c.status in ('pending_review', 'pending_admin_course_routing');

    select count(*)::integer
      into v_pending_commitment_count
    from project_commitment_requests pcr
    where pcr.status = 'pending';

    select count(*)::integer
      into v_pending_enrollment_count
    from course_reassignment_requests crr
    where crr.status = 'pending';

    select count(*)::integer
      into v_invalid_member_enrollment_count
    from team_memberships tm
    join users u on u.user_id = tm.user_fk
    join teams t on t.team_id = tm.team_fk
    left join capstones c on c.capstone_id = t.capstone_fk
    left join courses ec on ec.course_id = tm.enrollment_course_fk
    where coalesce(t.status, '') <> 'archived'
      and coalesce(c.archived, false) is false
      and coalesce(c.status, '') in ('approved_recruiting', 'approved', 'complete')
      and (
        u.active is not true
        or tm.enrollment_course_fk is null
        or ec.course_id is null
        or ec.active is not true
        or not watmatch_course_has_active_instructor(ec.course_id)
      );

    select count(*)::integer
      into v_support_gap_count
    from capstones c
    join teams t on t.team_id = c.team_fk
    left join courses target_course on target_course.course_id = watmatch_target_course_fk(c.capstone_id, t.team_id)
    where c.archived is not true
      and c.status = 'approved_recruiting'
      and t.status not in ('archived', 'finalized')
      and c.closeout_decision is null
      and coalesce(c.carry_over_read_only, false) is false
      and coalesce(target_course.requires_project_support, true) is true
      and coalesce(c.external_partner_support_confirmed, false) is false
      and not exists (
        select 1
        from mentor_requests mr
        where mr.capstone_fk = c.capstone_id
          and mr.status = 'accepted'
      );

    if v_phase = 'finalization' or v_term_changed then
      select count(*)::integer
        into v_unresolved_activity_count
      from project_explorations pe
      join capstones c on c.capstone_id = pe.capstone_fk
      left join teams t on t.team_id = pe.team_fk
      where pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
        and c.archived is false
        and coalesce(t.status, '') not in ('archived', 'finalized');
    end if;

    if v_term_changed then
      select count(*)::integer
        into v_closeout_required_count
      from watmatch_closeout_required_capstone_rows();

      select count(*)::integer
        into v_invalid_continuation_count
      from capstones c
      where c.archived is false
        and c.closeout_decision = 'continue_to_course'
        and c.closeout_applied_at is null
        and c.continued_to_course_fk is not null
        and (c.continued_to_term is null or c.continued_to_term = v_current_term)
        and (
          not watmatch_course_available_for_term(c.continued_to_course_fk, coalesce(c.continued_to_term, v_current_term))
          or not watmatch_continuation_member_routes_ready(c.team_fk, c.continued_to_course_fk, coalesce(c.continued_to_term, v_current_term), c.continued_member_enrollment_routes)
        );
    end if;

    if v_pending_capstone_count > 0
       or v_pending_commitment_count > 0
       or v_pending_enrollment_count > 0
       or v_invalid_member_enrollment_count > 0
       or v_support_gap_count > 0
       or v_closeout_required_count > 0
       or v_invalid_continuation_count > 0
       or v_unresolved_activity_count > 0 then
      raise exception 'Marketplace transition is blocked. Resolve pending capstone review/routing (%), marketplace commitment routing (%), enrollment/roster routing signals (%), invalid official member enrollment (%), mentor/external partner support gaps (%), live capstones needing closeout (%), invalid pending continuations (%), and unresolved marketplace activity (%) before changing term or entering finalization.',
        v_pending_capstone_count,
        v_pending_commitment_count,
        v_pending_enrollment_count,
        v_invalid_member_enrollment_count,
        v_support_gap_count,
        v_closeout_required_count,
        v_invalid_continuation_count,
        v_unresolved_activity_count
        using errcode = '23514';
    end if;
  end if;

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
  values (
    1,
    v_current_term,
    v_phase,
    p_exploration_starts_at,
    p_commitment_starts_at,
    p_finalization_starts_at,
    p_actor_id,
    now()
  )
  on conflict (setting_id) do update
    set current_term = excluded.current_term,
        phase = excluded.phase,
        exploration_starts_at = excluded.exploration_starts_at,
        commitment_starts_at = excluded.commitment_starts_at,
        finalization_starts_at = excluded.finalization_starts_at,
        updated_by_fk = excluded.updated_by_fk,
        updated_at = excluded.updated_at
  returning * into v_settings;

  perform watmatch_sync_course_activation_for_current_term(
    p_actor_id,
    'marketplace_current_term_updated'
  );

  if v_term_changed then
    v_applied_continuation_count := watmatch_apply_pending_capstone_continuations(
      p_actor_id,
      p_actor_role
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
      lower(coalesce(p_actor_role, '')),
      'marketplace_settings_updated',
      'marketplace_settings',
      '1',
      coalesce(v_override_reason, v_phase),
      to_jsonb(v_settings) || jsonb_build_object(
        'transition_kind', v_transition_kind,
        'override_required', v_requires_override,
        'override_reason', v_override_reason,
        'previous_term', v_existing_settings.current_term,
        'previous_phase', v_existing_settings.phase,
        'applied_continuations', v_applied_continuation_count
      )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Marketplace settings updated.',
    'data', watmatch_marketplace_settings_json(),
    'applied_continuations', v_applied_continuation_count
  );
end;
$$;

create or replace function watmatch_project_exploration_json(p_exploration project_explorations)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student users%rowtype;
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_department departments%rowtype;
begin
  if p_exploration.exploration_id is null then
    return null;
  end if;

  select * into v_student from users where user_id = p_exploration.student_fk;
  select * into v_capstone from capstones where capstone_id = p_exploration.capstone_fk;
  select * into v_team from teams where team_id = p_exploration.team_fk;
  if v_student.home_department_fk is not null then
    select * into v_department from departments where department_id = v_student.home_department_fk;
  end if;

  return to_jsonb(p_exploration)
    || jsonb_build_object(
      'invite_id', p_exploration.exploration_id::text,
      'user_fk', p_exploration.student_fk,
      'student_commitment_confirmed', p_exploration.student_commitment_confirmed_at is not null,
      'team_commitment_confirmed', p_exploration.team_commitment_confirmed_at is not null,
      'commitment_confirmed_by_both',
        p_exploration.student_commitment_confirmed_at is not null
        and p_exploration.team_commitment_confirmed_at is not null,
      'student', case
        when v_student.user_id is null then null
        else jsonb_build_object(
          'user_id', v_student.user_id,
          'email', v_student.email,
          'course_fk', v_student.course_fk,
          'home_department_id', v_student.home_department_fk,
          'home_department', case
            when v_department.department_id is null then null
            else jsonb_build_object(
              'department_id', v_department.department_id,
              'name', v_department.name,
              'active', v_department.active
            )
          end
        )
      end,
      'capstone', case
        when v_capstone.capstone_id is null then null
        else jsonb_build_object(
          'capstone_id', v_capstone.capstone_id,
          'title', v_capstone.title,
          'description', v_capstone.description,
          'status', v_capstone.status,
          'marketplace_phase', watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id),
          'marketplace_phase_context', watmatch_marketplace_phase_context_for_capstone(v_capstone.capstone_id),
          'can_express_interest',
            watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id)
            and watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id) = 'exploration',
          'can_invite',
            watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id)
            and watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id) = 'exploration',
          'can_commit',
            watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id)
            and watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id) in ('exploration', 'commitment'),
          'course_fk', v_capstone.course_fk,
          'team_fk', v_capstone.team_fk
        )
      end,
      'team', case
        when v_team.team_id is null then null
        else jsonb_build_object(
          'team_id', v_team.team_id,
          'leader_fk', v_team.leader_fk,
          'course_fk', v_team.course_fk,
          'status', v_team.status,
          'capstone_fk', v_team.capstone_fk,
          'commitment_roster_confirmed_at', v_team.commitment_roster_confirmed_at,
          'commitment_roster_confirmed_by_fk', v_team.commitment_roster_confirmed_by_fk,
          'commitment_roster_note', v_team.commitment_roster_note
        )
      end
    );
end;
$$;

-- Adding the enrollment-routes parameter created a new overload on existing databases.
-- Remove the legacy signature so calls using the defaulted parameters stay unambiguous.
drop function if exists watmatch_apply_marketplace_commitment(
  bigint,
  bigint,
  bigint,
  text,
  text,
  bigint,
  text,
  boolean
);

create or replace function watmatch_apply_marketplace_commitment(
  p_exploration_id bigint,
  p_commitment_request_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_decision_route text,
  p_target_course_id bigint,
  p_comments text default null,
  p_direct_routed boolean default false,
  p_member_enrollment_routes jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(nullif(btrim(coalesce(p_actor_role, '')), ''), 'system'));
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_exploration project_explorations%rowtype;
  v_request project_commitment_requests%rowtype;
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_course courses%rowtype;
  v_enrollment_course courses%rowtype;
  v_student users%rowtype;
  v_route text;
  v_now timestamptz := now();
  v_member_enrollment_routes jsonb := coalesce(p_member_enrollment_routes, '{}'::jsonb);
  v_exploration_ids bigint[] := '{}'::bigint[];
  v_student_ids bigint[] := '{}'::bigint[];
  v_official_member_ids bigint[] := '{}'::bigint[];
  v_enrolled_user_ids bigint[] := '{}'::bigint[];
  v_candidate_count integer := 0;
  v_selected_requests jsonb := '[]'::jsonb;
  v_selected_explorations jsonb := '[]'::jsonb;
  v_routed_students jsonb := '[]'::jsonb;
  v_affected_request_ids jsonb := '[]'::jsonb;
  v_student_id bigint;
  v_student_enrollment_course_id bigint;
  v_student_enrollment_course_text text;
begin
  if p_exploration_id is null then
    raise exception 'Marketplace exploration is required.' using errcode = '22023';
  end if;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = p_exploration_id
  for update;

  if not found then
    raise exception 'Marketplace exploration not found.' using errcode = 'P0002';
  end if;

  if p_commitment_request_id is not null then
    select *
      into v_request
    from project_commitment_requests
    where commitment_request_id = p_commitment_request_id
    for update;

    if not found then
      raise exception 'Pending project commitment request not found.' using errcode = 'P0002';
    end if;

    if v_request.status <> 'pending' then
      if v_exploration.status = 'committed' then
        return jsonb_build_object(
          'exploration', watmatch_project_exploration_json(v_exploration),
          'explorations', jsonb_build_array(watmatch_project_exploration_json(v_exploration)),
          'commitment_request', to_jsonb(v_request),
          'commitment_requests', jsonb_build_array(to_jsonb(v_request)),
          'direct_routed', coalesce(p_direct_routed, false),
          'target_course', null,
          'capstone', null,
          'team', null,
          'committed_count', 0,
          'routed_students', '[]'::jsonb,
          'affected_commitment_request_ids', '[]'::jsonb,
          'review_reopened', false
        );
      end if;

      raise exception 'Pending project commitment request not found.' using errcode = 'P0002';
    end if;
  end if;

  select *
    into v_team
  from teams
  where team_id = v_exploration.team_fk
  for update;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_exploration.capstone_fk
  for update;

  select *
    into v_student
  from users
  where user_id = v_exploration.student_fk
  for update;

  if v_student.user_id is null or lower(coalesce(v_student.role, '')) <> 'student' or v_student.active is not true then
    raise exception 'Student is not active.' using errcode = '23514';
  end if;

  if v_team.team_id is null or v_team.status in ('archived', 'finalized') then
    raise exception 'Team is no longer active.' using errcode = '23514';
  end if;

  if v_capstone.capstone_id is null or v_capstone.archived is true then
    raise exception 'Capstone is no longer active.' using errcode = '23514';
  end if;

  if v_capstone.status <> 'approved_recruiting' then
    raise exception 'Capstone is no longer accepting commitments.' using errcode = '23514';
  end if;

  if v_exploration.status not in ('exploring', 'pending_commitment') then
    raise exception 'Only mutual marketplace explorations can be committed.' using errcode = '23514';
  end if;

  if v_exploration.student_commitment_confirmed_at is null
     or v_exploration.team_commitment_confirmed_at is null then
    raise exception 'Both the student and team must confirm commitment first.' using errcode = '23514';
  end if;

  if p_target_course_id is null then
    raise exception 'Target course is required for commitment approval.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_member_enrollment_routes) is distinct from 'object' then
    raise exception 'Member enrollment routes must be an object keyed by student ID.' using errcode = '22023';
  end if;

  v_course := watmatch_assert_course_ready_for_review(p_target_course_id, 'Target course');

  perform 1
  from project_explorations pe
  join users u on u.user_id = pe.student_fk
  where pe.capstone_fk = v_capstone.capstone_id
    and pe.team_fk = v_team.team_id
    and pe.status in ('exploring', 'pending_commitment')
    and pe.student_commitment_confirmed_at is not null
    and pe.team_commitment_confirmed_at is not null
    and lower(coalesce(u.role, '')) = 'student'
    and u.active is true
    and not exists (
      select 1
      from team_memberships tm
      where tm.user_fk = u.user_id
    )
  for update of pe, u;

  select
    coalesce(array_agg(pe.exploration_id order by case when pe.exploration_id = v_exploration.exploration_id then 0 else 1 end, pe.updated_at, pe.exploration_id), '{}'::bigint[]),
    coalesce(array_agg(u.user_id order by case when pe.exploration_id = v_exploration.exploration_id then 0 else 1 end, pe.updated_at, pe.exploration_id), '{}'::bigint[]),
    count(*)::integer
  into v_exploration_ids, v_student_ids, v_candidate_count
  from project_explorations pe
  join users u on u.user_id = pe.student_fk
  where pe.capstone_fk = v_capstone.capstone_id
    and pe.team_fk = v_team.team_id
    and pe.status in ('exploring', 'pending_commitment')
    and pe.student_commitment_confirmed_at is not null
    and pe.team_commitment_confirmed_at is not null
    and lower(coalesce(u.role, '')) = 'student'
    and u.active is true
    and not exists (
      select 1
      from team_memberships tm
      where tm.user_fk = u.user_id
    );

  if v_candidate_count = 0 or not (v_exploration.exploration_id = any(v_exploration_ids)) then
    raise exception 'No eligible mutually confirmed commitments found for this team.' using errcode = '23514';
  end if;

  select coalesce(array_agg(tm.user_fk order by tm.user_fk), '{}'::bigint[])
    into v_official_member_ids
  from team_memberships tm
  where tm.team_fk = v_team.team_id;

  select coalesce(array_agg(distinct member_id), '{}'::bigint[])
    into v_enrolled_user_ids
  from unnest(v_student_ids || v_official_member_ids) as enrolled(member_id);

  if exists (
    select 1
    from jsonb_object_keys(v_member_enrollment_routes) as route_keys(route_key)
    where route_key !~ '^[0-9]+$'
  ) then
    raise exception 'Member enrollment route keys must be student IDs.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_member_enrollment_routes) as route_keys(route_key)
    where case
      when route_key ~ '^[0-9]+$' then not (route_key::bigint = any(v_enrolled_user_ids))
      else false
    end
  ) then
    raise exception 'Member enrollment routes can only include students in the final commitment roster.' using errcode = '23514';
  end if;

  if coalesce(p_direct_routed, false) is not true
     and exists (
       select 1
       from unnest(v_enrolled_user_ids) as routed(member_id)
       where nullif(btrim(coalesce(v_member_enrollment_routes ->> routed.member_id::text, '')), '') is null
     ) then
    raise exception 'Staff-routed commitments require an explicit enrollment course for every final roster student.'
      using errcode = '23514';
  end if;

  if coalesce(p_direct_routed, false) is not true
     and v_comments is null
     and (
       (
         coalesce(v_capstone.requested_course_fk, v_team.course_fk, v_capstone.course_fk) is not null
         and p_target_course_id is distinct from coalesce(v_capstone.requested_course_fk, v_team.course_fk, v_capstone.course_fk)
       )
       or exists (
         select 1
         from unnest(v_enrolled_user_ids) as routed(member_id)
         left join users routed_user on routed_user.user_id = routed.member_id
         left join team_memberships routed_membership
           on routed_membership.team_fk = v_team.team_id
          and routed_membership.user_fk = routed.member_id
         cross join lateral (
           select nullif(btrim(coalesce(v_member_enrollment_routes ->> routed.member_id::text, '')), '') as route_text
         ) selected_route
         where selected_route.route_text is not null
           and selected_route.route_text ~ '^[0-9]+$'
           and coalesce(routed_membership.enrollment_course_fk, routed_user.course_fk) is not null
           and selected_route.route_text::bigint is distinct from coalesce(routed_membership.enrollment_course_fk, routed_user.course_fk)
       )
     ) then
    raise exception 'Decision notes are required when approving a changed coordinating or enrollment course route.'
      using errcode = '23514';
  end if;

  update teams
  set course_fk = v_course.course_id,
      ecosystem_fk = coalesce(v_course.ecosystem_fk, ecosystem_fk),
      commitment_roster_confirmed_at = null,
      commitment_roster_confirmed_by_fk = null,
      commitment_roster_note = null
  where team_id = v_team.team_id
  returning * into v_team;

  perform set_config('watmatch.skip_membership_marketplace_cleanup', 'true', true);
  perform set_config('watmatch.allow_membership_enrollment_reroute', 'true', true);
  foreach v_student_id in array v_enrolled_user_ids
  loop
    v_student_enrollment_course_text := nullif(btrim(coalesce(v_member_enrollment_routes ->> v_student_id::text, '')), '');
    if v_student_enrollment_course_text is not null and v_student_enrollment_course_text !~ '^[0-9]+$' then
      raise exception 'Enrollment course route for student % must be a course ID.', v_student_id using errcode = '22023';
    end if;

    select course_fk
      into v_student_enrollment_course_id
    from users
    where user_id = v_student_id
    for update;

    v_student_enrollment_course_id := coalesce(
      v_student_enrollment_course_text::bigint,
      v_student_enrollment_course_id,
      v_course.course_id
    );

    v_enrollment_course := watmatch_assert_course_ready_for_review(
      v_student_enrollment_course_id,
      'Enrollment course'
    );

    update users
    set course_fk = v_enrollment_course.course_id,
        updated_at = v_now
    where user_id = v_student_id;

    if v_student_id = any(v_student_ids) then
      perform watmatch_claim_team_membership(
        v_team.team_id,
        v_student_id,
        false,
        v_enrollment_course.course_id,
        p_actor_id,
        coalesce(v_comments, 'Marketplace commitment enrollment routed.')
      );
    else
      update team_memberships
      set enrollment_course_fk = v_enrollment_course.course_id,
          enrollment_routed_by_fk = p_actor_id,
          enrollment_routed_at = v_now,
          enrollment_notes = coalesce(v_comments, 'Marketplace final roster enrollment routed.')
      where team_fk = v_team.team_id
        and user_fk = v_student_id;
    end if;
  end loop;
  perform set_config('watmatch.allow_membership_enrollment_reroute', 'false', true);

  update capstones
  set course_fk = v_course.course_id,
      ecosystem_fk = coalesce(v_course.ecosystem_fk, ecosystem_fk),
      course_routed_by_fk = p_actor_id,
      course_routed_at = v_now,
      course_routing_notes = v_comments,
      updated_at = v_now
  where capstone_id = v_capstone.capstone_id
  returning * into v_capstone;

  perform watmatch_reset_capstone_course_requirements(v_capstone.capstone_id, v_team.team_id);

  v_route := case
    when coalesce(v_course.routing_kind, 'standard') = 'interdisciplinary' then 'interdisciplinary'
    when not exists (
      select 1
      from team_memberships tm
      where tm.team_fk = v_team.team_id
        and tm.enrollment_course_fk is distinct from v_course.course_id
    ) then 'course_enrolled'
    else 'other_course'
  end;

  with updated_requests as (
    update project_commitment_requests pcr
    set status = 'approved',
        decision_route = v_route,
        target_course_fk = v_course.course_id,
        comments = coalesce(v_comments, pcr.comments),
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        updated_at = v_now
    where pcr.status = 'pending'
      and pcr.capstone_fk = v_capstone.capstone_id
      and pcr.team_fk = v_team.team_id
      and pcr.exploration_fk = any(v_exploration_ids)
    returning pcr.*
  )
  select coalesce(jsonb_agg(to_jsonb(updated_requests) order by updated_requests.created_at, updated_requests.commitment_request_id), '[]'::jsonb)
    into v_selected_requests
  from updated_requests;

  select coalesce(jsonb_agg((request_item ->> 'commitment_request_id')::bigint), '[]'::jsonb)
    into v_affected_request_ids
  from jsonb_array_elements(v_selected_requests) as request_items(request_item);

  if p_commitment_request_id is not null then
    select *
      into v_request
    from project_commitment_requests
    where commitment_request_id = p_commitment_request_id;
  end if;

  with updated_explorations as (
    update project_explorations pe
    set status = 'committed',
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        updated_at = v_now
    where pe.exploration_id = any(v_exploration_ids)
    returning pe.*
  )
  select coalesce(jsonb_agg(to_jsonb(updated_explorations) order by updated_explorations.updated_at, updated_explorations.exploration_id), '[]'::jsonb)
    into v_selected_explorations
  from updated_explorations;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = p_exploration_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', u.user_id,
      'email', u.email,
      'course_fk', u.course_fk,
      'enrollment_course_fk', tm.enrollment_course_fk,
      'enrollment_course', case
        when ec.course_id is null then null
        else jsonb_build_object(
          'course_id', ec.course_id,
          'code', ec.code,
          'name', ec.name,
          'active', ec.active,
          'routing_kind', ec.routing_kind,
          'ecosystem_fk', ec.ecosystem_fk
        )
      end,
      'home_department_fk', u.home_department_fk,
      'home_department', case
        when d.department_id is null then null
        else jsonb_build_object(
          'department_id', d.department_id,
          'name', d.name,
          'active', d.active
        )
      end
    )
    order by u.email, u.user_id
  ), '[]'::jsonb)
    into v_routed_students
  from users u
  join team_memberships tm on tm.user_fk = u.user_id and tm.team_fk = v_team.team_id
  left join courses ec on ec.course_id = tm.enrollment_course_fk
  left join departments d on d.department_id = u.home_department_fk
  where u.user_id = any(v_enrolled_user_ids);

  update project_explorations
  set status = 'not_selected',
      decided_by_fk = p_actor_id,
      decided_at = v_now,
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = v_now
  where student_fk = any(v_student_ids)
    and not (exploration_id = any(v_exploration_ids))
    and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

  update capstones
  set approval = false,
      status = 'pending_review',
      course_routed_by_fk = p_actor_id,
      course_routed_at = v_now,
      course_routing_notes = v_comments,
      updated_at = v_now
  where capstone_id = v_capstone.capstone_id
  returning * into v_capstone;

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (
    v_capstone.capstone_id,
    case when p_direct_routed then null else p_actor_id end,
    case
      when p_direct_routed then 'marketplace_commitment_direct_routed'
      else 'project_commitment_approved'
    end,
    coalesce(
      v_comments,
      case
        when p_direct_routed then 'Same-course marketplace commitment sent directly to instructor review.'
        else 'Marketplace commitment approved and routed for instructor review.'
      end
    )
  );

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    case
      when p_direct_routed then 'marketplace_commitment_direct_routed'
      else 'project_commitment_approved'
    end,
    case
      when p_commitment_request_id is null then 'project_exploration'
      else 'project_commitment_request'
    end,
    coalesce(p_commitment_request_id::text, v_exploration.exploration_id::text),
    v_comments,
    jsonb_build_object(
      'exploration', watmatch_project_exploration_json(v_exploration),
      'explorations', v_selected_explorations,
      'commitment_request', case when v_request.commitment_request_id is null then null else to_jsonb(v_request) end,
      'commitment_requests', v_selected_requests,
      'affected_commitment_request_ids', v_affected_request_ids,
      'routed_students', v_routed_students,
      'target_course', to_jsonb(v_course),
      'coordinating_course', to_jsonb(v_course),
      'member_enrollment_routes', v_member_enrollment_routes,
      'capstone', to_jsonb(v_capstone),
      'team', to_jsonb(v_team),
      'direct_routed', coalesce(p_direct_routed, false),
      'committed_count', v_candidate_count,
      'routed_count', coalesce(array_length(v_enrolled_user_ids, 1), 0),
      'review_reopened', true,
      'enrolled_user_ids', to_jsonb(v_enrolled_user_ids)
    )
  );

  return jsonb_build_object(
    'exploration', watmatch_project_exploration_json(v_exploration),
    'explorations', v_selected_explorations,
    'commitment_request', case when v_request.commitment_request_id is null then null else to_jsonb(v_request) end,
    'commitment_requests', v_selected_requests,
    'affected_commitment_request_ids', v_affected_request_ids,
    'routed_students', v_routed_students,
    'direct_routed', coalesce(p_direct_routed, false),
    'target_course', to_jsonb(v_course),
    'coordinating_course', to_jsonb(v_course),
    'capstone', to_jsonb(v_capstone),
    'team', to_jsonb(v_team),
    'committed_count', v_candidate_count,
    'routed_count', coalesce(array_length(v_enrolled_user_ids, 1), 0),
    'review_reopened', true
  );
end;
$$;

create or replace function watmatch_reconcile_marketplace_commitments_after_course_assignment(
  p_student_id bigint,
  p_actor_id bigint default null,
  p_actor_role text default 'system',
  p_reason text default 'Student was manually assigned to a course.'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
  v_actor_role text := lower(coalesce(nullif(btrim(coalesce(p_actor_role, '')), ''), 'system'));
  v_reason text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Student was manually assigned to a course.');
begin
  if p_student_id is null or to_regclass('public.project_commitment_requests') is null then
    return 0;
  end if;

  perform pg_advisory_xact_lock(490000000000::bigint + p_student_id::bigint);

  for r in
    select
      pcr.commitment_request_id,
      pcr.exploration_fk,
      watmatch_target_course_fk(c.capstone_id, t.team_id) as target_course_fk,
      coalesce(pcr.requested_by_fk, pe.team_commitment_confirmed_by_fk, pe.student_commitment_confirmed_by_fk, c.user_fk) as fallback_actor_id,
      pcr.comments
    from project_commitment_requests pcr
    join project_explorations pe on pe.exploration_id = pcr.exploration_fk
    join users u on u.user_id = pcr.student_fk
    join teams t on t.team_id = pcr.team_fk
    join capstones c on c.capstone_id = pcr.capstone_fk
    join courses target_course on target_course.course_id = watmatch_target_course_fk(c.capstone_id, t.team_id)
    where pcr.status = 'pending'
      and pcr.student_fk = p_student_id
      and pe.status = 'pending_commitment'
      and pe.student_commitment_confirmed_at is not null
      and pe.team_commitment_confirmed_at is not null
      and lower(coalesce(u.role, '')) = 'student'
      and u.active is true
      and u.course_fk is not null
      and u.course_fk = watmatch_target_course_fk(c.capstone_id, t.team_id)
      and target_course.active is true
      and watmatch_course_has_active_instructor(target_course.course_id)
      and t.status not in ('archived', 'finalized')
      and c.archived is not true
      and c.status = 'approved_recruiting'
      and watmatch_team_has_course_mismatch(t.team_id, target_course.course_id) is false
      and not exists (
        select 1
        from team_memberships tm
        where tm.user_fk = u.user_id
      )
    order by pcr.created_at asc, pcr.commitment_request_id asc
  loop
    perform watmatch_apply_marketplace_commitment(
      r.exploration_fk,
      r.commitment_request_id,
      coalesce(p_actor_id, r.fallback_actor_id),
      v_actor_role,
      'course_enrolled',
      r.target_course_fk,
      coalesce(v_reason, r.comments, 'Auto-routed same-course marketplace commitment after course assignment.'),
      true,
      null::jsonb
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select
      pcr.commitment_request_id,
      pcr.exploration_fk,
      coalesce(
        pcr.requested_by_fk,
        pe.team_commitment_confirmed_by_fk,
        pe.student_commitment_confirmed_by_fk,
        c.user_fk
      ) as actor_id,
      coalesce(lower(actor_user.role), 'system') as actor_role,
      watmatch_target_course_fk(c.capstone_id, t.team_id) as target_course_fk,
      pcr.comments
    from project_commitment_requests pcr
    join project_explorations pe on pe.exploration_id = pcr.exploration_fk
    join users u on u.user_id = pcr.student_fk
    join teams t on t.team_id = pcr.team_fk
    join capstones c on c.capstone_id = pcr.capstone_fk
    left join users actor_user on actor_user.user_id = coalesce(
      pcr.requested_by_fk,
      pe.team_commitment_confirmed_by_fk,
      pe.student_commitment_confirmed_by_fk,
      c.user_fk
    )
    join courses target_course on target_course.course_id = watmatch_target_course_fk(c.capstone_id, t.team_id)
    where pcr.status = 'pending'
      and pe.status = 'pending_commitment'
      and pe.student_commitment_confirmed_at is not null
      and pe.team_commitment_confirmed_at is not null
      and lower(coalesce(u.role, '')) = 'student'
      and u.active is true
      and u.course_fk is not null
      and u.course_fk = watmatch_target_course_fk(c.capstone_id, t.team_id)
      and target_course.active is true
      and watmatch_course_has_active_instructor(target_course.course_id)
      and t.status not in ('archived', 'finalized')
      and c.archived is not true
      and c.status = 'approved_recruiting'
      and watmatch_team_has_course_mismatch(t.team_id, target_course.course_id) is false
      and not exists (
        select 1
        from team_memberships tm
        where tm.user_fk = u.user_id
      )
  loop
    perform watmatch_apply_marketplace_commitment(
      r.exploration_fk,
      r.commitment_request_id,
      r.actor_id,
      r.actor_role,
      'course_enrolled',
      r.target_course_fk,
      coalesce(r.comments, 'Auto-routed same-course marketplace commitment.'),
      true,
      null::jsonb
    );
  end loop;
end;
$$;

drop function if exists watmatch_upsert_project_exploration(bigint, bigint, text, text, bigint, text, integer);
drop function if exists watmatch_upsert_project_exploration(bigint, bigint, text, text, bigint, text, integer, text);

create or replace function watmatch_upsert_project_exploration(
  p_capstone_id bigint,
  p_student_id bigint,
  p_status text,
  p_source text,
  p_actor_id bigint,
  p_message text default null,
  p_priority_rank integer default null,
  p_override_reason text default null
)
returns project_explorations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(nullif(btrim(coalesce(p_status, '')), ''));
  v_source text := lower(coalesce(nullif(btrim(coalesce(p_source, '')), ''), 'student_marketplace'));
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_capstone capstones%rowtype;
  v_team teams%rowtype;
  v_student users%rowtype;
  v_existing project_explorations%rowtype;
  v_result project_explorations%rowtype;
  v_phase text := watmatch_current_marketplace_phase();
  v_actor_role text;
  v_is_staff boolean := false;
  v_override_reason text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_is_commitment_override boolean := false;
begin
  if p_capstone_id is null or p_student_id is null or p_actor_id is null then
    raise exception 'Invalid exploration request.' using errcode = '22023';
  end if;

  if v_status not in ('shortlisted', 'interested', 'invited', 'exploring') then
    raise exception 'Unsupported exploration status.' using errcode = '23514';
  end if;

  select lower(coalesce(role, ''))
    into v_actor_role
  from users
  where user_id = p_actor_id;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone not found.' using errcode = 'P0002';
  end if;

  v_phase := watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id);

  if v_phase = 'finalization' then
    raise exception 'The marketplace is in finalization. Staff can resolve official workflows, but new exploration is closed.' using errcode = '23514';
  end if;

  if not watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id) then
    raise exception 'This capstone is not accepting marketplace exploration.' using errcode = '23514';
  end if;

  if v_capstone.team_fk is null then
    raise exception 'No team found for this capstone.' using errcode = 'P0002';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found or v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  v_is_staff := coalesce(v_actor_role, '') in ('admin', 'academic_advisor', 'enrollment_operator');
  v_is_commitment_override :=
    v_phase = 'commitment'
    and v_source = 'staff_marketplace_override'
    and coalesce(v_actor_role, '') in ('admin', 'enrollment_operator')
    and v_override_reason is not null;

  if v_phase = 'commitment' and not v_is_commitment_override then
    raise exception 'The marketplace is in commitment. New exploration requires an admin or enrollment override reason.' using errcode = '23514';
  end if;

  if v_status in ('shortlisted', 'interested') then
    if not (p_actor_id = p_student_id or v_is_staff) then
      raise exception 'Only the student or routing staff can create this exploration status.' using errcode = '42501';
    end if;
  elsif v_status = 'invited' then
    if not (v_is_staff or (v_source = 'team_invite' and p_actor_id = v_team.leader_fk)) then
      raise exception 'Only the team leader or routing staff can invite a student.' using errcode = '42501';
    end if;
  elsif v_status = 'exploring' then
    if not (
      v_is_staff
      or (v_source = 'invite_acceptance' and p_actor_id = p_student_id)
      or (v_source = 'project_interest_acceptance' and p_actor_id = v_team.leader_fk)
    ) then
      raise exception 'Mutual exploration must start from invite acceptance, interest acceptance, or staff action.' using errcode = '42501';
    end if;
  end if;

  v_student := watmatch_assert_active_student(p_student_id);

  if v_phase <> 'exploration'
     and v_status = 'exploring'
     and v_student.course_fk is null then
    raise exception 'Students without a course can only explore projects during the marketplace exploration phase. Route the student to a course before commitment.' using errcode = '23514';
  end if;

  if v_phase <> 'exploration'
     and not v_is_commitment_override
     and not v_is_staff then
    raise exception 'The marketplace is not accepting new exploration activity right now.' using errcode = '23514';
  end if;

  if v_capstone.user_fk is not null and v_capstone.user_fk = p_student_id then
    raise exception 'You cannot request to join your own capstone.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from team_memberships
    where user_fk = p_student_id
  ) then
    raise exception 'This student is already committed to a capstone team.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from project_commitment_requests
    where student_fk = p_student_id
      and status = 'pending'
      and team_fk <> v_team.team_id
  ) then
    raise exception 'This student already has a pending commitment request.' using errcode = '23505';
  end if;

  select *
    into v_existing
  from project_explorations
  where capstone_fk = v_capstone.capstone_id
    and student_fk = p_student_id
  for update;

  if found and v_existing.status in ('pending_commitment', 'committed') then
    raise exception 'This student already has a commitment in progress for this capstone.' using errcode = '23505';
  end if;

  if found and v_existing.status = 'declined' and not v_is_staff then
    if not (
      v_existing.decided_by_fk = p_student_id
      and p_actor_id = p_student_id
      and v_status in ('shortlisted', 'interested')
    ) and not (
      v_existing.decided_by_fk = v_team.leader_fk
      and p_actor_id = v_team.leader_fk
      and v_status in ('invited', 'exploring')
    ) then
      raise exception 'This marketplace relationship was declined. The other side or staff must reopen it.' using errcode = '23514';
    end if;
  end if;

  insert into project_explorations (
    capstone_fk,
    team_fk,
    student_fk,
    status,
    source,
    priority_rank,
    message,
    created_by_fk,
    updated_at
  )
  values (
    v_capstone.capstone_id,
    v_team.team_id,
    p_student_id,
    v_status,
    v_source,
    p_priority_rank,
    v_message,
    p_actor_id,
    now()
  )
  on conflict (capstone_fk, student_fk) do update
    set team_fk = excluded.team_fk,
        status = case
          when project_explorations.status in ('pending_commitment', 'committed') then project_explorations.status
          when excluded.status = 'shortlisted'
               and project_explorations.status in ('interested', 'invited', 'exploring') then project_explorations.status
          when excluded.status = 'interested'
               and project_explorations.status in ('invited', 'exploring') then project_explorations.status
          when excluded.status = 'invited'
               and project_explorations.status = 'exploring' then project_explorations.status
          else excluded.status
        end,
        source = excluded.source,
        priority_rank = coalesce(excluded.priority_rank, project_explorations.priority_rank),
        message = coalesce(excluded.message, project_explorations.message),
        decided_by_fk = case
          when excluded.status in ('exploring') then p_actor_id
          when project_explorations.status in ('withdrawn', 'declined', 'not_selected', 'expired') then null
          else project_explorations.decided_by_fk
        end,
        decided_at = case
          when excluded.status in ('exploring') then now()
          when project_explorations.status in ('withdrawn', 'declined', 'not_selected', 'expired') then null
          else project_explorations.decided_at
        end,
        student_commitment_confirmed_at = case
          when project_explorations.status in ('withdrawn', 'declined', 'not_selected', 'expired') then null
          else project_explorations.student_commitment_confirmed_at
        end,
        student_commitment_confirmed_by_fk = case
          when project_explorations.status in ('withdrawn', 'declined', 'not_selected', 'expired') then null
          else project_explorations.student_commitment_confirmed_by_fk
        end,
        team_commitment_confirmed_at = case
          when project_explorations.status in ('withdrawn', 'declined', 'not_selected', 'expired') then null
          else project_explorations.team_commitment_confirmed_at
        end,
        team_commitment_confirmed_by_fk = case
          when project_explorations.status in ('withdrawn', 'declined', 'not_selected', 'expired') then null
          else project_explorations.team_commitment_confirmed_by_fk
        end,
        updated_at = now()
  returning * into v_result;

  if v_is_commitment_override then
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_actor_role,
      'marketplace_exploration_staff_override',
      'project_exploration',
      v_result.exploration_id::text,
      v_override_reason,
      watmatch_project_exploration_json(v_result)
    );
  end if;

  return v_result;
end;
$$;

create or replace function watmatch_express_project_interest(
  p_capstone_id bigint,
  p_student_id bigint,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capstone capstones%rowtype;
  v_exploration project_explorations%rowtype;
begin
  if p_capstone_id is null or p_student_id is null then
    raise exception 'Invalid interest request.' using errcode = '22023';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id;

  if not found or v_capstone.team_fk is null then
    raise exception 'Capstone not found.' using errcode = 'P0002';
  end if;

  perform watmatch_assert_no_cross_pending_team_relationship(v_capstone.team_fk, p_student_id, 'interest');

  v_exploration := watmatch_upsert_project_exploration(
    p_capstone_id,
    p_student_id,
    'interested',
    'student_marketplace',
    p_student_id,
    p_message,
    null::integer,
    null::text
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Interest recorded.',
    'data', watmatch_project_exploration_json(v_exploration)
  );
end;
$$;

create or replace function watmatch_withdraw_project_interest(
  p_capstone_id bigint,
  p_student_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exploration project_explorations%rowtype;
begin
  if p_capstone_id is null or p_student_id is null then
    raise exception 'Invalid interest withdrawal request.' using errcode = '22023';
  end if;

  update project_explorations
  set status = 'withdrawn',
      decided_by_fk = p_student_id,
      decided_at = now(),
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = now()
  where capstone_fk = p_capstone_id
    and student_fk = p_student_id
    and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
  returning * into v_exploration;

  update project_commitment_requests
  set status = 'cancelled',
      decided_by_fk = p_student_id,
      decided_at = now(),
      comments = coalesce(comments, 'Student withdrew marketplace exploration.'),
      updated_at = now()
  where capstone_fk = p_capstone_id
    and student_fk = p_student_id
    and status = 'pending';

  return jsonb_build_object(
    'success', true,
    'message', 'Marketplace interest withdrawn.',
    'data', coalesce(watmatch_project_exploration_json(v_exploration), jsonb_build_object('capstone_id', p_capstone_id, 'student_id', p_student_id, 'already_resolved', true))
  );
end;
$$;

create or replace function watmatch_accept_project_interest(
  p_team_id bigint,
  p_student_id bigint,
  p_actor_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_existing project_explorations%rowtype;
  v_exploration project_explorations%rowtype;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can accept exploratory candidates.' using errcode = '42501';
  end if;

  if v_team.status in ('archived', 'finalized') or v_team.capstone_fk is null then
    raise exception 'This team is not accepting exploratory candidates.' using errcode = '23514';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_team.capstone_fk
  for update;

  if not found or not watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id) then
    raise exception 'This capstone is not accepting exploratory candidates.' using errcode = '23514';
  end if;

  select *
    into v_existing
  from project_explorations
  where team_fk = p_team_id
    and student_fk = p_student_id
    and status = 'interested'
  for update;

  if not found then
    raise exception 'Student has not expressed interest in this team.' using errcode = 'P0002';
  end if;

  v_exploration := watmatch_upsert_project_exploration(
    v_capstone.capstone_id,
    p_student_id,
    'exploring',
    'project_interest_acceptance',
    p_actor_id,
    null::text,
    null::integer,
    null::text
  );

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    'student',
    'project_exploration_started',
    'project_exploration',
    v_exploration.exploration_id::text,
    'Team leader accepted student interest for marketplace exploration.',
    watmatch_project_exploration_json(v_exploration)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Student moved into marketplace exploration. Commit later when both sides are ready.',
    'data', jsonb_build_object('exploration', watmatch_project_exploration_json(v_exploration), 'team', to_jsonb(v_team)),
    'marketplace_exploration', true
  );
end;
$$;

drop function if exists watmatch_reject_project_interest(bigint, bigint, bigint);

create or replace function watmatch_reject_project_interest(
  p_team_id bigint,
  p_student_id bigint,
  p_actor_id bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_exploration project_explorations%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_reason is null then
    raise exception 'A short rejection reason is required.' using errcode = '23514';
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can reject requests.' using errcode = '42501';
  end if;

  update project_explorations
  set status = 'declined',
      decided_by_fk = p_actor_id,
      decided_at = now(),
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = now()
  where team_fk = p_team_id
    and student_fk = p_student_id
    and status = 'interested'
  returning * into v_exploration;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Student exploration request was already resolved.',
      'data', jsonb_build_object(
        'rejected', false,
        'already_resolved', true,
        'capstone_id', v_team.capstone_fk,
        'student_id', p_student_id
      )
    );
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    'student',
    'project_exploration_declined',
    'project_exploration',
    v_exploration.exploration_id::text,
    v_reason,
    watmatch_project_exploration_json(v_exploration)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Student exploration request declined.',
    'data', jsonb_build_object(
      'rejected', true,
      'reason', v_reason,
      'capstone_id', v_team.capstone_fk,
      'exploration', watmatch_project_exploration_json(v_exploration)
    )
  );
end;
$$;

create or replace function watmatch_create_invite(
  p_team_id bigint,
  p_user_id bigint,
  p_actor_id bigint,
  p_invite_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_exploration project_explorations%rowtype;
begin
  if p_team_id is null or p_user_id is null or p_actor_id is null then
    raise exception 'Invalid invite request.' using errcode = '22023';
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team with ID % not found.', p_team_id using errcode = 'P0002';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can create invites.' using errcode = '42501';
  end if;

  if v_team.capstone_fk is null then
    raise exception 'Teams can invite students only after an approved recruiting capstone is linked.' using errcode = '23514';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_team.capstone_fk
  for update;

  if not found or not watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id) then
    raise exception 'This team is not accepting invites right now.' using errcode = '23514';
  end if;

  perform watmatch_assert_no_cross_pending_team_relationship(p_team_id, p_user_id, 'invite');

  v_exploration := watmatch_upsert_project_exploration(
    v_capstone.capstone_id,
    p_user_id,
    'invited',
    'team_invite',
    p_actor_id,
    null::text,
    null::integer,
    null::text
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Invite created successfully.',
    'data', watmatch_project_exploration_json(v_exploration)
  );
end;
$$;

create or replace function watmatch_accept_invite(
  p_invite_id text,
  p_user_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id text := nullif(btrim(coalesce(p_invite_id, '')), '');
  v_exploration project_explorations%rowtype;
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
begin
  if v_invite_id is null or p_user_id is null or v_invite_id !~ '^[0-9]+$' then
    raise exception 'Invalid invite acceptance request.' using errcode = '22023';
  end if;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = v_invite_id::bigint
    and student_fk = p_user_id
  for update;

  if not found or v_exploration.status <> 'invited' then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already accepted, declined, or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  select *
    into v_team
  from teams
  where team_id = v_exploration.team_fk
  for update;

  if not found or v_team.status in ('archived', 'finalized') or v_team.capstone_fk is null then
    update project_explorations
    set status = 'expired',
        decided_at = coalesce(decided_at, now()),
        updated_at = now()
    where exploration_id = v_exploration.exploration_id;
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer actionable and has been expired.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'expired', true)
    );
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_exploration.capstone_fk
  for update;

  if not found
     or v_capstone.team_fk is distinct from v_team.team_id
     or not watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id) then
    update project_explorations
    set status = 'expired',
        decided_at = coalesce(decided_at, now()),
        updated_at = now()
    where exploration_id = v_exploration.exploration_id;
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer actionable and has been expired.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'expired', true)
    );
  end if;

  v_exploration := watmatch_upsert_project_exploration(
    v_capstone.capstone_id,
    p_user_id,
    'exploring',
    'invite_acceptance',
    p_user_id,
    null::text,
    null::integer,
    null::text
  );

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_user_id,
    'student',
    'project_exploration_started',
    'project_exploration',
    v_exploration.exploration_id::text,
    'Student accepted team invite for marketplace exploration.',
    watmatch_project_exploration_json(v_exploration)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Invite accepted for marketplace exploration. Commit later when both sides are ready.',
    'data', jsonb_build_object('exploration', watmatch_project_exploration_json(v_exploration), 'invite_id', p_invite_id, 'team', to_jsonb(v_team)),
    'marketplace_exploration', true
  );
end;
$$;

create or replace function watmatch_decline_invite(
  p_invite_id text,
  p_user_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id text := nullif(btrim(coalesce(p_invite_id, '')), '');
  v_exploration project_explorations%rowtype;
begin
  if v_invite_id is null or p_user_id is null or v_invite_id !~ '^[0-9]+$' then
    raise exception 'Invalid invite decline request.' using errcode = '22023';
  end if;

  update project_explorations
  set status = 'declined',
      decided_by_fk = p_user_id,
      decided_at = now(),
      updated_at = now()
  where exploration_id = v_invite_id::bigint
    and student_fk = p_user_id
    and status = 'invited'
  returning * into v_exploration;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already declined or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Invite declined.',
    'data', watmatch_project_exploration_json(v_exploration)
  );
end;
$$;

drop function if exists watmatch_revoke_invite(text, bigint, text);

create or replace function watmatch_revoke_invite(
  p_invite_id text,
  p_actor_id bigint,
  p_actor_role text default 'student',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id text := nullif(btrim(coalesce(p_invite_id, '')), '');
  v_role text := lower(coalesce(p_actor_role, 'student'));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_exploration project_explorations%rowtype;
  v_team teams%rowtype;
begin
  if v_invite_id is null or p_actor_id is null or v_invite_id !~ '^[0-9]+$' then
    raise exception 'Invalid invite revoke request.' using errcode = '22023';
  end if;

  if v_reason is not null and char_length(v_reason) > 2000 then
    raise exception 'Invite revocation reason must be 2000 characters or fewer.' using errcode = '22023';
  end if;

  if v_role in ('admin', 'instructor') and v_reason is null then
    raise exception 'Staff invite revocation requires an audit reason.' using errcode = '23514';
  end if;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = v_invite_id::bigint
  for update;

  if not found or v_exploration.status <> 'invited' then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already revoked or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  select *
    into v_team
  from teams
  where team_id = v_exploration.team_fk
  for update;

  if not found then
    update project_explorations
    set status = 'expired',
        decided_at = coalesce(decided_at, now()),
        updated_at = now()
    where exploration_id = v_exploration.exploration_id;
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer actionable and has been expired.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'expired', true)
    );
  end if;

  if v_team.leader_fk is distinct from p_actor_id
     and watmatch_actor_can_manage_team(v_team.team_id, p_actor_id, v_role) is not true then
    raise exception 'Only the team leader or scoped instructors/admins can revoke invites.' using errcode = '42501';
  end if;

  update project_explorations
  set status = 'declined',
      decided_by_fk = p_actor_id,
      decided_at = now(),
      updated_at = now()
  where exploration_id = v_exploration.exploration_id
  returning * into v_exploration;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'project_invite_revoked',
    'project_exploration',
    v_exploration.exploration_id::text,
    coalesce(v_reason, 'Team leader revoked pending invitation.'),
    watmatch_project_exploration_json(v_exploration) || jsonb_build_object(
      'previous_status', 'invited',
      'new_status', 'declined',
      'team_fk', v_team.team_id,
      'student_fk', v_exploration.student_fk,
      'student_id', v_exploration.student_fk,
      'staff_initiated', v_role in ('admin', 'instructor')
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Invite revoked successfully.',
    'data', watmatch_project_exploration_json(v_exploration)
  );
end;
$$;

create or replace function watmatch_cleanup_unavailable_marketplace_relationships(
  p_actor_id bigint,
  p_actor_role text,
  p_user_id bigint default null,
  p_team_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_team teams%rowtype;
  v_deleted_count integer := 0;
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if p_user_id is null and p_team_id is null then
    raise exception 'A user or team scope is required.' using errcode = '22023';
  end if;

  if p_user_id is not null
     and p_team_id is null
     and p_actor_id is distinct from p_user_id
     and v_role <> 'admin' then
    raise exception 'Forbidden. You can only clean up your own marketplace relationships.' using errcode = '42501';
  end if;

  if p_team_id is not null then
    select *
      into v_team
    from teams
    where team_id = p_team_id
    for update;

    if not found then
      return jsonb_build_object(
        'success', true,
        'message', 'Marketplace cleanup completed.',
        'data', jsonb_build_object('deleted', 0)
      );
    end if;

    if v_team.leader_fk is distinct from p_actor_id
       and watmatch_actor_can_manage_team(v_team.team_id, p_actor_id, v_role) is not true then
      raise exception 'Forbidden. You cannot clean up marketplace relationships for this team.' using errcode = '42501';
    end if;
  end if;

  with expired as (
    update project_explorations pe
    set status = 'expired',
        decided_by_fk = coalesce(p_actor_id, pe.decided_by_fk),
        decided_at = coalesce(pe.decided_at, now()),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = now()
    from teams t
    left join capstones c on c.capstone_id = t.capstone_fk
    where pe.team_fk = t.team_id
      and pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
      and (p_user_id is null or pe.student_fk = p_user_id)
      and (p_team_id is null or pe.team_fk = p_team_id)
      and (
        t.status in ('archived', 'finalized')
        or t.capstone_fk is null
        or exists (
          select 1
          from team_memberships tm
          where tm.user_fk = pe.student_fk
        )
        or (
          t.capstone_fk is not null
          and (
            c.capstone_id is null
            or c.archived is true
            or c.status <> 'approved_recruiting'
            or c.team_fk is distinct from t.team_id
            or not watmatch_capstone_accepts_marketplace_activity(c.capstone_id)
          )
        )
      )
    returning pe.exploration_id
  )
  select count(*)::integer
    into v_deleted_count
  from expired;

  return jsonb_build_object(
    'success', true,
    'message', 'Unavailable marketplace relationships expired.',
    'data', jsonb_build_object('expired', v_deleted_count)
  );
end;
$$;

create or replace function watmatch_create_project_commitment_request(
  p_exploration_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_phase text := watmatch_current_marketplace_phase();
  v_exploration project_explorations%rowtype;
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_student users%rowtype;
  v_request project_commitment_requests%rowtype;
  v_is_staff boolean := false;
  v_awaiting_side text;
  v_target_course_fk bigint;
  v_direct_result jsonb;
  v_candidate_count integer := 0;
  v_direct_candidate_count integer := 0;
  v_seed_request_id bigint;
  v_roster_confirmed boolean := false;
begin
  if p_exploration_id is null or p_actor_id is null then
    raise exception 'Invalid commitment request.' using errcode = '22023';
  end if;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = p_exploration_id
  for update;

  if not found then
    raise exception 'Marketplace exploration not found.' using errcode = 'P0002';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_exploration.team_fk
  for update;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_exploration.capstone_fk
  for update;

  if v_team.team_id is null or v_capstone.capstone_id is null then
    raise exception 'Linked team or capstone not found.' using errcode = 'P0002';
  end if;

  v_phase := watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id);

  if v_phase = 'finalization' then
    raise exception 'The marketplace is in finalization. Staff can resolve official workflows, but new commitments are closed.' using errcode = '23514';
  end if;

  if v_team.status in ('archived', 'finalized') or v_capstone.archived is true then
    raise exception 'This project is no longer accepting commitments.' using errcode = '23514';
  end if;

  if not watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id) then
    raise exception 'This project is no longer accepting commitments.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(490000000000::bigint + v_exploration.student_fk::bigint);

  v_is_staff := watmatch_actor_can_route_commitments(p_actor_id, v_role);

  if v_role = 'student' then
    if p_actor_id not in (v_exploration.student_fk, v_team.leader_fk) then
      raise exception 'Only the student or team leader can request this commitment.' using errcode = '42501';
    end if;
  elsif not v_is_staff then
    raise exception 'Commitment routing access required.' using errcode = '42501';
  end if;

  if v_exploration.status not in ('exploring', 'pending_commitment') then
    raise exception 'Only mutual marketplace explorations can be committed.' using errcode = '23514';
  end if;

  if v_team.commitment_roster_confirmed_at is not null
     and v_exploration.status <> 'pending_commitment' then
    raise exception 'The final roster has already been sent for routing. Return the roster to exploring before changing it.' using errcode = '23514';
  end if;

  if v_team.commitment_roster_confirmed_at is not null
     and (
       v_exploration.student_commitment_confirmed_at is null
       or v_exploration.team_commitment_confirmed_at is null
     ) then
    raise exception 'The final roster has already been sent for routing. Return the roster to exploring before changing it.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from team_memberships
    where user_fk = v_exploration.student_fk
  ) then
    raise exception 'This student is already committed to a capstone.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from project_commitment_requests
    where student_fk = v_exploration.student_fk
      and status = 'pending'
      and team_fk <> v_exploration.team_fk
  ) then
    raise exception 'This student already has a pending commitment request for another project.' using errcode = '23505';
  end if;

  if v_role = 'student' and p_actor_id = v_exploration.student_fk then
    if exists (
      select 1
      from project_explorations
      where student_fk = v_exploration.student_fk
        and exploration_id <> v_exploration.exploration_id
        and student_commitment_confirmed_at is not null
        and status in ('exploring', 'pending_commitment')
    ) then
      raise exception 'This student already confirmed commitment intent for another project.' using errcode = '23505';
    end if;

    update project_explorations
    set student_commitment_confirmed_at = coalesce(student_commitment_confirmed_at, now()),
        student_commitment_confirmed_by_fk = coalesce(student_commitment_confirmed_by_fk, p_actor_id),
        updated_at = now()
    where exploration_id = v_exploration.exploration_id
    returning * into v_exploration;
  elsif v_role = 'student' and p_actor_id = v_team.leader_fk then
    update project_explorations
    set team_commitment_confirmed_at = coalesce(team_commitment_confirmed_at, now()),
        team_commitment_confirmed_by_fk = coalesce(team_commitment_confirmed_by_fk, p_actor_id),
        updated_at = now()
    where exploration_id = v_exploration.exploration_id
    returning * into v_exploration;
  else
    update project_explorations
    set student_commitment_confirmed_at = coalesce(student_commitment_confirmed_at, now()),
        student_commitment_confirmed_by_fk = coalesce(student_commitment_confirmed_by_fk, p_actor_id),
        team_commitment_confirmed_at = coalesce(team_commitment_confirmed_at, now()),
        team_commitment_confirmed_by_fk = coalesce(team_commitment_confirmed_by_fk, p_actor_id),
        updated_at = now()
    where exploration_id = v_exploration.exploration_id
    returning * into v_exploration;
  end if;

  if v_exploration.student_commitment_confirmed_at is null
     or v_exploration.team_commitment_confirmed_at is null then
    v_awaiting_side := case
      when v_exploration.student_commitment_confirmed_at is null then 'student'
      else 'team'
    end;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      'project_commitment_confirmation_recorded',
      'project_exploration',
      v_exploration.exploration_id::text,
      v_comments,
      watmatch_project_exploration_json(v_exploration)
    );

    return jsonb_build_object(
      'success', true,
      'message', case
        when v_awaiting_side = 'student' then 'Commitment confirmation recorded. Waiting for the student to confirm.'
        else 'Commitment confirmation recorded. Waiting for the team to confirm.'
      end,
      'data', jsonb_build_object(
        'exploration', watmatch_project_exploration_json(v_exploration),
        'commitment_request', null,
        'awaiting_side', v_awaiting_side
      )
    );
  end if;

  select *
    into v_student
  from users
  where user_id = v_exploration.student_fk
  for update;

  v_roster_confirmed := v_team.commitment_roster_confirmed_at is not null;

  if not v_roster_confirmed then
    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      'project_commitment_waiting_for_roster_confirmation',
      'project_exploration',
      v_exploration.exploration_id::text,
      v_comments,
      watmatch_project_exploration_json(v_exploration)
    );

    return jsonb_build_object(
      'success', true,
        'message', 'Commitment confirmation recorded. Waiting for the team leader to send the roster proposal for routing.',
      'data', jsonb_build_object(
        'exploration', watmatch_project_exploration_json(v_exploration),
        'commitment_request', null,
        'awaiting_side', 'roster',
        'roster_confirmation_required', true
      )
    );
  end if;

  v_target_course_fk := watmatch_target_course_fk(v_capstone.capstone_id, v_team.team_id);

  select
    count(*)::integer,
    count(*) filter (
      where u.course_fk is not null
        and u.course_fk = v_target_course_fk
    )::integer
  into v_candidate_count, v_direct_candidate_count
  from project_explorations pe
  join users u on u.user_id = pe.student_fk
  where pe.capstone_fk = v_capstone.capstone_id
    and pe.team_fk = v_team.team_id
    and pe.status in ('exploring', 'pending_commitment')
    and pe.student_commitment_confirmed_at is not null
    and pe.team_commitment_confirmed_at is not null
    and lower(coalesce(u.role, '')) = 'student'
    and u.active is true
    and not exists (
      select 1
      from team_memberships tm
      where tm.user_fk = u.user_id
    );

  if v_candidate_count > 0
     and v_candidate_count = v_direct_candidate_count
     and v_target_course_fk is not null
     and watmatch_team_has_course_mismatch(v_team.team_id, v_target_course_fk) is false
     and exists (
       select 1
       from courses c
       where c.course_id = v_target_course_fk
         and c.active is true
     )
     and watmatch_course_has_active_instructor(v_target_course_fk) then
    v_direct_result := watmatch_apply_marketplace_commitment(
      v_exploration.exploration_id,
      null,
      p_actor_id,
      v_role,
      'course_enrolled',
      v_target_course_fk,
      coalesce(v_comments, 'Same-course marketplace commitment confirmed.'),
      true,
      null::jsonb
    );

    return jsonb_build_object(
      'success', true,
      'message', 'Same-course commitment sent directly to instructor review.',
      'data', v_direct_result
    );
  end if;

  if v_candidate_count = 0 then
    raise exception 'No eligible mutually confirmed commitments found for this team.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from project_commitment_requests pcr
    join project_explorations pe
      on pe.capstone_fk = v_capstone.capstone_id
      and pe.team_fk = v_team.team_id
      and pe.student_fk = pcr.student_fk
    where pcr.status = 'pending'
      and pcr.team_fk <> v_team.team_id
      and pe.status in ('exploring', 'pending_commitment')
      and pe.student_commitment_confirmed_at is not null
      and pe.team_commitment_confirmed_at is not null
  ) then
    raise exception 'At least one confirmed student already has a pending commitment request for another project.' using errcode = '23505';
  end if;

  with confirmed_candidates as (
    select pe.*
    from project_explorations pe
    join users u on u.user_id = pe.student_fk
    where pe.capstone_fk = v_capstone.capstone_id
      and pe.team_fk = v_team.team_id
      and pe.status in ('exploring', 'pending_commitment')
      and pe.student_commitment_confirmed_at is not null
      and pe.team_commitment_confirmed_at is not null
      and lower(coalesce(u.role, '')) = 'student'
      and u.active is true
      and not exists (
        select 1
        from team_memberships tm
        where tm.user_fk = u.user_id
      )
  )
  insert into project_commitment_requests (
    exploration_fk,
    capstone_fk,
    team_fk,
    student_fk,
    status,
    requested_by_fk,
    comments,
    updated_at
  )
  select
    candidate.exploration_id,
    candidate.capstone_fk,
    candidate.team_fk,
    candidate.student_fk,
    'pending',
    p_actor_id,
    v_comments,
    now()
  from confirmed_candidates candidate
  on conflict (student_fk)
  where status = 'pending'
  do update
    set exploration_fk = excluded.exploration_fk,
        capstone_fk = excluded.capstone_fk,
        team_fk = excluded.team_fk,
        requested_by_fk = excluded.requested_by_fk,
        comments = excluded.comments,
        updated_at = now();

  with confirmed_candidates as (
    select pe.exploration_id
    from project_explorations pe
    join users u on u.user_id = pe.student_fk
    where pe.capstone_fk = v_capstone.capstone_id
      and pe.team_fk = v_team.team_id
      and pe.status in ('exploring', 'pending_commitment')
      and pe.student_commitment_confirmed_at is not null
      and pe.team_commitment_confirmed_at is not null
      and lower(coalesce(u.role, '')) = 'student'
      and u.active is true
      and not exists (
        select 1
        from team_memberships tm
        where tm.user_fk = u.user_id
      )
  )
  update project_explorations pe
  set status = 'pending_commitment',
      updated_at = now()
  from confirmed_candidates candidate
  where pe.exploration_id = candidate.exploration_id;

  select *
    into v_request
  from project_commitment_requests
  where exploration_fk = v_exploration.exploration_id
    and status = 'pending'
  limit 1;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = p_exploration_id;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'project_commitment_requested',
    'project_commitment_request',
    coalesce(v_request.commitment_request_id::text, v_exploration.exploration_id::text),
    v_comments,
    jsonb_build_object(
      'seed_request', case when v_request.commitment_request_id is null then null else to_jsonb(v_request) end,
      'team_id', v_team.team_id,
      'capstone_id', v_capstone.capstone_id,
      'pending_candidate_count', v_candidate_count
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Project commitment request created.',
    'data', to_jsonb(v_request) || jsonb_build_object('exploration', watmatch_project_exploration_json(v_exploration))
  );
end;
$$;

create or replace function watmatch_confirm_team_commitment_roster(
  p_team_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(nullif(btrim(coalesce(p_actor_role, '')), ''), 'system'));
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_phase text := watmatch_current_marketplace_phase();
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_is_staff boolean := false;
  v_seed_exploration_id bigint;
  v_candidate_count integer := 0;
  v_result jsonb;
begin
  if p_team_id is null or p_actor_id is null then
    raise exception 'Invalid roster confirmation request.' using errcode = '22023';
  end if;

  select *
    into v_team
  from teams
  where team_id = p_team_id
  for update;

  if not found then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_team.capstone_fk
  for update;

  if v_capstone.capstone_id is null then
    raise exception 'Linked capstone not found.' using errcode = 'P0002';
  end if;

  v_phase := watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id);

  if v_phase = 'finalization' then
    raise exception 'The marketplace is in finalization. Staff can resolve existing queues, but new roster confirmations are closed.' using errcode = '23514';
  end if;

  if v_team.status in ('archived', 'finalized') or v_capstone.archived is true then
    raise exception 'This project is no longer accepting roster confirmations.' using errcode = '23514';
  end if;

  if not watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id) then
    raise exception 'This project is no longer accepting roster confirmations.' using errcode = '23514';
  end if;

  v_is_staff := watmatch_actor_can_route_commitments(p_actor_id, v_role);

  if v_role = 'student' then
    if p_actor_id <> v_team.leader_fk then
      raise exception 'Only the team leader can confirm this roster.' using errcode = '42501';
    end if;
  elsif not v_is_staff then
    raise exception 'Commitment routing access required.' using errcode = '42501';
  end if;

  select min(pe.exploration_id), count(*)::integer
    into v_seed_exploration_id, v_candidate_count
  from project_explorations pe
  join users u on u.user_id = pe.student_fk
  where pe.capstone_fk = v_capstone.capstone_id
    and pe.team_fk = v_team.team_id
    and pe.status in ('exploring', 'pending_commitment')
    and pe.student_commitment_confirmed_at is not null
    and pe.team_commitment_confirmed_at is not null
    and lower(coalesce(u.role, '')) = 'student'
    and u.active is true
    and not exists (
      select 1
      from team_memberships tm
      where tm.user_fk = u.user_id
    );

  if v_candidate_count = 0 or v_seed_exploration_id is null then
    raise exception 'At least one student and the team must both confirm commitment before the roster can be routed.' using errcode = '23514';
  end if;

  update project_explorations pe
  set status = 'pending_commitment',
      updated_at = now()
  from users u
  where u.user_id = pe.student_fk
    and pe.capstone_fk = v_capstone.capstone_id
    and pe.team_fk = v_team.team_id
    and pe.status = 'exploring'
    and pe.student_commitment_confirmed_at is not null
    and pe.team_commitment_confirmed_at is not null
    and lower(coalesce(u.role, '')) = 'student'
    and u.active is true
    and not exists (
      select 1
      from team_memberships tm
      where tm.user_fk = u.user_id
    );

  update teams
  set commitment_roster_confirmed_at = now(),
      commitment_roster_confirmed_by_fk = p_actor_id,
      commitment_roster_note = v_comments
  where team_id = v_team.team_id
  returning * into v_team;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'project_commitment_roster_confirmed',
    'team',
    v_team.team_id::text,
    v_comments,
    jsonb_build_object(
      'team', to_jsonb(v_team),
      'capstone', to_jsonb(v_capstone),
      'mutually_confirmed_candidate_count', v_candidate_count
    )
  );

  v_result := watmatch_create_project_commitment_request(
    v_seed_exploration_id,
    p_actor_id,
    v_role,
    coalesce(v_comments, 'Marketplace commitment roster proposal sent for routing.')
  );

  return jsonb_set(
    v_result,
    '{data,roster_confirmed}',
    'true'::jsonb,
    true
  );
end;
$$;

drop function if exists watmatch_get_project_commitment_requests(bigint, text, integer, integer);

create or replace function watmatch_get_project_commitment_requests(
  p_actor_id bigint,
  p_actor_role text,
  p_page integer default null,
  p_page_size integer default null,
  p_search text default null,
  p_course_id bigint default null,
  p_department_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_page integer := case when p_page is not null and p_page > 0 then p_page else null end;
  v_page_size integer := case when p_page_size is not null and p_page_size > 0 then p_page_size else null end;
  v_limit integer := case when v_page is not null and v_page_size is not null then v_page_size else null end;
  v_offset integer := case when v_page is not null and v_page_size is not null then (v_page - 1) * v_page_size else 0 end;
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  v_total integer := 0;
  v_data jsonb := '[]'::jsonb;
begin
  if not watmatch_actor_can_route_commitments(p_actor_id, v_role) then
    raise exception 'Commitment routing access required.' using errcode = '42501';
  end if;

  with unavailable_candidates as (
    select pcr.commitment_request_id, pcr.exploration_fk
    from project_commitment_requests pcr
    left join project_explorations pe on pe.exploration_id = pcr.exploration_fk
    left join users u on u.user_id = pcr.student_fk
    left join teams t on t.team_id = pcr.team_fk
    left join capstones c on c.capstone_id = pcr.capstone_fk
    where pcr.status = 'pending'
      and (
        pe.exploration_id is null
        or pe.status <> 'pending_commitment'
        or u.user_id is null
        or lower(coalesce(u.role, '')) <> 'student'
        or u.active is not true
        or exists (
          select 1
          from team_memberships tm
          where tm.user_fk = pcr.student_fk
        )
        or t.team_id is null
        or t.status in ('archived', 'finalized')
        or c.capstone_id is null
        or c.archived is true
        or c.status <> 'approved_recruiting'
        or c.team_fk is distinct from pcr.team_fk
        or not watmatch_capstone_accepts_marketplace_activity(c.capstone_id)
      )
  ),
  unavailable as (
    update project_commitment_requests pcr
    set status = 'cancelled',
        decided_at = now(),
        comments = coalesce(pcr.comments, 'Commitment request is no longer actionable.'),
        updated_at = now()
    from unavailable_candidates sc
    where pcr.commitment_request_id = sc.commitment_request_id
    returning pcr.commitment_request_id, pcr.exploration_fk
  ),
  expired_unavailable_explorations as (
    update project_explorations pe
    set status = 'expired',
        decided_at = coalesce(pe.decided_at, now()),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = now()
    from unavailable s
    where pe.exploration_id = s.exploration_fk
      and pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
    returning pe.exploration_id
  ),
  filtered as (
    select pcr.*
    from project_commitment_requests pcr
    join project_explorations pe on pe.exploration_id = pcr.exploration_fk
    join users u on u.user_id = pcr.student_fk
    join teams t on t.team_id = pcr.team_fk
    join capstones c on c.capstone_id = pcr.capstone_fk
    left join departments d on d.department_id = u.home_department_fk
    left join courses rc on rc.course_id = pcr.target_course_fk
    left join courses tc on tc.course_id = watmatch_target_course_fk(pcr.capstone_fk, pcr.team_fk)
    left join users requester on requester.user_id = pcr.requested_by_fk
    where pcr.status = 'pending'
      and pe.status = 'pending_commitment'
      and lower(coalesce(u.role, '')) = 'student'
      and u.active is true
      and not exists (
        select 1
        from team_memberships tm
        where tm.user_fk = pcr.student_fk
      )
      and t.status not in ('archived', 'finalized')
      and c.archived is false
      and c.status = 'approved_recruiting'
      and c.team_fk is not distinct from pcr.team_fk
      and watmatch_capstone_accepts_marketplace_activity(c.capstone_id)
      and (
        p_course_id is null
        or p_course_id in (pcr.target_course_fk, u.course_fk, t.course_fk, c.course_fk, tc.course_id)
      )
      and (
        p_department_id is null
        or u.home_department_fk = p_department_id
        or rc.department_fk = p_department_id
        or tc.department_fk = p_department_id
      )
      and (
        v_search is null
        or lower(
          coalesce(u.email, '') || ' ' ||
          coalesce(requester.email, '') || ' ' ||
          coalesce(c.title, '') || ' ' ||
          coalesce(rc.code, '') || ' ' ||
          coalesce(rc.name, '') || ' ' ||
          coalesce(tc.code, '') || ' ' ||
          coalesce(tc.name, '') || ' ' ||
          coalesce(d.name, '') || ' commitment routing'
        ) like '%' || v_search || '%'
      )
  ),
  counted as (
    select count(*)::integer as total from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at asc, commitment_request_id asc
    offset v_offset
    limit v_limit
  )
  select
    coalesce((select total from counted), 0),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'request', to_jsonb(p),
            'exploration', watmatch_project_exploration_json(pe),
            'student', jsonb_build_object(
              'user_id', u.user_id,
              'email', u.email,
              'course_fk', u.course_fk,
              'home_department_id', u.home_department_fk,
              'home_department', d.name
            ),
            'official_members', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'user_id', member_user.user_id,
                    'email', member_user.email,
                    'course_fk', member_user.course_fk,
                    'enrollment_course_fk', member_tm.enrollment_course_fk,
                    'is_leader', member_tm.is_leader,
                    'enrollment_course', case
                      when member_course.course_id is null then null
                      else jsonb_build_object(
                        'course_id', member_course.course_id,
                        'code', member_course.code,
                        'name', member_course.name,
                        'active', member_course.active,
                        'active_terms', member_course.active_terms,
                        'activation_mode', member_course.activation_mode,
                        'department_fk', member_course.department_fk,
                        'routing_kind', member_course.routing_kind
                      )
                    end,
                    'home_department_id', member_user.home_department_fk,
                    'home_department', case
                      when member_department.department_id is null then null
                      else jsonb_build_object(
                        'department_id', member_department.department_id,
                        'name', member_department.name,
                        'active', member_department.active
                      )
                    end
                  )
                  order by member_tm.is_leader desc, member_user.email, member_user.user_id
                ),
                '[]'::jsonb
              )
              from team_memberships member_tm
              join users member_user on member_user.user_id = member_tm.user_fk
              left join courses member_course on member_course.course_id = member_tm.enrollment_course_fk
              left join departments member_department on member_department.department_id = member_user.home_department_fk
              where member_tm.team_fk = p.team_fk
            ),
            'team', to_jsonb(t),
            'capstone', to_jsonb(c),
            'team_pending_count', (
              select count(*)::integer
              from project_commitment_requests team_pcr
              join project_explorations team_pe on team_pe.exploration_id = team_pcr.exploration_fk
              join users team_student on team_student.user_id = team_pcr.student_fk
              where team_pcr.team_fk = p.team_fk
                and team_pcr.capstone_fk = p.capstone_fk
                and team_pcr.status = 'pending'
                and team_pe.status = 'pending_commitment'
                and lower(coalesce(team_student.role, '')) = 'student'
                and team_student.active is true
                and not exists (
                  select 1
                  from team_memberships team_tm
                  where team_tm.user_fk = team_pcr.student_fk
                )
            ),
            'recommended_course', case when rc.course_id is not null then to_jsonb(rc) else to_jsonb(tc) end,
            'requested_by', jsonb_build_object(
              'user_id', requester.user_id,
              'email', requester.email,
              'role', requester.role
            )
          )
          order by p.created_at asc, p.commitment_request_id asc
        )
        from paged p
        left join project_explorations pe on pe.exploration_id = p.exploration_fk
        join users u on u.user_id = p.student_fk
        left join departments d on d.department_id = u.home_department_fk
        left join teams t on t.team_id = p.team_fk
        left join capstones c on c.capstone_id = p.capstone_fk
        left join courses rc on rc.course_id = p.target_course_fk
        left join courses tc on tc.course_id = watmatch_target_course_fk(p.capstone_fk, p.team_fk)
        left join users requester on requester.user_id = p.requested_by_fk
      ),
      '[]'::jsonb
    )
  into v_total, v_data;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size,
    'total_pages', case when v_page_size is not null and v_page_size > 0 then ceil(v_total::numeric / v_page_size)::integer else null end
  );
end;
$$;

create or replace function watmatch_decide_project_commitment_request(
  p_commitment_request_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_decision text,
  p_decision_route text default null,
  p_target_course_id bigint default null,
  p_comments text default null,
  p_member_enrollment_routes jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_decision text := lower(nullif(btrim(coalesce(p_decision, '')), ''));
  v_route text := lower(nullif(btrim(coalesce(p_decision_route, '')), ''));
  v_comments text := nullif(btrim(coalesce(p_comments, '')), '');
  v_request project_commitment_requests%rowtype;
  v_student users%rowtype;
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_course courses%rowtype;
  v_course_routed boolean := false;
  v_apply_result jsonb;
  v_now timestamptz := now();
  v_phase text := watmatch_current_marketplace_phase();
  v_can_return_to_exploring boolean := false;
begin
  if not watmatch_actor_can_route_commitments(p_actor_id, v_role) then
    raise exception 'Commitment routing access required.' using errcode = '42501';
  end if;

  if v_decision not in ('approve', 'reject', 'cancel') then
    raise exception 'Decision must be approve, reject, or cancel.' using errcode = '23514';
  end if;

  if v_decision in ('reject', 'cancel') and v_comments is null then
    raise exception 'Decision notes are required when rejecting or returning a commitment request.' using errcode = '23514';
  end if;

  select *
    into v_request
  from project_commitment_requests
  where commitment_request_id = p_commitment_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'Pending project commitment request not found.' using errcode = 'P0002';
  end if;

  select *
    into v_student
  from users
  where user_id = v_request.student_fk
  for update;

  select *
    into v_team
  from teams
  where team_id = v_request.team_fk
  for update;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_request.capstone_fk
  for update;

  if v_capstone.capstone_id is not null then
    v_phase := watmatch_effective_marketplace_phase_for_capstone(v_capstone.capstone_id);
  end if;

  v_can_return_to_exploring :=
    v_student.user_id is not null
    and lower(coalesce(v_student.role, '')) = 'student'
    and v_student.active is true
    and not exists (
      select 1
      from team_memberships tm
      where tm.user_fk = v_student.user_id
    )
    and (v_phase = 'exploration' or v_student.course_fk is not null)
    and v_team.team_id is not null
    and v_team.status not in ('archived', 'finalized')
    and v_capstone.capstone_id is not null
    and v_capstone.archived is false
    and v_capstone.status = 'approved_recruiting'
    and v_capstone.team_fk is not distinct from v_request.team_fk
    and watmatch_capstone_accepts_marketplace_activity(v_capstone.capstone_id);

  if v_decision in ('reject', 'cancel') then
    update project_commitment_requests
    set status = case when v_decision = 'cancel' then 'cancelled' else 'rejected' end,
        comments = v_comments,
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        updated_at = v_now
    where commitment_request_id = p_commitment_request_id
    returning * into v_request;

    if v_can_return_to_exploring is true then
      update project_explorations
      set status = case when v_decision = 'cancel' then 'exploring' else 'declined' end,
          decided_by_fk = p_actor_id,
          decided_at = v_now,
          student_commitment_confirmed_at = null,
          student_commitment_confirmed_by_fk = null,
          team_commitment_confirmed_at = null,
          team_commitment_confirmed_by_fk = null,
          updated_at = v_now
      where exploration_id = v_request.exploration_fk
        and status in ('pending_commitment', 'committed');
    else
      update project_explorations
      set status = case when v_decision = 'cancel' then 'expired' else 'declined' end,
          decided_by_fk = p_actor_id,
          decided_at = v_now,
          student_commitment_confirmed_at = null,
          student_commitment_confirmed_by_fk = null,
          team_commitment_confirmed_at = null,
          team_commitment_confirmed_by_fk = null,
          updated_at = v_now
      where exploration_id = v_request.exploration_fk
        and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment', 'committed');
    end if;

    if not exists (
      select 1
      from project_commitment_requests pcr
      where pcr.team_fk = v_request.team_fk
        and pcr.status = 'pending'
    ) then
      update teams
      set commitment_roster_confirmed_at = null,
          commitment_roster_confirmed_by_fk = null,
          commitment_roster_note = null
      where team_id = v_request.team_fk;
    end if;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      p_actor_id,
      v_role,
      case when v_decision = 'cancel' then 'project_commitment_cancelled' else 'project_commitment_rejected' end,
      'project_commitment_request',
      v_request.commitment_request_id::text,
      v_comments,
      to_jsonb(v_request)
    );

    return jsonb_build_object('success', true, 'message', 'Project commitment request updated.', 'data', to_jsonb(v_request));
  end if;

  v_apply_result := watmatch_apply_marketplace_commitment(
    v_request.exploration_fk,
    v_request.commitment_request_id,
    p_actor_id,
    v_role,
    v_route,
    p_target_course_id,
    v_comments,
    false,
    p_member_enrollment_routes
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Project commitment approved.',
    'data', v_apply_result
  );
end;
$$;

create or replace function watmatch_cancel_project_exploration(
  p_exploration_id bigint,
  p_actor_id bigint,
  p_actor_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_exploration project_explorations%rowtype;
  v_team teams%rowtype;
  v_next_status text;
  v_now timestamptz := now();
begin
  if p_exploration_id is null or p_actor_id is null then
    raise exception 'Invalid exploration cancellation request.' using errcode = '22023';
  end if;

  select *
    into v_exploration
  from project_explorations
  where exploration_id = p_exploration_id
  for update;

  if not found then
    raise exception 'Marketplace exploration not found.' using errcode = 'P0002';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_exploration.team_fk
  for update;

  if v_role = 'student' and p_actor_id = v_exploration.student_fk then
    v_next_status := 'withdrawn';
  elsif v_role = 'student' and v_team.leader_fk is not distinct from p_actor_id then
    v_next_status := 'declined';
  elsif watmatch_actor_can_route_commitments(p_actor_id, v_role) then
    v_next_status := 'declined';
  else
    raise exception 'Forbidden. You cannot cancel this marketplace exploration.' using errcode = '42501';
  end if;

  if v_exploration.status not in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment') then
    return jsonb_build_object(
      'success', true,
      'message', 'Marketplace exploration was already resolved.',
      'data', watmatch_project_exploration_json(v_exploration) || jsonb_build_object('already_resolved', true)
    );
  end if;

  update project_explorations
  set status = v_next_status,
      decided_by_fk = p_actor_id,
      decided_at = v_now,
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = v_now
  where exploration_id = v_exploration.exploration_id
  returning * into v_exploration;

  update project_commitment_requests
  set status = 'cancelled',
      decided_by_fk = p_actor_id,
      decided_at = v_now,
      comments = coalesce(v_reason, comments, 'Marketplace exploration was cancelled.'),
      updated_at = v_now
  where exploration_fk = v_exploration.exploration_id
    and status = 'pending';

  if not exists (
    select 1
    from project_commitment_requests pcr
    where pcr.team_fk = v_exploration.team_fk
      and pcr.status = 'pending'
  ) then
    update teams
    set commitment_roster_confirmed_at = null,
        commitment_roster_confirmed_by_fk = null,
        commitment_roster_note = null
    where team_id = v_exploration.team_fk;
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    case when v_next_status = 'withdrawn' then 'project_exploration_withdrawn' else 'project_exploration_cancelled' end,
    'project_exploration',
    v_exploration.exploration_id::text,
    v_reason,
    watmatch_project_exploration_json(v_exploration)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when v_next_status = 'withdrawn' then 'Marketplace exploration withdrawn.' else 'Marketplace exploration cancelled.' end,
    'data', watmatch_project_exploration_json(v_exploration)
  );
end;
$$;

create or replace function watmatch_list_student_explorations(
  p_student_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb := '[]'::jsonb;
  v_commitments jsonb := '[]'::jsonb;
begin
  perform watmatch_assert_active_student(p_student_id);

  with unavailable_explorations as (
    select pe.exploration_id
    from project_explorations pe
    join capstones c on c.capstone_id = pe.capstone_fk
    left join teams t on t.team_id = pe.team_fk
    where pe.student_fk = p_student_id
      and pe.status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment')
      and (
        c.archived is true
        or c.status <> 'approved_recruiting'
        or c.team_fk is distinct from pe.team_fk
        or t.team_id is null
        or t.status in ('archived', 'finalized')
        or not watmatch_capstone_accepts_marketplace_activity(c.capstone_id)
      )
  )
  update project_explorations pe
  set status = 'expired',
      decided_at = coalesce(pe.decided_at, now()),
      student_commitment_confirmed_at = null,
      student_commitment_confirmed_by_fk = null,
      team_commitment_confirmed_at = null,
      team_commitment_confirmed_by_fk = null,
      updated_at = now()
  from unavailable_explorations unavailable
  where pe.exploration_id = unavailable.exploration_id;

  with unavailable_requests as (
    select pcr.commitment_request_id
    from project_commitment_requests pcr
    left join project_explorations pe on pe.exploration_id = pcr.exploration_fk
    left join users u on u.user_id = pcr.student_fk
    left join teams t on t.team_id = pcr.team_fk
    left join capstones c on c.capstone_id = pcr.capstone_fk
    where pcr.student_fk = p_student_id
      and pcr.status = 'pending'
      and (
        pe.exploration_id is null
        or pe.status <> 'pending_commitment'
        or u.user_id is null
        or lower(coalesce(u.role, '')) <> 'student'
        or u.active is not true
        or exists (
          select 1
          from team_memberships tm
          where tm.user_fk = pcr.student_fk
        )
        or t.team_id is null
        or t.status in ('archived', 'finalized')
        or c.capstone_id is null
        or c.archived is true
        or c.status <> 'approved_recruiting'
        or c.team_fk is distinct from pcr.team_fk
        or not watmatch_capstone_accepts_marketplace_activity(c.capstone_id)
      )
  )
  update project_commitment_requests pcr
  set status = 'cancelled',
      decided_at = coalesce(pcr.decided_at, now()),
      comments = coalesce(pcr.comments, 'Marketplace commitment is no longer actionable.'),
      updated_at = now()
  from unavailable_requests unavailable
  where pcr.commitment_request_id = unavailable.commitment_request_id;

  select coalesce(jsonb_agg(watmatch_project_exploration_json(pe) order by pe.updated_at desc, pe.exploration_id desc), '[]'::jsonb)
    into v_data
  from project_explorations pe
  join capstones c on c.capstone_id = pe.capstone_fk
  where pe.student_fk = p_student_id
    and c.archived is false;

  select coalesce(jsonb_agg(to_jsonb(pcr) order by pcr.created_at desc, pcr.commitment_request_id desc), '[]'::jsonb)
    into v_commitments
  from project_commitment_requests pcr
  where pcr.student_fk = p_student_id;

  return jsonb_build_object(
    'success', true,
    'data', v_data,
    'commitment_requests', v_commitments,
    'marketplace', watmatch_marketplace_settings_json()
  );
end;
$$;

create or replace function watmatch_clear_interest_when_not_approved_recruiting()
returns trigger
language plpgsql
as $$
begin
  if new.team_fk is not null
     and (new.archived is true or new.status <> 'approved_recruiting') then
    update project_explorations
    set status = 'expired',
        decided_at = coalesce(decided_at, now()),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = now()
    where team_fk = new.team_fk
      and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

    update project_commitment_requests
    set status = 'cancelled',
        decided_at = now(),
        comments = coalesce(comments, 'Capstone is no longer recruiting.'),
        updated_at = now()
    where team_fk = new.team_fk
      and status = 'pending';
  end if;

  if tg_op = 'UPDATE'
     and old.team_fk is not null
     and old.team_fk is distinct from new.team_fk then
    update project_explorations
    set status = 'expired',
        decided_at = coalesce(decided_at, now()),
        student_commitment_confirmed_at = null,
        student_commitment_confirmed_by_fk = null,
        team_commitment_confirmed_at = null,
        team_commitment_confirmed_by_fk = null,
        updated_at = now()
    where team_fk = old.team_fk
      and status in ('shortlisted', 'interested', 'invited', 'exploring', 'pending_commitment');

    update project_commitment_requests
    set status = 'cancelled',
        decided_at = now(),
        comments = coalesce(comments, 'Capstone team changed.'),
        updated_at = now()
    where team_fk = old.team_fk
      and status = 'pending';
  end if;

  return new;
end;
$$;

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;
alter default privileges in schema public grant execute on functions to service_role;
