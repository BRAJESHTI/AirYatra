"""
Favorites/Bookmarks Routes
User can pin menu items and save favorites
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from database import get_database

router = APIRouter(prefix="/favorites", tags=["favorites"])

class FavoriteItem(BaseModel):
    item_type: str  # menu, page, route, search, report
    item_id: str
    label: str
    path: str
    icon: Optional[str] = None
    metadata: Optional[dict] = {}

class FavoriteUpdate(BaseModel):
    label: Optional[str] = None
    order: Optional[int] = None

def serialize_favorite(fav):
    fav["_id"] = str(fav["_id"])
    if "user_id" in fav:
        fav["user_id"] = str(fav["user_id"])
    return fav

# Add favorite
@router.post("/add")
async def add_favorite(user_id: str, item: FavoriteItem):
    db = get_database()
    
    # Check if already favorited
    existing = await db.favorites.find_one({
        "user_id": user_id,
        "item_id": item.item_id,
        "item_type": item.item_type
    })
    
    if existing:
        return {"success": False, "message": "Already in favorites", "favorite": serialize_favorite(existing)}
    
    # Get max order
    max_order_doc = await db.favorites.find_one(
        {"user_id": user_id},
        sort=[("order", -1)]
    )
    max_order = max_order_doc.get("order", 0) if max_order_doc else 0
    
    favorite = {
        "user_id": user_id,
        "item_type": item.item_type,
        "item_id": item.item_id,
        "label": item.label,
        "path": item.path,
        "icon": item.icon,
        "metadata": item.metadata,
        "order": max_order + 1,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.favorites.insert_one(favorite)
    favorite["_id"] = str(result.inserted_id)
    
    return {"success": True, "message": "Added to favorites", "favorite": favorite}

# Remove favorite
@router.delete("/remove/{favorite_id}")
async def remove_favorite(favorite_id: str):
    db = get_database()
    
    result = await db.favorites.delete_one({"_id": ObjectId(favorite_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    return {"success": True, "message": "Removed from favorites"}

# Remove by item
@router.delete("/remove-item")
async def remove_favorite_by_item(user_id: str, item_type: str, item_id: str):
    db = get_database()
    
    result = await db.favorites.delete_one({
        "user_id": user_id,
        "item_type": item_type,
        "item_id": item_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    return {"success": True, "message": "Removed from favorites"}

# Get user favorites
@router.get("/user/{user_id}")
async def get_user_favorites(user_id: str, item_type: Optional[str] = None):
    db = get_database()
    
    query = {"user_id": user_id}
    if item_type:
        query["item_type"] = item_type
    
    favorites = await db.favorites.find(query).sort("order", 1).to_list(length=100)
    
    return {
        "favorites": [serialize_favorite(f) for f in favorites],
        "count": len(favorites)
    }

# Reorder favorites
@router.put("/reorder")
async def reorder_favorites(user_id: str, ordered_ids: List[str]):
    db = get_database()
    
    for i, fav_id in enumerate(ordered_ids):
        await db.favorites.update_one(
            {"_id": ObjectId(fav_id), "user_id": user_id},
            {"$set": {"order": i + 1}}
        )
    
    return {"success": True, "message": "Favorites reordered"}

# Update favorite
@router.put("/{favorite_id}")
async def update_favorite(favorite_id: str, update: FavoriteUpdate):
    db = get_database()
    
    update_data = {}
    if update.label:
        update_data["label"] = update.label
    if update.order is not None:
        update_data["order"] = update.order
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.favorites.update_one(
        {"_id": ObjectId(favorite_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    return {"success": True, "message": "Favorite updated"}

# Check if item is favorited
@router.get("/check")
async def check_favorite(user_id: str, item_type: str, item_id: str):
    db = get_database()
    
    favorite = await db.favorites.find_one({
        "user_id": user_id,
        "item_type": item_type,
        "item_id": item_id
    })
    
    return {
        "is_favorite": favorite is not None,
        "favorite": serialize_favorite(favorite) if favorite else None
    }

# Get pinned menu items
@router.get("/pinned-menu/{user_id}")
async def get_pinned_menu(user_id: str):
    db = get_database()
    
    favorites = await db.favorites.find({
        "user_id": user_id,
        "item_type": "menu"
    }).sort("order", 1).to_list(length=20)
    
    return {
        "pinned_items": [serialize_favorite(f) for f in favorites],
        "count": len(favorites)
    }

# Quick add common items
@router.post("/quick-add/{user_id}")
async def quick_add_favorites(user_id: str, preset: str):
    db = get_database()
    
    presets = {
        "admin": [
            {"item_type": "menu", "item_id": "dashboard", "label": "Dashboard", "path": "/admin", "icon": "LayoutDashboard"},
            {"item_type": "menu", "item_id": "bookings", "label": "Bookings", "path": "/admin/bookings", "icon": "Calendar"},
            {"item_type": "menu", "item_id": "command-center", "label": "Command Center", "path": "/command-center", "icon": "Radio"},
            {"item_type": "menu", "item_id": "ai-pricing", "label": "AI Pricing", "path": "/ai-pricing", "icon": "Sparkles"}
        ],
        "operator": [
            {"item_type": "menu", "item_id": "dashboard", "label": "Dashboard", "path": "/operator", "icon": "LayoutDashboard"},
            {"item_type": "menu", "item_id": "fleet", "label": "Fleet", "path": "/operator/fleet", "icon": "Plane"},
            {"item_type": "menu", "item_id": "bookings", "label": "Bookings", "path": "/operator/bookings", "icon": "Calendar"}
        ],
        "customer": [
            {"item_type": "menu", "item_id": "dashboard", "label": "My Dashboard", "path": "/customer", "icon": "LayoutDashboard"},
            {"item_type": "menu", "item_id": "book", "label": "Book Flight", "path": "/booking", "icon": "Plane"},
            {"item_type": "menu", "item_id": "history", "label": "Booking History", "path": "/customer/bookings", "icon": "History"}
        ]
    }
    
    if preset not in presets:
        raise HTTPException(status_code=400, detail="Invalid preset")
    
    added = 0
    for i, item in enumerate(presets[preset]):
        existing = await db.favorites.find_one({
            "user_id": user_id,
            "item_id": item["item_id"],
            "item_type": item["item_type"]
        })
        
        if not existing:
            await db.favorites.insert_one({
                **item,
                "user_id": user_id,
                "order": i + 1,
                "metadata": {},
                "created_at": datetime.now(timezone.utc)
            })
            added += 1
    
    return {"success": True, "message": f"Added {added} favorites", "added": added}
