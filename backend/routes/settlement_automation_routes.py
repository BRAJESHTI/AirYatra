from fastapi import APIRouter, Depends, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from database import get_database
from middleware import require_roles
from models import UserRole
import logging
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/settlement-automation", tags=["Settlement Automation"])

# ============== SETTLEMENT SCHEDULER ==============

@router.get("/status")
async def get_automation_status(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get settlement automation status"""
    db = get_database()
    
    config = await db.automation_config.find_one({"type": "settlement_scheduler"}, {"_id": 0})
    if not config:
        config = {
            "type": "settlement_scheduler",
            "enabled": False,
            "schedule": "weekly",  # daily, weekly, biweekly, monthly
            "day_of_week": "monday",
            "time": "09:00",
            "min_amount": 1000,
            "auto_approve_below": 10000,
            "require_approval_above": 50000,
            "notification_enabled": True,
            "last_run": None,
            "next_run": None
        }
    
    # Get pending settlements count
    pending_count = await db.settlements.count_documents({"status": "pending"})
    
    # Get last 5 runs
    last_runs = await db.settlement_runs.find({}, {"_id": 0}).sort("run_at", -1).limit(5).to_list(5)
    
    return {
        "config": config,
        "pending_settlements": pending_count,
        "last_runs": last_runs
    }

@router.put("/config")
async def update_automation_config(
    config_data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Update settlement automation configuration"""
    db = get_database()
    
    valid_schedules = ["daily", "weekly", "biweekly", "monthly"]
    if config_data.get("schedule") and config_data["schedule"] not in valid_schedules:
        return {"error": "Invalid schedule type"}
    
    update_data = {
        "enabled": config_data.get("enabled", False),
        "schedule": config_data.get("schedule", "weekly"),
        "day_of_week": config_data.get("day_of_week", "monday"),
        "time": config_data.get("time", "09:00"),
        "min_amount": config_data.get("min_amount", 1000),
        "auto_approve_below": config_data.get("auto_approve_below", 10000),
        "require_approval_above": config_data.get("require_approval_above", 50000),
        "notification_enabled": config_data.get("notification_enabled", True),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["id"]
    }
    
    # Calculate next run time
    update_data["next_run"] = calculate_next_run(update_data["schedule"], update_data["day_of_week"], update_data["time"])
    
    await db.automation_config.update_one(
        {"type": "settlement_scheduler"},
        {"$set": update_data},
        upsert=True
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "action": "settlement_automation_config_update",
        "entity_type": "settings",
        "entity_id": "settlement_scheduler",
        "user_id": user["id"],
        "user_name": user.get("full_name"),
        "changes": update_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Configuration updated", "next_run": update_data["next_run"]}

@router.post("/run-now")
async def run_settlement_now(
    background_tasks: BackgroundTasks,
    dry_run: bool = False,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """
    Manually trigger settlement processing
    मैन्युअल सेटलमेंट ट्रिगर करें
    """
    db = get_database()
    
    run_id = str(uuid4())
    
    # Create run record
    run_record = {
        "id": run_id,
        "type": "manual",
        "dry_run": dry_run,
        "triggered_by": user["id"],
        "triggered_by_name": user.get("full_name"),
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "operators_processed": 0,
        "total_amount": 0,
        "settlements_created": 0,
        "errors": []
    }
    
    await db.settlement_runs.insert_one(run_record.copy())
    
    # Run in background
    background_tasks.add_task(process_settlements, run_id, dry_run)
    
    return {
        "message": "Settlement processing started" if not dry_run else "Dry run started",
        "run_id": run_id
    }

@router.get("/run/{run_id}")
async def get_run_status(
    run_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get settlement run status"""
    db = get_database()
    
    run = await db.settlement_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        return {"error": "Run not found"}
    
    return run

@router.get("/pending-operators")
async def get_pending_operator_settlements(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE]))
):
    """Get operators with pending settlements"""
    db = get_database()
    
    # Find completed bookings without settlements
    pipeline = [
        {"$match": {"status": "completed", "settlement_status": {"$ne": "settled"}}},
        {"$group": {
            "_id": "$operator_id",
            "total_amount": {"$sum": {"$ifNull": ["$operator_amount", 0]}},
            "booking_count": {"$sum": 1},
            "oldest_booking": {"$min": "$completed_at"}
        }},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"total_amount": -1}}
    ]
    
    results = await db.bookings.aggregate(pipeline).to_list(100)
    
    # Enrich with operator details
    enriched = []
    for r in results:
        operator = await db.operators.find_one({"id": r["_id"]}, {"_id": 0, "company_name": 1, "bank_details": 1})
        if operator:
            enriched.append({
                "operator_id": r["_id"],
                "company_name": operator.get("company_name"),
                "total_pending": r["total_amount"],
                "booking_count": r["booking_count"],
                "oldest_booking": r["oldest_booking"],
                "has_bank_details": bool(operator.get("bank_details"))
            })
    
    return {
        "operators": enriched,
        "total_pending_amount": sum(r["total_pending"] for r in enriched)
    }

async def process_settlements(run_id: str, dry_run: bool = False):
    """Background task to process settlements"""
    from database import get_database
    db = get_database()
    
    try:
        # Get automation config
        config = await db.automation_config.find_one({"type": "settlement_scheduler"}, {"_id": 0})
        min_amount = config.get("min_amount", 1000) if config else 1000
        auto_approve_below = config.get("auto_approve_below", 10000) if config else 10000
        
        # Find operators with pending amounts
        pipeline = [
            {"$match": {"status": "completed", "settlement_status": {"$ne": "settled"}}},
            {"$group": {
                "_id": "$operator_id",
                "total_amount": {"$sum": {"$ifNull": ["$operator_amount", 0]}},
                "booking_ids": {"$push": "$id"}
            }},
            {"$match": {"_id": {"$ne": None}, "total_amount": {"$gte": min_amount}}}
        ]
        
        operators_data = await db.bookings.aggregate(pipeline).to_list(500)
        
        settlements_created = 0
        total_amount = 0
        errors = []
        
        for op_data in operators_data:
            try:
                operator = await db.operators.find_one({"id": op_data["_id"]}, {"_id": 0})
                if not operator:
                    continue
                
                amount = op_data["total_amount"]
                total_amount += amount
                
                if not dry_run:
                    # Create settlement
                    settlement = {
                        "id": str(uuid4()),
                        "operator_id": op_data["_id"],
                        "operator_name": operator.get("company_name"),
                        "amount": amount,
                        "booking_ids": op_data["booking_ids"],
                        "booking_count": len(op_data["booking_ids"]),
                        "status": "approved" if amount < auto_approve_below else "pending",
                        "auto_created": True,
                        "run_id": run_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.settlements.insert_one(settlement.copy())
                    
                    # Mark bookings as settlement_pending
                    await db.bookings.update_many(
                        {"id": {"$in": op_data["booking_ids"]}},
                        {"$set": {"settlement_status": "pending", "settlement_id": settlement["id"]}}
                    )
                    
                    settlements_created += 1
                    
            except Exception as e:
                errors.append({"operator_id": op_data["_id"], "error": str(e)})
        
        # Update run record
        await db.settlement_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "operators_processed": len(operators_data),
                "settlements_created": settlements_created,
                "total_amount": total_amount,
                "errors": errors
            }}
        )
        
        logger.info(f"Settlement run {run_id} completed: {settlements_created} settlements, ₹{total_amount}")
        
    except Exception as e:
        logger.error(f"Settlement run {run_id} failed: {e}")
        await db.settlement_runs.update_one(
            {"id": run_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )

def calculate_next_run(schedule: str, day_of_week: str, time_str: str) -> str:
    """Calculate next scheduled run time"""
    now = datetime.now(timezone.utc)
    hour, minute = map(int, time_str.split(":"))
    
    days_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }
    
    if schedule == "daily":
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
    
    elif schedule == "weekly":
        target_day = days_map.get(day_of_week.lower(), 0)
        days_ahead = target_day - now.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        next_run = (now + timedelta(days=days_ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    elif schedule == "biweekly":
        target_day = days_map.get(day_of_week.lower(), 0)
        days_ahead = target_day - now.weekday()
        if days_ahead <= 0:
            days_ahead += 14
        else:
            days_ahead += 7
        next_run = (now + timedelta(days=days_ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    elif schedule == "monthly":
        next_month = now.replace(day=1) + timedelta(days=32)
        next_run = next_month.replace(day=1, hour=hour, minute=minute, second=0, microsecond=0)
    
    else:
        next_run = now + timedelta(days=7)
    
    return next_run.isoformat()
