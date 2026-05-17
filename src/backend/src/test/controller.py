from fastapi import APIRouter, HTTPException
from .test_bl import TestBusinessLogic
from typing import Dict, Any

router = APIRouter(prefix="/test", tags=["test"])
test_business = TestBusinessLogic()


@router.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Test module is running", "status": "healthy"}


@router.get("/{test_id}")
async def get_by_id(test_id: int) -> Dict[str, Any]:
    """Get test data by ID"""
    try:
        result = test_business.get_test_by_id(test_id)
        
        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            else:
                raise HTTPException(status_code=400, detail=result["message"])
        
        return {
            "success": True, 
            "data": result["data"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        return {
            "success": False, 
            "error_type": type(e).__name__, 
            "error_message": str(e)
        }