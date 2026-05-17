from fastapi import APIRouter

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.get("/")
async def get_approvals():
    """Approvals module placeholder"""
    return {"message": "Approvals module - Coming soon", "status": "placeholder"}