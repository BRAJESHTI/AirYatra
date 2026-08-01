import React, { useState, useEffect, useCallback } from 'react';
import { Gavel, Loader2, Clock, StopCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '../../services/api';

const formatCr = (p) => `₹${(p / 10000000).toFixed(p % 10000000 === 0 ? 0 : 2)} Cr`;

const RESULT_STYLES = {
  sold: 'bg-green-500/15 text-green-400 border-green-500/30',
  reserve_not_met: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  no_bids: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

export const AdminAuctions = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(() => {
    api.get('/exchange/admin/auctions')
      .then(res => setAuctions(res.data.auctions || []))
      .catch(() => toast.error('Failed to load auctions'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const endNow = async (id) => {
    setActing(id);
    try {
      const res = await api.post(`/exchange/admin/auctions/${id}/end`);
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to end auction');
    } finally {
      setActing(null);
    }
  };

  if (loading) return <div className="text-center text-slate-500 py-16"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-3" data-testid="admin-auctions-list">
      {auctions.length === 0 && (
        <p className="text-slate-500 text-center py-10">No auctions yet. Use "Start Auction" on an active listing.</p>
      )}
      {auctions.map(a => (
        <div key={a.id} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4" data-testid={`admin-auction-${a.id}`}>
          <img src={a.image} alt={a.title} className="w-full sm:w-32 h-20 object-cover rounded-lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-semibold">{a.title}</h3>
              {a.status === 'live' ? (
                <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">● LIVE</Badge>
              ) : (
                <Badge className={`border ${RESULT_STYLES[a.result] || ''}`} data-testid={`auction-result-${a.id}`}>{(a.result || 'ended').replace(/_/g, ' ')}</Badge>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-1.5 flex items-center gap-4 flex-wrap">
              <span>Start: <span className="text-white">{formatCr(a.starting_bid_inr)}</span></span>
              <span>Reserve: <span className="text-white">{formatCr(a.reserve_price_inr)}</span></span>
              <span>Current: <span className="text-orange-400 font-bold">{a.bid_count > 0 ? formatCr(a.current_bid_inr) : '—'}</span> ({a.bid_count} bids)</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Ends {new Date(a.ends_at).toLocaleString('en-IN')}</span>
            </p>
            {a.highest_bidder_name && (
              <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                <Mail className="h-3 w-3" /> Highest bidder: <span className="text-white">{a.highest_bidder_name}</span>
                {a.status === 'ended' && a.result === 'sold' && <span className="text-green-400 ml-1">← WINNER (contact for paperwork)</span>}
              </p>
            )}
          </div>
          {a.status === 'live' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => endNow(a.id)}
              disabled={!!acting}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 shrink-0 self-center"
              data-testid={`end-auction-${a.id}`}
            >
              {acting === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><StopCircle className="h-4 w-4 mr-1" /> End Now</>}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminAuctions;
