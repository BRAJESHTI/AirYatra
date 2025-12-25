"""
Referral & Wallet System Routes
Customer referral program with wallet rewards
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel
import secrets
import string

from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole

router = APIRouter(prefix="/referral", tags=["Referral & Wallet"])


class ReferralSettings(BaseModel):
    referral_bonus_percent: float = 5.0  # 5% of booking amount as referral bonus
    referral_bonus_fixed: float = 500.0  # Fixed bonus amount (INR)
    referral_bonus_type: str = "fixed"  # "percent" or "fixed"
    first_booking_discount_percent: float = 10.0  # 10% discount on first booking
    first_booking_discount_max: float = 2000.0  # Max discount cap
    min_booking_for_referral: float = 10000.0  # Minimum booking amount to qualify
    referral_enabled: bool = True
    wallet_enabled: bool = True


class DiscountCode(BaseModel):
    code: str
    discount_type: str  # "percent" or "fixed"
    discount_value: float
    max_uses: int = 100
    min_booking_amount: float = 5000.0
    max_discount_amount: Optional[float] = None  # Cap for percentage discounts
    valid_from: str
    valid_until: str
    is_active: bool = True
    description: str = ""
    applicable_purposes: List[str] = []  # Empty means all purposes


# ============== REFERRAL CODE MANAGEMENT ==============

def generate_referral_code(length=8):
    """Generate unique referral code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.get("/my-code")
