"""
AirYatra Finance ERP - Phase 4 Advanced Features
Budget vs Actual, AI Finance Assistant, Auto Reminders, Bill Repository
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import get_database
from enum import Enum
import uuid
import os
import json
import asyncio

router = APIRouter(prefix="/finance/phase4", tags=["finance-erp-phase4"])

# ============== MODELS ==============
class BudgetCreate(BaseModel):
    category: str
    month: str  # Format: "2026-08"
    planned_amount: float
    notes: Optional[str] = None

class BudgetUpdate(BaseModel):
    planned_amount: Optional[float] = None
    notes: Optional[str] = None

class AIQueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None

class ReminderConfig(BaseModel):
    challan_type: str
    days_before: List[int] = [7, 3, 1]
    email_enabled: bool = True
    whatsapp_enabled: bool = False
    recipients: List[str] = []

class BillCreate(BaseModel):
    vendor_id: str
    vendor_name: str
    invoice_number: str
    invoice_date: str
    amount: float
    category: str
    description: Optional[str] = None
    gst_number: Optional[str] = None
    file_url: Optional[str] = None
    ocr_data: Optional[dict] = None
    tags: List[str] = []

# Helper
def serialize_doc(doc):
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

# Budget categories for aviation business
BUDGET_CATEGORIES = [
    "fuel_expenses", "maintenance", "pilot_salaries", "crew_salaries",
    "insurance", "hangar_rental", "vendor_payments", "marketing",
    "office_expenses", "travel", "legal_compliance", "gst_tds",
    "utilities", "software_licenses", "training", "miscellaneous"
]

# ============== BUDGET VS ACTUAL ==============
@router.post("/budget")
async def create_budget(budget: BudgetCreate):
    """Create or update a budget for a category and month"""
    db = get_database()
    
    # Check if budget exists for this category and month
    existing = await db.budgets.find_one({
        "category": budget.category,
        "month": budget.month
    })
    
    if existing:
        # Update existing
        await db.budgets.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "planned_amount": budget.planned_amount,
                "notes": budget.notes,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return {"success": True, "message": "Budget updated", "id": str(existing["_id"])}
    
    # Create new
    budget_doc = {
        "id": str(uuid.uuid4()),
        "category": budget.category,
        "month": budget.month,
        "planned_amount": budget.planned_amount,
        "actual_amount": 0,
        "notes": budget.notes,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.budgets.insert_one(budget_doc)
    return {"success": True, "budget": serialize_doc(budget_doc)}

@router.get("/budget")
async def get_budgets(month: Optional[str] = None):
    """Get all budgets, optionally filtered by month"""
    db = get_database()
    
    query = {}
    if month:
        query["month"] = month
    
    budgets = await db.budgets.find(query).to_list(length=500)
    
    # Calculate actual amounts from transactions
    for budget in budgets:
        month_str = budget.get("month", "")
        category = budget.get("category", "")
        
        # Get actual spending from transactions
        if month_str:
            year, mon = month_str.split("-")
            start_date = f"{year}-{mon}-01"
            end_date = f"{year}-{mon}-31"
            
            # Sum debit transactions in this category
            pipeline = [
                {"$match": {
                    "category": category,
                    "transaction_type": "debit",
                    "created_at": {"$gte": start_date, "$lte": end_date}
                }},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            
            result = await db.finance_transactions.aggregate(pipeline).to_list(length=1)
            budget["actual_amount"] = result[0]["total"] if result else 0
            budget["variance"] = budget["planned_amount"] - budget["actual_amount"]
            budget["variance_percent"] = round(
                (budget["variance"] / budget["planned_amount"] * 100) 
                if budget["planned_amount"] > 0 else 0, 1
            )
    
    # Summary
    total_planned = sum(b.get("planned_amount", 0) for b in budgets)
    total_actual = sum(b.get("actual_amount", 0) for b in budgets)
    
    return {
        "budgets": [serialize_doc(b) for b in budgets],
        "summary": {
            "total_planned": total_planned,
            "total_actual": total_actual,
            "total_variance": total_planned - total_actual,
            "utilization_percent": round((total_actual / total_planned * 100) if total_planned > 0 else 0, 1)
        },
        "categories": BUDGET_CATEGORIES
    }

@router.get("/budget/comparison")
async def get_budget_comparison(months: int = 6):
    """Get budget vs actual comparison for multiple months"""
    db = get_database()
    
    now = datetime.now(timezone.utc)
    comparison = []
    
    for i in range(months):
        month_date = now - timedelta(days=30 * i)
        month_str = month_date.strftime("%Y-%m")
        
        budgets = await db.budgets.find({"month": month_str}).to_list(length=100)
        
        total_planned = sum(b.get("planned_amount", 0) for b in budgets)
        total_actual = sum(b.get("actual_amount", 0) for b in budgets)
        
        comparison.append({
            "month": month_str,
            "planned": total_planned,
            "actual": total_actual,
            "variance": total_planned - total_actual
        })
    
    return {"comparison": list(reversed(comparison))}

# ============== AI FINANCE ASSISTANT ==============
@router.post("/ai-assistant/query")
async def ai_finance_query(request: AIQueryRequest):
    """Process natural language finance queries using AI"""
    db = get_database()
    
    # Gather financial context
    context_data = await gather_finance_context(db)
    
    # Build system prompt with financial data
    system_prompt = f"""You are AirYatra's AI Finance Assistant (वित्त सहायक). You help CFOs and finance teams analyze financial data.

