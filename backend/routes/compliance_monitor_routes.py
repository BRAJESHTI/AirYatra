"""
AI Compliance Monitor - AirYatra CMS
Enterprise-level compliance monitoring with automated reminders.

Features:
1. Daily check for expiring documents
2. Automated email reminders at 90/60/30/15/7/0 days
3. Auto-hide aircraft with expired documents
4. Admin compliance dashboard
5. Operator compliance score
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import uuid
import os
from dotenv import load_dotenv

from database import get_database
from middleware import require_roles

load_dotenv()

router = APIRouter(prefix="/compliance", tags=["AI Compliance Monitor"])


# ============ CONSTANTS ============

# Reminder schedule (days before expiry)
REMINDER_SCHEDULE = [90, 60, 30, 15, 7, 3, 1, 0]

# Document types that require expiry tracking
TRACKED_DOCUMENTS = {
    "insurance_policy": {"label": "Aircraft Insurance", "critical": True},
    "certificate_of_airworthiness": {"label": "Certificate of Airworthiness", "critical": True},
    "maintenance_release": {"label": "Maintenance Release", "critical": True},
    "aoc": {"label": "Air Operator Certificate", "critical": True},
    "dgca_permissions": {"label": "DGCA Permissions", "critical": False},
    "pilot_licence": {"label": "Pilot Licence", "critical": True},
    "copilot_licence": {"label": "Co-Pilot Licence", "critical": False},
    "medical_certificate": {"label": "Medical Certificate", "critical": True},
    "third_party_insurance": {"label": "Third Party Insurance", "critical": False},
    "passenger_liability": {"label": "Passenger Liability Insurance", "critical": False},
    "hull_insurance": {"label": "Hull Insurance", "critical": False}
}

# Compliance score weights
SCORE_WEIGHTS = {
    "documents_valid": 30,
    "documents_uploaded": 20,
    "photos_complete": 15,
    "crew_complete": 15,
    "pricing_set": 10,
    "verified": 10
}


# ============ MODELS ============

class ComplianceAlert(BaseModel):
    """Compliance alert model"""
    document_type: str
    document_label: str
    aircraft_id: Optional[str] = None
    aircraft_registration: Optional[str] = None
    operator_id: str
    operator_name: Optional[str] = None
    expiry_date: str
    days_remaining: int
    severity: str  # critical, warning, info
    action_required: str


class ComplianceAction(BaseModel):
    """Action to take on compliance issues"""
    action: str  # remind, suspend, hide
    target_ids: List[str]
    reason: Optional[str] = None


# ============ HELPER FUNCTIONS ============

def calculate_days_remaining(expiry_date: str) -> int:
    """Calculate days remaining until expiry"""
    try:
        expiry = datetime.strptime(expiry_date, "%Y-%m-%d").date()
        today = datetime.now().date()
        return (expiry - today).days
    except (ValueError, TypeError):
        return 999  # Unknown expiry


def get_severity(days_remaining: int, is_critical: bool) -> str:
    """Determine alert severity based on days remaining"""
    if days_remaining <= 0:
        return "expired"
    elif days_remaining <= 7:
        return "critical"
    elif days_remaining <= 15:
        return "high" if is_critical else "warning"
    elif days_remaining <= 30:
        return "warning"
    elif days_remaining <= 60:
        return "attention"
    else:
        return "info"


def calculate_compliance_score(aircraft: dict) -> dict:
    """Calculate compliance score for an aircraft"""
    score = 0
    details = {}
    
    # Documents valid (30 points)
    docs = aircraft.get("documents", {})
    expiry_fields = ["insurance_expiry", "next_maintenance_due"]
    expired_count = 0
    for field in expiry_fields:
        if docs.get(field):
            days = calculate_days_remaining(docs[field])
            if days <= 0:
                expired_count += 1
    
    if expired_count == 0:
        score += SCORE_WEIGHTS["documents_valid"]
        details["documents_valid"] = {"score": 30, "status": "valid", "message": "All documents valid"}
    else:
        penalty = expired_count * 15
        score += max(0, SCORE_WEIGHTS["documents_valid"] - penalty)
        details["documents_valid"] = {"score": max(0, 30 - penalty), "status": "expired", "message": f"{expired_count} document(s) expired"}
    
    # Documents uploaded (20 points)
    required_docs = ["registration_certificate", "insurance_policy", "maintenance_release"]
    uploaded = sum(1 for d in required_docs if docs.get(d))
    doc_score = int((uploaded / len(required_docs)) * SCORE_WEIGHTS["documents_uploaded"])
    score += doc_score
    details["documents_uploaded"] = {"score": doc_score, "uploaded": uploaded, "required": len(required_docs)}
    
    # Photos complete (15 points)
    photos = aircraft.get("photos", {})
    required_photos = ["front", "rear", "left", "right", "cockpit", "cabin"]
    photo_count = sum(1 for p in required_photos if photos.get(p))
    photo_score = int((photo_count / len(required_photos)) * SCORE_WEIGHTS["photos_complete"])
    score += photo_score
    details["photos_complete"] = {"score": photo_score, "uploaded": photo_count, "required": len(required_photos)}
    
    # Crew complete (15 points)
    crew = aircraft.get("crew", [])
    has_pilot = any(c.get("role") == "pilot" for c in crew)
    crew_score = SCORE_WEIGHTS["crew_complete"] if has_pilot else 0
    score += crew_score
    details["crew_complete"] = {"score": crew_score, "has_pilot": has_pilot}
    
    # Pricing set (10 points)
    pricing = aircraft.get("pricing", {})
    has_price = pricing.get("hourly_price") or pricing.get("one_way_price")
    pricing_score = SCORE_WEIGHTS["pricing_set"] if has_price else 0
    score += pricing_score
    details["pricing_set"] = {"score": pricing_score, "has_pricing": has_price}
    
    # Verified status (10 points)
    verification = aircraft.get("verification", {})
    is_verified = verification.get("status") in ["verified", "premium_verified"]
    verified_score = SCORE_WEIGHTS["verified"] if is_verified else 0
    score += verified_score
    details["verified"] = {"score": verified_score, "status": verification.get("status", "pending")}
    
    return {
        "total_score": score,
        "max_score": 100,
        "percentage": score,
        "grade": "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F",
        "details": details
    }


async def send_compliance_reminder(operator_email: str, alerts: List[dict]):
    """
    Send compliance reminder email
    In production, integrate with email service (SendGrid, SES, etc.)
    """
    # For now, just log the reminder
    # In production, use email service
    print(f"[COMPLIANCE] Sending reminder to {operator_email}: {len(alerts)} alerts")
    
    # Store reminder in database
    db = get_database()
    await db.compliance_reminders.insert_one({
        "id": str(uuid.uuid4()),
        "operator_email": operator_email,
        "alerts_count": len(alerts),
        "alerts": alerts,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "sent"
    })


# ============ COMPLIANCE CHECK ENDPOINTS ============

@router.post("/run-daily-check")
async def run_daily_compliance_check(
    background_tasks: BackgroundTasks,
    send_reminders: bool = True,
    auto_hide_expired: bool = True,
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Run daily compliance check (should be triggered by cron)
    
    Actions:
    1. Check all aircraft for expiring documents
    2. Send reminders to operators
    3. Auto-hide aircraft with expired critical documents
    4. Generate compliance report
    """
    db = get_database()
    
    today = datetime.now().strftime("%Y-%m-%d")
    alerts = []
    actions_taken = []
    
    # Get all aircraft with their documents
    aircraft_list = await db.aircraft_catalog.find(
        {"is_published": True},
        {"_id": 0}
    ).to_list(1000)
    
    # Group alerts by operator
    operator_alerts: Dict[str, List[dict]] = {}
    
    for aircraft in aircraft_list:
        docs = aircraft.get("documents", {})
        operator_id = aircraft["operator_id"]
        
        # Check insurance expiry
        if docs.get("insurance_expiry"):
            days = calculate_days_remaining(docs["insurance_expiry"])
            if days in REMINDER_SCHEDULE or days <= 0:
                alert = {
                    "document_type": "insurance_policy",
                    "document_label": "Aircraft Insurance",
                    "aircraft_id": aircraft["id"],
                    "aircraft_registration": aircraft.get("basic_info", {}).get("registration_number"),
                    "operator_id": operator_id,
                    "expiry_date": docs["insurance_expiry"],
                    "days_remaining": days,
                    "severity": get_severity(days, True),
                    "action_required": "Renew insurance immediately" if days <= 0 else f"Renew insurance within {days} days"
                }
                alerts.append(alert)
                
                if operator_id not in operator_alerts:
                    operator_alerts[operator_id] = []
                operator_alerts[operator_id].append(alert)
                
                # Auto-hide if expired and critical
                if days <= 0 and auto_hide_expired:
                    await db.aircraft_catalog.update_one(
                        {"id": aircraft["id"]},
                        {
                            "$set": {
                                "is_published": False,
                                "auto_hidden_reason": "Insurance expired",
                                "auto_hidden_at": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    )
                    actions_taken.append({
                        "action": "auto_hidden",
                        "aircraft_id": aircraft["id"],
                        "reason": "Insurance expired"
                    })
        
        # Check maintenance due
        if docs.get("next_maintenance_due"):
            days = calculate_days_remaining(docs["next_maintenance_due"])
            if days in REMINDER_SCHEDULE or days <= 0:
                alert = {
                    "document_type": "maintenance_release",
                    "document_label": "Maintenance Due",
                    "aircraft_id": aircraft["id"],
                    "aircraft_registration": aircraft.get("basic_info", {}).get("registration_number"),
                    "operator_id": operator_id,
                    "expiry_date": docs["next_maintenance_due"],
                    "days_remaining": days,
                    "severity": get_severity(days, True),
                    "action_required": "Complete maintenance immediately" if days <= 0 else f"Schedule maintenance within {days} days"
                }
                alerts.append(alert)
                
                if operator_id not in operator_alerts:
                    operator_alerts[operator_id] = []
                operator_alerts[operator_id].append(alert)
                
                # Auto-hide if overdue
                if days <= 0 and auto_hide_expired:
                    await db.aircraft_catalog.update_one(
                        {"id": aircraft["id"]},
                        {
                            "$set": {
                                "is_published": False,
                                "auto_hidden_reason": "Maintenance overdue",
                                "auto_hidden_at": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    )
                    actions_taken.append({
                        "action": "auto_hidden",
                        "aircraft_id": aircraft["id"],
                        "reason": "Maintenance overdue"
                    })
    
    # Send reminders to operators
    reminders_sent = 0
    if send_reminders:
        for operator_id, op_alerts in operator_alerts.items():
            # Get operator email
            operator = await db.users.find_one(
                {"id": operator_id},
                {"_id": 0, "email": 1, "name": 1}
            )
            if operator and operator.get("email"):
                background_tasks.add_task(
                    send_compliance_reminder,
                    operator["email"],
                    op_alerts
                )
                reminders_sent += 1
    
    # Store compliance report
    report = {
        "id": str(uuid.uuid4()),
        "run_date": today,
        "run_at": datetime.now(timezone.utc).isoformat(),
        "total_aircraft_checked": len(aircraft_list),
        "total_alerts": len(alerts),
        "alerts_by_severity": {
            "expired": len([a for a in alerts if a["severity"] == "expired"]),
            "critical": len([a for a in alerts if a["severity"] == "critical"]),
            "high": len([a for a in alerts if a["severity"] == "high"]),
            "warning": len([a for a in alerts if a["severity"] == "warning"]),
            "attention": len([a for a in alerts if a["severity"] == "attention"]),
            "info": len([a for a in alerts if a["severity"] == "info"])
        },
        "operators_notified": reminders_sent,
        "aircraft_auto_hidden": len(actions_taken),
        "actions_taken": actions_taken,
        "alerts": alerts
    }
    
    await db.compliance_reports.insert_one(report)
    
    return {
        "success": True,
        "report_id": report["id"],
        "summary": {
            "aircraft_checked": len(aircraft_list),
            "total_alerts": len(alerts),
            "expired_documents": report["alerts_by_severity"]["expired"],
            "critical_alerts": report["alerts_by_severity"]["critical"],
            "reminders_sent": reminders_sent,
            "aircraft_hidden": len(actions_taken)
        }
    }


@router.get("/alerts")
async def get_compliance_alerts(
    severity: Optional[str] = None,
    days_threshold: int = Query(default=30, le=90),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Get current compliance alerts
    """
    db = get_database()
    
    today = datetime.now().strftime("%Y-%m-%d")
    threshold_date = (datetime.now() + timedelta(days=days_threshold)).strftime("%Y-%m-%d")
    
    alerts = []
    
    # Get aircraft with expiring documents
    aircraft_list = await db.aircraft_catalog.find(
        {
            "$or": [
                {"documents.insurance_expiry": {"$lte": threshold_date}},
                {"documents.next_maintenance_due": {"$lte": threshold_date}}
            ]
        },
        {"_id": 0}
    ).to_list(500)
    
    for aircraft in aircraft_list:
        docs = aircraft.get("documents", {})
        
        # Check insurance
        if docs.get("insurance_expiry") and docs["insurance_expiry"] <= threshold_date:
            days = calculate_days_remaining(docs["insurance_expiry"])
            sev = get_severity(days, True)
            if not severity or sev == severity:
                alerts.append({
                    "id": f"{aircraft['id']}_insurance",
                    "type": "document_expiry",
                    "document_type": "insurance_policy",
                    "document_label": "Aircraft Insurance",
                    "aircraft_id": aircraft["id"],
                    "aircraft_registration": aircraft.get("basic_info", {}).get("registration_number"),
                    "manufacturer_model": f"{aircraft.get('basic_info', {}).get('manufacturer', '')} {aircraft.get('basic_info', {}).get('model', '')}",
                    "operator_id": aircraft["operator_id"],
                    "expiry_date": docs["insurance_expiry"],
                    "days_remaining": days,
                    "severity": sev,
                    "is_published": aircraft.get("is_published", False)
                })
        
        # Check maintenance
        if docs.get("next_maintenance_due") and docs["next_maintenance_due"] <= threshold_date:
            days = calculate_days_remaining(docs["next_maintenance_due"])
            sev = get_severity(days, True)
            if not severity or sev == severity:
                alerts.append({
                    "id": f"{aircraft['id']}_maintenance",
                    "type": "document_expiry",
                    "document_type": "maintenance_release",
                    "document_label": "Maintenance Due",
                    "aircraft_id": aircraft["id"],
                    "aircraft_registration": aircraft.get("basic_info", {}).get("registration_number"),
                    "manufacturer_model": f"{aircraft.get('basic_info', {}).get('manufacturer', '')} {aircraft.get('basic_info', {}).get('model', '')}",
                    "operator_id": aircraft["operator_id"],
                    "expiry_date": docs["next_maintenance_due"],
                    "days_remaining": days,
                    "severity": sev,
                    "is_published": aircraft.get("is_published", False)
                })
    
    # Sort by severity (expired first, then by days remaining)
    severity_order = {"expired": 0, "critical": 1, "high": 2, "warning": 3, "attention": 4, "info": 5}
    alerts.sort(key=lambda x: (severity_order.get(x["severity"], 99), x["days_remaining"]))
    
    return {
        "alerts": alerts,
        "count": len(alerts),
        "by_severity": {
            "expired": len([a for a in alerts if a["severity"] == "expired"]),
            "critical": len([a for a in alerts if a["severity"] == "critical"]),
            "high": len([a for a in alerts if a["severity"] == "high"]),
            "warning": len([a for a in alerts if a["severity"] == "warning"]),
            "attention": len([a for a in alerts if a["severity"] == "attention"]),
            "info": len([a for a in alerts if a["severity"] == "info"])
        }
    }


@router.get("/operator/{operator_id}/score")
async def get_operator_compliance_score(
    operator_id: str,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """
    Get compliance score for an operator
    """
    db = get_database()
    
    # Check access
    if "admin" not in current_user.get("roles", []) and current_user["id"] != operator_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get operator's aircraft
    aircraft_list = await db.aircraft_catalog.find(
        {"operator_id": operator_id},
        {"_id": 0}
    ).to_list(100)
    
    if not aircraft_list:
        return {
            "operator_id": operator_id,
            "overall_score": 0,
            "aircraft_count": 0,
            "message": "No aircraft found"
        }
    
    # Calculate scores for each aircraft
    aircraft_scores = []
    total_score = 0
    
    for aircraft in aircraft_list:
        score = calculate_compliance_score(aircraft)
        aircraft_scores.append({
            "aircraft_id": aircraft["id"],
            "registration": aircraft.get("basic_info", {}).get("registration_number"),
            "model": f"{aircraft.get('basic_info', {}).get('manufacturer', '')} {aircraft.get('basic_info', {}).get('model', '')}",
            "score": score
        })
        total_score += score["total_score"]
    
    overall_score = round(total_score / len(aircraft_list), 1)
    
    return {
        "operator_id": operator_id,
        "overall_score": overall_score,
        "overall_grade": "A" if overall_score >= 90 else "B" if overall_score >= 75 else "C" if overall_score >= 60 else "D" if overall_score >= 40 else "F",
        "aircraft_count": len(aircraft_list),
        "aircraft_scores": aircraft_scores
    }


@router.get("/aircraft/{aircraft_id}/score")
async def get_aircraft_compliance_score(
    aircraft_id: str,
    current_user: dict = Depends(require_roles(["admin", "operator"]))
):
    """
    Get detailed compliance score for an aircraft
    """
    db = get_database()
    
    aircraft = await db.aircraft_catalog.find_one({"id": aircraft_id}, {"_id": 0})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Check access
    if "admin" not in current_user.get("roles", []) and current_user["id"] != aircraft["operator_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    score = calculate_compliance_score(aircraft)
    
    return {
        "aircraft_id": aircraft_id,
        "registration": aircraft.get("basic_info", {}).get("registration_number"),
        "model": f"{aircraft.get('basic_info', {}).get('manufacturer', '')} {aircraft.get('basic_info', {}).get('model', '')}",
        "compliance_score": score,
        "recommendations": generate_recommendations(score)
    }


def generate_recommendations(score: dict) -> List[str]:
    """Generate recommendations based on compliance score"""
    recommendations = []
    details = score.get("details", {})
    
    if details.get("documents_valid", {}).get("status") == "expired":
        recommendations.append("🔴 URGENT: Renew expired documents immediately")
    
    if details.get("documents_uploaded", {}).get("uploaded", 0) < details.get("documents_uploaded", {}).get("required", 3):
        recommendations.append("📄 Upload missing required documents (Registration, Insurance, Maintenance)")
    
    if details.get("photos_complete", {}).get("uploaded", 0) < 6:
        recommendations.append("📷 Upload all required aircraft photos (Front, Rear, Left, Right, Cockpit, Cabin)")
    
    if not details.get("crew_complete", {}).get("has_pilot", False):
        recommendations.append("👨‍✈️ Add pilot information with licence details")
    
    if not details.get("pricing_set", {}).get("has_pricing", False):
        recommendations.append("💰 Set hourly or one-way pricing")
    
    if details.get("verified", {}).get("status") == "pending":
        recommendations.append("✅ Submit for platform verification after completing all requirements")
    
    if not recommendations:
        recommendations.append("🎉 Great job! Your aircraft meets all compliance requirements")
    
    return recommendations


@router.get("/dashboard")
async def get_compliance_dashboard(
    current_user: dict = Depends(require_roles(["admin", "ceo"]))
):
    """
    CEO/Admin compliance dashboard
    """
    db = get_database()
    
    # Aircraft stats
    total_aircraft = await db.aircraft_catalog.count_documents({})
    verified = await db.aircraft_catalog.count_documents({"verification.status": {"$in": ["verified", "premium_verified"]}})
    pending = await db.aircraft_catalog.count_documents({"verification.status": "pending"})
    suspended = await db.aircraft_catalog.count_documents({"verification.status": "suspended"})
    published = await db.aircraft_catalog.count_documents({"is_published": True})
    
    # Expiring documents (next 30 days)
    threshold = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    insurance_expiring = await db.aircraft_catalog.count_documents({
        "documents.insurance_expiry": {"$lte": threshold}
    })
    maintenance_due = await db.aircraft_catalog.count_documents({
        "documents.next_maintenance_due": {"$lte": threshold}
    })
    
    # Get last compliance report
    last_report = await db.compliance_reports.find_one(
        {},
        {"_id": 0},
        sort=[("run_at", -1)]
    )
    
    return {
        "aircraft": {
            "total": total_aircraft,
            "verified": verified,
            "pending": pending,
            "suspended": suspended,
            "published": published
        },
        "compliance_alerts": {
            "insurance_expiring_30d": insurance_expiring,
            "maintenance_due_30d": maintenance_due,
            "total_alerts": insurance_expiring + maintenance_due
        },
        "last_check": {
            "run_at": last_report.get("run_at") if last_report else None,
            "alerts_found": last_report.get("total_alerts") if last_report else 0,
            "aircraft_hidden": last_report.get("aircraft_auto_hidden") if last_report else 0
        }
    }


@router.get("/reports")
async def get_compliance_reports(
    limit: int = Query(default=10, le=50),
    current_user: dict = Depends(require_roles(["admin"]))
):
    """
    Get compliance check reports history
    """
    db = get_database()
    
    reports = await db.compliance_reports.find(
        {},
        {"_id": 0, "alerts": 0}  # Don't include full alerts list
    ).sort("run_at", -1).to_list(limit)
    
    return {
        "reports": reports,
        "count": len(reports)
    }


# ============ SCHEDULER INTEGRATION ============

async def scheduled_compliance_check():
    """
    Function to be called by APScheduler for daily compliance checks
    """
    db = get_database()
    
    # Run the same logic as the manual endpoint
    # This is a simplified version - full implementation would use the endpoint logic
    
    print(f"[COMPLIANCE SCHEDULER] Running daily check at {datetime.now()}")
    
    # Count expiring documents
    today = datetime.now().strftime("%Y-%m-%d")
    
    expired_insurance = await db.aircraft_catalog.count_documents({
        "is_published": True,
        "documents.insurance_expiry": {"$lt": today}
    })
    
    expired_maintenance = await db.aircraft_catalog.count_documents({
        "is_published": True,
        "documents.next_maintenance_due": {"$lt": today}
    })
    
    # Auto-hide aircraft with expired critical documents
    if expired_insurance > 0 or expired_maintenance > 0:
        result = await db.aircraft_catalog.update_many(
            {
                "is_published": True,
                "$or": [
                    {"documents.insurance_expiry": {"$lt": today}},
                    {"documents.next_maintenance_due": {"$lt": today}}
                ]
            },
            {
                "$set": {
                    "is_published": False,
                    "auto_hidden_reason": "Document expired (automated check)",
                    "auto_hidden_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        print(f"[COMPLIANCE SCHEDULER] Auto-hidden {result.modified_count} aircraft with expired documents")
    
    print(f"[COMPLIANCE SCHEDULER] Check complete. Expired: Insurance={expired_insurance}, Maintenance={expired_maintenance}")


# ============ CATEGORIES ENDPOINT ============

# Document categories for the verification checklist
DOCUMENT_CATEGORIES = {
    "operator": {
        "label": "Operator Documents / ऑपरेटर दस्तावेज़",
        "types": [
            {"id": "certificate_of_incorporation", "label": "Certificate of Incorporation / निगमन प्रमाणपत्र", "required": True},
            {"id": "pan_card", "label": "PAN Card / पैन कार्ड", "required": True},
            {"id": "gst_registration", "label": "GST Registration / जीएसटी पंजीकरण", "required": False},
            {"id": "cin_llp", "label": "CIN/LLP Details", "required": False},
            {"id": "address_proof", "label": "Registered Office Address Proof / पता प्रमाण", "required": True},
            {"id": "signatory_id", "label": "Authorized Signatory ID / अधिकृत हस्ताक्षरकर्ता", "required": True}
        ]
    },
    "dgca": {
        "label": "DGCA & Regulatory / DGCA और नियामक",
        "types": [
            {"id": "aoc", "label": "Air Operator Certificate (AOC)", "required": False, "has_expiry": True},
            {"id": "dgca_permissions", "label": "DGCA Permissions/Licences", "required": False, "has_expiry": True},
            {"id": "operations_specifications", "label": "Operations Specifications", "required": False}
        ]
    },
    "aircraft": {
        "label": "Aircraft Documents / विमान दस्तावेज़",
        "types": [
            {"id": "registration_certificate", "label": "Aircraft Registration Certificate / पंजीकरण प्रमाणपत्र", "required": True},
            {"id": "certificate_of_airworthiness", "label": "Certificate of Airworthiness / उड़ान योग्यता प्रमाणपत्र", "required": True, "has_expiry": True},
            {"id": "insurance_policy", "label": "Aircraft Insurance Policy / बीमा पॉलिसी", "required": True, "has_expiry": True},
            {"id": "third_party_insurance", "label": "Third Party Insurance / तृतीय पक्ष बीमा", "required": False, "has_expiry": True},
            {"id": "passenger_liability", "label": "Passenger Liability Insurance / यात्री देयता", "required": False, "has_expiry": True},
            {"id": "hull_insurance", "label": "Hull Insurance / हल बीमा", "required": False, "has_expiry": True},
            {"id": "maintenance_release", "label": "Maintenance Release / रखरखाव रिलीज़", "required": True, "has_expiry": True},
            {"id": "camo_details", "label": "CAMO/Maintenance Provider Details", "required": False}
        ]
    },
    "crew": {
        "label": "Crew Documents / क्रू दस्तावेज़",
        "types": [
            {"id": "pilot_licence", "label": "Pilot Licence / पायलट लाइसेंस", "required": True, "has_expiry": True},
            {"id": "copilot_licence", "label": "Co-Pilot Licence / सह-पायलट लाइसेंस", "required": False, "has_expiry": True},
            {"id": "medical_certificate", "label": "Medical Certificate / मेडिकल सर्टिफिकेट", "required": True, "has_expiry": True},
            {"id": "crew_list", "label": "Crew List / क्रू सूची", "required": True}
        ]
    },
    "agreements": {
        "label": "Agreements / समझौते",
        "types": [
            {"id": "platform_agreement", "label": "AirYatra Platform Agreement", "required": True},
            {"id": "service_agreement", "label": "Service Agreement", "required": False},
            {"id": "insurance_agreement", "label": "Insurance Agreement", "required": False}
        ]
    }
}

PHOTO_CATEGORIES = [
    {"id": "front", "label": "Front View / सामने का दृश्य", "required": True},
    {"id": "rear", "label": "Rear View / पीछे का दृश्य", "required": True},
    {"id": "left", "label": "Left Side / बाईं ओर", "required": True},
    {"id": "right", "label": "Right Side / दाईं ओर", "required": True},
    {"id": "cockpit", "label": "Cockpit / कॉकपिट", "required": True},
    {"id": "cabin", "label": "Cabin / केबिन", "required": True},
    {"id": "interior", "label": "Interior / इंटीरियर", "required": False},
    {"id": "vip_cabin", "label": "VIP Cabin / VIP केबिन", "required": False},
    {"id": "emergency_equipment", "label": "Emergency Equipment / आपातकालीन उपकरण", "required": False},
    {"id": "safety_equipment", "label": "Safety Equipment / सुरक्षा उपकरण", "required": False}
]


@router.get("/categories")
async def get_compliance_categories():
    """
    Get all document and photo categories for verification checklist
    """
    return {
        "document_categories": DOCUMENT_CATEGORIES,
        "photo_categories": PHOTO_CATEGORIES,
        "tracked_documents": TRACKED_DOCUMENTS,
        "reminder_schedule": REMINDER_SCHEDULE,
        "verification_levels": [
            {"status": "pending", "label": "Pending", "emoji": "🔴", "color": "red"},
            {"status": "under_review", "label": "Under Review", "emoji": "🟡", "color": "yellow"},
            {"status": "verified", "label": "Verified", "emoji": "🟢", "color": "green"},
            {"status": "premium_verified", "label": "Premium Verified", "emoji": "🔵", "color": "blue"},
            {"status": "suspended", "label": "Suspended", "emoji": "⚫", "color": "gray"}
        ]
    }
