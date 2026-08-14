import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Zap, FlaskConical, ShieldAlert, Loader2, IndianRupee, CheckCircle2 } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

const loadRazorpayScript = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export default function PaymentGatewayMode() {
  const [info, setInfo] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const runOneRupeeTest = async () => {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await api.post('/razorpay/one-rupee-test');
      const o = res.data;
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error('Razorpay checkout load nahi hua');
      const rzp = new window.Razorpay({
        key: o.key_id, amount: o.amount_paise, currency: o.currency,
        name: 'AirYatra Gateway Test', description: `₹1 ${o.mode.toUpperCase()} gateway test`,
        order_id: o.order_id, theme: { color: '#f97316' },
        handler: async (response) => {
          try {
            const v = await api.post('/razorpay/one-rupee-test/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setTestResult({ ok: true, message: v.data.message, mode: v.data.mode });
            toast.success(v.data.message);
          } catch (e) {
            setTestResult({ ok: false, message: e.response?.data?.detail || 'Verification failed' });
            toast.error(e.response?.data?.detail || 'Verification failed');
          } finally { setTestBusy(false); }
        },
        modal: { ondismiss: () => setTestBusy(false) },
      });
      rzp.on('payment.failed', (resp) => {
        setTestResult({ ok: false, message: resp.error?.description || '₹1 payment failed' });
        toast.error(resp.error?.description || '₹1 payment failed');
        setTestBusy(false);
      });
      rzp.open();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || '₹1 test failed');
      setTestBusy(false);
    }
  };

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

      {info.can_one_rupee_test && (
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-3" data-testid="one-rupee-test-section">
          <div>
            <p className="text-slate-200 text-sm font-medium flex items-center gap-1.5">
              <IndianRupee className="h-4 w-4 text-orange-400" /> One Rupee Gateway Test
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {isLive ? 'LIVE mode: aapke UPI se real ₹1 charge hoga — gateway verify karne ka safe tarika' : 'TEST mode: koi real paisa nahi katega, sirf flow verify hoga'}
            </p>
          </div>
          <Button variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10" disabled={testBusy}
            onClick={runOneRupeeTest} data-testid="one-rupee-test-btn">
            {testBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><IndianRupee className="h-4 w-4 mr-1" /> Pay ₹1 Test</>}
          </Button>
          {testResult && (
            <div className={`w-full text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 ${testResult.ok ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`} data-testid="one-rupee-test-result">
              {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {testResult.message}
            </div>
          )}
        </div>
      )}

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
