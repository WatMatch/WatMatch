-- Courses
create table if not exists courses (
  course_id    bigint generated always as identity primary key,
  code         text not null unique,   -- e.g. 'SE 390'
  name         text not null           -- e.g. 'Design Project Planning'
);

-- Users
create table if not exists users (
  user_id      bigint generated always as identity primary key,
  email        text not null unique,
  role         text not null,           -- e.g., "student" | "instructor"
  course_fk    bigint references courses(course_id) on delete set null
);

-- Capstones
create table if not exists capstones (
  capstone_id  bigint generated always as identity primary key,
  user_fk      bigint references users(user_id) on delete set null,
  title        text not null,
  description  text,
  status       text default 'draft',    -- e.g., 'draft' | 'seeking-team' | 'approved'
  disciplines  text[] default '{}',
  skills       text[] default '{}',
  approval     boolean default false,
  team_fk      bigint                   -- if tied to a team later
);

-- Teams
create table if not exists teams (
  team_id      bigint generated always as identity primary key,
  leader_fk    bigint references users(user_id) on delete set null,
  capstone_fk  bigint references capstones(capstone_id) on delete set null,
  members      bigint[] default '{}',    -- array of user_id
  interested   bigint[] default '{}',    -- array of user_id
  status       text default 'forming',
  course_fk    bigint references courses(course_id) on delete set null
);

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