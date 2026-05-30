from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from .capstones_bl import CapstonesBusinessLogic
from ..auth.dependencies import get_current_user
from typing import Dict, Any, Optional

router = APIRouter(prefix="/capstones", tags=["capstones"])
capstones_business = CapstonesBusinessLogic()


class CreateCapstoneRequest(BaseModel):
    user_id: int
    title: str
    course_id: int
    description: Optional[str] = None


class RequestChangesRequest(BaseModel):
    comments: str

@router.post("/create")
async def create_capstone(request: CreateCapstoneRequest) -> Dict[str, Any]:
    try:
        result = capstones_business.create_capstone_with_team(
            user_id=request.user_id,
            title=request.title,
            course_id=request.course_id,
            description=request.description,
        )

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            else:
                raise HTTPException(status_code=400, detail=result["message"])

        return {
            "success": True,
            "message": result["message"],
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


@router.get("/past")
async def get_past_capstones(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
):
    try:
        result = capstones_business.get_past_capstones(
            page=page,
            page_size=page_size,
            search=search,
            department=department,
            year=year,
        )
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/past/metadata")
async def get_past_capstone_metadata():
    try:
        result = capstones_business.get_past_capstone_metadata()
        if not result["success"]:
            return {
                "success": True,
                "data": {"departments": [], "years": [], "courses": []},
                "warning": result.get("message", "Past capstone metadata could not be loaded"),
            }
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/review")
async def get_capstones_for_review(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100)
) -> Dict[str, Any]:
    try:
        if (page is None) != (page_size is None):
            raise HTTPException(
                status_code=400,
                detail="Both 'page' and 'page_size' must be provided together for pagination"
            )

        result = capstones_business.get_capstones_pending_review(
            page, page_size)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_capstones(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
) -> Dict[str, Any]:
    try:
        if (page is None) != (page_size is None):
            raise HTTPException(
                status_code=400,
                detail="Both 'page' and 'page_size' must be provided together for pagination"
            )

        result = capstones_business.get_approved_capstones(page, page_size)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{capstone_id:int}")
async def get_capstone_by_id(capstone_id: int) -> Dict[str, Any]:
    """Retrieve a capstone by identifier."""
    try:
        result = capstones_business.get_capstone_by_id(capstone_id)

        if not result["success"]:
            message = result["message"]
            if "not found" in message.lower():
                raise HTTPException(status_code=404, detail=message)
            raise HTTPException(status_code=400, detail=message)

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{capstone_id}/approve")
async def approve_capstone(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        if current_user.get("role") not in {"instructor", "admin"}:
            raise HTTPException(
                status_code=403,
                detail="Only instructors or admins can approve capstones"
            )

        result = capstones_business.approve_capstone(capstone_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{capstone_id}/reject")
async def reject_capstone(
    capstone_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        if current_user.get("role") not in {"instructor", "admin"}:
            raise HTTPException(
                status_code=403,
                detail="Only instructors or admins can reject capstones"
            )

        result = capstones_business.reject_capstone(capstone_id)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{capstone_id}/request-changes")
async def request_changes(
    capstone_id: int,
    request: RequestChangesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        if current_user.get("role") not in {"instructor", "admin"}:
            raise HTTPException(
                status_code=403,
                detail="Only instructors or admins can request changes"
            )

        result = capstones_business.request_changes(capstone_id, request.comments)

        if not result["success"]:
            if "not found" in result["message"].lower():
                raise HTTPException(status_code=404, detail=result["message"])
            raise HTTPException(status_code=400, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/review")
async def get_capstones_for_review(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100)
) -> Dict[str, Any]:
    try:
        if (page is None) != (page_size is None):
            raise HTTPException(
                status_code=400,
                detail="Both 'page' and 'page_size' must be provided together for pagination"
            )

        result = capstones_business.get_capstones_pending_review(
            page, page_size)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_capstones(
    page: Optional[int] = Query(None, ge=1),
    page_size: Optional[int] = Query(None, ge=1, le=100),
) -> Dict[str, Any]:
    try:
        if (page is None) != (page_size is None):
            raise HTTPException(
                status_code=400,
                detail="Both 'page' and 'page_size' must be provided together for pagination"
            )

        result = capstones_business.get_all_capstones(page, page_size)

        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error occurred: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
