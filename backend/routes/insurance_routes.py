from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/insurance", tags=["Insurance Module"])

# Insurance Plans
DEFAULT_PLANS = [
    {
        "id": "basic",
        "name": "Basic Cover",
        "name_hi": "बेसिक कवर",
        "coverage_amount": 500000,  # ₹5 Lakh
        "premium_percent": 0.5,  # 0.5% of booking
        "min_premium": 199,
        "features": [
            "Accidental death cover",
            "Medical emergency cover",
            "Trip cancellation (50%)"
        ],
        "exclusions": ["Pre-existing conditions", "Adventure activities"]
    },
    {
        "id": "standard",
        "name": "Standard Cover",
        "name_hi": "स्टैंडर्ड कवर",
        "coverage_amount": 1500000,  # ₹15 Lakh
        "premium_percent": 1.0,
        "min_premium": 399,
        "features": [
            "Accidental death cover",
            "Medical emergency cover",
            "Trip cancellation (100%)",
            "Baggage loss cover",
            "Flight delay compensation"
        ],
        "exclusions": ["Pre-existing conditions"]
    },
    {
        "id": "premium",
        "name": "Premium Cover",
        "name_hi": "प्रीमियम कवर",
        "coverage_amount": 5000000,  # ₹50 Lakh
        "premium_percent": 2.0,
        "min_premium": 999,
        "features": [
            "Accidental death cover (Enhanced)",
            "Medical emergency cover",
            "Trip cancellation (100%)",
            "Baggage loss cover",
            "Flight delay compensation",
            "Personal liability cover",
            "Adventure activities covered",
            "24x7 assistance"
        ],
        "exclusions": []
    }
]

# Models
class InsurancePurchase(BaseModel):
    booking_id: str
    plan_id: str
    passenger_details: List[dict]  # [{name, age, id_type, id_number}]
    nominee_name: str
    nominee_relation: str
    nominee_phone: Optional[str] = None

class ClaimRequest(BaseModel):
    policy_id: str
    claim_type: str  # medical, cancellation, delay, baggage, death
    description: str
    amount_claimed: float
    documents: List[str] = []  # URLs to uploaded documents
    incident_date: str
    incident_location: Optional[str] = None

class ClaimUpdate(BaseModel):
    status: str  # under_review, approved, rejected, settled
    remarks: Optional[str] = None
    approved_amount: Optional[float] = None

# API Endpoints
@router.get("/plans")
async def get_insurance_plans(booking_value: Optional[float] = None):
    """Get available insurance plans"""
    plans = []
    for plan in DEFAULT_PLANS:
        plan_data = {**plan}
        if booking_value:
            calculated_premium = max(
                plan["min_premium"],
                booking_value * (plan["premium_percent"] / 100)
            )
            plan_data["calculated_premium"] = round(calculated_premium, 0)
        plans.append(plan_data)
    
    return {"plans": plans}

