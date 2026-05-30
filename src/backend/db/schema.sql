-- Courses
create table if not exists courses (
  course_id    bigint generated always as identity primary key,
  code         text not null,          -- e.g. 'SE 390'
  name         text not null,          -- e.g. 'Design Project Planning'
  term         text,                   -- e.g. 'Spring 2026'
  active       boolean default true,
  created_at   timestamp with time zone default now()
);

-- Users
create table if not exists users (
  user_id      bigint generated always as identity primary key,
  email        text not null unique,
  role         text not null,           -- "student" | "instructor" | "admin" | "external_partner"
  course_fk    bigint references courses(course_id) on delete set null,
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
  disciplines            text[] not null default '{}',
  skills                 text[] not null default '{}',
  target_course_tags     text[] not null default '{}',
  preferred_team_size    text,
  max_active_teams       integer,
  contact_email          text not null,
  contact_url            text,
  status                 text not null default 'draft',
  archived_at            timestamp with time zone,
  created_at             timestamp with time zone default now(),
  updated_at             timestamp with time zone default now()
);

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
  status       text not null default 'pending_review',
  disciplines  text[] default '{}',
  skills       text[] default '{}',
  approval     boolean default false,
  team_fk      bigint,                  -- if tied to a team later
  course_fk    bigint references courses(course_id) on delete set null,
  archived     boolean default false,
  archived_at  timestamp with time zone,
  archived_reason text,
  created_at   timestamp with time zone default now(),
  updated_at   timestamp with time zone default now()
);

-- Teams
create table if not exists teams (
  team_id      bigint generated always as identity primary key,
  leader_fk    bigint references users(user_id) on delete set null,
  capstone_fk  bigint references capstones(capstone_id) on delete set null,
  status       text default 'forming',
  course_fk    bigint references courses(course_id) on delete set null,
  created_at   timestamp with time zone default now()
);

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
  department        text not null,
  year              text not null,
  students          text[] not null default '{}',   -- array of names (not user IDs)
  source_fk         bigint references courses(course_id) on delete set null, -- optional link
  created_at        timestamp default now()
);

create table if not exists team_interest (
  team_id   bigint not null references teams(team_id) on delete cascade,
  student_id bigint not null references users(user_id) on delete cascade,
  message   text,                                -- optional note from student
  created_at timestamp with time zone default now(),

  primary key (team_id, student_id)
);

create table if not exists invites (
  invite_id    text primary key,
  team_fk      bigint not null references teams(team_id) on delete cascade,
  user_fk      bigint not null references users(user_id) on delete cascade,
  created_at   timestamp with time zone default now(),
  unique (team_fk, user_fk)
);

create table if not exists student_profile (
  student_fk   bigint primary key references users(user_id) on delete cascade,
  about_me     text,
  skills       text[] default '{}',
  updated_at   timestamp with time zone default now()
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
  is_leader        boolean not null default false,
  created_at       timestamp with time zone default now()
);

-- RLS is enabled for all app tables. The frontend never calls Supabase directly;
-- FastAPI is the only application caller and must use SUPABASE_SERVICE_ROLE_KEY.
-- No anon/authenticated policies are created here on purpose.
alter table courses enable row level security;
alter table users enable row level security;
alter table capstones enable row level security;
alter table teams enable row level security;
alter table past_capstones enable row level security;
alter table partner_profiles enable row level security;
alter table partner_opportunities enable row level security;
alter table team_interest enable row level security;
alter table invites enable row level security;
alter table student_profile enable row level security;
alter table approvals enable row level security;
alter table capstone_course_approvals enable row level security;
alter table audit_log enable row level security;
alter table team_memberships enable row level security;

update team_memberships
set is_leader = false
where is_leader is null;

alter table team_memberships alter column is_leader set default false;
alter table team_memberships alter column is_leader set not null;

alter table users add column if not exists active boolean default true;
update users set active = true where active is null;
alter table users alter column active set default true;
alter table users alter column active set not null;

update users
set role = lower(btrim(role)),
    email = lower(btrim(email));

alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('student', 'instructor', 'admin', 'external_partner'));

alter table capstones add column if not exists partner_opportunity_fk bigint references partner_opportunities(partner_opportunity_id) on delete set null;
alter table capstones add column if not exists partner_opportunity_snapshot jsonb;
alter table capstones add column if not exists external_partner_name text;
alter table capstones add column if not exists external_partner_organization text;
alter table capstones add column if not exists external_partner_email text;
alter table capstones add column if not exists external_partner_website text;
alter table capstones add column if not exists external_partner_notes text;

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
    (about_me is null or length(about_me) <= 250)
    and cardinality(coalesce(skills, '{}'::text[])) <= 25
  );

alter table users drop constraint if exists users_email_uwaterloo_check;
alter table users
  add constraint users_email_uwaterloo_check
  check (
    lower(coalesce(role, '')) = 'external_partner'
    or email ~ '^[^@[:space:]]+@uwaterloo[.]ca$'
  );

update courses set active = coalesce(active, true);
alter table courses alter column active set default true;
alter table courses alter column active set not null;

-- Performance indexes for workflow + audit endpoints
create index if not exists idx_team_memberships_team_fk
  on team_memberships(team_fk);

create index if not exists idx_capstones_team_fk
  on capstones(team_fk);

create unique index if not exists idx_capstones_one_active_per_team
  on capstones(team_fk)
  where team_fk is not null and archived is not true;

create unique index if not exists idx_team_memberships_one_leader_per_team
  on team_memberships(team_fk)
  where is_leader is true;

-- Idempotent uniqueness backstops for databases that predate this consolidated schema.
alter table courses drop constraint if exists courses_code_key;
drop index if exists idx_courses_code_unique;
drop index if exists idx_courses_code_term_unique;
create unique index if not exists idx_courses_code_term_unique
  on courses(upper(code), lower(coalesce(term, '')));

create unique index if not exists idx_users_email_unique
  on users(email);

create unique index if not exists idx_team_interest_team_student_unique
  on team_interest(team_id, student_id);

create unique index if not exists idx_invites_team_user_unique
  on invites(team_fk, user_fk);

create unique index if not exists idx_student_profile_student_unique
  on student_profile(student_fk);

create index if not exists idx_partner_opportunities_status_created
  on partner_opportunities(status, created_at desc);

create index if not exists idx_partner_opportunities_partner_status
  on partner_opportunities(partner_user_fk, status);

create index if not exists idx_capstones_partner_opportunity_fk
  on capstones(partner_opportunity_fk);

create unique index if not exists idx_capstone_course_approvals_capstone_course_unique
  on capstone_course_approvals(capstone_fk, course_fk);

create unique index if not exists idx_team_memberships_user_unique
  on team_memberships(user_fk);

create index if not exists idx_capstones_status_archived
  on capstones(status, archived);

create index if not exists idx_audit_log_actor_fk
  on audit_log(actor_fk);

create index if not exists idx_audit_log_action
  on audit_log(action);

create index if not exists idx_audit_log_entity
  on audit_log(entity_type, entity_id);

create index if not exists idx_audit_log_created_at
  on audit_log(created_at desc);

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
      'pending_multi_course_approval',
      'changes_requested',
      'rejected',
      'approved',
      'archived'
    )
  );

