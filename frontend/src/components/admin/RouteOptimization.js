import React, { useState, useEffect } from 'react';
import { Navigation, MapPin, Plane, Clock, Fuel, ArrowRight, RotateCcw, Plus, X, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function RouteOptimization() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  
  // Single route
  const [singleRoute, setSingleRoute] = useState({
    origin: 'Delhi',
    destination: 'Mumbai',
    waypoints: [],
    aircraft_type: 'helicopter'
  });
  const [singleResult, setSingleResult] = useState(null);
  
  // Multi-stop
  const [multiRoute, setMultiRoute] = useState({
    locations: ['Delhi', 'Jaipur', 'Udaipur'],
    start_location: 'Delhi',
    return_to_start: false
  });
  const [multiResult, setMultiResult] = useState(null);
  
  const [newWaypoint, setNewWaypoint] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const aircraftTypes = [
    { id: 'helicopter', name: 'Helicopter (200 km/h)' },
    { id: 'light_helicopter', name: 'Light Helicopter (180 km/h)' },
    { id: 'medium_helicopter', name: 'Medium Helicopter (220 km/h)' },
    { id: 'heavy_helicopter', name: 'Heavy Helicopter (250 km/h)' },
    { id: 'fixed_wing', name: 'Fixed Wing (400 km/h)' },
    { id: 'turboprop', name: 'Turboprop (450 km/h)' },
    { id: 'jet', name: 'Jet (800 km/h)' }
  ];

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const res = await api.get('/api/routes/locations');
      setLocations(res.data.locations || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const optimizeSingleRoute = async () => {
    setOptimizing(true);
    try {
      const res = await api.post('/api/routes/optimize', singleRoute);
      setSingleResult(res.data);
    } catch (error) {
      console.error('Optimization failed:', error);
      alert(error.response?.data?.detail || 'Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const optimizeMultiStop = async () => {
    setOptimizing(true);
    try {
      const res = await api.post('/api/routes/multi-stop', multiRoute);
      setMultiResult(res.data);
    } catch (error) {
      console.error('Multi-stop optimization failed:', error);
      alert(error.response?.data?.detail || 'Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const addWaypoint = () => {
    if (newWaypoint && !singleRoute.waypoints.includes(newWaypoint)) {
      setSingleRoute(prev => ({
        ...prev,
        waypoints: [...prev.waypoints, newWaypoint]
      }));
      setNewWaypoint('');
    }
  };

  const removeWaypoint = (wp) => {
    setSingleRoute(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter(w => w !== wp)
    }));
  };

  const addMultiLocation = () => {
    if (newLocation && !multiRoute.locations.includes(newLocation)) {
      setMultiRoute(prev => ({
        ...prev,
        locations: [...prev.locations, newLocation]
      }));
      setNewLocation('');
    }
  };

  const removeMultiLocation = (loc) => {
    setMultiRoute(prev => ({
      ...prev,
      locations: prev.locations.filter(l => l !== loc)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Route Optimization</h1>
        <p className="text-slate-400">Optimize flight routes for time, fuel efficiency, and cost</p>
      </div>

      {/* Available Locations */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-white font-medium mb-3 flex items-center">
          <Map className="h-4 w-4 mr-2" /> Available Locations
        </h3>
        <div className="flex flex-wrap gap-2">
          {locations.map(loc => (
            <span key={loc.id} className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300">
              {loc.name}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Single Route Optimizer */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Navigation className="h-5 w-5 mr-2 text-orange-400" />
            Point-to-Point Route
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-sm">Origin</label>
                <select
                  value={singleRoute.origin}
                  onChange={(e) => setSingleRoute(prev => ({ ...prev, origin: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm">Destination</label>
                <select
                  value={singleRoute.destination}
                  onChange={(e) => setSingleRoute(prev => ({ ...prev, destination: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-sm">Aircraft Type</label>
              <select
                value={singleRoute.aircraft_type}
                onChange={(e) => setSingleRoute(prev => ({ ...prev, aircraft_type: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                {aircraftTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            {/* Waypoints */}
            <div>
              <label className="text-slate-400 text-sm">Waypoints (Optional)</label>
              <div className="flex gap-2 mt-1">
                <select
                  value={newWaypoint}
                  onChange={(e) => setNewWaypoint(e.target.value)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Add waypoint...</option>
                  {locations.filter(l => 
                    l.name !== singleRoute.origin && 
                    l.name !== singleRoute.destination &&
                    !singleRoute.waypoints.includes(l.name)
                  ).map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
                <Button onClick={addWaypoint} variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {singleRoute.waypoints.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {singleRoute.waypoints.map(wp => (
                    <span key={wp} className="flex items-center gap-1 px-2 py-1 bg-blue-600/30 text-blue-300 rounded text-sm">
                      {wp}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeWaypoint(wp)} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button 
              onClick={optimizeSingleRoute} 
              disabled={optimizing}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              {optimizing ? 'Optimizing...' : 'Calculate Route'}
            </Button>
          </div>

          {/* Single Route Result */}
          {singleResult && (
            <div className="mt-4 p-4 bg-slate-900 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-white">
                <span className="font-medium">{singleResult.origin?.name}</span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
                <span className="font-medium">{singleResult.destination?.name}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-800 rounded">
                  <MapPin className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                  <p className="text-white font-semibold">{singleResult.totals?.distance_km} km</p>
                  <p className="text-slate-400 text-xs">Distance</p>
                </div>
                <div className="p-2 bg-slate-800 rounded">
                  <Clock className="h-4 w-4 mx-auto text-green-400 mb-1" />
                  <p className="text-white font-semibold">{singleResult.totals?.estimated_time_min} min</p>
                  <p className="text-slate-400 text-xs">Flight Time</p>
                </div>
                <div className="p-2 bg-slate-800 rounded">
                  <Fuel className="h-4 w-4 mx-auto text-orange-400 mb-1" />
                  <p className="text-white font-semibold">{singleResult.totals?.fuel_liters} L</p>
                  <p className="text-slate-400 text-xs">Fuel Est.</p>
                </div>
              </div>

              {singleResult.route_segments?.length > 1 && (
                <div>
                  <p className="text-slate-400 text-sm mb-2">Route Segments:</p>
                  {singleResult.route_segments.map((seg, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-800">
                      <span className="text-slate-300">{seg.from} → {seg.to}</span>
                      <span className="text-slate-400">{seg.distance_km} km</span>
                    </div>
                  ))}
                </div>
              )}

              {singleResult.alternative_routes?.length > 0 && (
                <div>
                  <p className="text-slate-400 text-sm mb-2">Alternative Routes:</p>
                  {singleResult.alternative_routes.map((alt, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1">
                      <span className="text-slate-300">Via {alt.via}</span>
                      <span className="text-slate-500">{alt.total_distance_km} km ({alt.compared_to_direct})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Multi-Stop Optimizer */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <RotateCcw className="h-5 w-5 mr-2 text-purple-400" />
            Multi-Stop Route (TSP)
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm">Locations to Visit</label>
              <div className="flex gap-2 mt-1">
                <select
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Add location...</option>
                  {locations.filter(l => !multiRoute.locations.includes(l.name)).map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
                <Button onClick={addMultiLocation} variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {multiRoute.locations.map((loc, idx) => (
                  <span key={loc} className="flex items-center gap-1 px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-sm">
                    {idx + 1}. {loc}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeMultiLocation(loc)} />
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-sm">Start Location</label>
              <select
                value={multiRoute.start_location}
                onChange={(e) => setMultiRoute(prev => ({ ...prev, start_location: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                {multiRoute.locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={multiRoute.return_to_start}
                onChange={(e) => setMultiRoute(prev => ({ ...prev, return_to_start: e.target.checked }))}
                className="w-5 h-5"
              />
              <label className="text-slate-300">Return to starting point</label>
            </div>

            <Button 
              onClick={optimizeMultiStop} 
              disabled={optimizing || multiRoute.locations.length < 2}
              className="w-full bg-purple-500 hover:bg-purple-600"
            >
              {optimizing ? 'Optimizing...' : 'Optimize Route Order'}
            </Button>
          </div>

          {/* Multi-Stop Result */}
          {multiResult && (
            <div className="mt-4 p-4 bg-slate-900 rounded-lg space-y-3">
              <div>
                <p className="text-slate-400 text-sm mb-2">Optimized Order:</p>
                <div className="flex flex-wrap items-center gap-2">
                  {multiResult.optimized_route?.map((loc, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-2 py-1 bg-purple-600/50 rounded text-white text-sm">
                        {idx + 1}. {loc}
                      </span>
                      {idx < multiResult.optimized_route.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-800 rounded">
                  <MapPin className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                  <p className="text-white font-semibold">{multiResult.totals?.distance_km} km</p>
                  <p className="text-slate-400 text-xs">Total Distance</p>
                </div>
                <div className="p-2 bg-slate-800 rounded">
                  <Clock className="h-4 w-4 mx-auto text-green-400 mb-1" />
                  <p className="text-white font-semibold">{multiResult.totals?.estimated_time_min} min</p>
                  <p className="text-slate-400 text-xs">Total Time</p>
                </div>
                <div className="p-2 bg-slate-800 rounded">
                  <Plane className="h-4 w-4 mx-auto text-orange-400 mb-1" />
                  <p className="text-white font-semibold">{multiResult.totals?.stops}</p>
                  <p className="text-slate-400 text-xs">Stops</p>
                </div>
              </div>

              {multiResult.segments?.length > 0 && (
                <div>
                  <p className="text-slate-400 text-sm mb-2">Segments:</p>
                  {multiResult.segments.map((seg, idx) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-800">
                      <span className="text-slate-300">{seg.from} → {seg.to}</span>
                      <span className="text-slate-400">{seg.distance_km} km ({seg.time_min} min)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RouteOptimization;