@router.post("/purchase")
async def purchase_insurance(purchase: InsurancePurchase, current_user: dict = Depends(get_current_user)):
    """Purchase insurance for a booking"""
    db = get_database()
    
    # Get booking details
    booking = await db.bookings.find_one({"id": purchase.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if already insured
    existing = await db.insurance_policies.find_one({"booking_id": purchase.booking_id, "status": "active"})
    if existing:
        raise HTTPException(status_code=400, detail="Booking already has active insurance")
    
    # Get plan details
    plan = next((p for p in DEFAULT_PLANS if p["id"] == purchase.plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Calculate premium
    booking_value = booking.get("total_amount", 0)
    premium = max(plan["min_premium"], booking_value * (plan["premium_percent"] / 100))
    
    policy_data = {
        "id": str(uuid4()),
        "policy_number": f"AYI{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:6].upper()}",
        "booking_id": purchase.booking_id,
        "booking_number": booking.get("booking_number"),
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name"),
        "plan_id": purchase.plan_id,
        "plan_name": plan["name"],
        "coverage_amount": plan["coverage_amount"],
        "premium_amount": round(premium, 0),
        "passenger_details": purchase.passenger_details,
        "nominee_name": purchase.nominee_name,
        "nominee_relation": purchase.nominee_relation,
        "nominee_phone": purchase.nominee_phone,
        "journey_date": booking.get("journey_date"),
        "route": f"{booking.get('origin')} → {booking.get('destination')}",
        "status": "active",
        "policy_start": datetime.now(timezone.utc).isoformat(),
        "policy_end": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),  # Valid for journey day + 1
        "features": plan["features"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.insurance_policies.insert_one(policy_data)
    policy_data.pop("_id", None)
    
    # Update booking
    await db.bookings.update_one(
        {"id": purchase.booking_id},
        {"$set": {
            "insurance_policy_id": policy_data["id"],
            "insurance_premium": policy_data["premium_amount"]
        }}
    )
    
    return {"message": "Insurance purchased successfully", "policy": policy_data}

@router.get("/my-policies")
async def get_my_policies(current_user: dict = Depends(get_current_user)):
    """Get user's insurance policies"""
    db = get_database()
    
    policies = await db.insurance_policies.find(
        {"customer_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"policies": policies}

@router.get("/policy/{policy_id}")
async def get_policy_details(policy_id: str, current_user: dict = Depends(get_current_user)):
    """Get policy details"""
    db = get_database()
    
    policy = await db.insurance_policies.find_one({"id": policy_id}, {"_id": 0})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    # Check access
    is_admin = "admin" in current_user.get("roles", [])
    is_owner = policy["customer_id"] == current_user["id"]
    
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get claims for this policy
    claims = await db.insurance_claims.find(
        {"policy_id": policy_id},
        {"_id": 0}
    ).to_list(20)
    
    policy["claims"] = claims
    return policy

# Claims
@router.post("/claims")
async def file_claim(claim: ClaimRequest, current_user: dict = Depends(get_current_user)):
    """File an insurance claim"""
    db = get_database()
    
    # Get policy
    policy = await db.insurance_policies.find_one({"id": claim.policy_id})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if policy["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if policy["status"] != "active":
        raise HTTPException(status_code=400, detail="Policy is not active")
    
    claim_data = {
        "id": str(uuid4()),
        "claim_number": f"CLM{datetime.now().strftime('%Y%m%d')}{str(uuid4())[:6].upper()}",
        "policy_id": claim.policy_id,
        "policy_number": policy["policy_number"],
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name"),
        "claim_type": claim.claim_type,
        "description": claim.description,
        "amount_claimed": claim.amount_claimed,
        "approved_amount": None,
        "documents": claim.documents,
        "incident_date": claim.incident_date,
        "incident_location": claim.incident_location,
        "status": "submitted",  # submitted, under_review, approved, rejected, settled
        "remarks": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.insurance_claims.insert_one(claim_data)
    claim_data.pop("_id", None)
    
    return {"message": "Claim submitted successfully", "claim": claim_data}

@router.get("/claims/my")
async def get_my_claims(current_user: dict = Depends(get_current_user)):
    """Get user's claims"""
    db = get_database()
    
    claims = await db.insurance_claims.find(
        {"customer_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"claims": claims}

# Admin Endpoints
@router.get("/admin/dashboard")
async def get_insurance_dashboard(current_user: dict = Depends(get_current_user)):
    """Get insurance dashboard"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Stats
    total_policies = await db.insurance_policies.count_documents({})
    active_policies = await db.insurance_policies.count_documents({"status": "active"})
    
    # Premium collected
    pipeline = [
        {"$group": {"_id": None, "total_premium": {"$sum": "$premium_amount"}}}
    ]
    premium_result = await db.insurance_policies.aggregate(pipeline).to_list(1)
    total_premium = premium_result[0]["total_premium"] if premium_result else 0
    
    # Claims stats
    total_claims = await db.insurance_claims.count_documents({})
    pending_claims = await db.insurance_claims.count_documents({"status": {"$in": ["submitted", "under_review"]}})
    
    # Claims amount
    pipeline = [
        {"$match": {"status": "settled"}},
        {"$group": {"_id": None, "total_settled": {"$sum": "$approved_amount"}}}
    ]
    settled_result = await db.insurance_claims.aggregate(pipeline).to_list(1)
    total_settled = settled_result[0]["total_settled"] if settled_result else 0
    
    # Recent claims
    recent_claims = await db.insurance_claims.find(
        {},
        {"_id": 0, "claim_number": 1, "claim_type": 1, "amount_claimed": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "total_policies": total_policies,
        "active_policies": active_policies,
        "total_premium_collected": total_premium,
        "total_claims": total_claims,
        "pending_claims": pending_claims,
        "total_claims_settled": total_settled,
        "claim_ratio": round((total_settled / total_premium * 100) if total_premium > 0 else 0, 1),
        "recent_claims": recent_claims
    }

@router.get("/admin/claims")
async def get_all_claims(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all claims (admin)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    claims = await db.insurance_claims.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"claims": claims}

@router.put("/admin/claims/{claim_id}")
async def update_claim(
    claim_id: str,
    update: ClaimUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update claim status (admin)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    update_data = {
        "status": update.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": current_user["id"]
    }
    
    if update.remarks:
        update_data["remarks"] = update.remarks
    if update.approved_amount is not None:
        update_data["approved_amount"] = update.approved_amount
    if update.status == "settled":
        update_data["settled_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.insurance_claims.update_one({"id": claim_id}, {"$set": update_data})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    return {"message": f"Claim {update.status}"}