alter table capstones drop constraint if exists capstones_approval_status_consistency;
alter table capstones
  add constraint capstones_approval_status_consistency
  check (
    (
      status in ('approved', 'approved_recruiting')
      and approval is true
      and archived is false
    )
    or (
      status not in ('approved', 'approved_recruiting')
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

alter table team_interest drop constraint if exists team_interest_message_len_check;
alter table team_interest
  add constraint team_interest_message_len_check
  check (message is null or char_length(message) <= 1000);

alter table student_profile drop constraint if exists student_profile_content_len_check;
alter table student_profile
  add constraint student_profile_content_len_check
  check (
    (about_me is null or char_length(about_me) <= 250)
    and coalesce(array_length(skills, 1), 0) <= 25
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

create or replace function watmatch_clear_interest_when_not_approved_recruiting()
returns trigger
language plpgsql
as $$
begin
  if new.team_fk is not null
     and (new.archived is true or new.status <> 'approved_recruiting') then
    delete from team_interest
    where team_id = new.team_fk;
  end if;

  if new.team_fk is not null
     and (
       new.archived is true
       or new.status in ('approved', 'archived')
      ) then
    delete from invites
    where team_fk = new.team_fk;
  end if;

  if tg_op = 'UPDATE' then
    if old.team_fk is not null
       and old.team_fk is distinct from new.team_fk then
      delete from team_interest
      where team_id = old.team_fk;

      delete from invites
      where team_fk = old.team_fk;
    end if;
  end if;

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
            'skills', coalesce(to_jsonb(paged.skills), '[]'::jsonb),
            'created_at', paged.created_at,
            'can_express_interest', true,
            'external_partner_name', paged.public_external_partner_name,
            'external_partner_organization', paged.public_external_partner_organization,
            'external_partner_email', paged.public_external_partner_email,
            'external_partner_website', paged.public_external_partner_website
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
  with department_values as (
    select nullif(btrim(discipline.value), '') as department
    from capstones c
    cross join lateral unnest(coalesce(c.disciplines, '{}'::text[])) as discipline(value)
    where c.status = 'approved_recruiting'
      and c.archived is false
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

create or replace function watmatch_get_past_capstones(
  p_page integer default 1,
  p_page_size integer default 20,
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
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_pattern text;
  v_department text := nullif(lower(btrim(coalesce(p_department, ''))), '');
  v_year text := nullif(btrim(coalesce(p_year, '')), '');
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
    select p.*
    from past_capstones p
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
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(to_jsonb(p.department)) = 'array' then to_jsonb(p.department)
              when jsonb_typeof(to_jsonb(p.department)) = 'string' then
                to_jsonb(string_to_array(replace(trim(both '{}' from p.department::text), '"', ''), ','))
              else '[]'::jsonb
            end
          ) as department(value)
          where lower(btrim(department.value)) = v_department
        )
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
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(to_jsonb(p.department)) = 'array' then to_jsonb(p.department)
        when jsonb_typeof(to_jsonb(p.department)) = 'string' then
          to_jsonb(string_to_array(replace(trim(both '{}' from p.department::text), '"', ''), ','))
        else '[]'::jsonb
      end
    ) as department(value)
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
      and c.status in ('pending_review', 'pending_multi_course_approval')
      and (
        v_role = 'admin'
        or exists (
          select 1
          from capstone_course_approvals cca
          where cca.capstone_fk = c.capstone_id
            and cca.course_fk = v_actor_course
            and cca.status = 'pending'
        )
        or (
          c.team_fk is not null
          and exists (
            select 1
            from team_memberships tm
            join users u on u.user_id = tm.user_fk
            where tm.team_fk = c.team_fk
              and u.course_fk = v_actor_course
          )
          and not exists (
            select 1
            from capstone_course_approvals cca_final
            where cca_final.capstone_fk = c.capstone_id
              and cca_final.course_fk = v_actor_course
              and cca_final.status in ('approved', 'rejected')
          )
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

  if target_team_status = 'finalized' then
    raise exception 'Team membership is locked after the team is finalized.'
      using errcode = '23514';
  end if;

  if linked_status in ('approved', 'pending_review', 'pending_multi_course_approval') then
    raise exception 'Team membership is locked while capstone status is %', linked_status
      using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' then
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

create or replace function watmatch_sync_membership_caches()
returns trigger
language plpgsql
as $$
declare
  target_team_status text;
  canonical_leader bigint;
  target_team_fk bigint;
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

    delete from invites
    where user_fk = new.user_fk;

    delete from team_interest
    where student_id = new.user_fk;
  end if;

  if pg_trigger_depth() < 2 and target_team_fk is not null then
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

    if old_linked_status in ('approved', 'pending_review', 'pending_multi_course_approval')
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
          and c.status = 'approved'
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
        and c.status = 'approved'
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

  if new.status = 'approved' then
    if new.team_fk is null then
      raise exception 'Approved capstones must be linked to a finalized team.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from teams t
      where t.team_id = new.team_fk
        and t.capstone_fk = new.capstone_id
        and t.status = 'finalized'
    ) then
      raise exception 'Approved capstones must be linked to a finalized team.'
        using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from teams t
    where t.capstone_fk = target_capstone_id
      and t.status = 'finalized'
      and new.status <> 'approved'
      and new.archived is false
  ) then
    raise exception 'Finalized teams must be linked to an approved capstone.'
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
  v_member_courses bigint[];
  v_member_ids bigint[];
  v_existing_status text;
  v_decision_newly_recorded boolean := true;
  v_all_approved boolean := false;
  v_any_rejected boolean := false;
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

  if v_role = 'instructor' then
    if v_actor_course is null then
      raise exception 'Instructor must be assigned to a course.' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from team_memberships tm
      join users u on u.user_id = tm.user_fk
      where tm.team_fk = v_team.team_id
        and u.course_fk = v_actor_course
    ) then
      raise exception 'Forbidden. You can only review capstones with at least one student in your course.'
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

  if v_capstone.status not in ('pending_review', 'pending_multi_course_approval') then
    raise exception 'This capstone is not open for instructor review.' using errcode = '23514';
  end if;

  if v_team.status = 'finalized' then
    raise exception 'Linked team is finalized and cannot be reviewed.' using errcode = '23514';
  end if;

  select array_agg(distinct u.course_fk) filter (where u.course_fk is not null)
    into v_member_courses
  from team_memberships tm
  join users u on u.user_id = tm.user_fk
  where tm.team_fk = v_team.team_id;

  if coalesce(array_length(v_member_courses, 1), 0) = 0 and v_team.leader_fk is not null then
    select array_agg(distinct course_fk) filter (where course_fk is not null)
      into v_member_courses
    from users
    where user_id = v_team.leader_fk;
  end if;

  if coalesce(array_length(v_member_courses, 1), 0) = 0 then
    raise exception 'No required course approvals found.' using errcode = '23514';
  end if;

  perform watmatch_assert_team_members_valid(v_team.team_id);

  insert into capstone_course_approvals (capstone_fk, course_fk, status)
  select p_capstone_id, course_fk, 'pending'
  from unnest(v_member_courses) as course_fk
  on conflict (capstone_fk, course_fk) do nothing;

  delete from capstone_course_approvals
  where capstone_fk = p_capstone_id
    and not (course_fk = any(v_member_courses));

  perform 1
  from capstone_course_approvals
  where capstone_fk = p_capstone_id
  for update;

  if v_role = 'instructor' then
    select status
      into v_existing_status
    from capstone_course_approvals
    where capstone_fk = p_capstone_id
      and course_fk = v_actor_course
    for update;

    if v_existing_status is null then
      raise exception 'No course approval row found for this instructor.' using errcode = 'P0002';
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
          and course_fk = v_actor_course;
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
          and course_fk = v_actor_course;
      end if;
    end if;
  elsif v_decision = 'approve' then
    select coalesce(bool_and(status = 'approved'), false)
      into v_all_approved
    from capstone_course_approvals
    where capstone_fk = p_capstone_id;

    if v_all_approved then
      v_decision_newly_recorded := false;
    else
      update capstone_course_approvals
      set status = 'approved',
          decided_by_fk = p_actor_id,
          decided_at = v_now,
          comments = v_comments,
          updated_at = v_now
      where capstone_fk = p_capstone_id;
    end if;
  elsif v_decision = 'reject' then
    update capstone_course_approvals
    set status = 'rejected',
        decided_by_fk = p_actor_id,
        decided_at = v_now,
        comments = v_comments,
        updated_at = v_now
    where capstone_fk = p_capstone_id;
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

  select coalesce(bool_and(status = 'approved'), false),
         coalesce(bool_or(status = 'rejected'), false)
    into v_all_approved, v_any_rejected
  from capstone_course_approvals
  where capstone_fk = p_capstone_id;

  if v_decision_newly_recorded then
    insert into approvals (capstone_fk, instructor_fk, action, comments)
    values (
      p_capstone_id,
      p_actor_id,
      case when v_decision = 'approve' then 'approved' else 'rejected' end,
      v_comments
    );
  end if;

  if v_any_rejected then
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

  if v_all_approved then
    update capstones
    set approval = true,
        status = 'approved_recruiting',
        archived = false,
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

    delete from team_interest
    where student_id = any(v_member_ids);

    delete from invites
    where user_fk = any(v_member_ids);

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

  update capstones
  set approval = false,
      status = 'pending_multi_course_approval',
      updated_at = v_now
  where capstone_id = p_capstone_id
  returning * into v_updated;

  return jsonb_build_object(
    'success', true,
    'message', 'Approval recorded. This project is still waiting for review to finish.',
    'capstone', to_jsonb(v_updated),
    'email_decision', null
  );
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
  v_courses bigint[];
  v_leader_fk bigint;
begin
  select array_agg(distinct u.course_fk) filter (where u.course_fk is not null)
    into v_courses
  from team_memberships tm
  join users u on u.user_id = tm.user_fk
  where tm.team_fk = p_team_id;

  if coalesce(array_length(v_courses, 1), 0) = 0 then
    select leader_fk
      into v_leader_fk
    from teams
    where team_id = p_team_id;

    if v_leader_fk is not null then
      select array_agg(distinct course_fk) filter (where course_fk is not null)
        into v_courses
      from users
      where user_id = v_leader_fk;
    end if;
  end if;

  return coalesce(v_courses, '{}'::bigint[]);
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
  v_courses bigint[] := watmatch_required_course_fks(p_team_id);
  v_now timestamptz := now();
begin
  if coalesce(array_length(v_courses, 1), 0) = 0 then
    raise exception 'No required course approvals found.' using errcode = '23514';
  end if;

  insert into capstone_course_approvals (capstone_fk, course_fk, status)
  select p_capstone_id, course_fk, 'pending'
  from unnest(v_courses) as course_fk
  on conflict (capstone_fk, course_fk) do update
    set status = 'pending',
        decided_by_fk = null,
        decided_at = null,
        comments = null,
        updated_at = v_now;

  delete from capstone_course_approvals
  where capstone_fk = p_capstone_id
    and not (course_fk = any(v_courses));
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
  v_courses bigint[];
  v_pending_courses bigint[];
  v_all_required_approved boolean := false;
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

  if v_capstone.status in ('approved', 'pending_review', 'pending_multi_course_approval') then
    raise exception 'Team membership is locked while capstone status is %', v_capstone.status
      using errcode = '23514';
  end if;

  if v_capstone.status = 'approved_recruiting' then
    v_courses := watmatch_required_course_fks(p_team_id);

    if coalesce(array_length(v_courses, 1), 0) = 0 then
      raise exception 'No required course approvals found.' using errcode = '23514';
    end if;

    delete from capstone_course_approvals
    where capstone_fk = p_capstone_id
      and not (course_fk = any(v_courses));

    insert into capstone_course_approvals (capstone_fk, course_fk, status)
    select p_capstone_id, course_fk, 'pending'
    from unnest(v_courses) as course_fk
    on conflict (capstone_fk, course_fk) do nothing;

    update capstone_course_approvals
    set status = 'pending',
        decided_by_fk = null,
        decided_at = null,
        comments = null,
        updated_at = v_now
    where capstone_fk = p_capstone_id
      and course_fk = any(v_courses)
      and status <> 'approved';

    select coalesce(array_agg(course_fk order by course_fk), '{}'::bigint[])
      into v_pending_courses
    from capstone_course_approvals
    where capstone_fk = p_capstone_id
      and course_fk = any(v_courses)
      and status <> 'approved';

    v_all_required_approved := coalesce(array_length(v_pending_courses, 1), 0) = 0;

    if v_all_required_approved then
      update capstones
      set approval = true,
          status = 'approved_recruiting',
          updated_at = v_now
      where capstone_id = p_capstone_id
      returning * into v_capstone;

      insert into approvals (capstone_fk, instructor_fk, action, comments)
      values (
        p_capstone_id,
        null,
        'team_roster_changed_recruiting_preserved',
        'The team roster was updated. The project remains open for student interest.'
      );
    else
      update capstones
      set approval = false,
          status = 'pending_multi_course_approval',
          updated_at = v_now
      where capstone_id = p_capstone_id
      returning * into v_capstone;

      insert into approvals (capstone_fk, instructor_fk, action, comments)
      values (
        p_capstone_id,
        null,
        'team_roster_changed_course_approval_required',
        'The team roster was updated. This project is back under review.'
      );
    end if;
  elsif v_capstone.status in ('changes_requested', 'rejected') then
    update capstones
    set approval = false,
        updated_at = v_now
    where capstone_id = p_capstone_id
    returning * into v_capstone;

    perform watmatch_reset_capstone_course_requirements(p_capstone_id, p_team_id);

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

  return exists (
    select 1
    from team_memberships tm
    join users u on u.user_id = tm.user_fk
    where tm.team_fk = p_team_id
      and u.course_fk = v_actor_course
  );
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
    left join courses c on c.course_id = u.course_fk
    where tm.team_fk = p_team_id
      and (
        u.active is not true
        or u.course_fk is null
        or c.course_id is null
      )
  ) then
    raise exception 'This team has a member whose account is inactive or course assignment is invalid.'
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
       from invites
       where team_fk = p_team_id
         and user_fk = p_student_id
     ) then
    raise exception 'You already have an invite to this capstone. Accept or decline the invite instead.'
      using errcode = '23505';
  end if;

  if v_action = 'invite'
     and exists (
       select 1
       from team_interest
       where team_id = p_team_id
         and student_id = p_student_id
     ) then
    raise exception 'This student has already expressed interest in this capstone. Accept or reject their interest instead.'
      using errcode = '23505';
  end if;
