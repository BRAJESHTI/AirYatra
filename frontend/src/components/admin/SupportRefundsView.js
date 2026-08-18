import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STATUS_STYLES = {
  pending_approval: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const isCredited = (r) => r.manual_processed || r.refund_credit_status === 'SUCCESS' ||
  (r.gateway_refund_id && r.gateway !== 'cashfree');
const isInitiated = (r) => !isCredited(r) && !!r.gateway_refund_id;

export default function SupportRefundsView() {
  const [data, setData] = useState({ requests: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/refunds/care-view');
      setData(res.data);
    } catch (e) {
      console.error('Failed to load refunds', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = data.requests.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'credited') return isCredited(r);
    return r.status === filter;
  });

  return (
    <div className="space-y-6" data-testid="support-refunds-view">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-orange-400" /> Refund Requests
          </h1>
          <p className="text-slate-400">Read-only view for customer care — track cancellations & refund status</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} data-testid="refresh-refunds-btn">
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/40">
          <p className="text-2xl font-bold text-white" data-testid="refund-stat-pending">{data.stats.pending || 0}</p>
          <p className="text-slate-400 text-sm">Pending Approval</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/40">
          <p className="text-2xl font-bold text-white" data-testid="refund-stat-approved">{data.stats.approved || 0}</p>
          <p className="text-slate-400 text-sm">Approved</p>
        </div>
        <div className="bg-sky-500/10 rounded-lg p-4 border border-sky-500/40">
          <p className="text-2xl font-bold text-white" data-testid="refund-stat-credited">{data.stats.credited || 0}</p>
          <p className="text-slate-400 text-sm">Credited</p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/40">
          <p className="text-2xl font-bold text-white" data-testid="refund-stat-rejected">{data.stats.rejected || 0}</p>
          <p className="text-slate-400 text-sm">Rejected</p>
        </div>
      </div>

      <div className="flex gap-2">
        {['all', 'pending_approval', 'approved', 'credited', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`refund-filter-${f}`}
            className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>
      ) : rows.length === 0 ? (
        <p className="text-slate-400 text-center py-12" data-testid="no-refunds-message">No refund requests found.</p>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm" data-testid="refunds-table">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="p-3">Booking</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Deduction</th>
                <th className="p-3">Refundable</th>
                <th className="p-3">Initiated By</th>
                <th className="p-3">Status</th>
                <th className="p-3">Requested</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-700/50 text-slate-200" data-testid={`refund-row-${r.booking_ref}`}>
                  <td className="p-3 font-medium">{r.booking_ref}</td>
                  <td className="p-3">{fmt(r.amount_paid)}</td>
                  <td className="p-3 text-red-400">-{fmt(r.deduction_amount)} ({r.deduction_pct}%)</td>
                  <td className="p-3 text-green-400 font-semibold">{fmt(r.refundable_amount)}</td>
                  <td className="p-3 capitalize">{(r.initiated_by || '').replace('_', ' ')}</td>
                  <td className="p-3">
                    {isCredited(r) ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-sky-500/20 text-sky-400">Credited</span>
                    ) : isInitiated(r) ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-indigo-500/20 text-indigo-400">Refund Initiated</span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLES[r.status] || 'bg-slate-600/30 text-slate-300'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400">{(r.created_at || '').slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
