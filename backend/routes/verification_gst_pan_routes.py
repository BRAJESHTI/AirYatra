from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel
from database import get_database
from middleware import get_current_user

router = APIRouter(prefix="/verification", tags=["GST & PAN Verification"])

class GSTVerifyRequest(BaseModel):
    gstin: str

class PANVerifyRequest(BaseModel):
    pan: str
    name: Optional[str] = None

# Sample GST data for testing (In production, call actual API)
SAMPLE_GST_DATA = {
    "27AABCU9603R1ZM": {
        "gstin": "27AABCU9603R1ZM",
        "legal_name": "INFOSYS LIMITED",
        "trade_name": "INFOSYS LIMITED",
        "address": "Electronics City, Hosur Road",
        "city": "Bengaluru",
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "pincode": "560100",
        "state_code": "27",
        "status": "Active",
        "business_type": "Private Limited Company",
        "registration_date": "2017-07-01"
    },
    "07AABCT1332L1ZD": {
        "gstin": "07AABCT1332L1ZD",
        "legal_name": "TATA CONSULTANCY SERVICES LIMITED",
        "trade_name": "TCS",
        "address": "Air India Building, Nariman Point",
        "city": "Mumbai",
        "district": "Mumbai City",
        "state": "Maharashtra",
        "pincode": "400021",
        "state_code": "07",
        "status": "Active",
        "business_type": "Private Limited Company",
        "registration_date": "2017-07-01"
    },
    "06AABCR9876H1ZP": {
        "gstin": "06AABCR9876H1ZP",
        "legal_name": "RELIANCE INDUSTRIES LIMITED",
        "trade_name": "RELIANCE",
        "address": "Maker Chambers IV, Nariman Point",
        "city": "Mumbai",
        "district": "Mumbai City",
        "state": "Maharashtra",
        "pincode": "400021",
        "state_code": "06",
        "status": "Active",
        "business_type": "Public Limited Company",
        "registration_date": "2017-07-01"
    },
    "09AALCW8155K1ZL": {
        "gstin": "09AALCW8155K1ZL",
        "legal_name": "WIPRO LIMITED",
        "trade_name": "WIPRO",
        "address": "Doddakannelli, Sarjapur Road",
        "city": "Bengaluru",
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "pincode": "560035",
        "state_code": "09",
        "status": "Active",
        "business_type": "Private Limited Company",
        "registration_date": "2017-07-01"
    }
}

# Sample PAN data for testing
SAMPLE_PAN_DATA = {
    "ABCDE1234F": {
        "pan": "ABCDE1234F",
        "name": "RAHUL SHARMA",
        "status": "Valid",
        "type": "Individual",
        "last_name": "SHARMA",
        "first_name": "RAHUL"
    },
    "PQRST5678G": {
        "pan": "PQRST5678G",
        "name": "PRIYA GUPTA",
        "status": "Valid",
        "type": "Individual",
        "last_name": "GUPTA",
        "first_name": "PRIYA"
    },
    "AABCU9603R": {
        "pan": "AABCU9603R",
        "name": "INFOSYS LIMITED",
        "status": "Valid",
        "type": "Company",
        "entity_name": "INFOSYS LIMITED"
    },
    "AABCT1332L": {
        "pan": "AABCT1332L",
        "name": "TATA CONSULTANCY SERVICES LIMITED",
        "status": "Valid",
        "type": "Company",
        "entity_name": "TATA CONSULTANCY SERVICES LIMITED"
    }
}

def validate_gstin_format(gstin: str) -> bool:
    """Validate GSTIN format - 15 characters alphanumeric"""
    import re
    if len(gstin) != 15:
        return False
    # GSTIN format: 2 digits state code + 10 char PAN + 1 entity code + 1 check digit + Z
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$'
    return bool(re.match(pattern, gstin.upper()))

def validate_pan_format(pan: str) -> bool:
    """Validate PAN format - 10 characters"""
    import re
    if len(pan) != 10:
        return False
    # PAN format: 5 letters + 4 digits + 1 letter
    pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
    return bool(re.match(pattern, pan.upper()))

