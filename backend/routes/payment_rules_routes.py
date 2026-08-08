"""Admin Payment Rules — route-wise / value-wise advance rules (50%, 100%, Pay Later, EMI)"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/admin/payment-rules", tags=["payment-rules"])

ADMIN_ROLES = {"admin", "super_admin", "ceo", "finance"}


def _require_admin(current_user: dict):
    if not set(current_user.get("roles", [])).intersection(ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Admin/CEO/Finance access required")


class PaymentRule(BaseModel):
    id: Optional[str] = None
    name: str
    active: bool = True
    priority: int = 100
    route_from: Optional[str] = None
    route_to: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    purpose: Optional[str] = None
    advance_percent: int = 50
    allow_emi: bool = False


class RulesSettings(BaseModel):
    default_advance_percent: int = 50
    payment_rules: List[PaymentRule] = []


class PreviewRequest(BaseModel):
    pickup_location: Optional[str] = ""
    drop_location: Optional[str] = ""
    booking_purpose: Optional[str] = "other"
    total_amount: float = 0


async def resolve_payment_rule(db, booking: dict, total_amount: float) -> dict:
    """Resolve advance % + EMI flag for a booking from admin payment rules.
    Matching: purpose (exact), route from/to (case-insensitive substring), booking value range.
    First active rule (lowest priority number) matching ALL its set criteria wins."""
    settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0}) or {}
    default_pct = int(settings.get("default_advance_percent", 50))
    pickup = (booking.get("pickup_location") or booking.get("from_location") or "").lower()
    drop = (booking.get("drop_location") or booking.get("to_location") or "").lower()
    purpose = booking.get("booking_purpose") or "other"

    rules = [r for r in settings.get("payment_rules", []) if r.get("active", True)]
    rules.sort(key=lambda r: r.get("priority", 100))
    for rule in rules:
        if rule.get("purpose") and rule["purpose"] != purpose:
            continue
        if rule.get("route_from") and rule["route_from"].lower() not in pickup:
            continue
        if rule.get("route_to") and rule["route_to"].lower() not in drop:
            continue
        if rule.get("min_amount") not in (None, "") and total_amount < float(rule["min_amount"]):
            continue
        if rule.get("max_amount") not in (None, "") and total_amount > float(rule["max_amount"]):
            continue
        pct = int(rule.get("advance_percent", default_pct))
        return {
            "advance_percent": pct,
            "allow_emi": bool(rule.get("allow_emi", False)),
            "pay_later": pct == 0,
            "rule_name": rule.get("name"),
            "rule_id": rule.get("id"),
        }
    return {"advance_percent": default_pct, "allow_emi": False, "pay_later": default_pct == 0,
            "rule_name": None, "rule_id": None}


@router.get("")
async def get_payment_rules(current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    _require_admin(current_user)
    settings = await db.payment_rules_settings.find_one({"type": "payment_rules"}, {"_id": 0}) or {}
    return {
        "default_advance_percent": int(settings.get("default_advance_percent", 50)),
        "payment_rules": settings.get("payment_rules", []),
        "updated_at": settings.get("updated_at"),
        "updated_by": settings.get("updated_by"),
    }


@router.put("")
async def save_payment_rules(body: RulesSettings, current_user: dict = Depends(get_current_user),
                             db=Depends(get_database)):
    _require_admin(current_user)
    if body.default_advance_percent not in (0, 25, 50, 75, 100):
        raise HTTPException(status_code=400, detail="default_advance_percent must be 0/25/50/75/100")
    rules = []
    for r in body.payment_rules:
        if r.advance_percent not in (0, 25, 50, 75, 100):
            raise HTTPException(status_code=400, detail=f"Rule '{r.name}': advance_percent must be 0/25/50/75/100")
        if r.min_amount is not None and r.max_amount is not None and r.min_amount > r.max_amount:
            raise HTTPException(status_code=400, detail=f"Rule '{r.name}': min_amount > max_amount")
        doc = r.model_dump()
        doc["id"] = doc["id"] or str(uuid4())
        rules.append(doc)
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_rules_settings.update_one(
        {"type": "payment_rules"},
        {"$set": {
            "type": "payment_rules",
            "default_advance_percent": body.default_advance_percent,
            "payment_rules": rules,
            "updated_at": now,
            "updated_by": current_user.get("email"),
        }},
        upsert=True,
    )
    return {"success": True, "rules_count": len(rules), "updated_at": now}


@router.post("/preview")
async def preview_rule(body: PreviewRequest, current_user: dict = Depends(get_current_user),
                       db=Depends(get_database)):
    _require_admin(current_user)
    booking = {"pickup_location": body.pickup_location, "drop_location": body.drop_location,
               "booking_purpose": body.booking_purpose}
    resolved = await resolve_payment_rule(db, booking, body.total_amount)
    advance = float(int(body.total_amount * resolved["advance_percent"] / 100))
    return {**resolved, "advance_amount": advance, "remaining_amount": max(0.0, body.total_amount - advance)}
