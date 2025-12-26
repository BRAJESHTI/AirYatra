"""
API Response Optimization Utilities
- Field selection (sparse responses)
- Pagination helpers
- Response compression hints
"""

from typing import List, Optional, Dict, Any
from fastapi import Query


# ==================== FIELD SELECTION ====================
def get_projection(fields: Optional[str] = None, exclude_id: bool = True) -> Dict:
    """
    Create MongoDB projection from comma-separated field list
    Usage: ?fields=name,email,phone
    """
    projection = {"_id": 0} if exclude_id else {}
    
    if fields:
        for field in fields.split(","):
            field = field.strip()
            if field and field != "_id":
                projection[field] = 1
    
    return projection


# ==================== PAGINATION ====================
class PaginationParams:
    """Standard pagination parameters"""
    
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        limit: int = Query(20, ge=1, le=100, description="Items per page"),
        sort_by: Optional[str] = Query(None, description="Sort field"),
        sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order")
    ):
        self.page = page
        self.limit = limit
        self.skip = (page - 1) * limit
        self.sort_by = sort_by
        self.sort_order = -1 if sort_order == "desc" else 1
    
    def get_sort(self, default_field: str = "created_at") -> List:
        """Get MongoDB sort specification"""
        field = self.sort_by or default_field
        return [(field, self.sort_order)]
    
    def paginate_response(self, items: List, total: int) -> Dict:
        """Create paginated response"""
        return {
            "items": items,
            "pagination": {
                "page": self.page,
                "limit": self.limit,
                "total": total,
                "pages": (total + self.limit - 1) // self.limit,
                "has_next": self.page * self.limit < total,
                "has_prev": self.page > 1
            }
        }


# ==================== RESPONSE HELPERS ====================
def slim_user(user: Dict) -> Dict:
    """Return minimal user data for lists"""
    return {
        "id": user.get("id"),
        "full_name": user.get("full_name"),
        "email": user.get("email")
    }


def slim_booking(booking: Dict) -> Dict:
    """Return minimal booking data for lists"""
    return {
        "id": booking.get("id"),
        "booking_number": booking.get("booking_number"),
        "status": booking.get("status"),
        "travel_date": booking.get("travel_date"),
        "total_amount": booking.get("total_amount")
    }


# ==================== QUERY OPTIMIZATION ====================
# Pre-defined projections for common queries
PROJECTIONS = {
    "user_list": {
        "_id": 0,
        "id": 1,
        "full_name": 1,
        "email": 1,
        "phone": 1,
        "roles": 1,
        "is_active": 1,
        "created_at": 1
    },
    "booking_list": {
        "_id": 0,
        "id": 1,
        "booking_number": 1,
        "status": 1,
        "travel_date": 1,
        "from_location": 1,
        "to_location": 1,
        "total_amount": 1,
        "customer_id": 1,
        "created_at": 1
    },
    "operator_list": {
        "_id": 0,
        "id": 1,
        "user_id": 1,
        "company_name": 1,
        "base_city": 1,
        "rating": 1,
        "status": 1
    },
    "notification_list": {
        "_id": 0,
        "id": 1,
        "title": 1,
        "message": 1,
        "type": 1,
        "is_read": 1,
        "created_at": 1
    }
}


def get_list_projection(entity: str) -> Dict:
    """Get optimized projection for list queries"""
    return PROJECTIONS.get(f"{entity}_list", {"_id": 0})


# ==================== BATCH OPERATIONS ====================
async def batch_fetch(collection, ids: List[str], projection: Dict = None) -> Dict[str, Any]:
    """
    Fetch multiple documents by ID in single query
    Returns dict mapping id -> document
    """
    if not ids:
        return {}
    
    proj = projection or {"_id": 0}
    cursor = collection.find({"id": {"$in": ids}}, proj)
    docs = await cursor.to_list(len(ids))
    
    return {doc["id"]: doc for doc in docs}


# ==================== AGGREGATE HELPERS ====================
def count_pipeline(match: Dict = None) -> List:
    """Pipeline for efficient counting"""
    pipeline = []
    if match:
        pipeline.append({"$match": match})
    pipeline.append({"$count": "total"})
    return pipeline


def stats_pipeline(group_by: str, match: Dict = None) -> List:
    """Pipeline for grouped statistics"""
    pipeline = []
    if match:
        pipeline.append({"$match": match})
    pipeline.append({
        "$group": {
            "_id": f"${group_by}",
            "count": {"$sum": 1}
        }
    })
    pipeline.append({"$sort": {"count": -1}})
    return pipeline
