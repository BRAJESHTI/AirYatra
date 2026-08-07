"""
AirYatra Email Campaign Routes
Endpoints for: Campaigns, A/B Testing, Unsubscribe, Enhanced Analytics
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
from database import get_database
from middleware import require_roles, get_current_user
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email-campaigns", tags=["Email Campaigns"])

# Import services
try:
    from services.email_campaign_service import (
        email_preference_service, email_campaign_service, ab_testing_service,
        create_email_preference_record, create_campaign_record,
        get_daily_email_trends, get_template_performance, get_campaign_analytics
    )
    from services.email_service import email_service
    from services.branded_email_templates import get_branded_email
    from services.email_tracking_service import email_tracking_service, create_email_tracking_record
    SERVICES_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Some services not available: {e}")
    SERVICES_AVAILABLE = False


# ==================== PYDANTIC MODELS ====================

class CampaignCreate(BaseModel):
    name: str
    template_name: str
    subject: str
    audience_type: str  # all_customers, active_customers, etc.
    scheduled_at: datetime
    custom_emails: Optional[List[str]] = None
    ab_testing_enabled: Optional[bool] = False
    variant_b_subject: Optional[str] = None
    split_ratio: Optional[int] = 50

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None

class PreferenceUpdate(BaseModel):
    marketing: Optional[bool] = None
    booking_updates: Optional[bool] = None
    flight_reminders: Optional[bool] = None
    newsletters: Optional[bool] = None
    unsubscribe_all: Optional[bool] = None


# ==================== ENHANCED ANALYTICS ENDPOINTS ====================

@router.get("/analytics/trends")
async def get_email_trends(
    days: int = Query(30, ge=7, le=90),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get daily email send/open/click trends for charts"""
    db = get_database()
    trends = await get_daily_email_trends(db, days)
    
    return {
        "success": True,
        "period_days": days,
        "trends": trends,
        "summary": {
            "total_sent": sum(t["sent"] for t in trends),
            "total_opened": sum(t["opened"] for t in trends),
            "total_clicked": sum(t["clicked"] for t in trends),
            "avg_open_rate": round(sum(t["open_rate"] for t in trends) / len(trends), 1) if trends else 0,
            "avg_click_rate": round(sum(t["click_rate"] for t in trends) / len(trends), 1) if trends else 0
        }
    }

