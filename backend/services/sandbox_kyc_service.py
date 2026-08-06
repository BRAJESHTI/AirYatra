"""
Sandbox.co.in KYC Verification Service
Real API integration for PAN, Aadhaar, GST, Bank verification
API Documentation: https://developer.sandbox.co.in
"""

import os
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import uuid
import hashlib
import base64

logger = logging.getLogger(__name__)

# Sandbox API Configuration
SANDBOX_BASE_URL = "https://api.sandbox.co.in"
SANDBOX_API_KEY = os.environ.get("SANDBOX_API_KEY", "key_live_07f61ca61046480a8702eb0c234b59db")
SANDBOX_API_SECRET = os.environ.get("SANDBOX_API_SECRET", "key_live_07f61ca61046480a8702eb0c234b59db")


class SandboxKYCService:
    """
    Sandbox.co.in KYC Verification Service
    Supports: PAN, Aadhaar, GST, Bank Account, DigiLocker
    """
    
    def __init__(self):
        self.base_url = SANDBOX_BASE_URL
        self.api_key = SANDBOX_API_KEY
        self.api_secret = SANDBOX_API_SECRET
        self.headers = {
            "Authorization": self.api_key,
            "x-api-key": self.api_key,
            "x-api-secret": self.api_secret,
            "x-api-version": "1.0",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def _generate_reference_id(self) -> str:
        """Generate unique reference ID for tracking"""
        return f"AY-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"
    
    async def verify_pan(self, pan_number: str, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Verify PAN card details
        Endpoint: POST /kyc/pan/verify
        """
        reference_id = self._generate_reference_id()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "@entity": "in.co.sandbox.kyc.pan.verify",
                    "pan": pan_number.upper(),
                    "consent": "y",
                    "reason": "KYC verification for AirYatra booking"
                }
                
                if name:
                    payload["name"] = name
                
                response = await client.post(
                    f"{self.base_url}/kyc/pan/verify",
                    json=payload,
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    pan_data = data.get("data", {})
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "status": "verified",
                        "verified_data": {
                            "pan": pan_data.get("pan"),
                            "name": pan_data.get("name"),
                            "pan_status": pan_data.get("pan_status", "VALID"),
                            "name_match": pan_data.get("name_match_score", 100) if name else None,
                            "type": pan_data.get("type", "Individual"),
                            "aadhaar_seeding_status": pan_data.get("aadhaar_seeding_status")
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "PAN verification failed"),
                        "error_code": data.get("code"),
                        "raw_response": data
                    }
                    
        except httpx.TimeoutException:
            logger.error(f"PAN verification timeout for {pan_number[:4]}****")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "timeout",
                "error": "Verification service timeout. Please try again."
            }
        except Exception as e:
            logger.error(f"PAN verification error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }
    
    async def verify_aadhaar_generate_otp(self, aadhaar_number: str) -> Dict[str, Any]:
        """
        Step 1: Generate OTP for Aadhaar verification
        Endpoint: POST /kyc/aadhaar/okyc/otp
        """
        reference_id = self._generate_reference_id()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
                    "aadhaar_number": aadhaar_number,
                    "consent": "y",
                    "reason": "KYC verification for AirYatra"
                }
                
                response = await client.post(
                    f"{self.base_url}/kyc/aadhaar/okyc/otp",
                    json=payload,
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    return {
                        "success": True,
                        "reference_id": data.get("data", {}).get("ref_id", reference_id),
                        "status": "otp_sent",
                        "message": "OTP sent to registered mobile",
                        "message_hi": "OTP आपके रजिस्टर्ड मोबाइल पर भेजा गया"
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "Failed to send OTP"),
                        "raw_response": data
                    }
                    
        except Exception as e:
            logger.error(f"Aadhaar OTP generation error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }
    
    async def verify_aadhaar_submit_otp(self, reference_id: str, otp: str) -> Dict[str, Any]:
        """
        Step 2: Submit OTP to verify Aadhaar
        Endpoint: POST /kyc/aadhaar/okyc/verify
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "@entity": "in.co.sandbox.kyc.aadhaar.okyc.verify",
                    "ref_id": reference_id,
                    "otp": otp
                }
                
                response = await client.post(
                    f"{self.base_url}/kyc/aadhaar/okyc/verify",
                    json=payload,
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    aadhaar_data = data.get("data", {})
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "status": "verified",
                        "verified_data": {
                            "name": aadhaar_data.get("name"),
                            "gender": aadhaar_data.get("gender"),
                            "dob": aadhaar_data.get("dob"),
                            "address": aadhaar_data.get("address"),
                            "photo": aadhaar_data.get("photo"),  # Base64 encoded
                            "aadhaar_last_4": aadhaar_data.get("aadhaar_number", "")[-4:] if aadhaar_data.get("aadhaar_number") else None
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "Aadhaar verification failed"),
                        "raw_response": data
                    }
                    
        except Exception as e:
            logger.error(f"Aadhaar OTP verification error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }
    
    async def verify_gst(self, gstin: str) -> Dict[str, Any]:
        """
        Verify GSTIN details
        Endpoint: POST /gsp/public/gstin
        """
        reference_id = self._generate_reference_id()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Public GSTIN verification endpoint
                response = await client.get(
                    f"{self.base_url}/gsp/public/gstin/{gstin}",
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    gst_data = data.get("data", {})
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "status": "verified",
                        "verified_data": {
                            "gstin": gst_data.get("gstin"),
                            "legal_name": gst_data.get("legal_name") or gst_data.get("lgnm"),
                            "trade_name": gst_data.get("trade_name") or gst_data.get("tradeNam"),
                            "registration_date": gst_data.get("registration_date") or gst_data.get("rgdt"),
                            "status": gst_data.get("status") or gst_data.get("sts"),
                            "taxpayer_type": gst_data.get("taxpayer_type") or gst_data.get("dty"),
                            "state": gst_data.get("state") or gst_data.get("stj"),
                            "address": gst_data.get("address") or gst_data.get("pradr", {}).get("addr"),
                            "is_active": (gst_data.get("status") or gst_data.get("sts", "")).upper() == "ACTIVE"
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "GST verification failed"),
                        "raw_response": data
                    }
                    
        except Exception as e:
            logger.error(f"GST verification error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }
    
    async def verify_bank_account(self, account_number: str, ifsc: str, name: Optional[str] = None) -> Dict[str, Any]:
        """
        Verify bank account via penny drop
        Endpoint: POST /bank/verification
        """
        reference_id = self._generate_reference_id()
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:  # Bank verification can take longer
                payload = {
                    "@entity": "in.co.sandbox.kyc.bank_account.verify",
                    "account_number": account_number,
                    "ifsc": ifsc.upper(),
                    "consent": "y",
                    "reason": "Bank verification for AirYatra"
                }
                
                if name:
                    payload["name"] = name
                
                response = await client.post(
                    f"{self.base_url}/bank/verification",
                    json=payload,
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    bank_data = data.get("data", {})
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "status": "verified",
                        "verified_data": {
                            "account_number": bank_data.get("account_number"),
                            "account_holder_name": bank_data.get("account_holder_name") or bank_data.get("name_at_bank"),
                            "bank_name": bank_data.get("bank_name"),
                            "ifsc": bank_data.get("ifsc"),
                            "branch": bank_data.get("branch"),
                            "name_match_score": bank_data.get("name_match_score") if name else None,
                            "utr": bank_data.get("utr"),
                            "verified": True
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "Bank verification failed"),
                        "raw_response": data
                    }
                    
        except Exception as e:
            logger.error(f"Bank verification error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }
    
    async def verify_ifsc(self, ifsc: str) -> Dict[str, Any]:
        """
        Verify IFSC code
        Endpoint: GET /bank/{ifsc}
        """
        reference_id = self._generate_reference_id()
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.base_url}/bank/{ifsc.upper()}",
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    ifsc_data = data.get("data", {})
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "status": "verified",
                        "verified_data": {
                            "ifsc": ifsc_data.get("ifsc"),
                            "bank_name": ifsc_data.get("bank"),
                            "branch": ifsc_data.get("branch"),
                            "address": ifsc_data.get("address"),
                            "city": ifsc_data.get("city"),
                            "state": ifsc_data.get("state"),
                            "micr": ifsc_data.get("micr")
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "IFSC verification failed")
                    }
                    
        except Exception as e:
            logger.error(f"IFSC verification error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }
    
    async def verify_driving_licence(self, dl_number: str, dob: str) -> Dict[str, Any]:
        """
        Verify Driving Licence
        Endpoint: POST /kyc/dl/verify
        """
        reference_id = self._generate_reference_id()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "@entity": "in.co.sandbox.kyc.dl.verify",
                    "dl_number": dl_number.upper(),
                    "dob": dob,  # Format: DD-MM-YYYY
                    "consent": "y",
                    "reason": "KYC verification for AirYatra"
                }
                
                response = await client.post(
                    f"{self.base_url}/kyc/dl/verify",
                    json=payload,
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    dl_data = data.get("data", {})
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "status": "verified",
                        "verified_data": {
                            "dl_number": dl_data.get("dl_number"),
                            "name": dl_data.get("name"),
                            "dob": dl_data.get("dob"),
                            "address": dl_data.get("address"),
                            "validity": dl_data.get("validity"),
                            "issue_date": dl_data.get("issue_date"),
                            "vehicle_classes": dl_data.get("vehicle_classes", []),
                            "photo": dl_data.get("photo")
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "DL verification failed")
                    }
                    
        except Exception as e:
            logger.error(f"DL verification error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }
    
    async def verify_cin(self, cin: str) -> Dict[str, Any]:
        """
        Verify Company Identification Number (CIN)
        Endpoint: POST /mca/company
        """
        reference_id = self._generate_reference_id()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/mca/company/{cin.upper()}",
                    headers=self.headers
                )
                
                data = response.json()
                
                if response.status_code == 200 and data.get("code") == 200:
                    company_data = data.get("data", {})
                    return {
                        "success": True,
                        "reference_id": reference_id,
                        "status": "verified",
                        "verified_data": {
                            "cin": company_data.get("cin"),
                            "company_name": company_data.get("company_name"),
                            "company_status": company_data.get("company_status"),
                            "company_type": company_data.get("company_type"),
                            "date_of_incorporation": company_data.get("date_of_incorporation"),
                            "registered_address": company_data.get("registered_address"),
                            "authorized_capital": company_data.get("authorized_capital"),
                            "paid_up_capital": company_data.get("paid_up_capital"),
                            "directors": company_data.get("directors", [])
                        },
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "reference_id": reference_id,
                        "status": "failed",
                        "error": data.get("message", "CIN verification failed")
                    }
                    
        except Exception as e:
            logger.error(f"CIN verification error: {e}")
            return {
                "success": False,
                "reference_id": reference_id,
                "status": "error",
                "error": str(e)
            }


# Singleton instance
_sandbox_service = None

def get_sandbox_service() -> SandboxKYCService:
    """Get or create sandbox service instance"""
    global _sandbox_service
    if _sandbox_service is None:
        _sandbox_service = SandboxKYCService()
    return _sandbox_service
