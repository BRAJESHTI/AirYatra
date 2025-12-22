from fastapi import APIRouter, HTTPException, Depends, Query
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/audit-logs", tags=["Admin - Audit Logs"])

@router.get("/")
async def get_audit_logs(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    action: str = Query(None),
    entity_type: str = Query(None),
    user_id: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    limit: int = Query(100, le=500)
):
    """Get audit logs with filters"""
    db = get_database()
    
    query = {}
    
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    if user_id:
        query["user_id"] = user_id
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": len(logs),
        "filters_applied": query
    }

@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_audit_trail(
    entity_type: str,
    entity_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get complete audit trail for a specific entity"""
    db = get_database()
    
    logs = await db.audit_logs.find(
        {"entity_type": entity_type, "entity_id": entity_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "audit_trail": logs,
        "total_events": len(logs)
    }

@router.get("/user/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
    limit: int = Query(100, le=500)
):
    """Get all activity for a specific user"""
    db = get_database()
    
    logs = await db.audit_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get user details
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    return {
        "user_id": user_id,
        "user_details": user_data,
        "activity_logs": logs,
        "total_actions": len(logs)
    }

@router.get("/critical")
async def get_critical_actions(user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))):
    """Get all critical/sensitive actions (Super Admin only)"""
    db = get_database()
    
    critical_logs = await db.audit_logs.find(
        {"is_critical": True},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    return {
        "critical_actions": critical_logs,
        "total": len(critical_logs)
    }

@router.get("/statistics")
async def get_audit_statistics(user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))):
    """Get audit log statistics"""
    db = get_database()
    
    total_logs = await db.audit_logs.count_documents({})
    
    # Group by action type
    action_pipeline = [
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    action_stats = await db.audit_logs.aggregate(action_pipeline).to_list(50)
    
    # Group by entity type
    entity_pipeline = [
        {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    entity_stats = await db.audit_logs.aggregate(entity_pipeline).to_list(50)
    
    # Most active users
    user_pipeline = [
        {"$group": {"_id": "$user_id", "actions": {"$sum": 1}, "user_name": {"$first": "$user_name"}}},
        {"$sort": {"actions": -1}},
        {"$limit": 10}
    ]
    user_stats = await db.audit_logs.aggregate(user_pipeline).to_list(10)
    
    return {
        "total_logs": total_logs,
        "by_action": action_stats,
        "by_entity_type": entity_stats,
        "most_active_users": user_stats
    }