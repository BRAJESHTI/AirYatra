"""
AirYatra Exchange Rates API Routes
Live currency exchange rates for multi-currency payments
"""

from fastapi import APIRouter, Query
from typing import Optional

from services.exchange_rate_service import exchange_rate_service

router = APIRouter(prefix="/exchange-rates", tags=["Exchange Rates"])


@router.get("/")
async def get_exchange_rates(
    base: str = Query("INR", description="Base currency (default: INR)"),
    refresh: bool = Query(False, description="Force refresh from API")
):
    """
    Get current exchange rates with INR as base currency.
    Rates are cached for 1 hour.
    
    Returns:
        rates: Dict of currency codes to their exchange rates (1 INR = X)
        last_updated: ISO timestamp of when rates were fetched
        source: 'live', 'cache', or 'fallback'
    """
    result = await exchange_rate_service.get_rates(base_currency=base, force_refresh=refresh)
    return result


@router.get("/convert")
async def convert_currency(
    amount: float = Query(..., description="Amount to convert"),
    from_currency: str = Query("INR", description="Source currency code"),
    to_currency: str = Query("USD", description="Target currency code")
):
    """
    Convert amount between two currencies.
    
    Example: /api/exchange-rates/convert?amount=10000&from_currency=INR&to_currency=USD
    """
    result = await exchange_rate_service.convert(
        amount=amount,
        from_currency=from_currency.upper(),
        to_currency=to_currency.upper()
    )
    return result


@router.get("/currencies")
async def get_supported_currencies():
    """
    Get list of supported currencies with symbols, names, and current rates.
    """
    return await exchange_rate_service.get_supported_currencies()
