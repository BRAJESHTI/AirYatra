import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, IndianRupee, BadgeCheck } from 'lucide-react';
import api from '@/services/api';

export default function MyRoutesQuotes() {
  const [routes, setRoutes] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [r, q] = await Promise.all([
          api.get('/routes/fixed/my-routes'),
          api.get('/operator/my-quotes'),
        ]);
        setRoutes(r.data.routes || []);
        setQuotes(q.data.quotes || q.data || []);
      } catch (e) {
        console.error('Failed to load routes/quotes');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>;

  return (
    <div className="space-y-8" data-testid="my-routes-quotes">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">My Fixed Routes & Quotes</h2>
        <p className="text-slate-400 text-sm">Your fixed route prices and sent quotes — including those added by Admin/CEO on your behalf.</p>
      </div>

      <div className="glass p-5 rounded-xl" data-testid="my-fixed-routes">
        <p className="text-white font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-400" /> Fixed Routes ({routes.length})</p>
        {routes.length === 0 && <p className="text-slate-500 text-sm">No fixed routes yet.</p>}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {routes.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm" data-testid={`my-route-${r.id}`}>
              <div className="text-white flex items-center gap-2 flex-wrap">
                <span className="font-medium">{r.origin} → {r.destination}</span>
                <span className="text-slate-400 text-xs">{r.aircraft_type || 'helicopter'}</span>
                <span className="text-green-400 text-xs font-semibold">₹{Number(r.base_price || 0).toLocaleString()}</span>
                {r.added_by_admin && (
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1" data-testid={`route-admin-badge-${r.id}`}>
                    <BadgeCheck className="h-3 w-3" /> Added by {r.added_by_role || 'Admin'}
                  </span>
                )}
                {(r.status === 'active' || r.is_active) ? (
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">Active</span>
                ) : (
                  <span className="text-[10px] bg-slate-600/40 text-slate-400 px-1.5 py-0.5 rounded-full">Inactive</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass p-5 rounded-xl" data-testid="my-quotes-list">
        <p className="text-white font-semibold mb-3 flex items-center gap-2"><IndianRupee className="h-4 w-4 text-orange-400" /> My Quotes ({quotes.length})</p>
        {quotes.length === 0 && <p className="text-slate-500 text-sm">No quotes sent yet.</p>}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {quotes.map((q) => (
            <div key={q.id} className="bg-slate-800/60 rounded-lg px-3 py-2 text-sm" data-testid={`my-quote-${q.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-white flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-slate-400">{(q.booking_id || '').slice(0, 8)}</span>
                  <span className="text-green-400 font-semibold">Payout ₹{Number(q.operator_payout || q.amount || 0).toLocaleString()}</span>
                  {q.platform_fee > 0 && <span className="text-orange-400 text-xs">+ Fee ₹{Number(q.platform_fee).toLocaleString()}</span>}
                  {q.urgency_surcharge > 0 && <span className="text-yellow-400 text-xs">+ Urgency ₹{Number(q.urgency_surcharge).toLocaleString()}</span>}
                  <span className="text-white text-xs">= Customer ₹{Number(q.amount || q.quoted_price || 0).toLocaleString()}</span>
                  {q.submitted_by_admin && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1" data-testid={`quote-admin-badge-${q.id}`}>
                      <BadgeCheck className="h-3 w-3" /> By {q.submitted_by_role || 'Admin'}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${q.status === 'accepted' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {q.status || 'pending'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
