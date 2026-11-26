import os
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from src.config.runtime_safety import read_only_mode
from src.config.readiness import service_readiness

from fastapi.middleware.cors import CORSMiddleware

# Import all module routers
from src.auth.controller import router as auth_router
from src.users.controller import router as users_router
from src.courses.controller import router as courses_router
from src.departments.controller import router as departments_router
from src.skills.controller import router as skills_router
from src.capstones.controller import router as capstones_router
from src.capstones.milestone_feedback import router as milestone_feedback_router
from src.teams.controller import router as teams_router
from src.approvals.controller import router as approvals_router
from src.interests.controller import router as interests_router
from src.invites.controller import router as invites_router
from src.student_profile.controller import router as student_profile_router
from src.partners.controller import router as partners_router
from src.marketplace.controller import router as marketplace_router


# Initialize FastAPI app
app = FastAPI(title="WatMatch Server", version="1.0.0")
read_only_mode()  # Reject invalid settings before serving requests.
logger = logging.getLogger(__name__)


@app.middleware("http")
async def preview_safety(request: Request, call_next):
    retired_auth = {
        "/api/v1/auth/login", "/api/v1/auth/refresh",
        "/api/v1/auth/logout", "/api/v1/auth/logout-all",
    }
    if (read_only_mode() and request.url.path.startswith("/api/v1/")
            and request.method not in {"GET", "HEAD", "OPTIONS"}
            and request.url.path.rstrip("/") not in retired_auth):
        return JSONResponse(status_code=403, content={
            "detail": "This private preview is read-only. Changes are disabled."
        })
    try:
        response = await call_next(request)
    except Exception as exc:
        # Do not expose upstream response bodies, credentials or user data.
        logger.error("Request failed: %s", type(exc).__name__)
        return JSONResponse(status_code=503, content={"detail": "WatMatch services are unavailable. Try again later."})
    if response.status_code >= 500 and request.url.path != "/api/readiness":
        return JSONResponse(status_code=503, content={"detail": "WatMatch services are unavailable. Try again later."})
    # Existing business layers sometimes classify upstream database exceptions
    # as 400/404. Do not publish those exception strings to browser clients.
    if (400 <= response.status_code < 500 and request.url.path.startswith("/api/v1/")
            and not request.url.path.startswith("/api/v1/auth/")):
        messages = {
            400: "The request could not be completed.",
            401: "Sign in to continue.",
            403: "Access is not permitted.",
            404: "The requested item was not found.",
            409: "The request conflicts with the current state.",
            422: "Request validation failed. Check the submitted fields.",
        }
        headers = {"WWW-Authenticate": "Bearer"} if response.status_code == 401 else None
        return JSONResponse(status_code=response.status_code, headers=headers,
                            content={"detail": messages.get(response.status_code, "The request could not be completed.")})
    return response

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-WatMatch-Workspace-Changed"],
)

# Include all module routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(courses_router, prefix="/api/v1")
app.include_router(departments_router, prefix="/api/v1")
app.include_router(skills_router, prefix="/api/v1")
app.include_router(capstones_router, prefix="/api/v1")
app.include_router(milestone_feedback_router, prefix="/api/v1")
app.include_router(teams_router, prefix="/api/v1")
app.include_router(approvals_router, prefix="/api/v1")
app.include_router(interests_router, prefix="/api/v1")
app.include_router(invites_router, prefix="/api/v1")
app.include_router(student_profile_router, prefix="/api/v1")
app.include_router(partners_router, prefix="/api/v1")
app.include_router(marketplace_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "WatMatch Server is running", "status": "healthy"}


@app.get("/api/health", include_in_schema=False)
@app.get("/health")
async def health_check():
    """Detailed health check with module status"""
    return {
        "message": "WatMatch Server is running",
        "status": "healthy",
        "modules": [
            "auth", "users", "courses", "capstones",
            "departments", "skills", "teams", "approvals", "interests", "partners",
            "marketplace",
        ]
    }


@app.get("/api/status", include_in_schema=False)
async def preview_status():
    return {"read_only": read_only_mode(), "authentication": "clerk"}


@app.get("/api/readiness", include_in_schema=False)
async def readiness():
    result = await run_in_threadpool(service_readiness)
    return JSONResponse(status_code=200 if result["ready"] else 503, content=result)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
