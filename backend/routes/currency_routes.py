from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
from uuid import uuid4
from database import get_database
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/currency", tags=["Multi-Currency Support"])

# Exchange rates (In production, use live API like exchangerate-api.com)
EXCHANGE_RATES = {
    "INR": 1.0,
    "USD": 0.012,
    "EUR": 0.011,
    "GBP": 0.0095,
    "AED": 0.044,
    "SGD": 0.016,
    "AUD": 0.018,
    "CAD": 0.016,
    "JPY": 1.78,
    "CNY": 0.086
}

CURRENCY_SYMBOLS = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "AED": "د.إ",
    "SGD": "S$",
    "AUD": "A$",
    "CAD": "C$",
    "JPY": "¥",
    "CNY": "¥"
}

CURRENCY_NAMES = {
    "INR": "Indian Rupee",
    "USD": "US Dollar",
    "EUR": "Euro",
    "GBP": "British Pound",
    "AED": "UAE Dirham",
    "SGD": "Singapore Dollar",
    "AUD": "Australian Dollar",
    "CAD": "Canadian Dollar",
    "JPY": "Japanese Yen",
    "CNY": "Chinese Yuan"
}

# Models
class CurrencyConversion(BaseModel):
    amount: float
    from_currency: str = "INR"
    to_currency: str

class UserCurrencyPreference(BaseModel):
    preferred_currency: str

class PriceDisplay(BaseModel):
    amount_inr: float
    display_currency: str = "INR"

# Helper Functions
def convert_currency(amount: float, from_currency: str, to_currency: str) -> dict:
    """Convert amount between currencies"""
    if from_currency not in EXCHANGE_RATES or to_currency not in EXCHANGE_RATES:
        raise ValueError("Unsupported currency")
    
    # Convert to INR first, then to target currency
    amount_in_inr = amount / EXCHANGE_RATES[from_currency]
    converted_amount = amount_in_inr * EXCHANGE_RATES[to_currency]
    
    return {
        "original_amount": amount,
        "original_currency": from_currency,
        "converted_amount": round(converted_amount, 2),
        "converted_currency": to_currency,
        "exchange_rate": EXCHANGE_RATES[to_currency] / EXCHANGE_RATES[from_currency],
        "symbol": CURRENCY_SYMBOLS[to_currency]
    }

def format_price(amount: float, currency: str) -> str:
    """Format price with currency symbol"""
    symbol = CURRENCY_SYMBOLS.get(currency, "")
    if currency == "JPY":
        return f"{symbol}{int(amount):,}"
    return f"{symbol}{amount:,.2f}"

# API Endpoints
@router.get("/supported")
async def get_supported_currencies():
    """Get list of supported currencies"""
    currencies = []
    for code in EXCHANGE_RATES.keys():
        currencies.append({
            "code": code,
            "name": CURRENCY_NAMES.get(code, code),
            "symbol": CURRENCY_SYMBOLS.get(code, code),
            "rate_to_inr": 1 / EXCHANGE_RATES[code]
        })
    
    return {"currencies": currencies, "base_currency": "INR"}

@router.get("/rates")
async def get_exchange_rates():
    """Get current exchange rates"""
    return {
        "base": "INR",
        "rates": EXCHANGE_RATES,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

@router.post("/convert")
async def convert(conversion: CurrencyConversion):
    """Convert amount between currencies"""
    try:
        result = convert_currency(
            conversion.amount,
            conversion.from_currency.upper(),
            conversion.to_currency.upper()
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/display-price")
async def get_display_price(price: PriceDisplay):
    """Get price formatted for display in user's preferred currency"""
    try:
        if price.display_currency.upper() == "INR":
            return {
                "original_inr": price.amount_inr,
                "display_amount": price.amount_inr,
                "display_currency": "INR",
                "formatted": format_price(price.amount_inr, "INR")
            }
        
        result = convert_currency(price.amount_inr, "INR", price.display_currency.upper())
        return {
            "original_inr": price.amount_inr,
            "display_amount": result["converted_amount"],
            "display_currency": result["converted_currency"],
            "formatted": format_price(result["converted_amount"], result["converted_currency"]),
            "exchange_rate": result["exchange_rate"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/preference")
async def get_currency_preference(current_user: dict = Depends(get_current_user)):
    """Get user's currency preference"""
    db = get_database()
    
    pref = await db.user_currency_preferences.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not pref:
        return {"preferred_currency": "INR", "symbol": "₹"}
    
    return {
        "preferred_currency": pref["preferred_currency"],
        "symbol": CURRENCY_SYMBOLS.get(pref["preferred_currency"], "₹")
    }

@router.put("/preference")
async def set_currency_preference(pref: UserCurrencyPreference, current_user: dict = Depends(get_current_user)):
    """Set user's currency preference"""
    currency = pref.preferred_currency.upper()
    
    if currency not in EXCHANGE_RATES:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    
    db = get_database()
    
    await db.user_currency_preferences.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "user_id": current_user["id"],
                "preferred_currency": currency,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {
        "message": "Currency preference updated",
        "preferred_currency": currency,
        "symbol": CURRENCY_SYMBOLS[currency]
    }

@router.post("/booking-price/{booking_id}")
async def get_booking_price_in_currency(booking_id: str, currency: str = "INR", current_user: dict = Depends(get_current_user)):
    """Get booking price in specified currency"""
    db = get_database()
    
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    amount_inr = booking.get("total_amount", 0)
    currency = currency.upper()
    
    if currency == "INR":
        return {
            "booking_id": booking_id,
            "amount_inr": amount_inr,
            "display_amount": amount_inr,
            "currency": "INR",
            "formatted": format_price(amount_inr, "INR")
        }
    
    try:
        result = convert_currency(amount_inr, "INR", currency)
        return {
            "booking_id": booking_id,
            "amount_inr": amount_inr,
            "display_amount": result["converted_amount"],
            "currency": currency,
            "formatted": format_price(result["converted_amount"], currency),
            "exchange_rate": result["exchange_rate"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
