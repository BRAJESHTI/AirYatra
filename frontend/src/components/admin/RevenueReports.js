import React, { useState, useEffect } from 'react';
import { Plane, Loader2, TrendingUp, IndianRupee, MapPin } from 'lucide-react';
import api from '@/services/api';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const StatCard = ({ label, value, color = 'text-white', testid }) => (
  <div className="glass rounded-xl p-4" data-testid={testid}>
    <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

export default function RevenueReports() {
  const [ownFleet, setOwnFleet] = useState(null);
  const [feeReport, setFeeReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('all');
  const [custom, setCustom] = useState({ start: '', end: '' });

  const rangeFor = (p) => {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    if (p === 'week') {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return { start_date: iso(s), end_date: iso(today) };
    }
    if (p === 'month') {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start_date: iso(s), end_date: iso(today) };
    }
    if (p === 'custom' && custom.start && custom.end) {
      return { start_date: custom.start, end_date: custom.end };
    }
    return {};
  };

  const load = async (p = preset) => {
    setLoading(true);
    try {
      const params = rangeFor(p);
      const [of, fr] = await Promise.all([
        api.get('/admin/pricing/own-fleet-bookings', { params }),
        api.get('/admin/pricing/fee-revenue-report', { params }),
      ]);
      setOwnFleet(of.data);
      setFeeReport(fr.data);
    } catch (e) {
      console.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load('all'); }, []);

  const selectPreset = (p) => {
    setPreset(p);
    if (p !== 'custom') load(p);
  };

  if (loading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>;

  const s = ownFleet?.summary || {};
  const t = feeReport?.totals || {};

  return (
    <div className="max-w-6xl space-y-8" data-testid="revenue-reports">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Revenue Reports</h2>
        <p className="text-slate-400 text-sm">AirYatra own fleet ki bookings/earnings aur route-wise platform fee, urgency & surge income.</p>
      </div>

      {/* Date filter */}
      <div className="glass p-4 rounded-xl flex flex-wrap items-center gap-3" data-testid="report-date-filter">
        {[['all', 'All Time'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']].map(([p, label]) => (
          <button key={p} onClick={() => selectPreset(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${preset === p ? 'bg-orange-500 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'}`}
            data-testid={`report-filter-${p}`}>
            {label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2" data-testid="custom-range-inputs">
            <input type="date" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-md text-white text-xs px-2 py-1.5" data-testid="report-start-date" />
            <span className="text-slate-500 text-xs">to</span>
            <input type="date" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })}
              className="bg-slate-800 border border-slate-700 rounded-md text-white text-xs px-2 py-1.5" data-testid="report-end-date" />
            <button onClick={() => custom.start && custom.end && load('custom')}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-600 text-white hover:bg-green-500"
              data-testid="report-apply-custom">Apply</button>
          </div>
        )}
      </div>

      {/* Own Fleet Bookings */}
      <div className="glass p-5 rounded-xl" data-testid="own-fleet-bookings-section">
        <p className="text-white font-semibold mb-4 flex items-center gap-2"><Plane className="h-4 w-4 text-orange-400" /> AirYatra Own Fleet Bookings</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Bookings" value={s.total_bookings || 0} testid="own-total-bookings" />
          <StatCard label="Paid Bookings" value={s.paid_bookings || 0} color="text-green-400" testid="own-paid-bookings" />
          <StatCard label="Gross Earnings" value={fmt(s.gross_earnings)} color="text-green-400" testid="own-gross-earnings" />
          <StatCard label="Pending Amount" value={fmt(s.pending_amount)} color="text-yellow-400" testid="own-pending-amount" />
        </div>
        {(ownFleet?.bookings || []).length === 0 ? (
          <p className="text-slate-500 text-sm">AirYatra own aircraft par abhi koi booking nahi aayi.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {ownFleet.bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm flex-wrap gap-2" data-testid={`own-booking-${b.id}`}>
                <div className="text-white flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-slate-400">{b.booking_number || b.inquiry_number || b.id.slice(0, 8)}</span>
                  <span>{b.from_location} → {b.to_location}</span>
                  <span className="text-slate-400 text-xs">{b.aircraft_model} • {(b.travel_date || b.departure_date || '').slice(0, 10)} • {b.customer_name || ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-semibold">{fmt(b.amount)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${b.is_paid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {b.is_paid ? 'Paid' : b.payment_status || 'pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fee Revenue Report */}
      <div className="glass p-5 rounded-xl" data-testid="fee-revenue-section">
        <p className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-orange-400" /> Platform Fee & Surge Income (Route-wise)</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label="Platform Fees" value={fmt(t.platform_fee)} color="text-orange-400" testid="total-platform-fee" />
          <StatCard label="Urgency Income" value={fmt(t.urgency_income)} color="text-yellow-400" testid="total-urgency-income" />
          <StatCard label="Surge Income" value={fmt(t.surge_income)} color="text-red-400" testid="total-surge-income" />
          <StatCard label="Convenience Fees" value={fmt(t.convenience_fee)} color="text-blue-400" testid="total-convenience-fee" />
          <StatCard label="Realized Income" value={fmt(t.realized_income)} color="text-green-400" testid="total-realized-income" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="fee-routes-table">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700">
                <th className="text-left py-2 pr-2">Route</th>
                <th className="text-right py-2 px-2">Quotes</th>
                <th className="text-right py-2 px-2">Paid Bkgs</th>
                <th className="text-right py-2 px-2">Platform Fee</th>
                <th className="text-right py-2 px-2">Urgency</th>
                <th className="text-right py-2 px-2">Surge</th>
                <th className="text-right py-2 px-2">Convenience</th>
                <th className="text-right py-2 pl-2 text-green-400">Realized</th>
              </tr>
            </thead>
            <tbody>
              {(feeReport?.routes || []).slice(0, 25).map((r) => (
                <tr key={r.route} className="border-b border-slate-800 text-white" data-testid={`fee-route-row-${r.from_city}-${r.to_city}`}>
                  <td className="py-2 pr-2 flex items-center gap-1"><MapPin className="h-3 w-3 text-orange-400" /> {r.route}</td>
                  <td className="text-right py-2 px-2 text-slate-300">{r.quotes}</td>
                  <td className="text-right py-2 px-2 text-slate-300">{r.paid_bookings}</td>
                  <td className="text-right py-2 px-2 text-orange-300">{fmt(r.platform_fee)}</td>
                  <td className="text-right py-2 px-2 text-yellow-300">{fmt(r.urgency_income)}</td>
                  <td className="text-right py-2 px-2 text-red-300">{fmt(r.surge_income)}</td>
                  <td className="text-right py-2 px-2 text-blue-300">{fmt(r.convenience_fee)}</td>
                  <td className="text-right py-2 pl-2 text-green-400 font-semibold">{fmt(r.realized_income)}</td>
                </tr>
              ))}
              {(feeReport?.routes || []).length === 0 && (
                <tr><td colSpan="8" className="text-slate-500 text-center py-6">Abhi koi fee income data nahi.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* City rollup */}
        {(feeReport?.cities || []).length > 0 && (
          <div className="mt-5" data-testid="fee-cities-section">
            <p className="text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2"><IndianRupee className="h-4 w-4 text-orange-400" /> City-wise Income</p>
            <div className="flex flex-wrap gap-2">
              {feeReport.cities.slice(0, 12).map((c) => (
                <div key={c.city} className="bg-slate-800/60 rounded-lg px-3 py-2 text-xs" data-testid={`fee-city-${c.city}`}>
                  <span className="text-white font-medium">{c.city}</span>
                  <span className="text-slate-400"> • {c.routes} routes • </span>
                  <span className="text-green-400 font-semibold">{fmt(c.realized_income)} realized</span>
                  <span className="text-orange-300"> / {fmt(c.platform_fee + c.urgency_income + c.surge_income + c.convenience_fee)} total</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
