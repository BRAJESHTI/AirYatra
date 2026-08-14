import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Phone, MapPin, Users, Clock, Send, Loader2, 
  Ambulance, Siren, UserCheck, Building2, Heart, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import LandingPointSelector from '../shared/LandingPointSelector';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Emergency Booking Form Component
 * For priority emergency bookings with instant operator notification
 */
const EmergencyBookingForm = ({
  user,
  onSuccess,
  onCancel,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [formData, setFormData] = useState({
    from_location: '',
    from_latitude: 0,
    from_longitude: 0,
    to_location: '',
    to_latitude: 0,
    to_longitude: 0,
    urgency_level: 'high',
    urgency_reason: 'medical_emergency',
    required_by: '',
    passengers: 1,
    aircraft_type: 'any',
    special_requirements: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });
  const [pickupPoint, setPickupPoint] = useState(null);
  const [dropPoint, setDropPoint] = useState(null);

  // Load emergency config
  useEffect(() => {
    fetchConfig();
    // Pre-fill contact if user is logged in
    if (user) {
      setFormData(prev => ({
        ...prev,
        emergency_contact_name: user.full_name || '',
        emergency_contact_phone: user.phone || ''
      }));
    }
  }, [user]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/emergency/config`);
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Failed to load emergency config:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle landing point selection
  const handlePickupSelect = (data) => {
    setPickupPoint(data);
    if (data) {
      setFormData(prev => ({
        ...prev,
        from_location: data.landing_point_name || '',
        from_latitude: data.latitude || 0,
        from_longitude: data.longitude || 0
      }));
    }
  };

  const handleDropSelect = (data) => {
    setDropPoint(data);
    if (data) {
      setFormData(prev => ({
        ...prev,
        to_location: data.landing_point_name || '',
        to_latitude: data.latitude || 0,
        to_longitude: data.longitude || 0
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to create emergency booking');
      return;
    }
    
    if (!formData.from_location || !formData.to_location) {
      toast.error('Please select pickup and drop locations');
      return;
    }
    
    if (!formData.emergency_contact_name || !formData.emergency_contact_phone) {
      toast.error('Emergency contact details required');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/emergency/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create emergency booking');
      }
      
      toast.success(
        <div>
          <p className="font-semibold">🚨 Emergency Request Sent!</p>
          <p className="text-sm">{data.message}</p>
          <p className="text-xs mt-1">Request #: {data.emergency_number}</p>
        </div>
      );
      
      if (onSuccess) {
        onSuccess(data);
      }
      
    } catch (error) {
      toast.error(error.message || 'Failed to submit emergency request');
    } finally {
      setLoading(false);
    }
  };

  const urgencyLevels = config?.urgency_levels || {
    critical: { label: 'Critical', color: 'red', surcharge_percent: 50 },
    high: { label: 'High', color: 'orange', surcharge_percent: 25 },
    medium: { label: 'Medium', color: 'yellow', surcharge_percent: 10 }
  };

  const urgencyReasons = config?.urgency_reasons || {
    medical_emergency: { label: 'Medical Emergency', icon: '🏥' },
    time_critical: { label: 'Time Critical', icon: '⏰' },
    vip_travel: { label: 'VIP Travel', icon: '👔' },
    disaster_relief: { label: 'Disaster Relief', icon: '🆘' },
    organ_transport: { label: 'Organ Transport', icon: '❤️' }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Emergency Header */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/20 rounded-full animate-pulse">
            <Siren className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-red-400 font-bold text-xl">
              Emergency Booking</h2>
            <p className="text-red-400/70 text-sm">
              Priority queue + Instant operator notification
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Urgency Level */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Urgency Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(urgencyLevels).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleInputChange('urgency_level', key)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    formData.urgency_level === key
                      ? key === 'critical' ? 'border-red-500 bg-red-500/20' :
                        key === 'high' ? 'border-orange-500 bg-orange-500/20' :
                        'border-yellow-500 bg-yellow-500/20'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className={`text-lg font-bold ${
                    key === 'critical' ? 'text-red-400' :
                    key === 'high' ? 'text-orange-400' : 'text-yellow-400'
                  }`}>
                    {value.label}
                  </div>
                  <div className="text-slate-400 text-sm mt-1">
                    +{value.surcharge_percent}% surcharge
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Urgency Reason */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(urgencyReasons).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleInputChange('urgency_reason', key)}
                  className={`p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
                    formData.urgency_reason === key
                      ? 'border-orange-500 bg-orange-500/20'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl">{value.icon}</span>
                  <span className="text-white text-sm">{value.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Locations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-400" />
                Pickup</CardTitle>
            </CardHeader>
            <CardContent>
              <LandingPointSelector
                label="Select pickup point"
                type="pickup"
                onSelect={handlePickupSelect}
                selectedPoint={pickupPoint}
                compact={true}
              />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-400" />
                Drop</CardTitle>
            </CardHeader>
            <CardContent>
              <LandingPointSelector
                label="Select drop point"
                type="drop"
                onSelect={handleDropSelect}
                selectedPoint={dropPoint}
                compact={true}
              />
            </CardContent>
          </Card>
        </div>

        {/* Flight Details */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              Flight Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-300 mb-2 block">Passengers</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.passengers}
                  onChange={(e) => handleInputChange('passengers', parseInt(e.target.value))}
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>
              
              <div>
                <Label className="text-slate-300 mb-2 block">Aircraft Type</Label>
                <select
                  value={formData.aircraft_type}
                  onChange={(e) => handleInputChange('aircraft_type', e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded-md text-white"
                >
                  <option value="any">Any Available</option>
                  <option value="helicopter">Helicopter</option>
                  <option value="light_jet">Light Jet</option>
                </select>
              </div>
              
              <div>
                <Label className="text-slate-300 mb-2 block">Required By (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.required_by}
                  onChange={(e) => handleInputChange('required_by', e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <Label className="text-slate-300 mb-2 block">Special Requirements</Label>
              <Textarea
                value={formData.special_requirements}
                onChange={(e) => handleInputChange('special_requirements', e.target.value)}
                placeholder="Medical equipment needed, stretcher required, oxygen support..."
                className="bg-slate-900 border-slate-600 text-white"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-400" />
              Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300 mb-2 block">Contact Name *</Label>
                <Input
                  value={formData.emergency_contact_name}
                  onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                  placeholder="Full name"
                  className="bg-slate-900 border-slate-600 text-white"
                  required
                />
              </div>
              
              <div>
                <Label className="text-slate-300 mb-2 block">Phone Number *</Label>
                <Input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="bg-slate-900 border-slate-600 text-white"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Surcharge Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
            <div className="text-yellow-400 text-sm">
              <p className="font-medium">Emergency Surcharge Notice</p>
              <p className="mt-1 text-yellow-400/70">
                Emergency bookings include a {urgencyLevels[formData.urgency_level]?.surcharge_percent}% priority surcharge 
                for immediate processing and dedicated operator response.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="flex-1 border-slate-600"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Siren className="h-4 w-4 mr-2" />
                Send Emergency Request
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EmergencyBookingForm;