@router.get("/analytics/templates")
async def get_template_stats(
    days: int = Query(30, ge=7, le=90),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get performance metrics per template for bar charts"""
    db = get_database()
    performance = await get_template_performance(db, days)
    
    return {
        "success": True,
        "period_days": days,
        "templates": performance
    }


# ==================== CAMPAIGN ENDPOINTS ====================

@router.get("/campaigns")
async def list_campaigns(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all email campaigns"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    campaigns = await db.email_campaigns.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Get stats
    total = await db.email_campaigns.count_documents({})
    draft = await db.email_campaigns.count_documents({"status": "draft"})
    scheduled = await db.email_campaigns.count_documents({"status": "scheduled"})
    completed = await db.email_campaigns.count_documents({"status": "completed"})
    
    return {
        "success": True,
        "campaigns": campaigns,
        "stats": {
            "total": total,
            "draft": draft,
            "scheduled": scheduled,
            "completed": completed
        }
    }

@router.post("/campaigns")
async def create_campaign(
    data: CampaignCreate,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a new email campaign"""
    db = get_database()
    
    ab_testing = None
    if data.ab_testing_enabled and data.variant_b_subject:
        ab_testing = {
            "enabled": True,
            "variant_b_subject": data.variant_b_subject,
            "split_ratio": data.split_ratio
        }
    
    campaign = create_campaign_record(
        name=data.name,
        template_name=data.template_name,
        subject=data.subject,
        audience_type=data.audience_type,
        scheduled_at=data.scheduled_at,
        created_by=current_user["id"],
        custom_emails=data.custom_emails,
        ab_testing=ab_testing
    )
    
    await db.email_campaigns.insert_one(campaign.copy())
    
    return {
        "success": True,
        "message": "Campaign created",
        "campaign_id": campaign["campaign_id"],
        "campaign": campaign
    }

@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get campaign details with analytics"""
    db = get_database()
    
    result = await get_campaign_analytics(db, campaign_id)
    if not result:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {
        "success": True,
        **result
    }

@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    data: CampaignUpdate,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update campaign details"""
    db = get_database()
    
    campaign = await db.email_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign["status"] not in ["draft", "scheduled"]:
        raise HTTPException(status_code=400, detail="Cannot edit campaign in this status")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if data.name:
        update_data["name"] = data.name
    if data.subject:
        update_data["subject"] = data.subject
    if data.scheduled_at:
        update_data["scheduled_at"] = data.scheduled_at
    if data.status:
        update_data["status"] = data.status
    
    await db.email_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Campaign updated"}

@router.post("/campaigns/{campaign_id}/schedule")
async def schedule_campaign(
    campaign_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Schedule a draft campaign"""
    db = get_database()
    
    campaign = await db.email_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft campaigns can be scheduled")
    
    # Get recipient count
    recipient_count = await _get_audience_count(db, campaign["audience_type"], campaign.get("custom_emails"))
    
    await db.email_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {
            "status": "scheduled",
            "stats.total_recipients": recipient_count,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "message": f"Campaign scheduled for {campaign['scheduled_at']}",
        "recipients": recipient_count
    }

@router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Cancel a scheduled campaign"""
    db = get_database()
    
    result = await db.email_campaigns.update_one(
        {"campaign_id": campaign_id, "status": "scheduled"},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Campaign not found or not in scheduled status")
    
    return {"success": True, "message": "Campaign cancelled"}

@router.post("/campaigns/{campaign_id}/send-now")
async def send_campaign_now(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Send campaign immediately"""
    db = get_database()
    
    campaign = await db.email_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign["status"] not in ["draft", "scheduled"]:
        raise HTTPException(status_code=400, detail="Campaign cannot be sent in current status")
    
    # Update status to sending
    await db.email_campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$set": {"status": "sending", "sent_at": datetime.now(timezone.utc)}}
    )
    
    # Send in background
    background_tasks.add_task(_send_campaign_emails, campaign_id)
    
    return {"success": True, "message": "Campaign sending started"}


# ==================== UNSUBSCRIBE ENDPOINTS ====================

@router.get("/unsubscribe/{token}", response_class=HTMLResponse)
async def unsubscribe_page(token: str, manage: bool = False):
    """Public unsubscribe landing page"""
    db = get_database()
    
    # Find preference record by token
    pref = await db.email_preferences.find_one({"token": token})
    
    if not pref:
        return HTMLResponse(content=_get_error_page("Invalid or expired unsubscribe link"), status_code=404)
    
    if manage:
        return HTMLResponse(content=_get_preferences_page(pref, token))
    else:
        return HTMLResponse(content=_get_unsubscribe_page(pref["email"], token))

@router.post("/unsubscribe/{token}")
async def process_unsubscribe(token: str, unsubscribe_all: bool = True):
    """Process unsubscribe request"""
    db = get_database()
    
    pref = await db.email_preferences.find_one({"token": token})
    if not pref:
        raise HTTPException(status_code=404, detail="Invalid token")
    
    await db.email_preferences.update_one(
        {"token": token},
        {"$set": {
            "unsubscribed_all": unsubscribe_all,
            "preferences.marketing": False,
            "preferences.newsletters": False,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "message": "You have been unsubscribed"}

@router.put("/unsubscribe/{token}/preferences")
async def update_preferences(token: str, data: PreferenceUpdate):
    """Update email preferences"""
    db = get_database()
    
    pref = await db.email_preferences.find_one({"token": token})
    if not pref:
        raise HTTPException(status_code=404, detail="Invalid token")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if data.unsubscribe_all is not None:
        update_data["unsubscribed_all"] = data.unsubscribe_all
    
    if data.marketing is not None:
        update_data["preferences.marketing"] = data.marketing
    if data.booking_updates is not None:
        update_data["preferences.booking_updates"] = data.booking_updates
    if data.flight_reminders is not None:
        update_data["preferences.flight_reminders"] = data.flight_reminders
    if data.newsletters is not None:
        update_data["preferences.newsletters"] = data.newsletters
    
    await db.email_preferences.update_one({"token": token}, {"$set": update_data})
    
    return {"success": True, "message": "Preferences updated"}

@router.get("/preferences/check")
async def check_email_preferences(
    email: str = Query(...),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Check email preferences for a customer (admin)"""
    db = get_database()
    
    pref = await db.email_preferences.find_one({"email": email}, {"_id": 0})
    
    return {
        "success": True,
        "email": email,
        "preferences": pref if pref else {"subscribed": True, "no_record": True}
    }


# ==================== A/B TESTING ENDPOINTS ====================

@router.get("/campaigns/{campaign_id}/ab-results")
async def get_ab_test_results(
    campaign_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get A/B test results for a campaign"""
    db = get_database()
    
    campaign = await db.email_campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if not campaign.get("ab_testing", {}).get("enabled"):
        return {"success": False, "error": "A/B testing not enabled for this campaign"}
    
    variant_stats = campaign.get("variant_stats", {})
    winner = ab_testing_service.calculate_winner(variant_stats)
    
    # Calculate rates
    a_sent = variant_stats.get("a", {}).get("sent", 0)
    b_sent = variant_stats.get("b", {}).get("sent", 0)
    
    return {
        "success": True,
        "campaign_id": campaign_id,
        "subject_a": campaign["subject"],
        "subject_b": campaign["ab_testing"]["variant_b_subject"],
        "variant_a": {
            **variant_stats.get("a", {}),
            "open_rate": round((variant_stats.get("a", {}).get("opened", 0) / a_sent) * 100, 1) if a_sent > 0 else 0,
            "click_rate": round((variant_stats.get("a", {}).get("clicked", 0) / a_sent) * 100, 1) if a_sent > 0 else 0
        },
        "variant_b": {
            **variant_stats.get("b", {}),
            "open_rate": round((variant_stats.get("b", {}).get("opened", 0) / b_sent) * 100, 1) if b_sent > 0 else 0,
            "click_rate": round((variant_stats.get("b", {}).get("clicked", 0) / b_sent) * 100, 1) if b_sent > 0 else 0
        },
        "winner": winner,
        "winner_subject": campaign["subject"] if winner == "a" else campaign["ab_testing"]["variant_b_subject"] if winner == "b" else None
    }


# ==================== HELPER FUNCTIONS ====================

async def _get_audience_count(db, audience_type: str, custom_emails: List[str] = None) -> int:
    """Get recipient count for audience type"""
    if audience_type == "custom_list" and custom_emails:
        return len(custom_emails)
    
    if audience_type == "all_customers":
        return await db.users.count_documents({"roles": {"$in": ["customer"]}})
    
    if audience_type == "active_customers":
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
        active_ids = await db.bookings.distinct("customer_id", {"created_at": {"$gte": ninety_days_ago.isoformat()}})
        return len(active_ids)
    
    if audience_type == "vip_customers":
        return await db.users.count_documents({"loyalty_tier": {"$in": ["gold", "platinum", "black"]}})
    
    return 0

async def _send_campaign_emails(campaign_id: str):
    """Background task to send campaign emails"""
    from database import get_database
    db = get_database()
    
    try:
        campaign = await db.email_campaigns.find_one({"campaign_id": campaign_id})
        if not campaign:
            return
        
        # Get recipients
        recipients = await _get_campaign_recipients(db, campaign)
        
        # Check for A/B testing
        ab_enabled = campaign.get("ab_testing", {}).get("enabled", False)
        
        if ab_enabled:
            split = ab_testing_service.split_audience(recipients, campaign["ab_testing"]["split_ratio"])
            variant_a_recipients = split["variant_a"]
            variant_b_recipients = split["variant_b"]
        else:
            variant_a_recipients = recipients
            variant_b_recipients = []
        
        sent_count = 0
        failed_count = 0
        
        # Send variant A
        for email in variant_a_recipients:
            try:
                await _send_single_campaign_email(
                    db, campaign, email, 
                    campaign["subject"], 
                    "a" if ab_enabled else None
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send to {email}: {e}")
                failed_count += 1
        
        # Send variant B (if A/B testing)
        for email in variant_b_recipients:
            try:
                await _send_single_campaign_email(
                    db, campaign, email,
                    campaign["ab_testing"]["variant_b_subject"],
                    "b"
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send to {email}: {e}")
                failed_count += 1
        
        # Update campaign status
        await db.email_campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {
                "status": "completed",
                "stats.sent": sent_count,
                "stats.failed": failed_count,
                "completed_at": datetime.now(timezone.utc)
            }}
        )
        
        logger.info(f"Campaign {campaign_id} completed: {sent_count} sent, {failed_count} failed")
        
    except Exception as e:
        logger.error(f"Campaign {campaign_id} failed: {e}")
        await db.email_campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )

async def _get_campaign_recipients(db, campaign: dict) -> List[str]:
    """Get list of recipient emails for campaign"""
    audience_type = campaign["audience_type"]
    
    if audience_type == "custom_list":
        return campaign.get("custom_emails", [])
    
    query = {"roles": {"$in": ["customer"]}}
    
    if audience_type == "active_customers":
        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
        active_ids = await db.bookings.distinct("customer_id", {"created_at": {"$gte": ninety_days_ago.isoformat()}})
        query["id"] = {"$in": active_ids}
    
    elif audience_type == "vip_customers":
        query["loyalty_tier"] = {"$in": ["gold", "platinum", "black"]}
    
    users = await db.users.find(query, {"email": 1}).to_list(10000)
    emails = [u["email"] for u in users if u.get("email")]
    
    # Filter out unsubscribed
    unsubscribed = await db.email_preferences.find(
        {"email": {"$in": emails}, "$or": [{"unsubscribed_all": True}, {"preferences.marketing": False}]},
        {"email": 1}
    ).to_list(10000)
    unsubscribed_emails = set(u["email"] for u in unsubscribed)
    
    return [e for e in emails if e not in unsubscribed_emails]

async def _send_single_campaign_email(db, campaign: dict, recipient: str, subject: str, variant: str = None):
    """Send a single campaign email with tracking"""
    # Get or create preference token
    pref = await db.email_preferences.find_one({"email": recipient})
    if not pref:
        token = email_preference_service.generate_unsubscribe_token(recipient)
        pref_record = create_email_preference_record(recipient, token)
        await db.email_preferences.insert_one(pref_record)
    else:
        token = pref["token"]
    
    # Generate email HTML
    email_data = get_branded_email(
        campaign["template_name"],
        customer_name=recipient.split("@")[0].title(),
        theme="dark"
    )
    
    if not email_data:
        raise Exception(f"Failed to generate template {campaign['template_name']}")
    
    # Add tracking
    tracking_id = email_tracking_service.generate_tracking_id(campaign["campaign_id"])
    tracked_html = email_tracking_service.inject_tracking_into_html(email_data["html"], tracking_id)
    
    # Add unsubscribe footer
    unsubscribe_html = email_preference_service.get_unsubscribe_html(token)
    tracked_html = tracked_html.replace("</body>", f"{unsubscribe_html}</body>")
    
    # Send
    await email_service.send_email(recipient, subject, tracked_html)
    
    # Log tracking
    tracking_record = create_email_tracking_record(
        tracking_id=tracking_id,
        email_type="campaign",
        recipient=recipient,
        subject=subject,
        template_name=campaign["template_name"],
        metadata={
            "campaign_id": campaign["campaign_id"],
            "variant": variant
        }
    )
    await db.email_tracking.insert_one(tracking_record)
    
    # Update variant stats
    if variant:
        await db.email_campaigns.update_one(
            {"campaign_id": campaign["campaign_id"]},
            {"$inc": {f"variant_stats.{variant}.sent": 1}}
        )


# ==================== HTML PAGE TEMPLATES ====================

def _get_unsubscribe_page(email: str, token: str) -> str:
    """Generate unsubscribe confirmation page"""
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unsubscribe - AirYatra</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }}
            .container {{ background: white; border-radius: 16px; padding: 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }}
            .logo {{ font-size: 32px; margin-bottom: 20px; }}
            h1 {{ color: #0f172a; font-size: 24px; margin-bottom: 12px; }}
            p {{ color: #64748b; margin-bottom: 24px; }}
            .email {{ background: #f1f5f9; padding: 12px 20px; border-radius: 8px; font-weight: 600; color: #0f172a; margin-bottom: 24px; }}
            .btn {{ display: inline-block; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; font-size: 16px; transition: all 0.2s; }}
            .btn-primary {{ background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; }}
            .btn-primary:hover {{ transform: translateY(-2px); box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4); }}
            .btn-secondary {{ background: #f1f5f9; color: #475569; margin-left: 12px; }}
            .btn-secondary:hover {{ background: #e2e8f0; }}
            .success {{ display: none; }}
            .success.show {{ display: block; }}
            .form.hide {{ display: none; }}
            .checkmark {{ font-size: 64px; margin-bottom: 16px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="form" id="form">
                <div class="logo">🚁</div>
                <h1>Unsubscribe from AirYatra</h1>
                <p>Are you sure you want to unsubscribe from all marketing emails?</p>
                <div class="email">{email}</div>
                <button class="btn btn-primary" onclick="unsubscribe()">Yes, Unsubscribe</button>
                <a href="/unsubscribe/{token}?manage=true" class="btn btn-secondary">Manage Preferences</a>
            </div>
            <div class="success" id="success">
                <div class="checkmark">✅</div>
                <h1>You've been unsubscribed</h1>
                <p>You will no longer receive marketing emails from AirYatra. You'll still receive important booking updates.</p>
                <a href="/" class="btn btn-primary" style="margin-top: 20px;">Back to AirYatra</a>
            </div>
        </div>
        <script>
            async function unsubscribe() {{
                try {{
                    const res = await fetch('/api/email-campaigns/unsubscribe/{token}', {{ method: 'POST' }});
                    if (res.ok) {{
                        document.getElementById('form').classList.add('hide');
                        document.getElementById('success').classList.add('show');
                    }}
                }} catch (e) {{
                    alert('Error. Please try again.');
                }}
            }}
        </script>
    </body>
    </html>
    '''

def _get_preferences_page(pref: dict, token: str) -> str:
    """Generate preferences management page"""
    prefs = pref.get("preferences", {})
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Preferences - AirYatra</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }}
            .container {{ background: white; border-radius: 16px; padding: 40px; max-width: 520px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }}
            .logo {{ font-size: 32px; text-align: center; margin-bottom: 20px; }}
            h1 {{ color: #0f172a; font-size: 24px; margin-bottom: 8px; text-align: center; }}
            .subtitle {{ color: #64748b; text-align: center; margin-bottom: 32px; }}
            .email {{ background: #f1f5f9; padding: 12px 20px; border-radius: 8px; text-align: center; margin-bottom: 24px; color: #0f172a; font-weight: 500; }}
            .pref-item {{ display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid #e2e8f0; }}
            .pref-item:last-child {{ border-bottom: none; }}
            .pref-label {{ font-weight: 500; color: #0f172a; }}
            .pref-desc {{ font-size: 13px; color: #64748b; margin-top: 4px; }}
            .toggle {{ position: relative; width: 52px; height: 28px; }}
            .toggle input {{ opacity: 0; width: 0; height: 0; }}
            .slider {{ position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .3s; border-radius: 28px; }}
            .slider:before {{ position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .3s; border-radius: 50%; }}
            input:checked + .slider {{ background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); }}
            input:checked + .slider:before {{ transform: translateX(24px); }}
            .btn {{ display: block; width: 100%; padding: 14px; border-radius: 8px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; font-size: 16px; transition: all 0.2s; margin-top: 24px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; }}
            .btn:hover {{ transform: translateY(-2px); box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4); }}
            .saved {{ display: none; background: #dcfce7; color: #166534; padding: 12px; border-radius: 8px; text-align: center; margin-top: 16px; }}
            .saved.show {{ display: block; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🚁</div>
            <h1>Email Preferences</h1>
            <p class="subtitle">Manage what emails you receive from AirYatra</p>
            <div class="email">{pref["email"]}</div>
            
            <div class="pref-item">
                <div>
                    <div class="pref-label">Marketing & Promotions</div>
                    <div class="pref-desc">Deals, discounts, and special offers</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" id="marketing" {"checked" if prefs.get("marketing", True) else ""}>
                    <span class="slider"></span>
                </label>
            </div>
            
            <div class="pref-item">
                <div>
                    <div class="pref-label">Booking Updates</div>
                    <div class="pref-desc">Confirmations, reminders, and changes</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" id="booking_updates" {"checked" if prefs.get("booking_updates", True) else ""}>
                    <span class="slider"></span>
                </label>
            </div>
            
            <div class="pref-item">
                <div>
                    <div class="pref-label">Flight Reminders</div>
                    <div class="pref-desc">24-hour reminders before your flight</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" id="flight_reminders" {"checked" if prefs.get("flight_reminders", True) else ""}>
                    <span class="slider"></span>
                </label>
            </div>
            
            <div class="pref-item">
                <div>
                    <div class="pref-label">Newsletters & Tips</div>
                    <div class="pref-desc">Travel tips, news, and updates</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" id="newsletters" {"checked" if prefs.get("newsletters", True) else ""}>
                    <span class="slider"></span>
                </label>
            </div>
            
            <button class="btn" onclick="savePreferences()">Save Preferences</button>
            <div class="saved" id="saved">✅ Preferences saved successfully!</div>
        </div>
        <script>
            async function savePreferences() {{
                const data = {{
                    marketing: document.getElementById('marketing').checked,
                    booking_updates: document.getElementById('booking_updates').checked,
                    flight_reminders: document.getElementById('flight_reminders').checked,
                    newsletters: document.getElementById('newsletters').checked
                }};
                try {{
                    const res = await fetch('/api/email-campaigns/unsubscribe/{token}/preferences', {{
                        method: 'PUT',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify(data)
                    }});
                    if (res.ok) {{
                        document.getElementById('saved').classList.add('show');
                        setTimeout(() => document.getElementById('saved').classList.remove('show'), 3000);
                    }}
                }} catch (e) {{
                    alert('Error saving preferences');
                }}
            }}
        </script>
    </body>
    </html>
    '''

def _get_error_page(message: str) -> str:
    """Generate error page"""
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - AirYatra</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }}
            .container {{ background: white; border-radius: 16px; padding: 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }}
            .icon {{ font-size: 64px; margin-bottom: 20px; }}
            h1 {{ color: #0f172a; font-size: 24px; margin-bottom: 12px; }}
            p {{ color: #64748b; margin-bottom: 24px; }}
            .btn {{ display: inline-block; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">❌</div>
            <h1>Something went wrong</h1>
            <p>{message}</p>
            <a href="/" class="btn">Back to AirYatra</a>
        </div>
    </body>
    </html>
    '''
