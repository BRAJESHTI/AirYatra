import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  IndianRupee, Info, Clock, Shield, CheckCircle, AlertTriangle,
  Plane, MapPin, Users, Calendar, Receipt, Lock, ChevronDown, ChevronUp
} from 'lucide-react';

// ============ CUSTOMER PRICE BREAKUP COMPONENT ============
// Shows transparent pricing WITHOUT revealing platform commission to customers

export const CustomerPriceBreakup = ({ 
  basePrice = 0,
  landingCharges = 0,
  handlingCharges = 0,
  crewCharges = 0,
  fuelSurcharge = 0,
  otherCharges = 0,
  discount = 0,
  voucherDiscount = 0,
  walletUsed = 0,
  platformFee = 0, // This is calculated but displayed as "Service Fee"
  gstRate = 18,
  gstAmount = 0,
  grandTotal = 0,
  currency = 'INR',
  priceLockMinutes = 15,
  showDetailedBreakup = true,
  bookingType = 'one_way',
  route = null,
  passengers = 1
}) => {
  const [isExpanded, setIsExpanded] = useState(showDetailedBreakup);
  
  // Calculate subtotal
  const subtotal = basePrice + landingCharges + handlingCharges + crewCharges + fuelSurcharge + otherCharges;
  const totalDiscount = discount + voucherDiscount + walletUsed;
  const afterDiscount = subtotal - totalDiscount;
  
  // Booking type labels
  const bookingTypeLabels = {
    one_way: 'One Way / एकतरफा',
    round_trip: 'Round Trip / वापसी यात्रा',
    multi_city: 'Multi-City / बहु-शहर',
    hourly_charter: 'Hourly Charter / प्रति घंटा',
    daily_charter: 'Daily Charter / दैनिक',
    multi_day: 'Multi-Day / बहु-दिवसीय',
    group_booking: 'Group Booking / समूह बुकिंग',
    emergency: 'Emergency / आपातकालीन',
    event_based: 'Event Package / इवेंट पैकेज'
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Receipt className="h-5 w-5 text-orange-400" />
          Price Breakup / मूल्य विवरण
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Badge variant="outline" className="text-orange-400 border-orange-400">
            {bookingTypeLabels[bookingType] || bookingType}
          </Badge>
          {route && (
            <span className="text-slate-400">
              <MapPin className="h-3 w-3 inline mr-1" />
              {route.from} → {route.to}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Card */}
        <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/10 rounded-lg p-4 border border-orange-500/30">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-400 text-sm">Total Amount / कुल राशि</p>
              <p className="text-3xl font-bold text-white">
                ₹{grandTotal.toLocaleString('en-IN')}
              </p>
              {totalDiscount > 0 && (
                <p className="text-green-400 text-sm">
                  You save ₹{totalDiscount.toLocaleString('en-IN')}! 🎉
                </p>
              )}
            </div>
            <div className="text-right">
              <Badge className="bg-green-500/20 text-green-400 mb-2">
                <Shield className="h-3 w-3 mr-1" /> Verified Pricing
              </Badge>
              <p className="text-slate-400 text-xs">
                <Users className="h-3 w-3 inline mr-1" />
                {passengers} passenger{passengers > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        
        {/* Expandable Detailed Breakup */}
        <div className="border border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition-colors"
          >
            <span className="text-white font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-orange-400" />
              View Detailed Breakup / विस्तृत विवरण देखें
            </span>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>
          
          {isExpanded && (
            <div className="p-4 space-y-3">
              {/* Base Fare */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-slate-400" />
                  <span className="text-white">Base Fare / आधार किराया</span>
                </div>
                <span className="text-white font-medium">₹{basePrice.toLocaleString('en-IN')}</span>
              </div>
              
              {/* Landing Charges */}
              {landingCharges > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300">Landing Charges / लैंडिंग शुल्क</span>
                  </div>
                  <span className="text-slate-300">₹{landingCharges.toLocaleString('en-IN')}</span>
                </div>
              )}
              
              {/* Handling Charges */}
              {handlingCharges > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">Handling Charges / हैंडलिंग शुल्क</span>
                  <span className="text-slate-300">₹{handlingCharges.toLocaleString('en-IN')}</span>
                </div>
              )}
              
              {/* Crew Charges */}
              {crewCharges > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300">Crew Charges / क्रू शुल्क</span>
                  </div>
                  <span className="text-slate-300">₹{crewCharges.toLocaleString('en-IN')}</span>
                </div>
              )}
              
              {/* Fuel Surcharge */}
              {fuelSurcharge > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">Fuel Surcharge / ईंधन अधिभार</span>
                  <span className="text-slate-300">₹{fuelSurcharge.toLocaleString('en-IN')}</span>
                </div>
              )}
              
              {/* Other Charges */}
              {otherCharges > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">Other Charges / अन्य शुल्क</span>
                  <span className="text-slate-300">₹{otherCharges.toLocaleString('en-IN')}</span>
                </div>
              )}
              
              {/* Subtotal Line */}
              <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                <span className="text-slate-400">Subtotal / उप-योग</span>
                <span className="text-white">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              
              {/* Discounts Section */}
              {totalDiscount > 0 && (
                <>
                  {discount > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-400">
                      <span>Discount / छूट</span>
                      <span>- ₹{discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-400">
                      <span>Voucher Discount / वाउचर छूट</span>
                      <span>- ₹{voucherDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {walletUsed > 0 && (
                    <div className="flex justify-between items-center text-sm text-green-400">
                      <span>Wallet Used / वॉलेट</span>
                      <span>- ₹{walletUsed.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </>
              )}
              
              {/* Service Fee (Platform Fee - NOT labeled as commission) */}
              {platformFee > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">Service Fee / सेवा शुल्क</span>
                    <span className="text-xs text-slate-500">(includes booking & support)</span>
                  </div>
                  <span className="text-slate-300">₹{platformFee.toLocaleString('en-IN')}</span>
                </div>
              )}
              
              {/* GST */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300">GST ({gstRate}%)</span>
                <span className="text-slate-300">₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>
              
              {/* Grand Total */}
              <div className="border-t-2 border-orange-500/50 pt-3 flex justify-between items-center">
                <span className="text-white font-semibold text-lg">Grand Total / कुल राशि</span>
                <span className="text-orange-400 font-bold text-xl">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Price Lock Timer */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Lock className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-blue-400 font-medium text-sm">Price Lock / मूल्य लॉक</p>
            <p className="text-slate-400 text-xs">
              Price locked for {priceLockMinutes} minutes. Complete payment to confirm.
            </p>
          </div>
          <div className="text-right">
            <div className="bg-blue-500/20 rounded-lg px-3 py-1">
              <span className="text-blue-400 font-mono font-bold">{priceLockMinutes}:00</span>
            </div>
          </div>
        </div>
        
        {/* Trust Indicators */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="outline" className="text-green-400 border-green-400/50">
            <CheckCircle className="h-3 w-3 mr-1" /> No Hidden Charges
          </Badge>
          <Badge variant="outline" className="text-green-400 border-green-400/50">
            <Shield className="h-3 w-3 mr-1" /> Secure Payment
          </Badge>
          <Badge variant="outline" className="text-green-400 border-green-400/50">
            <Clock className="h-3 w-3 mr-1" /> Instant Confirmation
          </Badge>
        </div>
        
        {/* Note */}
        <p className="text-slate-500 text-xs flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          All prices are in Indian Rupees (₹). GST as applicable. Final amount may vary based on 
          actual flight duration and additional services requested.
        </p>
      </CardContent>
    </Card>
  );
};

// ============ BOOKING TYPE SELECTOR ============

export const BookingTypeSelector = ({ selected, onSelect }) => {
  const bookingTypes = [
    { key: 'one_way', label: 'One Way', labelHi: 'एकतरफा', icon: '→', desc: 'A to B' },
    { key: 'round_trip', label: 'Round Trip', labelHi: 'वापसी', icon: '↔', desc: 'A to B to A', discount: '5-10%' },
    { key: 'multi_city', label: 'Multi-City', labelHi: 'बहु-शहर', icon: '◇', desc: 'Multiple stops' },
    { key: 'hourly_charter', label: 'Hourly', labelHi: 'प्रति घंटा', icon: '⏱', desc: 'By the hour' },
    { key: 'daily_charter', label: 'Daily', labelHi: 'दैनिक', icon: '📅', desc: 'Full day' },
    { key: 'multi_day', label: 'Multi-Day', labelHi: 'बहु-दिवसीय', icon: '📆', desc: '3+ days', discount: '10-15%' },
    { key: 'group_booking', label: 'Group', labelHi: 'समूह', icon: '👥', desc: '5+ passengers', discount: 'Special' },
    { key: 'emergency', label: 'Emergency', labelHi: 'आपात', icon: '🚨', desc: 'Urgent booking', priority: true },
    { key: 'event_based', label: 'Event', labelHi: 'इवेंट', icon: '🎉', desc: 'Wedding/Corporate' }
  ];
  
  return (
    <div className="space-y-3">
      <label className="text-white font-medium">
        Booking Type / बुकिंग प्रकार
      </label>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {bookingTypes.map(type => (
          <button
            key={type.key}
            type="button"
            onClick={() => onSelect(type.key)}
            className={`p-3 rounded-lg border text-center transition-all ${
              selected === type.key
                ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-orange-500/50'
            }`}
          >
            <span className="text-2xl block mb-1">{type.icon}</span>
            <span className="text-xs font-medium block">{type.label}</span>
            <span className="text-xs text-slate-500 block">{type.labelHi}</span>
            {type.discount && (
              <Badge className="mt-1 bg-green-500/20 text-green-400 text-xs">
                {type.discount} off
              </Badge>
            )}
            {type.priority && (
              <Badge className="mt-1 bg-red-500/20 text-red-400 text-xs">
                Priority
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CustomerPriceBreakup;
