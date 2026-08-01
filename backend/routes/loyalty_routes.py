from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user
from models import TIER_BENEFITS as MEMBERSHIP_TIER_BENEFITS

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

# Tier-based Earning Multipliers (loyalty tiers)
LOYALTY_TIER_MULTIPLIERS = {"bronze": 1.0, "silver": 1.25, "gold": 1.5, "platinum": 2.0}
TIER_ORDER = ["bronze", "silver", "gold", "platinum"]
EARN_RATE = 100  # 1 point per ₹100 spent

# Default Rewards Catalog
DEFAULT_REWARDS = [
    {"id": "voucher_500", "name": "₹500 Flight Voucher", "name_hi": "₹500 उड़ान वाउचर", "description": "₹500 off on your next flight booking", "points_cost": 500, "value": 500, "category": "voucher", "icon": "🎫", "min_tier": "bronze", "validity_days": 90, "active": True},
    {"id": "priority_upgrade", "name": "Priority Booking Upgrade", "name_hi": "प्राथमिकता बुकिंग अपग्रेड", "description": "Jump the queue on your next booking", "points_cost": 750, "value": 0, "category": "upgrade", "icon": "⚡", "min_tier": "bronze", "validity_days": 60, "active": True},
    {"id": "lounge_pass", "name": "VIP Lounge Pass", "name_hi": "वीआईपी लाउंज पास", "description": "One-time VIP lounge access at partner helipads", "points_cost": 1000, "value": 0, "category": "experience", "icon": "🛋️", "min_tier": "bronze", "validity_days": 90, "active": True},
    {"id": "voucher_2000", "name": "₹2,000 Flight Voucher", "name_hi": "₹2,000 उड़ान वाउचर", "description": "₹2,000 off on your next flight booking", "points_cost": 1800, "value": 2000, "category": "voucher", "icon": "🎟️", "min_tier": "bronze", "validity_days": 90, "active": True},
    {"id": "voucher_5000", "name": "₹5,000 Flight Voucher", "name_hi": "₹5,000 उड़ान वाउचर", "description": "₹5,000 off on your next flight booking", "points_cost": 4250, "value": 5000, "category": "voucher", "icon": "🏆", "min_tier": "silver", "validity_days": 90, "active": True},
    {"id": "membership_voucher", "name": "₹10,000 off BLACK Membership", "name_hi": "BLACK सदस्यता पर ₹10,000 छूट", "description": "Discount voucher for AirYatra BLACK membership purchase", "points_cost": 7500, "value": 10000, "category": "membership", "icon": "👑", "min_tier": "silver", "validity_days": 120, "active": True},
    {"id": "helicopter_joyride", "name": "15-min Helicopter Joy Ride", "name_hi": "15 मिनट हेलीकॉप्टर जॉय राइड", "description": "Complimentary 15-minute scenic helicopter ride", "points_cost": 25000, "value": 15000, "category": "experience", "icon": "🚁", "min_tier": "gold", "validity_days": 180, "active": True},
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

async def get_effective_multiplier(db, user_id: str, lifetime_points: Optional[int] = None) -> dict:
    """Effective earning multiplier = max(loyalty tier multiplier, active membership multiplier)"""
    if lifetime_points is None:
        profile = await db.loyalty_profiles.find_one({"user_id": user_id}) or {}
        lifetime_points = profile.get("lifetime_points", 0)
    tiers_config = await db.settings.find_one({"type": "loyalty_tiers"}) or {"tiers": DEFAULT_TIERS}
    tier = get_tier_for_points(lifetime_points, tiers_config.get("tiers", DEFAULT_TIERS))
    tier_mult = LOYALTY_TIER_MULTIPLIERS.get(tier["id"], 1.0)

    membership = await db.memberships.find_one({"user_id": user_id, "status": "active"})
    mem_mult, mem_tier = 1.0, None
    if membership:
        benefits = MEMBERSHIP_TIER_BENEFITS.get(membership.get("tier"))
        if benefits:
            mem_mult = benefits.get("loyalty_multiplier", 1.0)
            mem_tier = benefits.get("name")

    return {
        "tier_id": tier["id"],
        "tier_multiplier": tier_mult,
        "membership_tier": mem_tier,
        "membership_multiplier": mem_mult,
        "effective_multiplier": max(tier_mult, mem_mult),
    }

async def award_booking_points(db, user_id: str, booking_id: str, amount: float):
    """Award loyalty points for a completed booking (idempotent per booking)"""
    existing = await db.points_history.find_one({"reference_id": booking_id, "type": "earn"})
    if existing:
        return None
    base_points = int(amount // EARN_RATE)
    if base_points <= 0:
        return None

    profile = await db.loyalty_profiles.find_one({"user_id": user_id})
    if not profile:
        profile = {
            "user_id": user_id,
            "total_points": 0,
            "available_points": 0,
            "lifetime_points": 0,
            "tier": "bronze",
            "total_bookings": 0,
            "total_spent": 0,
            "joined_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.loyalty_profiles.insert_one(dict(profile))

    mult = await get_effective_multiplier(db, user_id, profile.get("lifetime_points", 0))
    points = int(round(base_points * mult["effective_multiplier"]))

    new_lifetime = profile.get("lifetime_points", 0) + points
    tiers_config = await db.settings.find_one({"type": "loyalty_tiers"}) or {"tiers": DEFAULT_TIERS}
    new_tier = get_tier_for_points(new_lifetime, tiers_config.get("tiers", DEFAULT_TIERS))

    await db.loyalty_profiles.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "available_points": points,
                "lifetime_points": points,
                "total_points": points,
                "total_bookings": 1,
                "total_spent": amount,
            },
            "$set": {"tier": new_tier["id"]},
        },
    )

    source = "membership" if (mult["membership_tier"] and mult["membership_multiplier"] >= mult["tier_multiplier"]) else "tier"
    await db.points_history.insert_one({
        "id": str(uuid4()),
        "user_id": user_id,
        "type": "earn",
        "points": points,
        "base_points": base_points,
        "multiplier": mult["effective_multiplier"],
        "multiplier_source": source,
        "description": f"Earned on flight (₹{int(amount):,} × {mult['effective_multiplier']}x {source} multiplier)",
        "reference_id": booking_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "points_earned": points,
        "base_points": base_points,
        "multiplier": mult["effective_multiplier"],
        "multiplier_source": source,
        "new_tier": new_tier["id"],
    }

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
    
    earning = await get_effective_multiplier(db, current_user["id"], profile["lifetime_points"])
    
    return {
        "profile": profile,
        "current_tier": current_tier,
        "next_tier": next_tier,
        "points_to_next_tier": max(0, points_to_next),
        "progress_percent": min(100, (profile["lifetime_points"] / (next_tier["min_points"] if next_tier else 1)) * 100) if next_tier else 100,
        "earning": {
            "earn_rate": f"1 point per ₹{EARN_RATE}",
            "tier_multipliers": LOYALTY_TIER_MULTIPLIERS,
            **earning,
        },
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

# ============ REWARDS CATALOG & TIER-BASED REDEMPTION ============

@router.get("/rewards")
async def get_rewards_catalog(current_user: dict = Depends(get_current_user)):
    """Get rewards catalog with redeemability for current user"""
    db = get_database()
    
    if await db.rewards_catalog.count_documents({}) == 0:
        await db.rewards_catalog.insert_many([dict(r) for r in DEFAULT_REWARDS])
    
    rewards = await db.rewards_catalog.find({"active": True}, {"_id": 0}).to_list(100)
    
    profile = await db.loyalty_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0}) or {"available_points": 0, "lifetime_points": 0}
    tiers_config = await db.settings.find_one({"type": "loyalty_tiers"}) or {"tiers": DEFAULT_TIERS}
    user_tier = get_tier_for_points(profile.get("lifetime_points", 0), tiers_config.get("tiers", DEFAULT_TIERS))
    user_tier_idx = TIER_ORDER.index(user_tier["id"]) if user_tier["id"] in TIER_ORDER else 0
    
    for r in rewards:
        min_tier = r.get("min_tier", "bronze")
        tier_ok = user_tier_idx >= (TIER_ORDER.index(min_tier) if min_tier in TIER_ORDER else 0)
        r["tier_locked"] = not tier_ok
        r["can_redeem"] = tier_ok and profile.get("available_points", 0) >= r["points_cost"]
    
    rewards.sort(key=lambda r: r["points_cost"])
    return {
        "rewards": rewards,
        "available_points": profile.get("available_points", 0),
        "user_tier": user_tier["id"],
    }

