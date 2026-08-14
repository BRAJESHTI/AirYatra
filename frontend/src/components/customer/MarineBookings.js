import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Anchor, Ship, Plane, Loader2, IndianRupee, CalendarDays, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import api from '@/services/api';
import { toast } from 'sonner';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const VERTICALS = [
  { id: 'helipad', label: 'Helipad Transfer', icon: Plane, unit: 'landing' },
  { id: 'yacht', label: 'Yacht Charter', icon: Anchor, unit: 'hour' },
  { id: 'cruise', label: 'Cruise Cabin', icon: Ship, unit: 'cabin/night' },
];

export default function MarineBookings() {
  const [params] = useSearchParams();
  const [vertical, setVertical] = useState(params.get('v') || 'yacht');
  const [assets, setAssets] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ start_date: '', end_date: '', quantity: 1 });
  const [busy, setBusy] = useState('');
  const [manifestFor, setManifestFor] = useState(null);
  const [passengers, setPassengers] = useState([]);

  const load = async (v = vertical) => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api.get(`/verticals/assets/browse?vertical=${v}`),
        api.get('/verticals/bookings/my'),
      ]);
      setAssets(a.data.assets || []);
      setMyBookings(b.data.bookings || []);
    } catch (e) {
      toast.error('Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(vertical); }, [vertical]);

  const book = async () => {
    if (!form.start_date) { toast.error('Select a date'); return; }
    setBusy('book');
    try {
      const res = await api.post('/verticals/bookings', {
        asset_id: selected.id, start_date: form.start_date,
        end_date: form.end_date || form.start_date, quantity: parseInt(form.quantity) || 1,
      });
      toast.success(res.data.message);
      setSelected(null);
      setForm({ start_date: '', end_date: '', quantity: 1 });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Booking failed');
    } finally { setBusy(''); }
  };

  const pay = async (b) => {
    setBusy(`pay-${b.id}`);
    try {
      const res = await api.post(`/verticals/bookings/${b.id}/pay`);
      toast.success(res.data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Payment failed');
    } finally { setBusy(''); }
  };

  const openManifest = (b) => {
    setManifestFor(b);
    setPassengers(b.passengers?.length ? b.passengers : [{ name: '', age: '', gender: '', id_proof: '' }]);
  };

  const saveManifest = async () => {
    const valid = passengers.filter(p => p.name?.trim());
    if (valid.length === 0) { toast.error('Add at least one passenger name'); return; }
    setBusy('manifest');
    try {
      const res = await api.put(`/verticals/bookings/${manifestFor.id}/manifest`, { passengers: valid });
      toast.success(res.data.message);
      setManifestFor(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save manifest');
    } finally { setBusy(''); }
  };

  const V = VERTICALS.find(v => v.id === vertical);

  return (
    <div data-testid="marine-bookings-page">
      <h1 className="text-3xl font-bold text-white mb-1">Book Yacht, Cruise & Helipad</h1>
      <p className="text-slate-400 mb-6">AirYatra Marine & Helipad marketplace — browse, book, pay online.</p>

      <div className="flex gap-2 mb-6">
        {VERTICALS.map(v => (
          <button key={v.id} onClick={() => setVertical(v.id)}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${vertical === v.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
            data-testid={`vertical-tab-${v.id}`}>
            <v.icon className="h-4 w-4" /> {v.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div> : (
        <>
          {assets.length === 0 ? (
            <div className="glass p-10 rounded-xl text-center text-slate-400 mb-8">No {vertical}s available yet. Check back soon!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {assets.map(a => (
                <div key={a.id} className="glass p-5 rounded-xl flex flex-col" data-testid={`browse-asset-${a.id}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <V.icon className="h-5 w-5 text-cyan-400" />
                    <p className="font-semibold text-white">{a.name}</p>
                  </div>
                  <p className="text-slate-400 text-sm">{a.city}{a.location ? ` • ${a.location}` : ''} • {a.asset_code}</p>
                  {a.description && <p className="text-slate-500 text-sm mt-1 flex-1">{a.description}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-orange-400 font-bold flex items-center gap-0.5"><IndianRupee className="h-4 w-4" />{Number(a.base_price).toLocaleString('en-IN')}<span className="text-slate-500 text-xs font-normal ml-1">/ {V.unit}</span></p>
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => setSelected(a)} data-testid={`book-asset-${a.id}`}>Book Now</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-lg font-semibold text-white mb-3">My Marine & Helipad Bookings</h2>
          <div className="space-y-3">
            {myBookings.length === 0 ? (
              <div className="glass p-8 rounded-xl text-center text-slate-500">No bookings yet</div>
            ) : myBookings.map(b => (
              <div key={b.id} className="glass p-4 rounded-xl flex flex-wrap items-center justify-between gap-3" data-testid={`my-vbooking-${b.id}`}>
                <div>
                  <p className="font-semibold text-white">{b.booking_number} <span className="text-slate-500 text-xs">• {b.asset_name} ({b.vertical})</span></p>
                  <p className="text-slate-400 text-sm flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {b.start_date} → {b.end_date} • {b.quantity} {b.unit}(s)</p>
                  <p className="text-slate-500 text-xs">
                    {(b.passengers || []).length} passenger(s) in manifest{b.seasonal_rule_applied ? ` • ${b.seasonal_rule_applied} pricing` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-orange-400">{fmt(b.amount)}</p>
                  {['pending', 'confirmed', 'paid'].includes(b.status) && (
                    <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 h-8"
                      onClick={() => openManifest(b)} data-testid={`manifest-btn-${b.id}`}>
                      <Users className="h-3.5 w-3.5 mr-1" /> Passengers
                    </Button>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${b.status === 'paid' ? 'bg-green-500/20 text-green-400' : b.status === 'confirmed' ? 'bg-blue-500/20 text-blue-300' : b.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                    {b.status === 'confirmed' ? 'Confirmed — Pay Now' : b.status}
                  </span>
                  {b.status === 'confirmed' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={busy === `pay-${b.id}`}
                      onClick={() => pay(b)} data-testid={`pay-vbooking-${b.id}`}>
                      {busy === `pay-${b.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-1" /> Pay {fmt(b.amount)}</>}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!manifestFor} onOpenChange={(o) => !o && setManifestFor(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle>Passenger Manifest — {manifestFor?.booking_number}</DialogTitle>
            <DialogDescription className="text-slate-400">Add passenger details for boarding & compliance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2" data-testid="manifest-dialog">
            {passengers.map((p, i) => (
              <div key={i} className="grid grid-cols-[1.3fr_0.5fr_0.8fr_1fr_auto] gap-2 items-center">
                <Input value={p.name || ''} placeholder="Full name *"
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`pax-name-${i}`} />
                <Input value={p.age || ''} placeholder="Age" type="number"
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, age: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`pax-age-${i}`} />
                <select value={p.gender || ''}
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, gender: e.target.value } : x))}
                  className="bg-slate-800 border border-slate-700 text-white h-9 rounded-md px-2 text-sm" data-testid={`pax-gender-${i}`}>
                  <option value="">Gender</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
                <Input value={p.id_proof || ''} placeholder="ID proof no."
                  onChange={(e) => setPassengers(ps => ps.map((x, j) => j === i ? { ...x, id_proof: e.target.value } : x))}
                  className="bg-slate-800 border-slate-700 text-white h-9" data-testid={`pax-id-${i}`} />
                <button onClick={() => setPassengers(ps => ps.filter((_, j) => j !== i))}
                  className="text-slate-500 hover:text-red-400" data-testid={`pax-remove-${i}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300"
              onClick={() => setPassengers(ps => [...ps, { name: '', age: '', gender: '', id_proof: '' }])} data-testid="add-passenger-btn">
              <Plus className="h-4 w-4 mr-1" /> Add Passenger
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManifestFor(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={saveManifest} disabled={busy === 'manifest'} className="bg-orange-500 hover:bg-orange-600" data-testid="save-manifest-btn">
              {busy === 'manifest' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save Manifest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Book {selected?.name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {fmt(selected?.base_price)} per {V?.unit} • Owner confirmation required before payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Start Date *</label>
              <Input type="date" value={form.start_date} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white" data-testid="booking-start-date" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">End Date</label>
              <Input type="date" value={form.end_date} min={form.start_date}
                onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white" data-testid="booking-end-date" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Quantity ({V?.unit}s)</label>
              <Input type="number" min="1" value={form.quantity}
                onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white" data-testid="booking-quantity" />
            </div>
            {form.quantity > 0 && selected && (
              <p className="text-orange-400 font-semibold">Total: {fmt(selected.base_price * (parseInt(form.quantity) || 1))}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-600 text-slate-300">Cancel</Button>
            <Button onClick={book} disabled={busy === 'book'} className="bg-orange-500 hover:bg-orange-600" data-testid="submit-booking-btn">
              {busy === 'book' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Request Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
