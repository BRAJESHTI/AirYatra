import React, { useState, useEffect } from 'react';
import { CalendarDays, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

function HolidayCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hr/holidays', { params: { year } });
      setHolidays(res.data.holidays);
    } catch (e) { toast.error('Failed to load holidays'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  const add = async () => {
    if (!form.date || !form.name) return toast.error('Both date and name are required');
    setSaving(true);
    try {
      const res = await api.post('/hr/holidays', form);
      toast.success(res.data.message);
      setOpen(false);
      setForm({ date: '', name: '' });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add holiday');
    } finally { setSaving(false); }
  };

  const remove = async (h) => {
    try {
      await api.delete(`/hr/holidays/${h.id}`);
      toast.success(`${h.name} removed`);
      await load();
    } catch (e) { toast.error('Failed to remove holiday'); }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6" data-testid="holiday-calendar">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Holiday Calendar</h1>
          <p className="text-slate-400 text-sm">Company holidays automatically count as paid days in payroll</p>
        </div>
        <div className="flex gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm" data-testid="holiday-year-select">
            {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button onClick={() => setOpen(true)} className="bg-purple-500 hover:bg-purple-600" data-testid="add-holiday-btn">
            <Plus className="h-4 w-4 mr-2" />Add Holiday
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>
      ) : holidays.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-10 text-center border border-slate-700">
          <CalendarDays className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-medium">No holidays added for {year}</p>
          <p className="text-slate-400 text-sm">Add Diwali, Holi, Republic Day etc. — payroll will treat them as paid days</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {holidays.map((h) => {
            const past = h.date < today;
            return (
              <div key={h.id} className={`rounded-xl p-4 border flex items-center justify-between gap-3 ${past ? 'bg-slate-800/30 border-slate-700/50 opacity-60' : 'bg-slate-800/50 border-slate-700'}`} data-testid={`holiday-card-${h.id}`}>
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500/20 rounded-lg px-3 py-2 text-center min-w-[58px]">
                    <p className="text-purple-300 text-lg font-bold leading-none">{new Date(h.date + 'T00:00:00').getDate()}</p>
                    <p className="text-purple-400 text-[10px] uppercase">{new Date(h.date + 'T00:00:00').toLocaleString('en', { month: 'short' })}</p>
                  </div>
                  <div>
                    <p className="text-white font-medium">{h.name}</p>
                    <p className="text-slate-500 text-xs">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}{h.date === today ? ' • Today 🎉' : ''}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(h)} className="text-red-400 hover:text-red-300 h-8 w-8 p-0" data-testid={`delete-holiday-${h.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-slate-800 border-slate-700 mt-1" data-testid="holiday-date-input" />
            </div>
            <div>
              <Label className="text-slate-300">Holiday Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali" className="bg-slate-800 border-slate-700 mt-1" data-testid="holiday-name-input" />
            </div>
            <Button onClick={add} disabled={saving} className="w-full bg-purple-500 hover:bg-purple-600" data-testid="save-holiday-btn">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Holiday
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HolidayCalendar;
