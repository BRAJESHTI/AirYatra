import React, { useState, useEffect } from 'react';
import { Percent, IndianRupee, Plus, Trash2, MapPin, Loader2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/services/api';

export default function PlatformFeesPanel() {
  const [rules, setRules] = useState([]);
  const [globalDefault, setGlobalDefault] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ from_city: '', to_city: '', fee_type: 'percent', fee_value: '' });
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/platform-fees/settings');
      setSettings(res.data);
    } catch (e) {
      toast.error('Failed to load pricing settings');
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/platform-fees/settings/update', {
        commission_percent: parseFloat(settings.global_default_percent),
        urgency: {
          ...settings.urgency,
          tiers: settings.urgency.tiers.map((t) => ({ ...t, percent: parseFloat(t.percent) })),
        },
        surge: { ...settings.surge, max_percent: parseFloat(settings.surge.max_percent) },
      });
      toast.success('Pricing settings saved');
      fetchSettings();
      fetchRules();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const setTierPercent = (idx, val) => {
    const tiers = settings.urgency.tiers.map((t, i) => (i === idx ? { ...t, percent: val } : t));
    setSettings({ ...settings, urgency: { ...settings.urgency, tiers } });
  };

  const fetchRules = async () => {
    try {
      const res = await api.get('/platform-fees/');
      setRules(res.data.rules || []);
      setGlobalDefault(res.data.global_default_percent);
    } catch (e) {
      toast.error('Failed to load platform fee rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); fetchSettings(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/platform-fees/', {
        from_city: form.from_city,
        to_city: form.to_city || null,
        fee_type: form.fee_type,
        fee_value: parseFloat(form.fee_value),
      });
      toast.success('Platform fee rule added');
      setForm({ from_city: '', to_city: '', fee_type: 'percent', fee_value: '' });
      fetchRules();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add rule');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule) => {
    try {
      await api.put(`/platform-fees/${rule.id}`, { active: !rule.active });
      fetchRules();
    } catch (e) {
      toast.error('Failed to update rule');
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete rule "${rule.label}"?`)) return;
    try {
      await api.delete(`/platform-fees/${rule.id}`);
      toast.success('Rule deleted');
      fetchRules();
    } catch (e) {
      toast.error('Failed to delete rule');
    }
  };

  if (loading) return <div className="text-white p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-5xl" data-testid="platform-fees-panel">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">City / Route Platform Fees</h2>
        <p className="text-slate-400 text-sm">
          Route ya city ke hisab se platform fee set karein — har operator quote par auto-apply hogi.
          Koi rule match na ho to <span className="text-orange-400 font-semibold">Global Default {globalDefault}%</span> lagega.
        </p>
      </div>

      {/* Pricing Settings: Global Default + Urgency + AI Surge */}
      {settings && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="pricing-settings">
          {/* Global Default */}
          <div className="glass p-5 rounded-xl" data-testid="global-default-card">
            <p className="text-white font-semibold mb-1 flex items-center gap-2"><Percent className="h-4 w-4 text-orange-400" /> Global Default Fee</p>
            <p className="text-slate-500 text-xs mb-3">Jab koi city/route rule match nahi hota</p>
            <div className="flex items-center gap-2">
              <Input type="number" min="0" max="100" step="0.5"
                value={settings.global_default_percent}
                onChange={(e) => setSettings({ ...settings, global_default_percent: e.target.value })}
                className="bg-slate-800 border-slate-700 w-24" data-testid="global-default-input" />
              <span className="text-slate-400 text-sm">% of quote</span>
            </div>
          </div>

          {/* Urgency Pricing */}
          <div className="glass p-5 rounded-xl" data-testid="urgency-pricing-card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-semibold flex items-center gap-2">⚡ Urgency Pricing</p>
              <button type="button" onClick={() => setSettings({ ...settings, urgency: { ...settings.urgency, enabled: !settings.urgency.enabled } })}
                className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${settings.urgency.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/40 text-slate-400'}`}
                data-testid="urgency-toggle">
                {settings.urgency.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-3">Departure jitna paas, price utna zyada. 12hr+ par normal price.</p>
            {settings.urgency.tiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <span className="text-slate-300 text-xs w-24">{tier.min_hours}–{tier.max_hours} hrs:</span>
                <span className="text-slate-400 text-xs">+</span>
                <Input type="number" min="0" max="100" step="0.5" value={tier.percent}
                  onChange={(e) => setTierPercent(idx, e.target.value)}
                  className="bg-slate-800 border-slate-700 w-20 h-8" data-testid={`urgency-tier-${idx}-input`} />
                <span className="text-slate-400 text-xs">%</span>
              </div>
            ))}
          </div>

          {/* AI Surge */}
          <div className="glass p-5 rounded-xl" data-testid="surge-pricing-card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-semibold flex items-center gap-2">📈 AI Surge Pricing</p>
              <button type="button" onClick={() => setSettings({ ...settings, surge: { ...settings.surge, enabled: !settings.surge.enabled } })}
                className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${settings.surge.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/40 text-slate-400'}`}
                data-testid="surge-toggle">
                {settings.surge.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-slate-500 text-xs mb-3">Fixed routes par demand (24h searches + bookings) ke hisab se AI rate auto-badhata hai.</p>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-xs">Max increase:</span>
              <Input type="number" min="0" max="100" step="5" value={settings.surge.max_percent}
                onChange={(e) => setSettings({ ...settings, surge: { ...settings.surge, max_percent: e.target.value } })}
                className="bg-slate-800 border-slate-700 w-20 h-8" data-testid="surge-max-input" />
              <span className="text-slate-400 text-xs">%</span>
            </div>
          </div>

          <div className="md:col-span-3">
            <Button onClick={saveSettings} disabled={savingSettings} className="bg-orange-500 hover:bg-orange-600" data-testid="save-pricing-settings-btn">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Pricing Settings'}
            </Button>
          </div>
        </div>
      )}

      {/* Add rule form */}
      <form onSubmit={handleCreate} className="glass p-5 rounded-xl mb-6 grid grid-cols-2 md:grid-cols-5 gap-3 items-end" data-testid="add-fee-rule-form">
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">From City *</Label>
          <Input required value={form.from_city} onChange={(e) => setForm({ ...form, from_city: e.target.value })}
            placeholder="Mumbai" className="bg-slate-800 border-slate-700" data-testid="fee-from-city-input" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">To City (optional = city-wide)</Label>
          <Input value={form.to_city} onChange={(e) => setForm({ ...form, to_city: e.target.value })}
            placeholder="Pune" className="bg-slate-800 border-slate-700" data-testid="fee-to-city-input" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Fee Type</Label>
          <select value={form.fee_type} onChange={(e) => setForm({ ...form, fee_type: e.target.value })}
            className="w-full h-10 rounded-md bg-slate-800 border border-slate-700 text-white text-sm px-3" data-testid="fee-type-select">
            <option value="percent">Percent (%)</option>
            <option value="flat">Flat (₹)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-400">Value *</Label>
          <Input required type="number" min="0" step="0.01" value={form.fee_value}
            onChange={(e) => setForm({ ...form, fee_value: e.target.value })}
            placeholder={form.fee_type === 'percent' ? '10' : '5000'} className="bg-slate-800 border-slate-700" data-testid="fee-value-input" />
        </div>
        <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="add-fee-rule-btn">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add Rule</>}
        </Button>
      </form>

      {/* Rules list */}
      <div className="space-y-3" data-testid="fee-rules-list">
        {rules.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">Koi rule nahi — sabhi quotes par global default {globalDefault}% lagega.</p>
        )}
        {rules.map((rule) => (
          <div key={rule.id} data-testid={`fee-rule-${rule.id}`}
            className={`glass p-4 rounded-xl flex items-center justify-between gap-4 ${!rule.active ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg ${rule.fee_type === 'percent' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {rule.fee_type === 'percent' ? <Percent className="h-5 w-5" /> : <IndianRupee className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold truncate flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                  {rule.from_city}{rule.to_city ? ` → ${rule.to_city}` : ' (city-wide)'}
                </p>
                <p className="text-slate-400 text-xs">
                  {rule.fee_type === 'percent' ? `${rule.fee_value}% of quote` : `₹${Number(rule.fee_value).toLocaleString()} flat`}
                  {' • '}added by {rule.created_by_name || 'admin'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${rule.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/40 text-slate-400'}`}>
                {rule.active ? 'Active' : 'Off'}
              </span>
              <Button size="sm" variant="outline" onClick={() => toggleActive(rule)}
                className="border-slate-600 text-slate-300 h-8" data-testid={`toggle-fee-rule-${rule.id}`}>
                <Power className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(rule)}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8" data-testid={`delete-fee-rule-${rule.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