@router.post("/gst/verify")
async def verify_gst(
    request: GSTVerifyRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Verify GST number and get company details
    GST Verification से Company का नाम, पता, शहर, राज्य auto-fill होगा
    """
    gstin = request.gstin.strip().upper()
    
    # Validate format
    if not validate_gstin_format(gstin):
        raise HTTPException(
            status_code=400,
            detail="Invalid GST format. GST number should be 15 characters."
        )
    
    # Check if we have this GST in cache
    cached = await db.gst_verifications.find_one({"gstin": gstin}, {"_id": 0})
    if cached and cached.get("verified"):
        return {
            "verified": True,
            "gstin": gstin,
            "company_name": cached.get("legal_name"),
            "trade_name": cached.get("trade_name"),
            "address": cached.get("address"),
            "city": cached.get("city"),
            "district": cached.get("district"),
            "state": cached.get("state"),
            "pincode": cached.get("pincode"),
            "status": cached.get("status"),
            "business_type": cached.get("business_type"),
            "message": "GST verified from cache"
        }
    
    # Get API settings
    api_settings = await db.api_keys_settings.find_one({"type": "api_keys"}, {"_id": 0})
    gst_enabled = api_settings.get("gst_verification_enabled", "false") if api_settings else "false"
    gst_api_key = api_settings.get("gst_verification_api_key", "") if api_settings else ""
    gst_api_url = api_settings.get("gst_verification_api_url", "") if api_settings else ""
    
    # If API enabled and configured, call external API
    if gst_enabled == "true" and gst_api_key and gst_api_url:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{gst_api_url}/{gstin}",
                    headers={"Authorization": f"Bearer {gst_api_key}"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    # Cache the result
                    await db.gst_verifications.update_one(
                        {"gstin": gstin},
                        {"$set": {
                            "gstin": gstin,
                            "verified": True,
                            **data,
                            "verified_at": datetime.now(timezone.utc).isoformat(),
                            "source": "api"
                        }},
                        upsert=True
                    )
                    return {
                        "verified": True,
                        "gstin": gstin,
                        "company_name": data.get("legal_name") or data.get("lgnm"),
                        "trade_name": data.get("trade_name") or data.get("tradeNam"),
                        "address": data.get("address") or data.get("pradr", {}).get("addr", ""),
                        "city": data.get("city"),
                        "district": data.get("district"),
                        "state": data.get("state") or data.get("stj"),
                        "pincode": data.get("pincode"),
                        "status": data.get("status") or data.get("sts"),
                        "business_type": data.get("business_type") or data.get("ctb"),
                        "message": "GST verified via API"
                    }
        except Exception as e:
            print(f"GST API error: {e}")
            # Fall through to sample data
    
    # Use sample data for testing (Mocked)
    if gstin in SAMPLE_GST_DATA:
        gst_data = SAMPLE_GST_DATA[gstin]
        # Cache for future use
        await db.gst_verifications.update_one(
            {"gstin": gstin},
            {"$set": {
                "gstin": gstin,
                "verified": True,
                **gst_data,
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "source": "sample"
            }},
            upsert=True
        )
        return {
            "verified": True,
            "gstin": gstin,
            "company_name": gst_data["legal_name"],
            "trade_name": gst_data["trade_name"],
            "address": gst_data["address"],
            "city": gst_data["city"],
            "district": gst_data["district"],
            "state": gst_data["state"],
            "pincode": gst_data["pincode"],
            "status": gst_data["status"],
            "business_type": gst_data["business_type"],
            "message": "GST verified (Sample Data - Mocked)"
        }
    
    # GST not found - could still be valid, just not in our sample
    return {
        "verified": False,
        "gstin": gstin,
        "message": "GST not found in database. Please verify manually or enable API. / GST डेटाबेस में नहीं मिला",
        "company_name": None,
        "trade_name": None,
        "address": None,
        "city": None,
        "state": None,
        "pincode": None
    }

@router.post("/pan/verify")
async def verify_pan(
    request: PANVerifyRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Verify PAN number
    PAN Verification से नाम verify होगा
    """
    pan = request.pan.strip().upper()
    
    # Validate format
    if not validate_pan_format(pan):
        raise HTTPException(
            status_code=400,
            detail="Invalid PAN format. PAN should be 10 characters."
        )
    
    # Check if we have this PAN in cache
    cached = await db.pan_verifications.find_one({"pan": pan}, {"_id": 0})
    if cached and cached.get("verified"):
        return {
            "verified": True,
            "pan": pan,
            "name": cached.get("name"),
            "pan_type": cached.get("type"),
            "status": cached.get("status"),
            "message": "PAN verified from cache"
        }
    
    # Get API settings
    api_settings = await db.api_keys_settings.find_one({"type": "api_keys"}, {"_id": 0})
    pan_enabled = api_settings.get("pan_verification_enabled", "false") if api_settings else "false"
    pan_api_key = api_settings.get("pan_verification_api_key", "") if api_settings else ""
    pan_api_url = api_settings.get("pan_verification_api_url", "") if api_settings else ""
    
    # If API enabled and configured, call external API
    if pan_enabled == "true" and pan_api_key and pan_api_url:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    pan_api_url,
                    json={"pan": pan, "name": request.name},
                    headers={"Authorization": f"Bearer {pan_api_key}"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    # Cache the result
                    await db.pan_verifications.update_one(
                        {"pan": pan},
                        {"$set": {
                            "pan": pan,
                            "verified": True,
                            **data,
                            "verified_at": datetime.now(timezone.utc).isoformat(),
                            "source": "api"
                        }},
                        upsert=True
                    )
                    return {
                        "verified": True,
                        "pan": pan,
                        "name": data.get("name"),
                        "pan_type": data.get("type"),
                        "status": data.get("status"),
                        "message": "PAN verified via API"
                    }
        except Exception as e:
            print(f"PAN API error: {e}")
            # Fall through to sample data
    
    # Use sample data for testing (Mocked)
    if pan in SAMPLE_PAN_DATA:
        pan_data = SAMPLE_PAN_DATA[pan]
        # Cache for future use
        await db.pan_verifications.update_one(
            {"pan": pan},
            {"$set": {
                "pan": pan,
                "verified": True,
                **pan_data,
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "source": "sample"
            }},
            upsert=True
        )
        return {
            "verified": True,
            "pan": pan,
            "name": pan_data["name"],
            "pan_type": pan_data["type"],
            "status": pan_data["status"],
            "message": "PAN verified (Sample Data - Mocked)"
        }
    
    # PAN not found
    return {
        "verified": False,
        "pan": pan,
        "message": "PAN not found in database. Please verify manually or enable API. / PAN डेटाबेस में नहीं मिला",
        "name": None,
        "pan_type": None,
        "status": None
    }

@router.get("/gst/sample-numbers")
async def get_sample_gst_numbers():
    """Get sample GST numbers for testing"""
    return {
        "message": "Use these sample GST numbers for testing",
        "samples": [
            {"gstin": "27AABCU9603R1ZM", "company": "INFOSYS LIMITED"},
            {"gstin": "07AABCT1332L1ZD", "company": "TATA CONSULTANCY SERVICES LIMITED"},
            {"gstin": "06AABCR9876H1ZP", "company": "RELIANCE INDUSTRIES LIMITED"},
            {"gstin": "09AALCW8155K1ZL", "company": "WIPRO LIMITED"}
        ]
    }

@router.get("/pan/sample-numbers")
async def get_sample_pan_numbers():
    """Get sample PAN numbers for testing"""
    return {
        "message": "Use these sample PAN numbers for testing",
        "samples": [
            {"pan": "ABCDE1234F", "name": "RAHUL SHARMA", "type": "Individual"},
            {"pan": "PQRST5678G", "name": "PRIYA GUPTA", "type": "Individual"},
            {"pan": "AABCU9603R", "name": "INFOSYS LIMITED", "type": "Company"},
            {"pan": "AABCT1332L", "name": "TCS LIMITED", "type": "Company"}
        ]
    }
