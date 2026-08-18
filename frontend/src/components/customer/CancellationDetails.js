import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check, X, Clock } from 'lucide-react';

const fmt = (n) => (n === null || n === undefined) ? '—' : `₹${Number(n).toLocaleString('en-IN')}`;
const dt = (s) => s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const CHAIN = ['Cancellation Requested', 'Under Admin/Finance Review', 'Approved / Rejected', 'Refund Processing', 'Refund Completed'];

export default function CancellationDetails({ refund, open, onClose }) {
  if (!refund) return null;
  const d = refund.details || {};
  const rejected = refund.rejected;
  const chainIdx = rejected ? 2
    : d.refund_status === 'Refund Completed' ? 4
    : d.refund_status === 'Refund Processing' ? 3
    : (refund.status === 'approved' ? 2 : 1);

  const rows = [
    ['Booking ID', refund.booking_ref],
    ['Cancellation Request ID', d.request_id],
    ['Request Date & Time', dt(d.requested_at)],
    ['Cancellation Reason', d.reason],
    ['Requested By', d.requested_by],
    ['Booking Amount', fmt(d.booking_amount)],
    ['Amount Paid', fmt(d.amount_paid)],
    ['Cancellation Charges / Penalty', `${fmt(d.cancellation_charges)} (${d.deduction_pct ?? 0}% as per policy)`],
    ['Refund Eligible Amount', fmt(d.refund_eligible_amount)],
    ['Refund Status', d.refund_status],
    ['Refund Method', d.refund_method],
    ['Admin/Finance Decision', d.decision],
    ['Decision Date', dt(d.decision_at)],
    ['Remarks', d.remarks || '—'],
    ['Expected Refund Timeline', d.expected_timeline],
    ['Actual Refund Date', dt(d.refund_credited_at)],
    ['Refund Transaction / Reference ID', d.refund_reference_id || '—'],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[85vh] overflow-y-auto" data-testid="cancellation-details-dialog">
        <DialogHeader>
          <DialogTitle>Cancellation Request — {refund.booking_ref}</DialogTitle>
          <DialogDescription className="text-slate-400">Complete refund & cancellation details</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 mb-3" data-testid="cancellation-status-chain">
          {CHAIN.map((step, i) => {
            const isReject = rejected && i === 2;
            const done = !rejected && i <= chainIdx;
            const active = i === chainIdx;
            return (
              <div key={step} className="flex items-center gap-2 text-sm">
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] border ${
                  isReject ? 'bg-red-500/20 border-red-500 text-red-400'
                    : done ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-slate-800 border-slate-600 text-slate-500'}`}>
                  {isReject ? <X className="h-3 w-3" /> : done ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                </span>
                <span className={isReject ? 'text-red-400' : done ? 'text-green-400' : active ? 'text-white' : 'text-slate-500'}>
                  {isReject ? 'Rejected' : step}
                </span>
              </div>
            );
          })}
        </div>

        {rejected && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-2" data-testid="rejection-reason-box">
            <b>Rejection reason:</b> {refund.reject_remark || d.remarks || 'Not specified'} — contact support@airyatra.co.in
          </div>
        )}

        <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden" data-testid="cancellation-details-table">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-3 py-2 text-sm">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-100 text-right break-all">{value ?? '—'}</span>
            </div>
          ))}
        </div>

        {(d.approvals || []).length > 0 && (
          <div className="mt-2">
            <p className="text-slate-400 text-xs uppercase mb-1">Approval Trail</p>
            {d.approvals.map((a, i) => (
              <p key={i} className="text-sm text-slate-300">
                ✓ <span className="capitalize">{a.role}</span>{a.approver ? ` (${a.approver})` : ''} — {a.remark || 'approved'} <span className="text-slate-500 text-xs">{dt(a.at)}</span>
              </p>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
