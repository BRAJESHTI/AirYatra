import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Zap, FlaskConical, ShieldAlert, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

export default function PaymentGatewayMode() {
  const [info, setInfo] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/razorpay/gateway-mode').then(r => setInfo(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  if (!info) return null;
  const isLive = info.mode === 'live';

  const switchMode = async (mode) => {
    setBusy(true);
    try {
      const body = mode === 'live' ? { mode, confirm: confirmText } : { mode };
      const res = await api.post('/razorpay/gateway-mode', body);
      toast.success(res.data.message);
      setShowConfirm(false);
      setConfirmText('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Switch failed');
    } finally { setBusy(false); }
  };

  return (
    <div className={`glass rounded-xl p-5 border ${isLive ? 'border-green-500/40' : 'border-amber-500/30'}`} data-testid="gateway-mode-card">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            {isLive ? <Zap className="h-5 w-5 text-green-400" /> : <FlaskConical className="h-5 w-5 text-amber-400" />}
            Razorpay Payment Mode
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full uppercase font-bold ${isLive ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`} data-testid="gateway-mode-badge">
              {info.mode}
            </span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Active key: <span className="font-mono text-slate-300">{info.active_key || 'not configured'}</span>
          </p>
          {!info.live_keys_configured && (
            <p className="text-amber-400/80 text-xs mt-1 flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Live keys not set — add RAZORPAY_LIVE_KEY_ID &amp; RAZORPAY_LIVE_KEY_SECRET in backend .env to enable Go Live
            </p>
          )}
        </div>
        {info.can_toggle ? (
          isLive ? (
            <Button variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10" disabled={busy}
              onClick={() => switchMode('test')} data-testid="switch-test-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Switch to Test Mode'}
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700" disabled={!info.live_keys_configured}
              onClick={() => setShowConfirm(true)} data-testid="go-live-btn">
              <Zap className="h-4 w-4 mr-1" /> Go Live
            </Button>
          )
        ) : (
          <span className="text-slate-500 text-xs">Super Admin only</span>
        )}
      </div>

      {showConfirm && !isLive && (
        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30" data-testid="go-live-confirm">
          <p className="text-red-300 text-sm font-medium mb-2">
            ⚠️ Real money will be charged to customers. Type <span className="font-mono font-bold">GO LIVE</span> to confirm:
          </p>
          <div className="flex items-center gap-2">
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="GO LIVE"
              className="bg-slate-900 border-slate-600 text-white w-40 font-mono" data-testid="go-live-confirm-input" />
            <Button variant="destructive" disabled={busy || confirmText !== 'GO LIVE'}
              onClick={() => switchMode('live')} data-testid="confirm-go-live-btn">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Go Live'}
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => { setShowConfirm(false); setConfirmText(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
