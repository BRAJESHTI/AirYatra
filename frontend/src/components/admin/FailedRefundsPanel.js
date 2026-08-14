import React, { useState, useEffect } from 'react';
import { AlertOctagon, RefreshCw, IndianRupee, Loader2, CheckCircle2 } from 'lucide-react';
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
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="glass rounded-xl p-4 border border-red-500/20" data-testid={`failed-refund-${r.id}`}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold">{r.booking_ref}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 uppercase">
                      {r.gateway_refund_status === 'failed' ? 'Gateway Failed' : 'No Payment ID'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    Approved: {r.approved_at ? new Date(r.approved_at).toLocaleString('en-IN') : '—'}
                    {r.gateway_refund_error ? ` • Error: ${r.gateway_refund_error}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-[10px] uppercase">Refund Due</p>
                  <p className="text-red-400 font-bold text-lg flex items-center gap-1 justify-end">
                    <IndianRupee className="h-4 w-4" />{Number(r.refundable_amount).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {markId === r.id ? (
                <div className="mt-3 flex items-center gap-2 flex-wrap bg-slate-800/60 rounded-lg p-3">
                  <Input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Manual refund details (UTR/reference)..."
                    className="bg-slate-900 border-slate-700 text-white flex-1 min-w-[220px]"
                    data-testid={`mark-remark-input-${r.id}`}
                  />
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={busy === `mark-${r.id}` || !remark.trim()}
                    onClick={() => markProcessed(r)} data-testid={`confirm-mark-btn-${r.id}`}>
                    {busy === `mark-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Confirm
                  </Button>
                  <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setMarkId(null); setRemark(''); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600" disabled={busy === `retry-${r.id}`}
                    onClick={() => retry(r)} data-testid={`retry-refund-btn-${r.id}`}>
                    {busy === `retry-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Retry Razorpay Refund
                  </Button>
                  <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                    onClick={() => { setMarkId(r.id); setRemark(''); }} data-testid={`mark-processed-btn-${r.id}`}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Manually Processed
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
