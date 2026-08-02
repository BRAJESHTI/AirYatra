"""
AirYatra Finance ERP - Scheduled Reports & Settlement Sync Management
APIs to manage scheduled finance reports and view settlement sync status
"""
from fastapi import APIRouter, Depends, HTTPException
from middleware import get_current_user, require_roles
from models import UserRole
from database import get_database
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/finance/scheduled", tags=["finance-scheduled"])


def serialize_doc(doc: dict) -> dict:
    """Remove MongoDB _id and convert datetime objects"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in result.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
    return result


# ==================== SCHEDULED REPORTS ====================

class CreateScheduledReport(BaseModel):
    name: str
    frequency: str = "weekly"  # daily, weekly, monthly
    send_day: int = 1  # 0-6 for weekly (Mon-Sun), 1-28 for monthly
    report_type: str = "monthly"  # monthly, custom
    recipients: List[str]
    include_sections: Optional[List[str]] = None  # revenue, expenses, reconciliation, customers


class UpdateScheduledReport(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    send_day: Optional[int] = None
    recipients: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.get("/reports")
async def list_scheduled_reports(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    List all scheduled finance reports
    """
    db = get_database()
    
    reports = await db.scheduled_finance_reports.find({}).sort("created_at", -1).to_list(100)
    
    return {
        "reports": [serialize_doc(r) for r in reports],
        "total": len(reports)
    }