@router.post("/rewards/{reward_id}/redeem")
async def redeem_reward(reward_id: str, current_user: dict = Depends(get_current_user)):
    """Redeem a specific reward from the catalog"""
    db = get_database()
    
    reward = await db.rewards_catalog.find_one({"id": reward_id, "active": True}, {"_id": 0})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    profile = await db.loyalty_profiles.find_one({"user_id": current_user["id"]})
    if not profile:
        raise HTTPException(status_code=400, detail="No loyalty profile. Complete a flight to start earning points!")
    
    tiers_config = await db.settings.find_one({"type": "loyalty_tiers"}) or {"tiers": DEFAULT_TIERS}
    user_tier = get_tier_for_points(profile.get("lifetime_points", 0), tiers_config.get("tiers", DEFAULT_TIERS))
    min_tier = reward.get("min_tier", "bronze")
    if TIER_ORDER.index(user_tier["id"]) < TIER_ORDER.index(min_tier):
        raise HTTPException(status_code=403, detail=f"This reward requires {min_tier.title()} tier or above")
    
    if profile.get("available_points", 0) < reward["points_cost"]:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Need {reward['points_cost']}, you have {profile.get('available_points', 0)}")
    
    voucher_code = f"RWD-{str(uuid4())[:8].upper()}"
    redemption = {
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "reward_id": reward_id,
        "reward_name": reward["name"],
        "reward_icon": reward.get("icon", "🎁"),
        "category": reward.get("category", "voucher"),
        "points_used": reward["points_cost"],
        "value": reward.get("value", 0),
        "code": voucher_code,
        "status": "active",
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=reward.get("validity_days", 90))).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reward_redemptions.insert_one(dict(redemption))
    
    await db.loyalty_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$inc": {"available_points": -reward["points_cost"]}}
    )
    
    await db.points_history.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "type": "redemption",
        "points": -reward["points_cost"],
        "description": f"Redeemed: {reward['name']} ({voucher_code})",
        "reference_id": redemption["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"message": f"{reward['name']} redeemed successfully!", "voucher": redemption}

@router.get("/my-redemptions")
async def get_my_redemptions(current_user: dict = Depends(get_current_user)):
    """Get user's reward redemption vouchers"""
    db = get_database()
    vouchers = await db.reward_redemptions.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    now = datetime.now(timezone.utc).isoformat()
    for v in vouchers:
        if v.get("status") == "active" and v.get("expires_at", "9999") < now:
            v["status"] = "expired"
    
    return {"redemptions": vouchers}

@router.post("/earn/{booking_id}")
async def earn_points_for_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Award points for a completed booking (idempotent). Customer or admin."""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    is_admin = "admin" in current_user.get("roles", []) or "super_admin" in current_user.get("roles", [])
    if booking.get("customer_id") != current_user["id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Not your booking")
    
    if booking.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Points can only be earned on completed flights")
    
    amount = (
        booking.get("total_amount")
        or booking.get("final_price")
        or (booking.get("price_estimate") or {}).get("total")
        or booking.get("ai_price_suggestion")
        or 0
    )
    if not amount:
        raise HTTPException(status_code=400, detail="Booking amount not available")
    
    user_id = booking.get("customer_id") or current_user["id"]
    result = await award_booking_points(db, user_id, booking_id, float(amount))
    if not result:
        return {"message": "Points already awarded for this booking", "already_awarded": True}
    
    return {"message": f"Earned {result['points_earned']} points!", "already_awarded": False, **result}

@router.post("/admin/rewards")
async def upsert_reward(reward: dict, current_user: dict = Depends(get_current_user)):
    """Admin: create or update a reward in the catalog"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    if not reward.get("id"):
        reward["id"] = str(uuid4())
    reward.setdefault("active", True)
    reward.setdefault("min_tier", "bronze")
    reward["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.rewards_catalog.update_one({"id": reward["id"]}, {"$set": reward}, upsert=True)
    return {"message": "Reward saved", "reward_id": reward["id"]}

# ============ VOUCHER VALIDATION (Checkout Discounts) ============

async def validate_voucher_for_user(db, user_id: str, code: str):
    """Validate a monetary voucher for checkout. Returns (voucher, error)."""
    voucher = await db.reward_redemptions.find_one(
        {"code": code.strip().upper(), "user_id": user_id}, {"_id": 0}
    )
    if not voucher:
        return None, "Invalid voucher code"
    if voucher.get("status") == "used":
        return None, "Voucher already used"
    now = datetime.now(timezone.utc).isoformat()
    if voucher.get("status") == "expired" or voucher.get("expires_at", "9999") < now:
        return None, "Voucher has expired"
    if not voucher.get("value"):
        return None, "This voucher cannot be applied as a payment discount"
    return voucher, None

class VoucherValidateRequest(BaseModel):
    code: str

@router.post("/vouchers/validate")
async def validate_voucher(request: VoucherValidateRequest, current_user: dict = Depends(get_current_user)):
    """Validate a RWD voucher code for checkout discount"""
    db = get_database()
    voucher, error = await validate_voucher_for_user(db, current_user["id"], request.code)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {
        "valid": True,
        "code": voucher["code"],
        "value": voucher["value"],
        "reward_name": voucher["reward_name"],
        "reward_icon": voucher.get("reward_icon", "🎫"),
        "expires_at": voucher.get("expires_at"),
    }
