"""
AirYatra Firebase Push Notification Routes
API endpoints for managing push notifications
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional, List
from pydantic import BaseModel

from services.firebase_push_service import firebase_push_service
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/push", tags=["Push Notifications"])


# ==================== MODELS ====================

class SingleNotificationRequest(BaseModel):
    token: str
    title: str
    body: str
    data: Optional[dict] = None
    image_url: Optional[str] = None
    click_action: Optional[str] = None
    notification_type: str = "general"


class MulticastNotificationRequest(BaseModel):
    tokens: List[str]
    title: str
    body: str
    data: Optional[dict] = None
    notification_type: str = "general"


class TopicNotificationRequest(BaseModel):
    topic: str
    title: str
    body: str
    data: Optional[dict] = None


class BookingNotificationRequest(BaseModel):
    token: str
    booking_id: str
    route: str
    departure_time: str
    pnr: Optional[str] = None


class PaymentNotificationRequest(BaseModel):
    token: str
    amount: float
    booking_id: str
    transaction_id: str


class RefundNotificationRequest(BaseModel):
    token: str
    refund_amount: float
    booking_id: str
    refund_id: str


# ==================== ROUTES ====================

@router.get("/status")
async def get_push_service_status():
    """Get Firebase Push notification service status"""
    return firebase_push_service.get_status()


@router.post("/send")
async def send_single_notification(
    request: SingleNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send push notification to a single device"""
    result = await firebase_push_service.send_notification(
        token=request.token,
        title=request.title,
        body=request.body,
        data=request.data,
        image_url=request.image_url,
        click_action=request.click_action,
        notification_type=request.notification_type
    )
    return result


@router.post("/send-multiple")
async def send_multicast_notification(
    request: MulticastNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send push notification to multiple devices"""
    if len(request.tokens) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 tokens per request")
    
    result = await firebase_push_service.send_to_multiple(
        tokens=request.tokens,
        title=request.title,
        body=request.body,
        data=request.data,
        notification_type=request.notification_type
    )
    return result


@router.post("/send-topic")
async def send_topic_notification(
    request: TopicNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send push notification to a topic"""
    result = await firebase_push_service.send_to_topic(
        topic=request.topic,
        title=request.title,
        body=request.body,
        data=request.data
    )
    return result


# ==================== TEMPLATE ROUTES ====================

@router.post("/booking-confirmed")
async def send_booking_confirmed_notification(
    request: BookingNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send booking confirmation push notification"""
    result = await firebase_push_service.send_booking_confirmed(
        token=request.token,
        booking_id=request.booking_id,
        route=request.route,
        departure_time=request.departure_time,
        pnr=request.pnr
    )
    return result


@router.post("/payment-success")
async def send_payment_success_notification(
    request: PaymentNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send payment success push notification"""
    result = await firebase_push_service.send_payment_success(
        token=request.token,
        amount=request.amount,
        booking_id=request.booking_id,
        transaction_id=request.transaction_id
    )
    return result


@router.post("/refund-processed")
async def send_refund_processed_notification(
    request: RefundNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send refund processed push notification"""
    result = await firebase_push_service.send_refund_processed(
        token=request.token,
        refund_amount=request.refund_amount,
        booking_id=request.booking_id,
        refund_id=request.refund_id
    )
    return result


@router.post("/flight-reminder")
async def send_flight_reminder_notification(
    token: str = Body(...),
    booking_id: str = Body(...),
    route: str = Body(...),
    hours_before: int = Body(24),
    current_user: dict = Depends(get_current_user)
):
    """Send flight reminder push notification"""
    result = await firebase_push_service.send_flight_reminder(
        token=token,
        booking_id=booking_id,
        route=route,
        hours_before=hours_before
    )
    return result


@router.post("/promo-offer")
async def send_promo_offer_notification(
    token: str = Body(...),
    title: str = Body(...),
    message: str = Body(...),
    promo_code: Optional[str] = Body(None),
    offer_id: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """Send promotional offer push notification"""
    result = await firebase_push_service.send_promo_offer(
        token=token,
        title=title,
        message=message,
        promo_code=promo_code,
        offer_id=offer_id
    )
    return result


@router.post("/sos-alert")
async def send_sos_alert_notification(
    token: str = Body(...),
    alert_type: str = Body(...),
    message: str = Body(...),
    flight_id: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """Send SOS/Emergency alert push notification"""
    result = await firebase_push_service.send_sos_alert(
        token=token,
        alert_type=alert_type,
        message=message,
        flight_id=flight_id
    )
    return result


# ==================== MOCK MODE UTILITIES ====================

@router.get("/mock-history")
async def get_mock_notification_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get history of mock notifications (for testing)"""
    status = firebase_push_service.get_status()
    
    if status["mode"] != "MOCK":
        return {
            "message": "Mock history only available in MOCK mode",
            "current_mode": status["mode"]
        }
    
    return {
        "mode": "MOCK",
        "total_sent": len(firebase_push_service._sent_notifications),
        "history": firebase_push_service.get_mock_history(limit)
    }


@router.delete("/mock-history")
async def clear_mock_notification_history(
    current_user: dict = Depends(get_current_user)
):
    """Clear mock notification history"""
    firebase_push_service.clear_mock_history()
    return {"success": True, "message": "Mock history cleared"}
