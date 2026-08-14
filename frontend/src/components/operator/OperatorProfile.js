import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, MapPin, Save, Loader2, Camera, Check, 
  Building2, FileText, Shield, CreditCard, Plane, Award, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { operatorAPI } from '../../services/api';
import { toast } from 'sonner';

function OperatorProfile({ operator, onOperatorUpdate }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Info
    company_name: '',
    owner_name: '',
    email: '',
    phone: '',
    alternate_phone: '',
    
    // Business Details
    gst_number: '',
    pan_number: '',
    business_type: '',
    
    // Address
    address: '',
    city: '',
    state: '',
    pincode: '',
    
    // Bank Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_holder_name: '',
    
    // Documents
    license_number: '',
    license_expiry: '',
  });

  useEffect(() => {
    if (operator) {
      setFormData({
        company_name: operator.company_name || '',
        owner_name: operator.owner_name || operator.full_name || '',
        email: operator.email || '',
        phone: operator.phone || '',
        alternate_phone: operator.alternate_phone || '',
        gst_number: operator.gst_number || '',
        pan_number: operator.pan_number || '',
        business_type: operator.business_type || '',
        address: operator.address || '',
        city: operator.city || '',
        state: operator.state || '',
        pincode: operator.pincode || '',
        bank_name: operator.bank_details?.bank_name || '',
        account_number: operator.bank_details?.account_number || '',
        ifsc_code: operator.bank_details?.ifsc_code || '',
        account_holder_name: operator.bank_details?.account_holder_name || '',
        license_number: operator.license_number || '',
        license_expiry: operator.license_expiry || '',
      });
    }
  }, [operator]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const updateData = {
        ...formData,
        bank_details: {
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          account_holder_name: formData.account_holder_name,
        }
      };
      
      const response = await operatorAPI.updateProfile(updateData);
      toast.success('Profile updated successfully!');
      if (onOperatorUpdate) {
        onOperatorUpdate(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Operator Profile</h1>
        <p className="text-slate-400 mt-1">Manage your business details and documents</p>
      </div>

      {/* Company Header */}
      <div className="glass p-6 rounded-xl mb-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
              {formData.company_name?.charAt(0)?.toUpperCase() || 'O'}
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white">{formData.company_name || 'Company Name'}</h2>
            <p className="text-slate-400">{formData.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {operator?.is_verified && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
                  <Check className="h-3 w-3" /> Verified
                </span>
              )}
              {operator?.license_number && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Licensed
                </span>
              )}
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs flex items-center gap-1">
                <Plane className="h-3 w-3" /> {operator?.fleet_count || 0} Aircraft
              </span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Business Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Company Name*</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="Enter company name"
              />
            </div>
            <div>
              <Label className="text-slate-300">Owner Name*</Label>
              <Input
                value={formData.owner_name}
                onChange={(e) => handleChange('owner_name', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="Enter owner name"
              />
            </div>
            <div>
              <Label className="text-slate-300">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                disabled
              />
            </div>
            <div>
              <Label className="text-slate-300">Phone*</Label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>
            <div>
              <Label className="text-slate-300">GST Number</Label>
              <Input
                value={formData.gst_number}
                onChange={(e) => handleChange('gst_number', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div>
              <Label className="text-slate-300">PAN Number</Label>
              <Input
                value={formData.pan_number}
                onChange={(e) => handleChange('pan_number', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="AAAAA0000A"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-400" />
            Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="text-slate-300">Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="Full address"
              />
            </div>
            <div>
              <Label className="text-slate-300">City</Label>
              <Input
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">State</Label>
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
          </div>
        </div>

        {/* License Details */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-400" />
            License Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">DGCA License Number</Label>
              <Input
                value={formData.license_number}
                onChange={(e) => handleChange('license_number', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="License number"
              />
            </div>
            <div>
              <Label className="text-slate-300">License Expiry Date</Label>
              <Input
                type="date"
                value={formData.license_expiry}
                onChange={(e) => handleChange('license_expiry', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-400" />
            Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Bank Name</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="Bank name"
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
                placeholder="Account number"
              />
            </div>
            <div>
              <Label className="text-slate-300">IFSC Code</Label>
              <Input
                value={formData.ifsc_code}
                onChange={(e) => handleChange('ifsc_code', e.target.value)}
                className="bg-slate-800 border-slate-600 text-white mt-1"
                placeholder="IFSC code"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-500 hover:bg-blue-600 px-8"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Profile</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default OperatorProfile;
