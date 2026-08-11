import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/services/api';
import {
  Plane, MapPin, Clock, Users, Wifi, Utensils, Luggage, HeartPulse,
  Star, ShieldCheck, Sparkles, Timer, Loader2, ChevronLeft, Gavel,
  BadgeCheck, TrendingDown, AlertCircle, Lock, Zap, Cog
} from 'lucide-react';

const ENGINE_LABELS = { single_engine: 'Single Engine', twin_engine: 'Twin Engine', triple_engine: 'Triple Engine', quad_engine: 'Quad Engine' };

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const CountdownTimer = ({ secondsLeft }) => {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return (
    <span className={`font-mono text-2xl font-bold ${secondsLeft < 120 ? 'text-red-400' : 'text-orange-400'}`} data-testid="auction-countdown">
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
};

const AmenityIcons = ({ amenities = {}, cabinCrew }) => (
  <div className="flex flex-wrap gap-2 text-xs">
    {amenities.wifi && <span className="flex items-center gap-1 bg-slate-700/60 rounded-full px-2 py-0.5 text-blue-300"><Wifi className="h-3 w-3" /> Wi-Fi</span>}
    {amenities.oxygen && <span className="flex items-center gap-1 bg-slate-700/60 rounded-full px-2 py-0.5 text-emerald-300"><HeartPulse className="h-3 w-3" /> Oxygen</span>}
    {amenities.meals && <span className="flex items-center gap-1 bg-slate-700/60 rounded-full px-2 py-0.5 text-amber-300"><Utensils className="h-3 w-3" /> Meals</span>}
    {amenities.baggage_kg > 0 && <span className="flex items-center gap-1 bg-slate-700/60 rounded-full px-2 py-0.5 text-slate-300"><Luggage className="h-3 w-3" /> {amenities.baggage_kg}kg</span>}
    {cabinCrew > 0 && <span className="flex items-center gap-1 bg-slate-700/60 rounded-full px-2 py-0.5 text-pink-300"><Users className="h-3 w-3" /> {cabinCrew} Crew</span>}
  </div>
);

export default function MarketplaceResults({ user }) {
  const navigate = useNavigate();
  const [searchPayload, setSearchPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [booking, setBooking] = useState(null);
  const [auction, setAuction] = useState(null);
  const [auctionLive, setAuctionLive] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [tick, setTick] = useState(0);
  const [engineFilter, setEngineFilter] = useState('all');
  const pollRef = useRef(null);
  const quotesCountRef = useRef(null);

  useEffect(() => {
    if (!auctionLive || auctionLive.status !== 'active') return;
    setTick(auctionLive.seconds_left);
    const t = setInterval(() => setTick((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [auctionLive]);

  useEffect(() => {
    const raw = sessionStorage.getItem('marketplace_search');
    if (!raw) {
      toast.error('No search data. Start a new booking.');
      navigate('/booking');
      return;
    }
    const payload = JSON.parse(raw);
    setSearchPayload(payload);
    runSearch(payload);
    return () => pollRef.current && clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (payload) => {
    setLoading(true);
    try {
      const res = await api.post('/marketplace/search', payload);
      setResult(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantBook = async (option) => {
    setBooking(option.aircraft_id);
    try {
      const res = await api.post('/marketplace/book', {
        ...searchPayload,
        aircraft_id: option.aircraft_id,
        consents_accepted: searchPayload.consents_accepted,
      });
      toast.success(`${res.data.booking_number} created! Price locked for 15 minutes.`);
      sessionStorage.removeItem('marketplace_search');
      navigate(res.data.payment_url);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Booking failed');
    } finally {
      setBooking(null);
    }
  };

  const startAuction = async () => {
    try {
      const res = await api.post('/marketplace/auction/start', searchPayload);
      setAuction(res.data);
      toast.info(res.data.resumed ? 'Resuming your active auction' : `Reverse auction started! Live for ${res.data.duration_minutes} minutes.`);
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      startPolling(res.data.auction_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start auction');
    }
  };

  const playQuoteSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = i === 0 ? 880 : 1174;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.16);
      });
    } catch { /* audio not supported */ }
  };

  const startPolling = useCallback((auctionId) => {
    const poll = async () => {
      try {
        const res = await api.get(`/marketplace/auction/${auctionId}/live`);
        const quotes = res.data.quotes || [];
        const prevCount = quotesCountRef.current;
        if (prevCount !== null && quotes.length > prevCount) {
          const lowest = quotes[0];
          const amountText = lowest?.total_amount ? `₹${Number(lowest.total_amount).toLocaleString()}` : 'New quote';
          playQuoteSound();
          toast.success(`🔔 New live quote received! Lowest: ${amountText} from ${lowest?.operator_name || 'an operator'}`, { duration: 6000 });
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('AirYatra — New Auction Quote!', {
                body: `Lowest quote: ${amountText} from ${lowest?.operator_name || 'an operator'} — accept before the auction ends`,
              });
            } catch { /* notification blocked */ }
          }
        }
        quotesCountRef.current = quotes.length;
        setAuctionLive(res.data);
        if (res.data.status !== 'active') clearInterval(pollRef.current);
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
  }, []);

  const acceptQuote = async (quote) => {
    setAccepting(quote.id);
    try {
      const res = await api.post(`/marketplace/auction/${auction.auction_id}/accept/${quote.id}`, {
        consents_accepted: searchPayload.consents_accepted,
      });
      clearInterval(pollRef.current);
      toast.success(`Quote accepted! ${res.data.booking_number} — complete payment in 15 min.`);
      sessionStorage.removeItem('marketplace_search');
      navigate(res.data.payment_url);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to accept quote');
    } finally {
      setAccepting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
        <p className="text-slate-300 text-lg">AI checking route feasibility & searching all operators...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-amber-400" />
        <p className="text-slate-300">Search failed. Please try again.</p>
        <Button onClick={() => navigate('/booking')} className="bg-orange-500">Back to Booking</Button>
      </div>
    );
  }

  const { feasibility, options: allOptions, mode, fixed_route } = result;
  const options = engineFilter === 'all' ? allOptions : allOptions.filter((o) => o.engine_type === engineFilter);
  const availableEngineTypes = [...new Set(allOptions.map((o) => o.engine_type).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/booking')} className="border-slate-600 text-slate-300" data-testid="back-to-booking-btn">
            <ChevronLeft className="h-4 w-4 mr-1" /> Modify Search
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Compare & Book</h1>
        </div>

        {/* Feasibility Banner */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-6" data-testid="feasibility-banner">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-2 text-green-400 font-semibold">
              <ShieldCheck className="h-4 w-4" /> AI Feasibility: Route OK
            </span>
            <span className="flex items-center gap-2 text-slate-300">
              <MapPin className="h-4 w-4 text-orange-400" /> {searchPayload?.from_location} → {searchPayload?.to_location} ({feasibility.distance_km} km)
            </span>
            <span className="flex items-center gap-2 text-slate-300">
              <Clock className="h-4 w-4 text-orange-400" /> ~{feasibility.estimated_flight_minutes} min flight
            </span>
            <span className="flex items-center gap-2 text-slate-300">
              <Plane className="h-4 w-4 text-orange-400" /> {feasibility.service}
            </span>
            {fixed_route && (
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40">Fixed Route: {fixed_route.route_name}</Badge>
            )}
          </div>
          {feasibility.notes?.map((n, i) => (
            <p key={i} className="text-amber-400 text-xs mt-2 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {n}</p>
          ))}
        </div>

        {/* Price lock notice */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
          <Lock className="h-3.5 w-3.5 text-orange-400" />
          Prices locked for 15 minutes after booking • All prices include ferry/repositioning, 5% convenience fee & 18% GST
        </div>

        {/* ===== MARKETPLACE MODE ===== */}
        {mode === 'marketplace' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg" data-testid="options-count">
                {options.length} aircraft available from registered operators
              </h2>
              {availableEngineTypes.length > 1 && (
                <div className="flex items-center gap-2" data-testid="engine-filter">
                  <Cog className="h-4 w-4 text-slate-400" />
                  {['all', ...availableEngineTypes].map((et) => (
                    <button
                      key={et}
                      data-testid={`engine-filter-${et}`}
                      onClick={() => setEngineFilter(et)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        engineFilter === et ? 'bg-orange-500 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {et === 'all' ? 'All Engines' : ENGINE_LABELS[et] || et}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4 mb-8">
              {options.map((o) => (
                <div
                  key={o.option_id}
                  data-testid={`marketplace-option-${o.aircraft_id}`}
                  className={`relative bg-slate-800/70 border rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 ${
                    o.ai_recommended ? 'border-orange-500 shadow-lg shadow-orange-500/15' : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {o.ai_recommended && (
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" /> {o.ai_reason}
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="md:w-56 h-40 md:h-auto shrink-0">
                      <img src={o.image} alt={o.aircraft_model} className="w-full h-full object-cover" />
                    </div>
                    {/* Details */}
                    <div className="flex-1 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-white font-bold text-lg">{o.aircraft_model}</h3>
                          <p className="text-slate-400 text-sm flex items-center gap-1.5">
                            {o.operator_name}
                            {o.verified && (
                              <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
                                <BadgeCheck className="h-3.5 w-3.5" /> AirYatra Verified
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-700/60 rounded-lg px-2 py-1">
                          <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-white text-sm font-semibold">{o.rating}</span>
                          <span className="text-slate-500 text-xs">({o.total_flights} flights)</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3 text-orange-400" /> {o.capacity} seats</span>
                        {o.engine_type && (
                          <span className="flex items-center gap-1" data-testid={`engine-info-${o.aircraft_id}`}>
                            <Cog className="h-3 w-3 text-orange-400" /> {ENGINE_LABELS[o.engine_type] || o.engine_type}{o.engine_model ? ` (${o.engine_model})` : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1"><Plane className="h-3 w-3 text-orange-400" /> Pilot: {o.pilot_experience_hours.toLocaleString()}+ hrs</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-orange-400" /> Based: {o.base_city}</span>
                        <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-orange-400" /> ETA to pickup: ~{o.pricing.eta_minutes} min</span>
                      </div>
                      <AmenityIcons amenities={o.amenities} cabinCrew={o.cabin_crew} />
                      {/* Price breakdown row */}
                      <div className="text-xs text-slate-500 pt-1">
                        Base {fmt(o.pricing.base_fare)}
                        {o.pricing.ferry_charge > 0 && <> + Ferry ({o.pricing.ferry_km}km) {fmt(o.pricing.ferry_charge)}</>}
                        {o.pricing.ferry_charge === 0 && o.pricing.pricing_model === 'fixed_route' && <> • Ferry included</>}
                        {' '}+ Fees {fmt(o.pricing.convenience_fee)} + GST {fmt(o.pricing.gst)}
                      </div>
                    </div>
                    {/* Price + CTA */}
                    <div className="md:w-52 p-4 md:border-l border-t md:border-t-0 border-slate-700 flex md:flex-col items-center justify-between md:justify-center gap-3 bg-slate-900/40">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white" data-testid={`option-price-${o.aircraft_id}`}>{fmt(o.pricing.total)}</p>
                        <p className="text-slate-500 text-xs">{o.pricing.pricing_model === 'fixed_route' ? 'Fixed route price' : 'All-inclusive'}</p>
                      </div>
                      <Button
                        data-testid={`book-now-${o.aircraft_id}`}
                        disabled={booking === o.aircraft_id}
                        onClick={() => handleInstantBook(o)}
                        className="bg-orange-500 hover:bg-orange-600 w-full md:w-auto px-6"
                      >
                        {booking === o.aircraft_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4 mr-1.5" /> Book Now</>}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Auction alternative */}
            {!auction && (
              <div className="bg-slate-800/40 border border-dashed border-slate-600 rounded-xl p-5 text-center">
                <p className="text-slate-300 text-sm mb-3">
                  <Gavel className="h-4 w-4 inline mr-1 text-purple-400" />
                  Want operators to compete for a lower price? Start a live reverse auction.
                </p>
                <Button variant="outline" onClick={startAuction} className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10" data-testid="start-auction-btn">
                  <TrendingDown className="h-4 w-4 mr-2" /> Start {result.auction_duration_minutes}-min Reverse Auction
                </Button>
              </div>
            )}
          </>
        )}

        {/* ===== AUCTION MODE (auto when no options) ===== */}
        {mode === 'auction' && !auction && (
          <div className="bg-slate-800/60 border border-purple-500/40 rounded-2xl p-8 text-center" data-testid="auction-auto-panel">
            <Gavel className="h-14 w-14 text-purple-400 mx-auto mb-4" />
            <h2 className="text-white text-xl font-bold mb-2">No fixed pricing for this route yet</h2>
            <p className="text-slate-400 mb-6 max-w-lg mx-auto">
              Start a live {result.auction_duration_minutes}-minute AI Reverse Auction — all eligible operators get notified instantly and compete with their best quotes in real time.
            </p>
            <Button onClick={startAuction} className="bg-purple-600 hover:bg-purple-700 px-8 py-5 text-base" data-testid="start-auction-btn">
              <Gavel className="h-5 w-5 mr-2" /> Start Reverse Auction
            </Button>
          </div>
        )}

        {/* ===== LIVE AUCTION PANEL ===== */}
        {auction && (
          <div className="mt-8 bg-slate-800/70 border border-purple-500/40 rounded-2xl overflow-hidden" data-testid="live-auction-panel">
            <div className="bg-purple-500/15 px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-purple-500/30">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
                <div>
                  <h3 className="text-white font-bold">Live Reverse Auction</h3>
                  <p className="text-slate-400 text-xs">{auction.auction_number} • {auctionLive?.operators_notified || 0} operators notified</p>
                </div>
              </div>
              <div className="text-right">
                {auctionLive?.status === 'active' ? (
                  <>
                    <CountdownTimer secondsLeft={tick} />
                    <p className="text-slate-500 text-xs">time remaining</p>
                  </>
                ) : (
                  <Badge className="bg-slate-600">{auctionLive?.status || 'starting...'}</Badge>
                )}
              </div>
            </div>

            <div className="p-5">
              {(!auctionLive || auctionLive.quotes_count === 0) ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 text-purple-400 animate-spin mx-auto mb-3" />
                  <p className="text-slate-300">Waiting for live quotes from operators...</p>
                  <p className="text-slate-500 text-xs mt-1">Quotes refresh automatically every 5 seconds</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-300 text-sm font-medium" data-testid="live-quotes-count">
                    {auctionLive.quotes_count} live quote{auctionLive.quotes_count > 1 ? 's' : ''} — lowest first. Accept any quote instantly:
                  </p>
                  {auctionLive.quotes.map((q, idx) => (
                    <div key={q.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border ${idx === 0 ? 'bg-green-500/10 border-green-500/40' : 'bg-slate-900/50 border-slate-700'}`} data-testid={`quote-${q.id}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold">{q.operator_name || 'Operator'}</p>
                          {idx === 0 && <Badge className="bg-green-500/20 text-green-400 border border-green-500/40">Lowest</Badge>}
                        </div>
                        <p className="text-slate-400 text-xs">{q.aircraft_model || q.aircraft_type || ''} {q.notes ? `• ${q.notes}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-xl font-bold text-white">{fmt(q.total_amount)}</p>
                        <Button
                          size="sm"
                          data-testid={`accept-quote-${q.id}`}
                          disabled={accepting === q.id}
                          onClick={() => acceptQuote(q)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {accepting === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept & Pay'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {auctionLive?.status === 'expired' && auctionLive.quotes_count === 0 && (
                <div className="text-center py-4">
                  <p className="text-amber-400 text-sm">Auction ended without quotes. Try the traditional inquiry instead.</p>
                  <Button variant="outline" className="mt-3 border-slate-600 text-slate-300" onClick={() => navigate('/booking')}>Back to Booking</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
