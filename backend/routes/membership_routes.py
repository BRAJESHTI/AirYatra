"""
AirYatra BLACK Membership Routes
VIP Tier System: Silver, Gold, Platinum, BLACK
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import uuid
import secrets
from database import get_database
from models import (
    MembershipCreate, MembershipUpdate, MembershipUpgrade,
    MembershipTier, MembershipStatus, TIER_BENEFITS, MemberBenefitUsage
)

router = APIRouter(prefix="/membership", tags=["Membership"])

def generate_card_number(tier: str) -> str:
    """Generate unique membership card number"""
    prefix = {
        "silver": "AY-SLV",
        "gold": "AY-GLD", 
        "platinum": "AY-PLT",
        "black": "AY-BLK"
    }
    return f"{prefix.get(tier, 'AY-MBR')}-{secrets.token_hex(4).upper()}"

def calculate_expiry(start_date: datetime) -> datetime:
    """Calculate membership expiry (1 year from start)"""
    return start_date + timedelta(days=365)

@router.get("/tiers")
async def get_membership_tiers():
    """Get all membership tier details and benefits"""
    return {
        "success": True,
        "tiers": TIER_BENEFITS
    }

@router.get("/tier/{tier}")
async def get_tier_details(tier: str):
    """Get specific tier details"""
    if tier not in TIER_BENEFITS:
        raise HTTPException(status_code=404, detail="Tier not found")
    return {
        "success": True,
        "tier": tier,
        "details": TIER_BENEFITS[tier]
    }

@router.post("/subscribe")
async def create_membership(membership: MembershipCreate):
    """Create new membership subscription"""
    db = get_database()
    
    # Check if user already has active membership
    existing = await db.memberships.find_one({
        "user_id": membership.user_id,
        "status": "active"
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="User already has an active membership. Please upgrade instead."
        )
    
    tier_details = TIER_BENEFITS.get(membership.tier.value)
    if not tier_details:
        raise HTTPException(status_code=400, detail="Invalid membership tier")
    
    now = datetime.utcnow()
    
    membership_doc = {
        "user_id": membership.user_id,
        "tier": membership.tier.value,
        "status": "active",
        "start_date": now,
        "expiry_date": calculate_expiry(now),
        "auto_renew": membership.auto_renew,
        "card_number": generate_card_number(membership.tier.value),
        "benefits": tier_details,
        "total_savings": 0,
        "bookings_count": 0,
        "loyalty_points": 0,
        "member_since": now,
        "payment_history": [{
            "amount": tier_details["annual_fee"],
            "payment_method": membership.payment_method,
            "transaction_id": f"TXN-{uuid.uuid4().hex[:12].upper()}",
            "paid_at": now,
            "type": "subscription"
        }],
        "benefit_usage": [],
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.memberships.insert_one(membership_doc)
    
    # Update user with membership info
    await db.users.update_one(
        {"_id": ObjectId(membership.user_id)},
        {
            "$set": {
                "membership_tier": membership.tier.value,
                "membership_id": str(result.inserted_id),
                "is_premium_member": True
            }
        }
    )
    
    membership_doc["id"] = str(result.inserted_id)
    if "_id" in membership_doc:
        del membership_doc["_id"]
    
    return {
        "success": True,
        "message": f"Welcome to AirYatra {tier_details['name']} Membership!",
        "membership": membership_doc
    }

@router.get("/my-membership/{user_id}")
async def get_user_membership(user_id: str):
    """Get user's current membership details"""
    db = get_database()
    
    membership = await db.memberships.find_one(
        {"user_id": user_id, "status": {"$ne": "expired"}},
        {"_id": 0}
    )
    
    if not membership:
        return {
            "success": True,
            "has_membership": False,
            "membership": None,
            "available_tiers": TIER_BENEFITS
        }
    
    # Check if membership needs expiry update
    if membership["expiry_date"] < datetime.utcnow():
        await db.memberships.update_one(
            {"user_id": user_id},
            {"$set": {"status": "expired"}}
        )
        membership["status"] = "expired"
    
    return {
        "success": True,
        "has_membership": True,
        "membership": membership
    }

@router.post("/upgrade")
async def upgrade_membership(upgrade: MembershipUpgrade, user_id: str = Query(...)):
    """Upgrade membership to higher tier"""
    db = get_database()
    
    current = await db.memberships.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    if not current:
        raise HTTPException(status_code=404, detail="No active membership found")
    
    tier_order = ["silver", "gold", "platinum", "black"]
    current_tier_idx = tier_order.index(current["tier"])
    new_tier_idx = tier_order.index(upgrade.new_tier.value)
    
    if new_tier_idx <= current_tier_idx:
        raise HTTPException(
            status_code=400, 
            detail="Can only upgrade to a higher tier"
        )
    
    new_tier_details = TIER_BENEFITS[upgrade.new_tier.value]
    current_tier_details = TIER_BENEFITS[current["tier"]]
    
    # Calculate prorated upgrade cost
    days_remaining = (current["expiry_date"] - datetime.utcnow()).days
    days_total = 365
    current_value = (current_tier_details["annual_fee"] * days_remaining) / days_total
    new_cost = new_tier_details["annual_fee"]
    upgrade_cost = new_cost - current_value
    
    now = datetime.utcnow()
    
    # Update membership
    await db.memberships.update_one(
        {"user_id": user_id, "status": "active"},
        {
            "$set": {
                "tier": upgrade.new_tier.value,
                "benefits": new_tier_details,
                "card_number": generate_card_number(upgrade.new_tier.value),
                "expiry_date": calculate_expiry(now),  # Reset expiry
                "updated_at": now
            },
            "$push": {
                "payment_history": {
                    "amount": upgrade_cost,
                    "payment_method": upgrade.payment_method,
                    "transaction_id": f"TXN-{uuid.uuid4().hex[:12].upper()}",
                    "paid_at": now,
                    "type": "upgrade",
                    "from_tier": current["tier"],
                    "to_tier": upgrade.new_tier.value
                }
            }
        }
    )
    
    # Update user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"membership_tier": upgrade.new_tier.value}}
    )
    
    return {
        "success": True,
        "message": f"Successfully upgraded to {new_tier_details['name']} tier!",
        "upgrade_cost": round(upgrade_cost, 2),
        "new_tier": upgrade.new_tier.value,
        "new_benefits": new_tier_details
    }

