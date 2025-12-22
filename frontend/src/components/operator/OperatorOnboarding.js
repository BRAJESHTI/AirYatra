import React, { useState } from 'react';
import { Building2, Mail, Phone, MapPin, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { operatorAPI } from '../../services/api';
import { toast } from 'sonner';

function OperatorOnboarding({ user, onComplete }) {
  const [formData, setFormData] = useState({
    company_name: '',
    base_city: '',
    contact_person: user.full_name,
    contact_phone: user.phone,
    contact_email: user.email,
    gstin: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await operatorAPI.createProfile(formData);
      toast.success('Operator profile created! Awaiting verification.');
      onComplete();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6" data-testid="operator-onboarding">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3" data-testid="onboarding-title">
            Complete Your Operator Profile
          </h1>
          <p className="text-slate-400">
            Provide your company details to start receiving booking inquiries
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="onboarding-form">
          <div className="space-y-2">
            <Label htmlFor="company_name" className="text-white">Company Name *</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                id="company_name"
                name="company_name"
                placeholder="AirFleet Services Pvt Ltd"
                value={formData.company_name}
                onChange={handleChange}
                required
                className="pl-10 bg-slate-900 border-slate-700 text-white"
                data-testid="company-name-input"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="base_city" className="text-white">Base City *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="base_city"
                  name="base_city"
                  placeholder="Mumbai"
                  value={formData.base_city}
                  onChange={handleChange}
                  required
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="base-city-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstin" className="text-white">GSTIN</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="gstin"
                  name="gstin"
                  placeholder="22AAAAA0000A1Z5"
                  value={formData.gstin}
                  onChange={handleChange}
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="gstin-input"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_person" className="text-white">Contact Person *</Label>
            <Input
              id="contact_person"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              required
              className="bg-slate-900 border-slate-700 text-white"
              data-testid="contact-person-input"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="contact_phone" className="text-white">Contact Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  required
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="contact-phone-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email" className="text-white">Contact Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  required
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="contact-email-input"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-300 text-sm">
              <strong className="text-white">Next Steps:</strong> After submitting your profile, 
              our admin team will verify your details. You'll be able to add your fleet and start 
              receiving inquiries once verified.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
            disabled={loading}
            data-testid="submit-profile-btn"
          >
            {loading ? 'Creating Profile...' : 'Create Operator Profile'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default OperatorOnboarding;