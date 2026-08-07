import React, { useState, useEffect, useCallback } from 'react';
import { 
  Globe, ChevronDown, RefreshCw, TrendingUp, TrendingDown, 
  DollarSign, Info, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import api from '../../services/api';

/**
 * Currency Configuration with symbols and flags
 */
const CURRENCIES = {
  INR: { symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', locale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺', locale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧', locale: 'en-GB' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', locale: 'en-AU' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦', locale: 'en-CA' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', locale: 'en-SG' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪', locale: 'ar-AE' },
};

/**
 * Fallback exchange rates (INR base) - Used when API is unavailable
 */
const FALLBACK_RATES = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AUD: 0.018,
  CAD: 0.016,
  SGD: 0.016,
  AED: 0.044,
};

// Cache for exchange rates
let cachedRates = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

/**
 * Fetch live exchange rates from backend
 */
export const fetchLiveRates = async (forceRefresh = false) => {
  // Check cache first
  if (!forceRefresh && cachedRates && cacheTimestamp) {
    const age = Date.now() - cacheTimestamp;
    if (age < CACHE_DURATION) {
      return { rates: cachedRates, source: 'cache', success: true };
    }
  }
  
  try {
    const response = await api.get('/exchange-rates/', { params: { refresh: forceRefresh } });
    if (response.data.success && response.data.rates) {
      cachedRates = response.data.rates;
      cacheTimestamp = Date.now();
      return { 
        rates: response.data.rates, 
        source: response.data.source || 'live',
        success: true 
      };
    }
  } catch (error) {
    console.warn('Failed to fetch live rates, using fallback:', error.message);
  }
  
  return { rates: FALLBACK_RATES, source: 'fallback', success: true };
};

/**
 * Get current exchange rates (cached or fallback)
 */
export const getExchangeRates = () => {
  return cachedRates || FALLBACK_RATES;
};

/**
 * Convert amount between currencies
 */
export const convertCurrency = (amount, fromCurrency, toCurrency, rates = null) => {
  if (fromCurrency === toCurrency) return amount;
  
  const exchangeRates = rates || getExchangeRates();
  
  // Convert to INR first, then to target
  const fromRate = exchangeRates[fromCurrency] || 1;
  const toRate = exchangeRates[toCurrency] || 1;
  
  const inrAmount = fromCurrency === 'INR' 
    ? amount 
    : amount / fromRate;
  
  const targetAmount = toCurrency === 'INR'
    ? inrAmount
    : inrAmount * toRate;
  
  return parseFloat(targetAmount.toFixed(2));
};

/**
 * Format amount with currency symbol
 */
export const formatCurrency = (amount, currencyCode) => {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.INR;
  
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currencyCode === 'INR' ? 0 : 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency.symbol}${amount.toLocaleString()}`;
  }
};

/**
 * Currency Selector Component
 */
export default function CurrencySelector({
  selectedCurrency = 'INR',
  onCurrencyChange,
  baseAmount,  // Amount in INR
  showConversion = true,
  availableCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD'],
  size = 'default',  // 'sm', 'default', 'lg'
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState(baseAmount);
  const [rates, setRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateSource, setRateSource] = useState('fallback');

  // Fetch live rates on mount
  useEffect(() => {
    const loadRates = async () => {
      setRatesLoading(true);
      const result = await fetchLiveRates();
      setRates(result.rates);
      setRateSource(result.source);
      setRatesLoading(false);
    };
    loadRates();
  }, []);

  // Update converted amount when currency or base amount changes
  useEffect(() => {
    if (baseAmount && selectedCurrency) {
      const converted = convertCurrency(baseAmount, 'INR', selectedCurrency, rates);
      setConvertedAmount(converted);
    }
  }, [baseAmount, selectedCurrency, rates]);

  const handleSelect = (currencyCode) => {
    onCurrencyChange?.(currencyCode);
    setIsOpen(false);
  };

  const handleRefreshRates = async () => {
    setRatesLoading(true);
    const result = await fetchLiveRates(true);
    setRates(result.rates);
    setRateSource(result.source);
    setRatesLoading(false);
  };

  const currentCurrency = CURRENCIES[selectedCurrency] || CURRENCIES.INR;

  const sizeClasses = {
    sm: 'h-8 text-sm px-2',
    default: 'h-10 px-3',
    lg: 'h-12 text-lg px-4'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Currency Dropdown */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={`${sizeClasses[size]} min-w-[120px] justify-between`}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{currentCurrency.flag}</span>
              <span className="font-medium">{selectedCurrency}</span>
            </span>
            <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          {/* Rate source indicator */}
          <div className="px-2 py-1.5 border-b flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Rates: {rateSource === 'live' ? '🟢 Live' : rateSource === 'cache' ? '🟡 Cached' : '🔴 Offline'}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); handleRefreshRates(); }}
              className="text-xs text-orange-500 hover:underline flex items-center gap-1"
              disabled={ratesLoading}
            >
              <RefreshCw className={`h-3 w-3 ${ratesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          
          {availableCurrencies.map((code) => {
            const currency = CURRENCIES[code];
            if (!currency) return null;
            
            const isSelected = code === selectedCurrency;
            const converted = baseAmount ? convertCurrency(baseAmount, 'INR', code, rates) : null;
            
            return (
              <DropdownMenuItem
                key={code}
                onClick={() => handleSelect(code)}
                className={`flex items-center justify-between py-2 ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{currency.flag}</span>
                  <div>
                    <p className="font-medium">{code}</p>
                    <p className="text-xs text-slate-500">{currency.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  {converted && (
                    <p className="text-sm font-medium">
                      {formatCurrency(converted, code)}
                    </p>
                  )}
                  {isSelected && <Check className="h-4 w-4 text-orange-500" />}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Converted Amount Display */}
      {showConversion && baseAmount && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Globe className="h-4 w-4 text-slate-500" />
          <div>
            <p className="text-sm font-bold">
              {formatCurrency(convertedAmount, selectedCurrency)}
            </p>
            {selectedCurrency !== 'INR' && (
              <p className="text-xs text-slate-500">
                ≈ {formatCurrency(baseAmount, 'INR')}
              </p>
            )}
          </div>
          {ratesLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        </div>
      )}
    </div>
  );
}

/**
 * Inline Currency Display with conversion
 */
export function CurrencyDisplay({
  amount,
  fromCurrency = 'INR',
  toCurrency,
  showOriginal = true,
  className = ''
}) {
  const converted = toCurrency && toCurrency !== fromCurrency
    ? convertCurrency(amount, fromCurrency, toCurrency)
    : amount;

  const displayCurrency = toCurrency || fromCurrency;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-bold">{formatCurrency(converted, displayCurrency)}</span>
      {showOriginal && toCurrency && toCurrency !== fromCurrency && (
        <span className="text-slate-500 text-sm">
          ({formatCurrency(amount, fromCurrency)})
        </span>
      )}
    </span>
  );
}

/**
 * Currency Conversion Card - shows multiple currencies
 */
export function CurrencyConversionCard({
  baseAmount,
  baseCurrency = 'INR',
  currencies = ['USD', 'EUR', 'GBP'],
  className = ''
}) {
  const [rates, setRates] = useState(null);
  const [rateSource, setRateSource] = useState('fallback');

  useEffect(() => {
    const loadRates = async () => {
      const result = await fetchLiveRates();
      setRates(result.rates);
      setRateSource(result.source);
    };
    loadRates();
  }, []);

  return (
    <div className={`p-4 bg-white dark:bg-slate-800 rounded-xl border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-orange-500" />
          <h4 className="font-semibold">Currency Conversion</h4>
        </div>
        <span className="text-xs text-slate-500">
          {rateSource === 'live' ? '🟢 Live' : rateSource === 'cache' ? '🟡 Cached' : '🔴 Static'}
        </span>
      </div>
      
      {/* Base Amount */}
      <div className="mb-3 pb-3 border-b">
        <p className="text-sm text-slate-500">Original Amount</p>
        <p className="text-2xl font-bold">
          {formatCurrency(baseAmount, baseCurrency)}
        </p>
      </div>
      
      {/* Converted Amounts */}
      <div className="space-y-2">
        {currencies.map(code => {
          if (code === baseCurrency) return null;
          const converted = convertCurrency(baseAmount, baseCurrency, code, rates);
          const currency = CURRENCIES[code];
          
          return (
            <div key={code} className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-sm">
                <span>{currency?.flag}</span>
                <span>{currency?.name}</span>
              </span>
              <span className="font-medium">
                {formatCurrency(converted, code)}
              </span>
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
        <Info className="h-3 w-3" />
        {rateSource === 'live' ? 'Live rates updated hourly' : 'Rates may vary at checkout'}
      </p>
    </div>
  );
}

/**
 * Mini Currency Badge
 */
export function CurrencyBadge({ currency, amount, className = '' }) {
  const config = CURRENCIES[currency];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-sm ${className}`}>
      <span>{config.flag}</span>
      <span className="font-medium">{formatCurrency(amount, currency)}</span>
    </span>
  );
}
