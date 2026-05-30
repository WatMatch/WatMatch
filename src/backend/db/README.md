# WatMatch Database Schema

`schema.sql` is the canonical Supabase/Postgres schema for the SE 490 redesign.
It replaces the SE 390 MVP schema, where team members were stored in array
fields and most workflows were handled as direct backend table writes.

## Core Tables

- `courses`: course ownership/context for students, instructors, teams, and capstones.
- `users`: app users with roles `student`, `instructor`, `admin`, and `external_partner`.
- `team_memberships`: canonical team membership table. One student can belong to one active team.
- `teams`: team identity, leader, linked capstone, course context, and team lifecycle status.
- `capstones`: project proposal, review status, partner metadata, and archive/finalization state.
- `capstone_course_approvals`: course-by-course decisions for multi-course teams.
- `approvals`: timeline records for instructor and workflow decisions.
- `invites`: leader-created invitations for students to join a team.
- `team_interest`: student interest records for approved recruiting capstones.
- `student_profile`: lightweight student profile fields.
- `past_capstones`: imported historical capstone records for search and browsing.
- `partner_profiles` and `partner_opportunities`: external partner profile and opportunity posting data.
- `audit_log`: records sensitive/admin/destructive workflow actions.

## Important Status Values

Capstone statuses:
- `draft`: editable local proposal state.
- `pending_review`: submitted for single-course review.
- `pending_multi_course_approval`: submitted and waiting on more than one course approval.
- `changes_requested`: instructor requested edits.
- `rejected`: instructor rejected the current idea.
- `approved_recruiting`: instructor-approved and visible for student interest.
- `approved`: finalized/locked.
- `archived`: no longer active.

Team statuses:
- `forming`: team is active and still mutable where the capstone state allows it.
- `finalized`: team is locked from student-side membership changes.
- `archived`: team is disbanded/removed from active workflows.

External partner opportunity statuses:
- `draft`: private to partner/admin.
- `published`: visible to logged-in users.
- `archived`: no longer available for new capstone links.

## Workflow Approach

Critical multi-row workflows are implemented as Supabase RPC functions in
`schema.sql`. This gives workflows a transactional boundary so related changes
either succeed together or fail together.

Examples include:
- creating capstones and teams,
- accepting invites and interests,
- approving/rejecting/requesting changes,
- finalizing or disbanding teams,
- admin user/course management,
- past capstone import and updates.

The FastAPI backend should call these RPCs for core workflows instead of
re-implementing multi-table state transitions with separate table writes.
