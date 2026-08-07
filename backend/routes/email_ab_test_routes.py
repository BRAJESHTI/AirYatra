"""
AirYatra Email A/B Testing Routes
API endpoints for managing email A/B tests
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone

from database import get_database
from middleware import get_current_user, require_roles
from services.email_ab_test_service import email_ab_test_service

router = APIRouter(prefix="/email-ab-tests", tags=["Email A/B Testing"])


class VariantConfig(BaseModel):
    subject: str
    preview_text: Optional[str] = ""
    template_override: Optional[Dict] = {}


class CreateABTestRequest(BaseModel):
    test_name: str
    email_type: str  # booking_confirmation, promo, newsletter, etc.
    variant_a: VariantConfig
    variant_b: VariantConfig
    split_ratio: int = 50  # Percentage for variant A
    auto_winner: bool = True
    auto_winner_metric: str = "open_rate"  # open_rate or click_rate
    auto_winner_threshold: int = 100


class SelectWinnerRequest(BaseModel):
    winner: str  # "A" or "B"
    reason: Optional[str] = "Manual selection"


@router.post("/create")
async def create_ab_test(
    request: CreateABTestRequest,
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """
    Create a new A/B test for email campaigns.
    
    Example:
    - Variant A: "Your flight is confirmed! ✈️"
    - Variant B: "Booking Confirmed - AirYatra"
    
    The system will randomly assign recipients to each variant
    and track open/click rates to determine the winner.
    """
    if request.split_ratio < 10 or request.split_ratio > 90:
        raise HTTPException(status_code=400, detail="Split ratio must be between 10 and 90")
    
    if request.auto_winner_metric not in ["open_rate", "click_rate"]:
        raise HTTPException(status_code=400, detail="auto_winner_metric must be 'open_rate' or 'click_rate'")
    
    result = await email_ab_test_service.create_ab_test(
        db=db,
        test_name=request.test_name,
        email_type=request.email_type,
        variant_a=request.variant_a.dict(),
        variant_b=request.variant_b.dict(),
        split_ratio=request.split_ratio,
        auto_winner=request.auto_winner,
        auto_winner_metric=request.auto_winner_metric,
        auto_winner_threshold=request.auto_winner_threshold,
        created_by=current_user.get("id")
    )
    
    return result


@router.get("/list")
async def list_ab_tests(
    status: Optional[str] = Query(None, description="Filter by status: active, paused, completed, winner_selected"),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """List all A/B tests"""
    tests = await email_ab_test_service.list_tests(db, status, limit)
    
    return {
        "success": True,
        "count": len(tests),
        "tests": tests
    }


@router.get("/{test_id}")
async def get_ab_test_results(
    test_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """Get detailed results for an A/B test"""
    result = await email_ab_test_service.get_test_results(db, test_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    
    return result


@router.post("/{test_id}/select-winner")
async def select_winner(
    test_id: str,
    request: SelectWinnerRequest,
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """Manually select a winner for the A/B test"""
    result = await email_ab_test_service.select_winner(
        db=db,
        test_id=test_id,
        winner=request.winner,
        reason=request.reason
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@router.post("/{test_id}/pause")
async def pause_test(
    test_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """Pause an active A/B test"""
    result = await email_ab_test_service.pause_test(db, test_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@router.post("/{test_id}/resume")
async def resume_test(
    test_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """Resume a paused A/B test"""
    result = await email_ab_test_service.resume_test(db, test_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@router.delete("/{test_id}")
async def delete_test(
    test_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """Delete an A/B test"""
    result = await email_ab_test_service.delete_test(db, test_id)
    
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    
    return result


@router.get("/{test_id}/variant")
async def get_variant_for_email(
    test_id: str,
    recipient_email: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get which variant to use for a specific recipient.
    Used internally when sending emails.
    """
    result = await email_ab_test_service.get_variant_for_recipient(
        db=db,
        test_id=test_id,
        recipient_email=recipient_email
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


# Internal endpoints for tracking (called by email tracking service)

@router.post("/internal/record-send")
async def record_send(
    test_id: str,
    variant: str,
    recipient_email: str,
    tracking_id: str,
    db = Depends(get_database)
):
    """Internal: Record email send for A/B test"""
    return await email_ab_test_service.record_send(
        db=db,
        test_id=test_id,
        variant=variant,
        recipient_email=recipient_email,
        tracking_id=tracking_id
    )


@router.post("/internal/record-open")
async def record_open(
    test_id: str,
    tracking_id: str,
    db = Depends(get_database)
):
    """Internal: Record email open for A/B test"""
    return await email_ab_test_service.record_open(
        db=db,
        test_id=test_id,
        tracking_id=tracking_id
    )


@router.post("/internal/record-click")
async def record_click(
    test_id: str,
    tracking_id: str,
    db = Depends(get_database)
):
    """Internal: Record email click for A/B test"""
    return await email_ab_test_service.record_click(
        db=db,
        test_id=test_id,
        tracking_id=tracking_id
    )
