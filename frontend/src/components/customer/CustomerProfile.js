import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Save, Loader2, Camera, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI } from '../../services/api';
import { toast } from 'sonner';

function CustomerProfile({ user, onUserUpdate }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        pincode: user.pincode || '',
      });
    }
  }, [user]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const response = await authAPI.updateProfile(formData);
      toast.success('Profile updated successfully!');
      if (onUserUpdate) {
        onUserUpdate(response.data.user);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-slate-400 mt-1">Manage your account details</p>
      </div>

      {/* Profile Picture */}
      <div className="glass p-6 rounded-xl mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-3xl font-bold">
              {formData.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-orange-500 rounded-full text-white hover:bg-orange-600 transition-colors">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{formData.full_name || 'User'}</h2>
            <p className="text-slate-400">{formData.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                <Check className="h-3 w-3 inline mr-1" /> Verified Customer
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="glass p-6 rounded-xl space-y-6">
        <h3 className="text-lg font-semibold text-white mb-4">Personal Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              <User className="h-4 w-4 inline mr-2" />
              Full Name</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="Enter your name"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              <Mail className="h-4 w-4 inline mr-2" />
              Email
            </Label>
            <Input
              type="email"
              value={formData.email}
              disabled
              className="bg-slate-900 border-slate-700 text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500">Email cannot be changed</p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              <Phone className="h-4 w-4 inline mr-2" />
              Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+91 9876543210"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>

          {/* Pincode */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              <MapPin className="h-4 w-4 inline mr-2" />
              PIN Code</Label>
            <Input
              value={formData.pincode}
              onChange={(e) => handleChange('pincode', e.target.value)}
              placeholder="110001"
              maxLength={6}
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label className="text-slate-300">
            <MapPin className="h-4 w-4 inline mr-2" />
            Address</Label>
          <Input
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Enter your address"
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* City */}
          <div className="space-y-2">
            <Label className="text-slate-300">City</Label>
            <Input
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Enter city"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label className="text-slate-300">State</Label>
            <Input
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder="Enter state"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto bg-orange-500 hover:bg-orange-600"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default CustomerProfile;
