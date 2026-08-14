import React, { useState, useEffect } from 'react';
import { User, Users, Weight, Briefcase, CreditCard, FileText, Check, AlertCircle, Loader2, Baby, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { customerAPI } from '@/services/api';
import { toast } from 'sonner';

function PassengerDetailsForm({ inquiry, onComplete, onCancel }) {
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedPassenger, setExpandedPassenger] = useState(0);

  useEffect(() => {
    // Initialize passenger forms based on inquiry data
    const totalAdults = (inquiry?.adults_male || 0) + (inquiry?.adults_female || 0);
    const childrenCount = inquiry?.children_count || 0;
    
    const initialPassengers = [];
    
    // Add male adults
    for (let i = 0; i < (inquiry?.adults_male || 0); i++) {
      initialPassengers.push({
        type: 'adult',
        gender: 'male',
        name: '',
        age: '',
        weight_kg: '',
        luggage_count: 1,
        luggage_weight_kg: '',
        id_proof_type: '',
        id_proof_number: '',
      });
    }
    
    // Add female adults
    for (let i = 0; i < (inquiry?.adults_female || 0); i++) {
      initialPassengers.push({
        type: 'adult',
        gender: 'female',
        name: '',
        age: '',
        weight_kg: '',
        luggage_count: 1,
        luggage_weight_kg: '',
        id_proof_type: '',
        id_proof_number: '',
      });
    }
    
    // Add children
    for (let i = 0; i < childrenCount; i++) {
      initialPassengers.push({
        type: 'child',
        gender: '',
        name: '',
        age: '',
        weight_kg: '',
        luggage_count: 0,
        luggage_weight_kg: '0',
        id_proof_type: '',
        id_proof_number: '',
      });
    }
    
    setPassengers(initialPassengers);
  }, [inquiry]);

  const handlePassengerChange = (index, field, value) => {
    setPassengers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validatePassengers = () => {
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.name) {
        toast.error(`Passenger ${i + 1}: Name is required`);
        return false;
      }
      if (!p.age || p.age < 0) {
        toast.error(`Passenger ${i + 1}: Valid age is required`);
        return false;
      }
      if (p.type === 'adult' && (!p.weight_kg || p.weight_kg < 20)) {
        toast.error(`Passenger ${i + 1}: Weight is required (min 20kg)`);
        return false;
      }
      if (p.type === 'adult' && (!p.luggage_weight_kg && p.luggage_weight_kg !== 0)) {
        toast.error(`Passenger ${i + 1}: Luggage weight required`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validatePassengers()) return;
    
    setLoading(true);
    try {
      const response = await customerAPI.submitPassengerDetails(inquiry.id, {
        passengers: passengers,
        total_weight: passengers.reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0),
        total_luggage_weight: passengers.reduce((sum, p) => sum + (parseFloat(p.luggage_weight_kg) || 0), 0),
        total_luggage_count: passengers.reduce((sum, p) => sum + (parseInt(p.luggage_count) || 0), 0),
      });
      
      toast.success('✅ Passenger details saved!');
      onComplete?.(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save details');
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = passengers.reduce((sum, p) => sum + (parseFloat(p.weight_kg) || 0), 0);
  const totalLuggageWeight = passengers.reduce((sum, p) => sum + (parseFloat(p.luggage_weight_kg) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/30">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-orange-400" />
          Passenger Details</h2>
        <p className="text-slate-400 text-sm mt-1">
          Please fill details for all {passengers.length} passengers
        </p>
      </div>

      {/* Weight Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Total Passenger Weight</p>
          <p className="text-white text-2xl font-bold">{totalWeight} kg</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Total Luggage Weight</p>
          <p className="text-white text-2xl font-bold">{totalLuggageWeight} kg</p>
        </div>
      </div>

      {/* Passenger Forms */}
      <div className="space-y-4">
        {passengers.map((passenger, index) => (
          <div 
            key={index} 
            className={`bg-slate-800/50 rounded-xl border transition-all ${
              expandedPassenger === index ? 'border-orange-500' : 'border-slate-700'
            }`}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedPassenger(expandedPassenger === index ? -1 : index)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                {passenger.type === 'child' ? (
                  <Baby className="h-5 w-5 text-blue-400" />
                ) : passenger.gender === 'male' ? (
                  <User className="h-5 w-5 text-blue-400" />
                ) : (
                  <User className="h-5 w-5 text-pink-400" />
                )}
                <div>
                  <p className="text-white font-medium">
                    {passenger.name || `Passenger ${index + 1}`}
                    <span className="text-slate-400 text-sm ml-2">
                      ({passenger.type === 'child' ? 'Child' : 
                        passenger.gender === 'male' ? 'Male' : 'Female'})
                    </span>
                  </p>
                  {passenger.name && (
                    <p className="text-slate-400 text-sm">
                      {passenger.weight_kg}kg • {passenger.luggage_count} bag(s) • {passenger.luggage_weight_kg}kg luggage
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {passenger.name && passenger.weight_kg && (
                  <Check className="h-5 w-5 text-green-400" />
                )}
                {expandedPassenger === index ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Form */}
            {expandedPassenger === index && (
              <div className="p-4 pt-0 space-y-4 border-t border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Name */}
                  <div>
                    <Label className="text-slate-300">Full Name*</Label>
                    <Input
                      value={passenger.name}
                      onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                      placeholder="Enter full name"
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>

                  {/* Age */}
                  <div>
                    <Label className="text-slate-300">Age*</Label>
                    <Input
                      type="number"
                      value={passenger.age}
                      onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                      placeholder="Years"
                      min="0"
                      max="120"
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>

                  {/* Gender (for children) */}
                  {passenger.type === 'child' && (
                    <div>
                      <Label className="text-slate-300">Gender</Label>
                      <select
                        value={passenger.gender}
                        onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white mt-1"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  )}

                  {/* Weight */}
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Weight className="h-4 w-4" />
                      Weightkg) {passenger.type === 'adult' && '*'}
                    </Label>
                    <Input
                      type="number"
                      value={passenger.weight_kg}
                      onChange={(e) => handlePassengerChange(index, 'weight_kg', e.target.value)}
                      placeholder="Weight in kg"
                      min="5"
                      max="200"
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>

                  {/* Luggage Count */}
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Luggage Count</Label>
                    <select
                      value={passenger.luggage_count}
                      onChange={(e) => handlePassengerChange(index, 'luggage_count', e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white mt-1"
                    >
                      <option value="0">No Luggage</option>
                      <option value="1">1 Bag / 1</option>
                      <option value="2">2 Bags / 2</option>
                      <option value="3">3 Bags / 3</option>
                      <option value="4">4+ Bags / 4+</option>
                    </select>
                  </div>

                  {/* Luggage Weight */}
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2">
                      <Weight className="h-4 w-4" />
                      Luggage Weightkg) {passenger.type === 'adult' && '*'}
                    </Label>
                    <Input
                      type="number"
                      value={passenger.luggage_weight_kg}
                      onChange={(e) => handlePassengerChange(index, 'luggage_weight_kg', e.target.value)}
                      placeholder="Total luggage weight"
                      min="0"
                      max="100"
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>

                {/* ID Proof (Optional) */}
                <div className="border-t border-slate-700 pt-4 mt-4">
                  <p className="text-slate-400 text-sm mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ID Proof (Optional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">ID Type</Label>
                      <select
                        value={passenger.id_proof_type}
                        onChange={(e) => handlePassengerChange(index, 'id_proof_type', e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white mt-1"
                      >
                        <option value="">Select ID Type (Optional)</option>
                        <option value="aadhar">Aadhar Card</option>
                        <option value="passport">Passport</option>
                        <option value="driving_license">Driving License</option>
                        <option value="voter_id">Voter ID</option>
                        <option value="pan">PAN Card</option>
                      </select>
                    </div>
                    {passenger.id_proof_type && (
                      <div>
                        <Label className="text-slate-300">ID Number</Label>
                        <Input
                          value={passenger.id_proof_number}
                          onChange={(e) => handlePassengerChange(index, 'id_proof_number', e.target.value)}
                          placeholder="Enter ID number"
                          className="bg-slate-900 border-slate-600 text-white mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4 border-t border-slate-700">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 border-slate-600 text-slate-300"
        >
          Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Check className="h-4 w-4 mr-2" /> Save & Continue to Payment</>
          )}
        </Button>
      </div>
    </div>
  );
}

export default PassengerDetailsForm;
