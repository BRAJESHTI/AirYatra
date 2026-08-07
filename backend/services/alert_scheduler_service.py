"""
AirYatra Alert Scheduler Service
Features: Scheduled alert checks, Background jobs, Auto-email notifications
"""

import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

SCHEDULER_CONFIG = {
    "enabled": os.environ.get("ALERT_SCHEDULER_ENABLED", "true").lower() == "true",
    "interval_hours": int(os.environ.get("ALERT_CHECK_INTERVAL_HOURS", "1")),
}

# Global scheduler instance
scheduler: Optional[AsyncIOScheduler] = None


async def check_alerts_job():
    """Background job to check all alert thresholds"""
    from database import get_database
    
    logger.info(f"[SCHEDULER] Running alert check at {datetime.now(timezone.utc).isoformat()}")
    
    try:
        db = get_database()
        
        # Get all active alerts
        alerts = await db.template_alerts.find({"is_active": True}).to_list(100)
        
        if not alerts:
            logger.info("[SCHEDULER] No active alerts to check")
            return
        
        triggered_count = 0
        
        for alert in alerts:
            try:
                metric = alert["metric"]
                template_id = alert.get("template_id")
                
                # Build query for last 24 hours
                query = {"created_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)}}
                if template_id:
                    query["template_id"] = template_id
                
                total = await db.notification_queue.count_documents(query)
                
                if total == 0:
                    continue
                
                # Calculate metric value
                if metric == "delivery_rate":
                    delivered = await db.notification_queue.count_documents({**query, "status": "sent"})
                    metric_value = (delivered / total) * 100 if total > 0 else 0
                elif metric == "open_rate":
                    opened = await db.notification_queue.count_documents({**query, "delivery_status": "opened"})
                    delivered = await db.notification_queue.count_documents({**query, "status": "sent"})
                    metric_value = (opened / delivered) * 100 if delivered > 0 else 0
                elif metric == "click_rate":
                    clicked = await db.notification_queue.count_documents({**query, "delivery_status": "clicked"})
                    delivered = await db.notification_queue.count_documents({**query, "status": "sent"})
                    metric_value = (clicked / delivered) * 100 if delivered > 0 else 0
                elif metric == "bounce_rate":
                    bounced = await db.notification_queue.count_documents({**query, "status": "bounced"})
                    metric_value = (bounced / total) * 100 if total > 0 else 0
                else:
                    continue
                
                # Check threshold
                threshold = alert["threshold"]
                comparison = alert["comparison"]
                
                should_trigger = (
                    (comparison == "below" and metric_value < threshold) or
                    (comparison == "above" and metric_value > threshold)
                )
                
                if should_trigger:
                    # Get template name
                    template_name = None
                    if template_id:
                        template = await db.notification_templates.find_one({"template_id": template_id})
                        template_name = template.get("name") if template else None
                    
                    # Send alert email
                    try:
                        from routes.template_routes import send_alert_email
                        await send_alert_email(alert, metric_value, template_name)
                    except Exception as email_err:
                        logger.error(f"[SCHEDULER] Email send error: {email_err}")
                    
                    # Send push notification
                    try:
                        from services.push_notification_service import send_alert_push
                        await send_alert_push(metric, metric_value, threshold, comparison)
                    except Exception as push_err:
                        logger.error(f"[SCHEDULER] Push send error: {push_err}")
                    
                    # Log to history
                    import uuid
                    history_record = {
                        "history_id": f"AH-{uuid.uuid4().hex[:8].upper()}",
                        "alert_id": alert["alert_id"],
                        "metric": metric,
                        "threshold": threshold,
                        "comparison": comparison,
                        "actual_value": round(metric_value, 2),
                        "template_id": template_id,
                        "template_name": template_name,
                        "triggered_by": "scheduler",
                        "triggered_at": datetime.now(timezone.utc)
                    }
                    await db.alert_history.insert_one(history_record)
                    
                    # Update alert trigger count
                    await db.template_alerts.update_one(
                        {"alert_id": alert["alert_id"]},
                        {
                            "$inc": {"trigger_count": 1},
                            "$set": {"last_triggered_at": datetime.now(timezone.utc)}
                        }
                    )
                    
                    triggered_count += 1
                    logger.info(f"[SCHEDULER] Alert triggered: {alert['alert_id']} - {metric}: {metric_value:.1f}%")
                    
            except Exception as alert_err:
                logger.error(f"[SCHEDULER] Error processing alert {alert.get('alert_id')}: {alert_err}")
        
        logger.info(f"[SCHEDULER] Alert check complete. Triggered: {triggered_count}/{len(alerts)}")
        
    except Exception as e:
        logger.error(f"[SCHEDULER] Alert check job failed: {e}")


def start_scheduler():
    """Start the background scheduler"""
    global scheduler
    
    if not SCHEDULER_CONFIG["enabled"]:
        logger.info("[SCHEDULER] Alert scheduler is disabled")
        return
    
    if scheduler is not None and scheduler.running:
        logger.info("[SCHEDULER] Scheduler already running")
        return
    
    scheduler = AsyncIOScheduler()
    
    # Add alert check job
    interval_hours = SCHEDULER_CONFIG["interval_hours"]
    scheduler.add_job(
        check_alerts_job,
        trigger=IntervalTrigger(hours=interval_hours),
        id="alert_check_job",
        name="Alert Threshold Check",
        replace_existing=True,
        max_instances=1
    )
    
    scheduler.start()
    logger.info(f"[SCHEDULER] Started. Alert checks every {interval_hours} hour(s)")


def stop_scheduler():
    """Stop the background scheduler"""
    global scheduler
    
    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[SCHEDULER] Stopped")


def get_scheduler_status() -> Dict[str, Any]:
    """Get scheduler status"""
    global scheduler
    
    jobs = []
    if scheduler and scheduler.running:
        for job in scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
    
    return {
        "enabled": SCHEDULER_CONFIG["enabled"],
        "running": scheduler.running if scheduler else False,
        "interval_hours": SCHEDULER_CONFIG["interval_hours"],
        "jobs": jobs
    }


def run_alert_check_now():
    """Manually trigger alert check"""
    global scheduler
    
    if scheduler and scheduler.running:
        job = scheduler.get_job("alert_check_job")
        if job:
            scheduler.modify_job("alert_check_job", next_run_time=datetime.now(timezone.utc))
            return True
    return False
