import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Building2, Wallet, Calendar, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentsAPI, bookingAPI } from '../../services/api';
import { toast } from 'sonner';

function PaymentCheckout({ bookingId, amount, onSuccess, onCancel }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [orderCreated, setOrderCreated] = useState(null);

  useEffect(() => {
    loadPaymentMethods();
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

  const handlePayment = async () => {
    setProcessing(true);
    try {
      // Create order
      const orderResponse = await paymentsAPI.createOrder({
        booking_id: bookingId,
        amount: amount
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
      <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 text-center">
        <p className="text-slate-400">Total Amount</p>
        <p className="text-4xl font-bold text-white mt-2">₹{amount.toLocaleString()}</p>
        <p className="text-sm text-slate-400 mt-1">Including all taxes</p>
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
        >
          {processing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
          ) : (
            `Pay ₹${amount.toLocaleString()}`
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
