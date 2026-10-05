"""Local-only app harness. Never connects to the configured Supabase project.

Run from src/backend: .venv/bin/python tests/role_test_app.py
Requires the disposable PostgreSQL/PostgREST containers described in db/README.
"""
import os
import sys
from pathlib import Path
from jose import jwt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
TEST_SECRET = 'watmatch-role-tests-only-not-a-production-secret-12345'
os.environ.update(
    SUPABASE_URL='http://127.0.0.1:55440',
    SUPABASE_SERVICE_ROLE_KEY=jwt.encode({'role': 'service_role'}, TEST_SECRET, algorithm='HS256'),
    JWT_SECRET_KEY=TEST_SECRET,
    JWT_REFRESH_SECRET_KEY=TEST_SECRET + '-refresh',
    CORS_ORIGINS='http://localhost:3011,http://127.0.0.1:3011',
)
from src.config.database import supabase  # noqa: E402
# Standalone PostgREST serves at / rather than Supabase's /rest/v1 gateway.
supabase.rest_url = 'http://127.0.0.1:55440/'
from main import app  # noqa: E402

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8011)
