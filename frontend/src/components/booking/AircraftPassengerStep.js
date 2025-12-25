import React from 'react';
import { Plane, Users, User, Baby, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// Aircraft types configuration
export const aircraftTypes = [
  { id: 'helicopter', name: 'Helicopter / हेलीकॉप्टर', icon: '🚁', maxPassengers: 6 },
  { id: 'chartered_plane', name: 'Chartered Plane / चार्टर्ड प्लेन', icon: '✈️', maxPassengers: 19 },
];

const AircraftPassengerStep = ({ formData, onInputChange }) => {
  // Calculate max passengers based on aircraft type
  const maxPassengers = formData.aircraft_type === 'chartered_plane' ? 19 : 6;
  const totalAdults = parseInt(formData.adults_male || 0) + parseInt(formData.adults_female || 0);
  
  const handlePassengerChange = (field, delta) => {
    const current = parseInt(formData[field] || 0);
    const newValue = Math.max(0, current + delta);
    
    // Validate totals
    if (field === 'adults_male' || field === 'adults_female') {
      const otherField = field === 'adults_male' ? 'adults_female' : 'adults_male';
      const otherValue = parseInt(formData[otherField] || 0);
      if (newValue + otherValue > maxPassengers) return;
      if (newValue + otherValue < 1) return; // At least 1 adult
    }
    
    if (field === 'children_count') {
      if (newValue > 2) return; // Max 2 children
    }
    
    onInputChange(field, newValue);
  };

  return (
    <div className="space-y-6">
      {/* Aircraft Type Selection */}
      <div>
        <Label className="text-white text-lg mb-4 block">Select Aircraft Type / वाहन प्रकार चुनें</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aircraftTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onInputChange('aircraft_type', type.id)}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                formData.aircraft_type === type.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className="text-4xl mb-3">{type.icon}</div>
              <h3 className="text-white font-semibold text-lg">{type.name}</h3>
              <p className="text-slate-400 text-sm mt-1">Max {type.maxPassengers} passengers</p>
            </button>
          ))}
        </div>
      </div>

      {/* Passenger Count */}
      {formData.aircraft_type && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-400" />
            Passengers / यात्री
          </h3>
          
          <div className="space-y-4">
            {/* Male Adults */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-white">Adult Male / पुरुष</p>
                  <p className="text-slate-500 text-xs">18+ years</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600"
                  onClick={() => handlePassengerChange('adults_male', -1)}
                  disabled={formData.adults_male <= 0 || totalAdults <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-white font-bold w-8 text-center">{formData.adults_male || 0}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600"
                  onClick={() => handlePassengerChange('adults_male', 1)}
                  disabled={totalAdults >= maxPassengers}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Female Adults */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-pink-400" />
                <div>
                  <p className="text-white">Adult Female / महिला</p>
                  <p className="text-slate-500 text-xs">18+ years</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600"
                  onClick={() => handlePassengerChange('adults_female', -1)}
                  disabled={formData.adults_female <= 0 || totalAdults <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-white font-bold w-8 text-center">{formData.adults_female || 0}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600"
                  onClick={() => handlePassengerChange('adults_female', 1)}
                  disabled={totalAdults >= maxPassengers}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Children */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Baby className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-white">Children / बच्चे</p>
                  <p className="text-slate-500 text-xs">Up to 4 years (Free, max 2)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600"
                  onClick={() => handlePassengerChange('children_count', -1)}
                  disabled={formData.children_count <= 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-white font-bold w-8 text-center">{formData.children_count || 0}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600"
                  onClick={() => handlePassengerChange('children_count', 1)}
                  disabled={formData.children_count >= 2}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-4 p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
            <p className="text-orange-400 text-sm">
              <strong>Total:</strong> {totalAdults} Adult(s) + {formData.children_count || 0} Child(ren)
              <span className="text-slate-400 ml-2">({maxPassengers - totalAdults} seats available)</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AircraftPassengerStep;
