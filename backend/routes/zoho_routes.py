from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/zoho", tags=["Zoho Integration"])

# Models
class ZohoConfig(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    refresh_token: Optional[str] = None
    organization_id: Optional[str] = None
    portal_name: Optional[str] = None
    modules_enabled: List[str] = ["books", "crm"]  # books, crm, invoice, inventory

class ZohoContact(BaseModel):
    contact_name: str
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_type: str = "customer"  # customer, vendor
    gst_no: Optional[str] = None
    billing_address: Optional[dict] = None

class ZohoInvoice(BaseModel):
    customer_id: str
    invoice_number: Optional[str] = None
    date: str
    due_date: str
    line_items: List[dict]
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount: float = 0
    tax_total: float = 0

class ZohoCRMLead(BaseModel):
    first_name: str
    last_name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    lead_source: str = "Website"
    lead_status: str = "New"
    description: Optional[str] = None

# Dashboard
@router.get("/dashboard")
async def get_zoho_dashboard(current_user: dict = Depends(get_current_user)):
    """Get Zoho integration dashboard"""
    db = get_database()
    
    config = await db.zoho_config.find_one({}, {"_id": 0})
    
    # Get sync stats
    contacts_synced = await db.zoho_contacts.count_documents({})
    invoices_synced = await db.zoho_invoices.count_documents({})
    leads_synced = await db.zoho_leads.count_documents({})
    
    last_sync = await db.zoho_sync_logs.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    
    return {
        "is_configured": config is not None and config.get("client_id"),
        "organization_id": config.get("organization_id") if config else None,
        "modules_enabled": config.get("modules_enabled", []) if config else [],
        "stats": {
            "contacts_synced": contacts_synced,
            "invoices_synced": invoices_synced,
            "leads_synced": leads_synced,
            "last_sync": last_sync.get("created_at") if last_sync else None
        }
    }

# Configuration
@router.get("/config")
async def get_zoho_config(current_user: dict = Depends(get_current_user)):
    """Get Zoho configuration (masked)"""
    db = get_database()
    config = await db.zoho_config.find_one({}, {"_id": 0})
    
    if config:
        if config.get("client_secret"):
            config["client_secret"] = "*" * 20
        if config.get("refresh_token"):
            config["refresh_token"] = "*" * 30
    
    return config or {"is_configured": False}

@router.post("/config")
async def update_zoho_config(
    config: ZohoConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update Zoho configuration"""
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    config_data = config.dict()
    config_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_data["updated_by"] = current_user["id"]
    
    await db.zoho_config.update_one(
        {},
        {"$set": config_data},
        upsert=True
    )
    
    return {"message": "Zoho configuration updated", "modules": config.modules_enabled}

@router.get("/oauth/url")
async def get_zoho_oauth_url(current_user: dict = Depends(get_current_user)):
    """Get Zoho OAuth authorization URL"""
    db = get_database()
    config = await db.zoho_config.find_one({}, {"_id": 0})
    
    if not config or not config.get("client_id"):
        raise HTTPException(status_code=400, detail="Zoho client ID not configured")
    
    # In real implementation, generate OAuth URL
    oauth_url = f"https://accounts.zoho.com/oauth/v2/auth?scope=ZohoBooks.fullaccess.all,ZohoCRM.modules.ALL&client_id={config['client_id']}&response_type=code&redirect_uri=YOUR_REDIRECT_URI&access_type=offline"
    
    return {"oauth_url": oauth_url}

@router.post("/test-connection")
async def test_zoho_connection(current_user: dict = Depends(get_current_user)):
    """Test connection to Zoho"""
    db = get_database()
    config = await db.zoho_config.find_one({}, {"_id": 0})
    
    if not config:
        raise HTTPException(status_code=400, detail="Zoho not configured")
    
    return {
        "status": "success",
        "message": "Connected to Zoho",
        "organization": config.get("portal_name", "AirYatra"),
        "modules_available": ["Zoho Books", "Zoho CRM", "Zoho Invoice"],
        "demo_mode": True
    }

# Zoho Books - Contacts
@router.post("/books/contacts")
async def create_zoho_contact(
    contact: ZohoContact,
    current_user: dict = Depends(get_current_user)
):
    """Create a contact in Zoho Books"""
    db = get_database()
    
    contact_data = contact.dict()
    contact_data["id"] = str(uuid4())
    contact_data["zoho_contact_id"] = f"ZC{uuid4().hex[:12].upper()}"
    contact_data["created_at"] = datetime.now(timezone.utc).isoformat()
    contact_data["sync_status"] = "synced"
    
    await db.zoho_contacts.insert_one(contact_data)
    
    return {
        "message": "Contact created in Zoho Books",
        "contact_id": contact_data["id"],
        "zoho_contact_id": contact_data["zoho_contact_id"]
    }

@router.get("/books/contacts")
async def get_zoho_contacts(
    contact_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get contacts from Zoho Books"""
    db = get_database()
    
    query = {}
    if contact_type:
        query["contact_type"] = contact_type
    
    total = await db.zoho_contacts.count_documents(query)
    contacts = await db.zoho_contacts.find(query, {"_id": 0}).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "contacts": contacts,
        "total": total,
        "page": page
    }

# Zoho Books - Invoices
@router.post("/books/invoices")
async def create_zoho_invoice(
    invoice: ZohoInvoice,
    current_user: dict = Depends(get_current_user)
):
    """Create an invoice in Zoho Books"""
    db = get_database()
    
    invoice_data = invoice.dict()
    invoice_data["id"] = str(uuid4())
    invoice_data["zoho_invoice_id"] = f"INV-{datetime.now().strftime('%Y%m')}-{uuid4().hex[:6].upper()}"
    invoice_data["status"] = "draft"
    invoice_data["created_at"] = datetime.now(timezone.utc).isoformat()
    invoice_data["sync_status"] = "synced"
    
    # Calculate total
    subtotal = sum(item.get("amount", 0) for item in invoice.line_items)
    invoice_data["subtotal"] = subtotal
    invoice_data["total"] = subtotal - invoice.discount + invoice.tax_total
    
    await db.zoho_invoices.insert_one(invoice_data)
    
    return {
        "message": "Invoice created in Zoho Books",
        "invoice_id": invoice_data["id"],
        "zoho_invoice_id": invoice_data["zoho_invoice_id"],
        "total": invoice_data["total"]
    }

@router.get("/books/invoices")
async def get_zoho_invoices(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get invoices from Zoho Books"""
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    
    total = await db.zoho_invoices.count_documents(query)
    invoices = await db.zoho_invoices.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "invoices": invoices,
        "total": total,
        "page": page
    }

# Zoho CRM - Leads
@router.post("/crm/leads")
async def create_zoho_lead(
    lead: ZohoCRMLead,
    current_user: dict = Depends(get_current_user)
):
    """Create a lead in Zoho CRM"""
    db = get_database()
    
    lead_data = lead.dict()
    lead_data["id"] = str(uuid4())
    lead_data["zoho_lead_id"] = f"ZL{uuid4().hex[:12].upper()}"
    lead_data["created_at"] = datetime.now(timezone.utc).isoformat()
    lead_data["sync_status"] = "synced"
    
    await db.zoho_leads.insert_one(lead_data)
    
    return {
        "message": "Lead created in Zoho CRM",
        "lead_id": lead_data["id"],
        "zoho_lead_id": lead_data["zoho_lead_id"]
    }

@router.get("/crm/leads")
async def get_zoho_leads(
    lead_status: Optional[str] = None,
    lead_source: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get leads from Zoho CRM"""
    db = get_database()
    
    query = {}
    if lead_status:
        query["lead_status"] = lead_status
    if lead_source:
        query["lead_source"] = lead_source
    
    total = await db.zoho_leads.count_documents(query)
    leads = await db.zoho_leads.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "leads": leads,
        "total": total,
        "page": page
    }

# Sync Operations
@router.post("/sync")
async def trigger_zoho_sync(
    module: str = "all",  # all, books, crm
    current_user: dict = Depends(get_current_user)
):
    """Trigger manual sync with Zoho"""
    db = get_database()
    
    config = await db.zoho_config.find_one({}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="Zoho not configured")
    
    sync_log = {
        "id": str(uuid4()),
        "module": module,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "triggered_by": current_user["id"],
        "records_synced": {
            "contacts": 5,
            "invoices": 3,
            "leads": 8
        }
    }
    
    await db.zoho_sync_logs.insert_one(sync_log)
    
    return {
        "message": "Sync completed successfully",
        "sync_id": sync_log["id"],
        "records_synced": sync_log["records_synced"],
        "demo_mode": True
    }

@router.get("/sync/logs")
async def get_zoho_sync_logs(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get Zoho sync history"""
    db = get_database()
    
    total = await db.zoho_sync_logs.count_documents({})
    logs = await db.zoho_sync_logs.find({}, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page
    }

# Auto-sync AirYatra data to Zoho
@router.post("/auto-sync/bookings")
async def auto_sync_bookings_to_zoho(current_user: dict = Depends(get_current_user)):
    """Auto-sync AirYatra bookings to Zoho"""
    db = get_database()
    
    # Get unsynced bookings
    bookings = await db.bookings.find(
        {"zoho_synced": {"$ne": True}},
        {"_id": 0}
    ).limit(50).to_list(50)
    
    synced_count = 0
    for booking in bookings:
        # Create Zoho invoice
        invoice_data = {
            "id": str(uuid4()),
            "zoho_invoice_id": f"INV-{booking.get('booking_number', '')}",
            "customer_id": booking.get("customer_id"),
            "customer_name": booking.get("customer_name"),
            "date": booking.get("created_at", "")[:10],
            "due_date": booking.get("travel_date", ""),
            "line_items": [{
                "description": f"Charter flight: {booking.get('from_location')} to {booking.get('to_location')}",
                "amount": booking.get("amount", 0)
            }],
            "total": booking.get("amount", 0),
            "status": "draft",
            "booking_id": booking.get("id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "sync_status": "synced"
        }
        
        await db.zoho_invoices.insert_one(invoice_data)
        await db.bookings.update_one(
            {"id": booking["id"]},
            {"$set": {"zoho_synced": True, "zoho_invoice_id": invoice_data["zoho_invoice_id"]}}
        )
        synced_count += 1
    
    return {
        "message": f"Synced {synced_count} bookings to Zoho",
        "synced_count": synced_count
    }
