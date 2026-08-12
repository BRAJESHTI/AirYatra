"""City/route-wise platform fee resolution - auto-applied on operator quotes"""


def _match(city: str, text: str) -> bool:
    c = (city or "").strip().lower()
    t = (text or "").strip().lower()
    if not c or not t:
        return False
    return c in t or t.split(",")[0].strip()[:6] in c


async def resolve_platform_fee(db, from_location: str, to_location: str) -> dict:
    rules = await db.platform_fee_rules.find({"active": True}, {"_id": 0}).to_list(200)
    route_rules = [r for r in rules if r.get("to_city")]
    city_rules = [r for r in rules if not r.get("to_city")]

    for r in route_rules:
        if (_match(r.get("from_city"), from_location) and _match(r.get("to_city"), to_location)) or \
           (_match(r.get("from_city"), to_location) and _match(r.get("to_city"), from_location)):
            return {**r, "source": "route_rule"}

    for r in city_rules:
        if _match(r.get("from_city"), from_location) or _match(r.get("from_city"), to_location):
            return {**r, "source": "city_rule"}

    settings = await db.platform_settings.find_one({"key": "pricing"}, {"_id": 0}) or {}
    pct = settings.get("commission_percent", 15)
    return {
        "fee_type": "percent", "fee_value": pct, "rule_id": None,
        "label": f"Global Default ({pct}%)", "source": "global_default",
    }


def compute_platform_fee(amount: float, rule: dict) -> float:
    if rule.get("fee_type") == "flat":
        return round(float(rule.get("fee_value", 0)), 2)
    return round(float(amount) * float(rule.get("fee_value", 0)) / 100, 2)
