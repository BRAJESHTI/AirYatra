import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { CreditCard, Loader2, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

/**
 * PayPal Payment Button Component
 * 
 * Features:
 * - PayPal Checkout integration
 * - INR to USD conversion (PayPal doesn't support INR)
 * - Mock mode support (when credentials not configured)
 * - Success/Error callbacks
 */
export default function PayPalPaymentButton({
  bookingId,
  amountINR,
  description,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  className = ''
}) {
  const [paypalConfig, setPaypalConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [amountUSD, setAmountUSD] = useState(null);

  // Load PayPal config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await api.get('/payments/paypal/config');
        if (res.data.success) {
          setPaypalConfig(res.data);
          // Calculate USD amount (approx conversion)
          const usd = (amountINR * 0.012).toFixed(2);
          setAmountUSD(parseFloat(usd) < 1 ? 1.00 : parseFloat(usd));
        }
      } catch (err) {
        console.error('Failed to load PayPal config:', err);
      }
      setLoading(false);
    };
    loadConfig();
  }, [amountINR]);

  // Create order handler
  const createOrder = async () => {
    try {
      const res = await api.post('/payments/paypal/create-order', {
        booking_id: bookingId,
        amount: amountINR,
        currency: 'USD',
        description: description || `AirYatra Booking Payment`
      });

      if (res.data.success) {
        setAmountUSD(res.data.amount_usd);
        
        // If mock mode, show message
        if (res.data.mock_mode) {
          toast.info('PayPal is in MOCK mode. Configure credentials for real payments.');
        }
        
        return res.data.order_id;
      } else {
        throw new Error(res.data.error || 'Failed to create order');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create PayPal order');
      throw err;
    }
  };

  // Capture order handler
  const onApprove = async (data) => {
    setProcessing(true);
    try {
      const res = await api.post('/payments/paypal/capture-order', {
        order_id: data.orderID,
        booking_id: bookingId
      });

      if (res.data.success) {
        toast.success('Payment successful! 🎉');
        onSuccess?.({
          orderId: data.orderID,
          transactionId: res.data.transaction_id,
          amountUSD: res.data.amount_usd,
          amountINR: res.data.amount_inr,
          payer: res.data.payer,
          mockMode: res.data.mock_mode
        });
      } else {
        throw new Error(res.data.error || 'Payment capture failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed');
      onError?.(err);
    }
    setProcessing(false);
  };

  // Cancel handler
  const handleCancel = (data) => {
    toast.info('Payment cancelled');
    onCancel?.(data);
  };

  // Error handler
  const handleError = (err) => {
    console.error('PayPal error:', err);
    toast.error('PayPal encountered an error');
    onError?.(err);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-slate-600">Loading PayPal...</span>
      </div>
    );
  }

  if (!paypalConfig) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
        <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-600">PayPal not available</p>
      </div>
    );
  }

  // Mock mode UI (when credentials not configured)
  if (!paypalConfig.configured || paypalConfig.mode === 'MOCK') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">PayPal Sandbox Mode</p>
              <p className="text-xs text-yellow-600 mt-1">
                PayPal credentials not configured. Running in mock mode for testing.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-slate-500">Amount (INR)</span>
            <span className="font-bold">₹{amountINR?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <Globe className="h-4 w-4" />Converted to USD
            </span>
            <span className="font-bold text-blue-600">${amountUSD}</span>
          </div>
          
          <Button
            className="w-full bg-[#0070ba] hover:bg-[#003087] text-white"
            onClick={async () => {
              setProcessing(true);
              try {
                const orderId = await createOrder();
                await onApprove({ orderID: orderId });
              } catch (err) {
                onError?.(err);
              }
              setProcessing(false);
            }}
            disabled={disabled || processing}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay with PayPal (Mock)
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Real PayPal integration
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-slate-500">Amount (INR)</span>
          <span className="font-bold">₹{amountINR?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-slate-500 flex items-center gap-1">
            <Globe className="h-4 w-4" />Converted to USD
          </span>
          <span className="font-bold text-blue-600">${amountUSD}</span>
        </div>
        
        <p className="text-xs text-slate-400 mb-3">
          PayPal does not support INR. Your payment will be processed in USD.
        </p>
        
        <PayPalScriptProvider
          options={{
            clientId: paypalConfig.client_id,
            currency: 'USD',
            intent: 'capture'
          }}
        >
          <PayPalButtons
            style={{
              layout: 'vertical',
              color: 'blue',
              shape: 'rect',
              label: 'pay'
            }}
            disabled={disabled || processing}
            createOrder={createOrder}
            onApprove={onApprove}
            onCancel={handleCancel}
            onError={handleError}
          />
        </PayPalScriptProvider>
        
        {processing && (
          <div className="flex items-center justify-center mt-3 text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing payment...
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * PayPal Payment Success Badge
 */
export function PayPalSuccessBadge({ transactionId, amountUSD }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
      <CheckCircle2 className="h-5 w-5 text-green-600" />
      <div>
        <p className="text-sm font-medium text-green-800">PayPal Payment Successful</p>
        <p className="text-xs text-green-600">
          Transaction: {transactionId} • ${amountUSD} USD
        </p>
      </div>
    </div>
  );
}
