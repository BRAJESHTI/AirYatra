import React, { useState, useEffect } from 'react';
import { Route, Plus, X, Users, Calendar, MapPin, RefreshCw, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function MultiLegBooking() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('create');
  const [bookingType, setBookingType] = useState('round_trip');
  const [legs, setLegs] = useState([
    { origin: '', destination: '', journey_date: '', journey_time: '10:00', passengers: 1 },
    { origin: '', destination: '', journey_date: '', journey_time: '16:00', passengers: 1 }
  ]);
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [pricePreview, setPricePreview] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadBookings(); }, []);

  const loadBookings = async () => {
    try {
      const res = await api.get('/api/multileg/my-bookings');
      setBookings(res.data.bookings || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const addLeg = () => setLegs([...legs, { origin: '', destination: '', journey_date: '', journey_time: '10:00', passengers: 1 }]);
  const removeLeg = (idx) => legs.length > 2 && setLegs(legs.filter((_, i) => i !== idx));

  const updateLeg = (index, field, value) => {
    const newLegs = [...legs];
    newLegs[index][field] = value;
    if (bookingType === 'round_trip' && legs.length === 2) {
      if (index === 0 && field === 'origin') newLegs[1].destination = value;
      if (index === 0 && field === 'destination') newLegs[1].origin = value;
      if (index === 0 && field === 'passengers') newLegs[1].passengers = value;
    }
    setLegs(newLegs);
  };

  const calculatePrice = async () => {
    try {
      const res = await api.get(`/api/multileg/calculate-price?legs=${encodeURIComponent(JSON.stringify(legs))}`);
      setPricePreview(res.data);
    } catch (error) { console.error(error); }
  };

  const createBooking = async () => {
    setCreating(true);
    try {
      await api.post('/api/multileg/create', {
        booking_type: bookingType, legs, contact_name: contact.name,
        contact_phone: contact.phone, contact_email: contact.email,
        total_passengers: Math.max(...legs.map(l => l.passengers))
      });
      alert('Booking created!');
      setActiveTab('bookings');
      loadBookings();
    } catch (error) { alert(error.response?.data?.detail || 'Failed'); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Multi-Leg Booking</h1>
          <p className="text-slate-400">Round trip, multi-city, and group bookings</p>
        </div>
        <Button onClick={loadBookings} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="flex space-x-4 border-b border-slate-700">
        {['create', 'bookings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium ${activeTab === tab ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400'}`}>
            {tab === 'create' ? 'New Booking' : 'My Bookings'}
          </button>
        ))}
      </div>

      {activeTab === 'create' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-white font-medium mb-3">Booking Type</h3>
              <div className="flex space-x-3">
                {[{ id: 'round_trip', label: 'Round Trip', icon: Repeat }, { id: 'multi_city', label: 'Multi-City', icon: Route }, { id: 'group', label: 'Group', icon: Users }].map(type => (
                  <button key={type.id} onClick={() => setBookingType(type.id)}
                    className={`flex-1 p-3 rounded-lg border ${bookingType === type.id ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                    <type.icon className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-medium">Journey Legs</h3>
                {bookingType !== 'round_trip' && <Button size="sm" onClick={addLeg} variant="outline"><Plus className="h-4 w-4" /></Button>}
              </div>
              {legs.map((leg, idx) => (
                <div key={idx} className="p-4 bg-slate-900 rounded-lg mb-3">
                  <div className="flex items-center mb-3">
                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded mr-2">Leg {idx + 1}</span>
                    {bookingType !== 'round_trip' && legs.length > 2 && (
                      <button onClick={() => removeLeg(idx)} className="ml-auto text-red-400"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    <Input value={leg.origin} onChange={(e) => updateLeg(idx, 'origin', e.target.value)} placeholder="Origin" className="bg-slate-800" />
                    <Input value={leg.destination} onChange={(e) => updateLeg(idx, 'destination', e.target.value)} placeholder="Destination" className="bg-slate-800" />
                    <Input type="date" value={leg.journey_date} onChange={(e) => updateLeg(idx, 'journey_date', e.target.value)} className="bg-slate-800" />
                    <Input type="time" value={leg.journey_time} onChange={(e) => updateLeg(idx, 'journey_time', e.target.value)} className="bg-slate-800" />
                    <Input type="number" min="1" value={leg.passengers} onChange={(e) => updateLeg(idx, 'passengers', parseInt(e.target.value))} className="bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-white font-medium mb-3">Contact</h3>
              <div className="grid grid-cols-3 gap-4">
                <Input value={contact.name} onChange={(e) => setContact(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="bg-slate-900" />
                <Input value={contact.phone} onChange={(e) => setContact(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="bg-slate-900" />
                <Input value={contact.email} onChange={(e) => setContact(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="bg-slate-900" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-white font-medium mb-3">Price Estimate</h3>
              <Button onClick={calculatePrice} className="w-full bg-blue-600 mb-4">Calculate</Button>
              {pricePreview && (
                <div className="space-y-2">
                  {pricePreview.leg_prices?.map((l, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-400">Leg {l.leg}</span>
                      <span className="text-white">₹{l.final_price?.toLocaleString()}</span>
                    </div>
                  ))}
                  {pricePreview.multi_leg_discount > 0 && (
                    <div className="flex justify-between text-sm text-green-400">
                      <span>Discount</span>
                      <span>-₹{pricePreview.multi_leg_discount?.toLocaleString()}</span>
                    </div>
                  )}
                  <hr className="border-slate-700" />
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-white">Total</span>
                    <span className="text-orange-400">₹{pricePreview.total?.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
            <Button onClick={createBooking} disabled={creating || !legs[0].origin} className="w-full bg-orange-500 py-6 text-lg">
              {creating ? 'Creating...' : 'Create Booking'}
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {bookings.map(b => (
            <div key={b.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex justify-between mb-2">
                <p className="text-white font-medium">{b.booking_number}</p>
                <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">{b.status}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {b.legs_summary?.map((l, i) => (
                  <span key={i} className="px-2 py-1 bg-slate-900 rounded text-sm text-white">{l.route}</span>
                ))}
              </div>
              <p className="text-orange-400 font-medium mt-2">₹{b.pricing?.total?.toLocaleString()}</p>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-center text-slate-400 py-8">No bookings yet</p>}
        </div>
      )}
    </div>
  );
}

export default MultiLegBooking;
