import React, { useState, useEffect } from 'react';
import { ShieldAlert, ChevronRight } from 'lucide-react';
import api from '@/services/api';

export default function SecurityAlertsFeed({ onNavigate }) {
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    // trigger fresh detection (persists + emails new highs), then read stored feed
    api.get('/admin/audit-trail/suspicious?days=7').catch(() => {}).finally(() => {
      api.get('/admin/audit-trail/alerts?limit=6').then(r => setAlerts(r.data.alerts || [])).catch(() => setAlerts([]));
    });
  }, []);

  if (!alerts) return null;

  return (
    <div className={`glass rounded-xl p-4 border ${alerts.length ? 'border-red-500/30' : 'border-green-500/20'}`} data-testid="security-alerts-feed">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
          <ShieldAlert className={`h-4 w-4 ${alerts.length ? 'text-red-400 animate-pulse' : 'text-green-400'}`} />
          Security Alerts
          {alerts.length > 0 && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full">{alerts.length}</span>}
        </h3>
        <button onClick={() => onNavigate && onNavigate('audit')} className="text-orange-400 text-xs flex items-center hover:underline" data-testid="view-all-alerts-btn">
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      {alerts.length === 0 ? (
        <p className="text-green-400/80 text-xs">✅ No suspicious activity detected recently</p>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((a, i) => (
            <div key={a.id || i} className="flex items-start gap-2 text-xs" data-testid={`feed-alert-${i}`}>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${a.severity === 'high' ? 'bg-red-400' : 'bg-amber-400'}`} />
              <p className="text-slate-300 leading-snug">
                <span className={`font-semibold ${a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`}>{(a.type || '').replace(/_/g, ' ')}</span>
                {' — '}{a.summary}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