end;
$$;

create or replace function watmatch_claim_team_membership(
  p_team_id bigint,
  p_student_id bigint,
  p_is_leader boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_team bigint;
begin
  perform watmatch_assert_student_with_course(p_student_id);

  select team_fk
    into v_existing_team
  from team_memberships
  where user_fk = p_student_id
  for update;

  if v_existing_team is not null and v_existing_team <> p_team_id then
    raise exception 'This student is already enrolled in another active team.' using errcode = '23505';
  end if;

  insert into team_memberships (user_fk, team_fk, is_leader)
  values (p_student_id, p_team_id, coalesce(p_is_leader, false))
  on conflict (user_fk) do update
    set team_fk = excluded.team_fk,
        is_leader = excluded.is_leader
  where team_memberships.team_fk = excluded.team_fk;
end;
$$;

create or replace function watmatch_accept_team_interest(
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
    raise exception 'Team changed while interest acceptance was starting. Please retry.' using errcode = '40001';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can accept members.' using errcode = '42501';
  end if;

  if v_team.capstone_fk is null then
    raise exception 'Team has no associated capstone project.' using errcode = '23514';
  end if;

  if v_capstone.capstone_id is null then
    raise exception 'Linked capstone not found.' using errcode = 'P0002';
  end if;

  if v_capstone.archived is true or v_capstone.status <> 'approved_recruiting' then
    raise exception 'This capstone is no longer accepting interest.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from team_interest
    where team_id = p_team_id
      and student_id = p_student_id
  ) then
    raise exception 'Student has not expressed interest in this team.' using errcode = 'P0002';
  end if;

  perform watmatch_claim_team_membership(p_team_id, p_student_id, false);
  perform watmatch_reopen_capstone_review_after_membership_change(v_capstone.capstone_id, p_team_id);

  delete from team_interest
  where student_id = p_student_id;

  delete from invites
  where user_fk = p_student_id;

  select *
    into v_team
  from teams
  where team_id = p_team_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Student accepted into the team.',
    'data', to_jsonb(v_team),
    'capstone_id', v_capstone.capstone_id
  );
end;
$$;

