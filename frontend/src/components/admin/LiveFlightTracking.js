import React, { useState, useEffect, useRef } from 'react';
import { Plane, MapPin, Clock, Navigation, Fuel, AlertTriangle, RefreshCw, Play, Pause, Radio, Eye, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function LiveFlightTracking() {
  const [dashboard, setDashboard] = useState(null);
  const [activeFlights, setActiveFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/flight-live/dashboard');
      setDashboard(res.data);
      setActiveFlights(res.data.active_flights || []);
    } catch (error) {
      console.error('Failed to load flight tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewFlight = async (flightId) => {
    try {
      const res = await api.get(`/flight-live/track/${flightId}`);
      setSelectedFlight(res.data);
    } catch (error) {
      console.error('Failed to load flight:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'preparing': return 'bg-blue-500';
      case 'taxiing': return 'bg-yellow-500';
      case 'takeoff': return 'bg-orange-500';
      case 'cruising': return 'bg-green-500 animate-pulse';
      case 'descending': return 'bg-purple-500';
      case 'landing': return 'bg-orange-500';
      case 'landed': return 'bg-gray-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'preparing': return '🛠️';
      case 'taxiing': return '🚕';
      case 'takeoff': return '🛫';
      case 'cruising': return '✈️';
      case 'descending': return '🛃';
      case 'landing': return '🛋️';
      case 'landed': return '✅';
      default: return '✈️';
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-IN', {
      hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Radio className="h-6 w-6 mr-2 text-green-500 animate-pulse" />
            Live Flight Tracking
          </h1>
          <p className="text-slate-400">Real-time aircraft position monitoring</p>
        </div>
        <Button onClick={loadDashboard} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
            <div className="flex items-center space-x-2 text-green-400 mb-2">
              <Plane className="h-5 w-5" />
              <span className="text-sm">In-Flight</span>
            </div>
            <p className="text-3xl font-bold text-white">{dashboard.active_flights_count}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-blue-400 mb-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm">Flights Today</span>
            </div>
            <p className="text-2xl font-bold text-white">{dashboard.total_flights_today}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <Navigation className="h-5 w-5" />
              <span className="text-sm">Status</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(dashboard.status_breakdown || {}).map(([status, count]) => (
                <span key={status} className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                  {getStatusIcon(status)} {count}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-purple-400 mb-2">
              <Wifi className="h-5 w-5" />
              <span className="text-sm">WebSocket</span>
            </div>
            <p className={`text-lg font-bold ${wsConnected ? 'text-green-400' : 'text-slate-500'}`}>
              {wsConnected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Active Flights</h2>
          </div>
          <div className="divide-y divide-slate-700 max-h-[500px] overflow-y-auto">
            {activeFlights.length > 0 ? activeFlights.map(flight => (
              <div
                key={flight.id}
                onClick={() => viewFlight(flight.id)}
                className={`p-4 cursor-pointer hover:bg-slate-700/50 transition-colors ${
                  selectedFlight?.id === flight.id ? 'bg-orange-500/20 border-l-4 border-orange-500' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white font-medium">{flight.aircraft_registration}</p>
                    <p className="text-slate-400 text-sm">
                      {flight.legs_summary?.[0]?.route || 'Route N/A'}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(flight.status)}`} />
                </div>
                <div className="flex items-center mt-2 text-xs text-slate-500">
                  <span className="mr-3">{getStatusIcon(flight.status)} {flight.status}</span>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center">
                <Plane className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No active flights</p>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2 bg-slate-800 rounded-lg border border-slate-700">
          {selectedFlight ? (
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <Plane className="h-5 w-5 mr-2 text-orange-400" />
                    {selectedFlight.aircraft_registration}
                  </h2>
                  <p className="text-slate-400">Booking: {selectedFlight.booking_id?.slice(0, 8)}...</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedFlight.status)} text-white`}>
                  {getStatusIcon(selectedFlight.status)} {selectedFlight.status?.toUpperCase()}
                </span>
              </div>

              <div className="bg-slate-900 rounded-lg h-64 flex items-center justify-center mb-6 relative">
                <div className="text-center z-10">
                  <MapPin className="h-16 w-16 mx-auto text-orange-500 mb-2" />
                  <p className="text-white font-medium">
                    {selectedFlight.current_position?.latitude?.toFixed(4)}, {selectedFlight.current_position?.longitude?.toFixed(4)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${selectedFlight.current_position?.latitude},${selectedFlight.current_position?.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 text-sm hover:underline"
                  >
                    View on Google Maps →
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900 rounded-lg p-4 text-center">
                  <Navigation className="h-5 w-5 mx-auto text-blue-400 mb-2" />
                  <p className="text-2xl font-bold text-white">{Math.round(selectedFlight.current_position?.heading || 0)}°</p>
                  <p className="text-slate-400 text-xs">Heading</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 text-center">
                  <Plane className="h-5 w-5 mx-auto text-green-400 mb-2 transform rotate-90" />
                  <p className="text-2xl font-bold text-white">{Math.round(selectedFlight.current_position?.altitude_ft || 0)}</p>
                  <p className="text-slate-400 text-xs">Altitude (ft)</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 text-center">
                  <Clock className="h-5 w-5 mx-auto text-orange-400 mb-2" />
                  <p className="text-2xl font-bold text-white">{Math.round(selectedFlight.current_position?.speed_knots || 0)}</p>
                  <p className="text-slate-400 text-xs">Speed (kts)</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 text-center">
                  <Clock className="h-5 w-5 mx-auto text-purple-400 mb-2" />
                  <p className="text-lg font-bold text-white">{formatTime(selectedFlight.eta)}</p>
                  <p className="text-slate-400 text-xs">ETA</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12">
              <div className="text-center">
                <Plane className="h-16 w-16 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400">Select a flight to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveFlightTracking;
