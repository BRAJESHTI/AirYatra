"""
AirYatra Blog & Investor Routes
Blog posts for SEO and Investor Interest capture
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
import uuid
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/content", tags=["Content & Blog"])


# ============ MODELS ============

class BlogPost(BaseModel):
    title: str
    title_hi: Optional[str] = None
    slug: str
    excerpt: str
    content: str
    category: str  # news, tips, industry, guides
    featured_image: Optional[str] = None
    tags: List[str] = []
    author_name: str = "AirYatra Team"
    is_published: bool = False


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    title_hi: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    featured_image: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None


class InvestorInterest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    company_name: Optional[str] = None
    investment_range: str  # "1-5L", "5-25L", "25L-1Cr", "1Cr+"
    message: Optional[str] = None


class Testimonial(BaseModel):
    customer_name: str
    designation: Optional[str] = None
    company: Optional[str] = None
    rating: int  # 1-5
    review: str
    photo_url: Optional[str] = None
    is_featured: bool = True


class FleetAircraft(BaseModel):
    name: str
    type: str  # jet, helicopter, turboprop
    model: str
    capacity: int
    range_km: int
    speed_kmh: int
    image_url: str
    features: List[str] = []
    hourly_rate: Optional[str] = None
    is_available: bool = True


# ============ BLOG ENDPOINTS ============

@router.get("/blog")
async def get_blog_posts(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 10
):
    """Get published blog posts - PUBLIC"""
    db = get_database()
    
    query = {"is_published": True}
    
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"excerpt": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
    
    posts = await db.blog_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.blog_posts.count_documents(query)
    
    return {
        "posts": posts,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/blog/{slug}")
async def get_blog_post(slug: str):
    """Get single blog post by slug - PUBLIC"""
    db = get_database()
    
    post = await db.blog_posts.find_one(
        {"slug": slug, "is_published": True},
        {"_id": 0}
    )
    
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    # Increment view count
    await db.blog_posts.update_one(
        {"slug": slug},
        {"$inc": {"views": 1}}
    )
    
    return post


@router.post("/blog")
async def create_blog_post(
    post: BlogPost,
    current_user: dict = Depends(get_current_user)
):
    """Create new blog post - ADMIN ONLY"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Check slug uniqueness
    existing = await db.blog_posts.find_one({"slug": post.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already exists")
    
    post_data = post.dict()
    post_data["id"] = f"blog_{uuid.uuid4().hex[:12]}"
    post_data["created_at"] = datetime.now(timezone.utc).isoformat()
    post_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    post_data["author_id"] = current_user["id"]
    post_data["views"] = 0
    
    await db.blog_posts.insert_one(post_data)
    
    return {"success": True, "id": post_data["id"], "message": "Blog post created"}


@router.put("/blog/{post_id}")
async def update_blog_post(
    post_id: str,
    update: BlogPostUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update blog post - ADMIN ONLY"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.blog_posts.update_one(
        {"id": post_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    return {"success": True, "message": "Blog post updated"}


@router.delete("/blog/{post_id}")
async def delete_blog_post(
    post_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete blog post - ADMIN ONLY"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    result = await db.blog_posts.delete_one({"id": post_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    return {"success": True, "message": "Blog post deleted"}


# ============ INVESTOR INTEREST ENDPOINTS ============

@router.post("/investor-interest")
async def submit_investor_interest(interest: InvestorInterest):
    """Submit investor interest form - PUBLIC"""
    db = get_database()
    
    interest_data = interest.dict()
    interest_data["id"] = f"inv_{uuid.uuid4().hex[:12]}"
    interest_data["created_at"] = datetime.now(timezone.utc).isoformat()
    interest_data["status"] = "new"  # new, contacted, qualified, converted, rejected
    interest_data["notes"] = []
    
    await db.investor_interests.insert_one(interest_data)
    
    # Create notification for CEO and Admin
    notification = {
        "id": f"notif_{uuid.uuid4().hex[:8]}",
        "type": "investor_interest",
        "title": "New Investor Interest!",
        "message": f"{interest.full_name} ({interest.company_name or 'Individual'}) is interested in investing {interest.investment_range}",
        "data": {
            "investor_id": interest_data["id"],
            "name": interest.full_name,
            "email": interest.email,
            "investment_range": interest.investment_range
        },
        "for_roles": ["admin", "ceo"],
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "severity": "high"
    }
    await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "message": "Thank you for your interest! Our team will contact you shortly.",
        "reference_id": interest_data["id"]
    }


@router.get("/investor-interests")
async def get_investor_interests(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get investor interests - CEO/ADMIN ONLY"""
    allowed_roles = ["admin", "ceo"]
    if not any(role in current_user.get("roles", []) for role in allowed_roles):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    interests = await db.investor_interests.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.investor_interests.count_documents(query)
    
    return {
        "interests": interests,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.put("/investor-interest/{interest_id}")
async def update_investor_interest(
    interest_id: str,
    status: str,
    note: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update investor interest status - CEO/ADMIN ONLY"""
    allowed_roles = ["admin", "ceo"]
    if not any(role in current_user.get("roles", []) for role in allowed_roles):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user["id"]
    }
    
    if note:
        await db.investor_interests.update_one(
            {"id": interest_id},
            {
                "$set": update_data,
                "$push": {
                    "notes": {
                        "text": note,
                        "by": current_user["email"],
                        "at": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
    else:
        await db.investor_interests.update_one(
            {"id": interest_id},
            {"$set": update_data}
        )
    
    return {"success": True, "message": "Investor interest updated"}


# ============ TESTIMONIALS ENDPOINTS ============

@router.get("/testimonials")
async def get_testimonials(featured_only: bool = True):
    """Get testimonials - PUBLIC"""
    db = get_database()
    
    query = {"is_featured": True} if featured_only else {}
    testimonials = await db.testimonials.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {"testimonials": testimonials}


@router.post("/testimonials")
async def create_testimonial(
    testimonial: Testimonial,
    current_user: dict = Depends(get_current_user)
):
    """Create testimonial - ADMIN ONLY"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    data = testimonial.dict()
    data["id"] = f"test_{uuid.uuid4().hex[:8]}"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["created_by"] = current_user["id"]
    
    await db.testimonials.insert_one(data)
    
    return {"success": True, "id": data["id"]}


@router.delete("/testimonials/{testimonial_id}")
async def delete_testimonial(
    testimonial_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete testimonial - ADMIN ONLY"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    await db.testimonials.delete_one({"id": testimonial_id})
    
    return {"success": True}


# ============ FLEET GALLERY ENDPOINTS ============

@router.get("/fleet")
async def get_fleet(
    aircraft_type: Optional[str] = None,
    available_only: bool = False
):
    """Get fleet gallery - PUBLIC"""
    db = get_database()
    
    query = {}
    if aircraft_type:
        query["type"] = aircraft_type
    if available_only:
        query["is_available"] = True
    
    aircraft = await db.fleet_gallery.find(query, {"_id": 0}).sort("name", 1).to_list(100)
    
    # Get unique types for filtering
    types = await db.fleet_gallery.distinct("type")
    
    return {
        "aircraft": aircraft,
        "types": types,
        "total": len(aircraft)
    }


@router.post("/fleet")
async def add_fleet_aircraft(
    aircraft: FleetAircraft,
    current_user: dict = Depends(get_current_user)
):
    """Add aircraft to fleet gallery - ADMIN/OPERATOR"""
    allowed_roles = ["admin", "operator"]
    if not any(role in current_user.get("roles", []) for role in allowed_roles):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    data = aircraft.dict()
    data["id"] = f"fleet_{uuid.uuid4().hex[:8]}"
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["created_by"] = current_user["id"]
    
    await db.fleet_gallery.insert_one(data)
    
    return {"success": True, "id": data["id"]}


@router.put("/fleet/{aircraft_id}")
async def update_fleet_aircraft(
    aircraft_id: str,
    is_available: Optional[bool] = None,
    hourly_rate: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update fleet aircraft - ADMIN/OPERATOR"""
    allowed_roles = ["admin", "operator"]
    if not any(role in current_user.get("roles", []) for role in allowed_roles):
        raise HTTPException(status_code=403, detail="Access denied")
    
    db = get_database()
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if is_available is not None:
        update_data["is_available"] = is_available
    if hourly_rate:
        update_data["hourly_rate"] = hourly_rate
    
    await db.fleet_gallery.update_one(
        {"id": aircraft_id},
        {"$set": update_data}
    )
    
    return {"success": True}


@router.delete("/fleet/{aircraft_id}")
async def delete_fleet_aircraft(
    aircraft_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete fleet aircraft - ADMIN ONLY"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    await db.fleet_gallery.delete_one({"id": aircraft_id})
    
    return {"success": True}
