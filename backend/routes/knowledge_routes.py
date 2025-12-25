from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])

# Models
class ArticleCreate(BaseModel):
    title: str
    title_hi: Optional[str] = None
    category: str  # getting_started, booking, payment, safety, faq, policies
    content: str
    content_hi: Optional[str] = None
    tags: List[str] = []
    is_featured: bool = False
    is_published: bool = True
    order: int = 0

class FAQCreate(BaseModel):
    question: str
    question_hi: Optional[str] = None
    answer: str
    answer_hi: Optional[str] = None
    category: str
    order: int = 0
    is_featured: bool = False

class VideoCreate(BaseModel):
    title: str
    title_hi: Optional[str] = None
    description: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    duration_seconds: int = 0
    category: str
    tags: List[str] = []

# Categories
CATEGORIES = [
    {"id": "getting_started", "name": "Getting Started", "name_hi": "शुरुआत करें", "icon": "rocket"},
    {"id": "booking", "name": "Booking & Reservations", "name_hi": "बुकिंग", "icon": "calendar"},
    {"id": "payment", "name": "Payment & Refunds", "name_hi": "भुगतान", "icon": "credit-card"},
    {"id": "safety", "name": "Safety Guidelines", "name_hi": "सुरक्षा", "icon": "shield"},
    {"id": "operators", "name": "For Operators", "name_hi": "ऑपरेटर्स के लिए", "icon": "briefcase"},
    {"id": "faq", "name": "FAQs", "name_hi": "अक्सर पूछे जाने वाले प्रश्न", "icon": "help-circle"},
    {"id": "policies", "name": "Policies & Terms", "name_hi": "नीतियां", "icon": "file-text"},
]

# Public Endpoints
@router.get("/categories")
async def get_categories():
    """Get all knowledge base categories"""
    return {"categories": CATEGORIES}

@router.get("/articles")
async def get_articles(
    category: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    limit: int = 20
):
    """Get published articles"""
    db = get_database()
    
    query = {"is_published": True}
    if category:
        query["category"] = category
    if featured is not None:
        query["is_featured"] = featured
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}}
        ]
    
    articles = await db.kb_articles.find(
        query,
        {"_id": 0, "content": 0, "content_hi": 0}  # Exclude full content in list
    ).sort("order", 1).limit(limit).to_list(limit)
    
    return {"articles": articles}

@router.get("/articles/{article_id}")
async def get_article(article_id: str):
    """Get single article"""
    db = get_database()
    
    article = await db.kb_articles.find_one(
        {"id": article_id, "is_published": True},
        {"_id": 0}
    )
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Increment view count
    await db.kb_articles.update_one(
        {"id": article_id},
        {"$inc": {"views": 1}}
    )
    
    return article

@router.get("/faqs")
async def get_faqs(
    category: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None
):
    """Get FAQs"""
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    if featured is not None:
        query["is_featured"] = featured
    if search:
        query["$or"] = [
            {"question": {"$regex": search, "$options": "i"}},
            {"answer": {"$regex": search, "$options": "i"}}
        ]
    
    faqs = await db.kb_faqs.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Group by category
    grouped = {}
    for faq in faqs:
        cat = faq.get("category", "general")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(faq)
    
    return {"faqs": faqs, "grouped": grouped}

@router.get("/videos")
async def get_videos(category: Optional[str] = None):
    """Get tutorial videos"""
    db = get_database()
    
    query = {}
    if category:
        query["category"] = category
    
    videos = await db.kb_videos.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"videos": videos}

@router.get("/search")
async def search_knowledge_base(q: str = Query(..., min_length=2)):
    """Search across all knowledge base"""
    db = get_database()
    
    results = {
        "articles": [],
        "faqs": [],
        "videos": []
    }
    
    # Search articles
    articles = await db.kb_articles.find(
        {
            "is_published": True,
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"content": {"$regex": q, "$options": "i"}}
            ]
        },
        {"_id": 0, "id": 1, "title": 1, "category": 1}
    ).limit(5).to_list(5)
    results["articles"] = articles
    
    # Search FAQs
    faqs = await db.kb_faqs.find(
        {
            "$or": [
                {"question": {"$regex": q, "$options": "i"}},
                {"answer": {"$regex": q, "$options": "i"}}
            ]
        },
        {"_id": 0, "id": 1, "question": 1, "category": 1}
    ).limit(5).to_list(5)
    results["faqs"] = faqs
    
    # Search videos
    videos = await db.kb_videos.find(
        {"title": {"$regex": q, "$options": "i"}},
        {"_id": 0, "id": 1, "title": 1, "category": 1}
    ).limit(3).to_list(3)
    results["videos"] = videos
    
    results["total"] = len(results["articles"]) + len(results["faqs"]) + len(results["videos"])
    
    return results

@router.post("/feedback/{article_id}")
async def submit_article_feedback(
    article_id: str,
    helpful: bool,
    comment: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Submit feedback on article"""
    db = get_database()
    
    feedback = {
        "id": str(uuid4()),
        "article_id": article_id,
        "user_id": current_user["id"],
        "helpful": helpful,
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.kb_feedback.insert_one(feedback)
    
    # Update article stats
    update_field = "helpful_count" if helpful else "not_helpful_count"
    await db.kb_articles.update_one(
        {"id": article_id},
        {"$inc": {update_field: 1}}
    )
    
    return {"message": "Feedback submitted"}

# Admin Endpoints
@router.post("/admin/articles")
async def create_article(article: ArticleCreate, current_user: dict = Depends(get_current_user)):
    """Create article (admin)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    article_data = {
        "id": str(uuid4()),
        "slug": article.title.lower().replace(" ", "-")[:50],
        **article.dict(),
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.kb_articles.insert_one(article_data)
    article_data.pop("_id", None)
    
    return {"message": "Article created", "article": article_data}

@router.post("/admin/faqs")
async def create_faq(faq: FAQCreate, current_user: dict = Depends(get_current_user)):
    """Create FAQ (admin)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    faq_data = {
        "id": str(uuid4()),
        **faq.dict(),
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.kb_faqs.insert_one(faq_data)
    faq_data.pop("_id", None)
    
    return {"message": "FAQ created", "faq": faq_data}

@router.post("/admin/videos")
async def create_video(video: VideoCreate, current_user: dict = Depends(get_current_user)):
    """Add video (admin)"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    video_data = {
        "id": str(uuid4()),
        **video.dict(),
        "views": 0,
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.kb_videos.insert_one(video_data)
    video_data.pop("_id", None)
    
    return {"message": "Video added", "video": video_data}

@router.get("/admin/stats")
async def get_kb_stats(current_user: dict = Depends(get_current_user)):
    """Get knowledge base stats"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    articles_count = await db.kb_articles.count_documents({})
    faqs_count = await db.kb_faqs.count_documents({})
    videos_count = await db.kb_videos.count_documents({})
    
    # Total views
    pipeline = [{"$group": {"_id": None, "total_views": {"$sum": "$views"}}}]
    views_result = await db.kb_articles.aggregate(pipeline).to_list(1)
    total_views = views_result[0]["total_views"] if views_result else 0
    
    # Most viewed
    most_viewed = await db.kb_articles.find(
        {"is_published": True},
        {"_id": 0, "id": 1, "title": 1, "views": 1}
    ).sort("views", -1).limit(5).to_list(5)
    
    return {
        "total_articles": articles_count,
        "total_faqs": faqs_count,
        "total_videos": videos_count,
        "total_views": total_views,
        "most_viewed_articles": most_viewed
    }
