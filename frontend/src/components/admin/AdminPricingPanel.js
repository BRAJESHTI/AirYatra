import React, { useState, useEffect } from 'react';
import { MapPin, Plane, Plus, Trash2, Loader2, IndianRupee, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/services/api';

const inputCls = 'bg-slate-800 border-slate-700';
const selectCls = 'w-full h-10 rounded-md bg-slate-800 border border-slate-700 text-white text-sm px-3';

export default function AdminPricingPanel() {
  const [operators, setOperators] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [ownFleet, setOwnFleet] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const [routeForm, setRouteForm] = useState({ operator_id: '', origin: '', destination: '', aircraft_type: 'helicopter', base_price: '' });
  const [quoteForm, setQuoteForm] = useState({ booking_id: '', operator_id: '', amount: '', notes: '' });
  const [acForm, setAcForm] = useState({ model_name: '', service_category: 'helicopter', registration_number: '', capacity: '', hourly_rate: '', engine_type: 'single_engine', engine_model: '', base_city: 'Mumbai', ownership: 'own' });

  const loadAll = async () => {
    try {
      const [ops, rts, own, bks] = await Promise.all([
        api.get('/admin/pricing/operators'),
        api.get('/admin/pricing/fixed-routes'),
        api.get('/admin/pricing/own-aircraft'),
        api.get('/admin/pricing/pending-quote-bookings'),
      ]);
      setOperators(ops.data.operators || []);
      setRoutes(rts.data.routes || []);
      setOwnFleet(own.data.aircraft || []);
      setBookings(bks.data.bookings || []);
    } catch (e) {
      toast.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const addRoute = async (e) => {
    e.preventDefault();
    setSaving('route');
    try {
      await api.post('/admin/pricing/fixed-route', { ...routeForm, base_price: parseFloat(routeForm.base_price) });
      toast.success('Fixed route added on operator behalf');
      setRouteForm({ operator_id: '', origin: '', destination: '', aircraft_type: 'helicopter', base_price: '' });
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add route');
    } finally { setSaving(''); }
  };

  const sendQuote = async (e) => {
    e.preventDefault();
    setSaving('quote');
    try {
      const res = await api.post('/admin/pricing/quote-on-behalf', { ...quoteForm, amount: parseFloat(quoteForm.amount) });
      const q = res.data.quote;
      toast.success(`Quote sent! Customer total ₹${q.amount.toLocaleString()} (payout ₹${q.operator_payout.toLocaleString()} + fee ₹${q.platform_fee.toLocaleString()}${q.urgency_surcharge > 0 ? ` + urgency ₹${q.urgency_surcharge.toLocaleString()}` : ''})`);
      setQuoteForm({ booking_id: '', operator_id: '', amount: '', notes: '' });
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send quote');
    } finally { setSaving(''); }
  };

  const addAircraft = async (e) => {
    e.preventDefault();
    setSaving('aircraft');
    try {
      await api.post('/admin/pricing/own-aircraft', { ...acForm, capacity: parseInt(acForm.capacity), hourly_rate: parseFloat(acForm.hourly_rate) });
      toast.success('AirYatra aircraft live on marketplace');
      setAcForm({ model_name: '', service_category: 'helicopter', registration_number: '', capacity: '', hourly_rate: '', engine_type: 'single_engine', engine_model: '', base_city: 'Mumbai', ownership: 'own' });
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add aircraft');
    } finally { setSaving(''); }
  };

  const updateRent = async (ac) => {
    const val = window.prompt(`New hourly rent price for ${ac.model_name} (₹):`, ac.hourly_rate);
    if (!val) return;
    try {
      await api.put(`/admin/pricing/own-aircraft/${ac.id}`, { hourly_rate: parseFloat(val) });
      toast.success('Rent price updated');
      loadAll();
    } catch (e) { toast.error(e.response?.data?.detail || 'Update failed'); }
  };

  const removeAircraft = async (ac) => {
    if (!window.confirm(`Remove ${ac.model_name} from marketplace?`)) return;
    try {
      await api.delete(`/admin/pricing/own-aircraft/${ac.id}`);
      toast.success('Aircraft removed');
      loadAll();
    } catch (e) { toast.error('Delete failed'); }
  };

  const deactivateRoute = async (r) => {
    if (!window.confirm(`Deactivate route ${r.origin} → ${r.destination}?`)) return;
    try {
      await api.delete(`/admin/pricing/fixed-route/${r.id}`);
      toast.success('Route deactivated');
      loadAll();
    } catch (e) { toast.error('Failed'); }
  };

  if (loading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>;

  const opSelect = (value, onChange, testid) => (
    <select value={value} onChange={onChange} required className={selectCls} data-testid={testid}>
      <option value="">Select operator</option>
      {operators.map((o) => <option key={o.id} value={o.id}>{o.company_name}</option>)}
    </select>
  );

  return (
    <div className="max-w-6xl space-y-8" data-testid="admin-pricing-panel">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Route Pricing & Own Fleet</h2>
        <p className="text-slate-400 text-sm">Add fixed route prices / custom quotes on behalf of operators, and list AirYatra's own helicopters on the marketplace.</p>
      </div>

      {/* 1. Fixed Route on behalf */}
      <div className="glass p-5 rounded-xl" data-testid="behalf-route-section">
        <p className="text-white font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-400" /> Add Fixed Route (Operator Behalf)</p>
        <form onSubmit={addRoute} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="space-y-1 md:col-span-2"><Label className="text-xs text-slate-400">Operator *</Label>
            {opSelect(routeForm.operator_id, (e) => setRouteForm({ ...routeForm, operator_id: e.target.value }), 'behalf-route-operator')}</div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Origin *</Label>
            <Input required placeholder="Mumbai" value={routeForm.origin} onChange={(e) => setRouteForm({ ...routeForm, origin: e.target.value })} className={inputCls} data-testid="behalf-route-origin" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Destination *</Label>
            <Input required placeholder="Shirdi" value={routeForm.destination} onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })} className={inputCls} data-testid="behalf-route-destination" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Service</Label>
            <select value={routeForm.aircraft_type} onChange={(e) => setRouteForm({ ...routeForm, aircraft_type: e.target.value })} className={selectCls} data-testid="behalf-route-type">
              <option value="helicopter">Helicopter</option><option value="chartered_plane">Jet</option><option value="yacht_cruiser">Yacht</option><option value="air_ambulance">Air Ambulance</option>
            </select></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Base Price ₹ *</Label>
            <Input required type="number" min="1" placeholder="150000" value={routeForm.base_price} onChange={(e) => setRouteForm({ ...routeForm, base_price: e.target.value })} className={inputCls} data-testid="behalf-route-price" /></div>
          <Button type="submit" disabled={saving === 'route'} className="bg-orange-500 hover:bg-orange-600 md:col-span-6 w-fit" data-testid="behalf-route-submit">
            {saving === 'route' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add Route</>}
          </Button>
        </form>
        <div className="mt-4 space-y-2 max-h-56 overflow-y-auto" data-testid="behalf-routes-list">
          {routes.slice(0, 15).map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
              <div className="text-white flex items-center gap-2 flex-wrap">
                <span>{r.origin} → {r.destination}</span>
                <span className="text-slate-400 text-xs">₹{Number(r.base_price || 0).toLocaleString()} • {r.operator_name}</span>
                {r.added_by_admin && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full uppercase">By {r.added_by_role || 'Admin'}</span>}
                {r.status !== 'active' && <span className="text-[10px] bg-slate-600/40 text-slate-400 px-1.5 py-0.5 rounded-full">Inactive</span>}
              </div>
              {r.status === 'active' && (
                <Button size="sm" variant="outline" onClick={() => deactivateRoute(r)} className="border-red-500/40 text-red-400 h-7" data-testid={`deactivate-route-${r.id}`}>
                  <Trash2 className="h-3 w-3" /></Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Quote on behalf */}
      <div className="glass p-5 rounded-xl" data-testid="behalf-quote-section">
        <p className="text-white font-semibold mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-orange-400" /> Send Custom Quote (Operator Behalf)</p>
        <form onSubmit={sendQuote} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1 md:col-span-2"><Label className="text-xs text-slate-400">Booking *</Label>
            <select required value={quoteForm.booking_id} onChange={(e) => setQuoteForm({ ...quoteForm, booking_id: e.target.value })} className={selectCls} data-testid="behalf-quote-booking">
              <option value="">Select pending booking</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {(b.booking_number || b.inquiry_number || b.id.slice(0, 8))} • {b.from_location} → {b.to_location} • {b.customer_name || ''}
                </option>
              ))}
            </select></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Operator *</Label>
            {opSelect(quoteForm.operator_id, (e) => setQuoteForm({ ...quoteForm, operator_id: e.target.value }), 'behalf-quote-operator')}</div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Operator Payout ₹ *</Label>
            <Input required type="number" min="1" placeholder="200000" value={quoteForm.amount} onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })} className={inputCls} data-testid="behalf-quote-amount" /></div>
          <Button type="submit" disabled={saving === 'quote'} className="bg-orange-500 hover:bg-orange-600" data-testid="behalf-quote-submit">
            {saving === 'quote' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Quote'}
          </Button>
        </form>
        <p className="text-slate-500 text-xs mt-2">Platform fee + urgency surcharge automatically apply hokar customer total banega. Quote operator ke panel me "By Admin" badge ke saath dikhega.</p>
      </div>

      {/* 3. AirYatra Own Fleet */}
      <div className="glass p-5 rounded-xl" data-testid="own-fleet-section">
        <p className="text-white font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-orange-400" /> AirYatra Own/Rented Fleet (Marketplace Listing)</p>
        <form onSubmit={addAircraft} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1"><Label className="text-xs text-slate-400">Model *</Label>
            <Input required placeholder="Airbus H130" value={acForm.model_name} onChange={(e) => setAcForm({ ...acForm, model_name: e.target.value })} className={inputCls} data-testid="own-ac-model" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Service</Label>
            <select value={acForm.service_category} onChange={(e) => setAcForm({ ...acForm, service_category: e.target.value })} className={selectCls} data-testid="own-ac-category">
              <option value="helicopter">Helicopter</option><option value="chartered_plane">Jet</option><option value="yacht_cruiser">Yacht</option><option value="joy_ride">Joy Ride</option>
            </select></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Registration *</Label>
            <Input required placeholder="VT-AYO" value={acForm.registration_number} onChange={(e) => setAcForm({ ...acForm, registration_number: e.target.value })} className={inputCls} data-testid="own-ac-reg" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Seats *</Label>
            <Input required type="number" min="1" placeholder="6" value={acForm.capacity} onChange={(e) => setAcForm({ ...acForm, capacity: e.target.value })} className={inputCls} data-testid="own-ac-capacity" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Rent Price ₹/hr *</Label>
            <Input required type="number" min="1" placeholder="95000" value={acForm.hourly_rate} onChange={(e) => setAcForm({ ...acForm, hourly_rate: e.target.value })} className={inputCls} data-testid="own-ac-rate" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Engine</Label>
            <select value={acForm.engine_type} onChange={(e) => setAcForm({ ...acForm, engine_type: e.target.value })} className={selectCls} data-testid="own-ac-engine">
              <option value="single_engine">Single Engine</option><option value="twin_engine">Twin Engine</option>
            </select></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Engine Model</Label>
            <Input placeholder="Arriel 2D" value={acForm.engine_model} onChange={(e) => setAcForm({ ...acForm, engine_model: e.target.value })} className={inputCls} data-testid="own-ac-engine-model" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Base City</Label>
            <Input placeholder="Mumbai" value={acForm.base_city} onChange={(e) => setAcForm({ ...acForm, base_city: e.target.value })} className={inputCls} data-testid="own-ac-city" /></div>
          <div className="space-y-1"><Label className="text-xs text-slate-400">Ownership</Label>
            <select value={acForm.ownership} onChange={(e) => setAcForm({ ...acForm, ownership: e.target.value })} className={selectCls} data-testid="own-ac-ownership">
              <option value="own">AirYatra Own</option><option value="rented">Self-Rented</option>
            </select></div>
          <Button type="submit" disabled={saving === 'aircraft'} className="bg-orange-500 hover:bg-orange-600" data-testid="own-ac-submit">
            {saving === 'aircraft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> List on Marketplace</>}
          </Button>
        </form>
        <div className="mt-4 space-y-2" data-testid="own-fleet-list">
          {ownFleet.length === 0 && <p className="text-slate-500 text-sm">No AirYatra own aircraft listed yet.</p>}
          {ownFleet.map((ac) => (
            <div key={ac.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm" data-testid={`own-ac-${ac.id}`}>
              <div className="text-white flex items-center gap-2 flex-wrap">
                <Plane className="h-4 w-4 text-orange-400" />
                <span className="font-medium">{ac.model_name}</span>
                <span className="text-slate-400 text-xs">{ac.registration_number} • {ac.capacity} seats • {ac.base_location}</span>
                <span className="text-green-400 text-xs font-semibold">₹{Number(ac.hourly_rate).toLocaleString()}/hr</span>
                <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full uppercase">{ac.ownership === 'rented' ? 'Self-Rented' : 'AirYatra Own'}</span>
                {!ac.is_available && <span className="text-[10px] bg-slate-600/40 text-slate-400 px-1.5 py-0.5 rounded-full">Unavailable</span>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => updateRent(ac)} className="border-slate-600 text-slate-300 h-7" data-testid={`edit-rent-${ac.id}`}>
                  <IndianRupee className="h-3 w-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => removeAircraft(ac)} className="border-red-500/40 text-red-400 h-7" data-testid={`remove-own-ac-${ac.id}`}>
                  <Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
