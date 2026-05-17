from fastapi import APIRouter

router = APIRouter(prefix="/courses", tags=["courses"])

@router.get("/")
async def get_courses():
    """Courses module placeholder"""
    return {"message": "Courses module - Coming soon", "status": "placeholder"}