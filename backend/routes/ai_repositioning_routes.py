"""
AI Repositioning Engine Routes
From Document [4] - Mode-1 Fixed Route + Mode-2 Reverse Auction
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import get_current_user, require_roles
from models import (
    AIRepositioningEngine, RepositioningEngineSettings,
    FixedRoute, FixedRouteCreate, FixedRouteStatus,
    ReverseAuction, ReverseAuctionCreate, AuctionBid, AuctionBidCreate,
    AuctionStatus, BidStatus, PricingMode, FerryChargeType,
    FerryCalculationRequest, FerryCalculationResult
)
import uuid
import logging
from math import radians, sin, cos, sqrt, atan2

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/repositioning", tags=["AI Repositioning Engine"])


# ============ HELPER FUNCTIONS ============

def calculate_distance(coord1: dict, coord2: dict) -> float:
    """Haversine distance calculation"""
    lat1, lon1 = radians(coord1.get('lat', 0)), radians(coord1.get('lng', 0))
    lat2, lon2 = radians(coord2.get('lat', 0)), radians(coord2.get('lng', 0))
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return round(6371 * c, 2)


async def get_engine_settings():
    """Get repositioning engine settings"""
    db = get_database()
    engine = await db.repositioning_engine.find_one(
        {"engine_id": "default_repositioning_engine"},
        {"_id": 0}
    )
    if not engine:
        engine = {
            "engine_id": "default_repositioning_engine",
            "settings": RepositioningEngineSettings().dict(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.repositioning_engine.insert_one(engine)
    return engine


async def notify_operators_for_auction(auction_id: str, auction_data: dict):
    """Background task to notify eligible operators"""
    db = get_database()
    
    # Find operators with aircraft that can serve this route
    aircraft_type = auction_data.get('aircraft_type')
    origin_coords = auction_data.get('origin_coordinates', {})
    
    query = {"status": "approved", "is_active": True}
    if aircraft_type:
        query["aircraft_types"] = aircraft_type
    
    operators = await db.operators.find(query, {"_id": 0}).to_list(length=100)
    
    notified_count = 0
    for operator in operators:
        # Create notification
        notification = {
            "id": str(uuid.uuid4()),
            "type": "auction_opportunity",
            "user_id": operator.get("user_id"),
            "title": "New Auction Opportunity",
            "title_hi": "नई नीलामी का अवसर",
            "message": f"New booking request: {auction_data.get('origin')} → {auction_data.get('destination')}",
            "data": {
                "auction_id": auction_id,
                "route": f"{auction_data.get('origin')} → {auction_data.get('destination')}",
                "date": auction_data.get('journey_date'),
                "passengers": auction_data.get('passengers')
            },
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        notified_count += 1
    
    # Update auction with notification count
    await db.reverse_auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {"operators_notified": notified_count, "operators_eligible": len(operators)}}
    )
    
    logger.info(f"Notified {notified_count} operators for auction {auction_id}")


# ============ ENGINE SETTINGS ============

@router.get("/settings")
async def get_settings():
    """Get repositioning engine public settings"""
    engine = await get_engine_settings()
    settings = engine.get("settings", {})
    
    return {
        "default_mode": settings.get("default_mode", "hybrid"),
        "fixed_route_enabled": settings.get("fixed_route_enabled", True),
        "reverse_auction_enabled": settings.get("reverse_auction_enabled", True),
        "default_auction_duration_minutes": settings.get("default_auction_duration_minutes", 60),
        "bid_timeout_seconds": settings.get("bid_timeout_seconds", 300),
        "ferry_rate_per_km": settings.get("ferry_rate_per_km", 50)
    }


@router.put("/admin/settings")
async def update_settings(
    settings: RepositioningEngineSettings,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update engine settings (admin only)"""
    db = get_database()
    
    await db.repositioning_engine.update_one(
        {"engine_id": "default_repositioning_engine"},
        {
            "$set": {
                "settings": settings.dict(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"]
            }
        },
        upsert=True
    )
    
    return {"success": True, "message": "Settings updated"}


# ============ MODE-1: FIXED ROUTES ============

@router.post("/fixed-routes")
async def create_fixed_route(
    route: FixedRouteCreate,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Create new fixed route for instant booking"""
    db = get_database()
    
    # Generate route code
    origin_code = route.origin[:3].upper()
    dest_code = route.destination[:3].upper()
    count = await db.fixed_routes.count_documents({}) + 1
    route_code = f"FXR-{origin_code}-{dest_code}-{count:03d}"
    
    # Calculate estimated duration
    estimated_duration = int((route.distance_km / 200) * 60)  # Assume 200 km/h
    
    fixed_route = {
        "id": str(uuid.uuid4()),
        "route_code": route_code,
        "route_name": route.route_name,
        "route_name_hi": route.route_name_hi,
        "origin": route.origin,
        "origin_coordinates": route.origin_coordinates,
        "destination": route.destination,
        "destination_coordinates": route.destination_coordinates,
        "distance_km": route.distance_km,
        "estimated_duration_minutes": estimated_duration,
        "base_price": route.base_price,
        "price_per_seat": route.price_per_seat,
        "current_price": route.base_price,
        "min_passengers": route.min_passengers,
        "max_passengers": route.max_passengers,
        "demand_multiplier": 1.0,
        "seasonal_multiplier": 1.0,
        "time_multiplier": 1.0,
        "available_days": route.available_days,
        "departure_times": route.departure_times,
        "advance_booking_hours": route.advance_booking_hours,
        "aircraft_type": route.aircraft_type,
        "operator_id": route.operator_id or current_user.get("operator_id"),
        "aircraft_ids": route.aircraft_ids,
        "seats_available": route.max_passengers,
        "bookings_today": 0,
        "total_bookings": 0,
        "ferry_included": route.ferry_included,
        "ferry_charge_type": route.ferry_charge_type.value,
        "ferry_charge_value": route.ferry_charge_value,
        "status": "active",
        "valid_from": route.valid_from,
        "valid_until": route.valid_until,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "popularity_score": 0,
        "average_rating": 0,
        "total_revenue": 0
    }
    
    await db.fixed_routes.insert_one(fixed_route)
    fixed_route.pop('_id', None)
    
    return {
        "success": True,
        "message": f"Fixed route {route_code} created",
        "route": fixed_route
    }


@router.get("/fixed-routes")
async def list_fixed_routes(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    aircraft_type: Optional[str] = None,
    date: Optional[str] = None,
    status: str = "active",
    limit: int = Query(20, le=100)
):
    """List available fixed routes"""
    db = get_database()
    
    query = {"status": status}
    if origin:
        query["origin"] = {"$regex": origin, "$options": "i"}
    if destination:
        query["destination"] = {"$regex": destination, "$options": "i"}
    if aircraft_type:
        query["aircraft_type"] = aircraft_type
    
    # Check validity dates
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query["valid_from"] = {"$lte": today}
    query["valid_until"] = {"$gte": today}
    
    routes = await db.fixed_routes.find(
        query,
        {"_id": 0}
    ).sort("popularity_score", -1).limit(limit).to_list(length=limit)
    
    return {
        "routes": routes,
        "total": len(routes),
        "filters": {"origin": origin, "destination": destination, "aircraft_type": aircraft_type}
    }


@router.get("/fixed-routes/{route_code}")
async def get_fixed_route(route_code: str):
    """Get fixed route details"""
    db = get_database()
    
    route = await db.fixed_routes.find_one(
        {"route_code": route_code},
        {"_id": 0}
    )
    
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return route


@router.post("/fixed-routes/{route_code}/book")
async def book_fixed_route(
    route_code: str,
    passengers: int = 1,
    departure_date: str = None,
    departure_time: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Book a seat on fixed route (instant booking)"""
    db = get_database()
    
    route = await db.fixed_routes.find_one({"route_code": route_code}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    if route.get("status") != "active":
        raise HTTPException(status_code=400, detail="Route is not available for booking")
    
    if route.get("seats_available", 0) < passengers:
        raise HTTPException(status_code=400, detail="Not enough seats available")
    
    # Calculate price
    total_price = route.get("current_price", route.get("base_price", 0))
    if route.get("price_per_seat"):
        total_price = route.get("price_per_seat") * passengers
    
    # Create booking
    booking_ref = f"FXB-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    
    booking = {
        "id": str(uuid.uuid4()),
        "booking_ref": booking_ref,
        "booking_type": "fixed_route",
        "route_code": route_code,
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name"),
        "customer_email": current_user.get("email"),
        "origin": route.get("origin"),
        "destination": route.get("destination"),
        "distance_km": route.get("distance_km"),
        "passengers": passengers,
        "departure_date": departure_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "departure_time": departure_time or route.get("departure_times", ["09:00"])[0],
        "aircraft_type": route.get("aircraft_type"),
        "operator_id": route.get("operator_id"),
        "base_price": route.get("base_price"),
        "total_price": total_price,
        "ferry_included": route.get("ferry_included"),
        "status": "confirmed",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.fixed_route_bookings.insert_one(booking)
    
    # Update route availability
    await db.fixed_routes.update_one(
        {"route_code": route_code},
        {
            "$inc": {
                "seats_available": -passengers,
                "bookings_today": 1,
                "total_bookings": 1,
                "total_revenue": total_price
            }
        }
    )
    
    booking.pop('_id', None)
    
    return {
        "success": True,
        "message": "Booking confirmed! / बुकिंग कन्फर्म!",
        "booking": booking,
        "payment_required": True,
        "payment_amount": total_price
    }


# ============ MODE-2: REVERSE AUCTION ============

@router.post("/auctions/create")
async def create_auction(
    request: ReverseAuctionCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Create reverse auction - operators will bid
    From Document [4] - Mode-2
    """
    db = get_database()
    engine = await get_engine_settings()
    settings = engine.get("settings", {})
    
    if not settings.get("reverse_auction_enabled", True):
        raise HTTPException(status_code=400, detail="Reverse auctions are currently disabled")
    
    # Validate duration
    min_dur = settings.get("min_auction_duration_minutes", 15)
    max_dur = settings.get("max_auction_duration_minutes", 480)
    duration = max(min_dur, min(max_dur, request.auction_duration_minutes))
    
    # Calculate distance
    distance_km = calculate_distance(request.origin_coordinates, request.destination_coordinates)
    
    # Generate auction ID
    auction_id = str(uuid.uuid4())
    auction_number = f"AUC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    
    now = datetime.now(timezone.utc)
    ends_at = now + timedelta(minutes=duration)
    
    auction = {
        "id": auction_id,
        "auction_id": auction_id,
        "auction_number": auction_number,
        "customer_id": current_user["id"],
        "customer_name": current_user.get("full_name"),
        "origin": request.origin,
        "origin_coordinates": request.origin_coordinates,
        "destination": request.destination,
        "destination_coordinates": request.destination_coordinates,
        "distance_km": distance_km,
        "journey_date": request.journey_date,
        "preferred_time": request.preferred_time,
        "flexible_time": request.flexible_time,
        "passengers": request.passengers,
        "aircraft_type": request.aircraft_type,
        "max_budget": request.max_budget,
        "auction_duration_minutes": duration,
        "started_at": now.isoformat(),
        "ends_at": ends_at.isoformat(),
        "bids": [],
        "total_bids": 0,
        "lowest_bid": None,
        "highest_bid": None,
        "auto_accept_lowest": request.auto_accept_lowest,
        "selected_bid_id": None,
        "selected_operator_id": None,
        "status": "active",
        "operators_notified": 0,
        "operators_eligible": 0,
        "special_requirements": request.special_requirements,
        "created_at": now.isoformat()
    }
    
    await db.reverse_auctions.insert_one(auction)
    
    # Notify operators in background
    if request.notify_all_operators:
        background_tasks.add_task(notify_operators_for_auction, auction_id, auction)
    
    auction.pop('_id', None)
    
    return {
        "success": True,
        "message": "Auction created! Operators will start bidding soon.",
        "message_hi": "नीलामी शुरू! ऑपरेटर जल्द ही बोली लगाएंगे।",
        "auction": auction
    }


@router.post("/auctions/{auction_id}/bid")
async def place_bid(
    auction_id: str,
    bid: AuctionBidCreate,
    current_user: dict = Depends(require_roles(["operator"]))
):
    """Operator places bid on auction"""
    db = get_database()
    
    # Get auction
    auction = await db.reverse_auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.get("status") != "active":
        raise HTTPException(status_code=400, detail="Auction is no longer accepting bids")
    
    # Check if auction has ended
    ends_at = datetime.fromisoformat(auction.get("ends_at").replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > ends_at:
        raise HTTPException(status_code=400, detail="Auction has ended")
    
    # Get operator info
    operator = await db.operators.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0, "id": 1, "company_name": 1}
    )
    if not operator:
        raise HTTPException(status_code=400, detail="Operator profile not found")
    
    # Verify aircraft belongs to operator
    aircraft = await db.aircraft_catalog.find_one(
        {"id": bid.aircraft_id, "operator_id": operator["id"]},
        {"_id": 0}
    )
    if not aircraft:
        aircraft = await db.aircraft.find_one(
            {"id": bid.aircraft_id, "operator_id": operator["id"]},
            {"_id": 0}
        )
    if not aircraft:
        raise HTTPException(status_code=400, detail="Aircraft not found or doesn't belong to you")
    
    # Create bid
    bid_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    valid_until = now + timedelta(minutes=bid.valid_for_minutes)
    
    new_bid = {
        "id": bid_id,
        "bid_id": bid_id,
        "auction_id": auction_id,
        "operator_id": operator["id"],
        "operator_name": operator.get("company_name"),
        "aircraft_id": bid.aircraft_id,
        "aircraft_details": {
            "model": aircraft.get("basic_info", {}).get("model") or aircraft.get("model"),
            "type": aircraft.get("aircraft_type"),
            "capacity": aircraft.get("passenger_capacity") or aircraft.get("basic_info", {}).get("passenger_capacity")
        },
        "bid_amount": bid.bid_amount,
        "original_amount": bid.bid_amount,
        "estimated_arrival_minutes": bid.estimated_arrival_minutes,
        "ferry_cost_included": True,
        "status": "pending",
        "rank": 0,
        "bid_at": now.isoformat(),
        "valid_until": valid_until.isoformat(),
        "notes": bid.notes
    }
    
    # Update auction with new bid
    all_bids = auction.get("bids", []) + [new_bid]
    
    # Sort bids and assign ranks
    sorted_bids = sorted(all_bids, key=lambda x: x.get("bid_amount", float('inf')))
    for i, b in enumerate(sorted_bids):
        b["rank"] = i + 1
    
    lowest_bid = sorted_bids[0]["bid_amount"] if sorted_bids else None
    highest_bid = sorted_bids[-1]["bid_amount"] if sorted_bids else None
    
    await db.reverse_auctions.update_one(
        {"auction_id": auction_id},
        {
            "$set": {
                "bids": sorted_bids,
                "total_bids": len(sorted_bids),
                "lowest_bid": lowest_bid,
                "highest_bid": highest_bid,
                "status": "bidding",
                "updated_at": now.isoformat()
            }
        }
    )
    
    # Check auto-accept
    if auction.get("auto_accept_lowest") and new_bid["rank"] == 1:
        # Auto accept this bid
        await db.reverse_auctions.update_one(
            {"auction_id": auction_id},
            {
                "$set": {
                    "selected_bid_id": bid_id,
                    "selected_operator_id": operator["id"],
                    "final_price": bid.bid_amount,
                    "status": "completed",
                    "completed_at": now.isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Bid placed and auto-accepted! You won the auction.",
            "message_hi": "बोली लगाई और ऑटो-स्वीकृत! आपने नीलामी जीती।",
            "bid": new_bid,
            "auto_accepted": True
        }
    
    return {
        "success": True,
        "message": f"Bid placed successfully! Current rank: {new_bid['rank']}",
        "message_hi": f"बोली सफलतापूर्वक लगाई! वर्तमान रैंक: {new_bid['rank']}",
        "bid": new_bid,
        "total_bids": len(sorted_bids),
        "your_rank": new_bid["rank"]
    }


@router.get("/auctions/{auction_id}")
async def get_auction(
    auction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get auction details"""
    db = get_database()
    
    auction = await db.reverse_auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Hide other operators' bids details for operators
    if "operator" in current_user.get("roles", []):
        operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0, "id": 1})
        if operator:
            # Only show own bids fully, mask others
            masked_bids = []
            for bid in auction.get("bids", []):
                if bid.get("operator_id") == operator["id"]:
                    masked_bids.append(bid)
                else:
                    masked_bids.append({
                        "rank": bid.get("rank"),
                        "bid_amount": bid.get("bid_amount"),
                        "operator_name": "***",
                        "status": bid.get("status")
                    })
            auction["bids"] = masked_bids
    
    return auction


@router.post("/auctions/{auction_id}/select/{bid_id}")
async def select_winning_bid(
    auction_id: str,
    bid_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Customer selects winning bid"""
    db = get_database()
    
    auction = await db.reverse_auctions.find_one({"auction_id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.get("customer_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your auction")
    
    if auction.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Auction already completed")
    
    # Find the bid
    winning_bid = None
    for bid in auction.get("bids", []):
        if bid.get("bid_id") == bid_id:
            winning_bid = bid
            break
    
    if not winning_bid:
        raise HTTPException(status_code=404, detail="Bid not found")
    
    now = datetime.now(timezone.utc)
    
    # Update auction
    await db.reverse_auctions.update_one(
        {"auction_id": auction_id},
        {
            "$set": {
                "selected_bid_id": bid_id,
                "selected_operator_id": winning_bid.get("operator_id"),
                "final_price": winning_bid.get("bid_amount"),
                "status": "completed",
                "completed_at": now.isoformat()
            }
        }
    )
    
    # Update bid status
    for bid in auction.get("bids", []):
        if bid.get("bid_id") == bid_id:
            bid["status"] = "accepted"
        else:
            bid["status"] = "rejected"
    
    await db.reverse_auctions.update_one(
        {"auction_id": auction_id},
        {"$set": {"bids": auction["bids"]}}
    )
    
    # Create booking from auction
    booking_ref = f"AUB-{now.strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    
    booking = {
        "id": str(uuid.uuid4()),
        "booking_ref": booking_ref,
        "booking_type": "auction",
        "auction_id": auction_id,
        "customer_id": current_user["id"],
        "operator_id": winning_bid.get("operator_id"),
        "aircraft_id": winning_bid.get("aircraft_id"),
        "origin": auction.get("origin"),
        "destination": auction.get("destination"),
        "journey_date": auction.get("journey_date"),
        "passengers": auction.get("passengers"),
        "total_price": winning_bid.get("bid_amount"),
        "status": "confirmed",
        "payment_status": "pending",
        "created_at": now.isoformat()
    }
    
    await db.auction_bookings.insert_one(booking)
    
    return {
        "success": True,
        "message": "Bid selected! Booking created.",
        "message_hi": "बोली चुनी गई! बुकिंग बनाई गई।",
        "winning_bid": winning_bid,
        "booking_ref": booking_ref,
        "total_price": winning_bid.get("bid_amount")
    }


@router.get("/auctions/my/customer")
async def get_my_auctions_customer(
    status: Optional[str] = None,
    limit: int = Query(20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get customer's auctions"""
    db = get_database()
    
    query = {"customer_id": current_user["id"]}
    if status:
        query["status"] = status
    
    auctions = await db.reverse_auctions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    
    return {"auctions": auctions, "total": len(auctions)}


@router.get("/auctions/operator/available")
async def get_available_auctions_operator(
    aircraft_type: Optional[str] = None,
    limit: int = Query(20, le=50),
    current_user: dict = Depends(require_roles(["operator"]))
):
    """Get auctions available for bidding (operator view)"""
    db = get_database()
    
    now = datetime.now(timezone.utc).isoformat()
    
    query = {
        "status": {"$in": ["active", "bidding"]},
        "ends_at": {"$gt": now}
    }
    if aircraft_type:
        query["aircraft_type"] = aircraft_type
    
    auctions = await db.reverse_auctions.find(
        query,
        {"_id": 0}
    ).sort("ends_at", 1).limit(limit).to_list(length=limit)
    
    # Get operator's existing bids
    operator = await db.operators.find_one({"user_id": current_user["id"]}, {"_id": 0, "id": 1})
    operator_id = operator.get("id") if operator else None
    
    for auction in auctions:
        # Check if operator already bid
        my_bid = None
        for bid in auction.get("bids", []):
            if bid.get("operator_id") == operator_id:
                my_bid = bid
                break
        auction["my_bid"] = my_bid
        # Mask other bids
        auction["bids"] = [{"rank": b.get("rank"), "bid_amount": b.get("bid_amount")} for b in auction.get("bids", [])]
    
    return {"auctions": auctions, "total": len(auctions)}


# ============ FERRY CALCULATION ============

@router.post("/calculate-ferry")
async def calculate_ferry_charges(
    request: FerryCalculationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Calculate ferry/repositioning charges"""
    engine = await get_engine_settings()
    settings = engine.get("settings", {})
    
    ferry_rate = settings.get("ferry_rate_per_km", 50)
    
    # Calculate positioning distance (aircraft to pickup)
    positioning_km = calculate_distance(
        request.aircraft_current_location,
        request.pickup_location
    )
    
    # Calculate return distance (drop to base)
    return_km = 0
    if request.return_to_base and request.base_location:
        return_km = calculate_distance(
            request.drop_location,
            request.base_location
        )
    
    total_ferry_km = positioning_km + return_km
    ferry_cost = total_ferry_km * ferry_rate
    ferry_time = int((total_ferry_km / 200) * 60)  # Assume 200 km/h
    
    # Determine recommendation
    max_ferry = settings.get("max_ferry_distance_km", 300)
    if total_ferry_km <= 50:
        recommendation = "waive"
        recommendation_hi = "माफ करें (50 किमी से कम)"
    elif total_ferry_km <= max_ferry:
        recommendation = "include_in_price"
        recommendation_hi = "कीमत में शामिल करें"
    else:
        recommendation = "charge_separately"
        recommendation_hi = "अलग से चार्ज करें"
    
    return {
        "positioning_distance_km": positioning_km,
        "return_distance_km": return_km,
        "total_ferry_km": total_ferry_km,
        "ferry_cost": ferry_cost,
        "ferry_time_minutes": ferry_time,
        "ferry_rate_per_km": ferry_rate,
        "recommendation": recommendation,
        "recommendation_hi": recommendation_hi
    }


# ============ ANALYTICS ============

@router.get("/analytics")
async def get_engine_analytics(
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """Get repositioning engine analytics"""
    db = get_database()
    
    # Count routes and auctions
    active_routes = await db.fixed_routes.count_documents({"status": "active"})
    total_routes = await db.fixed_routes.count_documents({})
    
    active_auctions = await db.reverse_auctions.count_documents({"status": {"$in": ["active", "bidding"]}})
    completed_auctions = await db.reverse_auctions.count_documents({"status": "completed"})
    
    # Bookings stats
    fixed_bookings = await db.fixed_route_bookings.count_documents({})
    auction_bookings = await db.auction_bookings.count_documents({})
    
    return {
        "fixed_routes": {
            "active": active_routes,
            "total": total_routes
        },
        "auctions": {
            "active": active_auctions,
            "completed": completed_auctions
        },
        "bookings": {
            "via_fixed_routes": fixed_bookings,
            "via_auctions": auction_bookings,
            "total": fixed_bookings + auction_bookings
        }
    }
