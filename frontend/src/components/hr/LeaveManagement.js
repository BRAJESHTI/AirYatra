import React, { useState, useEffect } from 'react';
import { CalendarDays, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { toast } from 'sonner';

const badge = (s) => ({
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
}[s] || 'bg-slate-700 text-slate-300');

export default function LeaveManagement() {
  const [data, setData] = useState({ leaves: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState('');

  const load = async (f = filter) => {
    setLoading(true);
    try {
      const res = await api.get(`/hr/leave/all${f ? `?status=${f}` : ''}`);
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const act = async (leave, action) => {
    setBusy(`${action}-${leave.id}`);
    try {
      const body = action === 'reject' ? { rejection_reason: 'Rejected by HR' } : {};
      await api.put(`/hr/leave/${leave.id}/${action}`, body);
      toast.success(`Leave ${action}d for ${leave.employee_name}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <div data-testid="leave-management">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-orange-400" /> Leave Management
          </h1>
          <p className="text-slate-400 text-sm">Approve or reject employee leave applications.</p>
        </div>
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'rejected'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === f ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
              data-testid={`leave-filter-${f || 'all'}`}>
              {f || 'All'} {f && data.counts?.[f] != null ? `(${data.counts[f]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>
      ) : (
        <div className="glass rounded-xl overflow-x-auto">
          <table className="w-full text-sm" data-testid="leaves-table">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-left">
                {['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.leaves.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No leave applications found</td></tr>
              ) : data.leaves.map((l) => (
                <tr key={l.id} className="border-b border-slate-800 text-slate-200">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{l.employee_name}</td>
                  <td className="px-4 py-3 capitalize">{l.leave_type}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{l.start_date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{l.end_date}</td>
                  <td className="px-4 py-3">{l.days}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{l.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${badge(l.status)}`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {l.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" disabled={!!busy}
                          onClick={() => act(l, 'approve')} data-testid={`approve-leave-${l.id}`}>
                          {busy === `approve-${l.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8" disabled={!!busy}
                          onClick={() => act(l, 'reject')} data-testid={`reject-leave-${l.id}`}>
                          {busy === `reject-${l.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">{l.approved_by ? `by ${l.approved_by}` : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
