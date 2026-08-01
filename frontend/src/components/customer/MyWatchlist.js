import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Clock, Gavel, Loader2, MapPin, Trophy, Eye, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  sold: { label: 'Sold', cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  reserve_not_met: { label: 'Reserve Not Met', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  no_bids: { label: 'No Bids', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

export const MyWatchlist = ({ user }) => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [removing, setRemoving] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get('/exchange/auctions/watchlist/details')
      .then(res => setAuctions(res.data.auctions || []))
      .catch(() => toast.error('Failed to load watchlist'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  const unwatch = async (a) => {
    setRemoving(a.id);
    try {
      await api.post(`/exchange/auctions/${a.id}/watch`);
      setAuctions(prev => prev.filter(x => x.id !== a.id));
      toast.success('Removed from watchlist');
    } catch (e) {
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) return <div className="text-center text-slate-500 py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="my-watchlist">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-orange-500" /> My Watchlist / मेरी वॉचलिस्ट
          </h1>
          <p className="text-slate-400 text-sm">Auctions you're watching — we email you before they end</p>
        </div>
        <Button onClick={() => navigate('/exchange?mode=auctions')} className="bg-orange-500 hover:bg-orange-600" data-testid="explore-auctions-btn">
          <Gavel className="h-4 w-4 mr-2" /> Explore Auctions
        </Button>
      </div>

      {auctions.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-700 rounded-2xl" data-testid="no-watchlist">
          <Bell className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">You're not watching any auctions yet.</p>
          <p className="text-slate-500 text-sm mt-1">Tap the bell on any live auction — we'll remind you before the hammer falls!</p>
          <Button onClick={() => navigate('/exchange?mode=auctions')} className="mt-4 bg-orange-500 hover:bg-orange-600" data-testid="empty-explore-auctions-btn">
            <Gavel className="h-4 w-4 mr-2" /> Browse Live Auctions
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {auctions.map(a => {
            const tl = a.status === 'live' ? timeLeft(a.ends_at, now) : null;
            const r = RESULT_LABELS[a.result];
            return (
              <div key={a.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4" data-testid={`watchlist-item-${a.id}`}>
                <img src={a.image} alt={a.title} className="w-full sm:w-36 h-24 object-cover rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{a.title}</h3>
                    {a.status === 'live' ? (
                      <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">● LIVE</Badge>
                    ) : (
                      <Badge className={`border ${r?.cls || ''}`}>{r?.label || 'Ended'}</Badge>
                    )}
                    {a.is_highest_bidder && (
                      <Badge className="bg-green-500/15 text-green-400 border border-green-500/30" data-testid={`highest-bidder-${a.id}`}>
                        <Trophy className="h-3 w-3 mr-1" /> {a.status === 'live' ? "You're leading!" : a.result === 'sold' ? 'You WON! 🏆' : 'You led'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-orange-400 font-bold text-sm mt-1">
                    {a.bid_count > 0 ? formatCr(a.current_bid_inr) : `Starts at ${formatCr(a.starting_bid_inr)}`}
                    <span className="text-slate-500 font-normal ml-2">{a.bid_count} bid{a.bid_count !== 1 ? 's' : ''}</span>
                  </p>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {a.location}</span>
                    {a.status === 'live' && (
                      <span className="flex items-center gap-1 font-mono text-white" data-testid={`watchlist-timer-${a.id}`}>
                        <Clock className="h-3 w-3 text-orange-400" /> {tl || 'Ending...'}
                      </span>
                    )}
                    {(a.watchers || 0) > 0 && <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {a.watchers} watching</span>}
                    {a.reserve_met && <span className="flex items-center gap-1 text-green-400"><BadgeCheck className="h-3 w-3" /> Reserve met</span>}
                  </p>
                </div>
                <div className="flex sm:flex-col gap-2 shrink-0 self-center">
                  {a.status === 'live' && (
                    <Button size="sm" onClick={() => navigate('/exchange?mode=auctions')} className="bg-orange-500 hover:bg-orange-600" data-testid={`bid-now-${a.id}`}>
                      <Gavel className="h-4 w-4 mr-1" /> Bid Now
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => unwatch(a)} disabled={removing === a.id} className="border-slate-600 text-slate-300 hover:border-red-500/50 hover:text-red-400" data-testid={`unwatch-${a.id}`}>
                    {removing === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><BellOff className="h-4 w-4 mr-1" /> Unwatch</>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyWatchlist;
