import React, { useState, useEffect } from 'react';
import { Anchor, Ship, Plane, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { toast } from 'sonner';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const ICONS = { helipad: Plane, yacht: Anchor, cruise: Ship };

export default function VerticalRevenue() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/verticals/reports/revenue');
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>;
  if (!data) return null;

  return (
    <div data-testid="vertical-revenue-panel">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vertical Revenue — Helipad / Yacht / Cruise</h1>
          <p className="text-slate-400 text-sm">Multi-vertical business lines revenue, commission ({data.platform_fee_pct}%) and owner payouts.</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} className="border-slate-600 text-slate-300" data-testid="refresh-vertical-btn"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {Object.entries(data.verticals).map(([v, s]) => {
          const Icon = ICONS[v];
          return (
            <div key={v} className="glass p-5 rounded-xl" data-testid={`vertical-card-${v}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-5 w-5 text-cyan-400" />
                <p className="font-semibold text-white capitalize">{v}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 ml-auto">LIVE</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Active Assets</span><span className="text-white">{s.assets}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Bookings (paid/total)</span><span className="text-white">{s.paid_bookings}/{s.bookings}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Gross Revenue</span><span className="text-orange-400 font-semibold">{fmt(s.gross_revenue)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Platform Commission</span><span className="text-green-400">{fmt(s.platform_commission)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Owner Payouts</span><span className="text-blue-400">{fmt(s.owner_payouts)}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold text-white mb-3">Recent Vertical Bookings</h2>
      <div className="glass rounded-xl overflow-x-auto">
        <table className="w-full text-sm" data-testid="vertical-bookings-table">
          <thead><tr className="border-b border-slate-700 text-slate-400 text-left">
            {['Booking', 'Vertical', 'Asset', 'Customer', 'Dates', 'Amount', 'Status'].map(h => <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {data.recent_bookings.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No vertical bookings yet</td></tr>
            ) : data.recent_bookings.map(b => (
              <tr key={b.id} className="border-b border-slate-800 text-slate-200">
                <td className="px-4 py-3 text-orange-300 whitespace-nowrap">{b.booking_number}</td>
                <td className="px-4 py-3 capitalize">{b.vertical}</td>
                <td className="px-4 py-3 whitespace-nowrap">{b.asset_name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{b.customer_name}</td>
                <td className="px-4 py-3 whitespace-nowrap">{b.start_date} → {b.end_date}</td>
                <td className="px-4 py-3 font-semibold">{fmt(b.amount)}</td>
                <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${b.status === 'paid' ? 'bg-green-500/20 text-green-400' : b.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : b.status === 'confirmed' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-400'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
