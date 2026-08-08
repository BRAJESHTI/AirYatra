import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  IndianRupee, Plane, MapPin, Clock, Users, Fuel, 
  Shield, Percent, Receipt, Info, Zap, AlertCircle,
  CheckCircle, TrendingDown
} from 'lucide-react';

/**
 * Dynamic Pricing Breakdown Component
 * Shows detailed fare structure as per aviation pricing requirements
 */
const PricingBreakdown = ({ 
  pricing, 
  routeInfo,
  showRepositioning = true,
  showDiscount = true,
  compact = false,
  className = ""
}) => {
  if (!pricing) return null;

  const {
    base_fare = 0,
    repositioning_charge = 0,
    landing_charges = 0,
    handling_charges = 0,
    crew_charges = 0,
    fuel_surcharge = 0,
    commission = 0,
    commission_rate = 10,
    gst_amount = 0,
    gst_rate = 18,
    discount_amount = 0,
    discount_code = null,
    total_amount = 0,
    savings = 0,
    per_seat_price = 0,
    hourly_rate = 0,
    flight_hours = 0,
  } = pricing;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Calculate subtotal
  const subtotal = base_fare + repositioning_charge + landing_charges + handling_charges + crew_charges + fuel_surcharge;

  if (compact) {
    return (
      <div className={`bg-slate-800/50 rounded-lg p-4 ${className}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-400">Base Fare</span>
          <span className="text-white">{formatCurrency(base_fare)}</span>
        </div>
        {repositioning_charge > 0 && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-400" />
              Repositioning
            </span>
            <span className="text-yellow-400">{formatCurrency(repositioning_charge)}</span>
          </div>
        )}
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-400">Taxes & Fees</span>
          <span className="text-white">{formatCurrency(gst_amount + commission)}</span>
        </div>
        {discount_amount > 0 && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-green-400 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Discount
            </span>
            <span className="text-green-400">-{formatCurrency(discount_amount)}</span>
          </div>
        )}
        <Separator className="my-2 bg-slate-700" />
        <div className="flex justify-between items-center">
          <span className="text-white font-bold text-lg">Total</span>
          <span className="text-orange-400 font-bold text-xl">{formatCurrency(total_amount)}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className={`bg-slate-900 border-slate-700 ${className}`} data-testid="pricing-breakdown">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="h-5 w-5 text-orange-400" />
          Fare Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Route Info */}
        {routeInfo && (
          <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-orange-400" />
              <span className="text-white font-medium">
                {routeInfo.from} → {routeInfo.to}
              </span>
              {routeInfo.distance && (
                <Badge variant="outline" className="ml-auto">
                  {routeInfo.distance} km
                </Badge>
              )}
            </div>
            {(flight_hours > 0 || routeInfo.duration) && (
              <div className="flex items-center gap-2 text-sm mt-1">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-slate-400">
                  Est. {flight_hours || routeInfo.duration} hrs
                </span>
              </div>
            )}
          </div>
        )}

        {/* Base Fare Section */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Base Charges</h4>
          
          <div className="flex justify-between items-center py-2">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-blue-400" />
              <span className="text-white">Base Fare</span>
              {hourly_rate > 0 && (
                <span className="text-xs text-slate-500">
                  ({formatCurrency(hourly_rate)}/hr × {flight_hours}hrs)
                </span>
              )}
            </div>
            <span className="text-white font-medium">{formatCurrency(base_fare)}</span>
          </div>

          {repositioning_charge > 0 && showRepositioning && (
            <div className="flex justify-between items-center py-2 bg-yellow-500/10 rounded-lg px-3 -mx-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                <div>
                  <span className="text-yellow-400">Repositioning Charge</span>
                  <p className="text-xs text-yellow-400/70">Aircraft will reposition from another location</p>
                </div>
              </div>
              <span className="text-yellow-400 font-medium">{formatCurrency(repositioning_charge)}</span>
            </div>
          )}

          {landing_charges > 0 && (
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="text-slate-300">Landing Charges</span>
              </div>
              <span className="text-white">{formatCurrency(landing_charges)}</span>
            </div>
          )}

          {handling_charges > 0 && (
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-slate-300">Ground Handling</span>
              </div>
              <span className="text-white">{formatCurrency(handling_charges)}</span>
            </div>
          )}

          {crew_charges > 0 && (
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" />
                <span className="text-slate-300">Crew Charges</span>
              </div>
              <span className="text-white">{formatCurrency(crew_charges)}</span>
            </div>
          )}

          {fuel_surcharge > 0 && (
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Fuel className="h-4 w-4 text-slate-400" />
                <span className="text-slate-300">Fuel Surcharge</span>
              </div>
              <span className="text-white">{formatCurrency(fuel_surcharge)}</span>
            </div>
          )}
        </div>

        <Separator className="bg-slate-700" />

        {/* Subtotal */}
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Subtotal</span>
          <span className="text-white font-medium">{formatCurrency(subtotal)}</span>
        </div>

        {/* Taxes & Fees */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Taxes & Fees</h4>
          
          <div className="flex justify-between items-center py-2">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-slate-400" />
              <span className="text-slate-300">AirYatra Service Fee ({commission_rate}%)</span>
            </div>
            <span className="text-white">{formatCurrency(commission)}</span>
          </div>

          <div className="flex justify-between items-center py-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-400" />
              <span className="text-slate-300">GST @ {gst_rate}%</span>
            </div>
            <span className="text-white">{formatCurrency(gst_amount)}</span>
          </div>
        </div>

        {/* Discount */}
        {discount_amount > 0 && showDiscount && (
          <>
            <Separator className="bg-slate-700" />
            <div className="flex justify-between items-center py-2 bg-green-500/10 rounded-lg px-3 -mx-1">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-green-400" />
                <div>
                  <span className="text-green-400">Discount Applied</span>
                  {discount_code && (
                    <p className="text-xs text-green-400/70">Code: {discount_code}</p>
                  )}
                </div>
              </div>
              <span className="text-green-400 font-medium">-{formatCurrency(discount_amount)}</span>
            </div>
          </>
        )}

        <Separator className="bg-slate-700" />

        {/* Total */}
        <div className="flex justify-between items-center pt-2">
          <div>
            <span className="text-white font-bold text-lg">Total Payable</span>
            {per_seat_price > 0 && (
              <p className="text-xs text-slate-500">{formatCurrency(per_seat_price)} per seat</p>
            )}
          </div>
          <div className="text-right">
            <span className="text-orange-400 font-bold text-2xl">{formatCurrency(total_amount)}</span>
            {savings > 0 && (
              <p className="text-xs text-green-400">You save {formatCurrency(savings)}</p>
            )}
          </div>
        </div>

        {/* Info Note */}
        <div className="flex items-start gap-2 bg-blue-500/10 rounded-lg p-3 text-xs">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-blue-300">
            Final amount includes all applicable taxes. Prices may vary based on availability and demand. 
            Cancellation charges apply as per our refund policy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Smart Repositioning Message Component
 */
export const RepositioningAlert = ({ 
  isRepositioning, 
  fromCity, 
  charge,
  alternativeAvailable = false,
  alternativeAircraft = null,
  onSelectAlternative
}) => {
  if (!isRepositioning) return null;

  return (
    <div className="space-y-3" data-testid="repositioning-alert">
      {/* Current Repositioning */}
      <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <Zap className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-yellow-400 font-medium">Aircraft Repositioning Required</p>
          <p className="text-yellow-400/80 text-sm mt-1">
            This aircraft will reposition from <strong>{fromCity}</strong>. 
            Additional charges of <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(charge)}</strong> apply.
          </p>
        </div>
      </div>

      {/* Alternative Option */}
      {alternativeAvailable && alternativeAircraft && (
        <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-green-400 font-medium">Local Aircraft Available</p>
            <p className="text-green-400/80 text-sm mt-1">
              <strong>{alternativeAircraft.name}</strong> is available at your pickup location. 
              No repositioning charges!
            </p>
            {onSelectAlternative && (
              <button 
                onClick={() => onSelectAlternative(alternativeAircraft)}
                className="mt-2 text-sm text-green-400 hover:text-green-300 underline"
              >
                Select this aircraft instead →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Price Comparison Badge
 */
export const PriceComparisonBadge = ({ currentPrice, marketAverage, showSavings = true }) => {
  if (!marketAverage) return null;
  
  const difference = marketAverage - currentPrice;
  const percentDiff = Math.round((difference / marketAverage) * 100);
  const isBelowAverage = difference > 0;

  return (
    <div className="inline-flex items-center gap-2">
      {isBelowAverage ? (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <TrendingDown className="h-3 w-3 mr-1" />
          {percentDiff}% below market
        </Badge>
      ) : (
        <Badge className="bg-slate-700 text-slate-400">
          <Info className="h-3 w-3 mr-1" />
          Market price
        </Badge>
      )}
      {showSavings && isBelowAverage && (
        <span className="text-xs text-green-400">
          Save {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(difference)}
        </span>
      )}
    </div>
  );
};

export default PricingBreakdown;
