import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');
  const [state, setState] = useState('checking');
  const [txn, setTxn] = useState(null);
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId) { setState('error'); return; }
    let timer;
    const poll = async () => {
      attempts.current += 1;
      try {
        const res = await axios.get(`${API}/payments/stripe/status/${sessionId}`);
        setTxn(res.data);
        if (res.data.payment_status === 'paid') { setState('paid'); return; }
        if (res.data.payment_status === 'expired' || res.data.status === 'failed') { setState('failed'); return; }
      } catch (e) { /* keep polling */ }
      if (attempts.current >= 12) { setState('timeout'); return; }
      timer = setTimeout(poll, 2500);
    };
    poll();
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4" data-testid="payment-success-page">
      <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
        {state === 'checking' && (
          <>
            <Loader2 className="h-14 w-14 text-orange-400 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white">Confirming your payment...</h1>
            <p className="text-slate-400 text-sm mt-2">भुगतान की पुष्टि हो रही है — please wait, don't close this page</p>
          </>
        )}
        {state === 'paid' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" data-testid="payment-paid-icon" />
            <h1 className="text-2xl font-bold text-white">Payment Successful! 🎉</h1>
            <p className="text-green-400 mt-1">भुगतान सफल — booking confirmed!</p>
            {txn?.amount && <p className="text-slate-300 mt-3 text-lg font-semibold">₹{Number(txn.amount).toLocaleString()} paid</p>}
            <p className="text-slate-500 text-xs mt-1">Confirmation email aapko bhej diya gaya hai</p>
            <div className="mt-6 space-y-2">
              <Button onClick={() => navigate(txn?.booking_id ? `/customer/inquiry/${txn.booking_id}` : '/customer')} className="w-full bg-green-600 hover:bg-green-700" data-testid="view-booking-btn">
                <Plane className="h-4 w-4 mr-2" />View Booking / बुकिंग देखें
              </Button>
              <Button variant="outline" onClick={() => navigate('/customer')} className="w-full border-slate-600 text-slate-300">Go to Dashboard</Button>
            </div>
          </>
        )}
        {(state === 'failed' || state === 'error') && (
          <>
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white">Payment {state === 'error' ? 'session not found' : 'failed / expired'}</h1>
            <p className="text-slate-400 text-sm mt-2">Koi charge nahi hua hai. Dobara try karein.</p>
            <Button onClick={() => navigate(txn?.booking_id ? `/customer/payment/${txn.booking_id}` : '/customer')} className="w-full mt-6 bg-orange-500 hover:bg-orange-600">Try Again</Button>
          </>
        )}
        {state === 'timeout' && (
          <>
            <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white">Still processing...</h1>
            <p className="text-slate-400 text-sm mt-2">Payment status confirm hone mein time lag raha hai. Aapki booking par status apne aap update ho jayega.</p>
            <Button onClick={() => navigate('/customer')} className="w-full mt-6 bg-orange-500 hover:bg-orange-600">Go to Dashboard</Button>
          </>
        )}
      </div>
    </div>
  );
}
