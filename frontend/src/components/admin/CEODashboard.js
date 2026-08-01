import React, { useState, useEffect } from 'react';
import { Crown, TrendingUp, Users, Plane, Building2, Gavel, PieChart as PieIcon, Loader2, RefreshCw, Tag, ClipboardCheck, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import api from '../../services/api';

const fmtInr = (v) => {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)} L`;
  return `₹${(v || 0).toLocaleString('en-IN')}`;
};

const KPI = ({ icon: Icon, label, value, sub, accent = 'text-orange-400', testid }) => (
  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-orange-500/40 transition-colors" data-testid={testid}>
    <div className="flex items-center justify-between">
      <Icon className={`h-5 w-5 ${accent}`} />
    </div>
    <p className="text-2xl font-bold text-white mt-2">{value}</p>
    <p className="text-slate-400 text-xs">{label}</p>
    {sub && <p className="text-slate-500 text-[11px] mt-0.5">{sub}</p>}
  </div>
);

const CEODashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/ceo/dashboard')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load CEO dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading || !data) return <div className="text-center text-slate-500 py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  const { revenue, bookings, customers, fleet, marketplace: mp, memberships, partners } = data;

  return (
    <div className="space-y-6" data-testid="ceo-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-400" /> Country CEO Dashboard
          </h1>
          <p className="text-slate-400 text-sm">Executive view — revenue, fleet & marketplace at a glance / एक नज़र में पूरा कारोबार</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="border-slate-700 text-slate-300" data-testid="ceo-refresh-btn">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Revenue & Growth */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={TrendingUp} label="Revenue Collected" value={fmtInr(revenue.total_collected_inr)} sub={`Accepted quotes: ${fmtInr(revenue.accepted_quotes_value_inr)}`} accent="text-green-400" testid="kpi-revenue" />
        <KPI icon={Tag} label="Total Bookings" value={bookings.total} sub={`${bookings.this_month} this month`} testid="kpi-bookings" />
        <KPI icon={Users} label="Customers" value={customers.total} sub={`+${customers.new_this_month} this month`} accent="text-blue-400" testid="kpi-customers" />
        <KPI icon={Building2} label="Operators" value={`${fleet.operators_active}/${fleet.operators_total}`} sub={`${fleet.aircraft_available}/${fleet.aircraft_total} aircraft available`} accent="text-purple-400" testid="kpi-operators" />
      </div>

      {/* Marketplace */}
      <div>
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Plane className="h-4 w-4 text-orange-400" /> Aviation Exchange Marketplace</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI icon={Tag} label="Active Listings" value={mp.listings_active} sub={`${mp.listings_sold} sold • ${mp.listings_pending} pending review`} testid="kpi-listings" />
          <KPI icon={Gavel} label="Live Auctions" value={mp.auctions_live} sub={`${mp.total_bids} total bids • ${fmtInr(mp.live_auction_bid_value_inr)} bid value`} accent="text-red-400" testid="kpi-auctions" />
          <KPI icon={PieIcon} label="Fractional Shares Sold" value={`${mp.fractional_shares_sold}/${mp.fractional_shares_total}`} sub={`${fmtInr(mp.fractional_allocated_value_inr)} allocated • ${mp.fractional_new_eois} new EOIs`} accent="text-amber-400" testid="kpi-fractional" />
          <KPI icon={ClipboardCheck} label="Buyer Activity" value={mp.buyer_inquiries} sub={`inquiries • ${mp.inspections_pending} inspections pending`} accent="text-cyan-400" testid="kpi-buyer-activity" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Booking Trend */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5" data-testid="booking-trend-chart">
          <h3 className="text-white font-semibold text-sm mb-4">Booking Trend (last 6 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bookings.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#fff' }} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
              <Bar dataKey="bookings" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Memberships + Partners */}
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5" data-testid="membership-breakdown">
            <h3 className="text-white font-semibold text-sm mb-3">BLACK Memberships</h3>
            {Object.keys(memberships).length === 0 ? (
              <p className="text-slate-500 text-xs">No memberships yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(memberships).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 capitalize">{tier}</span>
                    <span className="text-orange-400 font-bold">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5" data-testid="partner-summary">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2"><Handshake className="h-4 w-4 text-orange-400" /> Partner API Platform</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-300">Active Partners</span><span className="text-white font-bold">{partners.active}/{partners.total}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">Partner Bookings</span><span className="text-white font-bold">{partners.bookings_total}</span></div>
              <div className="flex justify-between"><span className="text-slate-300">Awaiting Processing</span><span className="text-orange-400 font-bold">{partners.bookings_new}</span></div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-slate-600 text-xs">Generated {new Date(data.generated_at).toLocaleString('en-IN')}</p>
    </div>
  );
};

export default CEODashboard;
