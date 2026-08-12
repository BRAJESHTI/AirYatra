"""Urgency pricing (time-to-departure) + AI Surge pricing (demand-based) for marketplace & quotes"""
import re
from datetime import datetime, timezone, timedelta

DEFAULT_URGENCY = {
    "enabled": True,
    "tiers": [
        {"min_hours": 0, "max_hours": 6, "percent": 15.0},
        {"min_hours": 6, "max_hours": 12, "percent": 10.0},
    ],
}

DEFAULT_SURGE = {
    "enabled": True,
    "max_percent": 100.0,
    "free_searches": 5,
    "search_weight": 2.0,
    "booking_weight": 10.0,
}


async def get_urgency_settings(db) -> dict:
    doc = await db.platform_settings.find_one({"key": "urgency_pricing"}, {"_id": 0})
    return (doc or {}).get("value") or DEFAULT_URGENCY


async def get_surge_settings(db) -> dict:
    doc = await db.platform_settings.find_one({"key": "surge_pricing"}, {"_id": 0})
    return (doc or {}).get("value") or DEFAULT_SURGE


def get_urgency_percent(settings: dict, travel_date: str, travel_time: str = None):
    """Returns (percent, label) based on hours until departure (IST assumed)."""
    if not settings.get("enabled", True) or not travel_date:
        return 0.0, None
    try:
        time_part = (travel_time or "09:00")[:5]
        dt = datetime.fromisoformat(f"{str(travel_date)[:10]}T{time_part}:00+05:30")
    except Exception:
        return 0.0, None
    hours = (dt - datetime.now(timezone.utc)).total_seconds() / 3600
    if hours < 0:
        return 0.0, None
    for tier in settings.get("tiers", []):
        if float(tier.get("min_hours", 0)) <= hours < float(tier.get("max_hours", 0)):
            pct = float(tier.get("percent", 0))
            if pct > 0:
                return pct, f"Urgent: departs in <{int(tier['max_hours'])}h (+{pct:g}%)"
    return 0.0, None


def _route_key(from_loc: str, to_loc: str) -> str:
    f = (from_loc or "").split(",")[0].strip().lower()[:12]
    t = (to_loc or "").split(",")[0].strip().lower()[:12]
    return f"{f}->{t}"


async def log_route_search(db, from_loc: str, to_loc: str):
    await db.route_search_log.insert_one({
        "route_key": _route_key(from_loc, to_loc),
        "from_location": from_loc,
        "to_location": to_loc,
        "ts": datetime.now(timezone.utc).isoformat(),
    })


async def compute_surge_percent(db, settings: dict, from_loc: str, to_loc: str):
    """AI demand surge: searches + bookings on this route in last 24h -> percent (capped)."""
    if not settings.get("enabled", True):
        return 0.0, {}
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    searches = await db.route_search_log.count_documents(
        {"route_key": _route_key(from_loc, to_loc), "ts": {"$gte": since}})
    f = re.escape((from_loc or "").split(",")[0].strip()[:6])
    t = re.escape((to_loc or "").split(",")[0].strip()[:6])
    bookings = await db.bookings.count_documents({
        "from_location": {"$regex": f"^{f}", "$options": "i"},
        "to_location": {"$regex": f"^{t}", "$options": "i"},
        "created_at": {"$gte": since},
    })
    raw = max(0, searches - float(settings.get("free_searches", 5))) * float(settings.get("search_weight", 2)) \
        + bookings * float(settings.get("booking_weight", 10))
    pct = round(min(float(settings.get("max_percent", 100)), raw), 1)
    return pct, {"searches_24h": searches, "bookings_24h": bookings}
