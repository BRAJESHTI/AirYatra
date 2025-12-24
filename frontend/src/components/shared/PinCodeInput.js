import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pincodeAPI } from '../../services/api';

function PinCodeInput({ 
  label, 
  value, 
  onChange, 
  onLocationSelect,
  placeholder = "Enter 6-digit PIN code",
  required = false,
  className = ""
}) {
  const [pincode, setPincode] = useState(value || '');
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [error, setError] = useState(null);
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');

  useEffect(() => {
    if (value !== pincode) {
      setPincode(value || '');
    }
  }, [value]);

  const handlePincodeChange = async (e) => {
    const newPincode = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(newPincode);
    onChange?.(newPincode);
    
    setError(null);
    setLocationData(null);
    setAreas([]);
    
    if (newPincode.length === 6) {
      setLoading(true);
      try {
        const response = await pincodeAPI.lookup(newPincode);
        if (response.data.success) {
          setLocationData({
            state: response.data.state,
            district: response.data.district,
            latitude: response.data.latitude,
            longitude: response.data.longitude
          });
          setAreas(response.data.locations || []);
          
          // Auto-select first area
          if (response.data.locations?.length > 0) {
            const firstArea = response.data.locations[0];
            setSelectedArea(firstArea.area);
            onLocationSelect?.({
              pincode: newPincode,
              state: response.data.state,
              district: response.data.district,
              area: firstArea.area,
              latitude: response.data.latitude,
              longitude: response.data.longitude
            });
          }
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid PIN code');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAreaChange = (e) => {
    const area = e.target.value;
    setSelectedArea(area);
    
    if (locationData) {
      onLocationSelect?.({
        pincode,
        state: locationData.state,
        district: locationData.district,
        area: area,
        latitude: locationData.latitude,
        longitude: locationData.longitude
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* PIN Code Input */}
      <div className="space-y-2">
        <Label className="text-white">{label}</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <Input
            type="text"
            value={pincode}
            onChange={handlePincodeChange}
            placeholder={placeholder}
            required={required}
            maxLength={6}
            className="pl-10 pr-10 bg-slate-900 border-slate-700 text-white"
          />
          <div className="absolute right-3 top-3">
            {loading && <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />}
            {!loading && locationData && <Check className="h-5 w-5 text-green-400" />}
            {!loading && error && <X className="h-5 w-5 text-red-400" />}
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {/* Auto-filled Location Data */}
      {locationData && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-slate-400 text-sm">State</Label>
            <Input
              value={locationData.state}
              readOnly
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400 text-sm">District</Label>
            <Input
              value={locationData.district}
              readOnly
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>
      )}

      {/* Area Selection */}
      {areas.length > 0 && (
        <div className="space-y-2">
          <Label className="text-slate-400 text-sm">Area / Village</Label>
          <select
            value={selectedArea}
            onChange={handleAreaChange}
            className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-white"
          >
            {areas.map((loc, idx) => (
              <option key={idx} value={loc.area}>
                {loc.area}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Coordinates Display */}
      {locationData?.latitude && (
        <div className="text-xs text-slate-500">
          📍 Coordinates: {locationData.latitude?.toFixed(4)}, {locationData.longitude?.toFixed(4)}
        </div>
      )}
    </div>
  );
}

export default PinCodeInput;