create or replace function watmatch_reject_team_interest(
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
  v_interest_exists boolean := false;
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

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while interest rejection was starting. Please retry.' using errcode = '40001';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can reject interested students.' using errcode = '42501';
  end if;

  select true
    into v_interest_exists
  from team_interest
  where team_id = p_team_id
    and student_id = p_student_id
  for update;

  if coalesce(v_interest_exists, false) is not true then
    return jsonb_build_object(
      'success', true,
      'message', 'Student interest was already resolved.',
      'data', jsonb_build_object(
        'team_id', p_team_id,
        'student_id', p_student_id,
        'already_resolved', true,
        'rejected', false
      )
    );
  end if;

  if v_team.status in ('archived', 'finalized')
     or v_team.capstone_fk is null
     or v_capstone.capstone_id is null
     or v_capstone.archived is true
     or v_capstone.status <> 'approved_recruiting' then
    delete from team_interest
    where team_id = p_team_id
      and student_id = p_student_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Student interest was no longer actionable and has been cleared.',
      'data', jsonb_build_object(
        'team_id', p_team_id,
        'student_id', p_student_id,
        'capstone_id', v_capstone_id,
        'already_resolved', true,
        'stale_interest_cleared', true,
        'rejected', false
      )
    );
  end if;

  delete from team_interest
  where team_id = p_team_id
    and student_id = p_student_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Student interest rejected.',
    'data', jsonb_build_object(
      'team_id', p_team_id,
      'student_id', p_student_id,
      'capstone_id', v_capstone.capstone_id,
      'rejected', true
    )
  );
end;
$$;

create or replace function watmatch_express_team_interest(
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
  v_team teams%rowtype;
  v_student users%rowtype;
begin
  if p_capstone_id is null or p_student_id is null then
    raise exception 'Invalid interest request.' using errcode = '22023';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found then
    raise exception 'Capstone not found.' using errcode = 'P0002';
  end if;

  if v_capstone.archived is true then
    raise exception 'This capstone is archived.' using errcode = '23514';
  end if;

  if v_capstone.status <> 'approved_recruiting' then
    raise exception 'This capstone is not accepting new interest.' using errcode = '23514';
  end if;

  if v_capstone.user_fk is not null and v_capstone.user_fk = p_student_id then
    raise exception 'You cannot request to join your own capstone.' using errcode = '23514';
  end if;

  if v_capstone.team_fk is null then
    raise exception 'No team found for this capstone.' using errcode = 'P0002';
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found or v_team.capstone_fk is distinct from v_capstone.capstone_id then
    raise exception 'No team found for this capstone.' using errcode = 'P0002';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  select *
    into v_student
  from watmatch_assert_student_with_course(p_student_id);

  if exists (
    select 1
    from team_memberships
    where user_fk = p_student_id
  ) then
    if exists (
      select 1
      from team_memberships
      where user_fk = p_student_id
        and team_fk = v_team.team_id
    ) then
      raise exception 'You are already in this capstone team.' using errcode = '23505';
    end if;

    raise exception 'You are already part of a team.' using errcode = '23505';
  end if;

  perform watmatch_assert_no_cross_pending_team_relationship(v_team.team_id, p_student_id, 'interest');

  insert into team_interest (team_id, student_id, message)
  values (v_team.team_id, p_student_id, p_message)
  on conflict (team_id, student_id) do update
    set message = excluded.message;

  return jsonb_build_object(
    'success', true,
    'message', 'Interest recorded',
    'data', jsonb_build_object(
      'team_id', v_team.team_id,
      'student_id', p_student_id,
      'capstone_id', v_capstone.capstone_id
    )
  );
end;
$$;

create or replace function watmatch_create_invite(
  p_team_id bigint,
  p_user_id bigint,
  p_actor_id bigint,
  p_invite_id text
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
  v_invitee users%rowtype;
  v_invite invites%rowtype;
begin
  if p_team_id is null
     or p_user_id is null
     or p_actor_id is null
     or nullif(btrim(coalesce(p_invite_id, '')), '') is null then
    raise exception 'Invalid invite request.' using errcode = '22023';
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
    raise exception 'Team changed while invite creation was starting. Please retry.' using errcode = '40001';
  end if;

  if v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can create invites.' using errcode = '42501';
  end if;

  if v_capstone_id is not null
     and (
       v_capstone.archived is true
       or v_capstone.status in ('approved', 'pending_review', 'pending_multi_course_approval', 'archived')
     ) then
    raise exception 'This team is not accepting invites right now.' using errcode = '23514';
  end if;

  select *
    into v_invitee
  from watmatch_assert_student_with_course(p_user_id);

  if exists (
    select 1
    from team_memberships
    where user_fk = p_user_id
  ) then
    raise exception 'This student is already enrolled in a capstone team and cannot be invited.'
      using errcode = '23505';
  end if;

  perform watmatch_assert_no_cross_pending_team_relationship(p_team_id, p_user_id, 'invite');

  insert into invites (invite_id, team_fk, user_fk)
  values (p_invite_id, p_team_id, p_user_id)
  on conflict (team_fk, user_fk) do nothing
  returning * into v_invite;

  if v_invite.invite_id is null then
    select *
      into v_invite
    from invites
    where team_fk = p_team_id
      and user_fk = p_user_id;
  end if;

  if v_invite.invite_id is null then
    raise exception 'Invite could not be created. Please retry.' using errcode = '23505';
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Invite created successfully',
    'data', to_jsonb(v_invite)
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
  v_invite_hint invites%rowtype;
  v_invite invites%rowtype;
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_capstone_id bigint;
begin
  if nullif(btrim(coalesce(p_invite_id, '')), '') is null or p_user_id is null then
    raise exception 'Invalid invite acceptance request.' using errcode = '22023';
  end if;

  select *
    into v_invite_hint
  from invites
  where invite_id = p_invite_id;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already accepted, declined, or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  if v_invite_hint.user_fk is distinct from p_user_id then
    raise exception 'This invite is not for the specified user.' using errcode = '42501';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = v_invite_hint.team_fk;

  if not found then
    delete from invites
    where invite_id = p_invite_id
      and user_fk = p_user_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer available and has been cleared.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true, 'stale_invite_cleared', true)
    );
  end if;

  if v_capstone_id is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_capstone_id
    for update;

    if not found then
      delete from invites
      where invite_id = p_invite_id
        and user_fk = p_user_id;

      return jsonb_build_object(
        'success', true,
        'message', 'Invite was no longer available and has been cleared.',
        'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true, 'stale_invite_cleared', true)
      );
    end if;
  end if;

  select *
    into v_team
  from teams
  where team_id = v_invite_hint.team_fk
  for update;

  if not found then
    delete from invites
    where invite_id = p_invite_id
      and user_fk = p_user_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer available and has been cleared.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true, 'stale_invite_cleared', true)
    );
  end if;

  if v_team.status in ('archived', 'finalized') then
    delete from invites
    where invite_id = p_invite_id
      and user_fk = p_user_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer available and has been cleared.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true, 'stale_invite_cleared', true)
    );
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while invite acceptance was starting. Please retry.' using errcode = '40001';
  end if;

  if v_capstone_id is not null
     and (
       v_capstone.capstone_id is null
       or v_capstone.archived is true
       or v_capstone.status in ('approved', 'archived')
     ) then
    delete from invites
    where invite_id = p_invite_id
      and user_fk = p_user_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Invite was no longer actionable and has been cleared.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true, 'stale_invite_cleared', true)
    );
  end if;

  if v_capstone_id is not null
     and v_capstone.status in ('pending_review', 'pending_multi_course_approval') then
    return jsonb_build_object(
      'success', false,
      'message', 'This invite is still pending, but the project is being reviewed. You can accept it later.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'invite_still_pending', true)
    );
  end if;

  select *
    into v_invite
  from invites
  where invite_id = p_invite_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already accepted, declined, or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  if v_invite.user_fk is distinct from p_user_id then
    raise exception 'This invite is not for the specified user.' using errcode = '42501';
  end if;

  if v_invite.team_fk is distinct from v_team.team_id then
    raise exception 'Invite changed while acceptance was starting. Please retry.' using errcode = '40001';
  end if;

  perform watmatch_claim_team_membership(v_team.team_id, p_user_id, false);

  if v_team.capstone_fk is not null then
    perform watmatch_reopen_capstone_review_after_membership_change(v_team.capstone_fk, v_team.team_id);
  end if;

  delete from invites
  where user_fk = p_user_id;

  delete from team_interest
  where student_id = p_user_id;

  select *
    into v_team
  from teams
  where team_id = v_team.team_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Invite accepted successfully.',
    'data', jsonb_build_object('team', to_jsonb(v_team), 'invite_id', p_invite_id)
  );
