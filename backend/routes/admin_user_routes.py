from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from middleware import get_current_user, require_roles
from models import UserRole
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/users", tags=["Admin - User & Role Management"])

# ============== USER MANAGEMENT ==============

@router.get("/")
async def get_all_users(
    status: Optional[str] = None,
    role: Optional[str] = None,
    region: Optional[str] = None,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Get all users with filters
    सभी यूजर्स प्राप्त करें
    """
    db = get_database()
    
    query = {}
    if status == "active":
        query["is_active"] = True
    elif status == "disabled":
        query["is_active"] = False
    
    if role:
        query["roles"] = role
    
    if region:
        query["region"] = region
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    
    # Get creator info for each user
    for u in users:
        if u.get("created_by"):
            creator = await db.users.find_one({"id": u["created_by"]}, {"_id": 0, "full_name": 1})
            u["created_by_name"] = creator.get("full_name") if creator else "Unknown"
    
    return {"users": users, "total": len(users)}

@router.post("/create")
async def create_internal_user(
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """
    Create internal user (Regional Manager, HR, Finance, Marketing, Ops)
    आंतरिक यूजर बनाएं
    """
    db = get_database()
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate roles
    valid_roles = ["regional_manager", "hr", "finance", "marketing", "operations", "admin", "super_admin"]
    roles = data.get("roles", [])
    for role in roles:
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    
    # Only Super Admin can create Admin/Super Admin users
    if any(r in roles for r in ["admin", "super_admin"]):
        if "super_admin" not in user.get("roles", []):
            raise HTTPException(status_code=403, detail="Only Super Admin can create Admin users")
    
    # Hash password
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    user_id = str(uuid4())
    new_user = {
        "id": user_id,
        "email": data["email"],
        "password_hash": pwd_context.hash(data["password"]),
        "full_name": data["full_name"],
        "phone": data.get("phone", ""),
        "roles": roles,
        "region": data.get("region"),
        "regions_access": data.get("regions_access", []),  # Multiple regions access
        "department": data.get("department"),
        "designation": data.get("designation"),
        "is_active": True,
        "two_factor_enabled": False,
        "two_factor_secret": None,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(new_user.copy())
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "user_created",
        "entity_type": "user",
        "entity_id": user_id,
        "changes": {"email": data["email"], "roles": roles, "region": data.get("region")},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Remove sensitive data before returning
    del new_user["password_hash"]
    
    return {"message": "User created successfully", "user": new_user}

@router.put("/{user_id}")
async def update_user(
    user_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Update user details"""
    db = get_database()
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Protect Super Admin from being modified by Admin
    if "super_admin" in target_user.get("roles", []):
        if "super_admin" not in current_user.get("roles", []):
            raise HTTPException(status_code=403, detail="Cannot modify Super Admin")
    
    update_data = {}
    allowed_fields = ["full_name", "phone", "roles", "region", "regions_access", "department", "designation"]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user["id"]
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "action": "user_updated",
        "entity_type": "user",
        "entity_id": user_id,
        "changes": update_data,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "User updated successfully"}

