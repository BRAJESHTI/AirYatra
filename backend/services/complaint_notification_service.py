"""
Complaint Notification Service
Handles all complaint-related notifications - status updates, deadline warnings, penalty alerts
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from database import get_database
import asyncio


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
    metadata: Optional[dict] = None
):
    """Send a complaint-related notification"""
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
        "read_at": None
    }
    
    await db.notifications.insert_one(notif_doc)
    return notif_doc


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