end;
$$;

create or replace function watmatch_withdraw_team_interest(
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
  v_interest_exists boolean := false;
begin
  if p_capstone_id is null or p_student_id is null then
    raise exception 'Invalid interest withdrawal request.' using errcode = '22023';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = p_capstone_id
  for update;

  if not found or v_capstone.team_fk is null then
    return jsonb_build_object(
      'success', true,
      'message', 'Interest was already withdrawn or no longer available.',
      'data', jsonb_build_object('capstone_id', p_capstone_id, 'student_id', p_student_id, 'already_resolved', true)
    );
  end if;

  select *
    into v_team
  from teams
  where team_id = v_capstone.team_fk
  for update;

  if not found or v_team.capstone_fk is distinct from v_capstone.capstone_id then
    return jsonb_build_object(
      'success', true,
      'message', 'Interest was already withdrawn or no longer available.',
      'data', jsonb_build_object('capstone_id', p_capstone_id, 'student_id', p_student_id, 'already_resolved', true)
    );
  end if;

  select true
    into v_interest_exists
  from team_interest
  where team_id = v_team.team_id
    and student_id = p_student_id
  for update;

  if coalesce(v_interest_exists, false) is not true then
    return jsonb_build_object(
      'success', true,
      'message', 'Interest was already withdrawn or no longer available.',
      'data', jsonb_build_object('capstone_id', p_capstone_id, 'team_id', v_team.team_id, 'student_id', p_student_id, 'already_resolved', true)
    );
  end if;

  delete from team_interest
  where team_id = v_team.team_id
    and student_id = p_student_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Interest withdrawn.',
    'data', jsonb_build_object('capstone_id', p_capstone_id, 'team_id', v_team.team_id, 'student_id', p_student_id)
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
  v_invite_hint invites%rowtype;
  v_invite invites%rowtype;
  v_team teams%rowtype;
  v_capstone_id bigint;
  v_team_hint_exists boolean := false;
begin
  if nullif(btrim(coalesce(p_invite_id, '')), '') is null or p_user_id is null then
    raise exception 'Invalid invite decline request.' using errcode = '22023';
  end if;

  select *
    into v_invite_hint
  from invites
  where invite_id = p_invite_id;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already declined or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  if v_invite_hint.user_fk is distinct from p_user_id then
    raise exception 'This invite is not for the specified user.' using errcode = '42501';
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = v_invite_hint.team_fk;

  v_team_hint_exists := found;

  if v_team_hint_exists and v_capstone_id is not null then
    perform 1
    from capstones
    where capstone_id = v_capstone_id
    for update;
  end if;

  if v_team_hint_exists then
    select *
      into v_team
    from teams
    where team_id = v_invite_hint.team_fk
    for update;

    if found and v_team.capstone_fk is distinct from v_capstone_id then
      raise exception 'Team changed while invite decline was starting. Please retry.' using errcode = '40001';
    end if;
  end if;

  select *
    into v_invite
  from invites
  where invite_id = p_invite_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already declined or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  if v_invite.user_fk is distinct from p_user_id then
    raise exception 'This invite is not for the specified user.' using errcode = '42501';
  end if;

  if v_invite.team_fk is distinct from v_invite_hint.team_fk then
    raise exception 'Invite changed while decline was starting. Please retry.' using errcode = '40001';
  end if;

  delete from invites
  where invite_id = p_invite_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Invite declined successfully.',
    'data', jsonb_build_object('invite_id', p_invite_id)
  );
end;
$$;

create or replace function watmatch_revoke_invite(
  p_invite_id text,
  p_actor_id bigint,
  p_actor_role text default 'student'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce(p_actor_role, 'student'));
  v_invite_hint invites%rowtype;
  v_invite invites%rowtype;
  v_team teams%rowtype;
  v_capstone_id bigint;
begin
  if nullif(btrim(coalesce(p_invite_id, '')), '') is null or p_actor_id is null then
    raise exception 'Invalid invite revoke request.' using errcode = '22023';
  end if;

  select *
    into v_invite_hint
  from invites
  where invite_id = p_invite_id;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already revoked or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  select capstone_fk
    into v_capstone_id
  from teams
  where team_id = v_invite_hint.team_fk;

  if not found then
    delete from invites
    where invite_id = p_invite_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Invite was stale and has been cleared.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true, 'stale_invite_cleared', true)
    );
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
  where team_id = v_invite_hint.team_fk
  for update;

  if not found then
    delete from invites
    where invite_id = p_invite_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Invite was stale and has been cleared.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true, 'stale_invite_cleared', true)
    );
  end if;

  if v_team.capstone_fk is distinct from v_capstone_id then
    raise exception 'Team changed while invite revoke was starting. Please retry.' using errcode = '40001';
  end if;

  if v_team.leader_fk is distinct from p_actor_id
     and watmatch_actor_can_manage_team(v_team.team_id, p_actor_id, v_role) is not true then
    raise exception 'Only the team leader or scoped instructors/admins can revoke invites.' using errcode = '42501';
  end if;

  select *
    into v_invite
  from invites
  where invite_id = p_invite_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'message', 'Invite was already revoked or no longer available.',
      'data', jsonb_build_object('invite_id', p_invite_id, 'already_resolved', true)
    );
  end if;

  if v_invite.team_fk is distinct from v_team.team_id then
    raise exception 'Invite changed while revoke was starting. Please retry.' using errcode = '40001';
  end if;

  delete from invites
  where invite_id = p_invite_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Invite revoked successfully.',
    'data', jsonb_build_object('invite_id', p_invite_id)
  );
end;
$$;

create or replace function watmatch_cleanup_stale_invites(
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
    raise exception 'Forbidden. You can only clean up your own invites.' using errcode = '42501';
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
        'message', 'Team invite cleanup completed.',
        'data', jsonb_build_object('deleted', 0)
      );
    end if;

    if v_team.leader_fk is distinct from p_actor_id
       and watmatch_actor_can_manage_team(v_team.team_id, p_actor_id, v_role) is not true then
      raise exception 'Forbidden. You cannot clean up invites for this team.' using errcode = '42501';
    end if;
  end if;

  delete from invites i
  using teams t
  left join capstones c on c.capstone_id = t.capstone_fk
  where i.team_fk = t.team_id
    and (p_user_id is null or i.user_fk = p_user_id)
    and (p_team_id is null or i.team_fk = p_team_id)
    and (
      t.status in ('archived', 'finalized')
      or exists (
        select 1
        from team_memberships tm
        where tm.user_fk = i.user_fk
      )
      or (
        t.capstone_fk is not null
        and (
          c.capstone_id is null
          or c.archived is true
          or c.status in ('approved', 'archived')
        )
      )
    );

  get diagnostics v_deleted_count = row_count;

  return jsonb_build_object(
    'success', true,
    'message', 'Stale invites cleaned up.',
    'data', jsonb_build_object('deleted', v_deleted_count)
  );
