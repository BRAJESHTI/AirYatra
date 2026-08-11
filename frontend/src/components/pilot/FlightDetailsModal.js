import React, { useState, useEffect } from 'react';
import { X, MapPin, ChevronRight, Users, Plane, Calendar, Timer, Phone, FileText, User } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-2 border-b border-slate-700/50 last:border-0">
    <Icon className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-white break-words">{value || 'N/A'}</p>
    </div>
  </div>
);

export const FlightDetailsModal = ({ bookingId, onClose }) => {
  const [flight, setFlight] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/pilot/mobile/flights/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error((await res.json()).detail || 'Failed to load flight');
        const data = await res.json();
        setFlight(data.flight);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [bookingId]);

  const pax = flight?.passengers || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose} data-testid="flight-details-modal">
      <div
        className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Plane className="h-5 w-5 text-orange-500" /> Flight Details
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700" data-testid="flight-details-close-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : error ? (
          <p className="p-6 text-red-400 text-sm text-center" data-testid="flight-details-error">{error}</p>
        ) : flight && (
          <div className="p-4 space-y-4">
            {/* Route header */}
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-400 font-mono text-xs" data-testid="flight-details-reference">{flight.reference}</span>
                <span className="text-[10px] uppercase bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">{flight.status}</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <MapPin className="h-4 w-4 text-green-400" />
                <span className="font-medium" data-testid="flight-details-from">{flight.route?.from}</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
                <span className="font-medium" data-testid="flight-details-to">{flight.route?.to}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                <span><Calendar className="h-3 w-3 inline mr-1" />{(flight.date || '').slice(0, 10)}</span>
                <span><Timer className="h-3 w-3 inline mr-1" />{flight.time}</span>
              </div>
            </div>

            {/* Passengers */}
            <div className="bg-slate-800/60 rounded-xl p-4" data-testid="flight-details-passengers">
              <p className="text-white text-sm font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-400" /> Passengers ({pax.total})
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-700/50 rounded-lg py-2">
                  <p className="text-white font-bold">{pax.adult_male || 0}</p>
                  <p className="text-[10px] text-slate-400">Male</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg py-2">
                  <p className="text-white font-bold">{pax.adult_female || 0}</p>
                  <p className="text-[10px] text-slate-400">Female</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg py-2">
                  <p className="text-white font-bold">{pax.children || 0}</p>
                  <p className="text-[10px] text-slate-400">Children</p>
                </div>
              </div>
              {pax.names?.length > 0 && (
                <p className="text-xs text-slate-400 mt-2">{pax.names.join(', ')}</p>
              )}
            </div>

            {/* Details */}
            <div className="bg-slate-800/60 rounded-xl px-4 py-2">
              <Row icon={Plane} label="Aircraft" value={[flight.aircraft?.type, flight.aircraft?.name, flight.aircraft?.registration].filter(Boolean).join(' • ')} />
              <Row icon={User} label="Customer" value={flight.customer?.name} />
              {flight.customer?.phone && <Row icon={Phone} label="Contact" value={flight.customer.phone} />}
              <Row icon={FileText} label="Trip Type" value={String(flight.trip_type || '').replace('_', ' ')} />
              {flight.special_requirements && <Row icon={FileText} label="Special Requirements" value={flight.special_requirements} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightDetailsModal;
