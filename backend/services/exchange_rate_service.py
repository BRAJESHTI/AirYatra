"""
AirYatra Exchange Rate Service
Fetches live exchange rates with fallback to static rates
"""

import os
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# API Configuration - Use free exchange rate APIs
EXCHANGE_API_KEY = os.environ.get("EXCHANGE_API_KEY", "")
EXCHANGE_API_URL = "https://api.exchangerate-api.com/v4/latest"  # Free tier, no key needed

# Fallback static rates (INR base)
FALLBACK_RATES = {
    "INR": 1.0,
    "USD": 0.012,
    "EUR": 0.011,
    "GBP": 0.0095,
    "AUD": 0.018,
    "CAD": 0.016,
    "SGD": 0.016,
    "AED": 0.044,
    "JPY": 1.8,
    "CNY": 0.087,
    "THB": 0.43,
}

# Cache for rates
_rate_cache = {
    "rates": None,
    "last_updated": None,
    "base_currency": "INR"
}

CACHE_DURATION = timedelta(hours=1)


class ExchangeRateService:
    """Service for fetching and caching exchange rates"""
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def get_rates(self, base_currency: str = "INR", force_refresh: bool = False) -> Dict[str, Any]:
        """
        Get exchange rates with INR as base
        Returns rates relative to INR (1 INR = X target currency)
        """
        global _rate_cache
        
        # Check cache
        if not force_refresh and _rate_cache["rates"]:
            cache_age = datetime.now(timezone.utc) - _rate_cache["last_updated"]
            if cache_age < CACHE_DURATION:
                return {
                    "success": True,
                    "rates": _rate_cache["rates"],
                    "base": "INR",
                    "last_updated": _rate_cache["last_updated"].isoformat(),
                    "cached": True,
                    "source": "cache"
                }
        
        # Fetch fresh rates
        try:
            # Fetch USD-based rates (most APIs use USD as base)
            response = await self.client.get(f"{EXCHANGE_API_URL}/USD")
            
            if response.status_code == 200:
                data = response.json()
                usd_rates = data.get("rates", {})
                
                if "INR" in usd_rates:
                    # Convert to INR base
                    inr_per_usd = usd_rates["INR"]
                    
                    inr_based_rates = {"INR": 1.0}
                    for currency, rate in usd_rates.items():
                        if currency != "INR":
                            # Calculate: 1 INR = (1/INR_per_USD) * target_per_USD
                            inr_based_rates[currency] = round(rate / inr_per_usd, 6)
                    
                    # Update cache
                    _rate_cache["rates"] = inr_based_rates
                    _rate_cache["last_updated"] = datetime.now(timezone.utc)
                    
                    logger.info(f"Exchange rates fetched successfully. Updated {len(inr_based_rates)} currencies")
                    
                    return {
                        "success": True,
                        "rates": inr_based_rates,
                        "base": "INR",
                        "last_updated": _rate_cache["last_updated"].isoformat(),
                        "cached": False,
                        "source": "live"
                    }
        
        except httpx.TimeoutException:
            logger.warning("Exchange rate API timeout, using fallback rates")
        except httpx.RequestError as e:
            logger.warning(f"Exchange rate API error: {e}, using fallback rates")
        except Exception as e:
            logger.error(f"Exchange rate fetch error: {e}, using fallback rates")
        
        # Return fallback rates
        return {
            "success": True,
            "rates": FALLBACK_RATES,
            "base": "INR",
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "cached": False,
            "source": "fallback",
            "warning": "Using static fallback rates. Live rates unavailable."
        }
    
    async def convert(
        self, 
        amount: float, 
        from_currency: str, 
        to_currency: str
    ) -> Dict[str, Any]:
        """Convert amount between currencies"""
        
        if from_currency == to_currency:
            return {
                "success": True,
                "original_amount": amount,
                "converted_amount": amount,
                "from_currency": from_currency,
                "to_currency": to_currency,
                "rate": 1.0
            }
        
        rates_response = await self.get_rates()
        rates = rates_response.get("rates", FALLBACK_RATES)
        
        # Get rate for from_currency (relative to INR)
        from_rate = rates.get(from_currency, 1.0)
        to_rate = rates.get(to_currency, 1.0)
        
        if from_rate == 0:
            from_rate = 1.0
        
        # Convert: amount_from -> INR -> amount_to
        # 1 INR = from_rate from_currency, so amount from_currency = amount / from_rate INR
        inr_amount = amount / from_rate if from_currency != "INR" else amount
        converted = inr_amount * to_rate if to_currency != "INR" else inr_amount
        
        # Calculate direct exchange rate
        direct_rate = to_rate / from_rate if from_rate != 0 else 0
        
        return {
            "success": True,
            "original_amount": amount,
            "converted_amount": round(converted, 2),
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": round(direct_rate, 6),
            "source": rates_response.get("source", "unknown")
        }
    
    async def get_supported_currencies(self) -> Dict[str, Any]:
        """Get list of supported currencies with metadata"""
        
        currencies = {
            "INR": {"symbol": "₹", "name": "Indian Rupee", "flag": "🇮🇳"},
            "USD": {"symbol": "$", "name": "US Dollar", "flag": "🇺🇸"},
            "EUR": {"symbol": "€", "name": "Euro", "flag": "🇪🇺"},
            "GBP": {"symbol": "£", "name": "British Pound", "flag": "🇬🇧"},
            "AUD": {"symbol": "A$", "name": "Australian Dollar", "flag": "🇦🇺"},
            "CAD": {"symbol": "C$", "name": "Canadian Dollar", "flag": "🇨🇦"},
            "SGD": {"symbol": "S$", "name": "Singapore Dollar", "flag": "🇸🇬"},
            "AED": {"symbol": "د.إ", "name": "UAE Dirham", "flag": "🇦🇪"},
            "JPY": {"symbol": "¥", "name": "Japanese Yen", "flag": "🇯🇵"},
            "THB": {"symbol": "฿", "name": "Thai Baht", "flag": "🇹🇭"},
        }
        
        # Get current rates
        rates_response = await self.get_rates()
        rates = rates_response.get("rates", {})
        
        # Combine currency info with rates
        result = {}
        for code, info in currencies.items():
            result[code] = {
                **info,
                "rate_from_inr": rates.get(code, FALLBACK_RATES.get(code, 1.0))
            }
        
        return {
            "success": True,
            "currencies": result,
            "base": "INR",
            "last_updated": rates_response.get("last_updated"),
            "source": rates_response.get("source", "unknown")
        }


# Singleton instance
exchange_rate_service = ExchangeRateService()
