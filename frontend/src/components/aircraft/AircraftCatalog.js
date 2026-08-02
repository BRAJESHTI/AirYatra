import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plane, Shield, Camera, FileText, Users, Clock, Settings,
  CheckCircle, XCircle, AlertTriangle, Upload, RefreshCw,
  Loader2, IndianRupee, Calendar, Wrench, Star, Eye,
  Wifi, Wind, Baby, Dog, Accessibility, Coffee, Tv, Plug,
  ChevronRight, Plus, Edit, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ VERIFICATION BADGE ============

export const VerificationBadge = ({ status, showLabel = true }) => {
  const config = {
    pending: { emoji: '🔴', label: 'Pending', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    under_review: { emoji: '🟡', label: 'Under Review', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    verified: { emoji: '🟢', label: 'Verified', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    premium_verified: { emoji: '🔵', label: 'Premium Verified', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    suspended: { emoji: '⚫', label: 'Suspended', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
  };
  
  const c = config[status] || config.pending;
  
  return (
    <Badge className={`${c.color} border`}>
      <span className="mr-1">{c.emoji}</span>
      {showLabel && c.label}
    </Badge>
  );
};

// ============ FEATURE ICONS ============

const FeatureIcon = ({ feature, active }) => {
  const icons = {
    wifi: Wifi,
    air_conditioning: Wind,
    lavatory: Coffee,
    entertainment_system: Tv,
    charging_ports: Plug,
    pet_friendly: Dog,
    wheelchair_accessible: Accessibility
  };
  
  const Icon = icons[feature] || CheckCircle;
  
  return (
    <div className={`p-2 rounded-lg ${active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700/50 text-slate-500'}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
};

// ============ EXPIRY ALERT ============

const ExpiryAlert = ({ status, daysRemaining, documentType }) => {
  if (status === 'valid' || status === 'unknown') return null;
  
  const config = {
    expired: { color: 'bg-red-500', text: 'EXPIRED', urgent: true },
    critical: { color: 'bg-red-500', text: `${daysRemaining} days left`, urgent: true },
    urgent: { color: 'bg-orange-500', text: `${daysRemaining} days left`, urgent: true },
    warning: { color: 'bg-yellow-500', text: `${daysRemaining} days left`, urgent: false },
    attention: { color: 'bg-blue-500', text: `${daysRemaining} days left`, urgent: false },
    notice: { color: 'bg-slate-500', text: `${daysRemaining} days left`, urgent: false }
  };
  
  const c = config[status] || config.notice;
  
  return (
    <Badge className={`${c.color} text-white text-xs`}>
      {c.urgent && <AlertTriangle className="h-3 w-3 mr-1" />}
      {documentType}: {c.text}
    </Badge>
  );
};

// ============ CREATE AIRCRAFT FORM ============

const CreateAircraftForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Info
    aircraft_type: 'helicopter',
    manufacturer: '',
    model: '',
    year_of_manufacture: new Date().getFullYear(),
    registration_number: '',
    serial_number: '',
    
    // Features
    total_seats: 4,
    vip_seats: 0,
    cabin_size: 'medium',
    air_conditioning: true,
    wifi: false,
    entertainment_system: false,
    charging_ports: true,
    refreshments: false,
    food_service: false,
    lavatory: false,
    baggage_capacity_kg: 50,
    pet_friendly: false,
    wheelchair_accessible: false,
    
    // Pricing
    hourly_price: '',
    one_way_price: '',
    daily_price: '',
    landing_charges: '',
    crew_charges: '',
    
    // Description
    description: '',
    highlights: ''
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const payload = {
        basic_info: {
          aircraft_type: formData.aircraft_type,
          manufacturer: formData.manufacturer,
          model: formData.model,
          year_of_manufacture: parseInt(formData.year_of_manufacture),
          registration_number: formData.registration_number.toUpperCase(),
          serial_number: formData.serial_number
        },
        features: {
          total_seats: parseInt(formData.total_seats),
          vip_seats: parseInt(formData.vip_seats),
          cabin_size: formData.cabin_size,
          air_conditioning: formData.air_conditioning,
          wifi: formData.wifi,
          entertainment_system: formData.entertainment_system,
          charging_ports: formData.charging_ports,
          refreshments: formData.refreshments,
          food_service: formData.food_service,
          lavatory: formData.lavatory,
          baggage_capacity_kg: parseInt(formData.baggage_capacity_kg) || null,
          pet_friendly: formData.pet_friendly,
          wheelchair_accessible: formData.wheelchair_accessible
        },
        pricing: {
          hourly_price: parseFloat(formData.hourly_price) || null,
          one_way_price: parseFloat(formData.one_way_price) || null,
          daily_price: parseFloat(formData.daily_price) || null,
          landing_charges: parseFloat(formData.landing_charges) || null,
          crew_charges: parseFloat(formData.crew_charges) || null,
          currency: 'INR'
        },
        description: formData.description,
        highlights: formData.highlights ? formData.highlights.split(',').map(h => h.trim()) : []
      };
      
      const response = await axios.post(`${API_URL}/api/aircraft/create`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Aircraft added! Now upload documents for verification.');
      if (onSuccess) onSuccess(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create aircraft');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section A: Basic Info */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Plane className="h-5 w-5 text-orange-400" />
          Basic Information / मूल जानकारी
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-white">Aircraft Type *</Label>
            <select
              value={formData.aircraft_type}
              onChange={(e) => setFormData({ ...formData, aircraft_type: e.target.value })}
              className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md text-white px-3"
              required
            >
              <option value="helicopter">Helicopter</option>
              <option value="light_jet">Light Jet</option>
              <option value="mid_jet">Mid Jet</option>
              <option value="heavy_jet">Heavy Jet</option>
              <option value="turboprop">Turboprop</option>
            </select>
          </div>
          <div>
            <Label className="text-white">Manufacturer *</Label>
            <Input
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              placeholder="Bell, Airbus, Cessna..."
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-white">Model *</Label>
            <Input
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder="407, H145, Citation XLS..."
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-white">Registration Number *</Label>
            <Input
              value={formData.registration_number}
              onChange={(e) => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
              placeholder="VT-XXX"
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-white">Year of Manufacture *</Label>
            <Input
              type="number"
              value={formData.year_of_manufacture}
              onChange={(e) => setFormData({ ...formData, year_of_manufacture: e.target.value })}
              min="1980"
              max={new Date().getFullYear()}
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-white">Serial Number</Label>
            <Input
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>
      </div>
      
      {/* Section B: Features */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 text-orange-400" />
          Features & Amenities / सुविधाएं
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-white">Total Seats *</Label>
            <Input
              type="number"
              value={formData.total_seats}
              onChange={(e) => setFormData({ ...formData, total_seats: e.target.value })}
              min="1"
              max="50"
              className="bg-slate-800 border-slate-600 text-white"
              required
            />
          </div>
          <div>
            <Label className="text-white">VIP Seats</Label>
            <Input
              type="number"
              value={formData.vip_seats}
              onChange={(e) => setFormData({ ...formData, vip_seats: e.target.value })}
              min="0"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div>
            <Label className="text-white">Cabin Size</Label>
            <select
              value={formData.cabin_size}
              onChange={(e) => setFormData({ ...formData, cabin_size: e.target.value })}
              className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md text-white px-3"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          <div>
            <Label className="text-white">Baggage (kg)</Label>
            <Input
              type="number"
              value={formData.baggage_capacity_kg}
              onChange={(e) => setFormData({ ...formData, baggage_capacity_kg: e.target.value })}
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>
        
        {/* Amenities Checkboxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'air_conditioning', label: 'Air Conditioning', icon: Wind },
            { key: 'wifi', label: 'WiFi', icon: Wifi },
            { key: 'entertainment_system', label: 'Entertainment', icon: Tv },
            { key: 'charging_ports', label: 'Charging Ports', icon: Plug },
            { key: 'refreshments', label: 'Refreshments', icon: Coffee },
            { key: 'lavatory', label: 'Lavatory', icon: Coffee },
            { key: 'pet_friendly', label: 'Pet Friendly', icon: Dog },
            { key: 'wheelchair_accessible', label: 'Wheelchair Access', icon: Accessibility }
          ].map(({ key, label, icon: Icon }) => (
            <div 
              key={key}
              className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all ${
                formData[key] ? 'bg-green-500/20 border border-green-500/50' : 'bg-slate-800 border border-slate-700'
              }`}
              onClick={() => setFormData({ ...formData, [key]: !formData[key] })}
            >
              <Checkbox checked={formData[key]} />
              <Icon className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-white">{label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Section C: Pricing */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-orange-400" />
          Pricing / मूल्य निर्धारण
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-white">Hourly Price (₹)</Label>
            <Input
              type="number"
              value={formData.hourly_price}
              onChange={(e) => setFormData({ ...formData, hourly_price: e.target.value })}
              placeholder="150000"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div>
            <Label className="text-white">One-Way Price (₹)</Label>
            <Input
              type="number"
              value={formData.one_way_price}
              onChange={(e) => setFormData({ ...formData, one_way_price: e.target.value })}
              placeholder="85000"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div>
            <Label className="text-white">Daily Price (₹)</Label>
            <Input
              type="number"
              value={formData.daily_price}
              onChange={(e) => setFormData({ ...formData, daily_price: e.target.value })}
              placeholder="500000"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div>
            <Label className="text-white">Landing Charges (₹)</Label>
            <Input
              type="number"
              value={formData.landing_charges}
              onChange={(e) => setFormData({ ...formData, landing_charges: e.target.value })}
              placeholder="5000"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div>
            <Label className="text-white">Crew Charges (₹)</Label>
            <Input
              type="number"
              value={formData.crew_charges}
              onChange={(e) => setFormData({ ...formData, crew_charges: e.target.value })}
              placeholder="8000"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>
      </div>
      
      {/* Section D: Description */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-orange-400" />
          Description / विवरण
        </h3>
        
        <div>
          <Label className="text-white">Aircraft Description</Label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your aircraft, its features, and ideal use cases..."
            className="w-full h-24 bg-slate-800 border border-slate-600 rounded-md text-white p-3"
          />
        </div>
        
        <div>
          <Label className="text-white">Highlights (comma-separated)</Label>
          <Input
            value={formData.highlights}
            onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
            placeholder="Luxury interior, Noise-cancelling cabin, VIP configuration"
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-700">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
          data-testid="create-aircraft-submit"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
          ) : (
            <><Plus className="h-4 w-4 mr-2" /> Add Aircraft</>
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

// ============ AIRCRAFT CARD ============

const AircraftCard = ({ aircraft, onEdit, isPublic = false }) => {
  const { basic_info, features, pricing, verification, verification_badge, expiry_alerts } = aircraft;
  
  return (
    <Card className="bg-slate-900 border-slate-700 overflow-hidden">
      {/* Header Image Placeholder */}
      <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative">
        <Plane className="h-16 w-16 text-slate-600" />
        <div className="absolute top-3 right-3">
          <VerificationBadge status={verification?.status || 'pending'} />
        </div>
        {verification_badge?.is_verified && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-green-500 text-white">
              <Shield className="h-3 w-3 mr-1" /> Verified by AirYatra
            </Badge>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        {/* Title */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {basic_info.manufacturer} {basic_info.model}
            </h3>
            <p className="text-slate-400 text-sm">
              {basic_info.registration_number} • {basic_info.year_of_manufacture}
            </p>
          </div>
          <Badge variant="outline" className="text-orange-400 border-orange-400">
            {basic_info.aircraft_type}
          </Badge>
        </div>
        
        {/* Features */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <Badge variant="secondary" className="bg-slate-800">
            <Users className="h-3 w-3 mr-1" /> {features.total_seats} Seats
          </Badge>
          {features.wifi && (
            <Badge variant="secondary" className="bg-slate-800">
              <Wifi className="h-3 w-3 mr-1" /> WiFi
            </Badge>
          )}
          {features.air_conditioning && (
            <Badge variant="secondary" className="bg-slate-800">
              <Wind className="h-3 w-3 mr-1" /> AC
            </Badge>
          )}
          {features.lavatory && (
            <Badge variant="secondary" className="bg-slate-800">
              <Coffee className="h-3 w-3 mr-1" /> Lavatory
            </Badge>
          )}
        </div>
        
        {/* Pricing */}
        {pricing?.hourly_price && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl font-bold text-green-400">
              ₹{pricing.hourly_price.toLocaleString()}
            </span>
            <span className="text-slate-400 text-sm">/hour</span>
          </div>
        )}
        
        {/* Expiry Alerts */}
        {expiry_alerts && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {expiry_alerts.insurance?.status !== 'valid' && expiry_alerts.insurance?.status !== 'unknown' && (
              <ExpiryAlert 
                status={expiry_alerts.insurance.status} 
                daysRemaining={expiry_alerts.insurance.days_remaining}
                documentType="Insurance"
              />
            )}
            {expiry_alerts.maintenance?.status !== 'valid' && expiry_alerts.maintenance?.status !== 'unknown' && (
              <ExpiryAlert 
                status={expiry_alerts.maintenance.status} 
                daysRemaining={expiry_alerts.maintenance.days_remaining}
                documentType="Maintenance"
              />
            )}
          </div>
        )}
        
        {/* Actions */}
        {!isPublic && (
          <div className="flex gap-2 pt-3 border-t border-slate-700">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit && onEdit(aircraft)}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              <Camera className="h-4 w-4 mr-1" /> Photos
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              <FileText className="h-4 w-4 mr-1" /> Docs
            </Button>
          </div>
        )}
        
        {isPublic && (
          <Button className="w-full bg-orange-500 hover:bg-orange-600">
            <Eye className="h-4 w-4 mr-2" /> View Details
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// ============ OPERATOR FLEET DASHBOARD ============

export const OperatorFleetDashboard = () => {
  const [fleet, setFleet] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const fetchFleet = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aircraft/my-fleet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFleet(response.data.aircraft || []);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch fleet:', error);
      toast.error('Failed to load fleet');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plane className="h-6 w-6 text-orange-400" />
            My Fleet / मेरा बेड़ा
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage your aircraft catalog and verification
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchFleet} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button 
            onClick={() => setShowCreateForm(true)} 
            className="bg-orange-500 hover:bg-orange-600"
            data-testid="add-aircraft-btn"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Aircraft
          </Button>
        </div>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <div className="text-slate-400 text-sm">Total Aircraft</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{stats.verified}</div>
              <div className="text-slate-400 text-sm">Verified</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-slate-400 text-sm">Pending</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.published}</div>
              <div className="text-slate-400 text-sm">Published</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Create Form */}
      {showCreateForm && (
        <Card className="bg-slate-900 border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-400" />
              Add New Aircraft / नया विमान जोड़ें
            </CardTitle>
            <CardDescription>
              Fill in aircraft details for AirYatra verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAircraftForm 
              onSuccess={() => { setShowCreateForm(false); fetchFleet(); }}
              onCancel={() => setShowCreateForm(false)}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Fleet Grid */}
      {fleet.length === 0 && !showCreateForm ? (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-12 text-center">
            <Plane className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Aircraft Yet</h3>
            <p className="text-slate-400 mb-4">Add your first aircraft to start receiving bookings</p>
            <Button onClick={() => setShowCreateForm(true)} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" /> Add Aircraft
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fleet.map((aircraft) => (
            <AircraftCard key={aircraft.id} aircraft={aircraft} />
          ))}
        </div>
      )}
    </div>
  );
};

export default OperatorFleetDashboard;
