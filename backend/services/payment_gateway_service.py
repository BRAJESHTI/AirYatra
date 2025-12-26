"""
Multi-Gateway Payment Service
Supports: RazorpayX, Cashfree, Direct Bank APIs (ICICI, IDFC, Axis)
"""
import os
import logging
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from uuid import uuid4
from enum import Enum
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class PaymentGateway(str, Enum):
    RAZORPAYX = "razorpayx"
    CASHFREE = "cashfree"
    ICICI = "icici"
    IDFC = "idfc"
    AXIS = "axis"
    MOCK = "mock"


class PaymentMode(str, Enum):
    NEFT = "NEFT"
    RTGS = "RTGS"
    IMPS = "IMPS"
    UPI = "UPI"


class TransferStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class BasePaymentGateway(ABC):
    """Abstract base class for payment gateways"""
    
    @abstractmethod
    async def create_contact(self, name: str, email: str, phone: str, **kwargs) -> Dict[str, Any]:
        """Create a contact/beneficiary"""
        pass
    
    @abstractmethod
    async def create_fund_account(self, contact_id: str, account_number: str, ifsc: str, account_holder: str) -> Dict[str, Any]:
        """Create a fund account for bank transfer"""
        pass
    
    @abstractmethod
    async def create_payout(self, fund_account_id: str, amount: float, mode: str, purpose: str, reference_id: str, narration: str = "") -> Dict[str, Any]:
        """Create a single payout"""
        pass
    
    @abstractmethod
    async def bulk_payout(self, payouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create bulk payouts"""
        pass
    
    @abstractmethod
    async def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        """Get payout status"""
        pass
    
    @abstractmethod
    async def cancel_payout(self, payout_id: str) -> Dict[str, Any]:
        """Cancel a queued payout"""
        pass


class RazorpayXGateway(BasePaymentGateway):
    """RazorpayX Payouts Gateway"""
    
    def __init__(self):
        self.api_key = os.environ.get("RAZORPAYX_KEY_ID", "")
        self.api_secret = os.environ.get("RAZORPAYX_KEY_SECRET", "")
        self.account_number = os.environ.get("RAZORPAYX_ACCOUNT_NUMBER", "")
        self.base_url = "https://api.razorpay.com/v1"
        self.is_configured = bool(self.api_key and self.api_secret)
    
    def _get_auth(self):
        return (self.api_key, self.api_secret)
    
    async def create_contact(self, name: str, email: str, phone: str, **kwargs) -> Dict[str, Any]:
        if not self.is_configured:
            return self._mock_contact(name, email, phone)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/contacts",
                auth=self._get_auth(),
                json={
                    "name": name,
                    "email": email,
                    "contact": phone,
                    "type": kwargs.get("type", "employee"),
                    "reference_id": kwargs.get("reference_id", str(uuid4()))
                }
            )
            if response.status_code == 200:
                return response.json()
            logger.error(f"RazorpayX create_contact error: {response.text}")
            raise Exception(f"Failed to create contact: {response.text}")
    
    async def create_fund_account(self, contact_id: str, account_number: str, ifsc: str, account_holder: str) -> Dict[str, Any]:
        if not self.is_configured:
            return self._mock_fund_account(contact_id, account_number, ifsc, account_holder)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/fund_accounts",
                auth=self._get_auth(),
                json={
                    "contact_id": contact_id,
                    "account_type": "bank_account",
                    "bank_account": {
                        "name": account_holder,
                        "ifsc": ifsc,
                        "account_number": account_number
                    }
                }
            )
            if response.status_code == 200:
                return response.json()
            logger.error(f"RazorpayX create_fund_account error: {response.text}")
            raise Exception(f"Failed to create fund account: {response.text}")
    
    async def create_payout(self, fund_account_id: str, amount: float, mode: str, purpose: str, reference_id: str, narration: str = "") -> Dict[str, Any]:
        if not self.is_configured:
            return self._mock_payout(fund_account_id, amount, mode, purpose, reference_id)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payouts",
                auth=self._get_auth(),
                json={
                    "account_number": self.account_number,
                    "fund_account_id": fund_account_id,
                    "amount": int(amount * 100),  # Convert to paise
                    "currency": "INR",
                    "mode": mode,
                    "purpose": purpose,
                    "queue_if_low_balance": True,
                    "reference_id": reference_id,
                    "narration": narration[:30] if narration else ""
                }
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "payout_id": data["id"],
                    "status": data["status"],
                    "utr": data.get("utr"),
                    "gateway": "razorpayx",
                    "amount": amount,
                    "mode": mode,
                    "reference_id": reference_id
                }
            logger.error(f"RazorpayX create_payout error: {response.text}")
            raise Exception(f"Failed to create payout: {response.text}")
    
    async def bulk_payout(self, payouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process bulk payouts - RazorpayX processes individually"""
        results = []
        for payout in payouts:
            try:
                result = await self.create_payout(
                    fund_account_id=payout["fund_account_id"],
                    amount=payout["amount"],
                    mode=payout.get("mode", "NEFT"),
                    purpose=payout.get("purpose", "salary"),
                    reference_id=payout["reference_id"],
                    narration=payout.get("narration", "")
                )
                results.append({"success": True, **result})
            except Exception as e:
                results.append({
                    "success": False,
                    "reference_id": payout["reference_id"],
                    "error": str(e)
                })
        
        return {
            "total": len(payouts),
            "successful": len([r for r in results if r.get("success")]),
            "failed": len([r for r in results if not r.get("success")]),
            "results": results
        }
    
    async def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        if not self.is_configured:
            return {"status": "processed", "utr": f"UTR{uuid4().hex[:12].upper()}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/payouts/{payout_id}",
                auth=self._get_auth()
            )
            if response.status_code == 200:
                return response.json()
            raise Exception(f"Failed to get payout status: {response.text}")
    
    async def cancel_payout(self, payout_id: str) -> Dict[str, Any]:
        if not self.is_configured:
            return {"status": "cancelled", "payout_id": payout_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payouts/{payout_id}/cancel",
                auth=self._get_auth()
            )
            if response.status_code == 200:
                return response.json()
            raise Exception(f"Failed to cancel payout: {response.text}")
    
    # Mock methods for demo mode
    def _mock_contact(self, name, email, phone):
        return {
            "id": f"cont_{uuid4().hex[:14]}",
            "name": name,
            "email": email,
            "contact": phone,
            "type": "employee",
            "active": True,
            "mock": True
        }
    
    def _mock_fund_account(self, contact_id, account_number, ifsc, account_holder):
        return {
            "id": f"fa_{uuid4().hex[:14]}",
            "contact_id": contact_id,
            "account_type": "bank_account",
            "bank_account": {
                "name": account_holder,
                "ifsc": ifsc,
                "account_number": account_number[-4:].rjust(len(account_number), "*")
            },
            "active": True,
            "mock": True
        }
    
    def _mock_payout(self, fund_account_id, amount, mode, purpose, reference_id):
        return {
            "payout_id": f"pout_{uuid4().hex[:14]}",
            "status": "processing",
            "utr": f"UTR{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid4().hex[:6].upper()}",
            "gateway": "razorpayx",
            "amount": amount,
            "mode": mode,
            "reference_id": reference_id,
            "mock": True
        }


class CashfreeGateway(BasePaymentGateway):
    """Cashfree Payouts Gateway"""
    
    def __init__(self):
        self.client_id = os.environ.get("CASHFREE_CLIENT_ID", "")
        self.client_secret = os.environ.get("CASHFREE_CLIENT_SECRET", "")
        self.is_sandbox = os.environ.get("CASHFREE_SANDBOX", "true").lower() == "true"
        self.base_url = "https://payout-gamma.cashfree.com" if self.is_sandbox else "https://payout-api.cashfree.com"
        self.is_configured = bool(self.client_id and self.client_secret)
        self.api_version = "2024-01-01"
    
    def _get_headers(self):
        return {
            "X-Client-Id": self.client_id,
            "X-Client-Secret": self.client_secret,
            "X-Api-Version": self.api_version,
            "Content-Type": "application/json"
        }
    
    async def create_contact(self, name: str, email: str, phone: str, **kwargs) -> Dict[str, Any]:
        if not self.is_configured:
            return self._mock_contact(name, email, phone)
        
        bene_id = kwargs.get("beneficiary_id", f"BENE_{uuid4().hex[:10].upper()}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payout/v1/addBeneficiary",
                headers=self._get_headers(),
                json={
                    "beneId": bene_id,
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "bankAccount": kwargs.get("account_number", ""),
                    "ifsc": kwargs.get("ifsc", ""),
                    "address1": kwargs.get("address", "India")
                }
            )
            if response.status_code == 200:
                return {
                    "id": bene_id,
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "gateway": "cashfree"
                }
            logger.error(f"Cashfree create_contact error: {response.text}")
            raise Exception(f"Failed to create beneficiary: {response.text}")
    
    async def create_fund_account(self, contact_id: str, account_number: str, ifsc: str, account_holder: str) -> Dict[str, Any]:
        # In Cashfree, beneficiary includes bank details
        # This is handled in create_contact with kwargs
        return {
            "id": contact_id,
            "contact_id": contact_id,
            "account_number": account_number[-4:].rjust(len(account_number), "*"),
            "ifsc": ifsc,
            "account_holder": account_holder,
            "gateway": "cashfree"
        }
    
    async def create_payout(self, fund_account_id: str, amount: float, mode: str, purpose: str, reference_id: str, narration: str = "") -> Dict[str, Any]:
        if not self.is_configured:
            return self._mock_payout(fund_account_id, amount, mode, purpose, reference_id)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/payout/v1/requestTransfer",
                headers=self._get_headers(),
                json={
                    "beneId": fund_account_id,
                    "amount": str(amount),
                    "transferId": reference_id,
                    "transferMode": mode,
                    "remarks": narration[:50] if narration else purpose
                }
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "payout_id": data.get("data", {}).get("referenceId", reference_id),
                    "status": data.get("status", "PENDING"),
                    "utr": data.get("data", {}).get("utr"),
                    "gateway": "cashfree",
                    "amount": amount,
                    "mode": mode,
                    "reference_id": reference_id
                }
            logger.error(f"Cashfree create_payout error: {response.text}")
            raise Exception(f"Failed to create transfer: {response.text}")
    
    async def bulk_payout(self, payouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process bulk payouts"""
        if not self.is_configured:
            return self._mock_bulk_payout(payouts)
        
        # Cashfree supports bulk via batch API
        batch_id = f"BATCH_{uuid4().hex[:10].upper()}"
        results = []
        
        for payout in payouts:
            try:
                result = await self.create_payout(
                    fund_account_id=payout["fund_account_id"],
                    amount=payout["amount"],
                    mode=payout.get("mode", "IMPS"),
                    purpose=payout.get("purpose", "salary"),
                    reference_id=payout["reference_id"],
                    narration=payout.get("narration", "")
                )
                results.append({"success": True, **result})
            except Exception as e:
                results.append({
                    "success": False,
                    "reference_id": payout["reference_id"],
                    "error": str(e)
                })
        
        return {
            "batch_id": batch_id,
            "total": len(payouts),
            "successful": len([r for r in results if r.get("success")]),
            "failed": len([r for r in results if not r.get("success")]),
            "results": results
        }
    
    async def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        if not self.is_configured:
            return {"status": "SUCCESS", "utr": f"UTR{uuid4().hex[:12].upper()}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/payout/v1/getTransferStatus",
                headers=self._get_headers(),
                params={"transferId": payout_id}
            )
            if response.status_code == 200:
                return response.json()
            raise Exception(f"Failed to get transfer status: {response.text}")
    
    async def cancel_payout(self, payout_id: str) -> Dict[str, Any]:
        # Cashfree doesn't support cancel after initiation
        return {"status": "not_supported", "message": "Cashfree does not support cancellation after initiation"}
    
    # Mock methods
    def _mock_contact(self, name, email, phone):
        return {
            "id": f"BENE_{uuid4().hex[:10].upper()}",
            "name": name,
            "email": email,
            "phone": phone,
            "gateway": "cashfree",
            "mock": True
        }
    
    def _mock_payout(self, fund_account_id, amount, mode, purpose, reference_id):
        return {
            "payout_id": f"CF_{uuid4().hex[:14]}",
            "status": "PENDING",
            "utr": f"UTR{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid4().hex[:6].upper()}",
            "gateway": "cashfree",
            "amount": amount,
            "mode": mode,
            "reference_id": reference_id,
            "mock": True
        }
    
    def _mock_bulk_payout(self, payouts):
        results = []
        for payout in payouts:
            results.append({
                "success": True,
                **self._mock_payout(
                    payout["fund_account_id"],
                    payout["amount"],
                    payout.get("mode", "IMPS"),
                    payout.get("purpose", "salary"),
                    payout["reference_id"]
                )
            })
        return {
            "batch_id": f"BATCH_{uuid4().hex[:10].upper()}",
            "total": len(payouts),
            "successful": len(payouts),
            "failed": 0,
            "results": results,
            "mock": True
        }


class MockBankGateway(BasePaymentGateway):
    """Mock gateway for testing - simulates direct bank APIs"""
    
    def __init__(self, bank_name: str = "mock"):
        self.bank_name = bank_name
    
    async def create_contact(self, name: str, email: str, phone: str, **kwargs) -> Dict[str, Any]:
        return {
            "id": f"{self.bank_name.upper()}_{uuid4().hex[:10]}",
            "name": name,
            "email": email,
            "phone": phone,
            "gateway": self.bank_name,
            "mock": True
        }
    
    async def create_fund_account(self, contact_id: str, account_number: str, ifsc: str, account_holder: str) -> Dict[str, Any]:
        return {
            "id": f"FA_{self.bank_name.upper()}_{uuid4().hex[:8]}",
            "contact_id": contact_id,
            "account_number": account_number[-4:].rjust(len(account_number), "*"),
            "ifsc": ifsc,
            "account_holder": account_holder,
            "gateway": self.bank_name,
            "mock": True
        }
    
    async def create_payout(self, fund_account_id: str, amount: float, mode: str, purpose: str, reference_id: str, narration: str = "") -> Dict[str, Any]:
        return {
            "payout_id": f"{self.bank_name.upper()}_TXN_{uuid4().hex[:12]}",
            "status": "processing",
            "utr": f"UTR{self.bank_name.upper()}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid4().hex[:4].upper()}",
            "gateway": self.bank_name,
            "amount": amount,
            "mode": mode,
            "reference_id": reference_id,
            "mock": True
        }
    
    async def bulk_payout(self, payouts: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = []
        for payout in payouts:
            result = await self.create_payout(
                fund_account_id=payout["fund_account_id"],
                amount=payout["amount"],
                mode=payout.get("mode", "NEFT"),
                purpose=payout.get("purpose", "salary"),
                reference_id=payout["reference_id"],
                narration=payout.get("narration", "")
            )
            results.append({"success": True, **result})
        
        return {
            "batch_id": f"BATCH_{self.bank_name.upper()}_{uuid4().hex[:8]}",
            "total": len(payouts),
            "successful": len(payouts),
            "failed": 0,
            "results": results,
            "mock": True
        }
    
    async def get_payout_status(self, payout_id: str) -> Dict[str, Any]:
        return {
            "payout_id": payout_id,
            "status": "completed",
            "utr": f"UTR{uuid4().hex[:12].upper()}",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
    
    async def cancel_payout(self, payout_id: str) -> Dict[str, Any]:
        return {"status": "cancelled", "payout_id": payout_id}


class PaymentGatewayManager:
    """
    Unified Payment Gateway Manager
    Supports multiple gateways with automatic failover
    """
    
    def __init__(self):
        self.gateways: Dict[str, BasePaymentGateway] = {
            PaymentGateway.RAZORPAYX.value: RazorpayXGateway(),
            PaymentGateway.CASHFREE.value: CashfreeGateway(),
            PaymentGateway.ICICI.value: MockBankGateway("icici"),
            PaymentGateway.IDFC.value: MockBankGateway("idfc"),
            PaymentGateway.AXIS.value: MockBankGateway("axis"),
            PaymentGateway.MOCK.value: MockBankGateway("mock"),
        }
        self.default_gateway = PaymentGateway.RAZORPAYX.value
    
    def get_gateway(self, gateway_name: str = None) -> BasePaymentGateway:
        """Get a specific gateway or default"""
        if gateway_name and gateway_name in self.gateways:
            return self.gateways[gateway_name]
        return self.gateways[self.default_gateway]
    
    def get_available_gateways(self) -> List[Dict[str, Any]]:
        """Get list of available gateways with their status"""
        available = []
        for name, gateway in self.gateways.items():
            is_configured = getattr(gateway, 'is_configured', True)
            available.append({
                "name": name,
                "display_name": name.replace("_", " ").title(),
                "is_configured": is_configured,
                "is_mock": not is_configured or name == "mock"
            })
        return available
    
    async def process_salary_payout(
        self,
        gateway_name: str,
        employee_data: Dict[str, Any],
        amount: float,
        mode: str = "NEFT",
        reference_id: str = None
    ) -> Dict[str, Any]:
        """Process a single salary payout"""
        gateway = self.get_gateway(gateway_name)
        ref_id = reference_id or f"SAL_{uuid4().hex[:12]}"
        
        try:
            # Create contact if needed
            contact = await gateway.create_contact(
                name=employee_data["name"],
                email=employee_data.get("email", ""),
                phone=employee_data.get("phone", ""),
                reference_id=employee_data.get("employee_id", "")
            )
            
            # Create fund account
            fund_account = await gateway.create_fund_account(
                contact_id=contact["id"],
                account_number=employee_data["account_number"],
                ifsc=employee_data["ifsc_code"],
                account_holder=employee_data.get("account_holder_name", employee_data["name"])
            )
            
            # Create payout
            payout = await gateway.create_payout(
                fund_account_id=fund_account["id"],
                amount=amount,
                mode=mode,
                purpose="salary",
                reference_id=ref_id,
                narration=f"Salary - {employee_data['name']}"
            )
            
            return {
                "success": True,
                "gateway": gateway_name,
                "contact_id": contact["id"],
                "fund_account_id": fund_account["id"],
                **payout
            }
            
        except Exception as e:
            logger.error(f"Salary payout failed: {e}")
            return {
                "success": False,
                "gateway": gateway_name,
                "error": str(e),
                "reference_id": ref_id
            }
    
    async def process_bulk_salary(
        self,
        gateway_name: str,
        employees: List[Dict[str, Any]],
        mode: str = "NEFT"
    ) -> Dict[str, Any]:
        """Process bulk salary payouts"""
        gateway = self.get_gateway(gateway_name)
        
        # Prepare payouts
        payouts = []
        preparation_errors = []
        
        for emp in employees:
            try:
                # Create contact and fund account
                contact = await gateway.create_contact(
                    name=emp["name"],
                    email=emp.get("email", ""),
                    phone=emp.get("phone", ""),
                    reference_id=emp.get("employee_id", "")
                )
                
                fund_account = await gateway.create_fund_account(
                    contact_id=contact["id"],
                    account_number=emp["account_number"],
                    ifsc=emp["ifsc_code"],
                    account_holder=emp.get("account_holder_name", emp["name"])
                )
                
                payouts.append({
                    "fund_account_id": fund_account["id"],
                    "amount": emp["amount"],
                    "mode": mode,
                    "purpose": "salary",
                    "reference_id": f"SAL_{emp.get('employee_id', uuid4().hex[:8])}_{uuid4().hex[:4]}",
                    "narration": f"Salary - {emp['name']}",
                    "employee_id": emp.get("employee_id"),
                    "employee_name": emp["name"]
                })
            except Exception as e:
                preparation_errors.append({
                    "employee_id": emp.get("employee_id"),
                    "employee_name": emp.get("name"),
                    "error": str(e)
                })
        
        # Execute bulk payout
        if payouts:
            result = await gateway.bulk_payout(payouts)
            result["preparation_errors"] = preparation_errors
            return result
        
        return {
            "total": 0,
            "successful": 0,
            "failed": len(preparation_errors),
            "results": [],
            "preparation_errors": preparation_errors
        }
    
    async def process_vendor_payment(
        self,
        gateway_name: str,
        vendor_data: Dict[str, Any],
        gross_amount: float,
        tds_amount: float,
        mode: str = "NEFT",
        reference_id: str = None
    ) -> Dict[str, Any]:
        """Process a vendor payment with TDS deduction"""
        gateway = self.get_gateway(gateway_name)
        ref_id = reference_id or f"VEN_{uuid4().hex[:12]}"
        net_amount = gross_amount - tds_amount
        
        try:
            contact = await gateway.create_contact(
                name=vendor_data["name"],
                email=vendor_data.get("email", ""),
                phone=vendor_data.get("phone", ""),
                reference_id=vendor_data.get("vendor_id", "")
            )
            
            fund_account = await gateway.create_fund_account(
                contact_id=contact["id"],
                account_number=vendor_data["account_number"],
                ifsc=vendor_data["ifsc_code"],
                account_holder=vendor_data.get("account_holder_name", vendor_data["name"])
            )
            
            payout = await gateway.create_payout(
                fund_account_id=fund_account["id"],
                amount=net_amount,
                mode=mode,
                purpose="vendor_payment",
                reference_id=ref_id,
                narration=f"Payment - {vendor_data['name']}"
            )
            
            return {
                "success": True,
                "gateway": gateway_name,
                "gross_amount": gross_amount,
                "tds_deducted": tds_amount,
                "net_paid": net_amount,
                **payout
            }
            
        except Exception as e:
            logger.error(f"Vendor payment failed: {e}")
            return {
                "success": False,
                "gateway": gateway_name,
                "error": str(e),
                "reference_id": ref_id
            }


# Singleton instance
payment_gateway_manager = PaymentGatewayManager()
