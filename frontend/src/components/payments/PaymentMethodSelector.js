import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Building2, Wallet, Globe, CheckCircle2, 
  ChevronRight, Loader2, Shield, AlertCircle, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

/**
 * Payment Gateway Icons/Logos as SVG
 */
const GatewayLogos = {
  razorpay: (
    <svg viewBox="0 0 100 100" className="w-8 h-8">
      <rect fill="#3395FF" width="100" height="100" rx="12"/>
      <path fill="#fff" d="M70 30L55 70H45L60 30H70ZM40 30L25 70H35L50 30H40Z"/>
    </svg>
  ),
  stripe: (
    <svg viewBox="0 0 100 100" className="w-8 h-8">
      <rect fill="#635BFF" width="100" height="100" rx="12"/>
      <path fill="#fff" d="M48 40c0-3.7 3-5 6.5-5 3 0 6.5.8 9.5 2.5V28c-3.2-1.3-6.4-1.8-9.5-1.8-7.8 0-13 4-13 10.7 0 10.5 14.5 8.8 14.5 13.3 0 3.2-2.8 4.2-6.5 4.2-3.5 0-7.8-1.5-11-3.5v9.5c3.7 1.6 7.5 2.3 11 2.3 8 0 13.5-4 13.5-10.7C63 41.3 48 43.5 48 40z"/>
    </svg>
  ),
  paypal: (
    <svg viewBox="0 0 100 100" className="w-8 h-8">
      <rect fill="#003087" width="100" height="100" rx="12"/>
      <path fill="#fff" d="M67 35c2.5 3 3.5 7 2.5 12-2 11-10 17-22 17h-3l-3 16H32l1-5h5l3-16c.3-1.5 1.5-2.5 3-2.5h2c10 0 17-5 19-14 1-4 .5-7-2-9z"/>
      <path fill="#0070E0" d="M60 30c2 2.5 2.8 5.5 2 9.5-2 10-9.5 15.5-20 15.5h-5l-3 15H25l6-35h15c6 0 11 2 14 5z"/>
    </svg>
  ),
  cashfree: (
    <svg viewBox="0 0 100 100" className="w-8 h-8">
      <rect fill="#0D9488" width="100" height="100" rx="12"/>
      <text x="50" y="62" textAnchor="middle" fill="#fff" fontSize="36" fontWeight="bold">CF</text>
    </svg>
  )
};

/**
 * Payment Gateway Configuration
 */
const PAYMENT_GATEWAYS = {
  razorpay: {
    id: 'razorpay',
    name: 'Razorpay',
    description: 'UPI, Cards, Net Banking, Wallets',
    logo: GatewayLogos.razorpay,
    recommended: true,
    recommendedFor: 'Indian Users',
    currencies: ['INR'],
    features: ['UPI', 'Cards', 'Net Banking', 'Wallets', 'EMI'],
    processingTime: 'Instant'
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'International Cards',
    logo: GatewayLogos.stripe,
    recommended: false,
    currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'INR'],
    features: ['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay'],
    processingTime: 'Instant'
  },
  paypal: {
    id: 'paypal',
    name: 'PayPal',
    description: 'PayPal Account, International Cards',
    logo: GatewayLogos.paypal,
    recommended: false,
    recommendedFor: 'International Users',
    currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD'],
    features: ['PayPal Balance', 'International Cards', 'Bank Transfer'],
    processingTime: '1-2 minutes',
    note: 'INR will be converted to USD'
  },
  cashfree: {
    id: 'cashfree',
    name: 'Cashfree',
    description: 'UPI, Cards, Net Banking',
    logo: GatewayLogos.cashfree,
    recommended: false,
    currencies: ['INR'],
    features: ['UPI', 'Cards', 'Net Banking', 'Paylater'],
    processingTime: 'Instant'
  }
};

/**
 * Payment Method Selector Component
 */
