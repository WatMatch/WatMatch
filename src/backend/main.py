import os
from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

# Import all module routers
from src.auth.controller import router as auth_router
from src.users.controller import router as users_router
from src.courses.controller import router as courses_router
from src.capstones.controller import router as capstones_router
from src.teams.controller import router as teams_router
from src.approvals.controller import router as approvals_router
from src.interests.controller import router as interests_router
from src.feedback.controller import router as feedback_router
from src.invites.controller import router as invites_router
from src.student_profile.controller import router as student_profile_router
from src.test.controller import router as test_router


# Initialize FastAPI app
app = FastAPI(title="WatMatch Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:3000"] for stricter policy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all module routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(courses_router, prefix="/api/v1")
app.include_router(capstones_router, prefix="/api/v1")
app.include_router(teams_router, prefix="/api/v1")
app.include_router(approvals_router, prefix="/api/v1")
app.include_router(interests_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")
app.include_router(invites_router, prefix="/api/v1")
app.include_router(student_profile_router, prefix="/api/v1")
app.include_router(test_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "WatMatch Server is running", "status": "healthy"}


@app.get("/health")
async def health_check():
    """Detailed health check with module status"""
    return {
        "message": "WatMatch Server is running",
        "status": "healthy",
        "modules": [
            "auth", "users", "courses", "capstones",
            "teams", "approvals", "interests", "test"
        ]
    }

# Legacy endpoint - now redirects to modular structure


@app.get("/get/{id}")
async def get_by_id_legacy(id: int):
    """Legacy endpoint - redirects to test module"""
    return {"message": f"This endpoint has moved to /api/v1/test/{id}", "redirect": f"/api/v1/test/{id}"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
