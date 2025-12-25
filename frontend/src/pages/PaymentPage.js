import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  CreditCard, Smartphone, Building2, Wallet, Calendar, Check, 
  Loader2, AlertCircle, ChevronLeft, Shield, MapPin, Users, Plane
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customerAPI, paymentsAPI, bookingAPI } from '../services/api';
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

  useEffect(() => {
    if (!inquiry) {
      loadInquiryAndPaymentInfo();
    } else if (!paymentInfo) {
      loadPaymentInfo();
    }
    loadPaymentMethods();
  }, [inquiryId]);

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
      toast.error('Failed to load payment details / भुगतान विवरण लोड नहीं हुआ');
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
      const amount = paymentInfo?.advance_amount || inquiry?.estimated_price;
      
      // Create payment order
      const orderResponse = await paymentsAPI.createOrder({
        booking_id: inquiryId,
        amount: amount
      });

      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.message || 'Failed to create order');
      }

      // If Razorpay is configured, open Razorpay checkout
      if (!orderResponse.data.mock && window.Razorpay) {
        const options = {
          key: orderResponse.data.key_id,
          amount: orderResponse.data.amount,
          currency: orderResponse.data.currency,
          order_id: orderResponse.data.order_id,
          name: 'AirYatra',
          description: `Flight Booking - ${inquiry?.inquiry_number || inquiryId.slice(0, 8)}`,
          handler: async function (response) {
            await verifyPayment(response);
          },
          prefill: {
            name: user?.full_name || '',
            email: user?.email || '',
            contact: user?.phone || ''
          },
          theme: {
            color: '#f97316'
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Mock payment flow for demo
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await verifyPayment({
          razorpay_order_id: orderResponse.data.order_id,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: 'mock_signature'
        });
      }
    } catch (error) {
      toast.error(error.message || 'Payment failed / भुगतान विफल');
    } finally {
      setProcessing(false);
    }
  };

  const verifyPayment = async (paymentResponse) => {
    try {
      const verifyResponse = await paymentsAPI.verify({
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        booking_id: inquiryId
      });

      if (verifyResponse.data.verified || verifyResponse.data.success) {
        toast.success('🎉 Payment successful! Booking confirmed! / भुगतान सफल! बुकिंग पुष्ट!');
        // Redirect to inquiry status page to show confirmed booking
        navigate(`/customer/inquiry/${inquiryId}`, { 
          state: { paymentSuccess: true } 
        });
      } else {
        toast.error('Payment verification failed / भुगतान सत्यापन विफल');
      }
    } catch (error) {
      toast.error('Payment verification error / भुगतान सत्यापन त्रुटि');
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

  const advanceAmount = paymentInfo?.advance_amount || inquiry?.estimated_price;
  const advancePercent = paymentInfo?.advance_percent || 100;
  const remainingAmount = paymentInfo?.remaining_amount || 0;

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
            <p className="text-slate-400">भुगतान पूरा करें</p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Plane className="h-5 w-5 text-orange-400" />
            Booking Summary / बुकिंग सारांश
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
        <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-2xl p-6 border border-orange-500/30 mb-6">
          <div className="text-center">
            <p className="text-slate-400 text-sm">Amount to Pay Now ({advancePercent}% Advance)</p>
            <p className="text-4xl font-bold text-white mt-2">
              ₹{advanceAmount?.toLocaleString()}
            </p>
            
            {advancePercent < 100 && remainingAmount > 0 && (
              <div className="mt-4 pt-4 border-t border-orange-500/30">
                <p className="text-slate-400 text-sm">
                  Remaining amount ₹{remainingAmount?.toLocaleString()} to be paid before flight
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  शेष राशि उड़ान से पहले देनी होगी
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Select Payment Method / भुगतान विधि चुनें
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
        >
          {processing ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</>
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Pay ₹{advanceAmount?.toLocaleString()}
            </>
          )}
        </Button>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            Secured by Razorpay • 256-bit SSL encryption
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
