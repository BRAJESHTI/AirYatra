/**
 * CRM Lead Modal Component
 * Create/Edit lead form with all fields
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Loader2, User, Mail, Phone, Building2, MapPin } from 'lucide-react';
import { crmAPI, userManagementAPI } from '@/services/api';
import { toast } from 'sonner';

// Lead sources list
const LEAD_SOURCES = [
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'gmail', label: 'Gmail', icon: '📩' },
  { value: 'indiamart', label: 'IndiaMart', icon: '🏭' },
  { value: 'justdial', label: 'JustDial', icon: '📞' },
  { value: 'sulekha', label: 'Sulekha', icon: '🔍' },
  { value: 'website', label: 'Website', icon: '🌐' },
  { value: 'referral', label: 'Referral', icon: '👥' },
  { value: 'walk_in', label: 'Walk In', icon: '🚶' },
  { value: 'phone_inquiry', label: 'Phone Inquiry', icon: '📱' },
  { value: 'other', label: 'Other', icon: '📝' },
];

const LEAD_STATUSES = [
  { value: 'new', label: 'New Lead', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-indigo-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
  { value: 'won', label: 'Won', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-cyan-500' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-gray-500' },
];

const CRMLeadModal = ({ lead, onClose, onSuccess }) => {
  const isEdit = !!lead?.id;
  const [loading, setLoading] = useState(false);
  const [salesTeam, setSalesTeam] = useState([]);
  const [formData, setFormData] = useState({
    customer_name: lead?.customer_name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    company: lead?.company || '',
    location: lead?.location || '',
    source: lead?.source || 'website',
    status: lead?.status || 'new',
    priority: lead?.priority || 'warm',
    expected_value: lead?.expected_value || '',
    notes: lead?.notes || '',
    assigned_to: lead?.assigned_to || '',
    // Travel details
    from_location: lead?.travel_details?.from_location || '',
    to_location: lead?.travel_details?.to_location || '',
    travel_date: lead?.travel_details?.travel_date || '',
    passengers: lead?.travel_details?.passengers || 1,
  });

  useEffect(() => {
    loadSalesTeam();
  }, []);

  const loadSalesTeam = async () => {
    try {
      const response = await userManagementAPI.getUsers({ roles: 'sales' });
      setSalesTeam(response.data.users || []);
    } catch (error) {
      console.error('Failed to load sales team:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        expected_value: parseFloat(formData.expected_value) || 0,
        travel_details: {
          from_location: formData.from_location,
          to_location: formData.to_location,
          travel_date: formData.travel_date,
          passengers: parseInt(formData.passengers) || 1,
        },
      };

      if (isEdit) {
        await crmAPI.updateLead(lead.id, payload);
        toast.success('Lead updated successfully!');
      } else {
        await crmAPI.createLead(payload);
        toast.success('Lead created successfully!');
      }

      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save lead');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            {isEdit ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400">Customer Name *</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={formData.customer_name}
                  onChange={(e) => handleChange('customer_name', e.target.value)}
                  placeholder="Full Name"
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-400">Phone *</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-400">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@example.com"
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-400">Company</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={formData.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                  placeholder="Company Name"
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* Lead Details */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-400">Source</Label>
              <select
                value={formData.source}
                onChange={(e) => handleChange('source', e.target.value)}
                className="w-full mt-1 h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md"
              >
                {LEAD_SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-400">Status</Label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full mt-1 h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md"
              >
                {LEAD_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-400">Priority</Label>
              <select
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full mt-1 h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md"
              >
                <option value="hot">🔥 Hot</option>
                <option value="warm">☀️ Warm</option>
                <option value="cold">❄️ Cold</option>
              </select>
            </div>
          </div>

          {/* Travel Details */}
          <div className="p-4 bg-slate-800 rounded-lg space-y-4">
            <h3 className="text-white font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-400" /> Travel Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400">From Location</Label>
                <Input
                  value={formData.from_location}
                  onChange={(e) => handleChange('from_location', e.target.value)}
                  placeholder="e.g., Mumbai"
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-400">To Location</Label>
                <Input
                  value={formData.to_location}
                  onChange={(e) => handleChange('to_location', e.target.value)}
                  placeholder="e.g., Pune"
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-400">Travel Date</Label>
                <Input
                  type="date"
                  value={formData.travel_date}
                  onChange={(e) => handleChange('travel_date', e.target.value)}
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-400">Passengers</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.passengers}
                  onChange={(e) => handleChange('passengers', e.target.value)}
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
          </div>

          {/* Assignment & Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400">Assign To</Label>
              <select
                value={formData.assigned_to}
                onChange={(e) => handleChange('assigned_to', e.target.value)}
                className="w-full mt-1 h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md"
              >
                <option value="">Unassigned</option>
                {salesTeam.map(user => (
                  <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-400">Expected Value (₹)</Label>
              <Input
                type="number"
                value={formData.expected_value}
                onChange={(e) => handleChange('expected_value', e.target.value)}
                placeholder="e.g., 150000"
                className="mt-1 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-slate-400">Notes</Label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes about this lead..."
              className="w-full mt-1 h-24 p-3 bg-slate-800 border border-slate-700 text-white rounded-md resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                isEdit ? 'Update Lead' : 'Create Lead'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CRMLeadModal;
