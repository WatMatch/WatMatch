"""Run on a fresh local role_test_app database with workspace_workflow_fixture.sql."""
import os
from uuid import uuid4

from fastapi.testclient import TestClient

from role_test_app import app, identity_token, use_fixture_identity


def signed_in(email):
    return {"Authorization": "Bearer " + identity_token(email)}


def expect(response, status):
    assert response.status_code == status, (response.request.url.path, response.status_code)
    return response


def trial(client):
    instructor = signed_in("wmtrial.milestonescopeinstructor@uwaterloo.ca")
    student = signed_in("wmtrial.milestoneteamstudent@uwaterloo.ca")
    outsider = signed_in("wmtrial.milestoneotherstudent@uwaterloo.ca")
    other_instructor = signed_in("wmtrial.milestoneotherinstructor@uwaterloo.ca")
    admin = signed_in("wmtrial.admin@uwaterloo.ca")
    course_id = 980001
    feedback = "/api/v1/capstones/980001/milestone-feedback"
    note = {"entry_id": str(uuid4()), "milestone": "Prototype review", "comment": "Include the reliability measurements."}

    account = expect(client.get("/api/v1/auth/me", headers=instructor), 200).json()["data"]
    saved = expect(client.post(feedback, headers=instructor, json=note), 200).json()
    assert saved["comment"] == note["comment"] and saved["entry_id"] == note["entry_id"] and saved["created_at"]
    assert expect(client.post(feedback, headers=instructor, json=note), 200).json() == saved
    expect(client.post(feedback, headers=instructor, json={**note, "comment": "Different text"}), 409)
    visible = expect(client.get(feedback, headers=student), 200)
    assert visible.json().count(saved) == 1 and visible.headers["cache-control"] == "private, no-store"
    expect(client.get(feedback, headers=outsider), 403)
    expect(client.post(feedback, headers=student, json=note), 403)
    expect(client.post(feedback, headers=other_instructor, json=note), 403)
    expect(client.get(feedback), 401)

    member_roles = {"roles": ["instructor", "mentor"], "reason": "Disposable course fixture"}
    expect(client.put(f"/api/v1/users/admin/users/{account['user_id']}/roles", headers=admin, json=member_roles), 200)
    course = f"/api/v1/courses/{course_id}"
    expect(client.put(course + "/instructor-phase-control", headers=admin, json={"enabled": True}), 200)
    phase = course + "/phase/advance"
    advance = {"expected_phase": "exploration"}
    switch = "/api/v1/auth/switch-role"
    expect(client.post(switch, headers=instructor, json={"role": "mentor"}), 200)
    expect(client.post(phase, headers=instructor, json=advance), 403)
    expect(client.post(feedback, headers=instructor, json={**note, "entry_id": str(uuid4())}), 403)
    expect(client.post(switch, headers=instructor, json={"role": "instructor"}), 200)
    expect(client.post(phase, headers=instructor, json=advance), 200)
    print("Passed instructor, team, duplicate submission and active workspace acceptance.")


if __name__ == "__main__":
    os.environ["WATMATCH_MILESTONE_FEEDBACK_ENABLED"] = "true"
    with use_fixture_identity, TestClient(app) as test_client:
        trial(test_client)
