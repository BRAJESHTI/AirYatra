"""
Complaint Notification Service
Handles all complaint-related notifications - status updates, deadline warnings, penalty alerts
Includes email delivery via SMTP
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from database import get_database
import asyncio
import logging

logger = logging.getLogger(__name__)

# Import email service
try:
    from services.email_service import email_service
    EMAIL_ENABLED = True
except ImportError:
    EMAIL_ENABLED = False
    logger.warning("Email service not available")


async def send_complaint_notification(
    recipient_id: str,
    recipient_type: str,  # 'customer', 'operator', 'admin'
    notification_type: str,
    title: str,
    message: str,
    complaint_id: str,
    priority: str = "normal",
    recipient_email: Optional[str] = None,
    recipient_phone: Optional[str] = None,
    metadata: Optional[dict] = None,
    send_email: bool = True  # Whether to also send email
):
    """Send a complaint-related notification (in-app + email)"""
    db = get_database()
    
    notif_doc = {
        "type": notification_type,
        "category": "complaint",
        "title": title,
        "message": message,
        "priority": priority,
        "recipient_id": recipient_id,
        "recipient_type": recipient_type,
        "recipient_email": recipient_email,
        "recipient_phone": recipient_phone,
        "metadata": {
            "complaint_id": complaint_id,
            **(metadata or {})
        },
        "action_url": f"/complaints/{complaint_id}",
        "action_label": "View Complaint",
        "is_read": False,
        "is_archived": False,
        "created_at": datetime.now(timezone.utc),
        "read_at": None,
        "email_sent": False
    }
    
    await db.notifications.insert_one(notif_doc)
    
    # Send email if enabled and email address provided
    if send_email and EMAIL_ENABLED and recipient_email:
        try:
            # Build email data
            email_data = {
                "complaint_id": complaint_id,
                "title": title,
                "message": message,
                "recipient_type": recipient_type,
                **(metadata or {})
            }
            
            # Use appropriate template based on notification type
            if notification_type == "complaint_new":
                result = await email_service.send_email(
                    to_email=recipient_email,
                    subject=f"🚨 URGENT: New Complaint - {email_data.get('complaint_number', '')}",
                    html_body=_build_complaint_email_html(email_data, "operator_alert")
                )
            elif notification_type == "complaint_confirmation":
                result = await email_service.send_email(
                    to_email=recipient_email,
                    subject=f"✅ Complaint #{email_data.get('complaint_number', '')} Filed - AirYatra",
                    html_body=_build_complaint_email_html(email_data, "customer_confirmation")
                )
            elif notification_type == "complaint_decision":
                result = await email_service.send_email(
                    to_email=recipient_email,
                    subject=f"⚖️ Complaint Decision - {email_data.get('complaint_number', '')}",
                    html_body=_build_complaint_email_html(email_data, "decision")
                )
            elif notification_type == "complaint_deadline_warning":
                result = await email_service.send_email(
                    to_email=recipient_email,
                    subject=f"⏰ {email_data.get('hours_remaining', '')}H Left - Complaint #{email_data.get('complaint_number', '')}",
                    html_body=_build_complaint_email_html(email_data, "deadline")
                )
            elif notification_type == "penalty_issued":
                result = await email_service.send_email(
                    to_email=recipient_email,
                    subject=f"💰 Penalty Issued: ₹{email_data.get('penalty_amount', 0):,}",
                    html_body=_build_complaint_email_html(email_data, "penalty")
                )
            else:
                # Generic notification email
                result = await email_service.send_email(
                    to_email=recipient_email,
                    subject=title,
                    html_body=_build_complaint_email_html(email_data, "generic")
                )
            
            if result.get("success"):
                await db.notifications.update_one(
                    {"_id": notif_doc.get("_id")},
                    {"$set": {"email_sent": True, "email_sent_at": datetime.now(timezone.utc)}}
                )
                logger.info(f"Email sent: {notification_type} to {recipient_email}")
        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
    
    return notif_doc


def _build_complaint_email_html(data: dict, template_type: str) -> str:
    """Build HTML email content for complaint notifications"""
    
    base_style = """
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #1a1a2e; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #16213e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .info-box { background: #252542; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .alert-box { padding: 15px; border-radius: 8px; margin: 15px 0; }
        .alert-red { background: #ef4444; color: white; }
        .alert-green { background: #22c55e; color: white; }
        .alert-yellow { background: #f59e0b; color: black; }
        .btn { display: inline-block; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; }
        .btn-primary { background: #f97316; color: white; }
        .btn-green { background: #22c55e; color: white; }
        .footer { text-align: center; padding: 20px; border-top: 1px solid #333; color: #888; font-size: 12px; }
    </style>
    """
    
    if template_type == "operator_alert":
        return f"""
        <html><head>{base_style}</head><body>
        <div class="container">
            <div class="header">
                <h1>🛩️ AirYatra</h1>
            </div>
            <div class="content">
                <div class="alert-box alert-red">
                    <h2 style="margin:0;">🚨 NEW COMPLAINT - RESPOND IN 24 HOURS</h2>
                </div>
                <p>A customer has filed a complaint against your service.</p>
                <div class="info-box">
                    <p><strong>Complaint #:</strong> {data.get('complaint_number', 'N/A')}</p>
                    <p><strong>Subject:</strong> {data.get('subject', 'N/A')}</p>
                    <p><strong>Severity:</strong> {data.get('severity', 'Medium').upper()}</p>
                    <p><strong>Category:</strong> {data.get('category', 'N/A')}</p>
                </div>
                <div class="alert-box alert-yellow">
                    <strong>⚠️ Important:</strong>
                    <ul style="margin:10px 0 0;padding-left:20px;">
                        <li>Late response = ₹5,000 penalty</li>
                        <li>Respond with full details and evidence</li>
                        <li>AirYatra makes the final decision</li>
                    </ul>
                </div>
                <p style="text-align:center;"><a href="#" class="btn btn-green">Respond Now →</a></p>
            </div>
            <div class="footer">© 2026 AirYatra Aviation Pvt Ltd</div>
        </div>
        </body></html>
        """
    
    elif template_type == "customer_confirmation":
        return f"""
        <html><head>{base_style}</head><body>
        <div class="container">
            <div class="header"><h1>🛩️ AirYatra</h1></div>
            <div class="content">
                <div class="alert-box alert-green">
                    <h2 style="margin:0;">✅ Complaint Registered</h2>
                </div>
                <p>Your complaint has been successfully filed.</p>
                <div class="info-box">
                    <p><strong>Complaint #:</strong> {data.get('complaint_number', 'N/A')}</p>
                    <p><strong>Subject:</strong> {data.get('subject', 'N/A')}</p>
                </div>
                <p><strong>What happens next?</strong></p>
                <ul>
                    <li>Operator must respond within 24 hours</li>
                    <li>AirYatra will investigate independently</li>
                    <li>You'll be notified of the final decision</li>
                </ul>
            </div>
            <div class="footer">© 2026 AirYatra Aviation Pvt Ltd</div>
        </div>
        </body></html>
        """
    
    elif template_type == "decision":
        decision = data.get('decision', 'partial')
        decision_color = 'alert-green' if decision == 'dismissed' else 'alert-red' if decision == 'upheld' else 'alert-yellow'
        return f"""
        <html><head>{base_style}</head><body>
        <div class="container">
            <div class="header"><h1>🛩️ AirYatra</h1></div>
            <div class="content">
                <h2>⚖️ Complaint Decision</h2>
                <div class="alert-box {decision_color}">
                    <h3 style="margin:0;text-align:center;">Decision: {decision.upper()}</h3>
                </div>
                <div class="info-box">
                    <p><strong>Complaint #:</strong> {data.get('complaint_number', 'N/A')}</p>
                    <p><strong>Notes:</strong> {data.get('notes', 'No additional notes')}</p>
                </div>
                <p>This decision is final. No appeals are allowed as per AirYatra policy.</p>
            </div>
            <div class="footer">© 2026 AirYatra Aviation Pvt Ltd</div>
        </div>
        </body></html>
        """
    
    elif template_type == "deadline":
        hours = data.get('hours_remaining', 24)
        urgency_color = 'alert-red' if hours <= 2 else 'alert-yellow'
        return f"""
        <html><head>{base_style}</head><body>
        <div class="container">
            <div class="header"><h1>🛩️ AirYatra</h1></div>
            <div class="content">
                <div class="alert-box {urgency_color}">
                    <h2 style="margin:0;text-align:center;">⏰ {hours} HOURS LEFT!</h2>
                    <p style="margin:5px 0 0;text-align:center;">Complaint #{data.get('complaint_number', '')}</p>
                </div>
                <p>Your response deadline is approaching. Late responses incur <strong>₹5,000 penalty</strong>.</p>
                <p style="text-align:center;"><a href="#" class="btn btn-green">Respond Now →</a></p>
            </div>
            <div class="footer">© 2026 AirYatra Aviation Pvt Ltd</div>
        </div>
        </body></html>
        """
    
    elif template_type == "penalty":
        return f"""
        <html><head>{base_style}</head><body>
        <div class="container">
            <div class="header"><h1>🛩️ AirYatra</h1></div>
            <div class="content">
                <div class="alert-box alert-red">
                    <h2 style="margin:0;text-align:center;">💰 Penalty Issued</h2>
                    <p style="font-size:28px;margin:10px 0 0;text-align:center;">₹{data.get('penalty_amount', 0):,}</p>
                </div>
                <div class="info-box">
                    <p><strong>Rule:</strong> {data.get('penalty_rule', 'N/A')}</p>
                    <p><strong>Due Date:</strong> 7 days from issue</p>
                </div>
                {'<div class="alert-box alert-red">⚠️ Account Suspended</div>' if data.get('suspension_triggered') else ''}
                {'<div class="alert-box alert-red">❌ Account Delisted</div>' if data.get('delisting_triggered') else ''}
                <p>Pay within 7 days to avoid further action. Contact support@airyatra.com for questions.</p>
            </div>
            <div class="footer">© 2026 AirYatra Aviation Pvt Ltd</div>
        </div>
        </body></html>
        """
    
    else:
        # Generic
        return f"""
        <html><head>{base_style}</head><body>
        <div class="container">
            <div class="header"><h1>🛩️ AirYatra</h1></div>
            <div class="content">
                <h2>{data.get('title', 'Notification')}</h2>
                <p>{data.get('message', '')}</p>
            </div>
            <div class="footer">© 2026 AirYatra Aviation Pvt Ltd</div>
        </div>
        </body></html>
        """


async def notify_complaint_filed(complaint: dict):
    """Notify when a new complaint is filed"""
    db = get_database()
    
    # Get operator details
    operator = await db.operators.find_one({"operator_id": complaint["operator_id"]})
    operator_email = operator.get("contact_email") if operator else None
    operator_phone = operator.get("contact_phone") if operator else None
    
    # Notify operator - URGENT
    await send_complaint_notification(
        recipient_id=complaint["operator_id"],
        recipient_type="operator",
        notification_type="complaint_new",
        title="🚨 New Complaint Filed Against You",
        message=f"A customer has filed a complaint: {complaint['subject']}. You have 24 hours to respond.",
        complaint_id=complaint["complaint_id"],
        priority="urgent",
        recipient_email=operator_email,
        recipient_phone=operator_phone,
        metadata={
            "severity": complaint.get("severity"),
            "category": complaint.get("category"),
            "deadline": complaint.get("operator_response_required_at")
        }
    )
    
    # Notify customer - confirmation
    await send_complaint_notification(
        recipient_id=complaint["customer_id"],
        recipient_type="customer",
        notification_type="complaint_confirmation",
        title="✅ Complaint Filed Successfully",
        message=f"Your complaint '{complaint['subject']}' has been registered. Complaint #: {complaint['complaint_number']}",
        complaint_id=complaint["complaint_id"],
        priority="normal",
        metadata={
            "complaint_number": complaint.get("complaint_number")
        }
    )
    
    # Notify admins
    admins = await db.users.find({"roles": {"$in": ["admin", "super_admin"]}}).to_list(50)
    for admin in admins:
        await send_complaint_notification(
            recipient_id=str(admin["_id"]),
            recipient_type="admin",
            notification_type="complaint_new_admin",
            title="📋 New Complaint Requires Review",
            message=f"New {complaint.get('severity', 'medium')} severity complaint filed against operator.",
            complaint_id=complaint["complaint_id"],
            priority="high" if complaint.get("severity") in ["high", "critical"] else "normal"
        )


async def notify_operator_response(complaint: dict, response_text: str, is_late: bool = False):
    """Notify when operator responds to complaint"""
    
    # Notify customer
    await send_complaint_notification(
        recipient_id=complaint["customer_id"],
        recipient_type="customer",
        notification_type="complaint_response",
        title="📝 Operator Has Responded",
        message=f"The operator has responded to your complaint. AirYatra will now investigate and make a decision.",
        complaint_id=complaint["complaint_id"],
        priority="normal"
    )
    
    # Notify admins about late response
    if is_late:
        db = get_database()
        admins = await db.users.find({"roles": {"$in": ["admin", "super_admin"]}}).to_list(50)
        for admin in admins:
            await send_complaint_notification(
                recipient_id=str(admin["_id"]),
                recipient_type="admin",
                notification_type="complaint_late_response",
                title="⚠️ Late Response - Penalty Applied",
                message=f"Operator responded late to complaint {complaint['complaint_number']}. Auto-penalty applied.",
                complaint_id=complaint["complaint_id"],
                priority="high",
                metadata={"late_penalty": True}
            )


async def notify_complaint_decision(complaint: dict, decision: str, penalty_info: Optional[dict] = None):
    """Notify both parties when AirYatra makes a decision"""
    
    # Map decision to user-friendly text
    decision_texts = {
        "upheld": {
            "customer": ("✅ Complaint Upheld", "Your complaint has been upheld. Action will be taken against the operator."),
            "operator": ("❌ Complaint Upheld Against You", "The complaint has been upheld. Please review the decision and any applicable penalties.")
        },
        "dismissed": {
            "customer": ("ℹ️ Complaint Dismissed", "After investigation, your complaint has been dismissed. Contact support if you have questions."),
            "operator": ("✅ Complaint Dismissed", "The complaint filed against you has been dismissed after investigation.")
        },
        "partial": {
            "customer": ("⚖️ Partial Resolution", "Your complaint has been partially upheld. Some actions will be taken."),
            "operator": ("⚖️ Partial Decision", "The complaint has been partially upheld. Please review the specific findings.")
        }
    }
    
    texts = decision_texts.get(decision, decision_texts["partial"])
    
    # Notify customer
    await send_complaint_notification(
        recipient_id=complaint["customer_id"],
        recipient_type="customer",
        notification_type="complaint_decision",
        title=texts["customer"][0],
        message=texts["customer"][1],
        complaint_id=complaint["complaint_id"],
        priority="high",
        metadata={
            "decision": decision,
            "compensation": complaint.get("compensation_amount"),
            "refund": complaint.get("refund_amount")
        }
    )
    
    # Notify operator
    operator_meta = {"decision": decision}
    if penalty_info:
        operator_meta.update({
            "penalty_amount": penalty_info.get("penalty_amount"),
            "penalty_rule": penalty_info.get("penalty_rule"),
            "suspension": penalty_info.get("suspension_triggered"),
            "delisting": penalty_info.get("delisting_triggered")
        })
    
    await send_complaint_notification(
        recipient_id=complaint["operator_id"],
        recipient_type="operator",
        notification_type="complaint_decision",
        title=texts["operator"][0],
        message=texts["operator"][1],
        complaint_id=complaint["complaint_id"],
        priority="urgent" if decision == "upheld" else "high",
        metadata=operator_meta
    )


async def notify_deadline_warning(complaint: dict, hours_remaining: int):
    """Send deadline warning to operator"""
    db = get_database()
    
    operator = await db.operators.find_one({"operator_id": complaint["operator_id"]})
    operator_email = operator.get("contact_email") if operator else None
    operator_phone = operator.get("contact_phone") if operator else None
    
    if hours_remaining <= 2:
        title = "🚨 URGENT: 2 Hours Left to Respond!"
        priority = "urgent"
    elif hours_remaining <= 6:
        title = "⚠️ Only 6 Hours Left to Respond"
        priority = "high"
    else:
        title = f"⏰ {hours_remaining} Hours Left to Respond"
        priority = "normal"
    
    await send_complaint_notification(
        recipient_id=complaint["operator_id"],
        recipient_type="operator",
        notification_type="complaint_deadline_warning",
        title=title,
        message=f"Complaint #{complaint['complaint_number']} needs your response. Late response incurs ₹5,000 penalty.",
        complaint_id=complaint["complaint_id"],
        priority=priority,
        recipient_email=operator_email,
        recipient_phone=operator_phone,
        metadata={
            "hours_remaining": hours_remaining,
            "deadline": complaint.get("operator_response_required_at")
        }
    )


async def notify_penalty_issued(operator_id: str, penalty: dict):
    """Notify operator about penalty"""
    db = get_database()
    
    operator = await db.operators.find_one({"operator_id": operator_id})
    operator_email = operator.get("contact_email") if operator else None
    
    amount = penalty.get("penalty_amount", 0)
    rule = penalty.get("penalty_rule", "")
    
    title = f"💰 Penalty Issued: ₹{amount:,}"
    message = f"A penalty of ₹{amount:,} has been issued. Rule: {rule}. Please pay within 7 days to avoid further action."
    
    if penalty.get("suspension_triggered"):
        title = f"🚫 Suspension + Penalty: ₹{amount:,}"
        message = f"You have been suspended for {penalty.get('suspension_duration_days', 7)} days. Penalty: ₹{amount:,}"
    
    if penalty.get("delisting_triggered"):
        title = "❌ Account Delisted"
        message = "Your operator account has been delisted due to repeated violations. Contact support for appeal process."
    
    await send_complaint_notification(
        recipient_id=operator_id,
        recipient_type="operator",
        notification_type="penalty_issued",
        title=title,
        message=message,
        complaint_id=penalty.get("complaint_id", ""),
        priority="urgent",
        recipient_email=operator_email,
        metadata={
            "penalty_id": penalty.get("penalty_id"),
            "penalty_amount": amount,
            "penalty_rule": rule,
            "suspension": penalty.get("suspension_triggered"),
            "delisting": penalty.get("delisting_triggered"),
            "due_date": penalty.get("due_date")
        }
    )


# Background task to check deadlines and send warnings
async def check_complaint_deadlines():
    """Run periodically to check and send deadline warnings"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    
    # Find complaints where operator hasn't responded and deadline is approaching
    pipeline = [
        {
            "$match": {
                "operator_response_received": {"$ne": True},
                "status": {"$in": ["open", "operator_response_pending"]},
                "operator_response_required_at": {"$exists": True}
            }
        }
    ]
    
    complaints = await db.complaints.aggregate(pipeline).to_list(100)
    
    for complaint in complaints:
        deadline = complaint.get("operator_response_required_at")
        if not deadline:
            continue
            
        if isinstance(deadline, str):
            deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        
        time_remaining = deadline - now
        hours_remaining = int(time_remaining.total_seconds() / 3600)
        
        # Send warnings at 12h, 6h, 2h marks
        last_warning = complaint.get("last_deadline_warning_hours")
        
        if hours_remaining <= 2 and last_warning != 2:
            await notify_deadline_warning(complaint, 2)
            await db.complaints.update_one(
                {"complaint_id": complaint["complaint_id"]},
                {"$set": {"last_deadline_warning_hours": 2}}
            )
        elif hours_remaining <= 6 and hours_remaining > 2 and last_warning not in [2, 6]:
            await notify_deadline_warning(complaint, 6)
            await db.complaints.update_one(
                {"complaint_id": complaint["complaint_id"]},
                {"$set": {"last_deadline_warning_hours": 6}}
            )
        elif hours_remaining <= 12 and hours_remaining > 6 and last_warning not in [2, 6, 12]:
            await notify_deadline_warning(complaint, 12)
            await db.complaints.update_one(
                {"complaint_id": complaint["complaint_id"]},
                {"$set": {"last_deadline_warning_hours": 12}}
            )
