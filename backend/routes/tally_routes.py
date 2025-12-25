from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tally", tags=["Tally Integration"])

# Models
class TallyConfig(BaseModel):
    company_name: str
    server_url: str = "http://localhost:9000"  # Default Tally Prime port
    username: Optional[str] = None
    password: Optional[str] = None
    auto_sync: bool = False
    sync_frequency: str = "daily"  # daily, hourly, realtime
    sync_invoices: bool = True
    sync_payments: bool = True
    sync_ledgers: bool = True

class TallyVoucher(BaseModel):
    voucher_type: str  # Sales, Purchase, Receipt, Payment, Journal
    date: str
    party_name: str
    amount: float
    narration: Optional[str] = None
    ledger_entries: List[dict] = []
    reference: Optional[str] = None

class TallyLedger(BaseModel):
    name: str
    parent: str  # Group name
    opening_balance: float = 0
    is_revenue: bool = False
    gst_applicable: bool = False
    gst_type: Optional[str] = None  # CGST, SGST, IGST

# Dashboard
@router.get("/dashboard")
async def get_tally_dashboard(current_user: dict = Depends(get_current_user)):
    """Get Tally integration dashboard"""
    db = get_database()
    
    config = await db.tally_config.find_one({}, {"_id": 0})
    
    # Get sync stats
    last_sync = await db.tally_sync_logs.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    pending_vouchers = await db.tally_voucher_queue.count_documents({"status": "pending"})
    synced_today = await db.tally_sync_logs.count_documents({
        "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
    })
    
    return {
        "is_configured": config is not None,
        "connection_status": "connected" if config else "not_configured",
        "company_name": config.get("company_name") if config else None,
        "auto_sync": config.get("auto_sync", False) if config else False,
        "stats": {
            "pending_vouchers": pending_vouchers,
            "synced_today": synced_today,
            "last_sync": last_sync.get("created_at") if last_sync else None,
            "last_sync_status": last_sync.get("status") if last_sync else None
        }
    }

# Configuration
@router.get("/config")
async def get_tally_config(current_user: dict = Depends(get_current_user)):
    """Get Tally configuration"""
    db = get_database()
    config = await db.tally_config.find_one({}, {"_id": 0})
    
    if config and config.get("password"):
        config["password"] = "*" * 8
    
    return config or {"is_configured": False}

@router.post("/config")
async def update_tally_config(
    config: TallyConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update Tally configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    config_data = config.dict()
    config_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_data["updated_by"] = current_user["id"]
    
    await db.tally_config.update_one(
        {},
        {"$set": config_data},
        upsert=True
    )
    
    return {"message": "Tally configuration updated", "company": config.company_name}

@router.post("/test-connection")
async def test_tally_connection(current_user: dict = Depends(get_current_user)):
    """Test connection to Tally server"""
    db = get_database()
    config = await db.tally_config.find_one({}, {"_id": 0})
    
    if not config:
        raise HTTPException(status_code=400, detail="Tally not configured")
    
    # In real implementation, would try to connect to Tally server
    # For demo, return mock success
    return {
        "status": "success",
        "message": "Connected to Tally Prime",
        "company_name": config.get("company_name"),
        "tally_version": "Tally Prime 3.0",
        "demo_mode": True
    }

# Voucher Operations
@router.post("/vouchers")
async def create_tally_voucher(
    voucher: TallyVoucher,
    current_user: dict = Depends(get_current_user)
):
    """Create a voucher to sync with Tally"""
    db = get_database()
    
    voucher_data = voucher.dict()
    voucher_data["id"] = str(uuid4())
    voucher_data["status"] = "pending"
    voucher_data["created_at"] = datetime.now(timezone.utc).isoformat()
    voucher_data["created_by"] = current_user["id"]
    
    await db.tally_voucher_queue.insert_one(voucher_data)
    
    return {"message": "Voucher queued for sync", "voucher_id": voucher_data["id"]}

@router.get("/vouchers")
async def get_tally_vouchers(
    status: Optional[str] = None,
    voucher_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get queued vouchers"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if voucher_type:
        query["voucher_type"] = voucher_type
    
    total = await db.tally_voucher_queue.count_documents(query)
    vouchers = await db.tally_voucher_queue.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "vouchers": vouchers,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# Sync Operations
@router.post("/sync")
async def trigger_tally_sync(
    sync_type: str = "all",  # all, invoices, payments, ledgers
    current_user: dict = Depends(get_current_user)
):
    """Trigger manual sync with Tally"""
    db = get_database()
    
    config = await db.tally_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Tally not configured")
    
    # Create sync log
    sync_log = {
        "id": str(uuid4()),
        "sync_type": sync_type,
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "triggered_by": current_user["id"]
    }
    
    await db.tally_sync_logs.insert_one(sync_log)
    
    # In real implementation, would process pending vouchers
    # For demo, update status to completed
    pending = await db.tally_voucher_queue.count_documents({"status": "pending"})
    
    await db.tally_voucher_queue.update_many(
        {"status": "pending"},
        {"$set": {"status": "synced", "synced_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.tally_sync_logs.update_one(
        {"id": sync_log["id"]},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "vouchers_synced": pending
        }}
    )
    
    return {
        "message": f"Sync completed",
        "vouchers_synced": pending,
        "sync_id": sync_log["id"],
        "demo_mode": True
    }

@router.get("/sync/logs")
async def get_sync_logs(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get sync history"""
    db = get_database()
    
    total = await db.tally_sync_logs.count_documents({})
    logs = await db.tally_sync_logs.find({}, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page
    }

# Ledger Operations
@router.post("/ledgers")
async def create_tally_ledger(
    ledger: TallyLedger,
    current_user: dict = Depends(get_current_user)
):
    """Create a ledger in Tally"""
    db = get_database()
    
    ledger_data = ledger.dict()
    ledger_data["id"] = str(uuid4())
    ledger_data["status"] = "pending"
    ledger_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.tally_ledgers.insert_one(ledger_data)
    
    return {"message": "Ledger created", "ledger_id": ledger_data["id"]}

@router.get("/ledgers")
async def get_tally_ledgers(
    parent: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get ledgers synced with Tally"""
    db = get_database()
    
    query = {}
    if parent:
        query["parent"] = parent
    
    ledgers = await db.tally_ledgers.find(query, {"_id": 0}).to_list(100)
    
    return {"ledgers": ledgers}

# Export for Tally Import
@router.get("/export/xml")
async def export_tally_xml(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export data in Tally XML format"""
    db = get_database()
    
    # Get bookings for the period
    query = {}
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        query.setdefault("created_at", {})["$lte"] = to_date
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    
    # Generate Tally XML format (simplified)
    xml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <IMPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>Vouchers</REPORTNAME>
            </REQUESTDESC>
            <REQUESTDATA>
'''
    
    for booking in bookings:
        xml_content += f'''                <TALLYMESSAGE>
                    <VOUCHER>
                        <DATE>{booking.get('created_at', '')[:10].replace('-', '')}</DATE>
                        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                        <PARTYLEDGERNAME>{booking.get('customer_name', 'Cash')}</PARTYLEDGERNAME>
                        <AMOUNT>{booking.get('amount', 0)}</AMOUNT>
                        <NARRATION>Booking: {booking.get('booking_number', '')}</NARRATION>
                    </VOUCHER>
                </TALLYMESSAGE>
'''
    
    xml_content += '''            </REQUESTDATA>
        </IMPORTDATA>
    </BODY>
</ENVELOPE>'''
    
    return {
        "xml_content": xml_content,
        "records_count": len(bookings),
        "format": "Tally Prime XML"
    }
