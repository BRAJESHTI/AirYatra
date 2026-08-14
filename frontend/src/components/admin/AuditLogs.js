import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollText, ShieldAlert, Download, RefreshCw, Loader2, Radio, ShieldCheck } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

const PRESETS = [['', 'All Time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['this_week', 'This Week'], ['this_month', 'This Month'], ['custom', 'Custom Range']];
const ROLES = ['', 'customer', 'operator', 'pilot', 'helipad_owner', 'yacht_owner', 'cruise_operator', 'sales', 'finance', 'hr_admin', 'admin', 'super_admin', 'ceo'];
const REPORTS = [['user_activity', 'User Activity'], ['login', 'Login Report'], ['failed_login', 'Failed Logins'], ['logout', 'Logout Report'], ['approval', 'Approvals'], ['refund', 'Refunds'], ['financial', 'Financial Audit'], ['invoice', 'Invoice Audit'], ['receipt', 'Receipt Audit'], ['role_change', 'Role Changes'], ['document', 'Documents'], ['security', 'Security'], ['suspicious', 'Suspicious'], ['api_audit', 'API Audit'], ['device', 'Device Audit'], ['location', 'Location Audit']];
const RISK_C = { low: 'bg-slate-700 text-slate-300', medium: 'bg-amber-500/20 text-amber-400', high: 'bg-orange-500/20 text-orange-400', critical: 'bg-red-500/20 text-red-400' };

export default function AuditLogs() {
  const [tab, setTab] = useState('feed');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [alerts, setAlerts] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({ preset: 'this_month', from_date: '', to_date: '', role: '', action: '', search: '', report_type: '' });
  const [live, setLive] = useState(true);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v && v !== 'custom') params.set(k, v); });
      if (f.preset === 'custom') { params.delete('preset'); }
      const r = await api.get(`/admin/audit-trail/feed?${params.toString()}&limit=100`);
      setLogs(r.data.logs); setTotal(r.data.total);
    } catch (e) {} finally { setLoading(false); }
  }, [f]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (live && tab === 'feed') {
      timerRef.current = setInterval(load, 10000);
      return () => clearInterval(timerRef.current);
    }
  }, [live, tab, load]);

  const loadSuspicious = async () => {
    setLoading(true);
    try { setAlerts((await api.get('/admin/audit-trail/suspicious?days=30')).data); }
    catch (e) {} finally { setLoading(false); }
  };
  const checkIntegrity = async () => {
    try { setIntegrity((await api.get('/admin/audit-trail/verify-integrity')).data); } catch (e) {}
  };

  const exportReport = async (fmt) => {
    try {
      const params = new URLSearchParams({ format: fmt, report_type: f.report_type || 'user_activity' });
      if (f.preset && f.preset !== 'custom') params.set('preset', f.preset);
      if (f.from_date) params.set('from_date', f.from_date);
      if (f.to_date) params.set('to_date', f.to_date);
      if (f.search) params.set('search', f.search);
      const r = await api.get(`/admin/audit-trail/export?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `audit_report.${fmt === 'excel' ? 'xlsx' : fmt}`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${fmt.toUpperCase()} report downloaded`);
    } catch (e) { toast.error('Export failed'); }
  };

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4" data-testid="audit-trail-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-orange-400" /> Audit Trail
          {live && tab === 'feed' && <span className="flex items-center gap-1 text-green-400 text-xs font-normal"><Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE</span>}
        </h2>
        <div className="flex gap-2">
          <Button variant={tab === 'feed' ? 'default' : 'outline'} className={tab === 'feed' ? 'bg-orange-500' : 'border-slate-600 text-slate-300'} onClick={() => setTab('feed')} data-testid="tab-feed">Live Feed</Button>
          <Button variant={tab === 'suspicious' ? 'default' : 'outline'} className={tab === 'suspicious' ? 'bg-orange-500' : 'border-slate-600 text-slate-300'} onClick={() => { setTab('suspicious'); loadSuspicious(); }} data-testid="tab-suspicious">
            <ShieldAlert className="h-4 w-4 mr-1" /> Suspicious
          </Button>
          <Button variant="outline" className="border-slate-600 text-slate-300" onClick={checkIntegrity} data-testid="verify-integrity-btn">
            <ShieldCheck className="h-4 w-4 mr-1" /> Verify Integrity
          </Button>
        </div>
      </div>

      {integrity && (
        <div className={`glass rounded-lg p-3 text-sm ${integrity.integrity === 'OK' ? 'text-green-400 border border-green-500/30' : 'text-red-400 border border-red-500/40'}`} data-testid="integrity-result">
          🔏 Integrity: {integrity.integrity} — {integrity.checked} signed logs checked, {integrity.tampered} tampered. {integrity.note}
        </div>
      )}

      {tab === 'feed' && (
        <>
          <div className="glass rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="audit-filters">
            <select value={f.preset} onChange={e => set('preset', e.target.value)} className="bg-slate-800 border border-slate-700 text-white h-9 rounded-md px-2 text-sm" data-testid="filter-preset">
              {PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {f.preset === 'custom' && <>
              <Input type="date" value={f.from_date} onChange={e => set('from_date', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" data-testid="filter-from" />
              <Input type="date" value={f.to_date} onChange={e => set('to_date', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" data-testid="filter-to" />
            </>}
            <select value={f.role} onChange={e => set('role', e.target.value)} className="bg-slate-800 border border-slate-700 text-white h-9 rounded-md px-2 text-sm" data-testid="filter-role">
              {ROLES.map(r => <option key={r} value={r}>{r || 'All Roles'}</option>)}
            </select>
            <select value={f.report_type} onChange={e => set('report_type', e.target.value)} className="bg-slate-800 border border-slate-700 text-white h-9 rounded-md px-2 text-sm" data-testid="filter-report-type">
              <option value="">All Modules</option>
              {REPORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Input placeholder="Action (e.g. login)" value={f.action} onChange={e => set('action', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" data-testid="filter-action" />
            <Input placeholder="Search user/ID/IP/booking..." value={f.search} onChange={e => set('search', e.target.value)} className="bg-slate-800 border-slate-700 text-white h-9" data-testid="filter-search" />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-slate-400 text-sm">{total.toLocaleString()} records • showing latest {logs.length}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8" onClick={() => setLive(!live)} data-testid="toggle-live-btn">
                <Radio className={`h-3.5 w-3.5 mr-1 ${live ? 'text-green-400' : ''}`} /> {live ? 'Live ON' : 'Live OFF'}
              </Button>
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8" onClick={load}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
              {['csv', 'excel', 'pdf'].map(fmt => (
                <Button key={fmt} size="sm" variant="outline" className="border-orange-500/50 text-orange-400 h-8" onClick={() => exportReport(fmt)} data-testid={`export-${fmt}-btn`}>
                  <Download className="h-3.5 w-3.5 mr-1" /> {fmt.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl overflow-x-auto">
            <table className="w-full text-sm" data-testid="audit-logs-table">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left text-xs uppercase">
                  {['Time (IST)', 'Action', 'User', 'Roles', 'Resource', 'IP / Device', 'Status', 'Risk', '🔏'].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No audit records for these filters</td></tr>
                ) : logs.map((l, i) => (
                  <tr key={l.id || i} className="border-b border-slate-800/70 hover:bg-slate-800/40" data-testid={`audit-row-${i}`}>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-xs">{l.time ? new Date(l.time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</td>
                    <td className="px-3 py-2.5 text-white font-medium">{l.action}</td>
                    <td className="px-3 py-2.5 text-slate-300">{l.user_name}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">{(l.roles || []).join(', ')}</td>
                    <td className="px-3 py-2.5 text-slate-400 text-xs max-w-[160px] truncate">{l.resource || l.details}</td>
                    <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                      {l.ip}{l.browser ? ` • ${l.browser}/${l.os}` : ''}
                      {l.location && <span className="block text-[10px] text-cyan-400/80" data-testid={`geo-${i}`}>📍 {l.location}</span>}
                    </td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full ${l.status === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{l.status}</span></td>
                    <td className="px-3 py-2.5"><span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${RISK_C[l.risk] || RISK_C.low}`}>{l.risk}</span></td>
                    <td className="px-3 py-2.5">{l.signed ? '🔏' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'suspicious' && (
        <div className="space-y-3" data-testid="suspicious-panel">
          {loading && <Loader2 className="h-6 w-6 animate-spin text-orange-400 mx-auto" />}
          {alerts && alerts.count === 0 && <div className="glass rounded-xl p-8 text-center text-green-400">✅ No suspicious activity detected in last {alerts.window_days} days</div>}
          {alerts && alerts.alerts.map((a, i) => (
            <div key={i} className={`glass rounded-lg p-4 flex items-start gap-3 border ${a.severity === 'high' ? 'border-red-500/30' : 'border-amber-500/30'}`} data-testid={`alert-${i}`}>
              <ShieldAlert className={`h-5 w-5 shrink-0 ${a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
              <div>
                <p className="text-white text-sm font-medium">{a.type.replace(/_/g, ' ').toUpperCase()}
                  <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full uppercase ${a.severity === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{a.severity}</span>
                </p>
                <p className="text-slate-400 text-xs mt-0.5">{a.summary}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
