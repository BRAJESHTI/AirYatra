import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, RefreshCw, Route, Clock, Calendar, CalendarRange,
  Users, AlertTriangle, PartyPopper, CheckCircle, Info, IndianRupee
} from 'lucide-react';
import { bookingTypes } from './bookingConfig';

/**
 * Booking Type Selector Component
 * Displays 9 booking types with dynamic pricing adjustments
 */
export const BookingTypeSelector = ({ 
  selected, 
  onSelect, 
  basePrice = 0,
  passengerCount = 1,
  showPriceImpact = true,
  className = ''
}) => {
  const [hoveredType, setHoveredType] = useState(null);
  
  // Calculate adjusted price for a booking type
  const calculateAdjustedPrice = (bookingType) => {
    if (!basePrice) return null;
    const type = bookingTypes.find(t => t.value === bookingType);
    if (!type) return basePrice;
    return Math.round(basePrice * type.multiplier);
  };
  
  // Check if type is available based on constraints
  const isTypeAvailable = (type) => {
    if (type.minPassengers && passengerCount < type.minPassengers) {
      return false;
    }
    return true;
  };
  
  // Get icon component for booking type
  const getTypeIcon = (value) => {
    switch (value) {
      case 'one_way': return ArrowRight;
      case 'round_trip': return RefreshCw;
      case 'multi_city': return Route;
      case 'hourly_charter': return Clock;
      case 'daily_charter': return Calendar;
      case 'multi_day': return CalendarRange;
      case 'group_booking': return Users;
      case 'emergency': return AlertTriangle;
      case 'event_based': return PartyPopper;
      default: return ArrowRight;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-white font-medium flex items-center gap-2">
          <Route className="h-5 w-5 text-orange-400" />
          Booking Type
        </label>
        {selected && (
          <Badge className="bg-green-500/20 text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            {bookingTypes.find(t => t.value === selected)?.label || selected}
          </Badge>
        )}
      </div>
      
      {/* Booking Type Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {bookingTypes.map(type => {
          const Icon = getTypeIcon(type.value);
          const isSelected = selected === type.value;
          const isAvailable = isTypeAvailable(type);
          const isSaving = type.multiplier < 1.0;
          
          return (
            <button
              key={type.value}
              type="button"
              data-testid={`booking-type-${type.value}`}
              onClick={() => isAvailable && onSelect(type.value)}
              onMouseEnter={() => setHoveredType(type.value)}
              onMouseLeave={() => setHoveredType(null)}
              disabled={!isAvailable}
              className={`relative p-4 rounded-xl border text-left transition-all duration-200 flex flex-col gap-2 min-h-[110px] ${
                isSelected
                  ? 'bg-gradient-to-br from-orange-500/25 to-orange-500/5 border-orange-500 shadow-lg shadow-orange-500/20'
                  : isAvailable
                    ? 'bg-slate-800 border-slate-700 hover:border-orange-500/60 hover:bg-slate-700/70 hover:-translate-y-0.5'
                    : 'bg-slate-900 border-slate-800 cursor-not-allowed opacity-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  isSelected
                    ? 'bg-orange-500 text-white'
                    : type.priority
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-slate-700 text-orange-400'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                {isSelected && (
                  <CheckCircle className="h-5 w-5 text-orange-400" />
                )}
              </div>
              
              <span className={`text-sm font-semibold leading-tight ${
                isSelected ? 'text-orange-300' : 'text-white'
              }`}>
                {type.label}
              </span>
              
              {/* Discount/Surcharge Badge */}
              {type.discountHint && (
                <Badge 
                  className={`w-fit text-[10px] px-1.5 py-0 ${
                    isSaving 
                      ? 'bg-green-500/20 text-green-400' 
                      : type.priority 
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {type.discountHint}
                </Badge>
              )}
              
              {/* Min Passengers Warning */}
              {!isAvailable && type.minPassengers && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 rounded-xl">
                  <span className="text-[11px] font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1">
                    Needs {type.minPassengers}+ passengers
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Selected Type Details */}
      {selected && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          {(() => {
            const type = bookingTypes.find(t => t.value === selected);
            if (!type) return null;
            const Icon = getTypeIcon(type.value);
            const adjustedPrice = calculateAdjustedPrice(selected);
            
            return (
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                  type.priority ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold">
                    {type.label}
                  </h4>
                  <p className="text-slate-400 text-sm mt-1">
                    {type.description}
                  </p>
                  
                  {/* Constraints */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {type.minHours && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" /> Min {type.minHours} hours
                      </Badge>
                    )}
                    {type.minDays && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" /> Min {type.minDays} days
                      </Badge>
                    )}
                    {type.minPassengers && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" /> Min {type.minPassengers} passengers
                      </Badge>
                    )}
                    {type.customQuote && (
                      <Badge variant="outline" className="text-blue-400 border-blue-400/50 text-xs">
                        <Info className="h-3 w-3 mr-1" /> Custom Quote
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Price Impact */}
                {showPriceImpact && basePrice > 0 && !type.customQuote && (
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Estimated Price</p>
                    <p className="text-xl font-bold text-white">
                      ₹{adjustedPrice?.toLocaleString('en-IN')}
                    </p>
                    {type.multiplier !== 1.0 && (
                      <Badge className={`mt-1 ${
                        type.multiplier < 1.0 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {type.multiplier < 1.0 
                          ? `${Math.round((1 - type.multiplier) * 100)}% off` 
                          : `+${Math.round((type.multiplier - 1) * 100)}%`}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Helper Text */}
      <p className="text-xs text-slate-500 flex items-start gap-1">
        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
        Select your booking type. Prices adjust based on duration, group size, and urgency.
      </p>
    </div>
  );
};

/**
 * Compact Booking Type Pills - for summary views
 */
export const BookingTypePill = ({ type, showPrice = false, basePrice = 0 }) => {
  const typeData = bookingTypes.find(t => t.value === type);
  if (!typeData) return null;
  
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
      <span className="text-lg">{typeData.icon}</span>
      <span className="text-sm text-white font-medium">{typeData.label}</span>
      {showPrice && basePrice > 0 && (
        <Badge className="bg-green-500/20 text-green-400 text-xs">
          ₹{Math.round(basePrice * typeData.multiplier).toLocaleString('en-IN')}
        </Badge>
      )}
    </div>
  );
};

export default BookingTypeSelector;
