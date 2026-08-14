import React, { useState, useEffect } from 'react';
import { Crown, TrendingUp, Users, Plane, Building2, Gavel, PieChart as PieIcon, Loader2, RefreshCw, Tag, ClipboardCheck, Handshake, Download, Users2, CalendarCheck, Receipt, Wallet, Mail, Send, Bot, Sparkles, Shield, AlertTriangle, Ban, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import api from '../../services/api';
import AIBusinessAdvisor from '../shared/AIBusinessAdvisor';

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
  const [downloading, setDownloading] = useState(false);
  const [investorsOpen, setInvestorsOpen] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [investorInfo, setInvestorInfo] = useState(null);
  const [savingInv, setSavingInv] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false);
  const [securityStats, setSecurityStats] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/ceo/dashboard')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load CEO dashboard'))
      .finally(() => setLoading(false));
    
    // Load security stats
    api.get('/auth/login-shield/stats')
      .then(res => setSecurityStats(res.data))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const openInvestors = async () => {
    setInvestorsOpen(true);
    try {
      const res = await api.get('/ceo/investors');
      setInvestorInfo(res.data);
      setEmailsText((res.data.emails || []).join('\n'));
    } catch (e) { /* noop */ }
  };

  const saveInvestors = async () => {
    setSavingInv(true);
    try {
      const emails = emailsText.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
      const res = await api.post('/ceo/investors', { emails });
      toast.success(res.data.message);
      setEmailsText((res.data.emails || []).join('\n'));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingInv(false);
    }
  };

  const sendNow = async () => {
    setSendingNow(true);
    try {
      const res = await api.post('/ceo/investors/send-now');
      toast.success(res.data.message);
      const info = await api.get('/ceo/investors');
      setInvestorInfo(info.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send report');
    } finally {
      setSendingNow(false);
    }
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/ceo/report.pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `AirYatra_Board_Report_${(data?.period || '').replace(' ', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Board report downloaded!');
    } catch (e) {
      toast.error('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  if (loading || !data) return <div className="text-center text-slate-500 py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  const { revenue, bookings, customers, fleet, marketplace: mp, hr, memberships, partners } = data;

  return (
    <div className="space-y-6" data-testid="ceo-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-400" /> Country CEO Dashboard
          </h1>
          <p className="text-slate-400 text-sm">Executive view — revenue, fleet, marketplace & HR at a glance</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openInvestors} variant="outline" className="border-slate-700 text-slate-300 hover:border-orange-500/50" data-testid="investor-emails-btn">
            <Mail className="h-4 w-4 mr-2" /> Investors
          </Button>
          <Button onClick={downloadReport} disabled={downloading} className="bg-orange-500 hover:bg-orange-600" data-testid="download-board-report-btn">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Board Report (PDF)
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="border-slate-700 text-slate-300 self-center" data-testid="ceo-refresh-btn">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Investor Emails Dialog */}
      <Dialog open={investorsOpen} onOpenChange={setInvestorsOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md" data-testid="investor-emails-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-orange-400" /> Investor Report Distribution</DialogTitle>
            <DialogDescription className="text-slate-400">
              The board report PDF is auto-emailed to these investors on the <b className="text-orange-400">1st of every month</b>.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-xs text-slate-400">Investor Emails (one per line)</label>
            <textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder={"investor1@fund.com\ninvestor2@capital.in"}
              className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-sm text-white min-h-[110px] font-mono"
              data-testid="investor-emails-textarea"
            />
          </div>
          {investorInfo?.last_sent_at && (
            <p className="text-slate-500 text-xs">
              Last sent: {new Date(investorInfo.last_sent_at).toLocaleString('en-IN')} to {investorInfo.last_sent_count} investor(s)
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={saveInvestors} disabled={savingInv} className="flex-1 bg-orange-500 hover:bg-orange-600" data-testid="save-investors-btn">
              {savingInv ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save List
            </Button>
            <Button onClick={sendNow} disabled={sendingNow} variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10" data-testid="send-report-now-btn">
              {sendingNow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Send Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          <KPI icon={Gavel} label="Live Auctions" value={mp.auctions_live} sub={`${mp.total_bids} bids • ${mp.auction_watchers} watchers • ${fmtInr(mp.live_auction_bid_value_inr)}`} accent="text-red-400" testid="kpi-auctions" />
          <KPI icon={PieIcon} label="Fractional Shares Sold" value={`${mp.fractional_shares_sold}/${mp.fractional_shares_total}`} sub={`${fmtInr(mp.fractional_allocated_value_inr)} allocated • ${mp.fractional_new_eois} new EOIs`} accent="text-amber-400" testid="kpi-fractional" />
          <KPI icon={ClipboardCheck} label="Buyer Activity" value={mp.buyer_inquiries} sub={`inquiries • ${mp.inspections_pending} inspections pending`} accent="text-cyan-400" testid="kpi-buyer-activity" />
        </div>
      </div>

      {/* People & HR */}
      <div>
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Users2 className="h-4 w-4 text-orange-400" /> People & HR (HRMS)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPI icon={Users2} label="Internal Employees" value={hr.employees_total} accent="text-blue-400" testid="kpi-employees" />
          <KPI icon={CalendarCheck} label="Attendance Today" value={hr.attendance_today} sub="check-ins marked" accent="text-green-400" testid="kpi-attendance" />
          <KPI icon={CalendarCheck} label="Pending Leaves" value={hr.leaves_pending} sub="awaiting approval" accent="text-yellow-400" testid="kpi-leaves" />
          <KPI icon={Receipt} label="Pending Expenses" value={hr.expenses_pending_count} sub={fmtInr(hr.expenses_pending_amount_inr)} accent="text-red-400" testid="kpi-expenses" />
          <KPI icon={Wallet} label="Payroll This Month" value={fmtInr(hr.payroll_month_net_inr)} sub={`${hr.payroll_month_count} salary slips`} accent="text-purple-400" testid="kpi-payroll" />
        </div>
      </div>

      {/* Security - Login Shield AI */}
      {securityStats && (
        <div>
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-red-400" /> Login Shield AI™ Security</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI icon={Users} label="Logins (24h)" value={securityStats.total_logins} sub={`${securityStats.success_rate}% success rate`} accent="text-green-400" testid="kpi-logins" />
            <KPI icon={Ban} label="Blocked Logins" value={securityStats.blocked_logins} sub="high-risk attempts" accent="text-red-400" testid="kpi-blocked" />
            <KPI icon={AlertTriangle} label="Open Incidents" value={securityStats.open_incidents} sub="requiring review" accent={securityStats.open_incidents > 0 ? "text-orange-400" : "text-green-400"} testid="kpi-incidents" />
            <KPI icon={Globe} label="Suspicious IPs" value={securityStats.suspicious_ips} sub="3+ failed attempts" accent="text-yellow-400" testid="kpi-suspicious-ips" />
          </div>
        </div>
      )}

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

      {/* AI Business Advisor Chatbot */}
      <AIBusinessAdvisor isOpen={showAIAdvisor} onToggle={() => setShowAIAdvisor(!showAIAdvisor)} />
    </div>
  );
};

export default CEODashboard;
