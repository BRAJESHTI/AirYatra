import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Loader2, Send, PieChart, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '../../services/api';

const formatCr = (p) => `₹${(p / 10000000).toFixed(p % 10000000 === 0 ? 0 : 1)} Cr`;

export const FractionalSection = ({ user }) => {
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [shares, setShares] = useState(1);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/exchange/fractional')
      .then(res => setOfferings(res.data.offerings || []))
      .catch(() => toast.error('Failed to load fractional offerings'))
      .finally(() => setLoading(false));
  }, []);

  const openReserve = (offering) => {
    if (!user) {
      toast.error('Please login to reserve a share');
      return;
    }
    setShares(1);
    setPhone('');
    setMessage('');
    setSelected(offering);
  };

  const reserve = async () => {
    setSending(true);
    try {
      const res = await api.post(`/exchange/fractional/${selected.id}/reserve`, {
        shares: parseInt(shares, 10), phone, message,
      });
      toast.success(res.data.message);
      setSelected(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to reserve share');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-center text-slate-500 py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div data-testid="fractional-section">
      <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-5 mb-8 flex items-start gap-3">
        <PieChart className="h-6 w-6 text-orange-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-white font-bold">Own an aircraft at 1/8th the cost</h2>
          <p className="text-slate-400 text-sm mt-1">
            Buy a share, get guaranteed flying hours every year — AirYatra manages crew, hangarage & maintenance. Reserve now, our investment desk completes your allocation. No payment required today.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="fractional-grid">
        {offerings.map(o => {
          const sold = o.total_shares - o.shares_available;
          const pct = Math.round((sold / o.total_shares) * 100);
          return (
            <div key={o.id} className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden hover:border-orange-500/50 transition-all" data-testid={`fractional-card-${o.id}`}>
              <div className="relative h-44 overflow-hidden">
                <img src={o.image} alt={o.title} className="w-full h-full object-cover" />
                <Badge className="absolute top-3 left-3 bg-orange-500 text-white">
                  <Gem className="h-3 w-3 mr-1" /> 1/{o.total_shares} Share
                </Badge>
              </div>
              <div className="p-5">
                <h3 className="text-white font-bold text-lg">{o.title}</h3>
                <p className="text-slate-500 text-xs mb-3 flex items-center gap-1"><MapPin className="h-3 w-3" /> {o.location} • {o.year}</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-800 rounded-lg p-2.5">
                    <p className="text-slate-500 text-[10px] uppercase">Per Share</p>
                    <p className="text-orange-400 font-bold" data-testid={`share-price-${o.id}`}>{formatCr(o.share_price_inr)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-2.5">
                    <p className="text-slate-500 text-[10px] uppercase">Flying Hours/yr</p>
                    <p className="text-white font-bold flex items-center gap-1"><Clock className="h-3 w-3 text-orange-400" /> {o.hours_per_share} hrs</p>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{sold}/{o.total_shares} shares sold</span>
                    <span className="text-orange-400 font-semibold" data-testid={`shares-left-${o.id}`}>{o.shares_available} left</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(o.highlights || []).map(h => (
                    <span key={h} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-[10px] text-slate-300">{h}</span>
                  ))}
                </div>
                <Button
                  onClick={() => openReserve(o)}
                  disabled={o.shares_available === 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
                  data-testid={`reserve-share-btn-${o.id}`}
                >
                  {o.shares_available === 0 ? 'Fully Subscribed' : 'Reserve Share'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md" data-testid="reserve-share-dialog">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Reserve Shares — {selected.title}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Expression of interest only — no payment today. Our investment desk will call you to complete allocation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Number of Shares (max {selected.shares_available})</label>
                  <select
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md px-3 text-sm text-white"
                    data-testid="reserve-shares-select"
                  >
                    {Array.from({ length: selected.shares_available }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} share{n > 1 ? 's' : ''} — {formatCr(selected.share_price_inr * n)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Phone Number</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxxxx" className="bg-slate-800 border-slate-600 text-white" data-testid="reserve-phone-input" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Message (optional)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Preferred usage, questions about management fees..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-sm text-white min-h-[70px]"
                    data-testid="reserve-message-input"
                  />
                </div>
                <Button onClick={reserve} disabled={sending} className="w-full bg-orange-500 hover:bg-orange-600" data-testid="reserve-submit-btn">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit Reservation
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FractionalSection;
