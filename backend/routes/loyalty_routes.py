from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/loyalty", tags=["VIP & Loyalty Program"])

# Tier Configuration
DEFAULT_TIERS = [
    {
        "id": "bronze",
        "name": "Bronze",
        "name_hi": "ब्रॉन्ज़",
        "min_points": 0,
        "benefits": ["Basic support", "Standard booking"],
        "discount_percent": 0,
        "priority_booking": False,
        "free_cancellation": False,
        "lounge_access": False,
        "dedicated_manager": False
    },
    {
        "id": "silver",
        "name": "Silver",
        "name_hi": "सिल्वर",
        "min_points": 5000,
        "benefits": ["Priority support", "5% discount", "Free date change"],
        "discount_percent": 5,
        "priority_booking": False,
        "free_cancellation": False,
        "lounge_access": False,
        "dedicated_manager": False
    },
    {
        "id": "gold",
        "name": "Gold",
        "name_hi": "गोल्ड",
        "min_points": 15000,
        "benefits": ["Priority booking", "10% discount", "Free cancellation", "Lounge access"],
        "discount_percent": 10,
        "priority_booking": True,
        "free_cancellation": True,
        "lounge_access": True,
        "dedicated_manager": False
    },
    {
        "id": "platinum",
        "name": "Platinum",
        "name_hi": "प्लेटिनम",
        "min_points": 50000,
        "benefits": ["Dedicated manager", "15% discount", "Priority everything", "Exclusive offers"],
        "discount_percent": 15,
        "priority_booking": True,
        "free_cancellation": True,
        "lounge_access": True,
        "dedicated_manager": True
    }
]

# Models
class CorporateAccountCreate(BaseModel):
    company_name: str
    gstin: Optional[str] = None
    contact_name: str
    contact_email: str
    contact_phone: str
    address: Optional[str] = None
    credit_limit: float = 0
    payment_terms_days: int = 30
    discount_percent: float = 0

class PointsAdjust(BaseModel):
    user_id: str
    points: int
    reason: str
    type: str = "adjustment"  # adjustment, bonus, redemption, expiry

# Helper Functions
def get_tier_for_points(points: int, tiers: list) -> dict:
    """Get tier based on points"""
    current_tier = tiers[0]
    for tier in tiers:
        if points >= tier["min_points"]:
            current_tier = tier
    return current_tier

