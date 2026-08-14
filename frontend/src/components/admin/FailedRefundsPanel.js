import React, { useState, useEffect } from 'react';
import { AlertOctagon, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';
import { toast } from 'sonner';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function FailedRefundsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [markId, setMarkId] = useState(null);
  const [remark, setRemark] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/refunds/failed-gateway');
      setRequests(res.data.requests || []);
    } catch (e) {
      if (e.response?.status !== 403) toast.error('Failed to load failed refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const retry = async (r) => {
    setBusy(`retry-${r.id}`);
    try {
      const res = await api.post(`/refunds/${r.id}/retry-gateway`);
      if (res.data.gateway_refund?.triggered) {
        toast.success(res.data.message);
      } else {
        toast.error(res.data.message);
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Retry failed');
    } finally {
      setBusy('');
    }
  };

  const markProcessed = async (r) => {
    if (!remark.trim()) { toast.error('Remark required'); return; }
    setBusy(`mark-${r.id}`);
    try {
      const res = await api.post(`/refunds/${r.id}/mark-processed`, { remark });
      toast.success(res.data.message);
      setMarkId(null);
      setRemark('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to mark processed');
    } finally {
      setBusy('');
    }
  };

  if (loading) return null;

  return (
    <div className="mt-10" data-testid="failed-refunds-panel">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-red-400" /> Failed Gateway Refunds
            {requests.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400" data-testid="failed-refunds-count">
                {requests.length}
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-sm">Approved refunds where the Razorpay auto-refund failed or no payment ID was found — retry or mark as manually processed here.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="border-slate-600 text-slate-300" data-testid="refresh-failed-refunds-btn">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {requests.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6 glass rounded-xl" data-testid="no-failed-refunds">
          No failed gateway refunds — all clear! ✅
        </p>
      ) : (
        <div className="glass rounded-xl overflow-x-auto border border-red-500/20">
          <table className="w-full text-sm" data-testid="failed-refunds-table">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-left text-xs uppercase">
                {['Booking Ref', 'Failure', 'Approved At', 'Refund Due', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-b border-slate-800 hover:bg-slate-800/40" data-testid={`failed-refund-${r.id}`}>
                    <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{r.booking_ref}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 uppercase whitespace-nowrap">
                        {r.gateway_refund_status === 'failed' ? 'Gateway Failed' : 'No Payment ID'}
                      </span>
                      {r.gateway_refund_error && <p className="text-slate-500 text-[11px] mt-1 max-w-[220px] truncate">{r.gateway_refund_error}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{r.approved_at ? new Date(r.approved_at).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 text-red-400 font-bold whitespace-nowrap">{fmt(r.refundable_amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 h-8 whitespace-nowrap" disabled={busy === `retry-${r.id}`}
                          onClick={() => retry(r)} data-testid={`retry-refund-btn-${r.id}`}>
                          {busy === `retry-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" /> Retry</>}
                        </Button>
                        <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10 h-8 whitespace-nowrap"
                          onClick={() => { setMarkId(markId === r.id ? null : r.id); setRemark(''); }} data-testid={`mark-processed-btn-${r.id}`}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Processed
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {markId === r.id && (
                    <tr className="border-b border-slate-800 bg-slate-800/40">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder="Manual refund details (UTR/reference)..."
                            className="bg-slate-900 border-slate-700 text-white flex-1 min-w-[220px] h-9"
                            data-testid={`mark-remark-input-${r.id}`}
                          />
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 h-9" disabled={busy === `mark-${r.id}` || !remark.trim()}
                            onClick={() => markProcessed(r)} data-testid={`confirm-mark-btn-${r.id}`}>
                            {busy === `mark-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Confirm
                          </Button>
                          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-9" onClick={() => { setMarkId(null); setRemark(''); }}>
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
