"""Corporate credit alert: email admin when available credit drops below threshold"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

COOLDOWN_HOURS = 24


async def check_credit_alert(db, corporate_id: str):
    corp = await db.corporates.find_one({"corporate_id": corporate_id}, {"_id": 0})
    if not corp or not corp.get("admin_email"):
        return
    limit = float(corp.get("credit_limit") or 0)
    used = float(corp.get("credit_used") or 0)
    available = round(limit - used, 2)
    threshold = float(corp.get("credit_alert_threshold") or round(limit * 0.20, 2))
    if limit <= 0 or threshold <= 0:
        return

    now = datetime.now(timezone.utc)
    if available >= threshold:
        if corp.get("credit_alert_active"):
            await db.corporates.update_one(
                {"corporate_id": corporate_id}, {"$set": {"credit_alert_active": False}})
        return

    last = corp.get("credit_alert_last_sent")
    if corp.get("credit_alert_active") and last:
        try:
            if now - datetime.fromisoformat(last) < timedelta(hours=COOLDOWN_HOURS):
                return
        except Exception:
            pass

    pct = round(available / limit * 100, 1) if limit else 0
    html_body = f"""
<!DOCTYPE html>
<html><body style="font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#fff;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px;text-align:center;">
      <div style="font-size:44px;">⚠️</div>
      <h1 style="margin:8px 0 0;">Low Credit Alert</h1>
      <p style="margin:4px 0 0;opacity:0.9;">{corp.get('company_name')}</p>
    </div>
    <div style="padding:28px;">
      <p>Dear Admin,</p>
      <p>Your company's available credit has dropped <strong>below</strong> the set limit. Please top up before bookings get blocked.</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;">
        <tr><td style="padding:8px 0;color:#94a3b8;">Available Credit:</td><td style="text-align:right;color:#ef4444;font-size:20px;font-weight:bold;">₹{available:,.0f} ({pct}%)</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Alert Threshold:</td><td style="text-align:right;font-weight:600;">₹{threshold:,.0f}</td></tr>
        <tr><td style="padding:8px 0;color:#94a3b8;">Credit Used:</td><td style="text-align:right;font-weight:600;">₹{used:,.0f} / ₹{limit:,.0f}</td></tr>
      </table>
      <p style="text-align:center;margin-top:18px;">
        <a href="https://airyatra.co.in/corporate" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Corporate Account</a>
      </p>
    </div>
    <div style="background:#0f172a;padding:16px;text-align:center;font-size:12px;color:#64748b;">
      <p>AirYatra Corporate • info@airyatra.co.in</p>
    </div>
  </div>
</body></html>
"""
    from services.email_service import email_service
    result = await email_service.send_email(
        to_email=corp["admin_email"],
        subject=f"⚠️ Low Credit Alert - ₹{available:,.0f} left | {corp.get('company_name')} | AirYatra",
        html_body=html_body,
    )
    await db.corporates.update_one(
        {"corporate_id": corporate_id},
        {"$set": {"credit_alert_active": True, "credit_alert_last_sent": now.isoformat()}})
    await db.credit_alert_log.insert_one({
        "corporate_id": corporate_id,
        "available": available,
        "threshold": threshold,
        "to_email": corp["admin_email"],
        "status": "sent" if result.get("success") else "failed",
        "error": result.get("error"),
        "created_at": now.isoformat(),
    })
    logger.info(f"Credit alert emailed to {corp['admin_email']} ({corporate_id}): available {available} < {threshold}")


def schedule_credit_alert(db, corporate_id: str):
    async def _run():
        try:
            await check_credit_alert(db, corporate_id)
        except Exception as e:
            logger.error(f"Credit alert task failed for {corporate_id}: {e}")
    try:
        asyncio.create_task(_run())
    except RuntimeError:
        logger.error(f"No event loop; credit alert skipped for {corporate_id}")