Current Financial Context:
- Total Bank Balance: ₹{context_data['bank_balance']:,.0f}
- Cash in Hand: ₹{context_data['cash_balance']:,.0f}
- Pending Vendor Payments: {context_data['pending_vendor_count']} bills worth ₹{context_data['pending_vendor_amount']:,.0f}
- Pending Challans: {context_data['pending_challan_count']} worth ₹{context_data['pending_challan_amount']:,.0f}
- Today's Collection: ₹{context_data['today_collection']:,.0f}
- Today's Payments: ₹{context_data['today_payments']:,.0f}
- Monthly Revenue: ₹{context_data['monthly_revenue']:,.0f}
- Monthly Expenses: ₹{context_data['monthly_expenses']:,.0f}

Recent Transactions:
{context_data['recent_transactions']}

Pending Items:
{context_data['pending_items']}

Guidelines:
1. Always respond in Hinglish (mix of Hindi and English)
2. Use ₹ symbol for Indian Rupees
3. Format large numbers in Lakhs (L) and Crores (Cr)
4. Be concise but informative
5. If asked about specific data not in context, suggest how to find it
6. Provide actionable insights when relevant"""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return {"response": "AI Assistant unavailable - API key not configured", "success": False}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=request.session_id or f"finance-{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=request.query)
        response = await chat.send_message(user_message)
        
        # Store query in history
        await db.ai_finance_queries.insert_one({
            "query": request.query,
            "response": response,
            "session_id": request.session_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "response": response,
            "context_summary": {
                "bank_balance": context_data['bank_balance'],
                "pending_payments": context_data['pending_vendor_count']
            }
        }
    except Exception as e:
        return {
            "success": False,
            "response": f"AI query failed: {str(e)}",
            "fallback": generate_fallback_response(request.query, context_data)
        }

@router.post("/ai-assistant/stream")
async def ai_finance_stream(request: AIQueryRequest):
    """Stream AI response for real-time chat experience"""
    db = get_database()
    context_data = await gather_finance_context(db)
    
    system_prompt = f"""You are AirYatra's AI Finance Assistant. Current data:
- Bank: ₹{context_data['bank_balance']:,.0f}, Cash: ₹{context_data['cash_balance']:,.0f}
- Pending: {context_data['pending_vendor_count']} vendor bills (₹{context_data['pending_vendor_amount']:,.0f})
- Today: +₹{context_data['today_collection']:,.0f} / -₹{context_data['today_payments']:,.0f}
Respond in Hinglish. Be helpful and concise."""

    async def generate():
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
            from dotenv import load_dotenv
            load_dotenv()
            
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            if not api_key:
                yield f"data: {json.dumps({'error': 'API key not configured'})}\n\n"
                return
            
            chat = LlmChat(
                api_key=api_key,
                session_id=request.session_id or f"finance-stream-{uuid.uuid4()}",
                system_message=system_prompt
            ).with_model("openai", "gpt-4o")
            
            user_message = UserMessage(text=request.query)
            
            async for event in chat.stream_message(user_message):
                if isinstance(event, TextDelta):
                    yield f"data: {json.dumps({'content': event.content})}\n\n"
                elif isinstance(event, StreamDone):
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    break
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

async def gather_finance_context(db):
    """Gather current financial data for AI context"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Bank balances
    bank_accounts = await db.bank_accounts.find({"is_active": {"$ne": False}}).to_list(100)
    bank_balance = sum(a.get("current_balance", 0) for a in bank_accounts)
    
    # Cash balance
    cash_entries = await db.cash_entries.find({}).to_list(1000)
    cash_balance = sum(e.get("amount", 0) if e.get("entry_type") == "in" else -e.get("amount", 0) for e in cash_entries)
    
    # Pending vendor payments
    pending_bills = await db.vendor_bills.find({
        "payment_status": {"$in": ["pending", "approved", "unpaid"]}
    }).to_list(100)
    pending_vendor_count = len(pending_bills)
    pending_vendor_amount = sum(b.get("net_payable", b.get("amount", 0)) for b in pending_bills)
    
    # Pending challans
    pending_challans = await db.challans.find({
        "status": {"$in": ["pending", "overdue"]}
    }).to_list(100)
    pending_challan_count = len(pending_challans)
    pending_challan_amount = sum(c.get("amount", 0) for c in pending_challans)
    
    # Today's transactions
    today_transactions = await db.finance_transactions.find({
        "created_at": {"$gte": today_start.isoformat()}
    }).to_list(100)
    today_collection = sum(t.get("amount", 0) for t in today_transactions if t.get("transaction_type") == "credit")
    today_payments = sum(t.get("amount", 0) for t in today_transactions if t.get("transaction_type") == "debit")
    
    # Monthly summary
    monthly_transactions = await db.finance_transactions.find({
        "created_at": {"$gte": month_start.isoformat()}
    }).to_list(1000)
    monthly_revenue = sum(t.get("amount", 0) for t in monthly_transactions if t.get("transaction_type") == "credit")
    monthly_expenses = sum(t.get("amount", 0) for t in monthly_transactions if t.get("transaction_type") == "debit")
    
    # Recent transactions (last 10)
    recent = await db.finance_transactions.find({}).sort("created_at", -1).to_list(10)
    recent_str = "\n".join([
        f"- {t.get('description', 'Transaction')}: ₹{t.get('amount', 0):,.0f} ({t.get('transaction_type', '')})"
        for t in recent
    ])
    
    # Pending items summary
    pending_items_str = f"""
- Vendor Bills: {pending_vendor_count} pending (₹{pending_vendor_amount:,.0f})
- GST Challans: {len([c for c in pending_challans if c.get('challan_type') == 'GST'])} pending
- TDS Challans: {len([c for c in pending_challans if c.get('challan_type') == 'TDS'])} pending
- PF Challans: {len([c for c in pending_challans if c.get('challan_type') == 'PF'])} pending"""
    
    return {
        "bank_balance": bank_balance,
        "cash_balance": cash_balance,
        "pending_vendor_count": pending_vendor_count,
        "pending_vendor_amount": pending_vendor_amount,
        "pending_challan_count": pending_challan_count,
        "pending_challan_amount": pending_challan_amount,
        "today_collection": today_collection,
        "today_payments": today_payments,
        "monthly_revenue": monthly_revenue,
        "monthly_expenses": monthly_expenses,
        "recent_transactions": recent_str,
        "pending_items": pending_items_str
    }

def generate_fallback_response(query: str, context: dict):
    """Generate a basic response without AI"""
    query_lower = query.lower()
    
    if "balance" in query_lower or "बैलेंस" in query_lower:
        return f"Current bank balance: ₹{context['bank_balance']:,.0f}, Cash: ₹{context['cash_balance']:,.0f}"
    elif "pending" in query_lower or "पेंडिंग" in query_lower:
        return f"Pending: {context['pending_vendor_count']} vendor bills (₹{context['pending_vendor_amount']:,.0f}), {context['pending_challan_count']} challans"
    elif "today" in query_lower or "आज" in query_lower:
        return f"Today: Collection ₹{context['today_collection']:,.0f}, Payments ₹{context['today_payments']:,.0f}"
    else:
        return "Please ask about balance, pending payments, or today's transactions."