async def get_my_referral_code(
    user: dict = Depends(get_current_user)
):
    """Get or generate user's referral code"""
    db = get_database()
    
    # Check if user already has a referral code
    existing = await db.referral_codes.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if existing:
        return existing
    
    # Generate new referral code
    while True:
        code = generate_referral_code()
        # Check uniqueness
        exists = await db.referral_codes.find_one({"code": code})
        if not exists:
            break
    
    referral_data = {
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user.get("full_name", ""),
        "user_email": user.get("email", ""),
        "code": code,
        "total_referrals": 0,
        "successful_referrals": 0,
        "total_earnings": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.referral_codes.insert_one(referral_data)
    
    # Return without _id
    del referral_data["_id"] if "_id" in referral_data else None
    return referral_data


@router.get("/stats")
async def get_referral_stats(
    user: dict = Depends(get_current_user)
):
    """Get user's referral statistics"""
    db = get_database()
    
    # Get referral code
    referral = await db.referral_codes.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not referral:
        return {
            "has_referral_code": False,
            "total_referrals": 0,
            "successful_referrals": 0,
            "total_earnings": 0,
            "pending_earnings": 0
        }
    
    # Get referral history
    referrals = await db.referral_history.find(
        {"referrer_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    pending = sum(r.get("bonus_amount", 0) for r in referrals if r.get("status") == "pending")
    
    return {
        "has_referral_code": True,
        "code": referral["code"],
        "total_referrals": referral.get("total_referrals", 0),
        "successful_referrals": referral.get("successful_referrals", 0),
        "total_earnings": referral.get("total_earnings", 0),
        "pending_earnings": pending,
        "recent_referrals": referrals[:10]
    }


@router.post("/apply/{code}")
async def apply_referral_code(
    code: str,
    user: dict = Depends(get_current_user)
):
    """Apply referral code for new user"""
    db = get_database()
    
    # Check if user already used a referral
    existing = await db.users.find_one(
        {"id": user["id"]},
        {"_id": 0, "referred_by": 1, "first_booking_done": 1}
    )
    
    if existing and existing.get("referred_by"):
        raise HTTPException(status_code=400, detail="You have already used a referral code")
    
    # Find referral code
    referral = await db.referral_codes.find_one(
        {"code": code.upper()},
        {"_id": 0}
    )
    
    if not referral:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referral["user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot use your own referral code")
    
    # Update user with referrer info
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "referred_by": referral["user_id"],
            "referral_code_used": code.upper(),
            "referral_applied_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Increment total referrals count
    await db.referral_codes.update_one(
        {"code": code.upper()},
        {"$inc": {"total_referrals": 1}}
    )
    
    # Get settings for first booking discount
    settings = await db.referral_settings.find_one({"type": "referral"}, {"_id": 0})
    if not settings:
        settings = ReferralSettings().dict()
    
    return {
        "message": "Referral code applied successfully! / रेफरल कोड लागू हो गया!",
        "first_booking_discount": settings.get("first_booking_discount_percent", 10),
        "referrer_name": referral.get("user_name", "A friend")
    }


# ============== WALLET MANAGEMENT ==============

@router.get("/wallet")
async def get_wallet_balance(
    user: dict = Depends(get_current_user)
):
    """Get user's wallet balance and transactions"""
    db = get_database()
    
    # Get or create wallet
    wallet = await db.wallets.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not wallet:
        wallet = {
            "id": str(uuid4()),
            "user_id": user["id"],
            "balance": 0,
            "total_earned": 0,
            "total_used": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wallets.insert_one(wallet)
    
    # Get recent transactions
    transactions = await db.wallet_transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "balance": wallet.get("balance", 0),
        "total_earned": wallet.get("total_earned", 0),
        "total_used": wallet.get("total_used", 0),
        "transactions": transactions
    }


@router.post("/wallet/credit")
async def credit_wallet(
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Admin: Credit amount to user's wallet"""
    db = get_database()
    
    target_user_id = data.get("user_id")
    amount = float(data.get("amount", 0))
    reason = data.get("reason", "Admin credit")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Get or create wallet
    wallet = await db.wallets.find_one({"user_id": target_user_id})
    
    if not wallet:
        wallet = {
            "id": str(uuid4()),
            "user_id": target_user_id,
            "balance": 0,
            "total_earned": 0,
            "total_used": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wallets.insert_one(wallet)
    
    # Update balance
    new_balance = wallet.get("balance", 0) + amount
    await db.wallets.update_one(
        {"user_id": target_user_id},
        {
            "$set": {"balance": new_balance},
            "$inc": {"total_earned": amount}
        }
    )
    
    # Record transaction
    transaction = {
        "id": str(uuid4()),
        "user_id": target_user_id,
        "type": "credit",
        "amount": amount,
        "balance_after": new_balance,
        "reason": reason,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wallet_transactions.insert_one(transaction)
    
    return {"message": "Wallet credited", "new_balance": new_balance}


async def process_referral_bonus(booking_id: str, booking_amount: float, customer_id: str):
    """Internal function to process referral bonus after successful booking"""
    db = get_database()
    
    # Get settings
    settings = await db.referral_settings.find_one({"type": "referral"}, {"_id": 0})
    if not settings:
        settings = ReferralSettings().dict()
    
    if not settings.get("referral_enabled", True):
        return
    
    # Check minimum booking amount
    if booking_amount < settings.get("min_booking_for_referral", 10000):
        return
    
    # Get customer's referrer
    customer = await db.users.find_one(
        {"id": customer_id},
        {"_id": 0, "referred_by": 1, "first_booking_done": 1}
    )
    
    if not customer or not customer.get("referred_by"):
        return
    
    referrer_id = customer["referred_by"]
    
    # Calculate bonus
    if settings.get("referral_bonus_type") == "percent":
        bonus = booking_amount * (settings.get("referral_bonus_percent", 5) / 100)
    else:
        bonus = settings.get("referral_bonus_fixed", 500)
    
    # Get or create referrer's wallet
    wallet = await db.wallets.find_one({"user_id": referrer_id})
    if not wallet:
        wallet = {
            "id": str(uuid4()),
            "user_id": referrer_id,
            "balance": 0,
            "total_earned": 0,
            "total_used": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wallets.insert_one(wallet)
    
    # Credit bonus to wallet
    new_balance = wallet.get("balance", 0) + bonus
    await db.wallets.update_one(
        {"user_id": referrer_id},
        {
            "$set": {"balance": new_balance},
            "$inc": {"total_earned": bonus}
        }
    )
    
    # Record transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid4()),
        "user_id": referrer_id,
        "type": "referral_bonus",
        "amount": bonus,
        "balance_after": new_balance,
        "reason": f"Referral bonus for booking {booking_id}",
        "booking_id": booking_id,
        "referred_user_id": customer_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update referral code stats
    await db.referral_codes.update_one(
        {"user_id": referrer_id},
        {
            "$inc": {
                "successful_referrals": 1,
                "total_earnings": bonus
            }
        }
    )
    
    # Record in referral history
    await db.referral_history.insert_one({
        "id": str(uuid4()),
        "referrer_id": referrer_id,
        "referred_id": customer_id,
        "booking_id": booking_id,
        "booking_amount": booking_amount,
        "bonus_amount": bonus,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Mark customer's first booking done
    await db.users.update_one(
        {"id": customer_id},
        {"$set": {"first_booking_done": True}}
    )


# ============== DISCOUNT CODE MANAGEMENT ==============

@router.get("/discount-codes")
async def get_discount_codes(
    is_active: Optional[bool] = None,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Admin: Get all discount codes"""
    db = get_database()
    
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    codes = await db.discount_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"codes": codes, "total": len(codes)}


@router.post("/discount-codes")
async def create_discount_code(
    code_data: DiscountCode,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Admin: Create new discount code"""
    db = get_database()
    
    # Check if code already exists
    existing = await db.discount_codes.find_one({"code": code_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists")
    
    discount_data = code_data.dict()
    discount_data["id"] = str(uuid4())
    discount_data["code"] = code_data.code.upper()
    discount_data["times_used"] = 0
    discount_data["created_by"] = user["id"]
    discount_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.discount_codes.insert_one(discount_data)
    
    return {"message": "Discount code created", "code": discount_data}


@router.put("/discount-codes/{code_id}")
async def update_discount_code(
    code_id: str,
    updates: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Admin: Update discount code"""
    db = get_database()
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user["id"]
    
    await db.discount_codes.update_one(
        {"id": code_id},
        {"$set": updates}
    )
    
    return {"message": "Discount code updated"}


@router.delete("/discount-codes/{code_id}")
async def delete_discount_code(
    code_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Admin: Delete discount code"""
    db = get_database()
    
    await db.discount_codes.delete_one({"id": code_id})
    
    return {"message": "Discount code deleted"}


@router.post("/validate-discount")
async def validate_discount_code(
    data: dict,
    user: dict = Depends(get_current_user)
):
    """Validate discount code for booking"""
    db = get_database()
    
    code = data.get("code", "").upper()
    booking_amount = float(data.get("booking_amount", 0))
    purpose = data.get("purpose", "")
    
    discount = await db.discount_codes.find_one(
        {"code": code},
        {"_id": 0}
    )
    
    if not discount:
        raise HTTPException(status_code=404, detail="Invalid discount code / अमान्य डिस्काउंट कोड")
    
    # Check if active
    if not discount.get("is_active"):
        raise HTTPException(status_code=400, detail="Discount code is inactive / डिस्काउंट कोड निष्क्रिय है")
    
    # Check validity dates
    now = datetime.now(timezone.utc).isoformat()
    if discount.get("valid_from") and now < discount["valid_from"]:
        raise HTTPException(status_code=400, detail="Discount code not yet valid / डिस्काउंट कोड अभी मान्य नहीं है")
    
    if discount.get("valid_until") and now > discount["valid_until"]:
        raise HTTPException(status_code=400, detail="Discount code has expired / डिस्काउंट कोड समाप्त हो गया")
    
    # Check usage limit
    if discount.get("times_used", 0) >= discount.get("max_uses", 100):
        raise HTTPException(status_code=400, detail="Discount code usage limit reached / उपयोग सीमा पूरी हो गई")
    
    # Check minimum booking amount
    if booking_amount < discount.get("min_booking_amount", 0):
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum booking amount is ₹{discount.get('min_booking_amount')} / न्यूनतम बुकिंग राशि ₹{discount.get('min_booking_amount')}"
        )
    
    # Check applicable purposes
    if discount.get("applicable_purposes") and purpose not in discount["applicable_purposes"]:
        raise HTTPException(status_code=400, detail="Discount not applicable for this booking type")
    
    # Calculate discount
    if discount["discount_type"] == "percent":
        discount_amount = booking_amount * (discount["discount_value"] / 100)
        if discount.get("max_discount_amount"):
            discount_amount = min(discount_amount, discount["max_discount_amount"])
    else:
        discount_amount = discount["discount_value"]
    
    return {
        "valid": True,
        "code": code,
        "discount_type": discount["discount_type"],
        "discount_value": discount["discount_value"],
        "discount_amount": round(discount_amount, 2),
        "description": discount.get("description", ""),
        "message": f"Discount of ₹{round(discount_amount, 2)} applied! / ₹{round(discount_amount, 2)} की छूट लागू!"
    }


# ============== SETTINGS ==============

@router.get("/settings")
async def get_referral_settings(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Admin: Get referral settings"""
    db = get_database()
    
    settings = await db.referral_settings.find_one({"type": "referral"}, {"_id": 0})
    if not settings:
        settings = ReferralSettings().dict()
        settings["type"] = "referral"
    
    return settings


@router.put("/settings")
async def update_referral_settings(
    settings: ReferralSettings,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Admin: Update referral settings"""
    db = get_database()
    
    settings_data = settings.dict()
    settings_data["type"] = "referral"
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings_data["updated_by"] = user["id"]
    
    await db.referral_settings.update_one(
        {"type": "referral"},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"message": "Referral settings updated / रेफरल सेटिंग्स अपडेट हो गईं"}


@router.get("/settings/public")
async def get_public_referral_settings():
    """Get referral settings (public - for booking page)"""
    db = get_database()
    
    settings = await db.referral_settings.find_one({"type": "referral"}, {"_id": 0})
    if not settings:
        settings = ReferralSettings().dict()
    
    return {
        "referral_enabled": settings.get("referral_enabled", True),
        "first_booking_discount_percent": settings.get("first_booking_discount_percent", 10),
        "first_booking_discount_max": settings.get("first_booking_discount_max", 2000),
        "wallet_enabled": settings.get("wallet_enabled", True)
    }


# ============== GENERATE CODE HELPER ==============

@router.post("/generate-code")
async def generate_discount_code_string(
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Generate a random discount code string"""
    prefix = data.get("prefix", "AIR")
    length = data.get("length", 6)
    
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(secrets.choice(chars) for _ in range(length))
    
    return {"code": f"{prefix}{random_part}"}
