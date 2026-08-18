import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Anchor, Ship, Plane, Loader2, IndianRupee, CalendarDays, CreditCard, Users, Trash2, Plus, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import api from '@/services/api';
import { toast } from 'sonner';
import RefundTracker from './RefundTracker';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const VERTICALS = [
  { id: 'helipad', label: 'Helipad Transfer', icon: Plane, unit: 'landing' },
  { id: 'yacht', label: 'Yacht Charter', icon: Anchor, unit: 'hour' },
  { id: 'cruise', label: 'Cruise Cabin', icon: Ship, unit: 'cabin/night' },
];

export default function MarineBookings({ initialVertical, hideTabs }) {
  const [params] = useSearchParams();
  const [vertical, setVertical] = useState(initialVertical || params.get('v') || 'yacht');
  const [assets, setAssets] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ start_date: '', end_date: '', quantity: 1, start_time: '', guests: '', package: '' });
  const [avail, setAvail] = useState(null);
  const [availStatus, setAvailStatus] = useState(null);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState('');
  const [manifestFor, setManifestFor] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [dealId, setDealId] = useState(null);
  const [cancelFor, setCancelFor] = useState(null);
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelReason, setCancelReason] = useState('');
  const [refundMap, setRefundMap] = useState({});
  const [collectFor, setCollectFor] = useState(null);
  const [upiId, setUpiId] = useState('dr.brajeshptiwari@okicici');
  const [collectStatus, setCollectStatus] = useState(null);
  const [linkUrl, setLinkUrl] = useState(null);
  const pollRef = React.useRef(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPoll(), []);

  const loadCashfreeSdk = () => new Promise((resolve) => {
    if (window.Cashfree) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

  const startStatusPoll = (orderId) => {
    const started = Date.now();
    stopPoll();
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 15 * 60 * 1000) { stopPoll(); setCollectStatus('timeout'); setBusy(''); return; }
      try {
        const s = await api.get(`/payments/cashfree/collect-status/${orderId}`);
        if (s.data.status === 'SUCCESS') {
          stopPoll(); setCollectStatus('success'); setBusy('');
          toast.success('UPI payment successful! Booking confirmed & paid.');
          setCollectFor(null); setLinkUrl(null); load();
        } else if (s.data.status === 'FAILED') {
          stopPoll(); setCollectStatus('failed'); setBusy('');
          toast.error('Payment failed / expired');
        }
      } catch (e) { /* keep polling */ }
    }, 4000);
  };

  const createPaymentLink = async () => {
    setBusy('link');
    try {
      const res = await api.post('/payments/cashfree/payment-link', { booking_id: collectFor.id });
      toast.success(res.data.message);
      setLinkUrl(res.data.link_url);
      setCollectStatus('pending');
      startStatusPoll(res.data.order_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Payment link failed');
      setBusy('');
    }
  };

  const sendCollect = async () => {
    const upi = upiId.trim();
    if (!upi.includes('@')) return toast.error('Valid UPI ID daaliye');
    setBusy('collect');
    setCollectStatus('sending');
    try {
      const res = await api.post('/payments/cashfree/upi-collect', { booking_id: collectFor.id, upi_id: upi });
      toast.success(res.data.message);
      if (res.data.collect_mode === 'hosted_checkout' && res.data.payment_session_id) {
        const ok = await loadCashfreeSdk();
        if (ok) {
          const cashfree = window.Cashfree({ mode: res.data.mode === 'production' ? 'production' : 'sandbox' });
          cashfree.checkout({ paymentSessionId: res.data.payment_session_id, redirectTarget: '_modal' });
        }
      }
      setCollectStatus('pending');
      startStatusPoll(res.data.order_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'UPI collect failed');
      setCollectStatus(null); setBusy('');
    }
  };

  const loadRefunds = async () => {
    try {
      const res = await api.get('/refunds/my');
      const map = {};
      (res.data.refunds || []).forEach(r => { if (!map[r.booking_id]) map[r.booking_id] = r; });
      setRefundMap(map);
    } catch (e) {}
  };

  useEffect(() => { loadRefunds(); }, []);

  useEffect(() => {
    api.get('/verticals/featured').then(r => {
      const d = (r.data.featured || []).find(x => x.deal_of_the_day);
      if (d) setDealId(d.id);
    }).catch(() => {});
  }, []);

  const load = async (v = vertical) => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get(`/verticals/assets/browse?vertical=${v}`),
        api.get('/verticals/bookings/my'),
      ]);
      setAssets(a.data.assets || []);
      setMyBookings(b.data.bookings || []);
    } catch (e) {
      toast.error('Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(vertical); }, [vertical]);

  const openBooking = async (a) => {
    setSelected(a);
    setForm({ start_date: '', end_date: '', quantity: 1, start_time: '', guests: '', package: '' });
    setAvailStatus(null);
    setQuote(null);
    setAvail(null);
    try {
      const r = await api.get(`/verticals/assets/${a.id}/availability`);
      setAvail(r.data);
      if (r.data.min_duration) setForm(f => ({ ...f, quantity: r.data.min_duration }));
    } catch (e) { setAvail({ blocked_dates: [], fully_booked_dates: [], available_slots: [], packages: [] }); }
  };

  const onDateSelect = async (dateStr, assetId, qty, pkg) => {
    setForm(f => ({ ...f, start_date: dateStr, end_date: dateStr }));
    setAvailStatus({ checking: true });
    try {
      const [chk, q] = await Promise.all([
        api.get(`/verticals/assets/${assetId}/check-availability?start_date=${dateStr}`),
        api.get(`/verticals/assets/${assetId}/quote?start_date=${dateStr}&quantity=${qty || 1}${pkg ? `&package=${encodeURIComponent(pkg)}` : ''}`),
      ]);
      setAvailStatus(chk.data);
      setQuote(q.data.breakup);
    } catch (e) {
      setAvailStatus({ available: false, message: 'Not Available' });
      setQuote(null);
    }
  };

  const refreshQuote = async (assetId, dateStr, qty, pkg) => {
    if (!dateStr) return;
    try {
      const q = await api.get(`/verticals/assets/${assetId}/quote?start_date=${dateStr}&quantity=${qty || 1}${pkg ? `&package=${encodeURIComponent(pkg)}` : ''}`);
      setQuote(q.data.breakup);
    } catch (e) {}
  };

  const book = async () => {
    if (!form.start_date) { toast.error('Select an available date'); return; }
    if (availStatus && availStatus.available === false) { toast.error('Selected date is Not Available'); return; }
    setBusy('book');
    try {
      const res = await api.post('/verticals/bookings', {
        asset_id: selected.id, start_date: form.start_date,
        end_date: form.end_date || form.start_date, quantity: parseInt(form.quantity) || 1,
        start_time: form.start_time || null,
        guests: form.guests ? parseInt(form.guests) : null,
        package: form.package || null,
      });
      toast.success(res.data.message);
      setSelected(null);
      setForm({ start_date: '', end_date: '', quantity: 1, start_time: '', guests: '', package: '' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Booking failed');
    } finally { setBusy(''); }
  };

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const pay = async (b) => {
    setBusy(`pay-${b.id}`);
    try {
      const res = await api.post(`/verticals/bookings/${b.id}/pay`);
      if (res.data.gateway === 'razorpay') {
        const ok = await loadRazorpayScript();
        if (!ok) throw new Error('Failed to load Razorpay checkout');
        const o = res.data;
        const rzp = new window.Razorpay({
          key: o.key_id, amount: o.amount_paise, currency: 'INR',
          name: 'AirYatra', description: o.description, order_id: o.order_id,
          prefill: o.prefill, theme: { color: '#f97316' },
          handler: async (response) => {
            try {
              const v = await api.post(`/verticals/bookings/${b.id}/verify-payment`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success(v.data.message);
              load();
            } catch (e) {
              toast.error(e.response?.data?.detail || 'Payment verification failed');
            } finally { setBusy(''); }
          },
          modal: { ondismiss: () => setBusy('') },
        });
        rzp.on('payment.failed', (resp) => {
          toast.error(resp.error?.description || 'Payment failed');
          setBusy('');
        });
        rzp.open();
        return;
      }
      toast.success(res.data.message);
      load();
      setBusy('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Payment failed');
      setBusy('');
    }
  };

  const openManifest = (b) => {
    setManifestFor(b);
    setPassengers(b.passengers?.length ? b.passengers : [{ name: '', age: '', gender: '', id_proof: '' }]);
  };

  const openCancel = async (b) => {
    setCancelFor(b);
    setCancelReason('');
    try {
      const res = await api.get('/refunds/reasons?audience=customer');
      setCancelReasons(res.data.reasons || []);
    } catch (e) { setCancelReasons([]); }
  };

  const submitCancel = async () => {
    setBusy('cancel');
    try {
      const res = await api.post('/refunds/customer-cancel', { booking_id: cancelFor.id, reason: cancelReason || null });
      toast.success(res.data.message);
      setCancelFor(null);
      load();
      loadRefunds();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cancellation failed');
    } finally { setBusy(''); }
  };

  const saveManifest = async () => {
    const valid = passengers.filter(p => p.name?.trim());
    if (valid.length === 0) { toast.error('Add at least one passenger name'); return; }
    setBusy('manifest');
    try {
      const res = await api.put(`/verticals/bookings/${manifestFor.id}/manifest`, { passengers: valid });
      toast.success(res.data.message);
      setManifestFor(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save manifest');
    } finally { setBusy(''); }
  };

  const V = VERTICALS.find(v => v.id === vertical);

  return (
    <div data-testid="marine-bookings-page">
      <h1 className="text-3xl font-bold text-white mb-1">Book Yacht, Cruise & Helipad</h1>
      <p className="text-slate-400 mb-6">AirYatra Marine & Helipad marketplace — browse, book, pay online.</p>

      <div className={hideTabs ? 'hidden' : 'flex gap-2 mb-6'}>
        {VERTICALS.map(v => (
          <button key={v.id} onClick={() => setVertical(v.id)}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${vertical === v.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
            data-testid={`vertical-tab-${v.id}`}>
            <v.icon className="h-4 w-4" /> {v.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div> : (
        <>
          {assets.length === 0 ? (
            <div className="glass p-10 rounded-xl text-center text-slate-400 mb-8">No {vertical}s available yet. Check back soon!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {assets.map(a => (
                <div key={a.id} className={`glass rounded-xl flex flex-col overflow-hidden ${a.id === dealId ? 'ring-2 ring-orange-500/60' : ''}`} data-testid={`browse-asset-${a.id}`}>
                  {a.id === dealId && (
                    <div className="bg-orange-500 text-white text-[11px] font-bold px-3 py-1 flex items-center gap-1" data-testid={`deal-banner-${a.id}`}>
                      <Flame className="h-3.5 w-3.5" /> DEAL OF THE DAY — 10% OFF TODAY
                    </div>
                  )}
                  {a.images?.length > 0 && (
                    <div className="relative h-40">
                      <img src={a.images[0]} alt={a.name} className="w-full h-full object-cover" />
                      {a.images.length > 1 && (
                        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                          📷 {a.images.length} photos
                        </span>
                      )}
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <V.icon className="h-5 w-5 text-cyan-400" />
                    <p className="font-semibold text-white">{a.name}</p>
                  </div>
                  <p className="text-slate-400 text-sm">{a.city}{a.location ? ` • ${a.location}` : ''} • {a.asset_code}</p>
                  {a.description && <p className="text-slate-500 text-sm mt-1 flex-1">{a.description}</p>}
                  <div className="flex items-center justify-between mt-3">
                    {a.id === dealId ? (
                      <p className="text-orange-400 font-bold flex items-center gap-1">
                        <IndianRupee className="h-4 w-4" />{Number(a.base_price * 0.9).toLocaleString('en-IN')}
                        <span className="text-slate-500 text-xs font-normal line-through">₹{Number(a.base_price).toLocaleString('en-IN')}</span>
                        <span className="text-slate-500 text-xs font-normal">/ {V.unit}</span>
                      </p>
                    ) : (
                      <p className="text-orange-400 font-bold flex items-center gap-0.5"><IndianRupee className="h-4 w-4" />{Number(a.base_price).toLocaleString('en-IN')}<span className="text-slate-500 text-xs font-normal ml-1">/ {V.unit}</span></p>
                    )}
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => openBooking(a)} data-testid={`book-asset-${a.id}`}>Book Now</Button>
                  </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-lg font-semibold text-white mb-3">My Marine & Helipad Bookings</h2>
          {myBookings.length === 0 ? (
            <div className="glass p-8 rounded-xl text-center text-slate-500">No bookings yet</div>
          ) : (
            <div className="glass rounded-xl overflow-x-auto">
              <table className="w-full text-sm" data-testid="my-vbookings-table">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-left text-xs uppercase">
                    {['Booking #', 'Asset', 'Dates', 'Qty', 'Amount', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myBookings.map(b => (
                    <React.Fragment key={b.id}>
                      <tr className="border-b border-slate-800 hover:bg-slate-800/40" data-testid={`my-vbooking-${b.id}`}>
                        <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{b.booking_number}</td>
                        <td className="px-4 py-3">
                          <p className="text-slate-200">{b.asset_name}</p>
                          <p className="text-slate-500 text-xs capitalize">{b.vertical} • {(b.passengers || []).length} pax</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{b.start_date} → {b.end_date}</td>
                        <td className="px-4 py-3 text-slate-300">{b.quantity} {b.unit}(s)</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-orange-400 whitespace-nowrap">{fmt(b.amount)}</p>
                          {b.deal_discount_applied && <p className="text-orange-400 text-[10px]">🔥 Deal -10% (saved {fmt(b.deal_discount_amount)})</p>}
                          {b.seasonal_rule_applied && <p className="text-slate-500 text-[10px]">{b.seasonal_rule_applied} pricing</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase whitespace-nowrap ${b.status === 'paid' ? 'bg-green-500/20 text-green-400' : b.status === 'confirmed' ? 'bg-blue-500/20 text-blue-300' : b.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            {b.status === 'confirmed' ? 'Confirmed — Pay Now' : b.status === 'cancellation_requested' ? 'Refund Pending' : b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {b.status === 'confirmed' && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" disabled={busy === `pay-${b.id}`}
                                  onClick={() => pay(b)} data-testid={`pay-vbooking-${b.id}`}>
                                  {busy === `pay-${b.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-1" /> Pay</>}
                                </Button>
                                <Button size="sm" variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 h-8"
                                  onClick={() => { setCollectFor(b); setCollectStatus(null); }} data-testid={`upi-collect-vbooking-${b.id}`}>
                                  <IndianRupee className="h-3.5 w-3.5 mr-1" /> UPI Collect
                                </Button>
                              </>
                            )}
                            {['pending', 'confirmed', 'paid'].includes(b.status) && (
                              <>
                                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8"
                                  onClick={() => openManifest(b)} data-testid={`manifest-btn-${b.id}`}>
                                  <Users className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-8"
                                  onClick={() => openCancel(b)} data-testid={`cancel-vbooking-${b.id}`}>
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {refundMap[b.id] && (
                        <tr className="border-b border-slate-800">
                          <td colSpan={7} className="px-4 pb-4 pt-0">
                            <RefundTracker refund={refundMap[b.id]} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={!!collectFor} onOpenChange={(o) => { if (!o) { setCollectFor(null); setLinkUrl(null); stopPoll(); setBusy(''); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white" data-testid="upi-collect-dialog">
          <DialogHeader>
            <DialogTitle>UPI Collect — {collectFor?.booking_number}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {fmt(collectFor?.amount)} ka collect request aapke UPI app (GPay) me approval ke liye jayega
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@okicici"
              className="bg-slate-800 border-slate-600 text-white font-mono"
              disabled={collectStatus === 'pending'} data-testid="marine-upi-id-input" />
            {collectStatus === 'pending' && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center gap-2 text-sm" data-testid="marine-collect-pending">
                <Loader2 className="h-4 w-4 text-blue-400 animate-spin flex-shrink-0" />
                <span className="text-blue-300">Google Pay me request approve karein — status auto-update hoga...</span>
              </div>
            )}
            {linkUrl && (
              <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-2" data-testid="marine-payment-link-box">
                <p className="text-cyan-300 text-sm font-medium">📱 Payment Link ready — phone pe kholein:</p>
                <p className="text-slate-300 font-mono text-[11px] break-all">{linkUrl}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-cyan-500/50 text-cyan-400 h-7 text-xs"
                    onClick={() => { navigator.clipboard.writeText(linkUrl); toast.success('Link copied!'); }} data-testid="copy-payment-link-btn">
                    Copy Link
                  </Button>
                  <Button size="sm" variant="outline" className="border-cyan-500/50 text-cyan-400 h-7 text-xs"
                    onClick={() => window.open(linkUrl, '_blank')} data-testid="open-payment-link-btn">
                    Open
                  </Button>
                </div>
              </div>
            )}
            {collectStatus === 'failed' && <p className="text-red-400 text-sm">❌ Collect failed/declined — dobara try karein</p>}
            {collectStatus === 'timeout' && <p className="text-amber-400 text-sm">⏱️ Request expire ho gaya</p>}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              onClick={createPaymentLink} disabled={busy === 'link' || collectStatus === 'pending'} data-testid="marine-payment-link-btn">
              {busy === 'link' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              📱 Payment Link (phone pe)
            </Button>
            <Button onClick={sendCollect} disabled={busy === 'collect' || collectStatus === 'pending'}
              className="bg-cyan-600 hover:bg-cyan-700" data-testid="marine-send-collect-btn">
              {busy === 'collect' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <IndianRupee className="h-4 w-4 mr-1" />}
              Send Collect Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelFor} onOpenChange={(o) => !o && setCancelFor(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Cancel Booking {cancelFor?.booking_number}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {cancelFor?.payment_status === 'paid'
                ? 'Cancellation policy deduction applies based on start date. Refund goes through team approval (24–48h), then 5–7 business days to your payment method.'
                : 'No payment made yet — booking will be cancelled instantly with no charges.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2" data-testid="cancel-dialog">
            <label className="block text-sm text-slate-400 mb-1">Reason (optional)</label>
            <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white h-10 rounded-md px-2 text-sm" data-testid="cancel-reason-select">
              <option value="">Select a reason</option>
              {cancelReasons.map(r => <option key={r.id} value={r.label}>{r.label}</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelFor(null)} className="border-slate-600 text-slate-300">Keep Booking</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={busy === 'cancel'} data-testid="confirm-cancel-btn">
              {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manifestFor} onOpenChange={(o) => !o && setManifestFor(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Passenger Manifest — {manifestFor?.booking_number}</DialogTitle>
            <DialogDescription className="text-slate-400">Add passenger details for boarding & compliance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2" data-testid="manifest-dialog">
            {passengers.map((p, i) => (
              <div key={i} className="grid grid-cols-[1.3fr_0.5fr_0.8fr_1fr_auto] gap-2 items-center">
                <Input value={p.name || ''} placeholder="Full name *"
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`pax-name-${i}`} />
                <Input value={p.age || ''} placeholder="Age" type="number"
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, age: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`pax-age-${i}`} />
                <select value={p.gender || ''}
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, gender: e.target.value } : x))}
                  className="bg-slate-800 border border-slate-700 text-white h-9 rounded-md px-2 text-sm" data-testid={`pax-gender-${i}`}>
                  <option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
                <Input value={p.id_proof || ''} placeholder="ID proof no."
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, id_proof: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`pax-id-${i}`} />
                <button onClick={() => setPassengers(ps => ps.filter((_, j) => j !== i))}
                  className="text-slate-500 hover:text-red-400" data-testid={`pax-remove-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300"
              onClick={() => setPassengers(ps => [...ps, { name: '', age: '', gender: '', id_proof: '' }])} data-testid="add-passenger-btn">
              <Plus className="h-4 w-4 mr-1" /> Add Passenger
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManifestFor(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={saveManifest} disabled={busy === 'manifest'} className="bg-orange-500 hover:bg-orange-600" data-testid="save-manifest-btn">
              {busy === 'manifest' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save Manifest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book {selected?.name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {fmt(selected?.base_price)} per {V?.unit} • Owner confirmation required before payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {selected?.images?.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1" data-testid="booking-gallery">
                {selected.images.map((img, i) => (
                  <img key={i} src={img} alt={`${selected.name} ${i + 1}`} className="h-24 w-36 object-cover rounded-lg flex-shrink-0 border border-slate-700" />
                ))}
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Select Available Date *</label>
              <div className="flex justify-center bg-slate-800/50 rounded-xl p-2" data-testid="customer-availability-calendar">
                <CalendarPicker
                  mode="single"
                  selected={form.start_date ? new Date(form.start_date + 'T12:00:00') : undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    onDateSelect(iso, selected.id, form.quantity, form.package);
                  }}
                  disabled={(d) => {
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    return d < today
                      || (avail?.blocked_dates || []).includes(iso)
                      || (avail?.fully_booked_dates || []).includes(iso);
                  }}
                  className="text-white"
                />
              </div>
              <p className="text-slate-500 text-xs mt-1">Blocked / fully-booked dates are disabled — only operator-available dates selectable</p>
              {availStatus && (
                availStatus.checking ? (
                  <p className="text-slate-400 text-sm mt-1 flex items-center gap-1" data-testid="availability-checking"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking availability…</p>
                ) : availStatus.available ? (
                  <p className="text-green-400 text-sm font-semibold mt-1" data-testid="availability-status-available">✅ Available – Book Now</p>
                ) : (
                  <p className="text-red-400 text-sm font-semibold mt-1" data-testid="availability-status-unavailable">❌ Not Available{availStatus.reason ? ` — ${availStatus.reason}` : ''}</p>
                )
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Start Time</label>
                <select value={form.start_time} onChange={(e) => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white h-10 rounded-md px-2 text-sm" data-testid="booking-start-time">
                  <option value="">Select time</option>
                  {((avail?.available_slots?.length ? avail.available_slots : ['06:00', '09:00', '12:00', '15:00', '18:00'])).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Duration ({V?.unit}s){avail?.min_duration ? ` — min ${avail.min_duration}` : ''}
                </label>
                <Input type="number" min={avail?.min_duration || 1} value={form.quantity}
                  onChange={(e) => { setForm(f => ({ ...f, quantity: e.target.value })); refreshQuote(selected?.id, form.start_date, e.target.value, form.package); }}
                  className="bg-slate-800 border-slate-700 text-white" data-testid="booking-quantity" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Guests</label>
                <Input type="number" min="1" value={form.guests} placeholder="No. of guests"
                  onChange={(e) => setForm(f => ({ ...f, guests: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white" data-testid="booking-guests" />
              </div>
              {(avail?.packages || []).length > 0 && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Package</label>
                  <select value={form.package}
                    onChange={(e) => { setForm(f => ({ ...f, package: e.target.value })); refreshQuote(selected?.id, form.start_date, form.quantity, e.target.value); }}
                    className="w-full bg-slate-800 border border-slate-700 text-white h-10 rounded-md px-2 text-sm" data-testid="booking-package">
                    <option value="">No package</option>
                    {avail.packages.map(p => <option key={p.name} value={p.name}>{p.name} (+{fmt(p.price)})</option>)}
                  </select>
                </div>
              )}
            </div>
            {(avail?.facilities || []).length > 0 && (
              <p className="text-slate-400 text-xs" data-testid="asset-facilities">
                <b className="text-slate-300">Facilities:</b> {avail.facilities.join(' • ')}
              </p>
            )}
            {avail?.special_conditions && (
              <p className="text-amber-400/80 text-xs" data-testid="asset-conditions">⚠️ {avail.special_conditions}</p>
            )}
            {quote && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1 text-sm" data-testid="price-breakup">
                <p className="text-slate-300 font-semibold mb-1">Price Breakup</p>
                <div className="flex justify-between text-slate-400"><span>Operator Charges</span><span>{fmt(quote.operator_charges)}</span></div>
                {quote.seasonal_adjustment !== 0 && <div className="flex justify-between text-slate-400"><span>Seasonal ({quote.seasonal_rule})</span><span>{fmt(quote.seasonal_adjustment)}</span></div>}
                {quote.deal_applied && <div className="flex justify-between text-orange-400"><span>🔥 Deal of the Day (-10%)</span><span>{fmt(quote.deal_discount)}</span></div>}
                {quote.package && <div className="flex justify-between text-slate-400"><span>Package: {quote.package}</span><span>{fmt(quote.package_price)}</span></div>}
                {(quote.additional_charges || []).map(c => (
                  <div key={c.label} className="flex justify-between text-slate-400"><span>{c.label}</span><span>{fmt(c.amount)}</span></div>
                ))}
                <div className="flex justify-between text-slate-400"><span>AirYatra Platform Fee{quote.platform_fee_pct ? ` (${quote.platform_fee_pct}%)` : ''}</span><span>{fmt(quote.platform_fee)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Applicable Taxes{quote.tax_pct ? ` (${quote.tax_pct}%)` : ''}</span><span>{fmt(quote.taxes)}</span></div>
                <div className="flex justify-between text-white font-bold border-t border-slate-700 pt-1 mt-1" data-testid="price-breakup-total">
                  <span>TOTAL CUSTOMER PAYABLE</span><span className="text-orange-400">{fmt(quote.total)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={book} disabled={busy === 'book' || !form.start_date || (availStatus && availStatus.available === false)}
              className="bg-orange-500 hover:bg-orange-600" data-testid="submit-booking-btn">
              {busy === 'book' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {availStatus?.available ? 'Available – Book Now' : 'Request Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
