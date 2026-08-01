import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plane, MapPin, Calendar, CreditCard, CheckCircle, 
  AlertTriangle, Loader2, ArrowRight, Shield, Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PaymentLinkPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const cancelled = searchParams.get('cancelled') === 'true';

  useEffect(() => {
    if (token) {
      verifyPaymentLink();
    }
  }, [token]);

  const verifyPaymentLink = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/payments/link/${token}`);
      const json = await res.json();
      
      if (res.ok) {
        setData(json);
        if (!json.valid && json.already_paid) {
          setError({ type: 'paid', message: json.message });
        }
      } else {
        setError({ 
          type: res.status === 410 ? 'expired' : 'invalid', 
          message: json.detail || 'Invalid payment link' 
        });
      }
    } catch (err) {
      setError({ type: 'error', message: 'Failed to verify payment link' });
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async () => {
    setProcessingPayment(true);
    try {
      const res = await fetch(`${API_URL}/api/payments/link/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      
      if (res.ok && json.checkout_url) {
        window.location.href = json.checkout_url;
      } else {
        toast.error(json.detail || 'Failed to initiate payment');
        setProcessingPayment(false);
      }
    } catch (err) {
      toast.error('Payment initiation failed');
      setProcessingPayment(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-400">Verifying payment link...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 backdrop-blur-lg">
          <CardContent className="pt-8 pb-8 text-center">
            {error.type === 'paid' ? (
              <>
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Already Paid!</h2>
                <p className="text-slate-400 mb-6">{error.message}</p>
                <p className="text-sm text-slate-500">Thank you for your payment. Your booking is confirmed.</p>
              </>
            ) : error.type === 'expired' ? (
              <>
                <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-10 w-10 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Link Expired</h2>
                <p className="text-slate-400 mb-6">{error.message}</p>
                <p className="text-sm text-slate-500">Please contact AirYatra support for a new payment link.</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Invalid Link</h2>
                <p className="text-slate-400 mb-6">{error.message}</p>
                <p className="text-sm text-slate-500">This payment link is not valid or has been used.</p>
              </>
            )}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-xs text-slate-500">Need help? Contact info@airyatra.co.in</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cancelled state
  if (cancelled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 backdrop-blur-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-10 w-10 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h2>
            <p className="text-slate-400 mb-6">Your payment was not completed.</p>
            <Button 
              onClick={() => window.location.href = `/pay/${token}`}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid payment link - Show payment page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4" data-testid="payment-link-page">
      {/* Header */}
      <div className="text-center pt-8 pb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Plane className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">AirYatra</span>
        </div>
        <p className="text-slate-400 text-sm">India's Premium Helicopter Service</p>
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-lg mx-auto bg-slate-800/80 border-slate-700 backdrop-blur-lg overflow-hidden">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-center">
          <h1 className="text-xl font-bold text-white mb-1">Complete Your Payment</h1>
          <p className="text-orange-100 text-sm">Secure payment powered by Stripe</p>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Customer Greeting */}
          <div className="text-center">
            <p className="text-slate-400">Hello,</p>
            <p className="text-xl font-semibold text-white">{data?.customer_name}</p>
          </div>

          {/* Booking Details */}
          <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Booking Ref</span>
              <Badge className="bg-orange-500/20 text-orange-400 border-0 font-mono">
                #{data?.inquiry_number}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3 py-2">
              <MapPin className="h-5 w-5 text-orange-500 shrink-0" />
              <div className="flex-1">
                <p className="text-white font-medium">{data?.route}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-slate-400 text-sm">Departure</span>
              </div>
              <span className="text-white font-medium">{data?.departure_date}</span>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-3">
            <h3 className="text-slate-400 text-sm font-medium">Payment Summary</h3>
            
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Total Amount</span>
              <span className="text-slate-300">{formatCurrency(data?.total_amount)}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Already Paid</span>
              <span className="text-green-400">- {formatCurrency(data?.already_paid)}</span>
            </div>
            
            <div className="flex justify-between items-center py-3 bg-gradient-to-r from-orange-500/10 to-orange-600/10 rounded-lg px-3 -mx-3">
              <span className="text-white font-semibold">Balance Due</span>
              <span className="text-2xl font-bold text-orange-400">{formatCurrency(data?.remaining_balance)}</span>
            </div>
          </div>

          {/* Pay Button */}
          <Button 
            onClick={initiatePayment}
            disabled={processingPayment}
            className="w-full h-14 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-lg font-semibold"
            data-testid="pay-now-btn"
          >
            {processingPayment ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                Pay {formatCurrency(data?.remaining_balance)}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Shield className="h-4 w-4" />
            <span>256-bit SSL Encrypted • PCI Compliant</span>
          </div>

          {/* Link Expiry */}
          {data?.expires_at && (
            <p className="text-center text-slate-500 text-xs">
              Link expires: {new Date(data.expires_at).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center mt-8 pb-8">
        <p className="text-slate-500 text-sm">Need help? Contact us at info@airyatra.co.in</p>
        <p className="text-slate-600 text-xs mt-2">© 2025 AirYatra Aviation Pvt. Ltd.</p>
      </div>
    </div>
  );
}
