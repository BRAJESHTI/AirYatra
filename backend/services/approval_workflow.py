"""
Multi-Level Approval Workflow System
HR → Finance → Admin Approval Flow
Admin Override Capability
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from uuid import uuid4
from enum import Enum
from database import get_database
import logging

logger = logging.getLogger(__name__)


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    PENDING_HR = "pending_hr"
    PENDING_FINANCE = "pending_finance"
    PENDING_ADMIN = "pending_admin"
    APPROVED = "approved"
    REJECTED = "rejected"
    AUTO_APPROVED = "auto_approved"  # Admin override


class ApprovalType(str, Enum):
    SALARY_RUN = "salary_run"
    VENDOR_PAYMENT = "vendor_payment"
    EXPENSE_REIMBURSEMENT = "expense_reimbursement"
    BULK_TRANSFER = "bulk_transfer"


class ApprovalWorkflow:
    """
    Multi-level approval workflow manager
    
    Flow: HR → Finance → Admin → Execute
    Admin can override and approve directly
    """
    
    def __init__(self, db):
        self.db = db
    
    async def create_approval_request(
        self,
        request_type: ApprovalType,
        reference_id: str,
        amount: float,
        requestor_id: str,
        requestor_name: str,
        details: Dict[str, Any],
        requires_hr: bool = True,
        requires_finance: bool = True,
        requires_admin: bool = True
    ) -> Dict[str, Any]:
        """Create a new approval request"""
        
        approval_id = str(uuid4())
        
        # Determine initial status based on required approvals
        if requires_hr:
            initial_status = ApprovalStatus.PENDING_HR.value
        elif requires_finance:
            initial_status = ApprovalStatus.PENDING_FINANCE.value
        elif requires_admin:
            initial_status = ApprovalStatus.PENDING_ADMIN.value
        else:
            initial_status = ApprovalStatus.APPROVED.value
        
        approval_request = {
            "id": approval_id,
            "request_number": f"APR-{datetime.now().strftime('%Y%m%d')}-{approval_id[:6].upper()}",
            "type": request_type.value if isinstance(request_type, ApprovalType) else request_type,
            "reference_id": reference_id,
            "amount": amount,
            
            # Requestor
            "requestor_id": requestor_id,
            "requestor_name": requestor_name,
            
            # Status
            "status": initial_status,
            
            # Approval requirements
            "requires_hr": requires_hr,
            "requires_finance": requires_finance,
            "requires_admin": requires_admin,
            
            # Approval tracking
            "hr_approval": None,
            "finance_approval": None,
            "admin_approval": None,
            
            # Details
            "details": details,
            "notes": [],
            
            # Timestamps
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None
        }
        
        await self.db.approval_requests.insert_one(approval_request)
        
        # Create notification for first approver
        await self._notify_next_approver(approval_request)
        
        return {
            "approval_id": approval_id,
            "request_number": approval_request["request_number"],
            "status": initial_status,
            "next_approver": self._get_next_approver_role(initial_status)
        }
    
    async def approve_by_hr(
        self,
        approval_id: str,
        approver_id: str,
        approver_name: str,
        comments: str = ""
    ) -> Dict[str, Any]:
        """HR approval"""
        request = await self.db.approval_requests.find_one({"id": approval_id})
        if not request:
            raise Exception("Approval request not found")
        
        if request["status"] != ApprovalStatus.PENDING_HR.value:
            raise Exception(f"Request is not pending HR approval. Current status: {request['status']}")
        
        # Update HR approval
        hr_approval = {
            "approved": True,
            "approver_id": approver_id,
            "approver_name": approver_name,
            "comments": comments,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Determine next status
        if request["requires_finance"]:
            next_status = ApprovalStatus.PENDING_FINANCE.value
        elif request["requires_admin"]:
            next_status = ApprovalStatus.PENDING_ADMIN.value
        else:
            next_status = ApprovalStatus.APPROVED.value
        
        await self.db.approval_requests.update_one(
            {"id": approval_id},
            {"$set": {
                "hr_approval": hr_approval,
                "status": next_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat() if next_status == ApprovalStatus.APPROVED.value else None
            },
            "$push": {
                "notes": {
                    "action": "hr_approved",
                    "by": approver_name,
                    "comments": comments,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
        
        # Notify next approver
        request["status"] = next_status
        await self._notify_next_approver(request)
        
        return {
            "success": True,
            "status": next_status,
            "message": "HR approval completed",
            "next_approver": self._get_next_approver_role(next_status)
        }
    
    async def approve_by_finance(
        self,
        approval_id: str,
        approver_id: str,
        approver_name: str,
        comments: str = ""
    ) -> Dict[str, Any]:
        """Finance approval"""
        request = await self.db.approval_requests.find_one({"id": approval_id})
        if not request:
            raise Exception("Approval request not found")
        
        if request["status"] != ApprovalStatus.PENDING_FINANCE.value:
            raise Exception(f"Request is not pending Finance approval. Current status: {request['status']}")
        
        finance_approval = {
            "approved": True,
            "approver_id": approver_id,
            "approver_name": approver_name,
            "comments": comments,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Determine next status
        if request["requires_admin"]:
            next_status = ApprovalStatus.PENDING_ADMIN.value
        else:
            next_status = ApprovalStatus.APPROVED.value
        
        await self.db.approval_requests.update_one(
            {"id": approval_id},
            {"$set": {
                "finance_approval": finance_approval,
                "status": next_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat() if next_status == ApprovalStatus.APPROVED.value else None
            },
            "$push": {
                "notes": {
                    "action": "finance_approved",
                    "by": approver_name,
                    "comments": comments,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
        
        request["status"] = next_status
        await self._notify_next_approver(request)
        
        return {
            "success": True,
            "status": next_status,
            "message": "Finance approval completed",
            "next_approver": self._get_next_approver_role(next_status)
        }
    
    async def approve_by_admin(
        self,
        approval_id: str,
        approver_id: str,
        approver_name: str,
        comments: str = ""
    ) -> Dict[str, Any]:
        """Admin final approval"""
        request = await self.db.approval_requests.find_one({"id": approval_id})
        if not request:
            raise Exception("Approval request not found")
        
        if request["status"] != ApprovalStatus.PENDING_ADMIN.value:
            raise Exception(f"Request is not pending Admin approval. Current status: {request['status']}")
        
        admin_approval = {
            "approved": True,
            "approver_id": approver_id,
            "approver_name": approver_name,
            "comments": comments,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.approval_requests.update_one(
            {"id": approval_id},
            {"$set": {
                "admin_approval": admin_approval,
                "status": ApprovalStatus.APPROVED.value,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "notes": {
                    "action": "admin_approved",
                    "by": approver_name,
                    "comments": comments,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
        
        return {
            "success": True,
            "status": ApprovalStatus.APPROVED.value,
            "message": "Admin approval completed - Ready for execution"
        }
    
    async def admin_override_approve(
        self,
        approval_id: str,
        admin_id: str,
        admin_name: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        Admin override - Approve directly without HR/Finance approval
        """
        request = await self.db.approval_requests.find_one({"id": approval_id})
        if not request:
            raise Exception("Approval request not found")
        
        if request["status"] == ApprovalStatus.APPROVED.value:
            raise Exception("Request is already approved")
        
        if request["status"] == ApprovalStatus.REJECTED.value:
            raise Exception("Request has been rejected")
        
        override_approval = {
            "approved": True,
            "override": True,
            "approver_id": admin_id,
            "approver_name": admin_name,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.approval_requests.update_one(
            {"id": approval_id},
            {"$set": {
                "admin_approval": override_approval,
                "status": ApprovalStatus.AUTO_APPROVED.value,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "notes": {
                    "action": "admin_override",
                    "by": admin_name,
                    "reason": reason,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
        
        return {
            "success": True,
            "status": ApprovalStatus.AUTO_APPROVED.value,
            "message": "Admin override approved - Ready for immediate execution",
            "override": True
        }
    
    async def reject(
        self,
        approval_id: str,
        rejector_id: str,
        rejector_name: str,
        rejector_role: str,
        reason: str
    ) -> Dict[str, Any]:
        """Reject an approval request"""
        request = await self.db.approval_requests.find_one({"id": approval_id})
        if not request:
            raise Exception("Approval request not found")
        
        if request["status"] in [ApprovalStatus.APPROVED.value, ApprovalStatus.AUTO_APPROVED.value]:
            raise Exception("Cannot reject an approved request")
        
        rejection = {
            "rejected": True,
            "rejector_id": rejector_id,
            "rejector_name": rejector_name,
            "rejector_role": rejector_role,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.approval_requests.update_one(
            {"id": approval_id},
            {"$set": {
                "status": ApprovalStatus.REJECTED.value,
                "rejection": rejection,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "completed_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "notes": {
                    "action": "rejected",
                    "by": rejector_name,
                    "role": rejector_role,
                    "reason": reason,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }}
        )
        
        # Notify requestor
        await self.db.notifications.insert_one({
            "id": str(uuid4()),
            "user_id": request["requestor_id"],
            "type": "approval_rejected",
            "title": "Approval Request Rejected",
            "message": f"Your {request['type']} request ({request['request_number']}) was rejected by {rejector_name}. Reason: {reason}",
            "reference_id": approval_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "status": ApprovalStatus.REJECTED.value,
            "message": f"Request rejected by {rejector_role}"
        }
    
    async def get_pending_approvals(
        self,
        role: str,
        user_id: str = None
    ) -> List[Dict[str, Any]]:
        """Get pending approvals for a specific role"""
        
        status_map = {
            "hr": ApprovalStatus.PENDING_HR.value,
            "finance": ApprovalStatus.PENDING_FINANCE.value,
            "admin": ApprovalStatus.PENDING_ADMIN.value
        }
        
        if role.lower() in status_map:
            query = {"status": status_map[role.lower()]}
        elif role.lower() in ["admin", "super_admin"]:
            # Admin can see all pending
            query = {"status": {"$in": [
                ApprovalStatus.PENDING_HR.value,
                ApprovalStatus.PENDING_FINANCE.value,
                ApprovalStatus.PENDING_ADMIN.value
            ]}}
        else:
            query = {"requestor_id": user_id} if user_id else {}
        
        approvals = await self.db.approval_requests.find(
            query, {"_id": 0}
        ).sort("created_at", -1).to_list(500)
        
        return approvals
    
    async def get_approval_history(
        self,
        approval_type: str = None,
        status: str = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get approval history"""
        query = {}
        if approval_type:
            query["type"] = approval_type
        if status:
            query["status"] = status
        
        approvals = await self.db.approval_requests.find(
            query, {"_id": 0}
        ).sort("created_at", -1).to_list(limit)
        
        return approvals
    
    async def is_approved(self, approval_id: str) -> bool:
        """Check if a request is fully approved"""
        request = await self.db.approval_requests.find_one({"id": approval_id})
        if not request:
            return False
        return request["status"] in [ApprovalStatus.APPROVED.value, ApprovalStatus.AUTO_APPROVED.value]
    
    def _get_next_approver_role(self, status: str) -> Optional[str]:
        """Get the role of the next approver"""
        role_map = {
            ApprovalStatus.PENDING_HR.value: "HR",
            ApprovalStatus.PENDING_FINANCE.value: "Finance",
            ApprovalStatus.PENDING_ADMIN.value: "Admin"
        }
        return role_map.get(status)
    
    async def _notify_next_approver(self, request: Dict[str, Any]):
        """Send notification to the next approver"""
        next_role = self._get_next_approver_role(request["status"])
        if not next_role:
            return
        
        # Get users with the appropriate role
        role_query = {
            "HR": {"role": {"$in": ["hr", "super_admin"]}},
            "Finance": {"role": {"$in": ["finance", "super_admin"]}},
            "Admin": {"role": {"$in": ["admin", "super_admin"]}}
        }
        
        users = await self.db.users.find(
            role_query.get(next_role, {}),
            {"_id": 0, "id": 1}
        ).to_list(100)
        
        for user in users:
            await self.db.notifications.insert_one({
                "id": str(uuid4()),
                "user_id": user["id"],
                "type": "approval_pending",
                "title": f"Approval Required - {next_role}",
                "message": f"New {request['type']} request ({request['request_number']}) worth ₹{request['amount']:,.2f} requires your approval.",
                "reference_id": request["id"],
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })


# TDS Configuration Manager
class TDSConfigManager:
    """
    Configurable TDS Rates Manager
    Supports both fixed and configurable rates
    """
    
    # Default TDS Rates as per Indian IT Act
    DEFAULT_RATES = {
        "194C": {
            "name": "Contractor Payments",
            "individual": 1.0,
            "company": 2.0,
            "threshold": 30000,
            "annual_threshold": 100000
        },
        "194J": {
            "name": "Professional/Technical Services",
            "individual": 10.0,
            "company": 10.0,
            "threshold": 30000,
            "annual_threshold": 0
        },
        "194H": {
            "name": "Commission/Brokerage",
            "individual": 5.0,
            "company": 5.0,
            "threshold": 15000,
            "annual_threshold": 0
        },
        "194I": {
            "name": "Rent",
            "individual": 10.0,
            "company": 10.0,
            "threshold": 240000,
            "annual_threshold": 0
        },
        "194A": {
            "name": "Interest (Other than securities)",
            "individual": 10.0,
            "company": 10.0,
            "threshold": 40000,
            "annual_threshold": 0
        },
        "194IB": {
            "name": "Rent by Individual/HUF",
            "individual": 5.0,
            "company": 5.0,
            "threshold": 50000,
            "annual_threshold": 0
        },
        "194Q": {
            "name": "Purchase of Goods",
            "individual": 0.1,
            "company": 0.1,
            "threshold": 5000000,
            "annual_threshold": 0
        }
    }
    
    def __init__(self, db):
        self.db = db
    
    async def get_tds_config(self) -> Dict[str, Any]:
        """Get current TDS configuration"""
        config = await self.db.tds_config.find_one({"id": "tds_rates"}, {"_id": 0})
        if not config:
            # Return default config
            return {
                "id": "tds_rates",
                "rates": self.DEFAULT_RATES,
                "custom_rates": {},
                "surcharge_threshold": 10000000,  # 1 Crore
                "surcharge_rate": 10.0,
                "cess_rate": 4.0,
                "updated_at": None
            }
        return config
    
    async def update_tds_config(
        self,
        rates: Dict[str, Any] = None,
        custom_rates: Dict[str, Any] = None,
        updater_id: str = None
    ) -> Dict[str, Any]:
        """Update TDS configuration"""
        current_config = await self.get_tds_config()
        
        if rates:
            current_config["rates"].update(rates)
        if custom_rates:
            current_config["custom_rates"].update(custom_rates)
        
        current_config["updated_at"] = datetime.now(timezone.utc).isoformat()
        current_config["updated_by"] = updater_id
        
        await self.db.tds_config.update_one(
            {"id": "tds_rates"},
            {"$set": current_config},
            upsert=True
        )
        
        return current_config
    
    async def add_custom_rate(
        self,
        vendor_id: str,
        vendor_name: str,
        tds_section: str,
        custom_rate: float,
        reason: str,
        updater_id: str
    ) -> Dict[str, Any]:
        """Add custom TDS rate for a specific vendor"""
        config = await self.get_tds_config()
        
        config["custom_rates"][vendor_id] = {
            "vendor_name": vendor_name,
            "tds_section": tds_section,
            "rate": custom_rate,
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": updater_id
        }
        
        await self.db.tds_config.update_one(
            {"id": "tds_rates"},
            {"$set": {"custom_rates": config["custom_rates"], "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        
        return config["custom_rates"][vendor_id]
    
    async def calculate_tds(
        self,
        vendor_id: str,
        vendor_type: str,  # individual/company
        tds_section: str,
        amount: float,
        has_pan: bool = True
    ) -> Dict[str, Any]:
        """Calculate TDS amount"""
        config = await self.get_tds_config()
        
        # Check for custom rate first
        if vendor_id in config.get("custom_rates", {}):
            custom = config["custom_rates"][vendor_id]
            rate = custom["rate"]
            return {
                "tds_section": custom["tds_section"],
                "rate": rate,
                "tds_amount": round(amount * (rate / 100), 2),
                "net_payable": round(amount - (amount * (rate / 100)), 2),
                "is_custom_rate": True,
                "custom_reason": custom.get("reason")
            }
        
        # Use standard rates
        section_config = config["rates"].get(tds_section)
        if not section_config:
            return {
                "tds_section": tds_section,
                "rate": 0,
                "tds_amount": 0,
                "net_payable": amount,
                "is_custom_rate": False,
                "error": "Unknown TDS section"
            }
        
        # Check threshold
        threshold = section_config.get("threshold", 0)
        if amount < threshold:
            return {
                "tds_section": tds_section,
                "rate": 0,
                "tds_amount": 0,
                "net_payable": amount,
                "is_custom_rate": False,
                "below_threshold": True,
                "threshold": threshold
            }
        
        # Get rate based on vendor type
        rate = section_config.get(vendor_type, section_config.get("individual", 0))
        
        # If no PAN, apply higher rate (20% or rate, whichever is higher)
        if not has_pan:
            rate = max(rate, 20.0)
        
        tds_amount = round(amount * (rate / 100), 2)
        
        # Add surcharge for high value
        surcharge = 0
        if amount > config.get("surcharge_threshold", 10000000):
            surcharge = round(tds_amount * (config.get("surcharge_rate", 10) / 100), 2)
        
        # Add cess
        cess = round((tds_amount + surcharge) * (config.get("cess_rate", 4) / 100), 2)
        
        total_tds = tds_amount + surcharge + cess
        
        return {
            "tds_section": tds_section,
            "section_name": section_config.get("name"),
            "rate": rate,
            "base_tds": tds_amount,
            "surcharge": surcharge,
            "cess": cess,
            "tds_amount": round(total_tds, 2),
            "net_payable": round(amount - total_tds, 2),
            "is_custom_rate": False,
            "no_pan_higher_rate": not has_pan
        }
    
    async def get_tds_sections(self) -> List[Dict[str, Any]]:
        """Get all TDS sections with rates"""
        config = await self.get_tds_config()
        sections = []
        
        for code, details in config["rates"].items():
            sections.append({
                "code": code,
                "name": details.get("name", code),
                "individual_rate": details.get("individual", 0),
                "company_rate": details.get("company", 0),
                "threshold": details.get("threshold", 0),
                "annual_threshold": details.get("annual_threshold", 0)
            })
        
        return sections
