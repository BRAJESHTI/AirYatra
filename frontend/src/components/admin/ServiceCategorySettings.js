import React, { useState, useEffect } from 'react';
import { Save, Loader2, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { toast } from 'sonner';

const LABELS = {
  helicopter: 'Helicopter',
  private_jet: 'Private Jet',
  yacht: 'Yacht',
  cruise: 'Cruise',
  helipad: 'Helipad Transfer',
};

export default function ServiceCategorySettings() {
  const [cats, setCats] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/verticals/service-categories')
      .then(r => setCats(r.data.categories))
      .catch(() => toast.error('Failed to load service categories'));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/verticals/admin/service-categories', { categories: cats });
      toast.success('Service categories updated — customer booking dropdown reflects instantly');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (!cats) return <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-400" /></div>;

  return (
    <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4" data-testid="service-category-settings">
      <div>
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ToggleRight className="h-5 w-5 text-orange-400" /> Customer Booking Services
        </h3>
        <p className="text-slate-400 text-sm">Enable/disable service categories shown in the customer "Book Your Journey" dropdown.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.keys(LABELS).map(k => (
          <label key={k} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/60 border border-slate-700 cursor-pointer">
            <span className="text-white">{LABELS[k]}</span>
            <input type="checkbox" checked={!!cats[k]}
              onChange={(e) => setCats(c => ({ ...c, [k]: e.target.checked }))}
              className="w-5 h-5 accent-orange-500" data-testid={`service-toggle-${k}`} />
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-service-categories-btn">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Services
      </Button>
    </div>
  );
}
