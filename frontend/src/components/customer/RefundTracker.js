import React, { useState } from 'react';
import { FileText, ShieldCheck, Wallet, Check, X, Eye } from 'lucide-react';
import CancellationDetails from './CancellationDetails';

const ICONS = { requested: FileText, approved: ShieldCheck, credited: Wallet };

export const RefundTracker = ({ refund }) => {
  const [showDetails, setShowDetails] = useState(false);
  if (!refund) return null;

  const detailsBtn = (
    <button onClick={() => setShowDetails(true)}
      className="text-orange-400 hover:text-orange-300 text-xs flex items-center gap-1 shrink-0"
      data-testid={`refund-details-btn-${refund.booking_id}`}>
      <Eye className="h-3.5 w-3.5" /> View Details
    </button>
  );

  if (refund.rejected) {
    return (
      <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2" data-testid={`refund-tracker-${refund.booking_id}`}>
        <X className="h-4 w-4 text-red-400" />
        <p className="text-red-400 text-sm flex-1">
          Refund request rejected{refund.reject_remark ? ` — ${refund.reject_remark}` : ''}. Contact support@airyatra.co.in
        </p>
        {detailsBtn}
        <CancellationDetails refund={refund} open={showDetails} onClose={() => setShowDetails(false)} />
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-lg bg-slate-800/60 border border-slate-700/60 w-full" data-testid={`refund-tracker-${refund.booking_id}`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-sm text-slate-300 font-medium">
          Refund ₹{Number(refund.refundable_amount).toLocaleString('en-IN')}
          {refund.deduction_pct > 0 && <span className="text-slate-500 text-xs ml-1">(after {refund.deduction_pct}% policy deduction)</span>}
        </p>
        <div className="flex items-center gap-3">
          {refund.refund_id && <span className="text-[10px] text-slate-500">Ref: {refund.refund_id}</span>}
          {detailsBtn}
        </div>
      </div>
      <CancellationDetails refund={refund} open={showDetails} onClose={() => setShowDetails(false)} />
      <div className="flex items-center">
        {refund.steps.map((s, i) => {
          const Icon = ICONS[s.key] || FileText;
          return (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div className={`flex-1 h-0.5 mx-1 ${refund.steps[i - 1].done ? 'bg-green-500' : 'bg-slate-700'}`} />
              )}
              <div className="flex flex-col items-center min-w-[90px]" data-testid={`refund-step-${s.key}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                  s.done ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-slate-800 border-slate-600 text-slate-500'
                }`}>
                  {s.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <p className={`text-[11px] mt-1 ${s.done ? 'text-green-400' : 'text-slate-500'}`}>{s.label}</p>
                {s.sub && <p className="text-[10px] text-slate-600">{s.sub}</p>}
                {s.at && s.done && <p className="text-[10px] text-slate-600">{new Date(s.at).toLocaleDateString('en-IN')}</p>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default RefundTracker;
