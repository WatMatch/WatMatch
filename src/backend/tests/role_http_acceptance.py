"""Real HTTP authorization + PostgreSQL tests, against local role_test_app only.

Run explicitly after db/role_preview_fixture.sql; not included in unit discovery.
"""
from fastapi.testclient import TestClient
from role_test_app import app, supabase
from src.auth.jwt_utils import create_access_token

client = TestClient(app)
checks = 0


def check(value, label):
    global checks
    assert value, label
    checks += 1
    print('PASS:', label)


def login(email):
    response = client.post('/api/v1/auth/login', json={'email': email})
    assert response.status_code == 200, response.text
    return response.json()['data']


def headers(session):
    return {'Authorization': 'Bearer ' + session['access_token']}


def switch(session, role):
    response = client.post('/api/v1/auth/switch-role', headers=headers(session), json={'role': role})
    assert response.status_code == 200, response.text
    return response.json()['data']


def grant(admin, user_id, roles, **extra):
    return client.put(f'/api/v1/users/admin/users/{user_id}/roles', headers=headers(admin),
                      json={'roles': roles, 'reason': 'Local acceptance test', **extra})


admin = login('admin@uwaterloo.ca')
instructor = login('instructor.se@uwaterloo.ca')
mentor = login('mentor.lee@uwaterloo.ca')
student = login('student.test@uwaterloo.ca')
i = instructor['user']['user_id']
m = mentor['user']['user_id']
s = student['user']['user_id']
course_id = instructor['user']['course_fk']
department_id = instructor['user']['home_department_fk']
check(grant(student, i, ['instructor', 'mentor']).status_code == 403, 'student cannot assign roles via API')
check(grant(instructor, i, ['instructor', 'mentor']).status_code == 403, 'instructor cannot assign roles via API')
check(grant(admin, s, ['instructor', 'mentor']).status_code == 400, 'admin cannot add roles to a student')
check(client.post('/api/v1/auth/switch-role', headers=headers(student), json={'role': 'mentor'}).status_code == 403, 'student cannot switch')
check(grant(admin, i, ['instructor', 'admin']).status_code == 422, 'unsupported additional admin role rejected')
check(grant(admin, i, ['instructor', 'mentor']).status_code == 200, 'admin grants mentor to instructor')
listed = client.get('/api/v1/users/admin/users', headers=headers(admin))
check(listed.status_code == 200, 'admin account list loads role relationship without ambiguity')
check(next(u for u in listed.json()['data'] if u['user_id'] == i)['assigned_roles'] == ['instructor', 'mentor'], 'admin sees both memberships')
instructor = login('instructor.se@uwaterloo.ca')
mentoring = switch(instructor, 'mentor')
check(mentoring['user']['user_id'] == i and mentoring['user']['role'] == 'mentor', 'instructor switches to mentor on same identity')
check(mentoring['user']['course_fk'] == course_id, 'course assignment survives switching')
check(client.get('/api/v1/capstones/mentor/dashboard', headers=headers(mentoring)).status_code == 200, 'mentor dashboard works with dual-role account')
# Instructor review queue and admin account management remain inaccessible in Mentor mode.
review_path = next(route.path for route in app.routes if getattr(route, 'name', '') == 'get_capstones_for_review')
check(client.get(review_path, headers=headers(mentoring)).status_code == 403, 'mentor workspace cannot use instructor review queue')
check(client.get('/api/v1/users/admin/users', headers=headers(mentoring)).status_code == 403, 'mentor workspace cannot use admin tools')
refreshed = client.post('/api/v1/auth/refresh', json={'refresh_token': mentoring['refresh_token']})
check(refreshed.status_code == 200 and refreshed.json()['data']['user']['role'] == 'mentor', 'refresh preserves active mentor role')
mentoring = refreshed.json()['data']
check(client.post('/api/v1/auth/refresh', json={'refresh_token': instructor['refresh_token']}).status_code == 401, 'switch rotates and invalidates previous refresh token')
teaching = switch(mentoring, 'instructor')
check(client.get(review_path, headers=headers(teaching)).status_code == 200, 'switching back restores instructor review queue')
check(client.get('/api/v1/capstones/mentor/dashboard', headers=headers(teaching)).status_code == 403, 'instructor workspace must switch before mentor actions')
check(teaching['access_token'] != instructor['access_token'], 'same-second token issuance remains unique')
check(grant(admin, m, ['instructor', 'mentor'], course_id=course_id, home_department_id=department_id).status_code == 200, 'existing mentor can gain instructor role')
mentor = login('mentor.lee@uwaterloo.ca')
mentor = switch(mentor, 'mentor')
mentor = switch(mentor, 'instructor')
check(mentor['user']['user_id'] == m and mentor['user']['role'] == 'instructor', 'original mentor switches in both directions')
# Restore the preview mentor to one role, while keeping Instructor+Mentor on the instructor.
check(grant(admin, m, ['mentor']).status_code == 200, 'admin revokes instructor from original mentor')
check(client.get('/api/v1/auth/me', headers=headers(mentor)).status_code == 403, 'revoked instructor token stops working immediately')
mentoring = switch(teaching, 'mentor')
check(grant(admin, i, ['instructor']).status_code == 200, 'admin revokes mentor')
check(client.get('/api/v1/auth/me', headers=headers(mentoring)).status_code == 403, 'revoked mentor token stops working immediately')
check(client.post('/api/v1/auth/refresh', json={'refresh_token': mentoring['refresh_token']}).status_code == 401, 'revoked role cannot be refreshed')
forged = create_access_token({'user_id': s, 'active_role': 'mentor', 'role': 'mentor'})
check(client.get('/api/v1/auth/me', headers={'Authorization': 'Bearer ' + forged}).status_code == 403, 'database membership is checked even for a signed role claim')
check(grant(admin, i, ['instructor', 'mentor']).status_code == 200, 'restore dual-role instructor for manual preview')
print(f'{checks} HTTP/database acceptance checks passed.')
