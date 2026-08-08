import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  CreditCard, Smartphone, Building2, Wallet, Calendar, Check, 
  Loader2, AlertCircle, ChevronLeft, Shield, MapPin, Users, Plane, Ticket, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api, { customerAPI, paymentsAPI, bookingAPI } from '../services/api';
import { toast } from 'sonner';

function PaymentPage({ user }) {
  const { inquiryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [inquiry, setInquiry] = useState(location.state?.inquiry || null);
  const [paymentInfo, setPaymentInfo] = useState(location.state?.paymentInfo || null);
  const [loading, setLoading] = useState(!inquiry);
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [applying, setApplying] = useState(false);
  const [myVouchers, setMyVouchers] = useState([]);
  const isBalance = new URLSearchParams(location.search).get('type') === 'balance';
  const [ledger, setLedger] = useState(null);

  useEffect(() => {
    if (isBalance) {
      api.get(`/payments/transactions/${inquiryId}`).then((res) => setLedger(res.data)).catch(() => {});
    }
  }, [isBalance, inquiryId]);

  useEffect(() => {
    if (!inquiry) {
      loadInquiryAndPaymentInfo();
    } else if (!paymentInfo) {
      loadPaymentInfo();
    }
    loadPaymentMethods();
    loadMyVouchers();
  }, [inquiryId]);

  const loadMyVouchers = async () => {
    try {
      const res = await api.get('/loyalty/my-redemptions');
      setMyVouchers((res.data.redemptions || []).filter(v => v.status === 'active' && v.value > 0));
    } catch (e) {
      // Vouchers are optional feature - silently continue
      console.debug('Vouchers load skipped:', e.message);
    }
  };

  const applyVoucher = async (code) => {
    const trimmed = (code || '').trim();
    if (!trimmed) return;
    setApplying(true);
    try {
      const res = await api.post('/loyalty/vouchers/validate', { code: trimmed });
      setAppliedVoucher(res.data);
      setVoucherCode(res.data.code);
      toast.success(`🎫 ${res.data.reward_name} applied!`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Invalid voucher code');
    } finally {
      setApplying(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
  };

  const loadInquiryAndPaymentInfo = async () => {
    setLoading(true);
    try {
      const [statusRes, paymentRes] = await Promise.all([
        bookingAPI.getInquiryStatus(inquiryId),
        customerAPI.getPaymentInfo(inquiryId)
      ]);
      setInquiry(statusRes.data.inquiry);
      setPaymentInfo(paymentRes.data);
    } catch (error) {
      toast.error('Failed to load payment details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentInfo = async () => {
    try {
      const response = await customerAPI.getPaymentInfo(inquiryId);
      setPaymentInfo(response.data);
    } catch (error) {
      console.error('Failed to load payment info:', error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await paymentsAPI.getMethods();
      setPaymentMethods(response.data.methods || [
        { id: 'upi', name: 'UPI', description: 'Pay via GPay, PhonePe, Paytm', icon: 'upi' },
        { id: 'card', name: 'Credit/Debit Card', description: 'Visa, Mastercard, Rupay', icon: 'card' },
        { id: 'netbanking', name: 'Net Banking', description: 'All major banks', icon: 'netbanking' },
      ]);
    } catch (error) {
      // Use default methods
      setPaymentMethods([
        { id: 'upi', name: 'UPI', description: 'Pay via GPay, PhonePe, Paytm' },
        { id: 'card', name: 'Credit/Debit Card', description: 'Visa, Mastercard, Rupay' },
        { id: 'netbanking', name: 'Net Banking', description: 'All major banks' },
      ]);
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const res = await api.post('/payments/stripe/checkout', {
        booking_id: inquiryId,
        voucher_code: isBalance ? null : (appliedVoucher?.code || null),
        origin_url: window.location.origin,
        payment_type: isBalance ? 'balance' : 'advance',
      });
      if (res.data.checkout_url) {
        toast.info('Redirecting to secure Stripe checkout...');
        window.location.href = res.data.checkout_url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Payment failed');
      setProcessing(false);
    }
  };

  const methodIcons = {
    upi: Smartphone,
    card: CreditCard,
    netbanking: Building2,
    wallet: Wallet,
    emi: Calendar
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!inquiry || !paymentInfo) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <p className="text-white text-xl">Payment details not found</p>
          <Button onClick={() => navigate('/customer')} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const advanceAmount = isBalance ? (ledger?.remaining_due ?? paymentInfo?.remaining_amount) : (paymentInfo?.advance_amount || inquiry?.estimated_price);
  const advancePercent = paymentInfo?.advance_percent || 100;
  const remainingAmount = isBalance ? 0 : (paymentInfo?.remaining_amount || 0);
  const voucherDiscount = !isBalance && appliedVoucher ? Math.min(appliedVoucher.value, advanceAmount || 0) : 0;
  const payableAmount = Math.max(voucherDiscount > 0 ? 1 : 0, (advanceAmount || 0) - voucherDiscount) || advanceAmount;

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Complete Payment</h1>
            <p className="text-slate-400">Secure checkout for your booking</p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Plane className="h-5 w-5 text-orange-400" />
            Booking Summary
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Inquiry Number</span>
              <span className="text-orange-400 font-mono">{inquiry.inquiry_number || inquiry.id?.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Aircraft</span>
              <span className="text-white">{inquiry.aircraft_type === 'helicopter' ? '🚁 Helicopter' : '✈️ Plane'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Route</span>
              <span className="text-white">{inquiry.pickup_location} → {inquiry.drop_location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Date</span>
              <span className="text-white">{inquiry.departure_date} at {inquiry.pickup_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Passengers</span>
              <span className="text-white">{inquiry.total_passengers} Adults + {inquiry.children_count || 0} Children</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Purpose</span>
              <span className="text-white">{inquiry.booking_purpose}</span>
            </div>
          </div>
        </div>

        {/* Payment Amount */}
        <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-2xl p-6 border border-orange-500/30 mb-6" data-testid="payment-amount-card">
          <div className="text-center">
            <p className="text-slate-400 text-sm">{isBalance ? 'Remaining Balance Payment' : `Amount to Pay Now (${advancePercent}% Advance)`}</p>
            {voucherDiscount > 0 ? (
              <>
                <p className="text-slate-500 line-through text-lg mt-2" data-testid="original-amount">₹{advanceAmount?.toLocaleString()}</p>
                <p className="text-4xl font-bold text-white" data-testid="payable-amount">₹{payableAmount?.toLocaleString()}</p>
                <p className="text-green-400 text-sm mt-1" data-testid="voucher-discount-line">
                  🎫 Voucher discount: −₹{voucherDiscount.toLocaleString()}
                </p>
              </>
            ) : (
              <p className="text-4xl font-bold text-white mt-2" data-testid="payable-amount">
                ₹{advanceAmount?.toLocaleString()}
              </p>
            )}
            
            {advancePercent < 100 && remainingAmount > 0 && (
              <div className="mt-4 pt-4 border-t border-orange-500/30">
                <p className="text-slate-400 text-sm">
                  Remaining amount ₹{remainingAmount?.toLocaleString()} to be paid before flight
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Loyalty Voucher */}
        {!isBalance && (
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-6" data-testid="voucher-section">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-orange-400" />
            Apply Loyalty Voucher
          </h3>
          {appliedVoucher ? (
            <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3" data-testid="applied-voucher">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{appliedVoucher.reward_icon}</span>
                <div>
                  <p className="text-green-400 font-medium">{appliedVoucher.reward_name}</p>
                  <p className="text-slate-400 text-xs font-mono">{appliedVoucher.code}</p>
                </div>
              </div>
              <button onClick={removeVoucher} className="text-slate-400 hover:text-red-400 p-1" data-testid="remove-voucher-btn">
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="RWD-XXXXXXXX"
                  className="bg-slate-800 border-slate-600 text-white font-mono"
                  data-testid="voucher-code-input"
                />
                <Button
                  onClick={() => applyVoucher(voucherCode)}
                  disabled={applying || !voucherCode.trim()}
                  className="bg-orange-500 hover:bg-orange-600"
                  data-testid="apply-voucher-btn"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              {myVouchers.length > 0 && (
                <div className="mt-3">
                  <p className="text-slate-500 text-xs mb-2">Your active vouchers:</p>
                  <div className="flex flex-wrap gap-2">
                    {myVouchers.map(v => (
                      <button
                        key={v.id}
                        onClick={() => applyVoucher(v.code)}
                        className="px-3 py-1.5 rounded-full border border-orange-500/40 text-orange-400 text-xs hover:bg-orange-500/10 flex items-center gap-1"
                        data-testid={`voucher-chip-${v.code}`}
                      >
                        {v.reward_icon} ₹{v.value.toLocaleString()} off
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        )}

        {/* Payment Methods */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Select Payment Method
          </h3>
          
          <div className="space-y-3">
            {paymentMethods.map((method) => {
              const Icon = methodIcons[method.id] || CreditCard;
              
              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                    selectedMethod === method.id
                      ? 'bg-orange-500/20 border-orange-500/50'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-6 w-6 ${selectedMethod === method.id ? 'text-orange-400' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <p className="text-white font-medium">{method.name}</p>
                      <p className="text-sm text-slate-400">{method.description}</p>
                    </div>
                  </div>
                  {selectedMethod === method.id && (
                    <Check className="h-5 w-5 text-orange-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pay Button */}
        <Button
          onClick={handlePayment}
          disabled={processing}
          className="w-full py-6 text-lg bg-green-600 hover:bg-green-700"
          data-testid="pay-now-btn"
        >
          {processing ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</>
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Pay ₹{payableAmount?.toLocaleString()}
            </>
          )}
        </Button>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            Secured by Stripe (Test Mode) • 256-bit SSL encryption
          </p>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/customer/inquiry/${inquiryId}`)}
            className="border-slate-600 text-slate-300"
          >
            ← Back to Inquiry Status
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PaymentPage;
