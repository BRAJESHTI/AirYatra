from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from middleware import get_current_user, require_roles, UserRole
from scheduler import scheduler, auto_reassign_stale_leads
import asyncio

router = APIRouter(prefix="/scheduler", tags=["Background Scheduler"])

# Admin-only dependency
require_admin = require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])

@router.get("/status")
async def get_scheduler_status(current_user: dict = Depends(require_admin)):
    """
    Get background scheduler status and job list.
    Admin only.
    """
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    
    return {
        "running": scheduler.running,
        "jobs": jobs,
        "current_time": datetime.now(timezone.utc).isoformat()
    }

@router.post("/trigger/auto-reassign")
async def trigger_auto_reassign(current_user: dict = Depends(require_admin)):
    """
    Manually trigger lead auto-reassignment.
    Admin only.
    """
    try:
        await auto_reassign_stale_leads()
        return {
            "success": True,
            "message": "Auto-reassignment triggered successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trigger/departure-reminders")
async def trigger_departure_reminders(current_user: dict = Depends(require_admin)):
    """Manually trigger 24h departure reminders (flights + yacht/marine)"""
    from scheduler import send_departure_reminders_24h
    sent = await send_departure_reminders_24h()
    return {"message": "24h departure reminders triggered", "emails_sent": sent}


@router.post("/pause/{job_id}")
async def pause_job(job_id: str, current_user: dict = Depends(require_admin)):
    """
    Pause a scheduled job.
    Admin only.
    """
    job = scheduler.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    scheduler.pause_job(job_id)
    return {"success": True, "message": f"Job {job_id} paused"}

@router.post("/resume/{job_id}")
async def resume_job(job_id: str, current_user: dict = Depends(require_admin)):
    """
    Resume a paused job.
    Admin only.
    """
    job = scheduler.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    scheduler.resume_job(job_id)
    return {"success": True, "message": f"Job {job_id} resumed"}