end;
$$;

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
    raise exception 'Forbidden. You can only modify teams with at least one student in your course.'
      using errcode = '42501';
  end if;

  perform watmatch_claim_team_membership(p_team_id, p_student_id, false);

  if v_team.capstone_fk is not null then
    perform watmatch_reopen_capstone_review_after_membership_change(v_team.capstone_fk, p_team_id);
  end if;

  delete from invites
  where user_fk = p_student_id;

  delete from team_interest
  where student_id = p_student_id;

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
    raise exception 'Forbidden. You can only modify teams with at least one student in your course.'
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

    if v_capstone.status in ('approved', 'pending_review', 'pending_multi_course_approval') then
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

    if v_capstone.status in ('approved', 'pending_review', 'pending_multi_course_approval') then
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

    if v_capstone.status in ('approved', 'pending_review', 'pending_multi_course_approval') then
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
begin
  if p_actor_id is null then
    raise exception 'Invalid actor identity.' using errcode = '28000';
  end if;

  if v_role not in ('admin', 'instructor', 'student') then
    raise exception 'Forbidden. Unauthorized role for team disband.' using errcode = '42501';
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

  v_was_archived := v_team.status = 'archived';

  select course_fk
    into v_actor_course
  from users
  where user_id = p_actor_id;

  if v_role = 'instructor' then
    if v_actor_course is null then
      raise exception 'Instructor must be assigned to a course.' using errcode = '23514';
    end if;

    if not exists (
      select 1
      from team_memberships tm
      join users u on u.user_id = tm.user_fk
      where tm.team_fk = p_team_id
        and u.course_fk = v_actor_course
    ) then
      raise exception 'Forbidden. You can only disband teams with at least one student in your course.'
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
       and v_capstone.status in ('approved', 'approved_recruiting', 'pending_review', 'pending_multi_course_approval') then
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

  delete from team_interest
  where team_id = p_team_id;

  delete from invites
  where team_fk = p_team_id;

  update teams
  set status = 'archived',
      leader_fk = null
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
    'message', case when v_was_archived then 'Team was already disbanded; stale workflow state repaired.' when v_team.capstone_fk is null then 'Team disbanded successfully.' else 'Team disbanded and linked capstone archived.' end,
    'data', jsonb_build_object('team_id', p_team_id, 'capstone_id', v_team.capstone_fk, 'capstone_archived', v_team.capstone_fk is not null)
  );
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
       and v_capstone.status in ('approved', 'pending_review', 'pending_multi_course_approval') then
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
begin
  if v_role <> 'student' then
    raise exception 'Forbidden. Only the team leader can finalize recruiting.'
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

  if v_team.leader_fk is distinct from p_actor_id then
    raise exception 'Forbidden. Only the team leader can finalize recruiting.'
      using errcode = '42501';
  end if;

  perform watmatch_assert_team_members_valid(p_team_id);

  if v_team.capstone_fk is null then
    raise exception 'Only teams with an approved recruiting capstone can be finalized.'
      using errcode = '23514';
  end if;

  if v_capstone.archived is true then
    raise exception 'Archived capstones cannot be finalized.' using errcode = '23514';
  end if;

  if v_capstone.status = 'approved' then
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

  delete from team_interest
  where team_id = p_team_id;

  delete from invites
  where team_fk = p_team_id;

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (
    v_capstone.capstone_id,
    p_actor_id,
    'capstone_finalized',
    coalesce(v_reason, 'Recruiting closed; team finalized.')
  );

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor_id,
    v_role,
    'team_finalized',
    'team',
    p_team_id::text,
    v_reason,
    jsonb_build_object('capstone_id', v_capstone.capstone_id, 'finalized_at', v_now)
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Team finalized successfully.',
    'data', to_jsonb(v_team),
    'capstone', to_jsonb(v_capstone)
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
      archived_reason = coalesce(v_reason, 'privileged_archive'),
      updated_at = v_now
  where capstone_id = p_capstone_id;

  delete from team_interest
  where team_id = v_capstone.team_fk;

  delete from invites
  where team_fk = v_capstone.team_fk;

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
      'external_partner_notes', coalesce(watmatch_payload_nullable_text(p_payload, 'external_partner_notes'), v_current.external_partner_notes)
    );
  end if;

  return jsonb_build_object(
    'partner_opportunity_fk', null,
    'partner_opportunity_snapshot', null,
    'external_partner_name', watmatch_payload_nullable_text(p_payload, 'external_partner_name'),
    'external_partner_organization', watmatch_payload_nullable_text(p_payload, 'external_partner_organization'),
    'external_partner_email', watmatch_payload_nullable_text(p_payload, 'external_partner_email'),
    'external_partner_website', watmatch_payload_nullable_text(p_payload, 'external_partner_website'),
    'external_partner_notes', watmatch_payload_nullable_text(p_payload, 'external_partner_notes')
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
    'external_partner_notes', p_capstone.external_partner_notes
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
begin
  if v_title is null then
    raise exception 'Title is required and cannot be empty.' using errcode = '22023';
  end if;

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
    external_partner_notes
  )
  values (
    p_user_id,
    v_title,
    watmatch_payload_text(p_payload, 'description'),
    watmatch_payload_text_array(p_payload, 'disciplines'),
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
    watmatch_payload_nullable_text(v_partner, 'external_partner_notes')
  )
  returning * into v_capstone;

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
begin
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
      disciplines = case when p_payload ? 'disciplines' then watmatch_payload_text_array(p_payload, 'disciplines') else disciplines end,
      skills = case when p_payload ? 'skills' then watmatch_payload_text_array(p_payload, 'skills') else skills end,
      problem_area = case when p_payload ? 'problem_area' then watmatch_payload_nullable_text(p_payload, 'problem_area') else problem_area end,
      main_objectives = case when p_payload ? 'main_objectives' then watmatch_payload_nullable_text(p_payload, 'main_objectives') else main_objectives end,
      scope_of_work = case when p_payload ? 'scope_of_work' then watmatch_payload_nullable_text(p_payload, 'scope_of_work') else scope_of_work end,
      deliverables = case when p_payload ? 'deliverables' then watmatch_payload_nullable_text(p_payload, 'deliverables') else deliverables end,
      meeting_frequency = case when p_payload ? 'meeting_frequency' then coalesce(watmatch_payload_text(p_payload, 'meeting_frequency'), 'weekly') else meeting_frequency end,
      uw_resources = case when p_payload ? 'uw_resources' then watmatch_payload_nullable_text(p_payload, 'uw_resources') else uw_resources end,
      org_resources = case when p_payload ? 'org_resources' then watmatch_payload_nullable_text(p_payload, 'org_resources') else org_resources end,
      other_resources = case when p_payload ? 'other_resources' then watmatch_payload_nullable_text(p_payload, 'other_resources') else other_resources end,
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
      approval = false,
      status = 'pending_review',
      updated_at = now()
  where capstone_id = p_capstone_id
  returning * into v_capstone;

  if not found then
    raise exception 'Capstone with ID % not found', p_capstone_id using errcode = 'P0002';
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
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
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

  if lower(coalesce(v_user.role, '')) <> 'student' then
    raise exception 'Only students can create capstones.' using errcode = '42501';
  end if;

  if exists (select 1 from team_memberships where user_fk = p_user_id) then
    raise exception 'You are already part of a team. Submit your capstone through your existing team.'
      using errcode = '23514';
  end if;

  v_effective_course := v_user.course_fk;
  if v_effective_course is null then
    raise exception 'Your account must be assigned to a course before submitting a capstone.' using errcode = '23514';
  end if;

  if p_course_id is not null and p_course_id <> v_effective_course then
    raise exception 'Submitted course does not match your assigned course.' using errcode = '23514';
  end if;

  v_capstone := watmatch_insert_capstone_from_payload(p_user_id, v_effective_course, p_payload);

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
  set capstone_fk = v_capstone.capstone_id
  where team_id = v_team.team_id
  returning * into v_team;

  perform watmatch_reset_capstone_course_requirements(v_capstone.capstone_id, v_team.team_id);

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (v_capstone.capstone_id, p_user_id, 'initial_submission', watmatch_capstone_snapshot(v_capstone)::text);

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
  v_capstone capstones%rowtype;
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

  v_effective_course := v_user.course_fk;
  if v_effective_course is null then
    raise exception 'Your account must be assigned to a course before submitting a capstone.' using errcode = '23514';
  end if;

  if p_course_id is not null and p_course_id <> v_effective_course then
    raise exception 'Submitted course does not match your assigned course.' using errcode = '23514';
  end if;

  v_capstone := watmatch_insert_capstone_from_payload(p_user_id, v_effective_course, p_payload);

  update teams
  set capstone_fk = v_capstone.capstone_id
  where team_id = p_team_id
    and capstone_fk is null
  returning * into v_team;

  if not found then
    raise exception 'This team already has a capstone idea. Only one capstone per team is allowed.'
      using errcode = '23514';
  end if;

  if v_team.course_fk is distinct from v_effective_course then
    update teams
    set course_fk = v_effective_course
    where team_id = p_team_id
    returning * into v_team;
  end if;

  update capstones
  set team_fk = p_team_id,
      updated_at = now()
  where capstone_id = v_capstone.capstone_id
  returning * into v_capstone;

  perform watmatch_reset_capstone_course_requirements(v_capstone.capstone_id, p_team_id);

  insert into approvals (capstone_fk, instructor_fk, action, comments)
  values (v_capstone.capstone_id, p_user_id, 'initial_submission', watmatch_capstone_snapshot(v_capstone)::text);

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
    perform watmatch_reset_capstone_course_requirements(v_capstone.capstone_id, v_capstone.team_fk);
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

  if v_capstone.status not in ('approved_recruiting', 'pending_review', 'pending_multi_course_approval') then
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

