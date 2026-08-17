import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Webhook } from 'lucide-react';
import api from '@/services/api';

const fmtIST = (iso) => {
  try { return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso || '—'; }
};

const VerdictBadge = ({ v }) => {
  const map = {
    PASS: 'bg-green-500/20 text-green-400 border-green-500/40',
    FAIL: 'bg-red-500/20 text-red-400 border-red-500/40',
    PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${map[v] || map.PENDING}`}>{v}</span>;
};

const SummaryCard = ({ name, s }) => (
  <div className={`rounded-xl p-4 border ${s.verdict === 'PASS' ? 'border-green-500/40 bg-green-500/5' : s.verdict === 'FAIL' ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}
    data-testid={`gw-report-summary-${name.toLowerCase()}`}>
    <div className="flex items-center justify-between">
      <p className="text-white font-semibold">{name}</p>
      {s.verdict === 'PASS' ? <CheckCircle2 className="h-5 w-5 text-green-400" /> :
        s.verdict === 'FAIL' ? <XCircle className="h-5 w-5 text-red-400" /> : <Clock className="h-5 w-5 text-amber-400" />}
    </div>
    <p className="text-2xl font-bold text-white mt-1">{s.verdict}</p>
    <p className="text-slate-400 text-xs mt-1">
      {s.total} txns • <span className="text-green-400">{s.pass} pass</span> • <span className="text-red-400">{s.fail} fail</span> • <span className="text-amber-400">{s.pending} pending</span>
    </p>
    <p className="text-slate-500 text-[10px] mt-0.5 uppercase">{s.mode}</p>
  </div>
);

export default function GatewayTestReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/payments/cashfree/test-report')
      .then(r => setReport(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (!report && loading) return <div className="glass rounded-xl p-5 border border-slate-700/50 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-orange-400" /></div>;
  if (!report) return null;

  return (
    <div className="glass rounded-xl p-5 border border-slate-700/50" data-testid="gateway-test-report">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">Payment Gateway Test Report</h3>
          <p className="text-slate-500 text-xs mt-0.5">Test transactions (≤ ₹50) with webhook proof • Generated {fmtIST(report.generated_at)} IST</p>
        </div>
        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={load} disabled={loading} data-testid="gw-report-refresh-btn">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <SummaryCard name="Razorpay" s={report.summary.razorpay} />
        <SummaryCard name="Cashfree" s={report.summary.cashfree} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500 text-[11px] uppercase border-b border-slate-700/60">
              <th className="px-2 py-2">Gateway</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Order ID</th>
              <th className="px-2 py-2">Amount</th>
              <th className="px-2 py-2">Mode</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Webhook Proof</th>
              <th className="px-2 py-2">Time (IST)</th>
              <th className="px-2 py-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-slate-500">No test transactions yet</td></tr>
            )}
            {report.rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/30" data-testid={`gw-report-row-${i}`}>
                <td className="px-2 py-2">
                  <span className={`text-xs font-semibold ${r.gateway === 'razorpay' ? 'text-blue-400' : 'text-cyan-400'}`}>{r.gateway}</span>
                </td>
                <td className="px-2 py-2 text-slate-300 text-xs">{r.type}</td>
                <td className="px-2 py-2 font-mono text-slate-400 text-[11px]">{(r.order_id || '').slice(0, 24)}</td>
                <td className="px-2 py-2 text-white font-medium">₹{Number(r.amount || 0).toLocaleString('en-IN')}</td>
                <td className="px-2 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${['live', 'production'].includes(r.mode) ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>{r.mode}</span></td>
                <td className="px-2 py-2 text-slate-300 text-xs">{r.status}</td>
                <td className="px-2 py-2 text-xs">
                  {r.webhook_proof ? (
                    <span className="text-green-400 flex items-center gap-1"><Webhook className="h-3 w-3" /> {r.webhook_proof}</span>
                  ) : r.payment_id ? (
                    <span className="text-slate-400 font-mono text-[10px]">pay: {String(r.payment_id).slice(0, 18)}</span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2 text-slate-500 text-[11px] whitespace-nowrap">{fmtIST(r.created_at)}</td>
                <td className="px-2 py-2"><VerdictBadge v={r.verdict} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
