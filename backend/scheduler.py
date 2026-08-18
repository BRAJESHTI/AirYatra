"""
Background Scheduler for AirYatra
Handles automated tasks like lead reassignment, notifications, etc.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import logging
import asyncio
import os

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


async def send_attendance_nudges():
    """Email staff who haven't checked in by 11 AM IST (skips Sundays, holidays, on-leave). Runs every 15 min."""
    from database import get_database_sync
    try:
        db = get_database_sync()
        if db is None:
            return 0
        now = datetime.now(timezone.utc)
        ist = now + timedelta(hours=5, minutes=30)
        if ist.hour < 11 or ist.hour >= 14:
            return 0
        if ist.weekday() == 6:
            return 0
        today = ist.date().isoformat()
        guard = await db.hr_settings.find_one({"type": "attendance_nudge"}, {"_id": 0}) or {}
        if guard.get("last_nudge_date") == today:
            return 0
        if await db.company_holidays.find_one({"date": today}):
            return 0

        staff_roles = ["employee", "hr", "sales", "finance", "support", "marketing", "operations"]
        staff = await db.users.find(
            {"roles": {"$in": staff_roles}, "is_active": {"$ne": False}},
            {"_id": 0, "id": 1, "email": 1, "full_name": 1}
        ).to_list(500)
        checked_in = {a["employee_id"] for a in await db.attendance.find({"date": today}, {"_id": 0, "employee_id": 1}).to_list(500)}
        on_leave = {l["employee_id"] for l in await db.leaves.find(
            {"status": "approved", "start_date": {"$lte": today}, "end_date": {"$gte": today}},
            {"_id": 0, "employee_id": 1}).to_list(500)}
        missing = [s for s in staff if s["id"] not in checked_in and s["id"] not in on_leave and s.get("email")]

        from services.email_service import email_service
        sent = 0
        for s in missing:
            try:
                html = f"""
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                  <div style="background:#0f172a;padding:20px 24px;"><span style="color:#fff;font-size:20px;font-weight:bold;">AirYatra</span><span style="color:#f97316;font-size:13px;margin-left:8px;">HRMS</span></div>
                  <div style="padding:24px;">
                    <h2 style="color:#f97316;margin:0 0 12px;font-size:18px;">⏰ Check-in Reminder / चेक-इन रिमाइंडर</h2>
                    <p style="color:#0f172a;font-size:14px;">Hi {s.get('full_name', '')}, aapne aaj ({today}) abhi tak check-in nahi kiya hai.</p>
                    <p style="color:#64748b;font-size:13px;">Employee Portal → Attendance → Check In (selfie ke saath). Agar aap chhutti par hain to please leave apply karein.</p>
                  </div>
                </div>"""
                r = await email_service.send_email(
                    to_email=s["email"],
                    subject=f"⏰ Reminder: You haven't checked in today ({today}) — AirYatra HRMS",
                    html_body=html,
                )
                if r.get("success"):
                    sent += 1
            except Exception as e:
                logger.error(f"Nudge email failed for {s.get('email')}: {e}")

        await db.hr_settings.update_one(
            {"type": "attendance_nudge"},
            {"$set": {"last_nudge_date": today, "last_nudge_at": now.isoformat(), "last_nudge_count": sent}},
            upsert=True,
        )
        logger.info(f"Attendance nudge: {sent}/{len(missing)} reminder emails sent for {today}")
        return sent
    except Exception as e:
        logger.error(f"send_attendance_nudges failed: {e}")
        return 0


