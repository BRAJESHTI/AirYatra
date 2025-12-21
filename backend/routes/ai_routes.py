from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from ai_service import ai_service
from middleware import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Services"])

@router.post("/price-suggestion")
async def get_price_suggestion(data: dict, user: dict = Depends(get_current_user)):
    """Get AI-powered price suggestion"""
    try:
        suggestion = await ai_service.get_price_suggestion(data)
        return suggestion
    except Exception as e:
        logger.error(f"Error getting price suggestion: {e}")
        raise HTTPException(status_code=500, detail="Failed to get price suggestion")

@router.post("/verify-document")
async def verify_document(data: dict, user: dict = Depends(get_current_user)):
    """AI-powered document verification"""
    try:
        verification = await ai_service.verify_document(data)
        return verification
    except Exception as e:
        logger.error(f"Error verifying document: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify document")

@router.post("/route-recommendations")
async def get_route_recommendations(data: dict, user: dict = Depends(get_current_user)):
    """Get smart route recommendations"""
    try:
        recommendations = await ai_service.get_route_recommendations(data)
        return {"recommendations": recommendations}
    except Exception as e:
        logger.error(f"Error getting route recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to get recommendations")