create or replace function watmatch_validate_team_interest_artifact()
returns trigger
language plpgsql
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_student users%rowtype;
begin
  select *
    into v_team
  from teams
  where team_id = new.team_id;

    if not found or v_team.status in ('archived', 'finalized') then
      raise exception 'This team is no longer active.' using errcode = '23514';
    end if;

  if v_team.capstone_fk is null then
    raise exception 'Interest requires a public recruiting capstone.' using errcode = '23514';
  end if;

  select *
    into v_capstone
  from capstones
  where capstone_id = v_team.capstone_fk
  for update;

  if not found
     or v_capstone.archived is true
     or v_capstone.status <> 'approved_recruiting' then
    raise exception 'This capstone is not accepting new interest.' using errcode = '23514';
  end if;

  select *
    into v_team
  from teams
  where team_id = new.team_id
  for update;

  if not found
     or v_team.status in ('archived', 'finalized')
     or v_team.capstone_fk is distinct from v_capstone.capstone_id then
    raise exception 'This team is no longer accepting interest.' using errcode = '23514';
  end if;

  select *
    into v_student
  from users
  where user_id = new.student_id
  for update;

  if not found then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_student.role, '')) <> 'student' then
    raise exception 'Only students can express interest in capstones.' using errcode = '23514';
  end if;

  if v_student.course_fk is null then
    raise exception 'Your account must be assigned to a course before expressing interest.' using errcode = '23514';
  end if;

  if v_capstone.user_fk is not null and v_capstone.user_fk = new.student_id then
    raise exception 'You cannot request to join your own capstone.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from team_memberships
    where user_fk = new.student_id
  ) then
    raise exception 'This student is already part of a team.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from invites
    where team_fk = new.team_id
      and user_fk = new.student_id
  ) then
    raise exception 'You already have an invite to this capstone. Accept or decline the invite instead.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_team_interest_validate_artifact on team_interest;
create trigger trg_team_interest_validate_artifact
before insert or update on team_interest
for each row
execute function watmatch_validate_team_interest_artifact();

create or replace function watmatch_validate_invite_artifact()
returns trigger
language plpgsql
as $$
declare
  v_team teams%rowtype;
  v_capstone capstones%rowtype;
  v_invitee users%rowtype;
begin
  select *
    into v_team
  from teams
  where team_id = new.team_fk;

  if not found or v_team.status in ('archived', 'finalized') then
    raise exception 'This team is no longer active.' using errcode = '23514';
  end if;

  if v_team.capstone_fk is not null then
    select *
      into v_capstone
    from capstones
    where capstone_id = v_team.capstone_fk
    for update;

    if not found
       or v_capstone.archived is true
       or v_capstone.status in ('approved', 'pending_review', 'pending_multi_course_approval', 'archived') then
      raise exception 'This team is not accepting invites right now.' using errcode = '23514';
    end if;
  end if;

  select *
    into v_team
  from teams
  where team_id = new.team_fk
  for update;

  if not found
     or v_team.status in ('archived', 'finalized')
     or (
       v_capstone.capstone_id is not null
       and v_team.capstone_fk is distinct from v_capstone.capstone_id
     ) then
    raise exception 'This team is no longer accepting invites.' using errcode = '23514';
  end if;

  select *
    into v_invitee
  from users
  where user_id = new.user_fk
  for update;

  if not found then
    raise exception 'Invitee not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_invitee.role, '')) <> 'student' then
    raise exception 'Only student users can be invited to teams.' using errcode = '23514';
  end if;

  if v_invitee.course_fk is null then
    raise exception 'Invitee must be assigned to a course before joining a team.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from team_memberships
    where user_fk = new.user_fk
  ) then
    raise exception 'This student is already enrolled in a capstone team and cannot be invited.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from team_interest
    where team_id = new.team_fk
      and student_id = new.user_fk
  ) then
    raise exception 'This student has already expressed interest in this capstone. Accept or reject their interest instead.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invites_validate_artifact on invites;
create trigger trg_invites_validate_artifact
before insert or update on invites
for each row
execute function watmatch_validate_invite_artifact();

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