@router.post("/reports")
async def create_scheduled_report(
    request: CreateScheduledReport,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Create a new scheduled finance report
    """
    db = get_database()
    
    # Validate frequency and send_day
    if request.frequency == "weekly" and (request.send_day < 0 or request.send_day > 6):
        raise HTTPException(status_code=400, detail="For weekly reports, send_day must be 0-6 (Mon-Sun)")
    if request.frequency == "monthly" and (request.send_day < 1 or request.send_day > 28):
        raise HTTPException(status_code=400, detail="For monthly reports, send_day must be 1-28")
    
    # Validate recipients
    if not request.recipients:
        raise HTTPException(status_code=400, detail="At least one recipient email is required")
    
    report_doc = {
        "id": str(uuid.uuid4()),
        "name": request.name,
        "frequency": request.frequency,
        "send_day": request.send_day,
        "report_type": request.report_type,
        "recipients": request.recipients,
        "include_sections": request.include_sections or ["revenue", "expenses", "reconciliation", "customers"],
        "is_active": True,
        "created_by": current_user.get("id"),
        "created_by_email": current_user.get("email"),
        "created_at": datetime.now(timezone.utc),
        "last_sent": None,
        "last_status": None,
        "send_count": 0
    }
    
    await db.scheduled_finance_reports.insert_one(report_doc)
    
    return {
        "success": True,
        "report": serialize_doc(report_doc),
        "message": f"Scheduled report '{request.name}' created successfully"
    }


@router.get("/reports/{report_id}")
async def get_scheduled_report(
    report_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get details of a scheduled report
    """
    db = get_database()
    
    report = await db.scheduled_finance_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    
    return serialize_doc(report)


@router.put("/reports/{report_id}")
async def update_scheduled_report(
    report_id: str,
    request: UpdateScheduledReport,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Update a scheduled report
    """
    db = get_database()
    
    report = await db.scheduled_finance_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = current_user.get("email")
    
    await db.scheduled_finance_reports.update_one(
        {"id": report_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Scheduled report updated"}


@router.delete("/reports/{report_id}")
async def delete_scheduled_report(
    report_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Delete a scheduled report
    """
    db = get_database()
    
    result = await db.scheduled_finance_reports.delete_one({"id": report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    
    return {"success": True, "message": "Scheduled report deleted"}


@router.post("/reports/{report_id}/toggle")
async def toggle_scheduled_report(
    report_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Toggle a scheduled report's active status
    """
    db = get_database()
    
    report = await db.scheduled_finance_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    
    new_status = not report.get("is_active", True)
    
    await db.scheduled_finance_reports.update_one(
        {"id": report_id},
        {"$set": {
            "is_active": new_status,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "is_active": new_status,
        "message": f"Report {'activated' if new_status else 'paused'}"
    }


@router.post("/reports/{report_id}/send-now")
async def send_report_now(
    report_id: str,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Manually trigger a scheduled report to be sent immediately
    """
    db = get_database()
    from services.email_service import EmailService
    from scheduler import generate_finance_report_pdf
    
    report = await db.scheduled_finance_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Scheduled report not found")
    
    recipients = report.get("recipients", [])
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients configured")
    
    email_service = EmailService()
    now = datetime.now(timezone.utc)
    
    # Calculate report period (previous month)
    if now.month == 1:
        report_month = 12
        report_year = now.year - 1
    else:
        report_month = now.month - 1
        report_year = now.year
    
    # Generate PDF
    pdf_content = await generate_finance_report_pdf(db, report_month, report_year, current_user.get("email", "system"))
    
    if not pdf_content:
        raise HTTPException(status_code=500, detail="Failed to generate report PDF")
    
    month_name = datetime(report_year, report_month, 1).strftime("%B %Y")
    subject = f"📊 AirYatra Finance Report - {month_name} (Manual Send)"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">✈️ AirYatra Finance Report</h1>
            <p style="color: #e2e8f0; margin-top: 10px;">{month_name}</p>
        </div>
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #334155;">This report was manually triggered by {current_user.get('email')}.</p>
            <p style="color: #334155;">Please find the attached finance report for {month_name}.</p>
        </div>
    </div>
    """
    
    sent_count = 0
    errors = []
    
    for recipient in recipients:
        try:
            result = await email_service.send_email_with_attachment(
                to_email=recipient,
                subject=subject,
                html_content=html_content,
                attachment_content=pdf_content,
                attachment_filename=f"AirYatra_Finance_Report_{month_name.replace(' ', '_')}.pdf",
                attachment_type="application/pdf"
            )
            if result.get("success"):
                sent_count += 1
            else:
                errors.append({"email": recipient, "error": result.get("error")})
        except Exception as e:
            errors.append({"email": recipient, "error": str(e)})
    
    # Update report stats
    await db.scheduled_finance_reports.update_one(
        {"id": report_id},
        {"$set": {
            "last_sent": now,
            "last_status": "success" if sent_count > 0 else "error",
            "send_count": report.get("send_count", 0) + 1
        }}
    )
    
    return {
        "success": sent_count > 0,
        "sent_to": sent_count,
        "errors": errors,
        "message": f"Report sent to {sent_count} of {len(recipients)} recipients"
    }


# ==================== SETTLEMENT SYNC STATUS ====================

@router.get("/settlement-sync/status")
async def get_settlement_sync_status(
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get status of settlement sync jobs
    """
    db = get_database()
    
    # Get recent sync logs
    stripe_logs = await db.settlement_sync_logs.find({"gateway": "stripe"}).sort("created_at", -1).limit(10).to_list(10)
    razorpay_logs = await db.settlement_sync_logs.find({"gateway": "razorpay"}).sort("created_at", -1).limit(10).to_list(10)
    
    # Get counts
    stripe_settlements = await db.stripe_settlements.count_documents({})
    stripe_balance_txns = await db.stripe_balance_transactions.count_documents({})
    razorpay_settlements = await db.razorpay_settlements.count_documents({})
    
    # Last sync times
    last_stripe = stripe_logs[0] if stripe_logs else None
    last_razorpay = razorpay_logs[0] if razorpay_logs else None
    
    return {
        "stripe": {
            "settlements_count": stripe_settlements,
            "balance_transactions_count": stripe_balance_txns,
            "last_sync": serialize_doc(last_stripe) if last_stripe else None,
            "recent_logs": [serialize_doc(l) for l in stripe_logs[:5]]
        },
        "razorpay": {
            "settlements_count": razorpay_settlements,
            "last_sync": serialize_doc(last_razorpay) if last_razorpay else None,
            "recent_logs": [serialize_doc(l) for l in razorpay_logs[:5]]
        }
    }


@router.post("/settlement-sync/trigger")
async def trigger_settlement_sync(
    gateway: str = "all",  # stripe, razorpay, all
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Manually trigger settlement sync
    """
    from scheduler import sync_stripe_settlements, sync_razorpay_settlements
    
    results = {"stripe": None, "razorpay": None}
    
    if gateway in ["stripe", "all"]:
        try:
            await sync_stripe_settlements()
            results["stripe"] = "triggered"
        except Exception as e:
            results["stripe"] = f"error: {str(e)}"
    
    if gateway in ["razorpay", "all"]:
        try:
            await sync_razorpay_settlements()
            results["razorpay"] = "triggered"
        except Exception as e:
            results["razorpay"] = f"error: {str(e)}"
    
    return {
        "success": True,
        "results": results,
        "message": f"Settlement sync triggered for {gateway}"
    }


@router.get("/settlement-sync/data")
async def get_settlement_data(
    gateway: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.FINANCE_HEAD, UserRole.CFO]))
):
    """
    Get synced settlement data
    """
    db = get_database()
    
    result = {"stripe": [], "razorpay": []}
    
    if not gateway or gateway == "stripe":
        stripe_data = await db.stripe_settlements.find({}).sort("created_at", -1).limit(limit).to_list(limit)
        result["stripe"] = [serialize_doc(d) for d in stripe_data]
    
    if not gateway or gateway == "razorpay":
        razorpay_data = await db.razorpay_settlements.find({}).sort("created_at", -1).limit(limit).to_list(limit)
        result["razorpay"] = [serialize_doc(d) for d in razorpay_data]
    
    return result
