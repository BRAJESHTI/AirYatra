import React, { useState, useEffect, useCallback } from 'react';
import { Gavel, Clock, MapPin, Loader2, TrendingUp, History, BadgeCheck, Bell, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '../../services/api';

const formatCr = (p) => `₹${(p / 10000000).toFixed(p % 10000000 === 0 ? 0 : 2)} Cr`;

const timeLeft = (endsAt, now) => {
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
};

const RESULT_LABELS = {
  sold: { label: 'Sold ✅', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  reserve_not_met: { label: 'Reserve Not Met', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  no_bids: { label: 'No Bids', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

export const AuctionSection = ({ user }) => {
  const [data, setData] = useState({ live: [], ended: [] });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState(null);
  const [bidCr, setBidCr] = useState('');
  const [bids, setBids] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [watching, setWatching] = useState([]);
  const [togglingWatch, setTogglingWatch] = useState(null);

  const load = useCallback(() => {
    api.get('/exchange/auctions')
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  useEffect(() => {
    if (user) {
      api.get('/exchange/auctions/watchlist/my')
        .then(res => setWatching(res.data.auction_ids || []))
        .catch(() => {});
    }
  }, [user]);

  const toggleWatch = async (auction) => {
    if (!user) {
      toast.error('Please login to watch this auction / लॉगिन करें');
      return;
    }
    setTogglingWatch(auction.id);
    try {
      const res = await api.post(`/exchange/auctions/${auction.id}/watch`);
      setWatching(prev => res.data.watching ? [...prev, auction.id] : prev.filter(id => id !== auction.id));
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update watchlist');
    } finally {
      setTogglingWatch(null);
    }
  };

  const openBid = async (auction) => {
    if (!user) {
      toast.error('Please login to place a bid / बोली लगाने के लिए लॉगिन करें');
      return;
    }
    setBidCr('');
    setSelected(auction);
    try {
      const res = await api.get(`/exchange/auctions/${auction.id}/bids`);
      setBids(res.data.bids || []);
    } catch (e) { setBids([]); }
  };

  const minNext = selected
    ? (selected.bid_count > 0 ? selected.current_bid_inr + selected.min_increment_inr : selected.starting_bid_inr)
    : 0;

  const placeBid = async () => {
    const amount = parseFloat(bidCr) * 10000000;
    if (!amount || amount <= 0) { toast.error('Enter a valid bid amount'); return; }
    setPlacing(true);
    try {
      const res = await api.post(`/exchange/auctions/${selected.id}/bid`, { amount_inr: amount });
      toast.success(res.data.message);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to place bid');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <div className="text-center text-slate-500 py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div data-testid="auction-section">
      <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-5 mb-8 flex items-start gap-3">
        <Gavel className="h-6 w-6 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-white font-bold">Live Aircraft Auctions / लाइव नीलामी</h2>
          <p className="text-slate-400 text-sm mt-1">
            Bid on high-demand aircraft with transparent countdowns. Watch an auction to get an email reminder before it ends. Highest bid above reserve wins — no payment today.
          </p>
        </div>
      </div>

      {data.live.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl" data-testid="no-live-auctions">
          <Gavel className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No live auctions right now. Check back soon!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="live-auctions-grid">
          {data.live.map(a => {
            const tl = timeLeft(a.ends_at, now);
            const isWatching = watching.includes(a.id);
            return (
              <div key={a.id} className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden hover:border-orange-500/50 transition-all" data-testid={`auction-card-${a.id}`}>
                <div className="relative h-44 overflow-hidden">
                  <img src={a.image} alt={a.title} className="w-full h-full object-cover" />
                  <Badge className="absolute top-3 left-3 bg-red-500 text-white animate-pulse">● LIVE</Badge>
                  <button
                    onClick={() => toggleWatch(a)}
                    disabled={togglingWatch === a.id}
                    className={`absolute top-3 right-3 rounded-full p-2 backdrop-blur transition-all ${isWatching ? 'bg-orange-500 text-white' : 'bg-slate-950/80 text-slate-300 hover:text-orange-400'}`}
                    title={isWatching ? 'Watching — reminder on' : 'Watch this auction'}
                    data-testid={`watch-auction-btn-${a.id}`}
                  >
                    {togglingWatch === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className={`h-4 w-4 ${isWatching ? 'fill-white' : ''}`} />}
                  </button>
                  <div className="absolute bottom-3 right-3 bg-slate-950/85 backdrop-blur px-3 py-1 rounded-full text-white text-xs font-mono flex items-center gap-1" data-testid={`auction-timer-${a.id}`}>
                    <Clock className="h-3 w-3 text-orange-400" /> {tl || 'Ending...'}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-white font-bold text-lg">{a.title}</h3>
                  <p className="text-slate-500 text-xs mb-3 flex items-center gap-1"><MapPin className="h-3 w-3" /> {a.location} • {a.year}</p>
                  <div className="flex items-end justify-between mb-1">
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase">{a.bid_count > 0 ? 'Current Bid' : 'Starting Bid'}</p>
                      <p className="text-orange-400 font-bold text-xl" data-testid={`auction-current-bid-${a.id}`}>
                        {formatCr(a.bid_count > 0 ? a.current_bid_inr : a.starting_bid_inr)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs">{a.bid_count} bid{a.bid_count !== 1 ? 's' : ''}</p>
                      {(a.watchers || 0) > 0 && (
                        <p className="text-slate-500 text-[10px] flex items-center gap-0.5 justify-end" data-testid={`auction-watchers-${a.id}`}>
                          <Eye className="h-3 w-3" /> {a.watchers} watching
                        </p>
                      )}
                      {a.reserve_met && <p className="text-green-400 text-[10px] flex items-center gap-0.5 justify-end"><BadgeCheck className="h-3 w-3" /> Reserve met</p>}
                    </div>
                  </div>
                  {a.bid_count > 0 && a.highest_bidder_name && (
                    <p className="text-slate-500 text-xs mb-3">Leading: {a.highest_bidder_name}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => openBid(a)} className="flex-1 bg-orange-500 hover:bg-orange-600" data-testid={`place-bid-btn-${a.id}`}>
                      <Gavel className="h-4 w-4 mr-2" /> Place Bid
                    </Button>
                    <Button
                      onClick={() => toggleWatch(a)}
                      disabled={togglingWatch === a.id}
                      variant="outline"
                      className={isWatching ? 'border-orange-500 text-orange-400 bg-orange-500/10' : 'border-slate-700 text-slate-300 hover:border-orange-500/50'}
                      data-testid={`watch-auction-cta-${a.id}`}
                    >
                      <Bell className={`h-4 w-4 ${isWatching ? 'fill-orange-400' : ''}`} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.ended.length > 0 && (
        <div className="mt-12">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><History className="h-4 w-4 text-slate-400" /> Recently Ended</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="ended-auctions-grid">
            {data.ended.map(a => {
              const r = RESULT_LABELS[a.result] || RESULT_LABELS.no_bids;
              return (
                <div key={a.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 opacity-80" data-testid={`ended-auction-${a.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white text-sm font-semibold">{a.title}</h4>
                    <Badge className={`border text-[10px] ${r.cls}`}>{r.label}</Badge>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    {a.bid_count > 0 ? `Final bid: ${formatCr(a.current_bid_inr)} (${a.bid_count} bids)` : `Started at ${formatCr(a.starting_bid_inr)}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md" data-testid="bid-dialog">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Gavel className="h-5 w-5 text-orange-400" /> Bid on {selected.title}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  {selected.bid_count > 0 ? `Current bid ${formatCr(selected.current_bid_inr)} • min increment ${formatCr(selected.min_increment_inr)}` : `Starting bid ${formatCr(selected.starting_bid_inr)}`}
                </DialogDescription>
              </DialogHeader>
              <div className="bg-slate-800 rounded-lg p-3 text-sm flex items-center justify-between">
                <span className="text-slate-400">Minimum next bid</span>
                <span className="text-orange-400 font-bold" data-testid="min-next-bid">{formatCr(minNext)}</span>
              </div>
              <div>
                <label className="text-xs text-slate-400">Your Bid (₹ Crores)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={bidCr}
                  onChange={(e) => setBidCr(e.target.value)}
                  placeholder={(minNext / 10000000).toFixed(2)}
                  className="bg-slate-800 border-slate-600 text-white"
                  data-testid="bid-amount-input"
                />
              </div>
              <Button onClick={placeBid} disabled={placing} className="w-full bg-orange-500 hover:bg-orange-600" data-testid="bid-submit-btn">
                {placing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                Confirm Bid
              </Button>
              {bids.length > 0 && (
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-slate-400 text-xs mb-2 flex items-center gap-1"><History className="h-3 w-3" /> Bid History</p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto" data-testid="bid-history-list">
                    {bids.map(b => (
                      <div key={b.id} className="flex items-center justify-between text-xs bg-slate-800/60 rounded px-2.5 py-1.5">
                        <span className="text-slate-300">{b.bidder_name}</span>
                        <span className="text-orange-400 font-semibold">{formatCr(b.amount_inr)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuctionSection;