create or replace function watmatch_validate_admin_managed_user(
  p_email text,
  p_role text,
  p_course_id bigint
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
begin
  if v_email = '' then
    raise exception 'Email is required.' using errcode = '22023';
  end if;

  if v_role not in ('student', 'instructor', 'admin', 'external_partner') then
    raise exception 'Role must be student, instructor, admin, or external_partner.' using errcode = '23514';
  end if;

  if v_role <> 'external_partner' and v_email !~ '^[^@[:space:]]+@uwaterloo[.]ca$' then
    raise exception 'Email must be a valid @uwaterloo.ca address.' using errcode = '23514';
  end if;

  if v_role in ('admin', 'external_partner') and p_course_id is not null then
    raise exception 'Admin and external partner users cannot be enrolled in a course.' using errcode = '23514';
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

  return jsonb_build_object('email', v_email, 'role', v_role);
end;
$$;

create or replace function watmatch_admin_create_user(
  p_email text,
  p_role text,
  p_course_id bigint,
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
  v_active boolean := coalesce(p_active, true);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);
  v_validated := watmatch_validate_admin_managed_user(p_email, p_role, p_course_id);
  v_email := v_validated ->> 'email';
  v_role := v_validated ->> 'role';

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

  insert into users (email, role, course_fk, active)
  values (v_email, v_role, case when v_role in ('admin', 'external_partner') then null else p_course_id end, v_active)
  returning * into v_user;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'user_created',
    'user',
    v_user.user_id::text,
    v_reason,
    jsonb_build_object('email', v_email, 'role', v_role, 'course_fk', v_user.course_fk, 'active', v_user.active)
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

  update users
  set course_fk = p_course_id
  where user_id = p_user_id
  returning * into v_user;

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

  if v_user.active is not distinct from v_active then
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

  if p_user_id is null then
    raise exception 'Invalid user identity.' using errcode = '22023';
  end if;
  if v_email is null then
    raise exception 'User email is required.' using errcode = '22023';
  end if;
  if v_role not in ('student', 'instructor', 'admin', 'external_partner') then
    raise exception 'Role must be student, instructor, admin, or external_partner.' using errcode = '23514';
  end if;
  if v_role <> 'external_partner' and v_email !~ '^[^@[:space:]]+@uwaterloo[.]ca$' then
    raise exception 'Email must be a uwaterloo.ca address.' using errcode = '23514';
  end if;
  if v_role in ('admin', 'external_partner') and p_course_id is not null then
    raise exception 'Admin and external partner users cannot be enrolled in a course.' using errcode = '23514';
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

  update users
  set email = v_email,
      role = v_role,
      course_fk = case when v_role in ('admin', 'external_partner') then null else p_course_id end,
      active = v_active,
      active_team_fk = case when v_role = 'student' then active_team_fk else null end,
      refresh_token = case when v_active is false then null else refresh_token end
  where user_id = p_user_id
  returning * into v_user;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    'user_updated',
    'user',
    p_user_id::text,
    v_reason,
    jsonb_build_object(
      'old', jsonb_build_object('email', v_old_user.email, 'role', v_old_user.role, 'course_fk', v_old_user.course_fk, 'active', v_old_user.active),
      'new', jsonb_build_object('email', v_user.email, 'role', v_user.role, 'course_fk', v_user.course_fk, 'active', v_user.active),
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
     or exists (select 1 from invites where user_fk = p_user_id)
     or exists (select 1 from team_interest where student_id = p_user_id) then
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
  p_skills text[] default '{}'::text[]
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
  v_skills text[];
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

  if v_about_me is not null and length(v_about_me) > 250 then
    raise exception 'About me must be 250 characters or fewer.' using errcode = '22023';
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

  insert into student_profile (
    student_fk,
    about_me,
    skills,
    updated_at
  )
  values (
    v_student.user_id,
    v_about_me,
    v_skills,
    now()
  )
  on conflict (student_fk) do update
    set about_me = excluded.about_me,
        skills = excluded.skills,
        updated_at = now()
  returning * into v_profile;

  return jsonb_build_object(
    'success', true,
    'message', 'Profile saved successfully.',
    'data', to_jsonb(v_profile)
  );
end;
$$;

create or replace function watmatch_upsert_partner_profile(
  p_actor_id bigint,
  p_actor_role text,
  p_partner_user_id bigint,
  p_display_name text,
  p_organization text,
  p_contact_email text,
  p_website text default null,
  p_bio text default null,
  p_areas text[] default '{}'::text[]
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
begin
  v_actor := watmatch_assert_partner_actor(p_actor_id, p_actor_role);
  v_partner_user_id := case when v_role = 'admin' then p_partner_user_id else p_actor_id end;
  v_partner := watmatch_assert_external_partner_user(v_partner_user_id, true);

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
    jsonb_build_object('partner_user_fk', v_partner.user_id, 'organization', v_profile.organization)
  );

  return jsonb_build_object('success', true, 'message', 'External partner profile saved.', 'data', to_jsonb(v_profile));
end;
$$;

create or replace function watmatch_upsert_partner_opportunity(
  p_actor_id bigint,
  p_actor_role text,
  p_opportunity_id bigint,
  p_partner_user_id bigint,
  p_title text,
  p_organization text,
  p_description text,
  p_disciplines text[] default '{}'::text[],
  p_skills text[] default '{}'::text[],
  p_target_course_tags text[] default '{}'::text[],
  p_preferred_team_size text default null,
  p_max_active_teams integer default null,
  p_contact_email text default null,
  p_contact_url text default null,
  p_status text default 'published'
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
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_preferred_team_size text := nullif(btrim(coalesce(p_preferred_team_size, '')), '');
  v_contact_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_contact_url text := nullif(btrim(coalesce(p_contact_url, '')), '');
  v_status text := lower(nullif(btrim(coalesce(p_status, 'published')), ''));
  v_disciplines text[];
  v_skills text[];
  v_target_course_tags text[];
  v_action text;
begin
  v_actor := watmatch_assert_partner_actor(p_actor_id, p_actor_role);

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
    into v_disciplines
  from unnest(coalesce(p_disciplines, '{}'::text[])) as value(item);

  select coalesce(array_agg(distinct nullif(btrim(item), '')) filter (where nullif(btrim(item), '') is not null), '{}'::text[])
    into v_skills
  from unnest(coalesce(p_skills, '{}'::text[])) as value(item);

  select coalesce(array_agg(distinct nullif(btrim(item), '')) filter (where nullif(btrim(item), '') is not null), '{}'::text[])
    into v_target_course_tags
  from unnest(coalesce(p_target_course_tags, '{}'::text[])) as value(item);

  if p_opportunity_id is null then
    insert into partner_opportunities (
      partner_user_fk,
      title,
      organization,
      description,
      disciplines,
      skills,
      target_course_tags,
      preferred_team_size,
      max_active_teams,
      contact_email,
      contact_url,
      status,
      archived_at,
      updated_at
    )
    values (
      v_partner.user_id,
      v_title,
      v_organization,
      v_description,
      v_disciplines,
      v_skills,
      v_target_course_tags,
      v_preferred_team_size,
      p_max_active_teams,
      v_contact_email,
      v_contact_url,
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
        disciplines = v_disciplines,
        skills = v_skills,
        target_course_tags = v_target_course_tags,
        preferred_team_size = v_preferred_team_size,
        max_active_teams = p_max_active_teams,
        contact_email = v_contact_email,
        contact_url = v_contact_url,
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
      'max_active_teams', v_opportunity.max_active_teams
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_opportunity_id is null then 'External opportunity created.' else 'External opportunity updated.' end,
    'data', to_jsonb(v_opportunity)
  );
end;
$$;

create or replace function watmatch_get_partner_opportunities(
  p_actor_id bigint,
  p_actor_role text,
  p_page integer default 1,
  p_page_size integer default 12,
  p_search text default null,
  p_discipline text default null,
  p_skill text default null,
  p_status text default 'published'
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

create or replace function watmatch_admin_upsert_course(
  p_course_id bigint,
  p_code text,
  p_name text,
  p_term text,
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
  v_course courses%rowtype;
  v_code text := upper(nullif(btrim(coalesce(p_code, '')), ''));
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_term text := nullif(btrim(coalesce(p_term, '')), '');
  v_active boolean := coalesce(p_active, true);
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

  if exists (
    select 1
    from courses
    where upper(code) = v_code
      and lower(coalesce(term, '')) = lower(coalesce(v_term, ''))
      and (p_course_id is null or course_id <> p_course_id)
  ) then
    raise exception 'A course with this code and term already exists.' using errcode = '23505';
  end if;

  if p_course_id is null then
    insert into courses (code, name, term, active)
    values (v_code, v_name, v_term, v_active)
    returning * into v_course;
    v_action := 'course_created';
  else
    update courses
    set code = v_code,
        name = v_name,
        term = v_term,
        active = v_active
    where course_id = p_course_id
    returning * into v_course;

    if not found then
      raise exception 'Course not found.' using errcode = 'P0002';
    end if;
    v_action := 'course_updated';
  end if;

  insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor.user_id,
    v_actor.role,
    v_action,
    'course',
    v_course.course_id::text,
    v_reason,
    jsonb_build_object('code', v_course.code, 'name', v_course.name, 'term', v_course.term, 'active', v_course.active)
  );

  return jsonb_build_object(
    'success', true,
    'message', case when p_course_id is null then 'Course created.' else 'Course updated.' end,
    'data', to_jsonb(v_course)
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
  v_department text := nullif(btrim(coalesce(p_department, '')), '');
  v_year text := nullif(btrim(coalesce(p_year, '')), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_students text[];
  v_past past_capstones%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := watmatch_assert_admin_actor(p_actor_id);

  if v_title is null then
    raise exception 'Past capstone title is required.' using errcode = '22023';
  end if;
  if v_department is null then
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
    values (v_title, v_description, v_department, v_year, coalesce(v_students, '{}'::text[]), p_source_fk)
    returning * into v_past;

    insert into audit_log (actor_fk, actor_role, action, entity_type, entity_id, reason, metadata)
    values (
      v_actor.user_id,
      v_actor.role,
      'past_capstone_created',
      'past_capstone',
      v_past.past_capstone_id::text,
      v_reason,
      jsonb_build_object('title', v_title, 'department', v_department, 'year', v_year)
    );
  else
    update past_capstones
    set title = v_title,
        description = v_description,
        department = v_department,
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
      jsonb_build_object('title', v_title, 'department', v_department, 'year', v_year)
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

  insert into team_memberships (user_fk, team_fk, is_leader)
  select selected.student_id, v_team.team_id, selected.student_id = p_leader_id
  from unnest(v_student_ids) as selected(student_id)
  order by selected.student_id;

  update teams
  set leader_fk = p_leader_id
  where team_id = v_team.team_id
  returning * into v_team;

  delete from invites
  where user_fk = any(v_student_ids);

  delete from team_interest
  where student_id = any(v_student_ids);

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

-- Application RPCs are backend-only. The frontend must never call these
-- functions directly through anon/authenticated Supabase clients.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;
alter default privileges in schema public grant execute on functions to service_role;