async def send_erp_weekly_digest():
    """Monday morning (IST) ERP digest email to operators: flights, alerts, upcoming maintenance. Runs every 6h."""
    from database import get_database_sync
    try:
        db = get_database_sync()
        if db is None:
            return 0
        now = datetime.now(timezone.utc)
        ist = now + timedelta(hours=5, minutes=30)
        if ist.weekday() != 0 or ist.hour < 8:
            return 0
        week_key = f"{ist.isocalendar()[0]}-W{ist.isocalendar()[1]}"
        guard = await db.hr_settings.find_one({"type": "erp_weekly_digest"}, {"_id": 0}) or {}
        if guard.get("last_week") == week_key:
            return 0

        from services.email_service import email_service
        week_ago = (now - timedelta(days=7)).isoformat()
        two_weeks = (now + timedelta(days=14)).date().isoformat()
        today = now.date().isoformat()
        operators = await db.operators.find({}, {"_id": 0, "id": 1, "user_id": 1, "company_name": 1}).to_list(200)
        sent = 0
        for op in operators:
            try:
                user = await db.users.find_one({"id": op["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
                if not user or not user.get("email"):
                    continue
                fleet = await db.aircraft.find({"operator_id": op["id"]}, {"_id": 0, "id": 1, "registration_number": 1, "model_name": 1, "total_flight_hours": 1, "last_maintenance_hours": 1}).to_list(100)
                if not fleet:
                    continue
                fleet_ids = [a["id"] for a in fleet]
                week_recs = await db.flight_records.find({"aircraft_id": {"$in": fleet_ids}, "departure_time": {"$gte": week_ago[:10]}}, {"_id": 0}).to_list(2000)
                week_hours = round(sum(r.get("flight_duration_minutes", 0) for r in week_recs) / 60, 1)
                overdue = await db.maintenance_schedules.count_documents({"aircraft_id": {"$in": fleet_ids}, "status": "scheduled", "scheduled_date": {"$lt": today}})
                upcoming = await db.maintenance_schedules.find(
                    {"aircraft_id": {"$in": fleet_ids}, "status": "scheduled", "scheduled_date": {"$gte": today, "$lte": two_weeks}},
                    {"_id": 0, "type": 1, "scheduled_date": 1, "aircraft_id": 1}).to_list(50)
                hours_due = len([a for a in fleet if (a.get("total_flight_hours", 0) - a.get("last_maintenance_hours", 0)) >= a.get("maintenance_interval_hours", 100)])
                doc_alerts = await db.aircraft_documents.count_documents(
                    {"aircraft_id": {"$in": fleet_ids}, "status": {"$ne": "deleted"}, "expiry_date": {"$ne": None, "$lte": (now + timedelta(days=45)).date().isoformat()}})
                up_html = "".join(f"<li style='color:#0f172a;font-size:13px;'>{u.get('type','').title()} — {(u.get('scheduled_date') or '')[:10]}</li>" for u in upcoming[:5]) or "<li style='color:#64748b;font-size:13px;'>None in next 14 days</li>"
                html = f"""
                <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                  <div style="background:#0f172a;padding:20px 24px;"><span style="color:#fff;font-size:20px;font-weight:bold;">AirYatra</span><span style="color:#f97316;font-size:13px;margin-left:8px;">ERP Weekly Digest</span></div>
                  <div style="padding:24px;">
                    <h2 style="color:#f97316;margin:0 0 12px;font-size:18px;">🛩️ {op.get('company_name', 'Your Fleet')} — Weekly Summary</h2>
                    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;">
                      <tr><td style="padding:6px 12px;color:#64748b;font-size:14px;">Flights (last 7 days)</td><td style="padding:6px 12px;color:#0f172a;font-weight:600;">{len(week_recs)} flights • {week_hours}h</td></tr>
                      <tr><td style="padding:6px 12px;color:#64748b;font-size:14px;">Overdue maintenance</td><td style="padding:6px 12px;color:{'#ef4444' if overdue else '#22c55e'};font-weight:600;">{overdue}</td></tr>
                      <tr><td style="padding:6px 12px;color:#64748b;font-size:14px;">Aircraft over 100h since maintenance</td><td style="padding:6px 12px;color:{'#ef4444' if hours_due else '#22c55e'};font-weight:600;">{hours_due}</td></tr>
                      <tr><td style="padding:6px 12px;color:#64748b;font-size:14px;">Documents expiring / expired (45d)</td><td style="padding:6px 12px;color:{'#ef4444' if doc_alerts else '#22c55e'};font-weight:600;">{doc_alerts}</td></tr>
                    </table>
                    <p style="color:#0f172a;font-size:14px;margin:16px 0 4px;"><b>Upcoming maintenance (14 days):</b></p>
                    <ul style="margin:4px 0 16px;">{up_html}</ul>
                    <p style="color:#64748b;font-size:12px;">Full details: Operator Dashboard → ERP Command Center</p>
                  </div>
                </div>"""
                r = await email_service.send_email(
                    to_email=user["email"],
                    subject=f"🛩️ ERP Weekly Digest — {len(week_recs)} flights, {overdue + hours_due} critical alerts",
                    html_body=html,
                )
                if r.get("success"):
                    sent += 1
            except Exception as e:
                logger.error(f"ERP digest failed for operator {op.get('id')}: {e}")

        await db.hr_settings.update_one(
            {"type": "erp_weekly_digest"},
            {"$set": {"last_week": week_key, "last_run_at": now.isoformat(), "last_sent_count": sent}},
            upsert=True,
        )
        logger.info(f"ERP weekly digest: {sent} operator emails sent for {week_key}")
        return sent
    except Exception as e:
        logger.error(f"send_erp_weekly_digest failed: {e}")
        return 0


async def send_auto_balance_reminders():
    """
    Automatically send balance reminder emails to customers with pending balance
    when their departure is 3 days away.
    Runs twice daily, sends max 1 reminder per booking.
    """
    from database import get_database_sync
    from services.email_service import email_service
    
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for auto balance reminders")
            return 0
        
        now = datetime.now(timezone.utc)
        
        # Target date: 3 days from now
        target_date = (now + timedelta(days=3)).strftime("%Y-%m-%d")
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        day_after = (now + timedelta(days=2)).strftime("%Y-%m-%d")
        
        # Find bookings with:
        # - payment_status = "paid" (advance paid, balance pending)
        # - departure_date is within 1-3 days
        # - No auto reminder sent yet for this departure
        bookings = await db.inquiries.find({
            "payment_status": "paid",
            "departure_date": {"$in": [target_date, day_after, tomorrow]},
            "auto_balance_reminder_sent": {"$ne": True}
        }, {"_id": 0}).to_list(100)
        
        if not bookings:
            logger.info("No pending balance reminders to send")
            return 0
        
        sent = 0
        for booking in bookings:
            try:
                # Calculate remaining balance
                total_amount = float(booking.get("accepted_quote", {}).get("amount") or booking.get("estimated_price") or 0)
                if total_amount <= 0:
                    continue
                
                # Get paid transactions
                txns = await db.payment_transactions.find(
                    {"booking_id": booking["id"], "payment_status": "paid"},
                    {"_id": 0, "amount": 1, "voucher_discount": 1}
                ).to_list(10)
                credited = sum(float(t.get("amount", 0)) + float(t.get("voucher_discount", 0)) for t in txns)
                remaining = max(0.0, round(total_amount - credited, 2))
                
                if remaining <= 0:
                    # No balance remaining, mark as done
                    await db.inquiries.update_one(
                        {"id": booking["id"]},
                        {"$set": {"auto_balance_reminder_sent": True}}
                    )
                    continue
                
                # Get customer email
                customer = await db.users.find_one(
                    {"id": booking.get("customer_id")},
                    {"_id": 0, "email": 1, "full_name": 1}
                )
                if not customer or not customer.get("email"):
                    continue
                
                customer_name = customer.get("full_name", "Customer")
                inquiry_number = booking.get("inquiry_number", booking.get("id", "")[:8])
                route = f"{booking.get('from_location', '')} → {booking.get('to_location', '')}"
                departure_date = booking.get("departure_date", "")
                
                # Calculate days until departure
                days_left = (datetime.strptime(departure_date, "%Y-%m-%d") - now.replace(hour=0, minute=0, second=0, microsecond=0).replace(tzinfo=None)).days
                urgency = "⚠️ URGENT" if days_left <= 1 else "⏰"
                
                subject = f"{urgency} Payment Reminder - ₹{remaining:,.0f} Balance Due in {days_left} day(s) | Booking #{inquiry_number}"
                
                html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #dc2626, #ea580c); padding: 30px; text-align: center; }}
        .content {{ padding: 30px; }}
        .amount-box {{ background: #1a1a2e; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; border: 2px solid #dc2626; }}
        .amount {{ font-size: 36px; font-weight: bold; color: #f97316; }}
        .countdown {{ background: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; font-size: 18px; }}
        .info-row {{ display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #2a2a4e; }}
        .btn {{ display: inline-block; background: #22c55e; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin-top: 15px; }}
        .footer {{ background: #0f0f1e; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size:50px;">🚁</div>
            <h1 style="margin:10px 0 0;">Payment Reminder</h1>
            <p style="margin:5px 0 0; opacity:0.9;">Your flight is approaching!</p>
        </div>
        <div class="content">
            <p>Namaste <strong>{customer_name}</strong>,</p>
            
            <div class="countdown">
                <strong>🗓️ Your helicopter departs in {days_left} day(s)!</strong><br>
                <small>Departure: {departure_date}</small>
            </div>
            
            <p>Please complete your remaining balance payment to ensure a smooth boarding experience.</p>
            
            <div class="amount-box">
                <p style="margin:0 0 10px; color:#94a3b8;">Balance Amount Due</p>
                <div class="amount">₹{remaining:,.0f}</div>
            </div>
            
            <div style="background:#1a1a2e; border-radius:12px; padding:20px; margin:15px 0;">
                <h3 style="margin-top:0; color:#f97316;">📋 Booking Details</h3>
                <div class="info-row">
                    <span style="color:#94a3b8;">Booking Ref:</span>
                    <span style="font-weight:600;">#{inquiry_number}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Route:</span>
                    <span style="font-weight:600;">{route}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Departure:</span>
                    <span style="font-weight:600; color:#dc2626;">{departure_date}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Total Amount:</span>
                    <span style="font-weight:600;">₹{total_amount:,.0f}</span>
                </div>
                <div class="info-row">
                    <span style="color:#94a3b8;">Already Paid:</span>
                    <span style="font-weight:600; color:#22c55e;">₹{credited:,.0f}</span>
                </div>
            </div>
            
            <p style="text-align:center;">
                <a href="https://airyatra.co.in/customer/inquiries" class="btn">💳 Pay Balance Now</a>
            </p>
            
            <p style="color:#fbbf24; font-size:13px; background:#422006; padding:15px; border-radius:8px; margin-top:20px; text-align:center;">
                ⚠️ Payment must be completed before departure to avoid flight cancellation.
            </p>
        </div>
        <div class="footer">
            <p>AirYatra - India's Premium Helicopter Booking Platform</p>
            <p>📞 Support: info@airyatra.co.in</p>
            <p>© 2025 AirYatra Aviation Pvt. Ltd.</p>
        </div>
    </div>
</body>
</html>
"""
                
                # Send email
                result = await email_service.send_email(
                    to_email=customer["email"],
                    subject=subject,
                    html_body=html_body
                )
                
                if result.get("success"):
                    # Mark reminder as sent
                    await db.inquiries.update_one(
                        {"id": booking["id"]},
                        {"$set": {
                            "auto_balance_reminder_sent": True,
                            "auto_balance_reminder_at": now.isoformat(),
                            "auto_balance_reminder_amount": remaining
                        }}
                    )
                    sent += 1
                    logger.info(f"Auto balance reminder sent to {customer['email']} for booking {inquiry_number}")
                    
            except Exception as e:
                logger.error(f"Failed to send auto reminder for booking {booking.get('id')}: {e}")
        
        logger.info(f"Auto balance reminders: {sent} emails sent")
        return sent
        
    except Exception as e:
        logger.error(f"send_auto_balance_reminders failed: {e}")
        return 0


async def send_boarding_reminders():
    """Boarding reminder the evening before departure with pre-flight checklist progress.
    Runs every 2 hours; sends only between 5 PM - 10 PM IST, once per booking."""
    from database import get_database_sync
    from services.email_service import email_service
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for boarding reminders")
            return 0

        now = datetime.now(timezone.utc)
        ist = now + timedelta(hours=5, minutes=30)
        if not (17 <= ist.hour <= 22):
            return 0

        tomorrow = (ist + timedelta(days=1)).strftime("%Y-%m-%d")
        bookings = await db.inquiries.find({
            "departure_date": tomorrow,
            "$or": [
                {"status": {"$in": ["confirmed", "payment_completed", "in_progress"]}},
                {"payment_status": {"$in": ["paid", "fully_paid"]}},
            ],
            "boarding_reminder_sent": {"$ne": True},
        }, {"_id": 0}).to_list(100)

        if not bookings:
            return 0

        from routes.preflight_routes import PASSENGER_CHECKLIST
        sent = 0
        for booking in bookings:
            try:
                customer = await db.users.find_one(
                    {"id": booking.get("customer_id")}, {"_id": 0, "email": 1, "full_name": 1})
                if not customer or not customer.get("email"):
                    continue

                cl = await db.preflight_checklists.find_one(
                    {"booking_id": booking["id"], "type": "passenger"}, {"_id": 0})
                saved = {i.get("item_id"): i for i in (cl or {}).get("items", [])}
                total = len(PASSENGER_CHECKLIST)
                checked = sum(1 for it in PASSENGER_CHECKLIST if (saved.get(it["id"]) or {}).get("checked"))
                pending_required = [it["item"] for it in PASSENGER_CHECKLIST
                                    if it.get("required") and not (saved.get(it["id"]) or {}).get("checked")]

                route = f"{booking.get('pickup_location') or booking.get('from_location', '')} → {booking.get('drop_location') or booking.get('to_location', '')}"
                pickup_time = booking.get("pickup_time") or ""
                number = booking.get("inquiry_number") or booking.get("booking_number") or booking["id"][:8]
                customer_name = customer.get("full_name", "Traveller")
                frontend_url = os.environ.get("FRONTEND_URL", "")

                if pending_required:
                    pending_html = "".join(
                        f"<li style='margin:6px 0;color:#b45309;'>⬜ {p}</li>" for p in pending_required)
                    checklist_block = f"""
                        <p style="color:#b45309;font-weight:bold;">⚠️ {len(pending_required)} required check(s) still pending:</p>
                        <ul style="padding-left:18px;">{pending_html}</ul>"""
                else:
                    checklist_block = "<p style='color:#15803d;font-weight:bold;'>✅ All required pre-flight checks complete — you're ready to fly!</p>"

                html = f"""
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
                  <div style="background:linear-gradient(135deg,#f97316,#f59e0b);padding:24px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:22px;">✈️ Your Flight is Tomorrow!</h1>
                    <p style="margin:6px 0 0;color:#fff7ed;">Boarding reminder from AirYatra</p>
                  </div>
                  <div style="padding:24px;">
                    <p>Dear {customer_name},</p>
                    <p>Your flight <b style="color:#fb923c;">{number}</b> departs <b>tomorrow ({tomorrow})</b>{f" at <b>{pickup_time}</b>" if pickup_time else ""}.</p>
                    <div style="background:#1e293b;border-radius:10px;padding:14px 18px;margin:14px 0;">
                      <p style="margin:0;font-size:16px;"><b>Route:</b> {route}</p>
                    </div>
                    <h3 style="color:#fb923c;margin-bottom:6px;">Pre-flight Checklist: {checked}/{total} complete</h3>
                    {checklist_block}
                    <div style="background:#1e293b;border-radius:10px;padding:14px 18px;margin:16px 0;">
                      <p style="margin:0 0 6px;"><b>📍 Boarding tips:</b></p>
                      <ul style="margin:0;padding-left:18px;color:#94a3b8;">
                        <li>Arrive at the helipad/airport <b>45 minutes early</b></li>
                        <li>Carry government photo ID for all passengers</li>
                        <li>Keep baggage within the allowed weight limit</li>
                      </ul>
                    </div>
                    {f'<div style="text-align:center;margin:20px 0;"><a href="{frontend_url}/customer" style="background:#f97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Complete Your Checklist</a></div>' if frontend_url else ''}
                    <p style="color:#64748b;font-size:12px;">Safe travels!<br/>Team AirYatra</p>
                  </div>
                </div>"""

                result = await email_service.send_email(
                    to_email=customer["email"],
                    subject=f"✈️ Boarding Tomorrow — {route} | Checklist {checked}/{total} done",
                    html_body=html,
                )
                await db.inquiries.update_one(
                    {"id": booking["id"]},
                    {"$set": {"boarding_reminder_sent": True,
                              "boarding_reminder_sent_at": now.isoformat()}})
                sent += 1
                logger.info(f"Boarding reminder sent for {number} to {customer['email']} (email ok={result.get('success', result)})")
            except Exception as e:
                logger.error(f"Boarding reminder failed for booking {booking.get('id')}: {e}")

        logger.info(f"Boarding reminders sent: {sent}")
        return sent
    except Exception as e:
        logger.error(f"send_boarding_reminders failed: {e}")
        return 0



async def send_departure_reminders_24h():
    """Friendly reminder ~24h (22-26h window) before flight/heli/yacht departure. Runs hourly, once per booking."""
    from database import get_database_sync
    from services.email_service import email_service
    try:
        db = get_database_sync()
        if db is None:
            return 0
        now = datetime.now(timezone.utc)
        ist_now = now + timedelta(hours=5, minutes=30)
        dates = [(ist_now + timedelta(days=d)).strftime("%Y-%m-%d") for d in (0, 1, 2)]
        candidates = []

        flight_q = {
            "$and": [
                {"$or": [{"departure_date": {"$in": dates}}, {"travel_date": {"$in": dates}}]},
                {"$or": [
                    {"status": {"$in": ["confirmed", "payment_completed", "in_progress", "passenger_details_filled"]}},
                    {"payment_status": {"$in": ["paid", "fully_paid", "partially_paid"]}},
                ]},
            ],
            "departure_reminder_24h_sent": {"$ne": True},
        }
        for coll in (db.inquiries, db.bookings):
            for b in await coll.find(flight_q, {"_id": 0}).to_list(200):
                candidates.append(("flight", coll, b))

        vertical_q = {
            "start_date": {"$in": dates},
            "payment_status": "paid",
            "status": {"$nin": ["cancelled", "cancellation_requested"]},
            "departure_reminder_24h_sent": {"$ne": True},
        }
        for b in await db.vertical_bookings.find(vertical_q, {"_id": 0}).to_list(200):
            candidates.append(("vertical", db.vertical_bookings, b))

        sent = 0
        for kind, coll, booking in candidates:
            try:
                if kind == "flight":
                    dep_date = (booking.get("departure_date") or booking.get("travel_date") or "")[:10]
                    dep_time = (booking.get("departure_time") or booking.get("pickup_time") or booking.get("travel_time") or "09:00")[:5]
                else:
                    dep_date = (booking.get("start_date") or "")[:10]
                    dep_time = "09:00"
                try:
                    dep = datetime.fromisoformat(f"{dep_date}T{dep_time}:00+05:30")
                except Exception:
                    continue
                hours_left = (dep - now).total_seconds() / 3600
                if not (10 <= hours_left <= 30):
                    continue

                if kind == "vertical":
                    email = booking.get("customer_email")
                    name = booking.get("customer_name") or "Traveller"
                else:
                    cust = await db.users.find_one(
                        {"id": booking.get("customer_id") or booking.get("user_id")},
                        {"_id": 0, "email": 1, "full_name": 1})
                    email = (cust or {}).get("email")
                    name = (cust or {}).get("full_name") or "Traveller"
                if not email:
                    continue

                number = booking.get("booking_number") or booking.get("inquiry_number") or booking["id"][:8]
                if kind == "vertical":
                    vertical = (booking.get("vertical") or "experience").title()
                    icon = "⛵" if booking.get("vertical") in ("yacht", "cruise", "marine") else "🚁"
                    what = f"{booking.get('asset_name')} ({vertical})"
                    where = booking.get("city") or ""
                else:
                    icon = "✈️"
                    what = f"{booking.get('from_location') or booking.get('pickup_location', '')} → {booking.get('to_location') or booking.get('drop_location', '')}"
                    where = ""

                html = f"""
                <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;">
                  <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:26px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:22px;">{icon} 24 Hours To Go!</h1>
                    <p style="margin:6px 0 0;color:#e0f2fe;">Your AirYatra journey departs tomorrow</p>
                  </div>
                  <div style="padding:26px;">
                    <p>Dear {name},</p>
                    <p>Just a friendly reminder — your booking <b style="color:#38bdf8;">{number}</b> departs <b>tomorrow</b> — about 24 hours from now.</p>
                    <div style="background:#1e293b;border-radius:10px;padding:16px 18px;margin:16px 0;">
                      <p style="margin:4px 0;"><b>{'Experience' if kind == 'vertical' else 'Route'}:</b> {what}</p>
                      {f'<p style="margin:4px 0;"><b>Location:</b> {where}</p>' if where else ''}
                      <p style="margin:4px 0;"><b>Departure:</b> {dep_date} at {dep_time} IST</p>
                    </div>
                    <div style="background:#1e293b;border-radius:10px;padding:14px 18px;margin:16px 0;">
                      <p style="margin:0 0 6px;"><b>📍 Quick tips:</b></p>
                      <ul style="margin:0;padding-left:18px;color:#94a3b8;">
                        <li>Arrive <b>45 minutes early</b> at the boarding point</li>
                        <li>Carry government photo ID for all passengers</li>
                        <li>Check the weather and dress comfortably</li>
                      </ul>
                    </div>
                    <p style="color:#64748b;font-size:12px;">We can't wait to host you!<br/>Team AirYatra</p>
                  </div>
                </div>"""

                await email_service.send_email(
                    to_email=email,
                    subject=f"{icon} 24 Hours To Go — {what} departs tomorrow | AirYatra",
                    html_body=html)
                await coll.update_one(
                    {"id": booking["id"]},
                    {"$set": {"departure_reminder_24h_sent": True,
                              "departure_reminder_24h_at": now.isoformat()}})
                sent += 1
                logger.info(f"24h departure reminder sent for {number} to {email}")
            except Exception as e:
                logger.error(f"24h reminder failed for booking {booking.get('id')}: {e}")

        if sent:
            logger.info(f"24h departure reminders sent: {sent}")
        return sent
    except Exception as e:
        logger.error(f"send_departure_reminders_24h failed: {e}")
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

    # 24h departure reminders (flights + yacht/marine) every hour
    scheduler.add_job(
        send_departure_reminders_24h,
        trigger=IntervalTrigger(hours=1),
        id="departure_reminders_24h",
        name="24h Departure Reminders (Flight/Yacht)",
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
    
    # Attendance nudge for missing staff (checks every 15 min, sends after 11 AM IST once/day)
    scheduler.add_job(
        send_attendance_nudges,
        trigger=IntervalTrigger(minutes=15),
        id="attendance_nudge",
        name="Missing Staff Check-in Nudge",
        replace_existing=True
    )
    
    # ERP weekly digest to operators (checks every 6 hours, sends Monday 8AM+ IST once/week)
    scheduler.add_job(
        send_erp_weekly_digest,
        trigger=IntervalTrigger(hours=6),
        id="erp_weekly_digest",
        name="Operator ERP Weekly Digest",
        replace_existing=True
    )
    
    # Auto balance reminders - 3 days before departure (checks twice daily)
    scheduler.add_job(
        send_auto_balance_reminders,
        trigger=IntervalTrigger(hours=12),
        id="auto_balance_reminders",
        name="Auto Balance Reminders (3 days before departure)",
        replace_existing=True
    )
    
    # Boarding reminders - evening before departure with pre-flight checklist progress
    scheduler.add_job(
        send_boarding_reminders,
        trigger=IntervalTrigger(hours=2),
        id="boarding_reminders",
        name="Boarding Reminders (evening before departure)",
        replace_existing=True
    )
    
    # Pilot document expiry alerts - Daily check at 9 AM IST
    scheduler.add_job(
        check_pilot_document_expiry,
        trigger=IntervalTrigger(hours=24),
        id="pilot_document_expiry",
        name="Pilot Document Expiry Alerts (30 days notice)",
        replace_existing=True
    )
    
    # Settlement auto-sync - Daily (Stripe)
    scheduler.add_job(
        sync_stripe_settlements,
        trigger=IntervalTrigger(hours=24),
        id="stripe_settlement_sync",
        name="Stripe Settlement Auto-Sync (Daily)",
        replace_existing=True
    )
    
    # Settlement auto-sync - Daily (Razorpay)
    scheduler.add_job(
        sync_razorpay_settlements,
        trigger=IntervalTrigger(hours=24),
        id="razorpay_settlement_sync",
        name="Razorpay Settlement Auto-Sync (Daily)",
        replace_existing=True
    )
    
    # Scheduled finance reports - Check every 6 hours
    scheduler.add_job(
        process_scheduled_finance_reports,
        trigger=IntervalTrigger(hours=6),
        id="scheduled_finance_reports",
        name="Process Scheduled Finance Reports",
        replace_existing=True
    )
    
    # AI Compliance Monitor - Daily check at 6 AM
    scheduler.add_job(
        run_daily_compliance_monitor,
        trigger=IntervalTrigger(hours=24),
        id="daily_compliance_monitor",
        name="Daily Aircraft Compliance Check",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Background scheduler started with jobs: auto_reassign_leads, send_notifications, cleanup_sessions, daily_reports, voucher_expiry_alerts, auction_ending_reminders, monthly_board_report, monthly_payroll_run, attendance_nudge, erp_weekly_digest, auto_balance_reminders, pilot_document_expiry, stripe_settlement_sync, razorpay_settlement_sync, scheduled_finance_reports, daily_compliance_monitor")


async def check_pilot_document_expiry():
    """
    Check for pilot documents expiring in 30 days and send alerts.
    Runs daily at 9 AM IST.
    """
    from database import get_database_sync
    
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for pilot document expiry check")
            return
        
        now = datetime.now(timezone.utc)
        thirty_days_later = now + timedelta(days=30)
        
        # Find pilots with documents expiring in 30 days
        expiring_pilots = []
        
        all_pilots = await db.pilots.find({}, {"_id": 0}).to_list(500)
        
        for pilot in all_pilots:
            alerts = []
            
            # Check license expiry
            license_expiry = pilot.get("license_expiry")
            if license_expiry:
                try:
                    expiry_date = datetime.fromisoformat(license_expiry.replace('Z', '+00:00'))
                    days_until = (expiry_date - now).days
                    if 0 < days_until <= 30:
                        alerts.append({
                            "type": "license",
                            "document": "Pilot License",
                            "expiry_date": license_expiry,
                            "days_remaining": days_until,
                            "urgency": "critical" if days_until <= 7 else "warning" if days_until <= 14 else "info"
                        })
                except (ValueError, TypeError):
                    pass
            
            # Check medical expiry
            medical_expiry = pilot.get("medical_expiry")
            if medical_expiry:
                try:
                    expiry_date = datetime.fromisoformat(medical_expiry.replace('Z', '+00:00'))
                    days_until = (expiry_date - now).days
                    if 0 < days_until <= 30:
                        alerts.append({
                            "type": "medical",
                            "document": "Medical Certificate",
                            "expiry_date": medical_expiry,
                            "days_remaining": days_until,
                            "urgency": "critical" if days_until <= 7 else "warning" if days_until <= 14 else "info"
                        })
                except (ValueError, TypeError):
                    pass
            
            # Check type rating expiry
            type_rating_expiry = pilot.get("type_rating_expiry")
            if type_rating_expiry:
                try:
                    expiry_date = datetime.fromisoformat(type_rating_expiry.replace('Z', '+00:00'))
                    days_until = (expiry_date - now).days
                    if 0 < days_until <= 30:
                        alerts.append({
                            "type": "type_rating",
                            "document": "Type Rating",
                            "expiry_date": type_rating_expiry,
                            "days_remaining": days_until,
                            "urgency": "critical" if days_until <= 7 else "warning" if days_until <= 14 else "info"
                        })
                except (ValueError, TypeError):
                    pass
            
            if alerts:
                expiring_pilots.append({
                    "pilot": pilot,
                    "alerts": alerts
                })
        
        if not expiring_pilots:
            logger.info("No pilot documents expiring in next 30 days")
            return
        
        # Group by operator and send alerts
        operator_alerts = {}
        for item in expiring_pilots:
            pilot = item["pilot"]
            operator_id = pilot.get("operator_id")
            if operator_id:
                if operator_id not in operator_alerts:
                    operator_alerts[operator_id] = []
                operator_alerts[operator_id].append(item)
        
        # Send email to each operator
        for operator_id, pilots_data in operator_alerts.items():
            try:
                operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
                if not operator:
                    continue
                
                operator_user = await db.users.find_one({"id": operator.get("user_id")}, {"_id": 0, "email": 1})
                if not operator_user or not operator_user.get("email"):
                    continue
                
                # Build email content
                await send_pilot_document_expiry_email(
                    operator_email=operator_user["email"],
                    operator_name=operator.get("company_name", "Operator"),
                    pilots_data=pilots_data
                )
                
                # Record notification sent
                for item in pilots_data:
                    for alert in item["alerts"]:
                        await db.notifications.insert_one({
                            "id": str(uuid4()),
                            "type": "pilot_document_expiry",
                            "recipient_id": operator.get("user_id"),
                            "pilot_id": item["pilot"].get("id"),
                            "document_type": alert["type"],
                            "days_remaining": alert["days_remaining"],
                            "created_at": now.isoformat(),
                            "read": False
                        })
                
                logger.info(f"Sent pilot document expiry alert to {operator.get('company_name')}")
                
            except Exception as e:
                logger.error(f"Failed to send pilot document expiry alert to operator {operator_id}: {e}")
        
        logger.info(f"Pilot document expiry check completed. Found {len(expiring_pilots)} pilots with expiring documents")
        
    except Exception as e:
        logger.error(f"Pilot document expiry check failed: {e}")


async def send_pilot_document_expiry_email(operator_email: str, operator_name: str, pilots_data: list):
    """Send pilot document expiry alert email to operator"""
    from services.email_service import email_service
    from uuid import uuid4
    
    # Build pilot alerts HTML
    pilot_rows = ""
    for item in pilots_data:
        pilot = item["pilot"]
        for alert in item["alerts"]:
            urgency_color = "#ef4444" if alert["urgency"] == "critical" else "#f97316" if alert["urgency"] == "warning" else "#eab308"
            urgency_label = "CRITICAL" if alert["urgency"] == "critical" else "WARNING" if alert["urgency"] == "warning" else "INFO"
            
            pilot_rows += f"""
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #334155;">{pilot.get('name', 'Unknown')}</td>
                <td style="padding: 12px; border-bottom: 1px solid #334155;">{alert['document']}</td>
                <td style="padding: 12px; border-bottom: 1px solid #334155;">{alert['expiry_date'][:10]}</td>
                <td style="padding: 12px; border-bottom: 1px solid #334155;">
                    <span style="background: {urgency_color}20; color: {urgency_color}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                        {alert['days_remaining']} days - {urgency_label}
                    </span>
                </td>
            </tr>
            """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; }}
            .header h1 {{ color: white; margin: 0; font-size: 24px; }}
            .content {{ padding: 30px; }}
            .alert-box {{ background: #f97316/10; border: 1px solid #f9731640; border-radius: 8px; padding: 15px; margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ text-align: left; padding: 12px; background: #0f172a; color: #94a3b8; font-size: 12px; text-transform: uppercase; }}
            td {{ color: #e2e8f0; }}
            .cta {{ display: block; background: #f97316; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; text-align: center; font-weight: 600; margin: 20px 0; }}
            .footer {{ text-align: center; padding: 20px; color: #64748b; font-size: 12px; border-top: 1px solid #334155; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ Pilot Document Expiry Alert</h1>
            </div>
            <div class="content">
                <p>Namaste {operator_name}! 🙏</p>
                
                <div class="alert-box">
                    <p style="margin: 0; color: #f97316; font-weight: 600;">
                        The following pilot documents are expiring within 30 days:
                    </p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Pilot Name</th>
                            <th>Document</th>
                            <th>Expiry Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pilot_rows}
                    </tbody>
                </table>
                
                <a href="https://airyatra.com/operator/pilots" class="cta">
                    Manage Pilot Documents →
                </a>
                
                <p style="color: #94a3b8; font-size: 14px;">
                    Please ensure these documents are renewed before expiry to avoid grounding.
                    DGCA regulations require valid documents for all flight operations.
                </p>
            </div>
            <div class="footer">
                <p>🚁 AirYatra - India's Premium Air Mobility Platform</p>
                <p>This is an automated alert for document compliance.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    await email_service.send_email(
        to_email=operator_email,
        subject=f"⚠️ Pilot Document Expiry Alert - {len(pilots_data)} pilots - AirYatra",
        html_content=html_content
    )


# ==================== SETTLEMENT AUTO-SYNC ====================

async def sync_stripe_settlements():
    """
    Sync Stripe settlements/payouts data daily.
    Fetches recent payouts and balance transactions.
    """
    from database import get_database_sync
    import os
    
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for Stripe settlement sync")
            return
        
        stripe_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_key:
            logger.warning("STRIPE_API_KEY not configured, skipping settlement sync")
            return
        
        # Import Stripe
        try:
            import stripe
            stripe.api_key = stripe_key
        except ImportError:
            logger.warning("Stripe library not installed")
            return
        
        logger.info("Starting Stripe settlement sync...")
        
        # Fetch recent payouts (last 30 days)
        thirty_days_ago = int((datetime.now(timezone.utc) - timedelta(days=30)).timestamp())
        
        try:
            payouts = stripe.Payout.list(
                limit=100,
                created={"gte": thirty_days_ago}
            )
            
            synced_count = 0
            for payout in payouts.data:
                # Check if already synced
                existing = await db.stripe_settlements.find_one({"payout_id": payout.id})
                if existing:
                    continue
                
                settlement_doc = {
                    "id": str(uuid4()),
                    "payout_id": payout.id,
                    "amount": payout.amount / 100,  # Convert from cents
                    "currency": payout.currency.upper(),
                    "status": payout.status,
                    "arrival_date": datetime.fromtimestamp(payout.arrival_date, tz=timezone.utc) if payout.arrival_date else None,
                    "created_at": datetime.fromtimestamp(payout.created, tz=timezone.utc),
                    "method": payout.method,
                    "destination": payout.destination,
                    "source_type": "stripe_payout",
                    "synced_at": datetime.now(timezone.utc)
                }
                
                await db.stripe_settlements.insert_one(settlement_doc)
                synced_count += 1
            
            logger.info(f"Stripe settlement sync complete: {synced_count} new payouts synced")
            
            # Also fetch recent balance transactions for detailed reconciliation
            balance_txns = stripe.BalanceTransaction.list(
                limit=100,
                created={"gte": thirty_days_ago},
                type="charge"
            )
            
            charge_synced = 0
            for txn in balance_txns.data:
                existing = await db.stripe_balance_transactions.find_one({"txn_id": txn.id})
                if existing:
                    continue
                
                txn_doc = {
                    "id": str(uuid4()),
                    "txn_id": txn.id,
                    "amount": txn.amount / 100,
                    "fee": txn.fee / 100,
                    "net": txn.net / 100,
                    "currency": txn.currency.upper(),
                    "type": txn.type,
                    "status": txn.status,
                    "source": txn.source,
                    "created_at": datetime.fromtimestamp(txn.created, tz=timezone.utc),
                    "available_on": datetime.fromtimestamp(txn.available_on, tz=timezone.utc) if txn.available_on else None,
                    "synced_at": datetime.now(timezone.utc)
                }
                
                await db.stripe_balance_transactions.insert_one(txn_doc)
                charge_synced += 1
            
            logger.info(f"Stripe balance transactions synced: {charge_synced} new transactions")
            
            # Log sync run
            await db.settlement_sync_logs.insert_one({
                "id": str(uuid4()),
                "gateway": "stripe",
                "payouts_synced": synced_count,
                "transactions_synced": charge_synced,
                "status": "success",
                "created_at": datetime.now(timezone.utc)
            })
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe API error during settlement sync: {e}")
            await db.settlement_sync_logs.insert_one({
                "id": str(uuid4()),
                "gateway": "stripe",
                "status": "error",
                "error": str(e),
                "created_at": datetime.now(timezone.utc)
            })
            
    except Exception as e:
        logger.error(f"Error in Stripe settlement sync: {e}")


async def sync_razorpay_settlements():
    """
    Sync Razorpay settlements data daily.
    """
    from database import get_database_sync
    import os
    
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for Razorpay settlement sync")
            return
        
        razorpay_key = os.environ.get("RAZORPAY_KEY_ID")
        razorpay_secret = os.environ.get("RAZORPAY_KEY_SECRET")
        
        if not razorpay_key or not razorpay_secret:
            logger.warning("Razorpay credentials not configured, skipping settlement sync")
            return
        
        try:
            import razorpay
            client = razorpay.Client(auth=(razorpay_key, razorpay_secret))
        except ImportError:
            logger.warning("Razorpay library not installed")
            return
        
        logger.info("Starting Razorpay settlement sync...")
        
        try:
            # Fetch settlements
            settlements = client.settlement.all({"count": 100})
            
            synced_count = 0
            for settlement in settlements.get("items", []):
                existing = await db.razorpay_settlements.find_one({"settlement_id": settlement["id"]})
                if existing:
                    continue
                
                settlement_doc = {
                    "id": str(uuid4()),
                    "settlement_id": settlement["id"],
                    "amount": settlement["amount"] / 100,  # Convert from paise
                    "status": settlement["status"],
                    "fees": settlement.get("fees", 0) / 100,
                    "tax": settlement.get("tax", 0) / 100,
                    "utr": settlement.get("utr"),
                    "created_at": datetime.fromtimestamp(settlement["created_at"], tz=timezone.utc),
                    "synced_at": datetime.now(timezone.utc)
                }
                
                await db.razorpay_settlements.insert_one(settlement_doc)
                synced_count += 1
            
            logger.info(f"Razorpay settlement sync complete: {synced_count} new settlements synced")
            
            # Log sync run
            await db.settlement_sync_logs.insert_one({
                "id": str(uuid4()),
                "gateway": "razorpay",
                "settlements_synced": synced_count,
                "status": "success",
                "created_at": datetime.now(timezone.utc)
            })
            
        except Exception as e:
            logger.error(f"Razorpay API error during settlement sync: {e}")
            await db.settlement_sync_logs.insert_one({
                "id": str(uuid4()),
                "gateway": "razorpay",
                "status": "error",
                "error": str(e),
                "created_at": datetime.now(timezone.utc)
            })
            
    except Exception as e:
        logger.error(f"Error in Razorpay settlement sync: {e}")


# ==================== SCHEDULED FINANCE REPORTS ====================

async def process_scheduled_finance_reports():
    """
    Process scheduled finance reports and send via email.
    Checks for reports due today based on frequency (daily/weekly/monthly).
    """
    from database import get_database_sync
    from services.email_service import EmailService
    from io import BytesIO
    import base64
    
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for scheduled reports")
            return
        
        email_service = EmailService()
        now = datetime.now(timezone.utc)
        today = now.date()
        day_of_week = now.weekday()  # 0 = Monday
        day_of_month = now.day
        
        # Find all active scheduled reports
        schedules = await db.scheduled_finance_reports.find({
            "is_active": True
        }).to_list(100)
        
        if not schedules:
            logger.info("No scheduled finance reports configured")
            return
        
        logger.info(f"Processing {len(schedules)} scheduled report configurations...")
        
        for schedule in schedules:
            try:
                frequency = schedule.get("frequency", "weekly")
                send_day = schedule.get("send_day", 1)  # 1 = Monday for weekly, 1 = 1st for monthly
                last_sent = schedule.get("last_sent")
                
                # Check if we should send today
                should_send = False
                
                if frequency == "daily":
                    # Send every day, but only once per day
                    if not last_sent or last_sent.date() < today:
                        should_send = True
                        
                elif frequency == "weekly":
                    # Send on specific day of week (0=Mon, 1=Tue, etc.)
                    if day_of_week == send_day:
                        if not last_sent or last_sent.date() < today:
                            should_send = True
                            
                elif frequency == "monthly":
                    # Send on specific day of month
                    if day_of_month == send_day:
                        if not last_sent or last_sent.month != now.month:
                            should_send = True
                
                if not should_send:
                    continue
                
                logger.info(f"Generating scheduled report: {schedule.get('name', 'Unnamed')}")
                
                # Generate the report
                report_type = schedule.get("report_type", "monthly")
                recipients = schedule.get("recipients", [])
                
                if not recipients:
                    logger.warning(f"No recipients for scheduled report {schedule['id']}")
                    continue
                
                # Calculate report period
                if report_type == "monthly" or frequency == "monthly":
                    # Previous month
                    if now.month == 1:
                        report_month = 12
                        report_year = now.year - 1
                    else:
                        report_month = now.month - 1
                        report_year = now.year
                else:
                    # Current month for weekly/daily
                    report_month = now.month
                    report_year = now.year
                
                # Generate PDF (simplified - in production, import from reconciliation routes)
                pdf_content = await generate_finance_report_pdf(db, report_month, report_year, schedule.get("created_by_email", "system"))
                
                if not pdf_content:
                    logger.error(f"Failed to generate PDF for scheduled report {schedule['id']}")
                    continue
                
                # Send email with attachment
                month_name = datetime(report_year, report_month, 1).strftime("%B %Y")
                subject = f"📊 AirYatra Finance Report - {month_name}"
                
                html_content = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: white; margin: 0;">✈️ AirYatra Finance Report</h1>
                        <p style="color: #e2e8f0; margin-top: 10px;">{month_name}</p>
                    </div>
                    <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
                        <p style="color: #334155;">Dear Finance Team,</p>
                        <p style="color: #334155;">Please find attached the {frequency} finance report for {month_name}.</p>
                        <p style="color: #334155;">This report includes:</p>
                        <ul style="color: #334155;">
                            <li>Executive Summary</li>
                            <li>Revenue Breakdown</li>
                            <li>Expense Analysis</li>
                            <li>Payment Reconciliation Status</li>
                            <li>Top Customers</li>
                        </ul>
                        <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
                            This is an automated report. To modify schedule settings, visit the Finance Dashboard.
                        </p>
                    </div>
                </div>
                """
                
                # Send to each recipient
                for recipient in recipients:
                    try:
                        await email_service.send_email_with_attachment(
                            to_email=recipient,
                            subject=subject,
                            html_content=html_content,
                            attachment_content=pdf_content,
                            attachment_filename=f"AirYatra_Finance_Report_{month_name.replace(' ', '_')}.pdf",
                            attachment_type="application/pdf"
                        )
                        logger.info(f"Sent scheduled report to {recipient}")
                    except Exception as e:
                        logger.error(f"Failed to send report to {recipient}: {e}")
                
                # Update last_sent
                await db.scheduled_finance_reports.update_one(
                    {"id": schedule["id"]},
                    {"$set": {
                        "last_sent": now,
                        "last_status": "success",
                        "send_count": schedule.get("send_count", 0) + 1
                    }}
                )
                
            except Exception as e:
                logger.error(f"Error processing scheduled report {schedule.get('id')}: {e}")
                await db.scheduled_finance_reports.update_one(
                    {"id": schedule["id"]},
                    {"$set": {
                        "last_status": "error",
                        "last_error": str(e)
                    }}
                )
        
        logger.info("Scheduled finance reports processing complete")
        
    except Exception as e:
        logger.error(f"Error in scheduled finance reports: {e}")


async def generate_finance_report_pdf(db, month: int, year: int, generated_by: str = "system") -> bytes:
    """
    Generate finance report PDF for scheduled sending.
    Returns PDF content as bytes.
    """
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
    
    try:
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        month_name = start_date.strftime("%B %Y")
        
        # Fetch data
        paid_transactions = await db.payment_transactions.find({
            "status": "paid",
            "created_at": {"$gte": start_date, "$lt": end_date}
        }).to_list(10000)
        
        total_revenue = sum(t.get("amount", 0) for t in paid_transactions)
        
        expenses = await db.expenses.find({
            "created_at": {"$gte": start_date, "$lt": end_date}
        }).to_list(5000)
        
        total_expenses = sum(e.get("amount", 0) for e in expenses)
        net_profit = total_revenue - total_expenses
        
        # Generate PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#1e40af'), alignment=TA_CENTER, spaceAfter=20)
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=14, textColor=colors.HexColor('#64748b'), alignment=TA_CENTER, spaceAfter=30)
        
        elements = []
        elements.append(Paragraph("✈️ AirYatra", title_style))
        elements.append(Paragraph(f"Finance Report - {month_name}", subtitle_style))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#e2e8f0')))
        elements.append(Spacer(1, 20))
        
        # Summary table
        def format_inr(amount):
            if amount >= 10000000:
                return f"₹{amount/10000000:.2f} Cr"
            elif amount >= 100000:
                return f"₹{amount/100000:.2f} L"
            return f"₹{amount:,.2f}"
        
        summary_data = [
            ["Metric", "Value"],
            ["Total Revenue", format_inr(total_revenue)],
            ["Total Expenses", format_inr(total_expenses)],
            ["Net Profit/Loss", format_inr(net_profit)],
            ["Transactions", str(len(paid_transactions))],
            ["Generated By", generated_by],
            ["Generated At", datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")],
        ]
        
        summary_table = Table(summary_data, colWidths=[200, 200])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]))
        elements.append(summary_table)
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        return None


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler stopped")


async def run_daily_compliance_monitor():
    """
    Daily compliance check for aircraft documents.
    Auto-hides aircraft with expired critical documents.
    Runs daily at 6 AM.
    """
    from database import get_database_sync
    
    try:
        db = get_database_sync()
        if db is None:
            logger.warning("Database not available for compliance monitor")
            return
        
        logger.info("Starting daily compliance monitor check")
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Find aircraft with expired documents
        expired_insurance = await db.aircraft_catalog.find({
            "is_published": True,
            "documents.insurance_expiry": {"$lt": today}
        }).to_list(500)
        
        expired_maintenance = await db.aircraft_catalog.find({
            "is_published": True,
            "documents.next_maintenance_due": {"$lt": today}
        }).to_list(500)
        
        # Combine unique aircraft IDs
        expired_aircraft_ids = set()
        for a in expired_insurance:
            expired_aircraft_ids.add(a["id"])
        for a in expired_maintenance:
            expired_aircraft_ids.add(a["id"])
        
        # Auto-hide aircraft with expired critical documents
        hidden_count = 0
        for aircraft_id in expired_aircraft_ids:
            result = await db.aircraft_catalog.update_one(
                {"id": aircraft_id, "is_published": True},
                {
                    "$set": {
                        "is_published": False,
                        "auto_hidden_reason": "Document expired (automated compliance check)",
                        "auto_hidden_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            if result.modified_count > 0:
                hidden_count += 1
        
        # Store compliance report
        report = {
            "id": str(uuid4()),
            "run_date": today,
            "run_at": datetime.now(timezone.utc).isoformat(),
            "type": "scheduled",
            "total_alerts": len(expired_aircraft_ids),
            "alerts_by_type": {
                "insurance_expired": len(expired_insurance),
                "maintenance_overdue": len(expired_maintenance)
            },
            "aircraft_auto_hidden": hidden_count
        }
        await db.compliance_reports.insert_one(report)
        
        logger.info(f"Compliance monitor completed: {len(expired_aircraft_ids)} alerts, {hidden_count} aircraft hidden")
        
    except Exception as e:
        logger.error(f"Error in daily compliance monitor: {e}")