@router.post("/cancel/{user_id}")
async def cancel_membership(user_id: str, reason: str = ""):
    """Cancel membership (no refund, remains active until expiry)"""
    db = get_database()
    
    result = await db.memberships.update_one(
        {"user_id": user_id, "status": "active"},
        {
            "$set": {
                "auto_renew": False,
                "cancellation_reason": reason,
                "cancelled_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No active membership found")
    
    return {
        "success": True,
        "message": "Membership auto-renewal cancelled. Your benefits remain active until expiry."
    }

@router.post("/record-benefit-usage")
async def record_benefit_usage(usage: MemberBenefitUsage):
    """Record when a member uses a benefit"""
    db = get_database()
    
    await db.memberships.update_one(
        {"_id": ObjectId(usage.membership_id)},
        {
            "$push": {
                "benefit_usage": {
                    "benefit_type": usage.benefit_type,
                    "booking_id": usage.booking_id,
                    "used_at": usage.used_at,
                    "value": usage.value
                }
            },
            "$inc": {"total_savings": usage.value}
        }
    )
    
    return {"success": True, "message": "Benefit usage recorded"}

@router.get("/calculate-discount")
async def calculate_member_discount(user_id: str, booking_amount: float):
    """Calculate discount for a member on a booking"""
    db = get_database()
    
    membership = await db.memberships.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    if not membership:
        return {
            "success": True,
            "has_discount": False,
            "discount_amount": 0,
            "final_amount": booking_amount,
            "message": "No active membership"
        }
    
    tier_details = TIER_BENEFITS[membership["tier"]]
    discount_percent = tier_details["discount_percent"]
    discount_amount = (booking_amount * discount_percent) / 100
    loyalty_multiplier = tier_details["loyalty_multiplier"]
    
    return {
        "success": True,
        "has_discount": True,
        "tier": membership["tier"],
        "discount_percent": discount_percent,
        "discount_amount": round(discount_amount, 2),
        "final_amount": round(booking_amount - discount_amount, 2),
        "loyalty_points_earned": int((booking_amount / 100) * loyalty_multiplier),
        "additional_benefits": {
            "priority_booking": tier_details["priority_booking"],
            "free_cancellation": tier_details["free_cancellation"],
            "lounge_access": tier_details["lounge_access"]
        }
    }

@router.get("/leaderboard")
async def get_membership_leaderboard(limit: int = 10):
    """Get top members by bookings and savings"""
    db = get_database()
    
    pipeline = [
        {"$match": {"status": "active"}},
        {"$sort": {"total_savings": -1}},
        {"$limit": limit},
        {"$lookup": {
            "from": "users",
            "let": {"userId": {"$toObjectId": "$user_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$_id", "$$userId"]}}},
                {"$project": {"name": 1, "email": 1}}
            ],
            "as": "user"
        }},
        {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "tier": 1,
            "total_savings": 1,
            "bookings_count": 1,
            "loyalty_points": 1,
            "member_since": 1,
            "user_name": "$user.name"
        }}
    ]
    
    leaders = await db.memberships.aggregate(pipeline).to_list(length=limit)
    
    return {
        "success": True,
        "leaderboard": leaders
    }

@router.get("/statistics")
async def get_membership_statistics():
    """Get overall membership statistics (Admin)"""
    db = get_database()
    
    pipeline = [
        {"$group": {
            "_id": "$tier",
            "count": {"$sum": 1},
            "total_savings": {"$sum": "$total_savings"},
            "total_bookings": {"$sum": "$bookings_count"}
        }}
    ]
    
    stats_by_tier = await db.memberships.aggregate(pipeline).to_list(length=10)
    
    total_members = await db.memberships.count_documents({"status": "active"})
    total_revenue = sum([
        TIER_BENEFITS[s["_id"]]["annual_fee"] * s["count"] 
        for s in stats_by_tier if s["_id"] in TIER_BENEFITS
    ])
    
    return {
        "success": True,
        "statistics": {
            "total_active_members": total_members,
            "total_membership_revenue": total_revenue,
            "by_tier": {s["_id"]: s for s in stats_by_tier},
            "tier_distribution": {
                s["_id"]: s["count"] for s in stats_by_tier
            }
        }
    }

@router.get("/expiring-soon")
async def get_expiring_memberships(days: int = 30):
    """Get memberships expiring within specified days"""
    db = get_database()
    
    expiry_threshold = datetime.utcnow() + timedelta(days=days)
    
    expiring = await db.memberships.find(
        {
            "status": "active",
            "expiry_date": {"$lte": expiry_threshold}
        },
        {"_id": 0}
    ).to_list(length=100)
    
    return {
        "success": True,
        "count": len(expiring),
        "expiring_memberships": expiring
    }
