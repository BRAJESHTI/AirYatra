import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Plane, Clock, ArrowRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: bold;
          font-size: 14px;
        ">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

// Map controller component for fit bounds
const MapController = ({ bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      const leafletBounds = L.latLngBounds(bounds);
      map.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [bounds, map]);
  
  return null;
};

/**
 * Multi-City Route Map Component
 * Interactive Leaflet map showing route legs with polylines
 */
const MultiCityRouteMap = ({
  legs = [],
  totalDistance = 0,
  totalPrice = 0,
  isExpanded = false,
  onToggleExpand,
  className = ''
}) => {
  const [mapReady, setMapReady] = useState(false);
  const [center, setCenter] = useState([20.5937, 78.9629]); // India center
  const [zoom, setZoom] = useState(5);
  const [bounds, setBounds] = useState([]);

  // Extract coordinates from legs
  const getCoordinates = useCallback(() => {
    const coords = [];
    
    legs.forEach((leg, index) => {
      if (leg.from?.coordinates?.lat && leg.from?.coordinates?.lng) {
        coords.push({
          lat: leg.from.coordinates.lat,
          lng: leg.from.coordinates.lng,
          name: leg.from.landing_point_name || `Point ${index + 1}`,
          type: index === 0 ? 'start' : 'waypoint',
          legIndex: index
        });
      }
      
      if (leg.to?.coordinates?.lat && leg.to?.coordinates?.lng) {
        const isLast = index === legs.length - 1;
        coords.push({
          lat: leg.to.coordinates.lat,
          lng: leg.to.coordinates.lng,
          name: leg.to.landing_point_name || `Point ${index + 2}`,
          type: isLast ? 'end' : 'waypoint',
          legIndex: index
        });
      }
    });
    
    // Remove duplicates (waypoints appear twice - as 'to' and 'from')
    const uniqueCoords = coords.filter((coord, index, self) => 
      index === self.findIndex(c => c.lat === coord.lat && c.lng === coord.lng)
    );
    
    return uniqueCoords;
  }, [legs]);

  // Create polyline paths for each leg
  const getPolylinePaths = useCallback(() => {
    return legs.map(leg => {
      if (leg.from?.coordinates && leg.to?.coordinates) {
        return [
          [leg.from.coordinates.lat, leg.from.coordinates.lng],
          [leg.to.coordinates.lat, leg.to.coordinates.lng]
        ];
      }
      return null;
    }).filter(Boolean);
  }, [legs]);

  // Update bounds when legs change
  useEffect(() => {
    const coords = getCoordinates();
    if (coords.length > 0) {
      const newBounds = coords.map(c => [c.lat, c.lng]);
      setBounds(newBounds);
      
      // Calculate center
      const avgLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
      const avgLng = coords.reduce((sum, c) => sum + c.lng, 0) / coords.length;
      setCenter([avgLat, avgLng]);
    }
  }, [legs, getCoordinates]);

  const coordinates = getCoordinates();
  const polylinePaths = getPolylinePaths();

  // Get marker icon based on type
  const getMarkerIcon = (type, index) => {
    switch (type) {
      case 'start':
        return createCustomIcon('#22c55e', 'A'); // Green
      case 'end':
        return createCustomIcon('#ef4444', 'Z'); // Red
      default:
        return createCustomIcon('#f97316', String.fromCharCode(66 + index)); // Orange with B, C, D...
    }
  };

  // Gradient colors for polylines (different color per leg)
  const legColors = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#ef4444'];

  // Show placeholder map when no coordinates yet
  if (legs.length === 0 || coordinates.length === 0) {
    return (
      <div className={`bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-orange-400" />
            <span className="text-white font-medium">Route Map / रूट मैप</span>
            <Badge className="bg-slate-600 text-slate-300 ml-2">
              Select destinations
            </Badge>
          </div>
        </div>
        
        {/* Placeholder Map (India centered) */}
        <div className="relative h-48">
          <MapContainer
            center={[20.5937, 78.9629]} // India center
            zoom={4}
            className="h-full w-full"
            scrollWheelZoom={false}
            zoomControl={false}
            dragging={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
          </MapContainer>
          
          {/* Overlay message */}
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-10 w-10 mx-auto mb-2 text-orange-400 opacity-70" />
              <p className="text-white font-medium">Add destinations to see route</p>
              <p className="text-slate-400 text-sm mt-1">रूट देखने के लिए गंतव्य जोड़ें</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-orange-400" />
          <span className="text-white font-medium">Route Map / रूट मैप</span>
          <Badge className="bg-blue-500/20 text-blue-400 ml-2">
            {legs.length} Legs
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/20 text-green-400">
            {totalDistance} km
          </Badge>
          {onToggleExpand && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onToggleExpand}
              className="text-slate-400 hover:text-white"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Map Container */}
      <div className={`relative ${isExpanded ? 'h-[500px]' : 'h-64'} transition-all duration-300`}>
        <MapContainer
          center={center}
          zoom={zoom}
          className="h-full w-full"
          whenReady={() => setMapReady(true)}
          scrollWheelZoom={true}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {/* Auto-fit bounds */}
          {mapReady && <MapController bounds={bounds} />}
          
          {/* Polylines for each leg */}
          {polylinePaths.map((path, index) => (
            <Polyline
              key={`leg-${index}`}
              positions={path}
              pathOptions={{
                color: legColors[index % legColors.length],
                weight: 4,
                opacity: 0.8,
                dashArray: index > 0 ? '10, 10' : null // Dashed for subsequent legs
              }}
            />
          ))}
          
          {/* Markers */}
          {coordinates.map((coord, index) => (
            <Marker
              key={`marker-${index}`}
              position={[coord.lat, coord.lng]}
              icon={getMarkerIcon(coord.type, index)}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{coord.name}</p>
                  <p className="text-gray-500">
                    {coord.type === 'start' ? 'Starting Point' : 
                     coord.type === 'end' ? 'Final Destination' : 
                     `Waypoint ${index}`}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Map Legend Overlay */}
        <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur rounded-lg p-2 z-[1000]">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-300">Start</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-slate-300">Stop</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-300">End</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Route Summary */}
      <div className="p-3 border-t border-slate-700 bg-slate-800/30">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {legs.map((leg, index) => (
            <React.Fragment key={index}>
              {/* From point */}
              {index === 0 && (
                <Badge className="bg-green-500/20 text-green-400 flex-shrink-0">
                  {leg.from?.landing_point_name?.split(',')[0] || 'Start'}
                </Badge>
              )}
              
              {/* Arrow with distance */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="h-px w-4 bg-slate-600" />
                <div className="flex flex-col items-center">
                  <Plane className="h-3 w-3 text-orange-400 rotate-90" />
                  <span className="text-[10px] text-slate-500">{leg.distance || 0}km</span>
                </div>
                <div className="h-px w-4 bg-slate-600" />
              </div>
              
              {/* To point */}
              <Badge className={`flex-shrink-0 ${
                index === legs.length - 1 
                  ? 'bg-red-500/20 text-red-400' 
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {leg.to?.landing_point_name?.split(',')[0] || `Stop ${index + 2}`}
              </Badge>
            </React.Fragment>
          ))}
        </div>
        
        {/* Stats */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Navigation className="h-3 w-3" />
              Total: {totalDistance} km
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{Math.round(totalDistance / 200 * 60)} min
            </span>
          </div>
          <span className="text-orange-400 font-semibold">
            ₹{totalPrice.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MultiCityRouteMap;
