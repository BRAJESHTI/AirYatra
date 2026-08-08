"""
AirYatra Report Export Routes
API endpoints for downloading Excel reports
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional

from database import get_database
from middleware import get_current_user, require_roles
from services.report_export_service import report_export_service

router = APIRouter(prefix="/reports", tags=["Report Export"])


@router.get("/export/bookings")
async def export_bookings_report(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(1000, le=10000, description="Max records"),
    current_user: dict = Depends(require_roles(["admin", "super_admin", "operator", "finance"])),
    db = Depends(get_database)
):
    """
    Export bookings as Excel file.
    
    Download a comprehensive booking report with:
    - Booking details
    - Customer info
    - Route and passengers
    - Amount and status
    - Summary statistics
    """
    query = {}
    
    # Date filter
    if start_date:
        query["departure_date"] = {"$gte": start_date}
    if end_date:
        if "departure_date" in query:
            query["departure_date"]["$lte"] = end_date
        else:
            query["departure_date"] = {"$lte": end_date}
    
    # Status filter
    if status:
        query["status"] = status
    
    # Fetch bookings from both collections
    inquiries = await db.inquiries.find(query, {"_id": 0}).limit(limit).to_list(limit)
    bookings_data = await db.bookings.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    # Combine and dedupe
    all_bookings = inquiries + bookings_data
    seen_ids = set()
    unique_bookings = []
    for b in all_bookings:
        bid = b.get('id')
        if bid and bid not in seen_ids:
            seen_ids.add(bid)
            unique_bookings.append(b)
    
    # Sort by date
    unique_bookings.sort(key=lambda x: x.get('departure_date', x.get('date', '')), reverse=True)
    
    # Generate Excel
    date_range = (start_date, end_date) if start_date and end_date else None
    buffer = report_export_service.generate_booking_report(
        bookings=unique_bookings[:limit],
        title="Booking Report",
        date_range=date_range
    )
    
    filename = f"AirYatra_Bookings_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache"
        }
    )


@router.get("/export/finance")
async def export_finance_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    limit: int = Query(1000, le=10000),
    current_user: dict = Depends(require_roles(["admin", "super_admin", "finance"])),
    db = Depends(get_database)
):
    """
    Export financial transactions as Excel file.
    
    Includes:
    - Transaction details
    - Payment methods
    - GST breakdown
    - Revenue summary
    """
    query = {}
    
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        if "created_at" in query:
            query["created_at"]["$lte"] = end_dt
        else:
            query["created_at"] = {"$lte": end_dt}
    
    if payment_method:
        query["payment_method"] = payment_method
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Convert datetime to string for report
    for txn in transactions:
        if isinstance(txn.get('created_at'), datetime):
            txn['created_at'] = txn['created_at'].strftime('%Y-%m-%d %H:%M')
    
    buffer = report_export_service.generate_finance_report(
        transactions=transactions,
        title="Financial Report",
        date_range=(start_date, end_date) if start_date and end_date else None
    )
    
    filename = f"AirYatra_Finance_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/refunds")
async def export_refunds_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(500, le=5000),
    current_user: dict = Depends(require_roles(["admin", "super_admin", "finance"])),
    db = Depends(get_database)
):
    """Export refunds report as Excel"""
    query = {}
    
    if status:
        query["status"] = status
    
    refunds = await db.refunds.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Also check unified_refunds collection
    unified_refunds = await db.unified_refunds.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    all_refunds = refunds + unified_refunds
    
    # Convert dates
    for r in all_refunds:
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].strftime('%Y-%m-%d %H:%M')
    
    buffer = report_export_service.generate_refund_report(
        refunds=all_refunds,
        title="Refund Report"
    )
    
    filename = f"AirYatra_Refunds_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/customers")
async def export_customers_report(
    limit: int = Query(1000, le=10000),
    current_user: dict = Depends(require_roles(["admin", "super_admin"])),
    db = Depends(get_database)
):
    """Export customer analytics as Excel"""
    
    # Get customers with their booking stats
    customers = await db.users.find(
        {"roles": {"$in": ["customer"]}},
        {"_id": 0, "password": 0, "hashed_password": 0}
    ).limit(limit).to_list(limit)
    
    # Enrich with booking stats
    for customer in customers:
        user_id = customer.get('id')
        if user_id:
            booking_count = await db.inquiries.count_documents({"user_id": user_id})
            customer['total_bookings'] = booking_count
            
            # Get total spent
            pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
            ]
            result = await db.inquiries.aggregate(pipeline).to_list(1)
            customer['total_spent'] = result[0]['total'] if result else 0
    
    buffer = report_export_service.generate_customer_report(
        customers=customers,
        title="Customer Report"
    )
    
    filename = f"AirYatra_Customers_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/available")
async def list_available_reports(
    current_user: dict = Depends(require_roles(["admin", "super_admin", "operator", "finance"]))
):
    """List all available reports for export"""
    
    user_roles = current_user.get("roles", [])
    is_admin = any(r in user_roles for r in ["admin", "super_admin"])
    is_finance = "finance" in user_roles
    
    reports = [
        {
            "id": "bookings",
            "name": "Booking Report",
            "description": "All bookings with customer details, routes, and amounts",
            "endpoint": "/api/reports/export/bookings",
            "format": "Excel (.xlsx)",
            "icon": "📋"
        }
    ]
    
    if is_admin or is_finance:
        reports.extend([
            {
                "id": "finance",
                "name": "Finance Report",
                "description": "Transactions, revenue, and GST breakdown",
                "endpoint": "/api/reports/export/finance",
                "format": "Excel (.xlsx)",
                "icon": "💰"
            },
            {
                "id": "refunds",
                "name": "Refund Report",
                "description": "All refunds with amounts and status",
                "endpoint": "/api/reports/export/refunds",
                "format": "Excel (.xlsx)",
                "icon": "↩️"
            }
        ])
    
    if is_admin:
        reports.append({
            "id": "customers",
            "name": "Customer Report",
            "description": "Customer analytics with booking stats",
            "endpoint": "/api/reports/export/customers",
            "format": "Excel (.xlsx)",
            "icon": "👥"
        })
    
    return {
        "success": True,
        "reports": reports,
        "user_role": user_roles[0] if user_roles else "unknown"
    }
