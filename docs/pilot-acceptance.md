# SE 490 pilot acceptance

Use this checklist to decide when students can test the Waterloo release.
A student should be able to sign in, find course projects and give feedback
without help from a developer.

The release checklist is [issue #14](https://github.com/WatMatch/WatMatch/issues/14).
It links the ECE access/time dependencies and the application rollout work.
Record the presentation date and pilot start cutoff there when confirmed.

## Before the session

1. Record the deployed Git revision, HTTPS origin, supported campus/VPN access,
   active feature flags and browser. Verify the deployment checks in
   [the VM guide](../deploy/README.md).
2. Confirm the intended Clerk instance and use approved accounts with verified
   emails. Provision the course offering and memberships using the existing
   administrative workflow. Keep the roster in the team's private channel.
3. Rehearse writes on isolated data first. For a pilot on shared data, identify
   the permitted test accounts and records before running the write tasks.
   The demo seed clears workflow data and cannot prepare an existing pilot.
4. Choose one student and one instructor for the first full trial. Prepare an
   outside-course test actor for permission checks in the isolated environment.
   Use a local email capture service for rehearsals that trigger mail.
5. Check the feedback form before distributing it. The current form asks about
   the overview and sign-in page. Add the chosen authenticated task before
   collecting feedback about projects or submissions.

## Release acceptance

Record pass, fail or blocked for each row. Include the revision and evidence
location. Keep personal data and session tokens out of public issues.

| Check | Expected outcome |
| --- | --- |
| Overview → sign-in → dashboard | Provider verifies identity and primary email. WatMatch resolves the approved account and correct workspace. |
| Unknown or inactive identity | Access is refused. No role can be chosen by changing browser data. |
| Student discovery | The home department is preserved and manual filtering still works after reload. |
| Draft recovery | An edit immediately followed by leaving the form reappears on return. Successful submission clears its draft. |
| Interest-history failure | An understandable error and Retry appear. Retry restores the history after the failed read recovers. |
| Team/proposal and instructor review | Approved test data passes through the agreed action and review. The student sees the resulting state after reload. |
| Role switching | The same instructor/mentor account switches both ways. Other tabs in the same session update. A separate session keeps its selection. |
| Course phase control | An approved standalone-course instructor advances one step at a time. A duplicate or stale action cannot skip a phase. Pending commitments block finalization. |
| Direct API permissions | Student, mentor, inactive actor, outside-course instructor and outside-team reader cannot exceed their scope. |
| Audit and retries | Authorized changes have expected actor/action records. Retrying a request does not duplicate its effect. |
| Logout | Clerk sign-out completes and the protected UI clears. Retired email-only login/refresh endpoints remain unavailable. Test session-revocation behavior with the provider's documented token lifetime. |
| Milestone feedback, if enabled | Assigned instructor posts once, a team member reads it, and an unrelated team is refused. Mentor/TA authoring is outside the implemented slice. |

A successful process health or readiness request does not establish that these
user workflows pass. The automated suites use mocks or isolated synthetic
identities. Record live provider sign-in and actual student trials separately.

## First student round

After the release acceptance passes, invite a small SE 490 group. Use the same
task and starting state for each student. Let them act before giving hints.
One session per participant is enough for the initial round.

Suggested task on an approved test project:

> Imagine your SE 490 team needs a capstone project. Sign in with your approved
> account. Find a project suitable for your course and explain why you chose it.
> Show where you would go next. Tell us where you became unsure.

Add submission/review tasks only when the session includes approved writable
records. For the earlier read-only preview, use the existing overview-to-sign-in
task and stop at the credential prompt.

Record completion without help, completion with help, blocked attempts and
reproducible bugs. Count human student participants, with internal team rehearsals
identified separately. Record whether the participant operated their device,
operated the facilitator's laptop or directed a screen share.

Use the **Pilot feedback** issue template for each confirmed problem. Add its
fix PR and retest outcome. A lower raw bug count is meaningful only with
comparable tasks and participant counts.

## Invitation

Replace the bracketed links only after verifying them from a student's device.

> Could you spend five minutes trying WatMatch? It helps SE 490 students find
> capstone projects. Open [approved Waterloo URL], follow the [campus/VPN
> instruction] and use the approved account arranged for this session. Find
> a project you would consider and show where you would go next. If you get
> stuck, tell us what you expected and what happened at [feedback form].

The current feedback form is
[WatMatch feedback](https://forms.gle/pNT4qwTJkPKo21SS8).
Its task text must match the release and access method used in the session.
