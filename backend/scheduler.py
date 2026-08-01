"""
Background Scheduler for AirYatra
Handles automated tasks like lead reassignment, notifications, etc.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone, timedelta
import logging
import asyncio

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def auto_reassign_stale_leads():
    """
    Auto-reassign leads that haven't been contacted within 1 hour.
    This runs every 15 minutes.
    """
    from database import get_database_sync
    
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for lead reassignment")
            return
        
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        
        # Find stale leads (new status, not contacted, older than 1 hour)
        stale_leads = await db.crm_leads.find({
            "status": "new",
            "created_at": {"$lt": one_hour_ago.isoformat()},
            "last_contacted_at": None
        }).to_list(100)
        
        if not stale_leads:
            logger.info("No stale leads found for reassignment")
            return
        
        # Get active sales users
        sales_users = await db.users.find({
            "role": {"$in": ["sales", "sales_manager", "admin"]},
            "status": "active"
        }, {"_id": 0, "id": 1, "full_name": 1, "email": 1}).to_list(50)
        
        if not sales_users:
            logger.warning("No active sales users found for lead reassignment")
            return
        
        reassigned_count = 0
        for i, lead in enumerate(stale_leads):
            # Round-robin assignment
            new_assignee = sales_users[i % len(sales_users)]
            old_assignee = lead.get("assigned_to")
            
            # Skip if already assigned to someone different
            if old_assignee and old_assignee != new_assignee["id"]:
                # Update lead assignment
                await db.crm_leads.update_one(
                    {"id": lead["id"]},
                    {"$set": {
                        "assigned_to": new_assignee["id"],
                        "assigned_to_name": new_assignee.get("full_name", new_assignee["email"]),
                        "reassigned_at": datetime.now(timezone.utc).isoformat(),
                        "reassignment_reason": "auto_stale_1hr",
                        "previous_assignee": old_assignee
                    }}
                )
                reassigned_count += 1
                
                # Create notification for new assignee
                await db.notifications.insert_one({
                    "id": f"notif_{datetime.now(timezone.utc).timestamp()}_{lead['id']}",
                    "user_id": new_assignee["id"],
                    "type": "lead_assigned",
                    "title": "New Lead Assigned / नई लीड असाइन",
                    "message": f"Lead {lead.get('lead_number')} has been reassigned to you. Please follow up.",
                    "data": {"lead_id": lead["id"], "lead_number": lead.get("lead_number")},
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
        
        logger.info(f"Auto-reassigned {reassigned_count} stale leads")
        
        # Log this action
        await db.audit_logs.insert_one({
            "id": f"audit_{datetime.now(timezone.utc).timestamp()}",
            "action": "auto_lead_reassignment",
            "actor": "system_scheduler",
            "details": {
                "total_stale": len(stale_leads),
                "reassigned": reassigned_count
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in auto_reassign_stale_leads: {e}")


async def send_pending_notifications():
    """
    Process and send pending notifications (email, SMS, push).
    This runs every 5 minutes.
    """
    from database import get_database_sync
    
    try:
        db = get_database_sync()
        if db is None:
            return
        
        # Find pending notifications that need to be sent
        pending = await db.notification_queue.find({
            "status": "pending",
            "scheduled_for": {"$lte": datetime.now(timezone.utc).isoformat()}
        }).to_list(50)
        
        for notif in pending:
            try:
                # Mark as processing
                await db.notification_queue.update_one(
                    {"id": notif["id"]},
                    {"$set": {"status": "processing"}}
                )
                
                # TODO: Actually send via email/SMS based on notif type
                # For now, just mark as sent
                await db.notification_queue.update_one(
                    {"id": notif["id"]},
                    {"$set": {
                        "status": "sent",
                        "sent_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            except Exception as e:
                await db.notification_queue.update_one(
                    {"id": notif["id"]},
                    {"$set": {
                        "status": "failed",
                        "error": str(e)
                    }}
                )
        
        if pending:
            logger.info(f"Processed {len(pending)} pending notifications")
            
    except Exception as e:
        logger.error(f"Error in send_pending_notifications: {e}")


async def cleanup_old_sessions():
    """
    Clean up expired sessions and tokens.
    This runs every hour.
    """
    from database import get_database_sync
    
    try:
        db = get_database_sync()
        if db is None:
            return
        
        # Delete sessions older than 7 days
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        
        result = await db.sessions.delete_many({
            "created_at": {"$lt": seven_days_ago.isoformat()}
        })
        
        if result.deleted_count > 0:
            logger.info(f"Cleaned up {result.deleted_count} old sessions")
            
    except Exception as e:
        logger.error(f"Error in cleanup_old_sessions: {e}")


async def generate_daily_reports():
    """
    Generate daily summary reports.
    This runs once a day at midnight.
    """
    from database import get_database_sync
    
    try:
        db = get_database_sync()
        if db is None:
            return
        
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)
        
        # Get yesterday's stats
        yesterday_start = datetime.combine(yesterday, datetime.min.time()).replace(tzinfo=timezone.utc)
        yesterday_end = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # Count leads
        new_leads = await db.crm_leads.count_documents({
            "created_at": {
                "$gte": yesterday_start.isoformat(),
                "$lt": yesterday_end.isoformat()
            }
        })
        
        # Count bookings
        new_bookings = await db.bookings.count_documents({
            "created_at": {
                "$gte": yesterday_start.isoformat(),
                "$lt": yesterday_end.isoformat()
            }
        })
        
        # Count conversions
        conversions = await db.crm_leads.count_documents({
            "status": "won",
            "converted_at": {
                "$gte": yesterday_start.isoformat(),
                "$lt": yesterday_end.isoformat()
            }
        })
        
        # Save daily report
        await db.daily_reports.insert_one({
            "id": f"report_{yesterday.isoformat()}",
            "date": yesterday.isoformat(),
            "metrics": {
                "new_leads": new_leads,
                "new_bookings": new_bookings,
                "conversions": conversions,
                "conversion_rate": round((conversions / new_leads * 100) if new_leads > 0 else 0, 2)
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Generated daily report for {yesterday.isoformat()}")
        
    except Exception as e:
        logger.error(f"Error in generate_daily_reports: {e}")


async def send_voucher_expiry_alerts():
    """Email members whose active vouchers expire within 7 days. Runs every 12 hours."""
    from database import get_database_sync
    
    try:
        db = get_database_sync()
        if db is None:
            return 0
        
        now = datetime.now(timezone.utc)
        cutoff = (now + timedelta(days=7)).isoformat()
        
        vouchers = await db.reward_redemptions.find({
            "status": "active",
            "expiry_alert_sent": {"$ne": True},
            "expires_at": {"$gt": now.isoformat(), "$lt": cutoff}
        }, {"_id": 0}).to_list(100)
        
        sent = 0
        for v in vouchers:
            user = await db.users.find_one({"id": v["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
            if not user or not user.get("email"):
                continue
            
            expires = datetime.fromisoformat(v["expires_at"].replace("Z", "+00:00"))
            days_left = max(1, (expires - now).days)
            value_line = f"<p style='font-size:18px;color:#16a34a;'><b>Worth ₹{int(v.get('value', 0)):,} discount!</b></p>" if v.get("value") else ""
            
            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0f172a;color:#e2e8f0;padding:30px;border-radius:12px;">
                <h2 style="color:#f97316;">⏰ Your Voucher Expires Soon!</h2>
                <p>Hi {user.get('full_name', 'Traveler')},</p>
                <p>Your reward voucher <b>{v.get('reward_icon','🎫')} {v['reward_name']}</b> expires in <b style="color:#f97316;">{days_left} day(s)</b>.</p>
                <div style="background:#1e293b;border:1px dashed #f97316;padding:15px;border-radius:8px;text-align:center;margin:20px 0;">
                    <p style="margin:0;color:#94a3b8;font-size:12px;">VOUCHER CODE</p>
                    <p style="margin:5px 0;font-size:22px;letter-spacing:2px;color:#f97316;"><b>{v['code']}</b></p>
                    <p style="margin:0;color:#94a3b8;font-size:12px;">Valid till {expires.strftime('%d %b %Y')}</p>
                </div>
                {value_line}
                <p>Apply it at checkout on your next booking — don't let your reward go to waste!</p>
                <p style="margin-top:25px;">Happy Flying! ✈️<br/><b>Team AirYatra</b></p>
            </div>
            """
            try:
                from services.email_service import email_service
                result = await email_service.send_email(
                    to_email=user["email"],
                    subject=f"⏰ Your ₹{int(v.get('value', 0)):,} AirYatra voucher expires in {days_left} day(s)!" if v.get("value") else f"⏰ Your AirYatra voucher expires in {days_left} day(s)!",
                    html_body=html
                )
                if result.get("success"):
                    await db.reward_redemptions.update_one(
                        {"id": v["id"]},
                        {"$set": {"expiry_alert_sent": True, "expiry_alert_at": now.isoformat()}}
                    )
                    sent += 1
            except Exception as e:
                logger.error(f"Voucher expiry email failed for {v['code']}: {e}")
        
        if sent:
            logger.info(f"Voucher expiry alerts sent: {sent}")
        return sent
    except Exception as e:
        logger.error(f"send_voucher_expiry_alerts failed: {e}")
        return 0


