"""Hybrid Marketplace Booking Engine: instant compare & book + reverse auction bridge"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import uuid
import math

from database import get_database
from middleware import get_current_user
from routes.auction_routes import notify_operators_new_auction

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])

SERVICE_SPEEDS = {
    "helicopter": 220, "chartered_plane": 650, "air_ambulance": 240,
    "yacht_cruiser": 35, "cargo": 400, "joy_ride": 180,
}
SERVICE_LABELS = {
    "helicopter": "Helicopter Charter", "chartered_plane": "Private Jet",
    "air_ambulance": "Air Ambulance", "yacht_cruiser": "Luxury Yacht / Cruiser",
    "cargo": "Cargo Aircraft / Ship", "joy_ride": "Scenic / Joy Ride",
}


class MarketplaceSearchRequest(BaseModel):
    aircraft_type: str
    from_location: str
    to_location: str
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    drop_latitude: Optional[float] = None
    drop_longitude: Optional[float] = None
    travel_date: str
    travel_time: Optional[str] = "09:00"
    passengers: int = 1
    booking_type: Optional[str] = "one_way"


class MarketplaceBookRequest(MarketplaceSearchRequest):
    aircraft_id: str
    consents_accepted: Optional[dict] = None


class AuctionStartRequest(MarketplaceSearchRequest):
    max_budget: Optional[float] = None
    special_requirements: Optional[str] = None


class AuctionCheckoutRequest(BaseModel):
    consents_accepted: Optional[dict] = None


def haversine_km(lat1, lng1, lat2, lng2):
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


async def _engine_settings(db):
    doc = await db.repositioning_engine.find_one({"engine_id": "default_repositioning_engine"}, {"_id": 0}) or {}
    s = doc.get("settings", {})
    return {
        "ferry_rate_per_km": s.get("ferry_rate_per_km", 50),
        "auction_duration_minutes": s.get("default_auction_duration_minutes", 20),
        "ferry_free_radius_km": s.get("ferry_free_radius_km", 25),
    }


def _price_option(aircraft: dict, distance_km: float, passengers: int, settings: dict, fixed_route: Optional[dict],
                  urgency_pct: float = 0.0, urgency_label: str = None, surge_pct: float = 0.0):
    """Compute full transparent pricing for one aircraft option"""
    speed = aircraft.get("cruise_speed_kmh") or SERVICE_SPEEDS.get(aircraft.get("service_category"), 220)
    flight_hours = max(round((distance_km or 100) / speed, 2), 0.5)

    # Ferry / repositioning (AI Smart Repositioning) - always per aircraft base location
    base_loc = aircraft.get("base_coordinates") or {}
    ferry_km = haversine_km(base_loc.get("lat"), base_loc.get("lng"),
                            aircraft.get("_pickup_lat"), aircraft.get("_pickup_lng"))
    if ferry_km is None:
        ferry_km = 0
    ferry_charge = 0.0
    if ferry_km > settings["ferry_free_radius_km"]:
        ferry_charge = round(ferry_km * settings["ferry_rate_per_km"], 2)

    if fixed_route:
        per_seat_total = fixed_route.get("price_per_seat", 0) * passengers
        base_fare = min(fixed_route.get("base_price", per_seat_total) or per_seat_total, per_seat_total) if per_seat_total > 0 else fixed_route.get("base_price", 0)
        base_fare = round(base_fare * fixed_route.get("demand_multiplier", 1.0), 2)
        pricing_model = "fixed_route"
    else:
        base_fare = round(aircraft.get("hourly_rate", 50000) * max(flight_hours, 1.0), 2)
        pricing_model = "dynamic"

    # AI Surge (fixed routes only) + Urgency surcharge (all)
    surge_amount = 0.0
    applied_surge_pct = 0.0
    if pricing_model == "fixed_route" and surge_pct > 0:
        surge_amount = round(base_fare * surge_pct / 100, 2)
        applied_surge_pct = surge_pct
    urgency_amount = round((base_fare + surge_amount) * urgency_pct / 100, 2) if urgency_pct else 0.0

    convenience_fee = round((base_fare + ferry_charge) * 0.05, 2)
    gst = round((base_fare + surge_amount + urgency_amount + ferry_charge + convenience_fee) * 0.18, 2)
    total = round(base_fare + surge_amount + urgency_amount + ferry_charge + convenience_fee + gst, 2)

    positioning_minutes = int((ferry_km / speed) * 60) if ferry_km else 0
    flight_minutes = int(flight_hours * 60)

    return {
        "pricing_model": pricing_model,
        "base_fare": base_fare,
        "ferry_km": ferry_km,
        "ferry_charge": ferry_charge,
        "surge_percent": applied_surge_pct,
        "surge_amount": surge_amount,
        "urgency_percent": urgency_pct,
        "urgency_amount": urgency_amount,
        "urgency_label": urgency_label,
        "convenience_fee": convenience_fee,
        "gst": gst,
        "total": total,
        "flight_minutes": flight_minutes,
        "positioning_minutes": positioning_minutes,
        "eta_minutes": positioning_minutes + 45,
    }


async def _build_options(db, req: MarketplaceSearchRequest):
    settings = await _engine_settings(db)
    distance_km = haversine_km(req.pickup_latitude, req.pickup_longitude, req.drop_latitude, req.drop_longitude) or 150

    # Fixed route match (fuzzy on city names)
    from_l, to_l = req.from_location.lower(), req.to_location.lower()
    fixed_route = None
    routes = await db.fixed_routes.find({"status": "active"}, {"_id": 0}).to_list(100)
    for r in routes:
        o, d = (r.get("origin") or "").lower(), (r.get("destination") or "").lower()
        if (from_l.split(" ")[0][:6] in o or o.split(" ")[0][:6] in from_l) and \
           (to_l.split(" ")[0][:6] in d or d.split(" ")[0][:6] in to_l):
            if r.get("aircraft_type") in (req.aircraft_type, None, "any"):
                fixed_route = r
                break

    aircraft_list = await db.aircraft.find({
        "marketplace_listed": True,
        "service_category": req.aircraft_type,
        "is_available": True,
        "capacity": {"$gte": req.passengers},
    }, {"_id": 0}).to_list(50)

    # Urgency (time-to-departure) + AI Surge (demand on this route, fixed routes only)
    from services.dynamic_pricing_service import (
        get_urgency_settings, get_surge_settings, get_urgency_percent, compute_surge_percent,
    )
    urgency_pct, urgency_label = get_urgency_percent(
        await get_urgency_settings(db), req.travel_date, req.travel_time)
    surge_pct = 0.0
    if fixed_route:
        surge_pct, _demand = await compute_surge_percent(
            db, await get_surge_settings(db), req.from_location, req.to_location)

    options = []
    for ac in aircraft_list:
        ac["_pickup_lat"], ac["_pickup_lng"] = req.pickup_latitude, req.pickup_longitude
        pricing = _price_option(ac, distance_km, req.passengers, settings, fixed_route,
                                urgency_pct=urgency_pct, urgency_label=urgency_label, surge_pct=surge_pct)
        options.append({
            "option_id": ac["id"],
            "aircraft_id": ac["id"],
            "aircraft_model": ac.get("model_name") or ac.get("aircraft_type"),
            "registration_number": ac.get("registration_number"),
            "engine_type": ac.get("engine_type"),
            "engine_model": ac.get("engine_model"),
            "service_category": ac.get("service_category"),
            "image": ac.get("image"),
            "operator_id": ac.get("operator_id"),
            "operator_name": ac.get("operator_name", "AirYatra Partner"),
            "verified": ac.get("verified", False),
            "rating": ac.get("rating", 4.0),
            "total_flights": ac.get("total_flights", 0),
            "capacity": ac.get("capacity"),
            "cabin_crew": ac.get("cabin_crew", 0),
            "pilot_experience_hours": ac.get("pilot_experience_hours", 1000),
            "amenities": ac.get("amenities", {}),
            "base_city": (ac.get("base_coordinates") or {}).get("city", ac.get("base_location")),
            "pricing": pricing,
            "fixed_route_code": fixed_route.get("route_code") if fixed_route and pricing["pricing_model"] == "fixed_route" else None,
        })

    # AI recommendation scoring
    if options:
        min_total = min(o["pricing"]["total"] for o in options)
        for o in options:
            price_score = min_total / o["pricing"]["total"]
            rating_score = (o["rating"] or 4.0) / 5
            exp_score = min((o["pilot_experience_hours"] or 1000) / 5000, 1)
            o["ai_score"] = round(0.5 * price_score + 0.3 * rating_score + 0.2 * exp_score, 3)
        options.sort(key=lambda o: -o["ai_score"])
        best = options[0]
        best["ai_recommended"] = True
        reasons = []
        if best["pricing"]["total"] == min_total:
            reasons.append("best price")
        if (best["rating"] or 0) >= 4.5:
            reasons.append(f"{best['rating']}★ rated operator")
        if best["pilot_experience_hours"] >= 3000:
            reasons.append(f"{best['pilot_experience_hours']:,}+ hrs pilot experience")
        best["ai_reason"] = "AI Pick: " + ", ".join(reasons) if reasons else "AI Pick: best overall value"

    return distance_km, fixed_route, options, settings


@router.post("/search")
async def marketplace_search(req: MarketplaceSearchRequest, current_user: dict = Depends(get_current_user)):
    """AI Route & Feasibility check + search all registered operators"""
    db = get_database()

    if req.aircraft_type not in SERVICE_SPEEDS:
        raise HTTPException(status_code=400, detail="Invalid service type")

    # Demand signal for AI Surge pricing
    from services.dynamic_pricing_service import log_route_search
    await log_route_search(db, req.from_location, req.to_location)

    distance_km, fixed_route, options, settings = await _build_options(db, req)

    speed = SERVICE_SPEEDS[req.aircraft_type]
    feasibility = {
        "feasible": True,
        "distance_km": distance_km,
        "estimated_flight_minutes": int(distance_km / speed * 60),
        "service": SERVICE_LABELS[req.aircraft_type],
        "notes": [],
    }
    if req.aircraft_type == "helicopter" and distance_km > 800:
        feasibility["notes"].append("Long route for helicopter - refueling stop may be required")
    if req.aircraft_type == "yacht_cruiser":
        feasibility["notes"].append("Coastal/water route - subject to port and weather clearance")

    mode = "marketplace" if options else "auction"
    return {
        "success": True,
        "mode": mode,
        "feasibility": feasibility,
        "fixed_route": {"route_code": fixed_route["route_code"], "route_name": fixed_route["route_name"]} if fixed_route else None,
        "options_count": len(options),
        "options": options,
        "price_lock_minutes": 15,
        "auction_duration_minutes": settings["auction_duration_minutes"],
    }


async def _create_payable_booking(db, current_user: dict, source: str, data: dict) -> dict:
    """Create an inquiry record that the existing payment engine can charge"""
    now = datetime.now(timezone.utc)
    booking_id = str(uuid.uuid4())
    total = data["total"]
    inquiry = {
        "id": booking_id,
        "inquiry_number": f"MKT{now.strftime('%Y%m%d')}{booking_id[:6].upper()}",
        "type": "marketplace_booking",
        "booking_source": source,
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name") or current_user.get("email"),
        "customer_email": current_user.get("email"),
        "customer_phone": current_user.get("phone"),
        "aircraft_type": data.get("aircraft_type"),
        "aircraft_id": data.get("aircraft_id"),
        "aircraft_model": data.get("aircraft_model"),
        "operator_id": data.get("operator_id"),
        "operator_name": data.get("operator_name"),
        "from_location": data.get("from_location"),
        "to_location": data.get("to_location"),
        "pickup_location": data.get("from_location"),
        "drop_location": data.get("to_location"),
        "departure_date": data.get("travel_date"),
        "travel_date": data.get("travel_date"),
        "pickup_time": data.get("travel_time"),
        "total_passengers": data.get("passengers", 1),
        "distance_km": data.get("distance_km"),
        "pricing_breakdown": data.get("pricing_breakdown"),
        "ferry_charge": (data.get("pricing_breakdown") or {}).get("ferry_charge", 0),
        "estimated_price": total,
        "final_price": total,
        "accepted_quote": {
            "amount": total,
            "operator_id": data.get("operator_id"),
            "operator_name": data.get("operator_name"),
            "accepted_at": now.isoformat(),
            "source": source,
        },
        "consents_accepted": data.get("consents_accepted"),
        "status": "payment_pending",
        "payment_status": "pending",
        "price_lock_expires_at": (now + timedelta(minutes=15)).isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.inquiries.insert_one(inquiry)
    inquiry.pop("_id", None)
    return inquiry


@router.post("/book")
async def marketplace_instant_book(req: MarketplaceBookRequest, current_user: dict = Depends(get_current_user)):
    """Instant book a marketplace option - price recomputed server-side, 15-min price lock"""
    db = get_database()

    distance_km, fixed_route, options, _ = await _build_options(db, req)
    option = next((o for o in options if o["aircraft_id"] == req.aircraft_id), None)
    if not option:
        raise HTTPException(status_code=404, detail="Selected aircraft no longer available for this route")

    booking = await _create_payable_booking(db, current_user, "marketplace", {
        **req.dict(),
        "aircraft_model": option["aircraft_model"],
        "operator_id": option["operator_id"],
        "operator_name": option["operator_name"],
        "distance_km": distance_km,
        "pricing_breakdown": option["pricing"],
        "total": option["pricing"]["total"],
    })

    return {
        "success": True,
        "booking_id": booking["id"],
        "booking_number": booking["inquiry_number"],
        "total_amount": booking["final_price"],
        "price_lock_expires_at": booking["price_lock_expires_at"],
        "payment_url": f"/customer/payment/{booking['id']}",
        "message": "Booking created! Complete payment within 15 minutes to lock this price.",
    }


@router.post("/auction/start")
async def marketplace_start_auction(req: AuctionStartRequest, background_tasks: BackgroundTasks,
                                    current_user: dict = Depends(get_current_user)):
    """Start a 20-minute AI reverse auction when no fixed pricing exists"""
    db = get_database()
    settings = await _engine_settings(db)
    duration = settings["auction_duration_minutes"]

    existing = await db.auctions.find_one({
        "customer_id": current_user["id"],
        "origin": req.from_location,
        "destination": req.to_location,
        "travel_date": req.travel_date,
        "status": "active",
    }, {"_id": 0})
    if existing:
        return {"success": True, "auction_id": existing["id"], "end_time": existing["end_time"],
                "duration_minutes": duration, "resumed": True}

    now = datetime.now(timezone.utc)
    end_time = now + timedelta(minutes=duration)
    distance_km = haversine_km(req.pickup_latitude, req.pickup_longitude, req.drop_latitude, req.drop_longitude) or 150

    auction = {
        "id": str(uuid.uuid4()),
        "auction_number": f"AUC-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}",
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name") or current_user.get("email"),
        "customer_email": current_user.get("email"),
        "contact_name": current_user.get("full_name") or current_user.get("email"),
        "contact_phone": current_user.get("phone") or "",
        "contact_email": current_user.get("email"),
        "origin": req.from_location,
        "origin_type": "city",
        "destination": req.to_location,
        "destination_type": "city",
        "travel_date": req.travel_date,
        "travel_time": req.travel_time,
        "return_date": None,
        "flight_type": req.booking_type or "one_way",
        "passengers": req.passengers,
        "aircraft_category": req.aircraft_type,
        "preferred_aircraft": None,
        "luggage_kg": 0,
        "special_requirements": req.special_requirements,
        "purpose": "marketplace_auto_auction",
        "distance_km": distance_km,
        "auction_duration_minutes": duration,
        "max_budget": req.max_budget,
        "created_at": now.isoformat(),
        "start_time": now.isoformat(),
        "end_time": end_time.isoformat(),
        "status": "active",
        "quotes_count": 0,
        "selected_quote_id": None,
        "operators_notified": 0,
        "mode": "reverse_auction",
        "version": "1.0",
    }
    await db.auctions.insert_one(auction)
    auction.pop("_id", None)
    background_tasks.add_task(notify_operators_new_auction, auction)

    return {
        "success": True,
        "auction_id": auction["id"],
        "auction_number": auction["auction_number"],
        "end_time": auction["end_time"],
        "duration_minutes": duration,
        "message": f"Reverse auction started! Operators notified. Live quotes for {duration} minutes.",
    }


@router.get("/auction/{auction_id}/live")
async def auction_live_state(auction_id: str, current_user: dict = Depends(get_current_user)):
    """Live polling endpoint: auction status + quotes sorted by price"""
    db = get_database()
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.now(timezone.utc)
    end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
    seconds_left = max(0, int((end_time - now).total_seconds()))
    if seconds_left == 0 and auction["status"] == "active":
        await db.auctions.update_one({"id": auction_id}, {"$set": {"status": "expired"}})
        auction["status"] = "expired"

    quotes = await db.auction_quotes.find(
        {"auction_id": auction_id, "status": {"$in": ["pending", "selected"]}}, {"_id": 0}
    ).sort("total_amount", 1).to_list(50)

    for q in quotes:
        if not q.get("operator_name") or q.get("operator_name") == "Unknown":
            op = await db.operators.find_one(
                {"$or": [{"id": q.get("operator_id")}, {"user_id": q.get("operator_id")}]},
                {"_id": 0, "company_name": 1}
            )
            if op:
                q["operator_name"] = op.get("company_name")
            else:
                u = await db.users.find_one({"id": q.get("operator_id")}, {"_id": 0, "full_name": 1, "email": 1})
                q["operator_name"] = (u or {}).get("full_name") or "AirYatra Partner Operator"

    return {
        "success": True,
        "status": auction["status"],
        "seconds_left": seconds_left,
        "end_time": auction["end_time"],
        "quotes_count": len(quotes),
        "operators_notified": auction.get("operators_notified", 0),
        "quotes": quotes,
        "selected_quote_id": auction.get("selected_quote_id"),
    }


@router.post("/auction/{auction_id}/accept/{quote_id}")
async def auction_accept_and_checkout(auction_id: str, quote_id: str, body: AuctionCheckoutRequest,
                                      current_user: dict = Depends(get_current_user)):
    """Accept a live quote instantly and create a payable booking"""
    db = get_database()
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["customer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if auction["status"] not in ["active", "quote_selected"]:
        raise HTTPException(status_code=400, detail=f"Auction is {auction['status']}")

    quote = await db.auction_quotes.find_one({"id": quote_id, "auction_id": auction_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.auction_quotes.update_one({"id": quote_id}, {"$set": {"status": "selected", "selected_at": now}})
    await db.auction_quotes.update_many(
        {"auction_id": auction_id, "id": {"$ne": quote_id}},
        {"$set": {"status": "rejected", "rejected_at": now}}
    )
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"status": "quote_selected", "selected_quote_id": quote_id, "selected_at": now}}
    )

    booking = await _create_payable_booking(db, current_user, "auction", {
        "aircraft_type": auction.get("aircraft_category"),
        "aircraft_id": quote.get("aircraft_id"),
        "aircraft_model": quote.get("aircraft_model") or quote.get("aircraft_type"),
        "operator_id": quote.get("operator_id"),
        "operator_name": quote.get("operator_name"),
        "from_location": auction.get("origin"),
        "to_location": auction.get("destination"),
        "travel_date": auction.get("travel_date"),
        "travel_time": auction.get("travel_time"),
        "passengers": auction.get("passengers", 1),
        "distance_km": auction.get("distance_km"),
        "pricing_breakdown": {"base_fare": quote.get("base_price", quote["total_amount"]),
                              "ferry_charge": quote.get("ferry_charge", 0),
                              "total": quote["total_amount"], "pricing_model": "reverse_auction"},
        "total": quote["total_amount"],
        "consents_accepted": body.consents_accepted,
    })

    return {
        "success": True,
        "booking_id": booking["id"],
        "booking_number": booking["inquiry_number"],
        "total_amount": booking["final_price"],
        "price_lock_expires_at": booking["price_lock_expires_at"],
        "payment_url": f"/customer/payment/{booking['id']}",
        "message": "Quote accepted! Complete payment within 15 minutes.",
    }