export default function PaymentMethodSelector({
  bookingId,
  amount,
  currency = 'INR',
  onPaymentSuccess,
  onPaymentError,
  onCancel,
  customerDetails = {},
  disabled = false
}) {
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gatewayConfigs, setGatewayConfigs] = useState({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Load gateway configurations
  useEffect(() => {
    const loadConfigs = async () => {
      const configs = {};
      
      // Check each gateway's availability
      try {
        const [razorpay, stripe, paypal, cashfree] = await Promise.allSettled([
          api.get('/payments/razorpay/config').catch(() => ({ data: { configured: false } })),
          api.get('/payments/stripe/config').catch(() => ({ data: { configured: false } })),
          api.get('/payments/paypal/config').catch(() => ({ data: { configured: false } })),
          api.get('/payments/cashfree/config').catch(() => ({ data: { configured: false } }))
        ]);
        
        configs.razorpay = razorpay.status === 'fulfilled' ? razorpay.value.data : { configured: false };
        configs.stripe = stripe.status === 'fulfilled' ? stripe.value.data : { configured: false };
        configs.paypal = paypal.status === 'fulfilled' ? paypal.value.data : { configured: false };
        configs.cashfree = cashfree.status === 'fulfilled' ? cashfree.value.data : { configured: false };
        
        setGatewayConfigs(configs);
      } catch (err) {
        console.error('Failed to load gateway configs:', err);
      }
    };
    
    loadConfigs();
  }, []);

  // Auto-select Razorpay for INR
  useEffect(() => {
    if (currency === 'INR' && !selectedGateway) {
      setSelectedGateway('razorpay');
    } else if (currency !== 'INR' && !selectedGateway) {
      setSelectedGateway('paypal');
    }
  }, [currency, selectedGateway]);

  const handleGatewaySelect = (gatewayId) => {
    if (disabled) return;
    setSelectedGateway(gatewayId);
  };

  const handleProceed = () => {
    if (!selectedGateway) {
      toast.error('Please select a payment method');
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    setLoading(true);
    setShowConfirmDialog(false);

    try {
      let result;

      switch (selectedGateway) {
        case 'razorpay':
          result = await processRazorpayPayment();
          break;
        case 'stripe':
          result = await processStripePayment();
          break;
        case 'paypal':
          result = await processPayPalPayment();
          break;
        case 'cashfree':
          result = await processCashfreePayment();
          break;
        default:
          throw new Error('Invalid payment gateway');
      }

      if (result.success) {
        onPaymentSuccess?.(result);
      } else {
        onPaymentError?.(result.error || 'Payment failed');
      }
    } catch (err) {
      toast.error(err.message || 'Payment failed');
      onPaymentError?.(err);
    }

    setLoading(false);
  };

  const processRazorpayPayment = async () => {
    // Create order
    const orderRes = await api.post('/payments/razorpay/create-order', {
      booking_id: bookingId,
      amount: amount
    });

    if (!orderRes.data.success) {
      throw new Error(orderRes.data.error || 'Failed to create order');
    }

    // Open Razorpay checkout
    return new Promise((resolve, reject) => {
      const options = {
        key: gatewayConfigs.razorpay?.key_id || 'rzp_test_key',
        amount: orderRes.data.amount,
        currency: 'INR',
        name: 'AirYatra',
        description: `Booking Payment - ${bookingId}`,
        order_id: orderRes.data.order_id,
        handler: async (response) => {
          // Verify payment
          try {
            const verifyRes = await api.post('/payments/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: bookingId
            });
            resolve({ success: true, ...verifyRes.data });
          } catch (err) {
            reject(err);
          }
        },
        prefill: {
          name: customerDetails.name,
          email: customerDetails.email,
          contact: customerDetails.phone
        },
        theme: { color: '#f97316' }
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        reject(new Error('Razorpay SDK not loaded'));
      }
    });
  };

  const processStripePayment = async () => {
    // Create checkout session
    const sessionRes = await api.post('/payments/stripe/create-session', {
      booking_id: bookingId,
      amount: amount,
      currency: currency
    });

    if (sessionRes.data.url) {
      window.location.href = sessionRes.data.url;
      return { success: true, redirected: true };
    }

    throw new Error('Failed to create Stripe session');
  };

  const processPayPalPayment = async () => {
    // Create PayPal order
    const orderRes = await api.post('/payments/paypal/create-order', {
      booking_id: bookingId,
      amount: amount,
      currency: 'USD'
    });

    if (orderRes.data.approval_url) {
      window.location.href = orderRes.data.approval_url;
      return { success: true, redirected: true };
    }

    // Mock mode - simulate success
    if (orderRes.data.mock_mode) {
      const captureRes = await api.post('/payments/paypal/capture-order', {
        order_id: orderRes.data.order_id,
        booking_id: bookingId
      });
      return { success: true, ...captureRes.data };
    }

    throw new Error('Failed to create PayPal order');
  };

  const processCashfreePayment = async () => {
    // Create Cashfree order
    const orderRes = await api.post('/payments/cashfree/create-order', {
      booking_id: bookingId,
      amount: amount
    });

    if (!orderRes.data.success) {
      throw new Error(orderRes.data.error || 'Failed to create order');
    }

    // Mock mode - simulate success
    if (orderRes.data.mock_mode) {
      const verifyRes = await api.post('/payments/cashfree/verify-payment', {
        order_id: orderRes.data.order_id,
        booking_id: bookingId
      });
      return { success: true, ...verifyRes.data };
    }

    // Open Cashfree checkout (would use their SDK in production)
    toast.info('Cashfree checkout would open here in production');
    return { success: true, mock_mode: true };
  };

  const formatAmount = (amt, curr) => {
    if (curr === 'INR') {
      return `₹${amt?.toLocaleString('en-IN')}`;
    }
    return `$${(amt * 0.012).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b">
        <h2 className="text-xl font-bold">Select Payment Method</h2>
        <p className="text-sm text-slate-500 mt-1">
          Amount: <span className="font-semibold text-slate-900">{formatAmount(amount, currency)}</span>
        </p>
      </div>

      {/* Gateway Options */}
      <div className="space-y-3">
        {Object.values(PAYMENT_GATEWAYS).map((gateway) => {
          const config = gatewayConfigs[gateway.id];
          const isSelected = selectedGateway === gateway.id;
          const isMock = config?.mode === 'MOCK' || !config?.configured;
          
          return (
            <div
              key={gateway.id}
              onClick={() => handleGatewaySelect(gateway.id)}
              className={`
                relative p-4 rounded-xl border-2 cursor-pointer transition-all
                ${isSelected 
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center gap-4">
                {/* Logo */}
                <div className="flex-shrink-0">
                  {gateway.logo}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{gateway.name}</h3>
                    {gateway.recommended && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Recommended for {gateway.recommendedFor}
                      </span>
                    )}
                    {isMock && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                        Test Mode
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{gateway.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {gateway.features.slice(0, 4).map((f, i) => (
                      <span key={i} className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {f}
                      </span>
                    ))}
                  </div>
                  {gateway.note && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3" />{gateway.note}
                    </p>
                  )}
                </div>
                
                {/* Selection Indicator */}
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <CheckCircle2 className="h-6 w-6 text-orange-500" />
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-slate-300" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Note */}
      <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <Shield className="h-5 w-5 text-green-500 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Secure Payment</p>
          <p className="text-xs text-slate-500">All transactions are encrypted and processed securely</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleProceed}
          disabled={!selectedGateway || loading || disabled}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              Proceed to Pay
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold">{formatAmount(amount, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method</span>
                <span className="font-medium">{PAYMENT_GATEWAYS[selectedGateway]?.name}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 accent-orange-500"
              />
              <span className="text-sm">
                I have read and agree to the{' '}
                <a href="/api/legal-documents/public/terms_conditions" target="_blank" className="text-orange-500 hover:underline">
                  Terms & Conditions
                </a>
                {' '}and{' '}
                <a href="/api/legal-documents/public/refund_policy" target="_blank" className="text-orange-500 hover:underline">
                  Refund Policy
                </a>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Back
            </Button>
            <Button 
              onClick={handleConfirmPayment}
              disabled={!termsAccepted}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Confirm & Pay {formatAmount(amount, currency)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Compact Payment Badge for showing selected method
 */
export function PaymentMethodBadge({ gateway, amount, currency = 'INR' }) {
  const config = PAYMENT_GATEWAYS[gateway];
  if (!config) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
      <div className="w-6 h-6">{config.logo}</div>
      <div>
        <p className="text-sm font-medium">{config.name}</p>
        <p className="text-xs text-slate-500">
          {currency === 'INR' ? `₹${amount?.toLocaleString()}` : `$${amount}`}
        </p>
      </div>
    </div>
  );
}