async def send_auction_ending_reminders():
    """Email watchers when a live auction closes within 60 minutes. Runs every 10 minutes."""
    from database import get_database_sync
    try:
        db = get_database_sync()
        if db is None:
            return 0
        now = datetime.now(timezone.utc)
        soon = (now + timedelta(minutes=60)).isoformat()
        auctions = await db.exchange_auctions.find({
            "status": "live",
            "ending_reminder_sent": {"$ne": True},
            "ends_at": {"$gt": now.isoformat(), "$lt": soon}
        }, {"_id": 0}).to_list(50)
        sent = 0
        for a in auctions:
            watchers = await db.exchange_watchlist.find({"auction_id": a["id"]}, {"_id": 0}).to_list(500)
            ends = datetime.fromisoformat(a["ends_at"])
            mins = max(1, int((ends - now).total_seconds() // 60))
            current = a.get("current_bid_inr") or a.get("starting_bid_inr", 0)
            for w in watchers:
                if not w.get("user_email"):
                    continue
                html = f"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0f172a;color:#e2e8f0;padding:30px;border-radius:12px;">
                    <h2 style="color:#f97316;">⏳ Auction Ending Soon!</h2>
                    <p>Hi {w.get('user_name', 'Aviator')},</p>
                    <p>The auction you're watching — <b>{a['title']}</b> — closes in <b style="color:#dc2626;">{mins} minute(s)</b>!</p>
                    <div style="background:#1e293b;border:1px dashed #f97316;padding:15px;border-radius:8px;text-align:center;margin:20px 0;">
                        <p style="margin:0;color:#94a3b8;font-size:12px;">CURRENT HIGHEST BID</p>
                        <p style="margin:5px 0;font-size:22px;color:#f97316;"><b>Rs. {current:,.0f}</b></p>
                        <p style="margin:0;color:#94a3b8;font-size:12px;">{a.get('bid_count', 0)} bid(s) so far</p>
                    </div>
                    <p><b>This is your last chance</b> — place your bid before the hammer falls! / आखिरी मौका, अभी बोली लगाएं!</p>
                    <p style="margin-top:25px;">Good luck! ✈️<br/><b>Team AirYatra Aviation Exchange</b></p>
                </div>
                """
                try:
                    from services.email_service import email_service
                    result = await email_service.send_email(
                        to_email=w["user_email"],
                        subject=f"⏳ Ending Soon — {a['title']} auction closes in {mins} min!",
                        html_body=html
                    )
                    if result.get("success"):
                        sent += 1
                except Exception as e:
                    logger.error(f"Auction reminder email failed for {w.get('user_email')}: {e}")
            await db.exchange_auctions.update_one({"id": a["id"]}, {"$set": {"ending_reminder_sent": True}})
        if sent:
            logger.info(f"Auction ending reminders sent: {sent}")
        return sent
    except Exception as e:
        logger.error(f"send_auction_ending_reminders failed: {e}")
        return 0


async def send_monthly_board_report():
    """Email the board report PDF to configured investors on the 1st of each month. Runs every 12 hours."""
    from database import get_database_sync
    try:
        db = get_database_sync()
        if db is None:
            return 0
        now = datetime.now(timezone.utc)
        if now.day != 1:
            return 0
        period_key = now.strftime("%Y-%m")
        doc = await db.ceo_settings.find_one({"type": "investor_report"}, {"_id": 0})
        if not doc or not doc.get("emails"):
            return 0
        if doc.get("last_sent_period") == period_key:
            return 0
        from routes.ceo_routes import _gather_kpis, _generate_board_report, _investor_email_html
        data = await _gather_kpis(db)
        pdf = _generate_board_report(data)
        fname = f"AirYatra_Board_Report_{data['period'].replace(' ', '_')}.pdf"
        from services.email_service import email_service
        sent = 0
        for email in doc["emails"]:
            try:
                result = await email_service.send_email(
                    to_email=email,
                    subject=f"AirYatra Monthly Board Report — {data['period']}",
                    html_body=_investor_email_html(data["period"]),
                    attachments=[{"filename": fname, "content": pdf}],
                )
                if result.get("success"):
                    sent += 1
            except Exception as e:
                logger.error(f"Board report email failed for {email}: {e}")
        await db.ceo_settings.update_one(
            {"type": "investor_report"},
            {"$set": {"last_sent_period": period_key, "last_sent_at": now.isoformat(), "last_sent_count": sent}}
        )
        logger.info(f"Monthly board report sent to {sent} investor(s)")
        return sent
    except Exception as e:
        logger.error(f"send_monthly_board_report failed: {e}")
        return 0


async def run_monthly_payroll():
    """Auto-generate payroll for the previous month on the 1st + email HR a summary. Runs every 12 hours."""
    from database import get_database_sync
    try:
        db = get_database_sync()
        if db is None:
            return 0
        now = datetime.now(timezone.utc)
        if now.day != 1:
            return 0
        settings = await db.hr_settings.find_one({"type": "payroll_auto_run"}, {"_id": 0}) or {}
        if settings.get("enabled") is False:
            return 0
        prev = now.replace(day=1) - timedelta(days=1)
        month, year = prev.month, prev.year
        period_key = f"{year}-{month:02d}"
        if settings.get("last_run_period") == period_key:
            return 0

        from routes.hr_routes import generate_payroll
        result = await generate_payroll(
            {"month": month, "year": year},
            {"id": "system_scheduler", "full_name": "AirYatra Scheduler"},
            db,
        )
        records = result.get("records", [])
        total_net = round(sum(r.get("net_salary", 0) for r in records), 2)
        period_label = prev.strftime("%B %Y")

        from services.email_service import email_service
        hr_users = await db.users.find(
            {"roles": {"$in": ["hr", "admin"]}, "is_active": True}, {"_id": 0, "email": 1}
        ).to_list(10)
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <div style="background:#0f172a;padding:20px 24px;"><span style="color:#fff;font-size:20px;font-weight:bold;">AirYatra</span><span style="color:#f97316;font-size:13px;margin-left:8px;">HRMS</span></div>
          <div style="padding:24px;">
            <h2 style="color:#f97316;margin:0 0 12px;font-size:18px;">🗓️ Monthly Payroll Auto-Run Complete — {period_label}</h2>
            <p style="color:#0f172a;font-size:14px;">Payroll drafts generated for <b>{len(records)}</b> employee(s). Total net payable: <b>Rs. {total_net:,.2f}</b></p>
            <p style="color:#64748b;font-size:13px;">Login to HR Dashboard → Payroll → Attendance &amp; Payroll to review, approve and mark salaries as paid.</p>
          </div>
        </div>"""
        sent = 0
        for u in hr_users:
            try:
                r = await email_service.send_email(
                    to_email=u["email"],
                    subject=f"Payroll Auto-Run Complete — {period_label} ({len(records)} employees)",
                    html_body=html,
                )
                if r.get("success"):
                    sent += 1
            except Exception as e:
                logger.error(f"Payroll summary email failed for {u.get('email')}: {e}")

        await db.hr_settings.update_one(
            {"type": "payroll_auto_run"},
            {"$set": {
                "last_run_period": period_key,
                "last_run_at": now.isoformat(),
                "last_run_count": len(records),
                "last_run_net": total_net,
            }},
            upsert=True,
        )
        logger.info(f"Monthly payroll auto-run: {len(records)} records for {period_label}, HR emails sent: {sent}")
        return len(records)
    except Exception as e:
        logger.error(f"run_monthly_payroll failed: {e}")
        return 0


def start_scheduler():
    """Start the background scheduler with all jobs."""
    
    # Auto-reassign stale leads every 15 minutes
    scheduler.add_job(
        auto_reassign_stale_leads,
        trigger=IntervalTrigger(minutes=15),
        id="auto_reassign_leads",
        name="Auto Reassign Stale Leads",
        replace_existing=True
    )
    
    # Process notifications every 5 minutes
    scheduler.add_job(
        send_pending_notifications,
        trigger=IntervalTrigger(minutes=5),
        id="send_notifications",
        name="Send Pending Notifications",
        replace_existing=True
    )
    
    # Cleanup old sessions every hour
    scheduler.add_job(
        cleanup_old_sessions,
        trigger=IntervalTrigger(hours=1),
        id="cleanup_sessions",
        name="Cleanup Old Sessions",
        replace_existing=True
    )
    
    # Generate daily reports at midnight
    scheduler.add_job(
        generate_daily_reports,
        trigger=IntervalTrigger(hours=24),
        id="daily_reports",
        name="Generate Daily Reports",
        replace_existing=True
    )
    
    # Voucher expiry alerts every 12 hours
    scheduler.add_job(
        send_voucher_expiry_alerts,
        trigger=IntervalTrigger(hours=12),
        id="voucher_expiry_alerts",
        name="Voucher Expiry Email Alerts",
        replace_existing=True
    )
    
    # Auction ending reminders every 10 minutes
    scheduler.add_job(
        send_auction_ending_reminders,
        trigger=IntervalTrigger(minutes=10),
        id="auction_ending_reminders",
        name="Auction Ending Watchlist Reminders",
        replace_existing=True
    )
    
    # Monthly investor board report (checks every 12 hours, sends on the 1st)
    scheduler.add_job(
        send_monthly_board_report,
        trigger=IntervalTrigger(hours=12),
        id="monthly_board_report",
        name="Monthly Investor Board Report",
        replace_existing=True
    )
    
    # Monthly payroll auto-run (checks every 12 hours, runs on the 1st for previous month)
    scheduler.add_job(
        run_monthly_payroll,
        trigger=IntervalTrigger(hours=12),
        id="monthly_payroll_run",
        name="Monthly Payroll Auto-Run",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Background scheduler started with jobs: auto_reassign_leads, send_notifications, cleanup_sessions, daily_reports, voucher_expiry_alerts, auction_ending_reminders, monthly_board_report, monthly_payroll_run")


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler stopped")
