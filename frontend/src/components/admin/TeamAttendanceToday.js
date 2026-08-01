import React, { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Loader2, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATUS_META = {
  in_office: { label: 'In Office / उपस्थित', dot: 'bg-green-400', chip: 'bg-green-500/20 text-green-400' },
  checked_out: { label: 'Checked Out / चेक-आउट', dot: 'bg-sky-400', chip: 'bg-sky-500/20 text-sky-400' },
  on_leave: { label: 'On Leave / छुट्टी पर', dot: 'bg-yellow-400', chip: 'bg-yellow-500/20 text-yellow-400' },
  missing: { label: 'Missing / अनुपस्थित', dot: 'bg-red-400', chip: 'bg-red-500/20 text-red-400' },
};

function TeamAttendanceToday() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/hr/attendance/today');
      setData(res.data);
    } catch (e) { if (!silent) toast.error('Failed to load team attendance'); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !data) return <div className="text-slate-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading team...</div>;
  if (!data) return null;

  const cards = [
    { key: 'in_office', color: 'text-green-400', border: 'border-green-500/40 bg-green-500/10' },
    { key: 'checked_out', color: 'text-sky-400', border: 'border-sky-500/40 bg-sky-500/10' },
    { key: 'on_leave', color: 'text-yellow-400', border: 'border-yellow-500/40 bg-yellow-500/10' },
    { key: 'missing', color: 'text-red-400', border: 'border-red-500/40 bg-red-500/10' },
  ];
  const team = filter === 'all' ? data.team : data.team.filter((t) => t.status === filter);

  return (
    <div className="space-y-6" data-testid="team-attendance-today">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Today / आज की टीम</h1>
          <p className="text-slate-400 text-sm">{data.date} • {data.counts.total} staff • auto-refreshes every 30s</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} className="border-slate-600 text-slate-300" data-testid="refresh-team-btn">
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {data.is_holiday && (
        <div className="bg-purple-500/15 border border-purple-500/40 rounded-xl p-4 flex items-center gap-3" data-testid="holiday-banner">
          <PartyPopper className="h-6 w-6 text-purple-400" />
          <p className="text-white">Aaj company holiday hai: <b>{data.holiday_name}</b> 🎉</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <button key={c.key} onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
            className={`rounded-xl p-4 border text-left transition-transform hover:scale-[1.02] ${c.border} ${filter === c.key ? 'ring-2 ring-white/40' : ''}`}
            data-testid={`team-count-${c.key}`}>
            <p className={`text-3xl font-bold ${c.color}`}>{data.counts[c.key]}</p>
            <p className="text-slate-300 text-sm">{STATUS_META[c.key].label}</p>
          </button>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="text-left p-3 text-slate-400">Employee</th>
              <th className="text-left p-3 text-slate-400">Dept / Role</th>
              <th className="text-left p-3 text-slate-400">Check In</th>
              <th className="text-left p-3 text-slate-400">Check Out</th>
              <th className="text-center p-3 text-slate-400">Selfie</th>
              <th className="text-center p-3 text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((t) => {
              const meta = STATUS_META[t.status];
              return (
                <tr key={t.id} className="border-t border-slate-700/60" data-testid={`team-row-${t.id}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} ${t.status === 'in_office' ? 'animate-pulse' : ''}`} />
                      <div>
                        <p className="text-white font-medium">{t.full_name}</p>
                        <p className="text-slate-500 text-xs">{t.employee_code || t.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-slate-300">{t.department || '—'}<p className="text-slate-500 text-xs capitalize">{t.designation || (t.roles || []).join(', ')}</p></td>
                  <td className="p-3 text-slate-300">{t.check_in_time ? new Date(t.check_in_time).toLocaleTimeString() : '—'}</td>
                  <td className="p-3 text-slate-300">{t.check_out_time ? `${new Date(t.check_out_time).toLocaleTimeString()} (${t.total_hours}h)` : '—'}</td>
                  <td className="p-3 text-center">
                    {t.selfie_url ? (
                      <a href={`${BACKEND}${t.selfie_url}`} target="_blank" rel="noreferrer">
                        <img src={`${BACKEND}${t.selfie_url}`} alt="selfie" className="h-8 w-8 rounded-full object-cover border border-slate-600 inline-block hover:scale-150 transition-transform" />
                      </a>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${meta.chip}`}>
                      {t.status === 'on_leave' && t.leave_type ? `${t.leave_type.toUpperCase()} LEAVE` : meta.label.split(' / ')[0].toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
            {team.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400"><Users className="h-10 w-10 mx-auto mb-2 text-slate-600" />No staff in this filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TeamAttendanceToday;
