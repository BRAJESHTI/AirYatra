from fastapi import APIRouter, HTTPException, Depends
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/settlements", tags=["Admin - Settlements"])

@router.post("/create")
async def create_settlement(data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Create settlement for operator"""
    db = get_database()
    
    operator_id = data.get("operator_id")
    booking_ids = data.get("booking_ids", [])
    
    if not operator_id or not booking_ids:
        raise HTTPException(status_code=400, detail="operator_id and booking_ids required")
    
    # Get bookings and calculate totals
    bookings = await db.bookings.find(
        {"id": {"$in": booking_ids}, "operator_id": operator_id, "status": "completed"},
        {"_id": 0}
    ).to_list(100)
    
    if len(bookings) != len(booking_ids):
        raise HTTPException(status_code=400, detail="Some bookings not found or not completed")
    
    total_booking_amount = sum([b.get("total_amount", 0) for b in bookings])
    total_commission = sum([b.get("commission_amount", 0) for b in bookings])
    payout_amount = total_booking_amount - total_commission
    
    settlement_id = str(uuid.uuid4())
    settlement_number = f"SET{datetime.utcnow().strftime('%Y%m%d')}{settlement_id[:6].upper()}"
    
    settlement = {
        "id": settlement_id,
        "settlement_number": settlement_number,
        "operator_id": operator_id,
        "booking_ids": booking_ids,
        "total_booking_amount": total_booking_amount,
        "commission_amount": total_commission,
        "payout_amount": payout_amount,
        "status": "pending",
        "created_by": user["id"],
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.settlements.insert_one(settlement.copy())
    
    return {"message": "Settlement created", "settlement": settlement}

@router.get("/")
async def get_settlements(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])), status: str = None):
    """Get all settlements"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    settlements = await db.settlements.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Enrich with operator details
    for settlement in settlements:
        operator = await db.operators.find_one({"id": settlement["operator_id"]}, {"_id": 0})
        if operator:
            settlement["operator_name"] = operator.get("company_name")
            settlement["operator_email"] = operator.get("contact_email")
    
    return {"settlements": settlements}

@router.post("/{settlement_id}/approve")
async def approve_settlement(settlement_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Approve settlement for payout"""
    db = get_database()
    
    settlement = await db.settlements.find_one({"id": settlement_id}, {"_id": 0})
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    notes = data.get("notes", "")
    
    await db.settlements.update_one(
        {"id": settlement_id},
        {"$set": {
            "status": "approved",
            "approved_by": user["id"],
            "approved_at": datetime.utcnow().isoformat(),
            "approval_notes": notes
        }}
    )
    
    # Log action
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "settlement_approved",
        "entity_type": "settlement",
        "entity_id": settlement_id,
        "changes": {"status": "approved", "amount": settlement["payout_amount"]},
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": "Settlement approved"}

@router.post("/{settlement_id}/mark-paid")
async def mark_settlement_paid(settlement_id: str, data: dict, user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Mark settlement as paid"""
    db = get_database()
    
    settlement = await db.settlements.find_one({"id": settlement_id}, {"_id": 0})
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    if settlement["status"] != "approved":
        raise HTTPException(status_code=400, detail="Settlement must be approved before marking as paid")
    
    payment_reference = data.get("payment_reference", "")
    payment_method = data.get("payment_method", "bank_transfer")
    
    await db.settlements.update_one(
        {"id": settlement_id},
        {"$set": {
            "status": "paid",
            "paid_by": user["id"],
            "paid_at": datetime.utcnow().isoformat(),
            "payment_reference": payment_reference,
            "payment_method": payment_method
        }}
    )
    
    # Log action
    audit_log = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "settlement_paid",
        "entity_type": "settlement",
        "entity_id": settlement_id,
        "changes": {
            "status": "paid",
            "payment_reference": payment_reference,
            "amount": settlement["payout_amount"]
        },
        "created_at": datetime.utcnow().isoformat()
    }
    await db.audit_logs.insert_one(audit_log.copy())
    
    return {"message": "Settlement marked as paid"}