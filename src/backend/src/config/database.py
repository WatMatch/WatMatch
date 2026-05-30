import os
import base64
import json
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Load backend-local environment variables regardless of the shell cwd.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _jwt_role(token: str) -> str | None:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload = parts[1] + "=" * (-len(parts[1]) % 4)
        decoded = base64.urlsafe_b64decode(payload.encode()).decode()
        data = json.loads(decoded)
        role = data.get("role")
        return str(role) if role else None
    except Exception:
        return None

if not supabase_url or not supabase_service_role_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")

if _jwt_role(supabase_service_role_key) != "service_role":
    raise ValueError(
        "SUPABASE_SERVICE_ROLE_KEY is set, but it is not a service_role key. "
        "Copy the service_role secret from Supabase Project Settings > API."
    )

supabase: Client = create_client(supabase_url, supabase_service_role_key)
