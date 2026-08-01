import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Building2, Wallet, Calendar, Check, Loader2, Ticket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api, { paymentsAPI, bookingAPI } from '../../services/api';
import { toast } from 'sonner';

function PaymentCheckout({ bookingId, amount, onSuccess, onCancel }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [orderCreated, setOrderCreated] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [applying, setApplying] = useState(false);
  const [myVouchers, setMyVouchers] = useState([]);

  const discount = appliedVoucher ? Math.min(appliedVoucher.value, amount) : 0;
  const finalAmount = Math.max(discount > 0 ? 1 : 0, amount - discount) || amount;

  useEffect(() => {
    loadPaymentMethods();
    loadMyVouchers();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const response = await paymentsAPI.getMethods();
      setPaymentMethods(response.data.methods || []);
    } catch (error) {
      console.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const loadMyVouchers = async () => {
    try {
      const res = await api.get('/loyalty/my-redemptions');
      setMyVouchers((res.data.redemptions || []).filter(v => v.status === 'active' && v.value > 0));
    } catch (e) {
      // silent - vouchers optional
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
      toast.success(`🎫 ${res.data.reward_name} applied! ₹${Math.min(res.data.value, amount).toLocaleString()} off`);
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

  const handlePayment = async () => {
    setProcessing(true);
    try {
      // Create order
      const orderResponse = await paymentsAPI.createOrder({
        booking_id: bookingId,
        amount: amount,
        voucher_code: appliedVoucher?.code || null
      });

      if (!orderResponse.data.success) {
        throw new Error('Failed to create order');
      }

      setOrderCreated(orderResponse.data);

      // If Razorpay is configured, open Razorpay checkout
      if (!orderResponse.data.mock && window.Razorpay) {
        const options = {
          key: orderResponse.data.key_id,
          amount: orderResponse.data.amount,
          currency: orderResponse.data.currency,
          order_id: orderResponse.data.order_id,
          name: 'AirYatra',
          description: `Booking Payment`,
          handler: async function (response) {
            // Verify payment
            const verifyResponse = await paymentsAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: bookingId
            });

            if (verifyResponse.data.verified) {
              toast.success('Payment successful!');
              onSuccess(verifyResponse.data);
            } else {
              toast.error('Payment verification failed');
            }
          },
          prefill: {
            name: '',
            email: '',
            contact: ''
          },
          theme: {
            color: '#f97316'
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Mock payment flow
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const verifyResponse = await paymentsAPI.verify({
          razorpay_order_id: orderResponse.data.order_id,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: 'mock_signature',
          booking_id: bookingId
        });

        toast.success('Payment successful! (Demo Mode)');
        onSuccess(verifyResponse.data);
      }
    } catch (error) {
      toast.error(error.message || 'Payment failed');
    } finally {
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
    return <div className="text-center py-8 text-slate-400">Loading payment options...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Complete Payment</h2>
        <p className="text-slate-400 mt-1">Secure payment powered by Razorpay</p>
      </div>

      {/* Amount Display */}
      <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 text-center" data-testid="payment-amount-card">
        <p className="text-slate-400">Total Amount</p>
        {discount > 0 ? (
          <>
            <p className="text-slate-500 line-through text-lg mt-2" data-testid="original-amount">₹{amount.toLocaleString()}</p>
            <p className="text-4xl font-bold text-white" data-testid="final-amount">₹{finalAmount.toLocaleString()}</p>
            <p className="text-green-400 text-sm mt-1" data-testid="discount-line">
              🎫 Voucher discount: −₹{discount.toLocaleString()}
            </p>
          </>
        ) : (
          <p className="text-4xl font-bold text-white mt-2" data-testid="final-amount">₹{amount.toLocaleString()}</p>
        )}
        <p className="text-sm text-slate-400 mt-1">Including all taxes</p>
      </div>

      {/* Loyalty Voucher */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700" data-testid="voucher-section">
        <p className="text-white font-medium mb-2 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-orange-400" /> Apply Loyalty Voucher / वाउचर लगाएं
        </p>
        {appliedVoucher ? (
          <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2" data-testid="applied-voucher">
            <div className="flex items-center gap-2">
              <span>{appliedVoucher.reward_icon}</span>
              <div>
                <p className="text-green-400 text-sm font-medium">{appliedVoucher.reward_name}</p>
                <p className="text-slate-400 text-xs font-mono">{appliedVoucher.code}</p>
              </div>
            </div>
            <button onClick={removeVoucher} className="text-slate-400 hover:text-red-400" data-testid="remove-voucher-btn">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                placeholder="RWD-XXXXXXXX"
                className="bg-slate-900 border-slate-600 text-white font-mono"
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
                <p className="text-slate-500 text-xs mb-2">Your vouchers:</p>
                <div className="flex flex-wrap gap-2">
                  {myVouchers.map(v => (
                    <button
                      key={v.id}
                      onClick={() => applyVoucher(v.code)}
                      className="px-3 py-1 rounded-full border border-orange-500/40 text-orange-400 text-xs hover:bg-orange-500/10 flex items-center gap-1"
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

      {/* Payment Methods */}
      <div>
        <p className="text-white font-medium mb-3">Select Payment Method</p>
        <div className="space-y-2">
          {paymentMethods.map((method) => {
            const Icon = methodIcons[method.id] || CreditCard;
            const isDisabled = method.min_amount && amount < method.min_amount / 100;
            
            return (
              <button
                key={method.id}
                onClick={() => !isDisabled && setSelectedMethod(method.id)}
                disabled={isDisabled}
                className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                  selectedMethod === method.id
                    ? 'bg-orange-500/20 border-orange-500/50'
                    : isDisabled
                    ? 'bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed'
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

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          className="flex-1 border-slate-600 text-slate-300"
          onClick={onCancel}
          disabled={processing}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 bg-orange-500 hover:bg-orange-600"
          onClick={handlePayment}
          disabled={processing}
          data-testid="pay-now-btn"
        >
          {processing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
          ) : (
            `Pay ₹${finalAmount.toLocaleString()}`
          )}
        </Button>
      </div>

      {/* Security Note */}
      <p className="text-center text-xs text-slate-500">
        🔒 Your payment is secured with 256-bit SSL encryption
      </p>
    </div>
  );
}

export default PaymentCheckout;
