import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  CreditCard, Smartphone, Building2, Wallet, Check, Globe,
  Loader2, AlertCircle, ChevronLeft, Shield, Plane, Ticket, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api, { customerAPI, bookingAPI } from '../services/api';
import { toast } from 'sonner';

const GATEWAY_ICONS = {
  razorpay: Smartphone,
  stripe: CreditCard,
  cashfree: Building2,
  paypal: Globe,
  wallet: Wallet,
};

const METHOD_LABELS = {
  upi: 'UPI',
  card: 'Cards',
  netbanking: 'NetBanking',
  wallet: 'Wallets',
  emi: 'EMI',
  paypal: 'PayPal',
};

function PaymentPage({ user }) {
  const { inquiryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [inquiry, setInquiry] = useState(location.state?.inquiry || null);
  const [paymentInfo, setPaymentInfo] = useState(location.state?.paymentInfo || null);
  const [loading, setLoading] = useState(!inquiry);
  const [processing, setProcessing] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [applying, setApplying] = useState(false);
  const [myVouchers, setMyVouchers] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState('stripe');
  const isBalance = new URLSearchParams(location.search).get('type') === 'balance';
  const [ledger, setLedger] = useState(null);
  const [upiId, setUpiId] = useState('dr.brajeshptiwari@okicici');
  const [collectState, setCollectState] = useState(null);
  const [payLink, setPayLink] = useState(null);

  useEffect(() => {
    api.get('/payments/gateways')
      .then((res) => {
        const gws = res.data.gateways || [];
        setGateways(gws);
        const firstEnabled = gws.find(g => g.enabled && g.id !== 'wallet');
        if (firstEnabled) setSelectedGateway(firstEnabled.id);
      })
      .catch(() => {
        setGateways([{ id: 'stripe', name: 'Stripe', description: 'Cards', enabled: true, badge: 'Test Mode', methods: ['card'] }]);
        setSelectedGateway('stripe');
      });
  }, []);

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
    loadMyVouchers();
  }, [inquiryId]);

  const loadMyVouchers = async () => {
    try {
      const res = await api.get('/loyalty/my-redemptions');
      setMyVouchers((res.data.redemptions || []).filter(v => v.status === 'active' && v.value > 0));
    } catch (e) {
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

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handleRazorpayPayment = async () => {
    setProcessing(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error('Failed to load Razorpay. Check your connection.');
      const res = await api.post('/razorpay/create-order', {
        booking_id: inquiryId,
        customer_name: user?.full_name || user?.email || 'Customer',
        customer_email: user?.email || '',
        customer_phone: user?.phone || '9999999999',
        description: `AirYatra Booking ${inquiry?.inquiry_number || inquiryId}`,
      });
      const order = res.data;
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount_paise,
        currency: 'INR',
        name: 'AirYatra',
        description: 'Aviation Booking Payment',
        order_id: order.order_id,
        prefill: order.prefill,
        theme: order.theme || { color: '#f97316' },
        handler: async (response) => {
          try {
            await api.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful!');
            navigate(`/payment/success?gateway=razorpay&booking_id=${inquiryId}&amount=${order.amount}`);
          } catch (e) {
            toast.error(e.response?.data?.detail || 'Payment verification failed');
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
      });
      rzp.on('payment.failed', (resp) => {
        toast.error(resp.error?.description || 'Payment failed');
        setProcessing(false);
      });
      rzp.open();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Payment failed');
      setProcessing(false);
    }
  };

  const handleWalletPayment = async () => {
    setProcessing(true);
    try {
      const res = await api.post('/payments/wallet/apply', { booking_id: inquiryId });
      toast.success(res.data.message);
      if (res.data.fully_paid || res.data.advance_covered) {
        navigate(`/payment/success?gateway=wallet&booking_id=${inquiryId}&amount=${res.data.applied}`);
      } else {
        toast.info(`₹${res.data.remaining_due.toLocaleString()} remaining — pay via a gateway below`);
        const fallback = gateways.find(g => g.enabled && g.id !== 'wallet');
        if (fallback) setSelectedGateway(fallback.id);
        loadPaymentInfo();
        api.get('/payments/gateways').then(r => setGateways(r.data.gateways || []));
        setProcessing(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Wallet payment failed');
      setProcessing(false);
    }
  };

  const loadCashfreeSdk = () => new Promise((resolve) => {
    if (window.Cashfree) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

  const startCollectPoll = (orderId, amount) => {
    const started = Date.now();
    const poll = setInterval(async () => {
      if (Date.now() - started > 15 * 60 * 1000) {
        clearInterval(poll);
        setCollectState({ status: 'timeout' });
        setProcessing(false);
        toast.error('Request expire ho gaya — dobara try karein');
        return;
      }
      try {
        const s = await api.get(`/payments/cashfree/collect-status/${orderId}`);
        if (s.data.status === 'SUCCESS') {
          clearInterval(poll);
          toast.success('UPI payment successful!');
          navigate(`/payment/success?gateway=cashfree&booking_id=${inquiryId}&amount=${amount}`);
        } else if (s.data.status === 'FAILED') {
          clearInterval(poll);
          setCollectState({ status: 'failed' });
          setProcessing(false);
          toast.error('Payment failed / expired');
        }
      } catch (e) { /* keep polling */ }
    }, 4000);
  };

  const handleCashfreePaymentLink = async () => {
    setProcessing(true);
    try {
      const res = await api.post('/payments/cashfree/payment-link', { booking_id: inquiryId });
      toast.success(res.data.message);
      setPayLink(res.data.link_url);
      setCollectState({ status: 'pending', orderId: res.data.order_id, amount: res.data.amount, link: true });
      startCollectPoll(res.data.order_id, res.data.amount);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Payment link failed');
      setProcessing(false);
    }
  };

  const handleCashfreeCollect = async () => {
    const upi = upiId.trim();
    if (!upi.includes('@')) return toast.error('Valid UPI ID daaliye (e.g. name@okicici)');
    setProcessing(true);
    setCollectState({ status: 'sending' });
    try {
      const res = await api.post('/payments/cashfree/upi-collect', { booking_id: inquiryId, upi_id: upi });
      toast.success(res.data.message);
      if (res.data.collect_mode === 'hosted_checkout' && res.data.payment_session_id) {
        const ok = await loadCashfreeSdk();
        if (ok) {
          const cashfree = window.Cashfree({ mode: res.data.mode === 'production' ? 'production' : 'sandbox' });
          cashfree.checkout({ paymentSessionId: res.data.payment_session_id, redirectTarget: '_modal' });
        } else {
          toast.error('Cashfree checkout load nahi hua — retry karein');
        }
      }
      setCollectState({ status: 'pending', orderId: res.data.order_id, amount: res.data.amount, hosted: res.data.collect_mode === 'hosted_checkout' });
      startCollectPoll(res.data.order_id, res.data.amount);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'UPI collect request failed');
      setCollectState(null);
      setProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (selectedGateway === 'razorpay') return handleRazorpayPayment();
    if (selectedGateway === 'wallet') return handleWalletPayment();
    if (selectedGateway === 'cashfree') return handleCashfreeCollect();
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
  const walletGateway = gateways.find(g => g.id === 'wallet');

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

        {/* Payment Gateway Selection */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-6" data-testid="gateway-section">
          <h3 className="text-lg font-semibold text-white mb-4">
            Choose Payment Gateway
          </h3>
          
          <div className="space-y-3">
            {gateways.map((gw) => {
              const Icon = GATEWAY_ICONS[gw.id] || CreditCard;
              const isWallet = gw.id === 'wallet';
              const walletEmpty = isWallet && !(gw.balance > 0);
              const disabled = !gw.enabled || walletEmpty;
              const selected = selectedGateway === gw.id;
              
              return (
                <button
                  key={gw.id}
                  onClick={() => !disabled && setSelectedGateway(gw.id)}
                  disabled={disabled}
                  data-testid={`gateway-${gw.id}`}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                    selected
                      ? 'bg-orange-500/20 border-orange-500/50'
                      : disabled
                        ? 'bg-slate-800/30 border-slate-800 opacity-60 cursor-not-allowed'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-6 w-6 flex-shrink-0 ${selected ? 'text-orange-400' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-medium">{gw.name}</p>
                        {gw.badge && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            gw.badge === 'Recommended' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          }`}>
                            {gw.badge}
                          </span>
                        )}
                        {!gw.enabled && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                            Coming Soon
                          </span>
                        )}
                        {isWallet && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            gw.balance > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-slate-700 text-slate-400'
                          }`} data-testid="wallet-balance-chip">
                            ₹{(gw.balance || 0).toLocaleString()} available
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{gw.description}</p>
                      {gw.methods?.length > 0 && !isWallet && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {gw.methods.map(m => (
                            <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                              {METHOD_LABELS[m] || m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {selected && (
                    <Check className="h-5 w-5 text-orange-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cashfree UPI Collect */}
        {selectedGateway === 'cashfree' && (
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 mb-6" data-testid="cashfree-upi-section">
            <h3 className="text-lg font-semibold text-white mb-2">UPI Collect Request</h3>
            <p className="text-slate-400 text-sm mb-3">
              Apni UPI ID daaliye — payment approval popup aapke GPay/PhonePe me aayega
            </p>
            <Input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@okicici"
              className="bg-slate-800 border-slate-600 text-white font-mono"
              disabled={collectState?.status === 'pending'}
              data-testid="upi-id-input"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleCashfreePaymentLink}
                disabled={processing || collectState?.status === 'pending'}
                className="text-cyan-400 text-sm underline decoration-dotted hover:text-cyan-300 disabled:opacity-50"
                data-testid="cashfree-payment-link-btn"
              >
                📱 Ya Payment Link banayein (phone pe khol kar pay karein)
              </button>
            </div>
            {payLink && (
              <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-2" data-testid="payment-link-box">
                <p className="text-cyan-300 text-sm font-medium">Payment Link ready:</p>
                <p className="text-slate-300 font-mono text-[11px] break-all">{payLink}</p>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(payLink); toast.success('Link copied!'); }}
                    className="text-xs px-3 py-1 rounded border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10" data-testid="copy-pay-link-btn">
                    Copy Link
                  </button>
                  <button onClick={() => window.open(payLink, '_blank')}
                    className="text-xs px-3 py-1 rounded border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10" data-testid="open-pay-link-btn">
                    Open
                  </button>
                </div>
              </div>
            )}
            {collectState?.status === 'pending' && (
              <div className="mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3" data-testid="collect-pending-banner">
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
                <div>
                  <p className="text-blue-300 font-medium text-sm">
                    {collectState.link ? `Payment link active — ₹${collectState.amount?.toLocaleString()}` : collectState.hosted ? `Cashfree checkout khula — ₹${collectState.amount?.toLocaleString()}` : `Collect request bheja gaya — ₹${collectState.amount?.toLocaleString()}`}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {collectState.link ? 'Link phone pe khol kar UPI se pay karein. Status auto-update hoga...' : collectState.hosted ? 'Checkout me UPI select karke apni UPI ID daaliye, phir GPay me approve karein. Status auto-update hoga...' : 'Google Pay kholiye aur payment request approve karein. Status auto-update hoga...'}
                  </p>
                </div>
              </div>
            )}
            {collectState?.status === 'failed' && (
              <p className="mt-3 text-red-400 text-sm" data-testid="collect-failed-msg">❌ Collect request declined/failed — dobara try karein</p>
            )}
            {collectState?.status === 'timeout' && (
              <p className="mt-3 text-amber-400 text-sm" data-testid="collect-timeout-msg">⏱️ Request expire ho gaya — dobara bhejein</p>
            )}
          </div>
        )}

        {/* Pay Button */}
        <Button
          onClick={handlePayment}
          disabled={processing}
          className="w-full py-6 text-lg bg-green-600 hover:bg-green-700"
          data-testid="pay-now-btn"
        >
          {processing ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> {selectedGateway === 'cashfree' && collectState?.status === 'pending' ? 'Waiting for GPay approval...' : 'Processing...'}</>
          ) : selectedGateway === 'wallet' ? (
            <>
              <Wallet className="h-5 w-5 mr-2" />
              Pay from Wallet / Reward Points
            </>
          ) : selectedGateway === 'cashfree' ? (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Send UPI Collect Request — ₹{payableAmount?.toLocaleString()}
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Pay ₹{payableAmount?.toLocaleString()} via {gateways.find(g => g.id === selectedGateway)?.name || 'Gateway'}
            </>
          )}
        </Button>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            {selectedGateway === 'razorpay' ? 'Secured by Razorpay' : selectedGateway === 'stripe' ? 'Secured by Stripe (Test Mode)' : 'Secure payment'} • 256-bit SSL encryption
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
