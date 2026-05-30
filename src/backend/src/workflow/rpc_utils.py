import ast
import json
from typing import Any, Dict

from src.config.database import supabase


def normalize_rpc_payload(data: Any) -> Dict[str, Any]:
    """Normalize Supabase RPC JSON/JSONB responses into a dict payload."""
    if isinstance(data, list):
        data = data[0] if data else None

    if isinstance(data, dict):
        return data

    if isinstance(data, str):
        try:
            parsed = json.loads(data)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {"success": True, "data": data}

    if data is None:
        return {}

    return {"success": True, "data": data}


def _exception_payload(exc: Exception) -> Dict[str, Any] | None:
    """Extract a JSON-like payload from Supabase client validation exceptions."""
    candidates = list(getattr(exc, "args", ()) or [])
    candidates.extend(
        value
        for value in (
            getattr(exc, "message", None),
            getattr(exc, "details", None),
        )
        if value is not None
    )

    for candidate in candidates:
        if isinstance(candidate, dict):
            return candidate
        if not isinstance(candidate, str):
            continue
        for parser in (json.loads, ast.literal_eval):
            try:
                parsed = parser(candidate)
            except Exception:
                continue
            if isinstance(parsed, dict):
                return parsed

    return None


def call_json_rpc(function_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Call a Supabase RPC that returns a JSON/JSONB object.

    Some postgrest/supabase-py versions raise a client-side validation exception
    when an RPC returns a JSON object instead of a row list. The database
    operation has already succeeded in that case, so recover the payload and let
    the business layer handle success/error semantics normally.
    """
    try:
        response = supabase.rpc(function_name, params).execute()
        return normalize_rpc_payload(getattr(response, "data", None))
    except Exception as exc:
        payload = _exception_payload(exc)
        if isinstance(payload, dict):
            if "success" in payload:
                return normalize_rpc_payload(payload)
            message = payload.get("message") or payload.get("details") or payload.get("hint")
            if message:
                return {"success": False, "message": str(message), "data": None}
        raise
