import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Anchor, Ship, Plane, LogOut, Plus, Loader2, Check, X, CalendarDays, IndianRupee, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import GlobalSearch from '@/components/shared/GlobalSearch';
import AssetManagePanel from '@/components/verticals/AssetManagePanel';
import api from '@/services/api';
import { toast } from 'sonner';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const META = {
  helipad: { icon: Plane, label: 'Helipad Owner', color: 'text-sky-400', unit: 'per landing' },
  yacht: { icon: Anchor, label: 'Yacht Owner', color: 'text-cyan-400', unit: 'per hour' },
  cruise: { icon: Ship, label: 'Cruise Operator', color: 'text-indigo-400', unit: 'per cabin/night' },
};

export default function VerticalOwnerDashboard({ vertical, user, onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('assets');
  const [assets, setAssets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', location: '', description: '', base_price: '' });
  const [busy, setBusy] = useState('');
  const [manageAsset, setManageAsset] = useState(null);
  const [cancelFor, setCancelFor] = useState(null);
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelRemark, setCancelRemark] = useState('');
  const M = META[vertical];

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get('/verticals/assets/my'),
        api.get('/verticals/bookings/owner'),
      ]);
      setAssets((a.data.assets || []).filter(x => x.vertical === vertical));
      setBookings((b.data.bookings || []).filter(x => x.vertical === vertical));
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [vertical]);

  const addAsset = async () => {
    if (!form.name || !form.city || !form.base_price) { toast.error('Name, city and price are required'); return; }
    setBusy('add');
    try {
      await api.post('/verticals/assets', { ...form, vertical, base_price: parseFloat(form.base_price), details: {} });
      toast.success(`${vertical} registered!`);
      setShowAdd(false);
      setForm({ name: '', city: '', location: '', description: '', base_price: '' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to register');
    } finally { setBusy(''); }
  };

  const decide = async (b, action) => {
    setBusy(`${action}-${b.id}`);
    try {
      await api.put(`/verticals/bookings/${b.id}/decision`, { action });
      toast.success(`Booking ${action}ed`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally { setBusy(''); }
  };

  const openCancel = async (b) => {
    setCancelFor(b);
    setCancelReasonId('');
    setCancelRemark('');
    try {
      const res = await api.get('/refunds/reasons?audience=operator');
      setCancelReasons(res.data.reasons || []);
    } catch (e) { setCancelReasons([]); }
  };

  const submitCancel = async () => {
    if (!cancelReasonId) { toast.error('Cancellation reason is mandatory'); return; }
    setBusy('cancel');
    try {
      const res = await api.post('/refunds/operator-cancel', {
        booking_id: cancelFor.id, reason_id: cancelReasonId, remark: cancelRemark || null,
      });
      toast.success(res.data.message);
      setCancelFor(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Cancellation failed');
    } finally { setBusy(''); }
  };

  const paidEarnings = bookings.filter(b => b.payment_status === 'paid').reduce((s, b) => s + b.amount * 0.9, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid={`${vertical}-owner-dashboard`}>
      <GlobalSearch />
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <M.icon className={`h-7 w-7 ${M.color}`} />
          <div>
            <h1 className="text-lg font-bold">{M.label} Dashboard</h1>
            <p className="text-slate-500 text-xs">AirYatra {vertical.charAt(0).toUpperCase() + vertical.slice(1)} Business Line • Ctrl+K to search</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout || (() => { localStorage.clear(); navigate('/login'); })}
          className="border-slate-700 text-slate-300" data-testid="owner-logout-btn">
          <LogOut className="h-4 w-4 mr-1" /> Logout
        </Button>
      </header>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: `My ${vertical}s`, value: assets.length },
            { label: 'Total Bookings', value: bookings.length },
            { label: 'Pending Requests', value: bookings.filter(b => b.status === 'pending').length },
            { label: 'Earnings (after 10% fee)', value: fmt(paidEarnings) },
          ].map(c => (
            <div key={c.label} className="glass p-4 rounded-xl">
              <p className="text-slate-400 text-xs">{c.label}</p>
              <p className="text-lg font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {[['assets', `My ${vertical.charAt(0).toUpperCase() + vertical.slice(1)}s`], ['bookings', 'Bookings'], ['payouts', 'Payouts']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm ${tab === id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
              data-testid={`owner-tab-${id}`}>{label}</button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div> : (
          <>
            {tab === 'assets' && (
              <div>
                <div className="flex justify-end mb-4">
                  <Button onClick={() => setShowAdd(true)} className="bg-orange-500 hover:bg-orange-600" data-testid="add-asset-btn">
                    <Plus className="h-4 w-4 mr-1" /> Register {vertical}
                  </Button>
                </div>
                {assets.length === 0 ? (
                  <div className="glass p-10 rounded-xl text-center text-slate-400">No {vertical}s registered yet. Click "Register {vertical}" to go live!</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assets.map(a => (
                      <div key={a.id} className="glass p-5 rounded-xl" data-testid={`asset-card-${a.id}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{a.name} <span className="text-slate-500 text-xs">({a.asset_code})</span></p>
                            <p className="text-slate-400 text-sm">{a.city}{a.location ? ` • ${a.location}` : ''}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${a.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>{a.status}</span>
                        </div>
                        <p className="text-orange-400 font-bold mt-2 flex items-center gap-1"><IndianRupee className="h-4 w-4" />{Number(a.base_price).toLocaleString('en-IN')} <span className="text-slate-500 text-xs font-normal">{M.unit}</span></p>
                        {a.description && <p className="text-slate-500 text-sm mt-1">{a.description}</p>}
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-slate-500 text-xs">
                            Crew: {(a.crew || []).length} • Seasons: {(a.seasonal_rules || []).length} • Blocked: {(a.blocked_dates || []).length}
                          </p>
                          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8"
                            onClick={() => setManageAsset(a)} data-testid={`manage-asset-${a.id}`}>
                            <CalendarDays className="h-3.5 w-3.5 mr-1" /> Manage
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'bookings' && (
              <div className="space-y-3">
                {bookings.length === 0 ? (
                  <div className="glass p-10 rounded-xl text-center text-slate-400">No bookings yet</div>
                ) : bookings.map(b => (
                  <div key={b.id} className="glass p-4 rounded-xl flex flex-wrap items-center justify-between gap-3" data-testid={`owner-booking-${b.id}`}>
                    <div>
                      <p className="font-semibold">{b.booking_number} <span className="text-slate-500 text-xs">• {b.asset_name}</span></p>
                      <p className="text-slate-400 text-sm flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {b.start_date} → {b.end_date} • {b.quantity} {b.unit}(s) • {b.customer_name}</p>
                      <p className="text-slate-500 text-xs">Manifest: {(b.passengers || []).length} passenger(s){b.seasonal_rule_applied ? ` • Season: ${b.seasonal_rule_applied}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-orange-400">{fmt(b.amount)}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${b.status === 'paid' ? 'bg-green-500/20 text-green-400' : b.status === 'confirmed' ? 'bg-blue-500/20 text-blue-300' : b.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{b.status}</span>
                      {b.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" disabled={!!busy} onClick={() => decide(b, 'confirm')} data-testid={`confirm-booking-${b.id}`}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="destructive" className="h-8" disabled={!!busy} onClick={() => decide(b, 'reject')} data-testid={`reject-booking-${b.id}`}><X className="h-3 w-3" /></Button>
                        </div>
                      )}
                      {['confirmed', 'paid'].includes(b.status) && (
                        <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-8"
                          onClick={() => openCancel(b)} data-testid={`owner-cancel-booking-${b.id}`}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'payouts' && (
              <div className="glass rounded-xl overflow-x-auto">
                <table className="w-full text-sm" data-testid="owner-payouts-table">
                  <thead><tr className="border-b border-slate-700 text-slate-400 text-left">
                    {['Booking', 'Paid Amount', 'Platform Fee (10%)', 'Your Payout', 'Status'].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {bookings.filter(b => b.payment_status === 'paid').length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No paid bookings yet</td></tr>
                    ) : bookings.filter(b => b.payment_status === 'paid').map(b => (
                      <tr key={b.id} className="border-b border-slate-800">
                        <td className="px-4 py-3">{b.booking_number}</td>
                        <td className="px-4 py-3">{fmt(b.amount)}</td>
                        <td className="px-4 py-3 text-red-400">- {fmt(b.amount * 0.1)}</td>
                        <td className="px-4 py-3 text-green-400 font-semibold">{fmt(b.amount * 0.9)}</td>
                        <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1 w-fit"><Wallet className="h-3 w-3" /> Settlement Pending</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <AssetManagePanel asset={manageAsset} open={!!manageAsset}
        onClose={() => setManageAsset(null)} onSaved={() => { setManageAsset(null); load(); }} />

      <Dialog open={!!cancelFor} onOpenChange={(o) => !o && setCancelFor(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Cancel Booking {cancelFor?.booking_number}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {cancelFor?.payment_status === 'paid'
                ? 'Owner cancellation triggers a FULL refund to the customer (team approval required). A valid reason is mandatory.'
                : 'No payment made yet — booking will be cancelled with the selected reason.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2" data-testid="owner-cancel-dialog">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Cancellation Reason *</label>
              <select value={cancelReasonId} onChange={(e) => setCancelReasonId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white h-10 rounded-md px-2 text-sm" data-testid="owner-cancel-reason-select">
                <option value="">Select a reason (mandatory)</option>
                {cancelReasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Remark (optional)</label>
              <Input value={cancelRemark} onChange={(e) => setCancelRemark(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white" data-testid="owner-cancel-remark" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelFor(null)} className="border-slate-600 text-slate-300">Keep Booking</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={busy === 'cancel'} data-testid="owner-confirm-cancel-btn">
              {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Register New {vertical.charAt(0).toUpperCase() + vertical.slice(1)}</DialogTitle>
            <DialogDescription className="text-slate-400">Fill in the details to list on the AirYatra marketplace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[['name', `${vertical} Name *`], ['city', 'City *'], ['location', 'Location / Marina / Port'], ['description', 'Description'], ['base_price', `Base Price (₹ ${M.unit}) *`]].map(([k, label]) => (
              <div key={k}>
                <label className="block text-sm text-slate-400 mb-1">{label}</label>
                <Input value={form[k]} type={k === 'base_price' ? 'number' : 'text'}
                  onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white" data-testid={`asset-input-${k}`} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={addAsset} disabled={busy === 'add'} className="bg-orange-500 hover:bg-orange-600" data-testid="submit-asset-btn">
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