# Customer Endpoints
@router.get("/my-status")
async def get_my_loyalty_status(current_user: dict = Depends(get_current_user)):
    """Get current user's loyalty status"""
    db = get_database()
    
    # Get or create loyalty profile
    profile = await db.loyalty_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    if not profile:
        profile = {
            "user_id": current_user["id"],
            "total_points": 0,
            "available_points": 0,
            "lifetime_points": 0,
            "tier": "bronze",
            "total_bookings": 0,
            "total_spent": 0,
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        await db.loyalty_profiles.insert_one(profile)
        profile.pop("_id", None)
    
    # Get tier config
    tiers_config = await db.settings.find_one({"type": "loyalty_tiers"}) or {"tiers": DEFAULT_TIERS}
    tiers = tiers_config.get("tiers", DEFAULT_TIERS)
    
    current_tier = get_tier_for_points(profile["lifetime_points"], tiers)
    next_tier = None
    points_to_next = 0
    
    for i, tier in enumerate(tiers):
        if tier["id"] == current_tier["id"] and i < len(tiers) - 1:
            next_tier = tiers[i + 1]
            points_to_next = next_tier["min_points"] - profile["lifetime_points"]
            break
    
    return {
        "profile": profile,
        "current_tier": current_tier,
        "next_tier": next_tier,
        "points_to_next_tier": max(0, points_to_next),
        "progress_percent": min(100, (profile["lifetime_points"] / (next_tier["min_points"] if next_tier else 1)) * 100) if next_tier else 100
    }

@router.get("/my-history")
async def get_my_points_history(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get points transaction history"""
    db = get_database()
    
    history = await db.points_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"history": history}

@router.post("/redeem")
async def redeem_points(
    points: int = Query(..., gt=0),
    current_user: dict = Depends(get_current_user)
):
    """Redeem points for discount (1 point = ₹1)"""
    db = get_database()
    
    profile = await db.loyalty_profiles.find_one({"user_id": current_user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Loyalty profile not found")
    
    if profile["available_points"] < points:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Create redemption code
    redemption_code = f"REDEEM{str(uuid4())[:8].upper()}"
    
    redemption = {
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "code": redemption_code,
        "points_used": points,
        "discount_value": points,  # 1 point = ₹1
        "status": "active",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.point_redemptions.insert_one(redemption)
    
    # Deduct points
    await db.loyalty_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$inc": {"available_points": -points}}
    )
    
    # Log transaction
    await db.points_history.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "type": "redemption",
        "points": -points,
        "description": f"Redeemed for discount code {redemption_code}",
        "reference_id": redemption["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Points redeemed successfully",
        "code": redemption_code,
        "discount_value": points,
        "valid_until": redemption["expires_at"]
    }

# Admin Endpoints
@router.get("/admin/dashboard")
async def get_loyalty_dashboard(current_user: dict = Depends(get_current_user)):
    """Get loyalty program dashboard"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Get tier distribution
    tiers_config = await db.settings.find_one({"type": "loyalty_tiers"}) or {"tiers": DEFAULT_TIERS}
    tiers = tiers_config.get("tiers", DEFAULT_TIERS)
    
    tier_counts = {}
    for tier in tiers:
        count = await db.loyalty_profiles.count_documents({"tier": tier["id"]})
        tier_counts[tier["id"]] = count
    
    # Total stats
    total_members = await db.loyalty_profiles.count_documents({})
    
    pipeline = [
        {"$group": {
            "_id": None,
            "total_points_issued": {"$sum": "$lifetime_points"},
            "total_available": {"$sum": "$available_points"}
        }}
    ]
    result = await db.loyalty_profiles.aggregate(pipeline).to_list(1)
    points_stats = result[0] if result else {"total_points_issued": 0, "total_available": 0}
    
    # Corporate accounts
    corporate_count = await db.corporate_accounts.count_documents({"status": "active"})
    
    return {
        "total_members": total_members,
        "tier_distribution": tier_counts,
        "total_points_issued": points_stats.get("total_points_issued", 0),
        "total_points_available": points_stats.get("total_available", 0),
        "points_redeemed": points_stats.get("total_points_issued", 0) - points_stats.get("total_available", 0),
        "corporate_accounts": corporate_count,
        "tiers": tiers
    }

@router.get("/admin/members")
async def get_loyalty_members(
    tier: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all loyalty members"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if tier:
        query["tier"] = tier
    
    profiles = await db.loyalty_profiles.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user details
    for profile in profiles:
        user = await db.users.find_one({"id": profile["user_id"]}, {"_id": 0, "full_name": 1, "email": 1, "phone": 1})
        if user:
            profile["user_name"] = user.get("full_name")
            profile["user_email"] = user.get("email")
            profile["user_phone"] = user.get("phone")
    
    total = await db.loyalty_profiles.count_documents(query)
    
    return {"members": profiles, "total": total}

@router.post("/admin/points/adjust")
async def adjust_points(adjustment: PointsAdjust, current_user: dict = Depends(get_current_user)):
    """Manually adjust user points"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    profile = await db.loyalty_profiles.find_one({"user_id": adjustment.user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update points
    update = {
        "$inc": {
            "available_points": adjustment.points,
            "total_points": max(0, adjustment.points)
        }
    }
    if adjustment.points > 0:
        update["$inc"]["lifetime_points"] = adjustment.points
    
    await db.loyalty_profiles.update_one({"user_id": adjustment.user_id}, update)
    
    # Log transaction
    await db.points_history.insert_one({
        "id": str(uuid4()),
        "user_id": adjustment.user_id,
        "type": adjustment.type,
        "points": adjustment.points,
        "description": adjustment.reason,
        "adjusted_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": f"Points adjusted by {adjustment.points}"}

# Corporate Accounts
@router.post("/corporate/create")
async def create_corporate_account(account: CorporateAccountCreate, current_user: dict = Depends(get_current_user)):
    """Create corporate account"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    account_data = {
        "id": str(uuid4()),
        "account_number": f"CORP{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:4].upper()}",
        **account.dict(),
        "status": "active",
        "credit_used": 0,
        "total_bookings": 0,
        "total_spent": 0,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.corporate_accounts.insert_one(account_data)
    account_data.pop("_id", None)
    
    return {"message": "Corporate account created", "account": account_data}

@router.get("/corporate/list")
async def get_corporate_accounts(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all corporate accounts"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    accounts = await db.corporate_accounts.find(query, {"_id": 0}).to_list(100)
    return {"accounts": accounts}

@router.get("/tiers/config")
async def get_tiers_config(current_user: dict = Depends(get_current_user)):
    """Get tier configuration"""
    db = get_database()
    config = await db.settings.find_one({"type": "loyalty_tiers"}, {"_id": 0})
    return config or {"type": "loyalty_tiers", "tiers": DEFAULT_TIERS}

@router.post("/tiers/config")
async def update_tiers_config(tiers: List[dict], current_user: dict = Depends(get_current_user)):
    """Update tier configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    await db.settings.update_one(
        {"type": "loyalty_tiers"},
        {"$set": {"type": "loyalty_tiers", "tiers": tiers, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Tier configuration updated"}
