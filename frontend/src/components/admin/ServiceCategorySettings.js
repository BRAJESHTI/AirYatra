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
  const [pricing, setPricing] = useState({ platform_fee_pct: 0, tax_pct: 0 });
  const [savingFees, setSavingFees] = useState(false);

  useEffect(() => {
    api.get('/verticals/service-categories')
      .then(r => setCats(r.data.categories))
      .catch(() => toast.error('Failed to load service categories'));
    api.get('/verticals/pricing-config')
      .then(r => setPricing(r.data))
      .catch(() => {});
  }, []);

  const saveFees = async () => {
    setSavingFees(true);
    try {
      await api.put('/verticals/admin/pricing-config', pricing);
      toast.success(`Saved — Platform Fee ${pricing.platform_fee_pct}% + GST ${pricing.tax_pct}% ab har price breakup me lagega`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save fees');
    } finally { setSavingFees(false); }
  };

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

      <div className="border-t border-slate-800 pt-4 space-y-3" data-testid="pricing-config-section">
        <div>
          <h3 className="text-lg font-semibold text-white">Platform Fee & Taxes</h3>
          <p className="text-slate-400 text-sm">Ye % har Yacht/Cruise/Helipad price breakup mein customer ko dikhega aur total mein judega.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">AirYatra Platform Fee (%)</label>
            <input type="number" min="0" max="50" step="0.5" value={pricing.platform_fee_pct}
              onChange={(e) => setPricing(p => ({ ...p, platform_fee_pct: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-slate-800 border border-slate-700 text-white h-10 rounded-md px-3"
              data-testid="platform-fee-input" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">GST / Taxes (%)</label>
            <input type="number" min="0" max="50" step="0.5" value={pricing.tax_pct}
              onChange={(e) => setPricing(p => ({ ...p, tax_pct: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-slate-800 border border-slate-700 text-white h-10 rounded-md px-3"
              data-testid="gst-input" />
          </div>
        </div>
        <p className="text-amber-400/80 text-xs">⚠️ Example: ₹1,000 booking + {pricing.platform_fee_pct}% fee (₹{(1000 * pricing.platform_fee_pct / 100).toFixed(0)}) + {pricing.tax_pct}% GST = ₹{(1000 * (1 + pricing.platform_fee_pct / 100) * (1 + pricing.tax_pct / 100)).toFixed(0)} total payable</p>
        <Button onClick={saveFees} disabled={savingFees} className="bg-orange-500 hover:bg-orange-600" data-testid="save-pricing-config-btn">
          {savingFees ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Fees & Taxes
        </Button>
      </div>
    </div>
  );
}