@router.post("/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Enable/Disable user"""
    db = get_database()
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent disabling yourself or Super Admin
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
    
    if "super_admin" in target_user.get("roles", []):
        if "super_admin" not in current_user.get("roles", []):
            raise HTTPException(status_code=403, detail="Cannot disable Super Admin")
    
    new_status = data.get("is_active", not target_user.get("is_active", True))
    reason = data.get("reason", "")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_active": new_status,
            "disabled_reason": reason if not new_status else None,
            "disabled_by": current_user["id"] if not new_status else None,
            "disabled_at": datetime.now(timezone.utc).isoformat() if not new_status else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user["id"]
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "action": "user_enabled" if new_status else "user_disabled",
        "entity_type": "user",
        "entity_id": user_id,
        "changes": {"is_active": new_status, "reason": reason},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    status_text = "enabled" if new_status else "disabled"
    return {"message": f"User {status_text} successfully"}

@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Reset user password"""
    db = get_database()
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    new_password = data.get("new_password")
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password_hash": pwd_context.hash(new_password),
            "password_reset_by": current_user["id"],
            "password_reset_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "action": "password_reset",
        "entity_type": "user",
        "entity_id": user_id,
        "changes": {"reset_by": current_user["full_name"]},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Password reset successfully"}

@router.post("/{user_id}/2fa-control")
async def control_2fa(
    user_id: str,
    data: dict,
    current_user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Enable/Disable 2FA for user"""
    db = get_database()
    
    enable_2fa = data.get("enable", False)
    
    update_data = {
        "two_factor_enabled": enable_2fa,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if not enable_2fa:
        update_data["two_factor_secret"] = None
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    return {"message": f"2FA {'enabled' if enable_2fa else 'disabled'} for user"}

@router.get("/activity-log/{user_id}")
async def get_user_activity_log(
    user_id: str,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get activity log for a specific user"""
    db = get_database()
    
    # Get audit logs for this user
    logs = await db.audit_logs.find(
        {"$or": [
            {"user_id": user_id},  # Actions by user
            {"entity_id": user_id, "entity_type": "user"}  # Actions on user
        ]},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    return {"activity_logs": logs}

# ============== ROLE & PERMISSION MANAGEMENT ==============

@router.get("/roles")
async def get_all_roles(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get all roles with permissions"""
    db = get_database()
    
    # Get custom roles from database
    custom_roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    
    # Default system roles
    system_roles = [
        {
            "id": "customer",
            "name": "Customer",
            "name_hi": "ग्राहक",
            "is_system": True,
            "permissions": ["view_own_bookings", "create_booking", "view_quotes"]
        },
        {
            "id": "operator",
            "name": "Operator",
            "name_hi": "ऑपरेटर",
            "is_system": True,
            "permissions": ["manage_fleet", "manage_pilots", "respond_inquiries", "view_bookings"]
        },
        {
            "id": "regional_manager",
            "name": "Regional Manager",
            "name_hi": "क्षेत्रीय प्रबंधक",
            "is_system": True,
            "permissions": ["view_region_bookings", "approve_landing_permissions", "view_region_operators"]
        },
        {
            "id": "hr",
            "name": "HR",
            "name_hi": "एचआर",
            "is_system": True,
            "permissions": ["manage_users", "view_users"]
        },
        {
            "id": "finance",
            "name": "Finance",
            "name_hi": "वित्त",
            "is_system": True,
            "permissions": ["view_settlements", "approve_settlements", "view_reports", "export_reports"]
        },
        {
            "id": "marketing",
            "name": "Marketing",
            "name_hi": "मार्केटिंग",
            "is_system": True,
            "permissions": ["view_analytics", "manage_promotions"]
        },
        {
            "id": "operations",
            "name": "Operations",
            "name_hi": "ऑपरेशंस",
            "is_system": True,
            "permissions": ["manage_bookings", "view_all_bookings", "reassign_bookings"]
        },
        {
            "id": "admin",
            "name": "Admin",
            "name_hi": "एडमिन",
            "is_system": True,
            "permissions": ["all_except_super"]
        },
        {
            "id": "super_admin",
            "name": "Super Admin",
            "name_hi": "सुपर एडमिन",
            "is_system": True,
            "permissions": ["*"]  # All permissions
        }
    ]
    
    return {"system_roles": system_roles, "custom_roles": custom_roles}

@router.post("/roles")
async def create_custom_role(
    data: dict,
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Create custom role (Admin and Super Admin)"""
    db = get_database()
    
    role_id = data.get("id") or str(uuid4())[:8]
    
    # Check if role already exists
    existing = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Role ID already exists")
    
    role = {
        "id": role_id,
        "name": data["name"],
        "name_hi": data.get("name_hi", data["name"]),
        "description": data.get("description", ""),
        "permissions": data.get("permissions", []),
        "is_system": False,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.roles.insert_one(role.copy())
    
    return {"message": "Role created successfully", "role": role}

@router.put("/roles/{role_id}")
async def update_role(
    role_id: str,
    data: dict,
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
    """Update custom role permissions"""
    db = get_database()
    
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot modify system roles")
    
    update_data = {
        "name": data.get("name", role["name"]),
        "name_hi": data.get("name_hi", role.get("name_hi")),
        "description": data.get("description", role.get("description")),
        "permissions": data.get("permissions", role["permissions"]),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    
    return {"message": "Role updated successfully"}

@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    user: dict = Depends(require_roles([UserRole.SUPER_ADMIN]))
):
    """Delete custom role"""
    db = get_database()
    
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system roles")
    
    # Check if any users have this role
    users_with_role = await db.users.count_documents({"roles": role_id})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"{users_with_role} users have this role. Remove role from users first.")
    
    await db.roles.delete_one({"id": role_id})
    
    return {"message": "Role deleted successfully"}

@router.get("/permissions")
async def get_all_permissions(
    user: dict = Depends(require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get permission matrix"""
    
    permission_matrix = {
        "booking": {
            "label": "Booking Management",
            "label_hi": "बुकिंग प्रबंधन",
            "permissions": [
                {"id": "view_all_bookings", "label": "View All Bookings", "label_hi": "सभी बुकिंग देखें"},
                {"id": "view_own_bookings", "label": "View Own Bookings", "label_hi": "अपनी बुकिंग देखें"},
                {"id": "create_booking", "label": "Create Booking", "label_hi": "बुकिंग बनाएं"},
                {"id": "edit_booking", "label": "Edit Booking", "label_hi": "बुकिंग संपादित करें"},
                {"id": "cancel_booking", "label": "Cancel Booking", "label_hi": "बुकिंग रद्द करें"},
                {"id": "reassign_bookings", "label": "Reassign Bookings", "label_hi": "बुकिंग पुन: असाइन करें"},
                {"id": "force_assign", "label": "Force Assign Operator", "label_hi": "ऑपरेटर जबरन असाइन करें"},
                {"id": "emergency_override", "label": "Emergency Override", "label_hi": "आपातकालीन ओवरराइड"}
            ]
        },
        "operator": {
            "label": "Operator Management",
            "label_hi": "ऑपरेटर प्रबंधन",
            "permissions": [
                {"id": "view_operators", "label": "View Operators", "label_hi": "ऑपरेटर देखें"},
                {"id": "approve_operators", "label": "Approve Operators", "label_hi": "ऑपरेटर स्वीकृत करें"},
                {"id": "suspend_operators", "label": "Suspend Operators", "label_hi": "ऑपरेटर निलंबित करें"},
                {"id": "verify_documents", "label": "Verify Documents", "label_hi": "दस्तावेज़ सत्यापित करें"}
            ]
        },
        "user": {
            "label": "User Management",
            "label_hi": "यूजर प्रबंधन",
            "permissions": [
                {"id": "view_users", "label": "View Users", "label_hi": "यूजर देखें"},
                {"id": "create_users", "label": "Create Users", "label_hi": "यूजर बनाएं"},
                {"id": "edit_users", "label": "Edit Users", "label_hi": "यूजर संपादित करें"},
                {"id": "disable_users", "label": "Disable Users", "label_hi": "यूजर अक्षम करें"},
                {"id": "reset_passwords", "label": "Reset Passwords", "label_hi": "पासवर्ड रीसेट करें"}
            ]
        },
        "finance": {
            "label": "Finance",
            "label_hi": "वित्त",
            "permissions": [
                {"id": "view_settlements", "label": "View Settlements", "label_hi": "सेटलमेंट देखें"},
                {"id": "approve_settlements", "label": "Approve Settlements", "label_hi": "सेटलमेंट स्वीकृत करें"},
                {"id": "process_payouts", "label": "Process Payouts", "label_hi": "भुगतान प्रोसेस करें"},
                {"id": "view_reports", "label": "View Reports", "label_hi": "रिपोर्ट देखें"},
                {"id": "export_reports", "label": "Export Reports", "label_hi": "रिपोर्ट निर्यात करें"}
            ]
        },
        "approvals": {
            "label": "Approvals",
            "label_hi": "अनुमोदन",
            "permissions": [
                {"id": "approve_landing_permissions", "label": "Approve Landing Permissions", "label_hi": "लैंडिंग अनुमति स्वीकृत करें"},
                {"id": "approve_cancellations", "label": "Approve Cancellations", "label_hi": "रद्दीकरण स्वीकृत करें"},
                {"id": "final_approval", "label": "Final Approval Authority", "label_hi": "अंतिम अनुमोदन अधिकार"}
            ]
        },
        "settings": {
            "label": "Settings",
            "label_hi": "सेटिंग्स",
            "permissions": [
                {"id": "manage_settings", "label": "Manage Settings", "label_hi": "सेटिंग्स प्रबंधित करें"},
                {"id": "manage_api_keys", "label": "Manage API Keys", "label_hi": "API कुंजी प्रबंधित करें"},
                {"id": "manage_roles", "label": "Manage Roles", "label_hi": "भूमिकाएं प्रबंधित करें"}
            ]
        }
    }
    
    return {"permission_matrix": permission_matrix}
