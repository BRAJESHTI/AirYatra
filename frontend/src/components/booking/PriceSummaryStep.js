import React from 'react';
import { Calculator, Plane, MapPin, Users, DollarSign, Shield, Check, AlertCircle } from 'lucide-react';

const PriceSummaryStep = ({ 
  formData, 
  priceEstimate, 
  landingRent,
  distanceKm,
  permissionRequired 
}) => {
  if (!priceEstimate) {
    return (
      <div className="text-center py-12">
        <Calculator className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">Calculating price... / मूल्य गणना हो रही है...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Price Breakdown Card */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-green-400" />
          Price Estimate / मूल्य अनुमान
        </h3>

        <div className="space-y-3">
          {/* Base Fare */}
          <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
            <span className="text-slate-300">Base Fare / आधार किराया</span>
            <span className="text-white font-medium">₹{priceEstimate.basePrice?.toLocaleString()}</span>
          </div>

          {/* Distance Charge */}
          <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
            <span className="text-slate-300">Distance ({distanceKm} km) / दूरी</span>
            <span className="text-white font-medium">₹{priceEstimate.kmPrice?.toLocaleString()}</span>
          </div>

          {/* Landing Charges */}
          {landingRent.total > 0 && (
            <div className="flex justify-between items-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <span className="text-yellow-300 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Landing Charges / लैंडिंग शुल्क
              </span>
              <span className="text-yellow-400 font-medium">₹{landingRent.total.toLocaleString()}</span>
            </div>
          )}

          {/* GST */}
          <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
            <span className="text-slate-300">GST (18%)</span>
            <span className="text-white font-medium">₹{priceEstimate.gst?.toLocaleString()}</span>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700 my-2"></div>

          {/* Total */}
          <div className="flex justify-between items-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <span className="text-green-300 font-semibold text-lg">Total / कुल</span>
            <span className="text-green-400 font-bold text-2xl">₹{priceEstimate.total?.toLocaleString()}</span>
          </div>
        </div>

        <p className="text-slate-500 text-xs mt-4">
          * This is an estimate. Final price may vary based on operator quotes.
          / यह एक अनुमान है। अंतिम मूल्य ऑपरेटर के कोटेशन पर निर्भर हो सकता है।
        </p>
      </div>

      {/* Booking Summary Card */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold text-lg mb-4">Booking Summary / बुकिंग सारांश</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Aircraft */}
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
            <Plane className="h-5 w-5 text-orange-400" />
            <div>
              <p className="text-slate-400 text-xs">Aircraft</p>
              <p className="text-white">{formData.aircraft_type === 'helicopter' ? 'Helicopter' : 'Chartered Plane'}</p>
            </div>
          </div>

          {/* Passengers */}
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
            <Users className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-slate-400 text-xs">Passengers</p>
              <p className="text-white">
                {(parseInt(formData.adults_male || 0) + parseInt(formData.adults_female || 0))} Adults
                {formData.children_count > 0 && ` + ${formData.children_count} Children`}
              </p>
            </div>
          </div>

          {/* Pickup */}
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
            <MapPin className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-slate-400 text-xs">Pickup</p>
              <p className="text-white truncate">{formData.pickup_landing_point?.name || formData.pickup_location}</p>
            </div>
          </div>

          {/* Drop */}
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
            <MapPin className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-slate-400 text-xs">Drop</p>
              <p className="text-white truncate">{formData.drop_landing_point?.name || formData.drop_location}</p>
            </div>
          </div>

          {/* Date */}
          {formData.preferred_date && (
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
              <div className="h-5 w-5 text-purple-400">📅</div>
              <div>
                <p className="text-slate-400 text-xs">Date</p>
                <p className="text-white">{new Date(formData.preferred_date).toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          )}

          {/* Time */}
          {formData.preferred_time && (
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
              <div className="h-5 w-5 text-cyan-400">⏰</div>
              <div>
                <p className="text-slate-400 text-xs">Time</p>
                <p className="text-white">{formData.preferred_time}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Permission Required Warning */}
      {permissionRequired && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-orange-400 flex-shrink-0" />
            <div>
              <h4 className="text-orange-400 font-semibold">Documents Required / दस्तावेज़ आवश्यक</h4>
              <p className="text-orange-200/70 text-sm mt-1">
                After booking confirmation, you'll need to upload permission documents for village/private landing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Terms Checkbox */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-400 flex-shrink-0 mt-1" />
          <div>
            <p className="text-white font-medium">Safety & Terms</p>
            <p className="text-slate-400 text-sm mt-1">
              By submitting this inquiry, you agree to our terms of service and safety guidelines.
              Your inquiry will be sent to multiple operators for competitive quotes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceSummaryStep;
