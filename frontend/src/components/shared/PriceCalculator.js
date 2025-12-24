import React, { useState, useEffect } from 'react';
import { Calculator, IndianRupee, Clock, MapPin, Plane, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { settingsAPI, pincodeAPI } from '../../services/api';

function PriceCalculator({ 
  pickupLocation, 
  dropLocation, 
  onPriceCalculated,
  showWaitingTime = true,
  compact = false 
}) {
  const [pricing, setPricing] = useState(null);
  const [waitingHours, setWaitingHours] = useState(0);
  const [distance, setDistance] = useState(null);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load pricing settings
  useEffect(() => {
    loadPricing();
  }, []);

  // Calculate when locations change
  useEffect(() => {
    if (pickupLocation?.latitude && dropLocation?.latitude) {
      calculateDistance();
    }
  }, [pickupLocation, dropLocation]);

  // Recalculate when waiting hours change
  useEffect(() => {
    if (distance !== null && pricing) {
      calculatePrice();
    }
  }, [waitingHours, distance, pricing]);

  const loadPricing = async () => {
    try {
      const response = await settingsAPI.getPublicPricing();
      setPricing(response.data);
    } catch (err) {
      console.error('Failed to load pricing:', err);
      // Use defaults
      setPricing({
        base_price_upto_50km: 50000,
        rate_per_km_after_50: 1000,
        waiting_charge_per_hour: 5000,
        gst_percent: 18,
        advance_percent: 5
      });
    }
  };

  const calculateDistance = () => {
    if (!pickupLocation?.latitude || !dropLocation?.latitude) return;
    
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const lat1 = pickupLocation.latitude * Math.PI / 180;
    const lat2 = dropLocation.latitude * Math.PI / 180;
    const deltaLat = (dropLocation.latitude - pickupLocation.latitude) * Math.PI / 180;
    const deltaLon = (dropLocation.longitude - pickupLocation.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;

    setDistance(Math.round(dist * 10) / 10);
  };

  const calculatePrice = () => {
    if (!pricing || distance === null) return;

    let basePrice = pricing.base_price_upto_50km;
    let distanceCharge = 0;

    if (distance > 50) {
      distanceCharge = (distance - 50) * pricing.rate_per_km_after_50;
    }

    const waitingCharge = waitingHours * pricing.waiting_charge_per_hour;
    const subtotal = basePrice + distanceCharge + waitingCharge;
    const gstAmount = subtotal * (pricing.gst_percent / 100);
    const totalPrice = subtotal + gstAmount;
    const advanceAmount = totalPrice * (pricing.advance_percent / 100);

    const estimate = {
      distance_km: distance,
      base_price: basePrice,
      distance_charge: Math.round(distanceCharge),
      waiting_charge: waitingCharge,
      waiting_hours: waitingHours,
      subtotal: Math.round(subtotal),
      gst_percent: pricing.gst_percent,
      gst_amount: Math.round(gstAmount),
      total_price: Math.round(totalPrice),
      advance_percent: pricing.advance_percent,
      advance_amount: Math.round(advanceAmount)
    };

    setPriceEstimate(estimate);
    onPriceCalculated?.(estimate);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!pickupLocation?.latitude || !dropLocation?.latitude) {
    return (
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-center">
        <Calculator className="h-8 w-8 text-slate-500 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">
          Enter pickup and drop PIN codes to see estimated price
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-sm">Estimated Price</p>
            <p className="text-2xl font-bold text-white">
              {priceEstimate ? formatCurrency(priceEstimate.total_price) : '---'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-sm">Distance</p>
            <p className="text-lg font-semibold text-white">{distance || '--'} km</p>
          </div>
        </div>
        {priceEstimate && (
          <div className="mt-3 pt-3 border-t border-orange-500/20">
            <p className="text-sm text-orange-400">
              Advance Payment ({priceEstimate.advance_percent}%): {formatCurrency(priceEstimate.advance_amount)}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white">
        <Calculator className="h-5 w-5 text-orange-400" />
        <h3 className="font-semibold">Price Calculator</h3>
      </div>

      {/* Distance Info */}
      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-400" />
            <span className="text-slate-400 text-sm">{pickupLocation?.area || pickupLocation?.district}</span>
          </div>
          <Plane className="h-4 w-4 text-orange-400" />
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-400" />
            <span className="text-slate-400 text-sm">{dropLocation?.area || dropLocation?.district}</span>
          </div>
        </div>
        <p className="text-center text-white font-semibold mt-2">
          Distance: {distance} km
        </p>
      </div>

      {/* Waiting Time */}
      {showWaitingTime && (
        <div className="space-y-2">
          <Label className="text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-400" />
            Waiting Time (Hours)
          </Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={waitingHours}
            onChange={(e) => setWaitingHours(parseFloat(e.target.value) || 0)}
            className="bg-slate-900 border-slate-700 text-white"
          />
        </div>
      )}

      {/* Price Breakdown */}
      {priceEstimate && (
        <div className="p-4 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 space-y-3">
          <h4 className="text-white font-medium border-b border-slate-700 pb-2">Price Breakdown</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Base Price (up to 50 km)</span>
              <span className="text-white">{formatCurrency(priceEstimate.base_price)}</span>
            </div>
            
            {priceEstimate.distance_charge > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">
                  Distance Charge ({Math.round(distance - 50)} km × {formatCurrency(pricing?.rate_per_km_after_50 || 1000)}/km)
                </span>
                <span className="text-white">{formatCurrency(priceEstimate.distance_charge)}</span>
              </div>
            )}
            
            {priceEstimate.waiting_charge > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">
                  Waiting Charge ({waitingHours} hrs × {formatCurrency(pricing?.waiting_charge_per_hour || 5000)}/hr)
                </span>
                <span className="text-white">{formatCurrency(priceEstimate.waiting_charge)}</span>
              </div>
            )}
            
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-white">{formatCurrency(priceEstimate.subtotal)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-slate-400">GST ({priceEstimate.gst_percent}%)</span>
              <span className="text-white">{formatCurrency(priceEstimate.gst_amount)}</span>
            </div>
            
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span className="text-white font-semibold">Total Price</span>
              <span className="text-xl font-bold text-orange-400">{formatCurrency(priceEstimate.total_price)}</span>
            </div>
          </div>

          {/* Advance Payment */}
          <div className="mt-4 p-3 rounded-lg bg-orange-500/20 border border-orange-500/30">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-orange-400 font-medium">Advance Payment Required</p>
                <p className="text-slate-400 text-sm">({priceEstimate.advance_percent}% of total)</p>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(priceEstimate.advance_amount)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PriceCalculator;
