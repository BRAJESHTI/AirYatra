import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  IndianRupee, Receipt, Clock, AlertTriangle, CheckCircle, 
  ChevronDown, ChevronUp, Loader2, Lock, Timer, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ PRICE LOCK TIMER ============

export const PriceLockTimer = ({ lockId, onExpire, onLockData }) => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 15, seconds: 0, expired: false });
  const [lockData, setLockData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const fetchLockStatus = useCallback(async () => {
    if (!lockId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/pricing/lock/${lockId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLockData(response.data);
      if (onLockData) onLockData(response.data);
      
      if (response.data.time_remaining) {
        setTimeLeft(response.data.time_remaining);
        if (response.data.time_remaining.expired && onExpire) {
          onExpire();
        }
      }
    } catch (error) {
      console.error('Failed to fetch lock status:', error);
    } finally {
      setLoading(false);
    }
  }, [lockId, onExpire, onLockData]);
  
  useEffect(() => {
    fetchLockStatus();
  }, [fetchLockStatus]);
  
  // Countdown timer
  useEffect(() => {
    if (timeLeft.expired || !lockData) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.expired) return prev;
        
        let newSeconds = prev.seconds - 1;
        let newMinutes = prev.minutes;
        
        if (newSeconds < 0) {
          newSeconds = 59;
          newMinutes = newMinutes - 1;
        }
        
        if (newMinutes < 0) {
          if (onExpire) onExpire();
          return { minutes: 0, seconds: 0, expired: true };
        }
        
        return {
          minutes: newMinutes,
          seconds: newSeconds,
          expired: false,
          total_seconds: newMinutes * 60 + newSeconds
        };
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeLeft.expired, lockData, onExpire]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
      </div>
    );
  }
  
  if (!lockData) return null;
  
  const isUrgent = timeLeft.minutes < 2;
  const isExpired = timeLeft.expired;
  
  return (
    <Card className={`border-2 ${isExpired ? 'bg-red-500/10 border-red-500' : isUrgent ? 'bg-orange-500/10 border-orange-500' : 'bg-green-500/10 border-green-500'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpired ? (
              <AlertTriangle className="h-8 w-8 text-red-400" />
            ) : (
              <Lock className={`h-8 w-8 ${isUrgent ? 'text-orange-400 animate-pulse' : 'text-green-400'}`} />
            )}
            <div>
              <h3 className="text-white font-semibold">
                {isExpired ? 'Price Lock Expired' : 'Price Locked'}
              </h3>
              <p className="text-slate-400 text-sm">
                {isExpired 
                  ? 'Please request a new quote' 
                  : 'Complete payment before timer expires'
                }
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-4xl font-mono font-bold ${
              isExpired ? 'text-red-400' : isUrgent ? 'text-orange-400 animate-pulse' : 'text-green-400'
            }`}>
              {isExpired ? '00:00' : `${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`}
            </div>
            {!isExpired && (
              <p className="text-slate-400 text-xs mt-1">
                {timeLeft.minutes > 0 ? `${timeLeft.minutes} min ${timeLeft.seconds} sec remaining` : `${timeLeft.seconds} seconds remaining`}
              </p>
            )}
          </div>
        </div>
        
        {/* Locked Price */}
        {lockData.locked_price && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
            <span className="text-slate-400">Locked Total:</span>
            <span className="text-2xl font-bold text-white flex items-center">
              <IndianRupee className="h-5 w-5" />
              {lockData.locked_price.grand_total.toLocaleString()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============ CUSTOMER PRICE BREAKUP ============

export const CustomerPriceBreakup = ({ 
  baseFare = 0, 
  landingCharges = 0, 
  handlingCharges = 0, 
  crewCharges = 0, 
  fuelSurcharge = 0, 
  otherCharges = 0, 
  discount = 0,
  quoteId = null,
  showDetails = true 
}) => {
  const [breakup, setBreakup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(showDetails);
  
  useEffect(() => {
    const fetchBreakup = async () => {
      try {
        const token = localStorage.getItem('token');
        
        let response;
        if (quoteId) {
          // Fetch from quote
          response = await axios.get(`${API_URL}/api/pricing/customer/quote/${quoteId}/breakup`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } else {
          // Calculate from props
          response = await axios.post(`${API_URL}/api/pricing/customer/breakup`, {
            base_price: baseFare,
            landing_charges: landingCharges,
            handling_charges: handlingCharges,
            crew_charges: crewCharges,
            fuel_surcharge: fuelSurcharge,
            other_charges: otherCharges,
            discount: discount
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        setBreakup(response.data);
      } catch (error) {
        console.error('Failed to fetch price breakup:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBreakup();
  }, [baseFare, landingCharges, handlingCharges, crewCharges, fuelSurcharge, otherCharges, discount, quoteId]);
  
  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }
  
  if (!breakup) return null;
  
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-orange-400" />
            Price Breakup / मूल्य विवरण
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {expanded && breakup.breakdown && (
          <div className="space-y-2 mb-4">
            {/* Base Charges */}
            {Object.entries(breakup.breakdown).map(([key, item]) => (
              item.amount > 0 && (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-white">₹ {item.amount.toLocaleString()}</span>
                </div>
              )
            ))}
            
            {/* Subtotal */}
            <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
              <span className="text-slate-400">Subtotal / उप-योग</span>
              <span className="text-white">₹ {breakup.subtotal.toLocaleString()}</span>
            </div>
            
            {/* Discount */}
            {breakup.discount?.amount > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>{breakup.discount.label}</span>
                <span>- ₹ {breakup.discount.amount.toLocaleString()}</span>
              </div>
            )}
            
            {/* Platform Fee */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{breakup.platform_fee?.label}</span>
              <span className="text-white">₹ {breakup.platform_fee?.amount?.toLocaleString()}</span>
            </div>
            
            {/* GST */}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{breakup.gst?.label}</span>
              <span className="text-white">₹ {breakup.gst?.amount?.toLocaleString()}</span>
            </div>
          </div>
        )}
        
        {/* Grand Total */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-700">
          <div>
            <span className="text-white font-semibold">Grand Total / कुल राशि</span>
            <p className="text-slate-500 text-xs">Includes all taxes / सभी कर शामिल</p>
          </div>
          <span className="text-3xl font-bold text-green-400 flex items-center">
            <IndianRupee className="h-6 w-6" />
            {breakup.grand_total?.toLocaleString()}
          </span>
        </div>
        
        {/* Trust Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Shield className="h-4 w-4" />
          <span>Transparent pricing by AirYatra</span>
        </div>
      </CardContent>
    </Card>
  );
};

// ============ OPERATOR SETTLEMENT VIEW ============

export const OperatorSettlementView = ({ 
  baseFare = 0, 
  landingCharges = 0, 
  handlingCharges = 0, 
  crewCharges = 0, 
  fuelSurcharge = 0, 
  otherCharges = 0, 
  discount = 0,
  quoteId = null
}) => {
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  
  useEffect(() => {
    const fetchSettlement = async () => {
      try {
        const token = localStorage.getItem('token');
        
        let response;
        if (quoteId) {
          response = await axios.get(`${API_URL}/api/pricing/operator/quote/${quoteId}/settlement`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } else {
          response = await axios.post(`${API_URL}/api/pricing/operator/settlement-preview`, {
            base_price: baseFare,
            landing_charges: landingCharges,
            handling_charges: handlingCharges,
            crew_charges: crewCharges,
            fuel_surcharge: fuelSurcharge,
            other_charges: otherCharges,
            discount: discount
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        
        setSettlement(response.data);
      } catch (error) {
        console.error('Failed to fetch settlement:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettlement();
  }, [baseFare, landingCharges, handlingCharges, crewCharges, fuelSurcharge, otherCharges, discount, quoteId]);
  
  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }
  
  if (!settlement) return null;
  
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-green-400" />
            Your Settlement / आपका भुगतान
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {expanded && (
          <>
            {/* Quote Summary */}
            <div className="mb-4 p-3 bg-slate-800 rounded-lg">
              <h4 className="text-white text-sm font-medium mb-2">Quote Summary</h4>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Base Price</span>
                <span className="text-white">₹ {settlement.quote_summary?.base_price?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Additional Charges</span>
                <span className="text-white">₹ {settlement.quote_summary?.additional_charges?.toLocaleString()}</span>
              </div>
              {settlement.quote_summary?.discount_given > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Discount Given</span>
                  <span>- ₹ {settlement.quote_summary?.discount_given?.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-700 pt-2 mt-2">
                <span className="text-white">Total Quote</span>
                <span className="text-white">₹ {settlement.quote_summary?.total_quote?.toLocaleString()}</span>
              </div>
            </div>
            
            {/* Deductions */}
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <h4 className="text-red-400 text-sm font-medium mb-2">Deductions / कटौती</h4>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{settlement.deductions?.platform_commission?.label}</span>
                <span className="text-red-400">- ₹ {settlement.deductions?.platform_commission?.amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{settlement.deductions?.platform_fixed_fee?.label}</span>
                <span className="text-red-400">- ₹ {settlement.deductions?.platform_fixed_fee?.amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{settlement.deductions?.tds?.label}</span>
                <span className="text-red-400">- ₹ {settlement.deductions?.tds?.amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-red-500/30 pt-2 mt-2">
                <span className="text-red-400">Total Deductions</span>
                <span className="text-red-400">- ₹ {settlement.deductions?.total_deductions?.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
        
        {/* Net Payout */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-700">
          <div>
            <span className="text-white font-semibold">{settlement.net_payout?.label}</span>
            <p className="text-slate-500 text-xs">{settlement.settlement_info?.expected_days}</p>
          </div>
          <span className="text-3xl font-bold text-green-400">
            {settlement.net_payout?.formatted}
          </span>
        </div>
        
        {/* Settlement Info */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="font-medium">Settlement Timeline</span>
          </div>
          <p className="text-slate-400 text-xs">
            {settlement.settlement_info?.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// ============ CREATE PRICE LOCK ============

export const createPriceLock = async (priceData) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${API_URL}/api/pricing/lock`, priceData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to create price lock:', error);
    throw error;
  }
};

// ============ USE PRICE LOCK ============

export const usePriceLock = async (lockId, paymentId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${API_URL}/api/pricing/lock/${lockId}/use`, null, {
      headers: { Authorization: `Bearer ${token}` },
      params: { payment_id: paymentId }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to use price lock:', error);
    throw error;
  }
};

export default CustomerPriceBreakup;
