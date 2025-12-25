import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, MapPin, Save, Loader2, Camera, Check, 
  Building2, Calendar, DollarSign, Clock, Shield, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { landingAPI } from '../../services/api';
import { toast } from 'sonner';

function HelipadOwnerProfile({ user, helipadId, onUpdate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [helipadData, setHelipadData] = useState(null);
  const [formData, setFormData] = useState({
    // Owner Info
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    alternate_phone: '',
    
    // Helipad Details
    helipad_name: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    
    // Facility Details
    surface_type: 'concrete', // concrete, grass, metal
    helipad_size: '',
    lighting_available: false,
    fuel_available: false,
    hangar_available: false,
    
    // Rent Settings
    rent_per_landing: '',
    rent_per_hour: '',
    parking_charges_per_hour: '',
    overnight_charges: '',
    
    // Operating Hours
    operating_hours_start: '06:00',
    operating_hours_end: '18:00',
    
    // Bank Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder_name: '',
  });

  useEffect(() => {
    if (helipadId) {
      loadHelipadData();
    } else {
      setLoading(false);
    }
  }, [helipadId]);

  const loadHelipadData = async () => {
    try {
      const response = await landingAPI.getLandingPoint(helipadId);
      const data = response.data;
      setHelipadData(data);
      setFormData({
        owner_name: data.contact_name || user?.full_name || '',
        owner_email: data.contact_email || user?.email || '',
        owner_phone: data.contact_phone || user?.phone || '',
        alternate_phone: data.alternate_phone || '',
        helipad_name: data.name || '',
        address: data.address || '',
        city: data.city || '',
        district: data.district || '',
        state: data.state || '',
        pincode: data.pincode || '',
        latitude: data.latitude || '',
        longitude: data.longitude || '',
        surface_type: data.surface_type || 'concrete',
        helipad_size: data.helipad_size || '',
        lighting_available: data.lighting_available || false,
        fuel_available: data.fuel_available || false,
        hangar_available: data.hangar_available || false,
        rent_per_landing: data.rent_config?.per_landing || '',
        rent_per_hour: data.rent_config?.per_hour || '',
        parking_charges_per_hour: data.rent_config?.parking_per_hour || '',
        overnight_charges: data.rent_config?.overnight || '',
        operating_hours_start: data.operating_hours?.start || '06:00',
        operating_hours_end: data.operating_hours?.end || '18:00',
        bank_name: data.bank_details?.bank_name || '',
        account_number: data.bank_details?.account_number || '',
        ifsc_code: data.bank_details?.ifsc_code || '',
        account_holder_name: data.bank_details?.account_holder_name || '',
      });
    } catch (error) {
      toast.error('Failed to load helipad data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const updateData = {
        contact_name: formData.owner_name,
        contact_email: formData.owner_email,
        contact_phone: formData.owner_phone,
        alternate_phone: formData.alternate_phone,
        name: formData.helipad_name,
        address: formData.address,
        city: formData.city,
        district: formData.district,
        state: formData.state,
        pincode: formData.pincode,
        latitude: parseFloat(formData.latitude) || null,
        longitude: parseFloat(formData.longitude) || null,
        surface_type: formData.surface_type,
        helipad_size: formData.helipad_size,
        lighting_available: formData.lighting_available,
        fuel_available: formData.fuel_available,
        hangar_available: formData.hangar_available,
        rent_config: {
          per_landing: parseFloat(formData.rent_per_landing) || 0,
          per_hour: parseFloat(formData.rent_per_hour) || 0,
          parking_per_hour: parseFloat(formData.parking_charges_per_hour) || 0,
          overnight: parseFloat(formData.overnight_charges) || 0,
        },
        operating_hours: {
          start: formData.operating_hours_start,
          end: formData.operating_hours_end,
        },
        bank_details: {
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          account_holder_name: formData.account_holder_name,
        }
      };
      
      if (helipadId) {
        await landingAPI.updateLandingPoint(helipadId, updateData);
      }
      
      toast.success('Helipad profile updated! / हेलीपैड प्रोफाइल अपडेट हुई!');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Helipad Owner Profile / हेलीपैड मालिक प्रोफाइल</h1>
        <p className="text-slate-400 mt-1">Manage your helipad details and availability</p>
      </div>

      {/* Helipad Header */}
      <div className="glass p-6 rounded-xl mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-3xl font-bold">
              <Building2 className="h-12 w-12" />
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">{formData.helipad_name || 'Your Helipad'}</h2>
            <p className="text-slate-400">{formData.city}, {formData.state}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {helipadData?.is_active && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
                  <Check className="h-3 w-3" /> Active
                </span>
              )}
              {helipadData?.is_verified && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Verified
                </span>
              )}
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                Private Helipad
              </span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Owner Information */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-400" />
            Owner Information / मालिक की जानकारी
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Owner Name / मालिक का नाम *</Label>
              <Input
                value={formData.owner_name}
                onChange={(e) => handleChange('owner_name', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Email *</Label>
              <Input
                type="email"
                value={formData.owner_email}
                onChange={(e) => handleChange('owner_email', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Phone / फोन *</Label>
              <Input
                value={formData.owner_phone}
                onChange={(e) => handleChange('owner_phone', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Alternate Phone</Label>
              <Input
                value={formData.alternate_phone}
                onChange={(e) => handleChange('alternate_phone', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
        </div>

        {/* Helipad Details */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-400" />
            Helipad Details / हेलीपैड विवरण
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="text-slate-300">Helipad Name / हेलीपैड का नाम *</Label>
              <Input
                value={formData.helipad_name}
                onChange={(e) => handleChange('helipad_name', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-slate-300">Address / पता</Label>
              <Input
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">City / शहर</Label>
              <Input
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">District / जिला</Label>
              <Input
                value={formData.district}
                onChange={(e) => handleChange('district', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">State / राज्य</Label>
              <Input
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">PIN Code</Label>
              <Input
                value={formData.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                maxLength={6}
              />
            </div>
            <div>
              <Label className="text-slate-300">Latitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) => handleChange('latitude', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Longitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) => handleChange('longitude', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
        </div>

        {/* Facility Details */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" />
            Facility Details / सुविधा विवरण
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Surface Type</Label>
              <select
                value={formData.surface_type}
                onChange={(e) => handleChange('surface_type', e.target.value)}
                className="w-full mt-1 p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
              >
                <option value="concrete">Concrete</option>
                <option value="grass">Grass</option>
                <option value="metal">Metal Platform</option>
                <option value="asphalt">Asphalt</option>
              </select>
            </div>
            <div>
              <Label className="text-slate-300">Helipad Size (sq.ft)</Label>
              <Input
                value={formData.helipad_size}
                onChange={(e) => handleChange('helipad_size', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="e.g., 5000"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.lighting_available}
                onChange={() => handleCheckboxChange('lighting_available')}
                className="w-4 h-4 rounded border-slate-600"
              />
              <span className="text-slate-300">Night Lighting Available</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.fuel_available}
                onChange={() => handleCheckboxChange('fuel_available')}
                className="w-4 h-4 rounded border-slate-600"
              />
              <span className="text-slate-300">Fuel Available</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hangar_available}
                onChange={() => handleCheckboxChange('hangar_available')}
                className="w-4 h-4 rounded border-slate-600"
              />
              <span className="text-slate-300">Hangar Available</span>
            </label>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-400" />
            Operating Hours / कार्य समय
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Start Time</Label>
              <Input
                type="time"
                value={formData.operating_hours_start}
                onChange={(e) => handleChange('operating_hours_start', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">End Time</Label>
              <Input
                type="time"
                value={formData.operating_hours_end}
                onChange={(e) => handleChange('operating_hours_end', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
        </div>

        {/* Rent Configuration */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            Rent Configuration / किराया विन्यास
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Rent Per Landing (₹)</Label>
              <Input
                type="number"
                value={formData.rent_per_landing}
                onChange={(e) => handleChange('rent_per_landing', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="e.g., 5000"
              />
            </div>
            <div>
              <Label className="text-slate-300">Rent Per Hour (₹)</Label>
              <Input
                type="number"
                value={formData.rent_per_hour}
                onChange={(e) => handleChange('rent_per_hour', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="e.g., 2000"
              />
            </div>
            <div>
              <Label className="text-slate-300">Parking Per Hour (₹)</Label>
              <Input
                type="number"
                value={formData.parking_charges_per_hour}
                onChange={(e) => handleChange('parking_charges_per_hour', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="e.g., 500"
              />
            </div>
            <div>
              <Label className="text-slate-300">Overnight Charges (₹)</Label>
              <Input
                type="number"
                value={formData.overnight_charges}
                onChange={(e) => handleChange('overnight_charges', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="e.g., 10000"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            Bank Details / बैंक विवरण (For Rent Payments)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Bank Name</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Account Holder Name</Label>
              <Input
                value={formData.account_holder_name}
                onChange={(e) => handleChange('account_holder_name', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Account Number</Label>
              <Input
                value={formData.account_number}
                onChange={(e) => handleChange('account_number', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">IFSC Code</Label>
              <Input
                value={formData.ifsc_code}
                onChange={(e) => handleChange('ifsc_code', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={saving}
            className="bg-purple-500 hover:bg-purple-600 px-8"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Profile / प्रोफाइल सेव करें
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default HelipadOwnerProfile;
