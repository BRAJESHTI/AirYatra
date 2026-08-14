import React, { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, IndianRupee, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';
import FailedRefundsPanel from './FailedRefundsPanel';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function RefundApprovals() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [otp, setOtp] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/refunds/pending');
      setRequests(res.data.requests || []);
    } catch (e) {
      toast.error('Failed to load pending refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sendOtp = async (req) => {
    setBusy(`otp-${req.id}`);
    try {
      const res = await api.post(`/refunds/${req.id}/request-otp`);
      toast.success(res.data.message);
      setActive(req.id);
      setOtp('');
      setRemark('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP send failed');
    } finally {
      setBusy('');
    }
  };

  const decide = async (req, action) => {
    if (otp.length !== 6) { toast.error('6-digit OTP daalein'); return; }
    if (!remark.trim()) { toast.error('Remark required'); return; }
    setBusy(`${action}-${req.id}`);
    try {
      const res = await api.post(`/refunds/${req.id}/approve`, { otp, remark, action });
      toast.success(res.data.message);
      setActive(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || `${action} failed`);
    } finally {
      setBusy('');
    }
  };

  if (loading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>;

  return (
    <div className="max-w-4xl" data-testid="refund-approvals-panel">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-orange-400" /> Refund Approvals
          </h2>
          <p className="text-slate-400 text-sm">2 approvers chahiye (Sales/Accounts/Finance/Admin/CEO). Trip complete/invoice ke baad sirf Admin/CEO. Har approval OTP-verified.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="border-slate-600 text-slate-300" data-testid="refresh-refunds-btn">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {requests.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-10" data-testid="no-pending-refunds">Koi pending refund request nahi. 🎉</p>
      )}

      <div className="space-y-4">
        {requests.map((r) => (
          <div key={r.id} className="glass rounded-xl p-4" data-testid={`refund-request-${r.id}`}>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold">{r.booking_ref}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${r.initiated_by === 'operator_cancel' ? 'bg-blue-500/20 text-blue-300' : r.initiated_by === 'customer_cancel' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-purple-500/20 text-purple-300'}`}>
                    {r.initiated_by.replace('_', ' ')}
                  </span>
                  {r.requires_admin_only && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 uppercase" data-testid={`admin-only-badge-${r.id}`}>
                      Admin/CEO Only
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                    {(r.approvals || []).length}/2 approvals
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  Paid {fmt(r.amount_paid)} • Deduction {r.deduction_pct}% ({fmt(r.deduction_amount)})
                  {r.operator_reason ? ` • Reason: ${r.operator_reason}` : ''}{r.reason ? ` • ${r.reason}` : ''}
                </p>
                {(r.approvals || []).map((a, i) => (
                  <p key={i} className="text-green-400 text-xs mt-0.5">✓ {a.name} ({a.role}): "{a.remark}"</p>
                ))}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] uppercase">Refundable</p>
                <p className="text-green-400 font-bold text-xl flex items-center gap-1 justify-end">
                  <IndianRupee className="h-4 w-4" />{Number(r.refundable_amount).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {active === r.id ? (
              <div className="mt-3 flex items-center gap-2 flex-wrap bg-slate-800/60 rounded-lg p-3" data-testid={`approval-form-${r.id}`}>
                <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit OTP" className="bg-slate-900 border-slate-600 w-32 h-9 text-white tracking-widest"
                  data-testid={`otp-input-${r.id}`} />
                <Input value={remark} onChange={(e) => setRemark(e.target.value)}
                  placeholder="Remark (required)" className="bg-slate-900 border-slate-600 flex-1 min-w-[180px] h-9 text-white"
                  data-testid={`remark-input-${r.id}`} />
                <Button size="sm" onClick={() => decide(r, 'approve')} disabled={!!busy}
                  className="bg-green-600 hover:bg-green-500 h-9" data-testid={`approve-btn-${r.id}`}>
                  {busy === `approve-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                </Button>
                <Button size="sm" onClick={() => decide(r, 'reject')} disabled={!!busy}
                  className="bg-red-600 hover:bg-red-500 h-9" data-testid={`reject-btn-${r.id}`}>
                  Reject
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => sendOtp(r)} disabled={!!busy}
                className="mt-3 bg-orange-500 hover:bg-orange-600 h-9" data-testid={`send-otp-btn-${r.id}`}>
                {busy === `otp-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : '🔐 Send OTP & Review'}
              </Button>
            )}
          </div>
        ))}
      </div>

      <FailedRefundsPanel />
    </div>
  );
}
