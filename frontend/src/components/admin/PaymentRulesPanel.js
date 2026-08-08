import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal, Plus, Pencil, Trash2, Loader2, Save, CheckCircle2, XCircle, IndianRupee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const ADVANCE_OPTIONS = [
  { value: 0, label: 'Pay Later (No Advance)' },
  { value: 25, label: '25% Advance' },
  { value: 50, label: '50% Advance' },
  { value: 75, label: '75% Advance' },
  { value: 100, label: '100% Full Payment' },
];

const PURPOSES = ['', 'pilgrimage', 'business', 'tourism', 'leisure', 'medical', 'emergency', 'cargo', 'other'];

const EMPTY_RULE = {
  id: null, name: '', active: true, priority: 100,
  route_from: '', route_to: '', min_amount: '', max_amount: '',
  purpose: '', advance_percent: 50, allow_emi: false,
};

const advanceBadge = (pct) => {
  if (pct === 0) return { text: 'Pay Later', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/40' };
  if (pct === 100) return { text: '100% Full', cls: 'bg-red-500/20 text-red-400 border-red-500/40' };
  return { text: `${pct}% Advance`, cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
};

export default function PaymentRulesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultPct, setDefaultPct] = useState(50);
  const [rules, setRules] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_RULE);
  const [meta, setMeta] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payment-rules');
      setDefaultPct(res.data.default_advance_percent ?? 50);
      setRules(res.data.payment_rules || []);
      setMeta({ updated_at: res.data.updated_at, updated_by: res.data.updated_by });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load payment rules');
    } finally {
      setLoading(false);
    }
  };

  const persist = async (nextRules, nextDefault = defaultPct) => {
    setSaving(true);
    try {
      const payload = {
        default_advance_percent: nextDefault,
        payment_rules: nextRules.map(r => ({
          ...r,
          priority: parseInt(r.priority) || 100,
          min_amount: r.min_amount === '' || r.min_amount === null ? null : parseFloat(r.min_amount),
          max_amount: r.max_amount === '' || r.max_amount === null ? null : parseFloat(r.max_amount),
          route_from: r.route_from || null,
          route_to: r.route_to || null,
          purpose: r.purpose || null,
        })),
      };
      await api.put('/admin/payment-rules', payload);
      toast.success('Payment rules saved');
      await load();
      return true;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save rules');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft.name.trim()) return toast.error('Rule name is required');
    const next = draft.id
      ? rules.map(r => (r.id === draft.id ? draft : r))
      : [...rules, draft];
    const ok = await persist(next);
    if (ok) { setDialogOpen(false); setDraft(EMPTY_RULE); }
  };

  const deleteRule = async (id) => {
    await persist(rules.filter(r => r.id !== id));
  };

  const toggleActive = async (rule) => {
    await persist(rules.map(r => (r.id === rule.id ? { ...r, active: !r.active } : r)));
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 text-orange-400 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="payment-rules-panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-orange-400" />
            Payment Rules
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Route-wise / booking-value-wise advance rules — applied to Stripe, Razorpay & Wallet payments
          </p>
        </div>
        <Button onClick={() => { setDraft(EMPTY_RULE); setDialogOpen(true); }}
          className="bg-orange-500 hover:bg-orange-600" data-testid="add-rule-btn">
          <Plus className="h-4 w-4 mr-1" /> Add Rule
        </Button>
      </div>

      {/* Default advance */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6" data-testid="default-advance-card">
        <h3 className="text-white font-semibold mb-1">Default Advance (when no rule matches)</h3>
        <p className="text-slate-500 text-xs mb-4">
          {meta.updated_at ? `Last updated ${new Date(meta.updated_at).toLocaleString()} by ${meta.updated_by || '—'}` : 'Never configured — using 50% default'}
        </p>
        <div className="flex flex-wrap gap-2">
          {ADVANCE_OPTIONS.map(opt => (
            <button key={opt.value}
              onClick={async () => { setDefaultPct(opt.value); await persist(rules, opt.value); }}
              disabled={saving}
              data-testid={`default-advance-${opt.value}`}
              className={`px-4 py-2 rounded-full text-sm border transition-all ${
                defaultPct === opt.value
                  ? 'bg-orange-500/20 border-orange-500/60 text-orange-400 font-semibold'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules list */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">Rules ({rules.length})</h3>
          <span className="text-slate-500 text-xs">Lowest priority number wins</span>
        </div>
        {rules.length === 0 ? (
          <div className="p-10 text-center text-slate-500" data-testid="no-rules-msg">
            No rules yet — all bookings use the default {defaultPct}% advance
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {[...rules].sort((a, b) => (a.priority || 100) - (b.priority || 100)).map(rule => {
              const badge = advanceBadge(rule.advance_percent);
              return (
                <div key={rule.id} className={`px-6 py-4 flex flex-col md:flex-row md:items-center gap-3 ${!rule.active ? 'opacity-50' : ''}`}
                  data-testid={`rule-row-${rule.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{rule.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>
                      {rule.allow_emi && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">EMI</span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">P{rule.priority}</span>
                    </div>
                    <div className="text-slate-400 text-xs mt-1 flex flex-wrap gap-x-3">
                      {rule.route_from && <span>From: {rule.route_from}</span>}
                      {rule.route_to && <span>To: {rule.route_to}</span>}
                      {(rule.min_amount || rule.max_amount) && (
                        <span className="flex items-center"><IndianRupee className="h-3 w-3" />
                          {rule.min_amount ? Number(rule.min_amount).toLocaleString() : '0'} – {rule.max_amount ? Number(rule.max_amount).toLocaleString() : '∞'}
                        </span>
                      )}
                      {rule.purpose && <span>Purpose: {rule.purpose}</span>}
                      {!rule.route_from && !rule.route_to && !rule.min_amount && !rule.max_amount && !rule.purpose && (
                        <span>Matches all bookings</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(rule)} disabled={saving}
                      className={`p-1.5 rounded-lg ${rule.active ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:bg-slate-800'}`}
                      title={rule.active ? 'Active — click to disable' : 'Inactive — click to enable'}
                      data-testid={`toggle-rule-${rule.id}`}>
                      {rule.active ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </button>
                    <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white"
                      onClick={() => {
                        setDraft({ ...EMPTY_RULE, ...rule, min_amount: rule.min_amount ?? '', max_amount: rule.max_amount ?? '', route_from: rule.route_from || '', route_to: rule.route_to || '', purpose: rule.purpose || '' });
                        setDialogOpen(true);
                      }}
                      data-testid={`edit-rule-${rule.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300"
                      onClick={() => deleteRule(rule.id)} disabled={saving}
                      data-testid={`delete-rule-${rule.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto" data-testid="rule-dialog">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit Rule' : 'New Payment Rule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400">Rule Name *</label>
              <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. High-value bookings — full payment"
                className="bg-slate-800 border-slate-600 mt-1" data-testid="rule-name-input" />
            </div>
            <div>
              <label className="text-sm text-slate-400">Advance Requirement *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ADVANCE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setDraft({ ...draft, advance_percent: opt.value })}
                    data-testid={`rule-advance-${opt.value}`}
                    className={`px-3 py-1.5 rounded-full text-xs border ${
                      draft.advance_percent === opt.value
                        ? 'bg-orange-500/20 border-orange-500/60 text-orange-400 font-semibold'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400">Route From (contains)</label>
                <Input value={draft.route_from} onChange={e => setDraft({ ...draft, route_from: e.target.value })}
                  placeholder="e.g. Mumbai" className="bg-slate-800 border-slate-600 mt-1" data-testid="rule-route-from" />
              </div>
              <div>
                <label className="text-sm text-slate-400">Route To (contains)</label>
                <Input value={draft.route_to} onChange={e => setDraft({ ...draft, route_to: e.target.value })}
                  placeholder="e.g. Shirdi" className="bg-slate-800 border-slate-600 mt-1" data-testid="rule-route-to" />
              </div>
              <div>
                <label className="text-sm text-slate-400">Min Booking Value (₹)</label>
                <Input type="number" value={draft.min_amount} onChange={e => setDraft({ ...draft, min_amount: e.target.value })}
                  placeholder="Optional" className="bg-slate-800 border-slate-600 mt-1" data-testid="rule-min-amount" />
              </div>
              <div>
                <label className="text-sm text-slate-400">Max Booking Value (₹)</label>
                <Input type="number" value={draft.max_amount} onChange={e => setDraft({ ...draft, max_amount: e.target.value })}
                  placeholder="Optional" className="bg-slate-800 border-slate-600 mt-1" data-testid="rule-max-amount" />
              </div>
              <div>
                <label className="text-sm text-slate-400">Booking Purpose</label>
                <select value={draft.purpose} onChange={e => setDraft({ ...draft, purpose: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-white"
                  data-testid="rule-purpose-select">
                  {PURPOSES.map(p => <option key={p} value={p}>{p === '' ? 'Any purpose' : p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400">Priority (lower = first)</label>
                <Input type="number" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}
                  className="bg-slate-800 border-slate-600 mt-1" data-testid="rule-priority-input" />
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-800/50 rounded-xl px-4 py-3">
              <div>
                <p className="text-white text-sm font-medium">Allow EMI</p>
                <p className="text-slate-500 text-xs">Show EMI option on Razorpay checkout (needs Razorpay EMI enabled)</p>
              </div>
              <Switch checked={draft.allow_emi} onCheckedChange={v => setDraft({ ...draft, allow_emi: v })}
                data-testid="rule-emi-switch" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={saveDraft} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-rule-btn">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
