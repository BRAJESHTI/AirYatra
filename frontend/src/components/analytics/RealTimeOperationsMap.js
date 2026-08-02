import React, { useState, useEffect, useCallback } from 'react';
import { 
  Map, Plane, Cloud, Wind, Eye, Thermometer,
  Loader2, RefreshCw, AlertTriangle, Radio, 
  Navigation, MapPin, Activity, Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const WEATHER_ICONS = {
  clear: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  light_rain: '🌧️',
  fog: '🌫️'
};

const STATUS_COLORS = {
  operational: 'bg-green-500',
  limited: 'bg-yellow-500',
  closed: 'bg-red-500'
};

function RealTimeOperationsMap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedHelipad, setSelectedHelipad] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`${API_URL}/api/operations/map/live`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-slate-400">Loading Operations Map...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="operations-map">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Map className="h-7 w-7 text-green-500" />
            Real-Time Operations Map
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Live flights, helipads & weather across India
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Fleet Status Bar */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-blue-400" />
              <p className="text-blue-400 text-sm">Total Fleet</p>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{data.fleet_status.total}</p>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-400 animate-pulse" />
              <p className="text-green-400 text-sm">In Flight</p>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{data.fleet_status.in_flight}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-orange-400" />
              <p className="text-orange-400 text-sm">Available</p>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{data.fleet_status.available}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-purple-400" />
              <p className="text-purple-400 text-sm">Helipads Active</p>
            </div>
            <p className="text-3xl font-bold text-white mt-2">{data.helipads.filter(h => h.status === 'operational').length}</p>
          </div>
        </div>
      )}

      {/* Weather Alerts */}
      {data?.weather_alerts?.length > 0 && (
        <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-xl p-4">
          <h3 className="text-yellow-400 font-semibold flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5" />
            Weather Alerts
          </h3>
          <div className="space-y-2">
            {data.weather_alerts.map((alert, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-1 rounded text-xs ${
                  alert.severity === 'high' ? 'bg-red-600' : 'bg-yellow-600'
                }`}>
                  {alert.severity.toUpperCase()}
                </span>
                <span className="text-white">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Placeholder */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-4 min-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">India Operations Map</h3>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Live
            </span>
          </div>
          
          {/* Simplified Map View (CSS-based visualization) */}
          <div className="relative bg-slate-900 rounded-lg h-[450px] overflow-hidden">
            {/* India Map Background */}
            <div className="absolute inset-0 opacity-20">
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <path 
                  d="M200,50 L280,80 L320,150 L300,250 L250,350 L180,380 L120,350 L80,280 L100,180 L150,100 Z" 
                  fill="#4ade80" 
                  stroke="#22c55e" 
                  strokeWidth="2"
                />
              </svg>
            </div>
            
            {/* Helipads */}
            {data?.helipads.map((helipad) => {
              // Convert lat/lng to relative position (simplified)
              const x = ((helipad.lng - 68) / (98 - 68)) * 100;
              const y = 100 - ((helipad.lat - 8) / (37 - 8)) * 100;
              
              return (
                <button
                  key={helipad.id}
                  onClick={() => setSelectedHelipad(helipad)}
                  className={`absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer
                    ${STATUS_COLORS[helipad.status]} hover:scale-150 transition-transform z-10`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={helipad.name}
                >
                  <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-white whitespace-nowrap bg-slate-800 px-1 rounded opacity-0 hover:opacity-100">
                    {helipad.city}
                  </span>
                </button>
              );
            })}
            
            {/* Active Flights */}
            {data?.active_flights.map((flight) => {
              const x = ((flight.current_position.lng - 68) / (98 - 68)) * 100;
              const y = 100 - ((flight.current_position.lat - 8) / (37 - 8)) * 100;
              
              return (
                <button
                  key={flight.flight_id}
                  onClick={() => setSelectedFlight(flight)}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 animate-pulse"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div className="relative">
                    <Plane 
                      className="h-6 w-6 text-orange-500" 
                      style={{ transform: `rotate(${flight.current_position.heading}deg)` }}
                    />
                    <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-orange-400 font-mono">
                      {flight.aircraft}
                    </span>
                  </div>
                </button>
              );
            })}
            
            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-slate-800/90 rounded-lg p-3 text-xs">
              <p className="text-slate-400 mb-2">Legend</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span className="text-white">Operational</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span className="text-white">Limited Ops</span>
                </div>
                <div className="flex items-center gap-2">
                  <Plane className="h-3 w-3 text-orange-500" />
                  <span className="text-white">Active Flight</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Active Flights List */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plane className="h-5 w-5 text-orange-500" />
              Active Flights ({data?.active_flights.length || 0})
            </h3>
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {data?.active_flights.map((flight) => (
                <div 
                  key={flight.flight_id}
                  onClick={() => setSelectedFlight(flight)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedFlight?.flight_id === flight.flight_id 
                      ? 'bg-orange-600/20 border border-orange-500' 
                      : 'bg-slate-700/50 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-orange-400">{flight.flight_id}</span>
                    <span className="text-xs bg-green-600 px-2 py-0.5 rounded">{flight.status}</span>
                  </div>
                  <div className="text-sm text-white mt-1">
                    {flight.from.city} → {flight.to.city}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>Aircraft: {flight.aircraft}</span>
                    <span>ETA: {flight.eta_minutes}min</span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-orange-500 h-1.5 rounded-full"
                      style={{ width: `${flight.progress_percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Helipad Details */}
          {selectedHelipad && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">{selectedHelipad.name}</h3>
                <button onClick={() => setSelectedHelipad(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">{selectedHelipad.city}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    selectedHelipad.status === 'operational' ? 'bg-green-600' : 'bg-yellow-600'
                  }`}>
                    {selectedHelipad.status}
                  </span>
                </div>
                
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-sm text-slate-400 mb-2">Weather</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{WEATHER_ICONS[selectedHelipad.weather.condition]}</span>
                      <span className="text-white capitalize">{selectedHelipad.weather.condition.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-red-400" />
                      <span className="text-white">{selectedHelipad.weather.temperature}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 text-blue-400" />
                      <span className="text-white">{selectedHelipad.weather.wind_speed} km/h</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-green-400" />
                      <span className="text-white">{selectedHelipad.weather.visibility_km} km</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-slate-400 mb-2">Facilities</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedHelipad.facilities.map(f => (
                      <span key={f} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                        {f.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Flight Details */}
          {selectedFlight && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white font-mono">{selectedFlight.flight_id}</h3>
                <button onClick={() => setSelectedFlight(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-slate-400">From</p>
                    <p className="text-white font-semibold">{selectedFlight.from.city}</p>
                  </div>
                  <Navigation className="h-5 w-5 text-orange-500" />
                  <div className="text-center">
                    <p className="text-xs text-slate-400">To</p>
                    <p className="text-white font-semibold">{selectedFlight.to.city}</p>
                  </div>
                </div>
                
                <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Aircraft</span>
                    <span className="text-white font-mono">{selectedFlight.aircraft}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Altitude</span>
                    <span className="text-white">{selectedFlight.current_position.altitude_ft} ft</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Speed</span>
                    <span className="text-white">{selectedFlight.current_position.speed_knots} kts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Heading</span>
                    <span className="text-white">{selectedFlight.current_position.heading}°</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Passengers</span>
                    <span className="text-white">{selectedFlight.passengers}</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-orange-400">{selectedFlight.progress_percent}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{ width: `${selectedFlight.progress_percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 text-right">ETA: {selectedFlight.eta_minutes} minutes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Last Updated */}
      {data && (
        <p className="text-xs text-slate-500 text-center">
          Last updated: {new Date(data.last_updated).toLocaleString()} • Refreshes every {data.refresh_interval_seconds}s
        </p>
      )}
    </div>
  );
}

export default RealTimeOperationsMap;
