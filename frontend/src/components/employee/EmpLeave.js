import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual / आकस्मिक' },
  { value: 'sick', label: 'Sick / बीमारी' },
  { value: 'earned', label: 'Earned / अर्जित' },
  { value: 'unpaid', label: 'Unpaid / अवैतनिक' },
];

const STATUS_STYLES = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-slate-500/20 text-slate-400',
};

export const EmpLeave = ({ onChanged }) => {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });

  const load = async () => {
    try {
      const res = await api.get('/hr/leave/my');
      setData(res.data);
    } catch (e) { toast.error('Failed to load leaves'); }
  };

  useEffect(() => { load(); }, []);

  const apply = async () => {
    if (!form.start_date || !form.end_date) return toast.error('Please select dates / तारीख चुनें');
    if (form.end_date < form.start_date) return toast.error('End date must be after start date');
    setSaving(true);
    try {
      const res = await api.post('/hr/leave/apply', form);
      toast.success(`${res.data.message} (${res.data.days} days)`);
      setOpen(false);
      setForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      await load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to apply');
    } finally { setSaving(false); }
  };

  const bal = data?.balance || {};
  const balances = [
    { key: 'casual', label: 'Casual', color: 'text-sky-400' },
    { key: 'sick', label: 'Sick', color: 'text-red-400' },
    { key: 'earned', label: 'Earned', color: 'text-green-400' },
  ];

  return (
    <div className="space-y-6" data-testid="emp-leave">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Leave / छुट्टी</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-sky-500 hover:bg-sky-600" data-testid="apply-leave-btn"><Plus className="h-4 w-4 mr-2" />Apply Leave / छुट्टी लें</Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader><DialogTitle>Apply for Leave / छुट्टी आवेदन</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Leave Type</Label>
                <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 mt-1" data-testid="leave-type-select">
                  {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">From</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="leave-start-date" />
                </div>
                <div>
                  <Label className="text-slate-300">To</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="leave-end-date" />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">Reason / कारण</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave" className="bg-slate-800 border-slate-700 mt-1" data-testid="leave-reason-input" />
              </div>
              <Button onClick={apply} disabled={saving} className="w-full bg-sky-500 hover:bg-sky-600" data-testid="submit-leave-btn">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit Application / जमा करें
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {balances.map((b) => (
          <div key={b.key} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-bold ${b.color}`}>{(bal[b.key] || 0) - (bal[`${b.key}_used`] || 0)}</p>
            <p className="text-slate-400 text-xs">{b.label} left of {bal[b.key] || 0}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {!data?.leaves?.length ? (
          <div className="p-8 text-center text-slate-400"><CalendarDays className="h-10 w-10 mx-auto mb-2 text-slate-600" />No leave applications yet / अभी कोई आवेदन नहीं</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="text-left p-3 text-slate-400">Type</th>
                <th className="text-left p-3 text-slate-400">From — To</th>
                <th className="text-center p-3 text-slate-400">Days</th>
                <th className="text-left p-3 text-slate-400">Reason</th>
                <th className="text-center p-3 text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.leaves.map((l) => (
                <tr key={l.id} className="border-t border-slate-700/60" data-testid={`leave-row-${l.id}`}>
                  <td className="p-3 text-white capitalize">{l.leave_type}</td>
                  <td className="p-3 text-slate-300">{l.start_date} → {l.end_date}</td>
                  <td className="p-3 text-center text-slate-300">{l.days}</td>
                  <td className="p-3 text-slate-400 max-w-[200px] truncate">{l.reason || '—'}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_STYLES[l.status] || ''}`}>{l.status?.toUpperCase()}</span>
                    {l.rejection_reason && <p className="text-red-400 text-xs mt-1">{l.rejection_reason}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EmpLeave;
