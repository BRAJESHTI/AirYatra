"""Admin: City/Route-wise Platform Fee Rules + operator quote fee preview"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import get_database
from middleware import get_current_user
from services.platform_fee_service import resolve_platform_fee, compute_platform_fee

router = APIRouter(prefix="/platform-fees", tags=["Platform Fees"])

ADMIN_ROLES = {"admin", "super_admin", "ceo"}


def _require_admin(user: dict):
    if not ADMIN_ROLES & set(user.get("roles", [])):
        raise HTTPException(status_code=403, detail="Admin/CEO access required")


class FeeRuleCreate(BaseModel):
    from_city: str
    to_city: Optional[str] = None
    fee_type: str = "percent"
    fee_value: float
    label: Optional[str] = None


class FeeRuleUpdate(BaseModel):
    from_city: Optional[str] = None
    to_city: Optional[str] = None
    fee_type: Optional[str] = None
    fee_value: Optional[float] = None
    label: Optional[str] = None
    active: Optional[bool] = None


class FeePreviewRequest(BaseModel):
    from_location: str
    to_location: str
    amount: float


def _validate(fee_type: str, fee_value: float):
    if fee_type not in ("percent", "flat"):
        raise HTTPException(status_code=400, detail="fee_type must be 'percent' or 'flat'")
    if fee_value < 0:
        raise HTTPException(status_code=400, detail="fee_value cannot be negative")
    if fee_type == "percent" and fee_value > 100:
        raise HTTPException(status_code=400, detail="percent fee cannot exceed 100")


@router.get("/")
async def list_fee_rules(user: dict = Depends(get_current_user)):
    _require_admin(user)
    db = get_database()
    rules = await db.platform_fee_rules.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    settings = await db.platform_settings.find_one({"key": "pricing"}, {"_id": 0}) or {}
    return {"rules": rules, "global_default_percent": settings.get("commission_percent", 15)}


@router.post("/")
async def create_fee_rule(body: FeeRuleCreate, user: dict = Depends(get_current_user)):
    _require_admin(user)
    _validate(body.fee_type, body.fee_value)
    db = get_database()
    suffix = f"{body.fee_value}%" if body.fee_type == "percent" else f"₹{body.fee_value:,.0f} flat"
    route_label = f"{body.from_city} → {body.to_city}" if body.to_city else f"{body.from_city} (city-wide)"
    rule = {
        "id": str(uuid.uuid4()),
        "rule_id": str(uuid.uuid4())[:8].upper(),
        "from_city": body.from_city.strip(),
        "to_city": body.to_city.strip() if body.to_city else None,
        "fee_type": body.fee_type,
        "fee_value": body.fee_value,
        "label": body.label or f"{route_label}: {suffix}",
        "active": True,
        "created_by": user["id"],
        "created_by_name": user.get("full_name") or user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.platform_fee_rules.insert_one({**rule})
    return {"message": "Platform fee rule created", "rule": rule}


@router.put("/{rule_id}")
async def update_fee_rule(rule_id: str, body: FeeRuleUpdate, user: dict = Depends(get_current_user)):
    _require_admin(user)
    db = get_database()
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "fee_type" in update or "fee_value" in update:
        existing = await db.platform_fee_rules.find_one({"id": rule_id}, {"_id": 0}) or {}
        _validate(update.get("fee_type", existing.get("fee_type", "percent")),
                  update.get("fee_value", existing.get("fee_value", 0)))
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.platform_fee_rules.update_one({"id": rule_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule updated"}


@router.delete("/{rule_id}")
async def delete_fee_rule(rule_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
    db = get_database()
    result = await db.platform_fee_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"message": "Rule deleted"}


@router.post("/preview")
async def preview_fee(body: FeePreviewRequest, user: dict = Depends(get_current_user)):
    """Operator: live breakdown while quoting - payout + platform fee = customer total"""
    db = get_database()
    rule = await resolve_platform_fee(db, body.from_location, body.to_location)
    fee = compute_platform_fee(body.amount, rule)
    return {
        "operator_payout": round(body.amount, 2),
        "platform_fee": fee,
        "customer_total": round(body.amount + fee, 2),
        "rule_label": rule.get("label"),
        "rule_source": rule.get("source"),
    }
