import React from 'react';
import { MapPin, Calendar, Clock, AlertCircle, Building2, TreePine, DollarSign } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import LandingPointSelector from '../shared/LandingPointSelector';

const RouteSelectionStep = ({ 
  formData, 
  onInputChange, 
  onLandingPointSelect,
  distanceKm,
  landingRent,
  permissionRequired 
}) => {
  return (
    <div className="space-y-6">
      {/* Pickup Location */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <Label className="text-white text-lg mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-green-400" />
          Pickup Location / पिकअप स्थान
        </Label>
        
        <LandingPointSelector
          type="pickup"
          selectedPoint={formData.pickup_landing_point}
          onSelect={(data) => onLandingPointSelect('pickup', data)}
          aircraftType={formData.aircraft_type}
        />

        {/* Show landing point details if selected */}
        {formData.pickup_landing_point && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {formData.pickup_landing_point.type === 'airport' && <Building2 className="h-4 w-4 text-blue-400" />}
              {formData.pickup_landing_point.type?.includes('helipad') && <Building2 className="h-4 w-4 text-purple-400" />}
              {formData.pickup_landing_point.type === 'village_land' && <TreePine className="h-4 w-4 text-green-400" />}
              <span className="text-white font-medium">{formData.pickup_landing_point.name}</span>
            </div>
            <p className="text-slate-400 text-sm">
              {formData.pickup_landing_point.city}, {formData.pickup_landing_point.state}
            </p>
            
            {/* Badges */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {formData.pickup_landing_point.rent_applicable && (
                <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Landing Rent
                </span>
              )}
              {formData.pickup_landing_point.permission_required && (
                <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Permission Required
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drop Location */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <Label className="text-white text-lg mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-400" />
          Drop Location / ड्रॉप स्थान
        </Label>
        
        <LandingPointSelector
          type="drop"
          selectedPoint={formData.drop_landing_point}
          onSelect={(data) => onLandingPointSelect('drop', data)}
          aircraftType={formData.aircraft_type}
        />

        {/* Show landing point details if selected */}
        {formData.drop_landing_point && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {formData.drop_landing_point.type === 'airport' && <Building2 className="h-4 w-4 text-blue-400" />}
              {formData.drop_landing_point.type?.includes('helipad') && <Building2 className="h-4 w-4 text-purple-400" />}
              {formData.drop_landing_point.type === 'village_land' && <TreePine className="h-4 w-4 text-green-400" />}
              <span className="text-white font-medium">{formData.drop_landing_point.name}</span>
            </div>
            <p className="text-slate-400 text-sm">
              {formData.drop_landing_point.city}, {formData.drop_landing_point.state}
            </p>
            
            {/* Badges */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {formData.drop_landing_point.rent_applicable && (
                <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Landing Rent
                </span>
              )}
              {formData.drop_landing_point.permission_required && (
                <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Permission Required
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Distance & Landing Rent Info */}
      {distanceKm > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Route Summary / मार्ग सारांश</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/50 rounded-lg text-center">
              <p className="text-slate-400 text-sm">Distance / दूरी</p>
              <p className="text-2xl font-bold text-white">{distanceKm} km</p>
            </div>
            
            {landingRent.total > 0 && (
              <div className="p-4 bg-slate-900/50 rounded-lg text-center">
                <p className="text-slate-400 text-sm">Landing Charges / लैंडिंग शुल्क</p>
                <p className="text-2xl font-bold text-yellow-400">₹{landingRent.total.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permission Warning */}
      {permissionRequired && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-orange-400 flex-shrink-0" />
            <div>
              <h4 className="text-orange-400 font-semibold">Permission Required / अनुमति आवश्यक</h4>
              <p className="text-orange-200/70 text-sm mt-1">
                Village/Private land landing requires additional permissions. You'll need to submit documents after booking confirmation.
              </p>
              <p className="text-orange-200/70 text-sm mt-1">
                गाँव/निजी भूमि पर उतरने के लिए अतिरिक्त अनुमति की आवश्यकता है। बुकिंग पुष्टि के बाद आपको दस्तावेज़ जमा करने होंगे।
              </p>
              <ul className="text-orange-200/70 text-sm mt-2 list-disc list-inside">
                <li>Collector NOC / कलेक्टर एनओसी</li>
                <li>Fire Department Acknowledgment / अग्निशमन विभाग की पावती</li>
                <li>Police Station NOC / पुलिस स्टेशन एनओसी</li>
                <li>SP/DCP Acknowledgment / SP/DCP की पावती</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Date & Time Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <Label className="text-white mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            Preferred Date / पसंदीदा तिथि
          </Label>
          <Input
            type="date"
            value={formData.preferred_date || ''}
            onChange={(e) => onInputChange('preferred_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="bg-slate-900 border-slate-600 text-white"
          />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <Label className="text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            Preferred Time / पसंदीदा समय
          </Label>
          <Input
            type="time"
            value={formData.preferred_time || ''}
            onChange={(e) => onInputChange('preferred_time', e.target.value)}
            className="bg-slate-900 border-slate-600 text-white"
          />
        </div>
      </div>
    </div>
  );
};

export default RouteSelectionStep;
