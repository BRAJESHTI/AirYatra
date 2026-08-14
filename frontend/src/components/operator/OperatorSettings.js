import React, { useState, useEffect } from 'react';
import { Settings, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { operatorAPI } from '@/services/api';
import { toast } from 'sonner';

const FIELDS = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'contact_phone', label: 'Contact Phone' },
  { key: 'contact_email', label: 'Contact Email' },
  { key: 'base_city', label: 'Base City' },
  { key: 'gstin', label: 'GSTIN' },
];

export default function OperatorSettings() {
  const [form, setForm] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await operatorAPI.getProfile();
        const p = res.data.operator || res.data;
        setProfile(p);
        const f = {};
        FIELDS.forEach(({ key }) => { f[key] = p[key] || ''; });
        setForm(f);
      } catch (e) {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await operatorAPI.updateProfile(form);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>;

  return (
    <div data-testid="operator-settings" className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="h-6 w-6 text-orange-400" /> Operator Settings
        </h1>
        <p className="text-slate-400 text-sm">Update your company profile and contact details.</p>
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
              <Input
                value={form[key] || ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white"
                data-testid={`settings-input-${key}`}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Status: <span className="text-green-400 uppercase">{profile?.status}</span> • Commission: {profile?.commission_rate ?? '—'}%
          </div>
          <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-settings-btn">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
