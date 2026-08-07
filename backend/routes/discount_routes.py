"""
Discount Management Routes - AirYatra Aviation Platform
Bulk discount code upload via CSV with validation
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import uuid
import csv
import io

from database import get_database
from middleware import get_current_user, require_roles

router = APIRouter(prefix="/discounts", tags=["Discount Management"])


# ==================== MODELS ====================

class DiscountCode(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    discount_type: str = Field(..., pattern="^(percentage|flat)$")
    discount_value: float = Field(..., gt=0)
    min_booking_amount: float = 0
    max_discount_amount: Optional[float] = None
    valid_from: datetime
    valid_until: datetime
    usage_limit: int = 1  # 0 = unlimited
    per_user_limit: int = 1
    applicable_services: List[str] = ["all"]  # all, helicopter, charter, cargo
    applicable_tiers: List[str] = ["all"]  # all, silver, gold, platinum, diamond
    description: Optional[str] = None
    is_active: bool = True


class BulkUploadResponse(BaseModel):
    success: bool
    total_rows: int
    valid_rows: int
    invalid_rows: int
    created_count: int
    errors: List[dict]
    preview: List[dict]


class DiscountValidationError(BaseModel):
    row: int
    code: str
    field: str
    error: str


# ==================== ENDPOINTS ====================

@router.post("/bulk-upload/preview")
async def preview_bulk_upload(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """
    Preview CSV upload without saving - validates and shows what will be created
    
    CSV Format:
    code,discount_type,discount_value,min_booking_amount,max_discount_amount,valid_from,valid_until,usage_limit,per_user_limit,applicable_services,description
    
    Example:
    SUMMER20,percentage,20,10000,5000,2026-06-01,2026-08-31,100,1,helicopter|charter,Summer sale discount
    FLAT5K,flat,5000,25000,,2026-07-01,2026-12-31,50,2,all,Flat ₹5000 off
    """
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    
    try:
        content = await file.read()
        decoded = content.decode('utf-8-sig')  # Handle BOM
        reader = csv.DictReader(io.StringIO(decoded))
        
        preview_items = []
        errors = []
        row_num = 0
        
        for row in reader:
            row_num += 1
            
            try:
                # Validate required fields
                code = row.get('code', '').strip().upper()
                if not code:
                    errors.append({"row": row_num, "code": "", "field": "code", "error": "Code is required"})
                    continue
                
                if len(code) < 3 or len(code) > 20:
                    errors.append({"row": row_num, "code": code, "field": "code", "error": "Code must be 3-20 characters"})
                    continue
                
                discount_type = row.get('discount_type', '').strip().lower()
                if discount_type not in ['percentage', 'flat']:
                    errors.append({"row": row_num, "code": code, "field": "discount_type", "error": "Must be 'percentage' or 'flat'"})
                    continue
                
                try:
                    discount_value = float(row.get('discount_value', 0))
                    if discount_value <= 0:
                        raise ValueError("Must be positive")
                    if discount_type == 'percentage' and discount_value > 100:
                        raise ValueError("Percentage cannot exceed 100")
                except ValueError as e:
                    errors.append({"row": row_num, "code": code, "field": "discount_value", "error": str(e)})
                    continue
                
                # Parse dates
                try:
                    valid_from = datetime.strptime(row.get('valid_from', '').strip(), '%Y-%m-%d')
                except (ValueError, TypeError):
                    errors.append({"row": row_num, "code": code, "field": "valid_from", "error": "Invalid date format (use YYYY-MM-DD)"})
                    continue
                
                try:
                    valid_until = datetime.strptime(row.get('valid_until', '').strip(), '%Y-%m-%d')
                except (ValueError, TypeError):
                    errors.append({"row": row_num, "code": code, "field": "valid_until", "error": "Invalid date format (use YYYY-MM-DD)"})
                    continue
                
                if valid_until <= valid_from:
                    errors.append({"row": row_num, "code": code, "field": "valid_until", "error": "End date must be after start date"})
                    continue
                
                # Optional fields
                min_booking = float(row.get('min_booking_amount', 0) or 0)
                max_discount = row.get('max_discount_amount', '').strip()
                max_discount = float(max_discount) if max_discount else None
                usage_limit = int(row.get('usage_limit', 1) or 1)
                per_user_limit = int(row.get('per_user_limit', 1) or 1)
                
                # Parse services (pipe-separated)
                services_str = row.get('applicable_services', 'all').strip()
                services = [s.strip() for s in services_str.split('|')] if services_str else ['all']
                
                description = row.get('description', '').strip()
                
                # Create preview item
                preview_items.append({
                    "row": row_num,
                    "code": code,
                    "discount_type": discount_type,
                    "discount_value": discount_value,
                    "discount_display": f"{discount_value}%" if discount_type == 'percentage' else f"₹{discount_value:,.0f}",
                    "min_booking_amount": min_booking,
                    "max_discount_amount": max_discount,
                    "valid_from": valid_from.isoformat(),
                    "valid_until": valid_until.isoformat(),
                    "usage_limit": usage_limit,
                    "per_user_limit": per_user_limit,
                    "applicable_services": services,
                    "description": description,
                    "status": "valid"
                })
                
            except Exception as e:
                errors.append({"row": row_num, "code": row.get('code', ''), "field": "general", "error": str(e)})
        
        return {
            "success": True,
            "filename": file.filename,
            "total_rows": row_num,
            "valid_rows": len(preview_items),
            "invalid_rows": len(errors),
            "preview": preview_items[:50],  # Show max 50 in preview
            "errors": errors,
            "can_proceed": len(errors) == 0 or len(preview_items) > 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")


@router.post("/bulk-upload/confirm")
async def confirm_bulk_upload(
    file: UploadFile = File(...),
    skip_invalid: bool = Query(True, description="Skip invalid rows and import valid ones"),
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Actually create discount codes from CSV after preview"""
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
    
    db = get_database()
    
    try:
        content = await file.read()
        decoded = content.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded))
        
        created_codes = []
        errors = []
        row_num = 0
        
        for row in reader:
            row_num += 1
            
            try:
                code = row.get('code', '').strip().upper()
                if not code or len(code) < 3:
                    if not skip_invalid:
                        raise ValueError("Invalid code")
                    errors.append({"row": row_num, "code": code, "error": "Invalid code"})
                    continue
                
                # Check if code already exists
                existing = await db.discount_codes.find_one({"code": code})
                if existing:
                    if not skip_invalid:
                        raise ValueError(f"Code {code} already exists")
                    errors.append({"row": row_num, "code": code, "error": "Code already exists"})
                    continue
                
                discount_type = row.get('discount_type', '').strip().lower()
                if discount_type not in ['percentage', 'flat']:
                    errors.append({"row": row_num, "code": code, "error": "Invalid discount type"})
                    continue
                
                discount_value = float(row.get('discount_value', 0))
                valid_from = datetime.strptime(row.get('valid_from', '').strip(), '%Y-%m-%d')
                valid_until = datetime.strptime(row.get('valid_until', '').strip(), '%Y-%m-%d')
                
                if valid_until <= valid_from:
                    errors.append({"row": row_num, "code": code, "error": "Invalid date range"})
                    continue
                
                # Create discount document
                discount_doc = {
                    "discount_id": f"DISC-{uuid.uuid4().hex[:8].upper()}",
                    "code": code,
                    "discount_type": discount_type,
                    "discount_value": discount_value,
                    "min_booking_amount": float(row.get('min_booking_amount', 0) or 0),
                    "max_discount_amount": float(row.get('max_discount_amount')) if row.get('max_discount_amount') else None,
                    "valid_from": valid_from,
                    "valid_until": valid_until,
                    "usage_limit": int(row.get('usage_limit', 1) or 1),
                    "per_user_limit": int(row.get('per_user_limit', 1) or 1),
                    "applicable_services": [s.strip() for s in row.get('applicable_services', 'all').split('|')],
                    "applicable_tiers": ["all"],
                    "description": row.get('description', '').strip(),
                    "is_active": True,
                    "times_used": 0,
                    "created_by": current_user.get("id"),
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                await db.discount_codes.insert_one(discount_doc)
                created_codes.append({
                    "code": code,
                    "discount_id": discount_doc["discount_id"],
                    "discount_display": f"{discount_value}%" if discount_type == 'percentage' else f"₹{discount_value:,.0f}"
                })
                
            except Exception as e:
                errors.append({"row": row_num, "code": row.get('code', ''), "error": str(e)})
        
        return {
            "success": True,
            "total_rows": row_num,
            "created_count": len(created_codes),
            "error_count": len(errors),
            "created_codes": created_codes,
            "errors": errors[:20]  # Show max 20 errors
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")


@router.get("/list")
async def list_discount_codes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="active, expired, all"),
    search: Optional[str] = None,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """List all discount codes with pagination"""
    
    db = get_database()
    
    query = {}
    now = datetime.now(timezone.utc)
    
    if status == "active":
        query["is_active"] = True
        query["valid_until"] = {"$gte": now}
    elif status == "expired":
        query["$or"] = [
            {"is_active": False},
            {"valid_until": {"$lt": now}}
        ]
    
    if search:
        query["$or"] = [
            {"code": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    total = await db.discount_codes.count_documents(query)
    
    codes = await db.discount_codes.find(query)\
        .sort("created_at", -1)\
        .skip((page - 1) * limit)\
        .limit(limit)\
        .to_list(limit)
    
    # Serialize
    for code in codes:
        code["_id"] = str(code["_id"])
        # Handle valid_until - could be datetime or string
        valid_until = code.get("valid_until")
        if valid_until:
            if isinstance(valid_until, str):
                try:
                    valid_until = datetime.fromisoformat(valid_until.replace('Z', '+00:00'))
                except (ValueError, TypeError):
                    valid_until = now  # Fallback
            code["is_expired"] = valid_until < now
        else:
            code["is_expired"] = False
        code["discount_display"] = f"{code['discount_value']}%" if code['discount_type'] == 'percentage' else f"₹{code['discount_value']:,.0f}"
        # Convert datetime fields to ISO strings for JSON
        for field in ["valid_from", "valid_until", "created_at", "updated_at"]:
            if field in code and isinstance(code[field], datetime):
                code[field] = code[field].isoformat()
    
    return {
        "success": True,
        "discounts": codes,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.post("/create")
async def create_discount_code(
    discount: DiscountCode,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Create a single discount code"""
    
    db = get_database()
    
    # Check if code exists
    existing = await db.discount_codes.find_one({"code": discount.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists")
    
    discount_doc = {
        "discount_id": f"DISC-{uuid.uuid4().hex[:8].upper()}",
        "code": discount.code.upper(),
        "discount_type": discount.discount_type,
        "discount_value": discount.discount_value,
        "min_booking_amount": discount.min_booking_amount,
        "max_discount_amount": discount.max_discount_amount,
        "valid_from": discount.valid_from,
        "valid_until": discount.valid_until,
        "usage_limit": discount.usage_limit,
        "per_user_limit": discount.per_user_limit,
        "applicable_services": discount.applicable_services,
        "applicable_tiers": discount.applicable_tiers,
        "description": discount.description,
        "is_active": discount.is_active,
        "times_used": 0,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.discount_codes.insert_one(discount_doc)
    discount_doc["_id"] = str(discount_doc["_id"])
    
    return {
        "success": True,
        "discount": discount_doc,
        "message": f"Discount code {discount.code.upper()} created successfully"
    }


@router.patch("/{discount_id}")
async def update_discount_code(
    discount_id: str,
    updates: dict,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Update a discount code"""
    
    db = get_database()
    
    discount = await db.discount_codes.find_one({"discount_id": discount_id})
    if not discount:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    # Allowed update fields
    allowed_fields = ["description", "is_active", "usage_limit", "per_user_limit", 
                      "valid_until", "max_discount_amount", "applicable_services"]
    
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.discount_codes.update_one(
        {"discount_id": discount_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Discount code updated"}


@router.delete("/{discount_id}")
async def delete_discount_code(
    discount_id: str,
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Delete (deactivate) a discount code"""
    
    db = get_database()
    
    result = await db.discount_codes.update_one(
        {"discount_id": discount_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    return {"success": True, "message": "Discount code deactivated"}


@router.get("/validate/{code}")
async def validate_discount_code(
    code: str,
    booking_amount: float = Query(..., gt=0),
    service_type: str = Query("helicopter"),
    user_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Validate a discount code for a booking"""
    
    db = get_database()
    now = datetime.now(timezone.utc)
    
    discount = await db.discount_codes.find_one({
        "code": code.upper(),
        "is_active": True,
        "valid_from": {"$lte": now},
        "valid_until": {"$gte": now}
    })
    
    if not discount:
        return {
            "valid": False,
            "error": "Invalid or expired discount code"
        }
    
    # Check usage limit
    if discount.get("usage_limit", 0) > 0 and discount.get("times_used", 0) >= discount["usage_limit"]:
        return {
            "valid": False,
            "error": "Discount code usage limit reached"
        }
    
    # Check minimum booking amount
    if booking_amount < discount.get("min_booking_amount", 0):
        return {
            "valid": False,
            "error": f"Minimum booking amount is ₹{discount['min_booking_amount']:,.0f}"
        }
    
    # Check service type
    services = discount.get("applicable_services", ["all"])
    if "all" not in services and service_type not in services:
        return {
            "valid": False,
            "error": f"Discount not applicable for {service_type}"
        }
    
    # Check per-user limit
    if user_id and discount.get("per_user_limit", 0) > 0:
        user_usage = await db.discount_usage.count_documents({
            "discount_id": discount["discount_id"],
            "user_id": user_id
        })
        if user_usage >= discount["per_user_limit"]:
            return {
                "valid": False,
                "error": "You have already used this discount code"
            }
    
    # Calculate discount
    if discount["discount_type"] == "percentage":
        discount_amount = booking_amount * (discount["discount_value"] / 100)
    else:
        discount_amount = discount["discount_value"]
    
    # Apply max discount cap
    if discount.get("max_discount_amount"):
        discount_amount = min(discount_amount, discount["max_discount_amount"])
    
    return {
        "valid": True,
        "code": discount["code"],
        "discount_type": discount["discount_type"],
        "discount_value": discount["discount_value"],
        "discount_amount": round(discount_amount, 2),
        "final_amount": round(booking_amount - discount_amount, 2),
        "description": discount.get("description", "")
    }


@router.get("/stats")
async def get_discount_stats(
    current_user: dict = Depends(require_roles(["admin", "super_admin"]))
):
    """Get discount code statistics"""
    
    db = get_database()
    now = datetime.now(timezone.utc)
    
    total = await db.discount_codes.count_documents({})
    active = await db.discount_codes.count_documents({
        "is_active": True,
        "valid_until": {"$gte": now}
    })
    expired = await db.discount_codes.count_documents({
        "$or": [
            {"is_active": False},
            {"valid_until": {"$lt": now}}
        ]
    })
    
    # Top used codes
    pipeline = [
        {"$sort": {"times_used": -1}},
        {"$limit": 5},
        {"$project": {"_id": 0, "code": 1, "times_used": 1, "discount_value": 1, "discount_type": 1}}
    ]
    top_codes = await db.discount_codes.aggregate(pipeline).to_list(5)
    
    return {
        "total_codes": total,
        "active_codes": active,
        "expired_codes": expired,
        "top_used_codes": top_codes
    }


@router.get("/download-template")
async def download_csv_template():
    """Download CSV template for bulk upload"""
    
    template = """code,discount_type,discount_value,min_booking_amount,max_discount_amount,valid_from,valid_until,usage_limit,per_user_limit,applicable_services,description
SUMMER20,percentage,20,10000,5000,2026-06-01,2026-08-31,100,1,helicopter|charter,Summer sale - 20% off
FLAT5K,flat,5000,25000,,2026-07-01,2026-12-31,50,2,all,Flat ₹5000 off on bookings above ₹25000
NEWUSER10,percentage,10,0,2000,2026-01-01,2026-12-31,0,1,all,New user discount - 10% off first booking
CORP25,percentage,25,50000,15000,2026-01-01,2026-12-31,500,5,helicopter|charter,Corporate discount"""
    
    return {
        "template": template,
        "instructions": """
CSV Upload Instructions:
- code: Unique discount code (3-20 characters, will be uppercased)
- discount_type: 'percentage' or 'flat'
- discount_value: Number (percentage 1-100, or flat amount in INR)
- min_booking_amount: Minimum booking amount required (optional, default 0)
- max_discount_amount: Maximum discount cap (optional for percentage discounts)
- valid_from: Start date (YYYY-MM-DD)
- valid_until: End date (YYYY-MM-DD)
- usage_limit: Total uses allowed (0 = unlimited)
- per_user_limit: Uses per user (1 = one-time use)
- applicable_services: Pipe-separated services (all|helicopter|charter|cargo)
- description: Human-readable description
        """
    }
