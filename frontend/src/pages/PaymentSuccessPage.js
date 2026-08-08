import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle, Plane, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import confetti from 'canvas-confetti';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Confetti celebration function
const triggerConfetti = () => {
  // First burst - center
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
  });

  // Left side burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#f97316', '#22c55e', '#fbbf24']
    });
  }, 200);

  // Right side burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#f97316', '#22c55e', '#fbbf24']
    });
  }, 400);

  // Star burst from top
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 360,
      ticks: 60,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      shapes: ['star'],
      colors: ['#ffd700', '#ff6b6b', '#4ecdc4']
    });
  }, 600);
};

export default function PaymentSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');
  const paymentLinkToken = params.get('token'); // For payment link flow
  const [state, setState] = useState('checking');
  const [txn, setTxn] = useState(null);
  const attempts = useRef(0);
  const confettiTriggered = useRef(false);

  useEffect(() => {
    if (!sessionId) { setState('error'); return; }
    let timer;
    const poll = async () => {
      attempts.current += 1;
      try {
        const res = await axios.get(`${API}/payments/stripe/status/${sessionId}`);
        setTxn(res.data);
        if (res.data.payment_status === 'paid') { 
          setState('paid'); 
          // Trigger confetti only once
          if (!confettiTriggered.current) {
            confettiTriggered.current = true;
            setTimeout(triggerConfetti, 300);
          }
          return; 
        }
        if (res.data.payment_status === 'expired' || res.data.status === 'failed') { setState('failed'); return; }
      } catch (e) { 
        // Continue polling on error - payment verification may be temporarily unavailable
        console.warn('Payment verification poll error:', e.message);
      }
      if (attempts.current >= 12) { setState('timeout'); return; }
      timer = setTimeout(poll, 2500);
    };
    poll();
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 overflow-hidden" data-testid="payment-success-page">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center relative">
        {state === 'checking' && (
          <>
            <div className="relative">
              <Loader2 className="h-16 w-16 text-orange-400 animate-spin mx-auto mb-4" />
              <div className="absolute inset-0 h-16 w-16 mx-auto rounded-full bg-orange-400/20 animate-ping" />
            </div>
            <h1 className="text-xl font-bold text-white">Confirming your payment...</h1>
            <p className="text-slate-400 text-sm mt-2">Please wait, don't close this page</p>
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div 
                  key={i} 
                  className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </>
        )}
        
        {state === 'paid' && (
          <>
            {/* Success Animation Container */}
            <div className="relative mb-6">
              {/* Glowing ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-green-500/20 animate-pulse" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-green-500/30 animate-ping" style={{ animationDuration: '2s' }} />
              </div>
              
              {/* Success icon with animation */}
              <div className="relative z-10 transform transition-all duration-500 animate-bounce-once">
                <CheckCircle2 className="h-20 w-20 text-green-400 mx-auto drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]" data-testid="payment-paid-icon" />
              </div>
              
              {/* Sparkles */}
              <Sparkles className="absolute top-0 right-1/4 h-6 w-6 text-yellow-400 animate-pulse" />
              <Sparkles className="absolute bottom-2 left-1/4 h-5 w-5 text-orange-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-1">
              Payment Successful! 
              <span className="inline-block animate-bounce ml-2">🎉</span>
            </h1>
            <p className="text-green-400 font-medium">Your booking is confirmed!</p>
            
            {/* Amount display with animation */}
            {txn?.amount && (
              <div className="mt-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
                <p className="text-slate-400 text-sm">Amount Paid</p>
                <p className="text-3xl font-bold text-green-400 mt-1">
                  ₹{Number(txn.amount).toLocaleString()}
                </p>
              </div>
            )}
            
            <p className="text-slate-500 text-sm mt-4 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Confirmation email has been sent to you
            </p>
            
            <div className="mt-6 space-y-3">
              <Button 
                onClick={() => navigate(txn?.booking_id ? `/customer/inquiry/${txn.booking_id}` : '/customer')} 
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 h-12 text-base font-semibold shadow-lg shadow-green-500/25" 
                data-testid="view-booking-btn"
              >
                <Plane className="h-5 w-5 mr-2" />
                View Booking
              </Button>
              
              <Button 
                variant="outline" 
                data-testid="download-receipt-btn"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
                    const res = await axios.get(`${API}/payments/receipt/${sessionId}`, { 
                      responseType: 'blob', 
                      headers: { Authorization: `Bearer ${token}` } 
                    });
                    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'AirYatra_Receipt.pdf';
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e) { 
                    // Receipt download requires authentication
                    console.warn('Receipt download failed - login required:', e.message);
                    alert('Please login to download receipt');
                  }
                }}
                className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10 h-11"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Receipt (PDF)
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => navigate('/customer')} 
                className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
        
        {(state === 'failed' || state === 'error') && (
          <>
            <div className="relative mb-4">
              <AlertCircle className="h-16 w-16 text-red-400 mx-auto animate-pulse" />
            </div>
            <h1 className="text-xl font-bold text-white">
              Payment {state === 'error' ? 'session not found' : 'failed / expired'}
            </h1>
            <p className="text-slate-400 text-sm mt-2">No charge was made. Please try again.</p>
            <Button 
              onClick={() => navigate(txn?.booking_id ? `/customer/payment/${txn.booking_id}` : '/customer')} 
              className="w-full mt-6 bg-orange-500 hover:bg-orange-600"
            >
              Try Again
            </Button>
          </>
        )}
        
        {state === 'timeout' && (
          <>
            <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4 animate-pulse" />
            <h1 className="text-xl font-bold text-white">Still processing...</h1>
            <p className="text-slate-400 text-sm mt-2">
              Payment confirmation is taking longer than usual. Your booking status will update automatically.
            </p>
            <Button 
              onClick={() => navigate('/customer')} 
              className="w-full mt-6 bg-orange-500 hover:bg-orange-600"
            >
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
      
      {/* Custom CSS for animations */}
      <style>{`
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