# ============== AUTO REMINDER ENGINE ==============
@router.post("/reminders/configure")
async def configure_reminders(config: ReminderConfig):
    """Configure auto reminders for challans"""
    db = get_database()
    
    reminder_doc = {
        "id": str(uuid.uuid4()),
        "challan_type": config.challan_type,
        "days_before": config.days_before,
        "email_enabled": config.email_enabled,
        "whatsapp_enabled": config.whatsapp_enabled,
        "recipients": config.recipients,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Upsert - update if exists for this challan type
    await db.reminder_configs.update_one(
        {"challan_type": config.challan_type},
        {"$set": reminder_doc},
        upsert=True
    )
    
    return {"success": True, "config": reminder_doc}

@router.get("/reminders/config")
async def get_reminder_configs():
    """Get all reminder configurations"""
    db = get_database()
    configs = await db.reminder_configs.find({}).to_list(100)
    return {"configs": [serialize_doc(c) for c in configs]}

@router.get("/reminders/pending")
async def get_pending_reminders():
    """Get all pending reminders that need to be sent"""
    db = get_database()
    now = datetime.now(timezone.utc)
    
    # Get all active reminder configs
    configs = await db.reminder_configs.find({"is_active": True}).to_list(100)
    
    pending_reminders = []
    
    for config in configs:
        # Get pending challans of this type
        challans = await db.challans.find({
            "challan_type": config.get("challan_type"),
            "status": {"$in": ["pending", "overdue"]}
        }).to_list(100)
        
        for challan in challans:
            due_date_str = challan.get("due_date", "")
            try:
                if isinstance(due_date_str, str):
                    due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                else:
                    due_date = due_date_str
                
                days_remaining = (due_date.replace(tzinfo=timezone.utc) - now).days
                
                # Check if we should send reminder
                for days_before in config.get("days_before", [7, 3, 1]):
                    if days_remaining == days_before:
                        pending_reminders.append({
                            "challan_id": challan.get("id"),
                            "challan_type": challan.get("challan_type"),
                            "period": challan.get("period"),
                            "amount": challan.get("amount"),
                            "due_date": due_date_str,
                            "days_remaining": days_remaining,
                            "email_enabled": config.get("email_enabled"),
                            "whatsapp_enabled": config.get("whatsapp_enabled"),
                            "recipients": config.get("recipients", [])
                        })
                        break
            except (ValueError, TypeError, AttributeError):
                pass
    
    return {
        "pending_reminders": pending_reminders,
        "count": len(pending_reminders)
    }

@router.post("/reminders/send")
async def send_reminders(background_tasks: BackgroundTasks):
    """Trigger sending of all pending reminders"""
    db = get_database()
    
    # Get pending reminders
    reminders_response = await get_pending_reminders()
    pending = reminders_response.get("pending_reminders", [])
    
    sent_count = 0
    for reminder in pending:
        # Log reminder (actual email/WhatsApp integration would go here)
        await db.reminder_logs.insert_one({
            "id": str(uuid.uuid4()),
            "challan_id": reminder.get("challan_id"),
            "challan_type": reminder.get("challan_type"),
            "period": reminder.get("period"),
            "amount": reminder.get("amount"),
            "days_remaining": reminder.get("days_remaining"),
            "sent_via": "email" if reminder.get("email_enabled") else "log",
            "recipients": reminder.get("recipients"),
            "sent_at": datetime.now(timezone.utc),
            "status": "sent"
        })
        sent_count += 1
    
    return {
        "success": True,
        "reminders_sent": sent_count,
        "message": f"Sent {sent_count} reminders"
    }

@router.get("/reminders/history")
async def get_reminder_history(limit: int = 50):
    """Get reminder history"""
    db = get_database()
    logs = await db.reminder_logs.find({}).sort("sent_at", -1).to_list(limit)
    return {"logs": [serialize_doc(l) for l in logs]}

# ============== BILL REPOSITORY ==============
@router.post("/bills")
async def create_bill(bill: BillCreate):
    """Create a bill entry in repository"""
    db = get_database()
    
    bill_doc = {
        "id": str(uuid.uuid4()),
        "bill_number": f"BILL-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}",
        "vendor_id": bill.vendor_id,
        "vendor_name": bill.vendor_name,
        "invoice_number": bill.invoice_number,
        "invoice_date": bill.invoice_date,
        "amount": bill.amount,
        "category": bill.category,
        "description": bill.description,
        "gst_number": bill.gst_number,
        "file_url": bill.file_url,
        "ocr_data": bill.ocr_data,
        "tags": bill.tags,
        "is_archived": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.bill_repository.insert_one(bill_doc)
    return {"success": True, "bill": serialize_doc(bill_doc)}

@router.get("/bills")
async def get_bills(
    search: Optional[str] = None,
    vendor_id: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Search and filter bills in repository"""
    db = get_database()
    
    query = {"is_archived": {"$ne": True}}
    
    if search:
        query["$or"] = [
            {"vendor_name": {"$regex": search, "$options": "i"}},
            {"invoice_number": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"bill_number": {"$regex": search, "$options": "i"}}
        ]
    
    if vendor_id:
        query["vendor_id"] = vendor_id
    
    if category:
        query["category"] = category
    
    if tag:
        query["tags"] = tag
    
    if from_date:
        query["invoice_date"] = {"$gte": from_date}
    
    if to_date:
        if "invoice_date" in query:
            query["invoice_date"]["$lte"] = to_date
        else:
            query["invoice_date"] = {"$lte": to_date}
    
    total = await db.bill_repository.count_documents(query)
    bills = await db.bill_repository.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get unique categories and tags for filters
    all_bills = await db.bill_repository.find({}).to_list(1000)
    categories = list(set(b.get("category", "") for b in all_bills if b.get("category")))
    tags = list(set(tag for b in all_bills for tag in b.get("tags", [])))
    
    return {
        "bills": [serialize_doc(b) for b in bills],
        "total": total,
        "page": skip // limit + 1,
        "filters": {
            "categories": sorted(categories),
            "tags": sorted(tags)
        }
    }

@router.get("/bills/{bill_id}")
async def get_bill(bill_id: str):
    """Get a specific bill by ID"""
    db = get_database()
    bill = await db.bill_repository.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"bill": serialize_doc(bill)}

@router.put("/bills/{bill_id}/archive")
async def archive_bill(bill_id: str):
    """Archive a bill"""
    db = get_database()
    result = await db.bill_repository.update_one(
        {"id": bill_id},
        {"$set": {"is_archived": True, "archived_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"success": True, "message": "Bill archived"}

@router.put("/bills/{bill_id}/tags")
async def update_bill_tags(bill_id: str, tags: List[str]):
    """Update tags for a bill"""
    db = get_database()
    result = await db.bill_repository.update_one(
        {"id": bill_id},
        {"$set": {"tags": tags, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"success": True, "tags": tags}

@router.get("/bills/stats")
async def get_bill_stats():
    """Get bill repository statistics"""
    db = get_database()
    
    all_bills = await db.bill_repository.find({"is_archived": {"$ne": True}}).to_list(10000)
    
    total_amount = sum(b.get("amount", 0) for b in all_bills)
    
    # Group by category
    by_category = {}
    for bill in all_bills:
        cat = bill.get("category", "uncategorized")
        if cat not in by_category:
            by_category[cat] = {"count": 0, "amount": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["amount"] += bill.get("amount", 0)
    
    # Group by month
    by_month = {}
    for bill in all_bills:
        date_str = bill.get("invoice_date", "")
        if date_str and len(date_str) >= 7:
            month = date_str[:7]
            if month not in by_month:
                by_month[month] = {"count": 0, "amount": 0}
            by_month[month]["count"] += 1
            by_month[month]["amount"] += bill.get("amount", 0)
    
    return {
        "total_bills": len(all_bills),
        "total_amount": total_amount,
        "by_category": by_category,
        "by_month": dict(sorted(by_month.items(), reverse=True)[:12]),
        "average_bill_amount": total_amount / len(all_bills) if all_bills else 0
    }
