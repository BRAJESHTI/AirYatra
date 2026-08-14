import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Rocket, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import api from '@/services/api';

const ICON = {
  ready: <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />,
  pending: <XCircle className="h-5 w-5 text-red-400 shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />,
};

export default function LaunchChecklist() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/launch-checklist');
      setData(r.data);
    } catch (e) {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading && !data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>;
  if (!data) return null;

  const groups = [...new Set(data.items.map(i => i.category))];

  return (
    <div className="max-w-4xl space-y-6" data-testid="launch-checklist">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Rocket className="h-6 w-6 text-orange-400" /> Go-Live Launch Checklist
          </h2>
          <p className="text-slate-400 text-sm mt-1">Live production-readiness checks — refresh anytime</p>
        </div>
        <Button variant="outline" className="border-slate-600 text-slate-300" onClick={load} disabled={loading} data-testid="refresh-checklist-btn">
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className={`glass rounded-xl p-5 border ${data.go_live_ready ? 'border-green-500/40' : 'border-red-500/30'}`} data-testid="readiness-summary">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="relative h-24 w-24">
            <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3.2" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={data.score_pct >= 80 ? '#22c55e' : data.score_pct >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="3.2" strokeDasharray={`${data.score_pct}, 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">{data.score_pct}%</span>
          </div>
          <div className="flex gap-6 flex-wrap">
            <div><p className="text-3xl font-bold text-green-400">{data.ready}</p><p className="text-slate-500 text-xs uppercase">Ready</p></div>
            <div><p className="text-3xl font-bold text-red-400">{data.blockers}</p><p className="text-slate-500 text-xs uppercase">Blockers</p></div>
            <div><p className="text-3xl font-bold text-amber-400">{data.warnings}</p><p className="text-slate-500 text-xs uppercase">Warnings</p></div>
          </div>
          <p className={`ml-auto text-sm font-semibold ${data.go_live_ready ? 'text-green-400' : 'text-red-400'}`}>
            {data.go_live_ready ? '🚀 Ready to launch!' : `${data.blockers} blocker(s) before go-live`}
          </p>
        </div>
      </div>

      {groups.map(cat => (
        <div key={cat} className="glass rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">{cat}</div>
          {data.items.filter(i => i.category === cat).map((i, idx) => (
            <div key={idx} className="px-5 py-3.5 flex items-start gap-3 border-b border-slate-800/60 last:border-0"
              data-testid={`check-${i.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
              {ICON[i.status]}
              <div>
                <p className={`text-sm font-medium ${i.status === 'ready' ? 'text-slate-200' : i.status === 'warning' ? 'text-amber-300' : 'text-red-300'}`}>{i.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{i.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
