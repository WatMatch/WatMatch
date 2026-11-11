"""In-process role acceptance harness for a disposable, marked PostgREST fixture."""
import json
import os
import sys
import time
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
TEST_SECRET = 'watmatch-role-tests-only-not-a-production-secret-12345'
port = int(os.environ.get('WATMATCH_TEST_POSTGREST_PORT', '55440'))
rest = f'http://127.0.0.1:{port}'
os.environ.update(SUPABASE_URL=rest,
                  SUPABASE_SERVICE_ROLE_KEY=jwt.encode({'role': 'service_role'}, TEST_SECRET, algorithm='HS256'),
                  WATMATCH_READ_ONLY='false', WATMATCH_REQUIRE_SYNC_CLOCK='false',
                  NO_PROXY='localhost,127.0.0.1', no_proxy='localhost,127.0.0.1',
                  CORS_ORIGINS='http://127.0.0.1:3011')

from src.config.database import supabase
from src.auth.clerk_auth import ClerkSettings, ClerkVerifier
from main import app

# Standalone PostgREST serves / instead of the Supabase gateway's /rest/v1.
supabase.rest_url = rest + '/'
assert supabase.table('watmatch_role_test_marker').select('id').eq('id', 1).execute().data == [{'id': 1}]

issuer, origin = 'https://role-test.invalid', 'http://127.0.0.1:3011'
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
jwk = dict(json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key())), kid='fixture', use='sig', alg='RS256')
subjects, sessions = {}, {}


def identity_token(email):
    assert email.startswith('wmtrial.') and email.endswith('@uwaterloo.ca')
    user = 'user_' + email.split('@')[0].replace('.', '')
    sid = 'sess_' + uuid4().hex
    subjects[user], sessions[sid] = email, user
    now = int(time.time())
    return jwt.encode(dict(sub=user, sid=sid, iss=issuer, azp=origin, iat=now, nbf=now, exp=now+180),
                      key, algorithm='RS256', headers={'kid': 'fixture'})


def fake_clerk(request):
    if str(request.url) == issuer + '/.well-known/jwks.json':
        return httpx.Response(200, json={'keys': [jwk]})
    assert request.url.host == 'api.clerk.com' and request.method == 'GET'
    identifier = request.url.path.split('/')[-1]
    if identifier in sessions:
        return httpx.Response(200, json={'id': identifier, 'user_id': sessions[identifier], 'status': 'active'})
    if identifier in subjects:
        return httpx.Response(200, json={'id': identifier, 'locked': False, 'banned': False,
                              'primary_email_address_id': 'test', 'email_addresses': [{'id': 'test',
                              'email_address': subjects[identifier], 'verification': {'status': 'verified'}}]})
    return httpx.Response(404)


verifier = ClerkVerifier(ClerkSettings(issuer, 'fixture-only', frozenset({origin})), httpx.MockTransport(fake_clerk))
use_fixture_identity = patch('src.auth.dependencies.get_clerk_verifier', return_value=verifier)
