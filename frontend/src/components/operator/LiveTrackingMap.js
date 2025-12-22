import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Plane, Navigation, Gauge, Mountain, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fleetAPI, liveTrackingAPI } from '../../services/api';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom helicopter icon
const helicopterIcon = new L.DivIcon({
  html: `<div style="background: #f97316; border-radius: 50%; padding: 8px; display: flex; align-items: center; justify-content: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1">
      <path d="M2 15h3v3h2v-3h3l2-2h6l2 2h3" />
      <path d="M5 15v-3a6 6 0 0 1 6-6h4" />
      <path d="M14 3v3" />
      <path d="M7 12h4" />
    </svg>
  </div>`,
  className: 'helicopter-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

function LiveTrackingMap({ operator }) {
  const [aircraft, setAircraft] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef(null);

  // Default center (India)
  const defaultCenter = [20.5937, 78.9629];
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  useEffect(() => {
    fetchAircraft();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoRefresh && selectedAircraft) {
      intervalRef.current = setInterval(() => {
        fetchTrackingData(selectedAircraft.id);
      }, 10000); // Refresh every 10 seconds
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, selectedAircraft]);

  const fetchAircraft = async () => {
    try {
      const response = await fleetAPI.getAll();
      setAircraft(response.data.aircraft);
    } catch (error) {
      toast.error('Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackingData = async (aircraftId) => {
    try {
      const response = await liveTrackingAPI.getAircraftLocation(aircraftId);
      setTrackingData(response.data.tracking);
      setIsActive(response.data.is_active);
      
      if (response.data.tracking) {
        setMapCenter([response.data.tracking.latitude, response.data.tracking.longitude]);
        
        // Fetch tracking history if available
        if (response.data.tracking.tracking_id) {
          const historyRes = await liveTrackingAPI.getTrackingHistory(response.data.tracking.tracking_id);
          setTrackingHistory(historyRes.data.history || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch tracking data');
    }
  };

  const handleAircraftSelect = (aircraftId) => {
    const selected = aircraft.find(a => a.id === aircraftId);
    setSelectedAircraft(selected);
    setTrackingData(null);
    setTrackingHistory([]);
    
    if (aircraftId) {
      fetchTrackingData(aircraftId);
      
      // If aircraft has last known location, center map there
      if (selected?.last_known_location) {
        setMapCenter([selected.last_known_location.latitude, selected.last_known_location.longitude]);
      }
    }
  };

  const historyPath = trackingHistory.map(point => [point.latitude, point.longitude]);

  return (
    <div className="max-w-6xl mx-auto" data-testid="live-tracking">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Live Flight Tracking</h1>
          <p className="text-slate-400">Track your aircraft in real-time</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh (10s)</span>
          </label>
          {selectedAircraft && (
            <Button
              onClick={() => fetchTrackingData(selectedAircraft.id)}
              variant="outline"
              className="border-slate-600 text-slate-300"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Aircraft Selector */}
      <div className="mb-6">
        <Label className="text-white mb-2 block">Select Aircraft</Label>
        <select
          value={selectedAircraft?.id || ''}
          onChange={(e) => handleAircraftSelect(e.target.value)}
          className="w-full max-w-md h-10 px-3 rounded-md bg-slate-800 border-slate-700 text-white"
        >
          <option value="">Choose an aircraft to track...</option>
          {aircraft.map(a => (
            <option key={a.id} value={a.id}>
              {a.aircraft_type} - {a.registration_number}
            </option>
          ))}
        </select>
      </div>

      {/* Tracking Info Cards */}
      {selectedAircraft && trackingData && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="glass p-4 rounded-lg">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Navigation className="h-4 w-4" />
              <span className="text-sm">Status</span>
            </div>
            <p className={`text-lg font-bold ${isActive ? 'text-green-400' : 'text-yellow-400'}`}>
              {isActive ? 'Active' : 'Last Known'}
            </p>
          </div>
          <div className="glass p-4 rounded-lg">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Gauge className="h-4 w-4" />
              <span className="text-sm">Speed</span>
            </div>
            <p className="text-lg font-bold text-white">{trackingData.speed_kmh || 0} km/h</p>
          </div>
          <div className="glass p-4 rounded-lg">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Mountain className="h-4 w-4" />
              <span className="text-sm">Altitude</span>
            </div>
            <p className="text-lg font-bold text-white">{trackingData.altitude_feet || 0} ft</p>
          </div>
          <div className="glass p-4 rounded-lg">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">Coordinates</span>
            </div>
            <p className="text-sm font-medium text-white">
              {trackingData.latitude?.toFixed(4)}, {trackingData.longitude?.toFixed(4)}
            </p>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="glass rounded-lg overflow-hidden" style={{ height: '500px' }}>
        <MapContainer
          center={mapCenter}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} />
          
          {/* Flight path */}
          {historyPath.length > 1 && (
            <Polyline
              positions={historyPath}
              color="#f97316"
              weight={3}
              opacity={0.7}
            />
          )}
          
          {/* Current position marker */}
          {trackingData && (
            <Marker
              position={[trackingData.latitude, trackingData.longitude]}
              icon={helicopterIcon}
            >
              <Popup>
                <div className="text-center">
                  <strong>{selectedAircraft?.aircraft_type}</strong><br/>
                  {selectedAircraft?.registration_number}<br/>
                  Speed: {trackingData.speed_kmh || 0} km/h<br/>
                  Altitude: {trackingData.altitude_feet || 0} ft<br/>
                  <small>{new Date(trackingData.timestamp).toLocaleString()}</small>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* No tracking data message */}
      {selectedAircraft && !trackingData && (
        <div className="text-center py-8 text-slate-400">
          <Plane className="h-12 w-12 mx-auto mb-2 text-slate-600" />
          <p>No tracking data available for this aircraft</p>
          <p className="text-sm">Live tracking data will appear when the aircraft is in flight</p>
        </div>
      )}
    </div>
  );
}

export default LiveTrackingMap;
