import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Anchor, Ship, Rocket, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import MarineBookings from './MarineBookings';

const SERVICE_META = {
  helicopter: { label: 'Helicopter', icon: Plane, desc: 'Charter a helicopter — city transfers, tours & events', color: 'text-sky-400' },
  private_jet: { label: 'Private Jet', icon: Rocket, desc: 'Fly private — jets with catering, baggage & luxury', color: 'text-purple-400' },
  yacht: { label: 'Yacht', icon: Anchor, desc: 'Luxury yacht charters with crew & packages', color: 'text-cyan-400' },
  cruise: { label: 'Cruise', icon: Ship, desc: 'Cruise cabins & river voyages', color: 'text-blue-400' },
  helipad: { label: 'Helipad Transfer', icon: Plane, desc: 'Book helipad landing slots', color: 'text-emerald-400' },
};

export default function BookYourJourney() {
  const [categories, setCategories] = useState(null);
  const [service, setService] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/verticals/service-categories')
      .then(r => setCategories(r.data.categories || {}))
      .catch(() => setCategories({ helicopter: true, private_jet: true, yacht: true, cruise: true }));
  }, []);

  if (!categories) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>;

  const enabled = Object.keys(SERVICE_META).filter(k => categories[k]);

  const onSelect = (val) => {
    setService(val);
    if (val === 'helicopter' || val === 'private_jet') {
      navigate('/booking', { state: { aircraft_type: val === 'private_jet' ? 'chartered_plane' : 'helicopter' } });
    }
  };

  return (
    <div className="space-y-6" data-testid="book-your-journey">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Book Your Journey</h1>
        <p className="text-slate-400">Select a service to start booking</p>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <label className="block text-sm text-slate-400 mb-2">Service Type</label>
        <select value={service} onChange={(e) => onSelect(e.target.value)}
          className="w-full sm:w-96 bg-slate-800 border border-slate-700 text-white h-12 rounded-lg px-3 text-base"
          data-testid="service-type-select">
          <option value="">— Select service —</option>
          {enabled.map(k => <option key={k} value={k}>{SERVICE_META[k].label}</option>)}
        </select>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {enabled.map(k => {
            const M = SERVICE_META[k];
            return (
              <button key={k} onClick={() => onSelect(k)}
                className={`text-left p-5 rounded-xl border transition-all hover:scale-[1.02] ${
                  service === k ? 'border-orange-500 bg-orange-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-orange-500/50'
                }`} data-testid={`service-card-${k}`}>
                <M.icon className={`h-7 w-7 mb-2 ${M.color}`} />
                <p className="text-white font-semibold">{M.label}</p>
                <p className="text-slate-500 text-xs mt-1">{M.desc}</p>
                <span className="text-orange-400 text-xs flex items-center mt-2">Book <ChevronRight className="h-3 w-3" /></span>
              </button>
            );
          })}
        </div>
        {enabled.length === 0 && (
          <p className="text-slate-500 text-center py-8" data-testid="no-services-message">No services are currently enabled. Please check back later.</p>
        )}
      </div>

      {['yacht', 'cruise', 'helipad'].includes(service) && (
        <MarineBookings key={service} initialVertical={service} hideTabs />
      )}

      {(service === 'helicopter' || service === 'private_jet') && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-center">
          <p className="text-slate-300 mb-3">Opening the {SERVICE_META[service].label} booking flow…</p>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => onSelect(service)} data-testid="continue-flight-booking-btn">
            Continue to {SERVICE_META[service].label} Booking <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
