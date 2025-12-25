import React, { useState, useEffect } from 'react';
import { 
  Cloud, Sun, CloudRain, Wind, AlertTriangle, CheckCircle,
  Loader2, RefreshCw, Thermometer, Eye, Droplets, Navigation,
  CloudSnow, CloudLightning, CloudFog
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function WeatherDashboard() {
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState(null);
  const [routeWeather, setRouteWeather] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('current');
  
  // Form states
  const [currentLat, setCurrentLat] = useState('28.6139');
  const [currentLon, setCurrentLon] = useState('77.2090');
  
  const [originLat, setOriginLat] = useState('28.6139');
  const [originLon, setOriginLon] = useState('77.2090');
  const [destLat, setDestLat] = useState('19.0760');
  const [destLon, setDestLon] = useState('72.8777');

  useEffect(() => {
    loadActiveAlerts();
  }, []);

  const loadCurrentWeather = async () => {
    setLoading(true);
    try {
      const response = await api.get('/weather/current', {
        params: { lat: currentLat, lon: currentLon, include_safety: true }
      });
      setWeather(response.data);
    } catch (error) {
      toast.error('Failed to load weather data');
    } finally {
      setLoading(false);
    }
  };

  const loadRouteWeather = async () => {
    setLoading(true);
    try {
      const response = await api.post('/weather/route', {
        origin_lat: parseFloat(originLat),
        origin_lon: parseFloat(originLon),
        origin_name: 'Delhi',
        destination_lat: parseFloat(destLat),
        destination_lon: parseFloat(destLon),
        destination_name: 'Mumbai'
      });
      setRouteWeather(response.data);
    } catch (error) {
      toast.error('Failed to load route weather');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveAlerts = async () => {
    try {
      const response = await api.get('/weather/alerts/active');
      setActiveAlerts(response.data.active_alerts || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const getWeatherIcon = (condition) => {
    const cond = (condition || '').toLowerCase();
    if (cond.includes('clear') || cond.includes('sun')) return <Sun className="h-12 w-12 text-yellow-400" />;
    if (cond.includes('rain') || cond.includes('drizzle')) return <CloudRain className="h-12 w-12 text-blue-400" />;
    if (cond.includes('snow')) return <CloudSnow className="h-12 w-12 text-blue-200" />;
    if (cond.includes('thunder') || cond.includes('storm')) return <CloudLightning className="h-12 w-12 text-yellow-500" />;
    if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze')) return <CloudFog className="h-12 w-12 text-slate-400" />;
    return <Cloud className="h-12 w-12 text-slate-400" />;
  };

  const getSafetyColor = (status) => {
    switch (status) {
      case 'safe': return 'bg-green-500';
      case 'caution': return 'bg-yellow-500';
      case 'warning': return 'bg-orange-500';
      case 'danger': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const getSafetyTextColor = (status) => {
    switch (status) {
      case 'safe': return 'text-green-400';
      case 'caution': return 'text-yellow-400';
      case 'warning': return 'text-orange-400';
      case 'danger': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cloud className="h-6 w-6 text-blue-400" />
            Weather & Flight Safety / मौसम
          </h2>
          <p className="text-slate-400 mt-1">Check weather conditions and flight safety assessments</p>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-200 font-medium">Weather Alerts for Upcoming Bookings</p>
              <p className="text-red-200/70 text-sm mt-1">
                {activeAlerts.length} booking(s) have weather warnings. Review before flight.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'current', label: 'Current Weather', icon: Cloud },
          { id: 'route', label: 'Route Check', icon: Navigation },
          { id: 'alerts', label: 'Booking Alerts', icon: AlertTriangle, badge: activeAlerts.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Current Weather Tab */}
      {activeTab === 'current' && (
        <div className="space-y-6">
          {/* Location Input */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-300">Latitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={currentLat}
                  onChange={(e) => setCurrentLat(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                  placeholder="28.6139"
                />
              </div>
              <div>
                <Label className="text-slate-300">Longitude</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={currentLon}
                  onChange={(e) => setCurrentLon(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                  placeholder="77.2090"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={loadCurrentWeather} disabled={loading} className="bg-blue-500 hover:bg-blue-600 w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Check Weather
                </Button>
              </div>
            </div>
          </div>

          {/* Weather Display */}
          {weather && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Current Conditions */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{weather.location?.name || 'Location'}</h3>
                    <p className="text-slate-400 text-sm">Current Conditions</p>
                  </div>
                  {getWeatherIcon(weather.current?.condition)}
                </div>
                
                <div className="mt-6">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-white">{Math.round(weather.current?.temperature || 0)}°</span>
                    <span className="text-slate-400 mb-2">C</span>
                  </div>
                  <p className="text-slate-300 capitalize mt-1">{weather.current?.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-blue-400" />
                    <span className="text-slate-300 text-sm">{weather.current?.wind_speed_kmh} km/h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-green-400" />
                    <span className="text-slate-300 text-sm">{weather.current?.visibility_km?.toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-cyan-400" />
                    <span className="text-slate-300 text-sm">{weather.current?.humidity}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300 text-sm">{weather.current?.clouds_percent}% clouds</span>
                  </div>
                </div>
                
                {weather.is_mock && (
                  <p className="text-yellow-400 text-xs mt-4">⚠️ Sample data - configure API key for live weather</p>
                )}
              </div>

              {/* Flight Safety */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-semibold text-lg mb-4">Flight Safety Assessment</h3>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-16 h-16 rounded-full ${getSafetyColor(weather.flight_safety?.status)} flex items-center justify-center`}>
                    <span className="text-2xl font-bold text-white">{weather.flight_safety?.safety_score}</span>
                  </div>
                  <div>
                    <p className={`text-xl font-semibold capitalize ${getSafetyTextColor(weather.flight_safety?.status)}`}>
                      {weather.flight_safety?.status}
                    </p>
                    <p className="text-slate-400 text-sm">{weather.flight_safety?.status_message}</p>
                  </div>
                </div>
                
                {/* Alerts */}
                {weather.flight_safety?.alerts?.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-slate-400 text-sm font-medium">Alerts:</p>
                    {weather.flight_safety.alerts.map((alert, idx) => (
                      <div key={idx} className={`p-3 rounded-lg ${
                        alert.severity === 'critical' ? 'bg-red-500/20 border border-red-500/30' :
                        alert.severity === 'high' ? 'bg-orange-500/20 border border-orange-500/30' :
                        alert.severity === 'medium' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                        'bg-slate-700/50'
                      }`}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                            alert.severity === 'critical' ? 'text-red-400' :
                            alert.severity === 'high' ? 'text-orange-400' :
                            'text-yellow-400'
                          }`} />
                          <p className="text-slate-200 text-sm">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span>No weather alerts</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Route Check Tab */}
      {activeTab === 'route' && (
        <div className="space-y-6">
          {/* Route Input */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white font-medium mb-3">Origin / उड़ान का स्थान</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-slate-400 text-sm">Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={originLat}
                      onChange={(e) => setOriginLat(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-sm">Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={originLon}
                      onChange={(e) => setOriginLon(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-white font-medium mb-3">Destination / गंतव्य</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-slate-400 text-sm">Latitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={destLat}
                      onChange={(e) => setDestLat(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-sm">Longitude</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={destLon}
                      onChange={(e) => setDestLon(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={loadRouteWeather} disabled={loading} className="bg-blue-500 hover:bg-blue-600 mt-4">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Navigation className="h-4 w-4 mr-2" />}
              Check Route Weather
            </Button>
          </div>

          {/* Route Weather Display */}
          {routeWeather && (
            <div className="space-y-4">
              {/* Overall Assessment */}
              <div className={`rounded-xl p-6 border ${
                routeWeather.route_assessment?.overall_status === 'safe' ? 'bg-green-500/10 border-green-500/30' :
                routeWeather.route_assessment?.overall_status === 'caution' ? 'bg-yellow-500/10 border-yellow-500/30' :
                routeWeather.route_assessment?.overall_status === 'warning' ? 'bg-orange-500/10 border-orange-500/30' :
                'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-xl font-semibold capitalize ${getSafetyTextColor(routeWeather.route_assessment?.overall_status)}`}>
                      Route Status: {routeWeather.route_assessment?.overall_status}
                    </p>
                    <p className="text-slate-300 mt-1">{routeWeather.route_assessment?.recommendation}</p>
                  </div>
                  <div className={`w-16 h-16 rounded-full ${getSafetyColor(routeWeather.route_assessment?.overall_status)} flex items-center justify-center`}>
                    <span className="text-2xl font-bold text-white">{routeWeather.route_assessment?.combined_safety_score}</span>
                  </div>
                </div>
              </div>

              {/* Origin & Destination */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Origin */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-green-400" />
                    {routeWeather.origin?.name}
                  </h4>
                  <div className="flex items-center gap-4">
                    {getWeatherIcon(routeWeather.origin?.weather?.condition)}
                    <div>
                      <p className="text-3xl font-bold text-white">{Math.round(routeWeather.origin?.weather?.temperature || 0)}°C</p>
                      <p className="text-slate-400 capitalize">{routeWeather.origin?.weather?.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="text-slate-400">Wind: {routeWeather.origin?.weather?.wind_speed_kmh} km/h</span>
                    <span className="text-slate-400">Visibility: {routeWeather.origin?.weather?.visibility_km?.toFixed(1)} km</span>
                  </div>
                  <div className={`mt-3 px-3 py-1 rounded inline-block ${getSafetyColor(routeWeather.origin?.safety?.status)}`}>
                    <span className="text-white text-sm font-medium capitalize">{routeWeather.origin?.safety?.status} - Score: {routeWeather.origin?.safety?.safety_score}</span>
                  </div>
                </div>

                {/* Destination */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-red-400" />
                    {routeWeather.destination?.name}
                  </h4>
                  <div className="flex items-center gap-4">
                    {getWeatherIcon(routeWeather.destination?.weather?.condition)}
                    <div>
                      <p className="text-3xl font-bold text-white">{Math.round(routeWeather.destination?.weather?.temperature || 0)}°C</p>
                      <p className="text-slate-400 capitalize">{routeWeather.destination?.weather?.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <span className="text-slate-400">Wind: {routeWeather.destination?.weather?.wind_speed_kmh} km/h</span>
                    <span className="text-slate-400">Visibility: {routeWeather.destination?.weather?.visibility_km?.toFixed(1)} km</span>
                  </div>
                  <div className={`mt-3 px-3 py-1 rounded inline-block ${getSafetyColor(routeWeather.destination?.safety?.status)}`}>
                    <span className="text-white text-sm font-medium capitalize">{routeWeather.destination?.safety?.status} - Score: {routeWeather.destination?.safety?.safety_score}</span>
                  </div>
                </div>
              </div>

              {/* All Alerts */}
              {routeWeather.route_assessment?.alerts?.length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <h4 className="text-white font-medium mb-3">Route Alerts ({routeWeather.route_assessment.alerts_count})</h4>
                  <div className="space-y-2">
                    {routeWeather.route_assessment.alerts.map((alert, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-slate-900/50 rounded">
                        <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                          alert.severity === 'critical' ? 'text-red-400' :
                          alert.severity === 'high' ? 'text-orange-400' :
                          'text-yellow-400'
                        }`} />
                        <div>
                          <p className="text-slate-200 text-sm">{alert.message}</p>
                          <p className="text-slate-500 text-xs">Location: {alert.location}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Booking Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {activeAlerts.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-white font-medium">No Weather Alerts</p>
              <p className="text-slate-400 text-sm">All upcoming bookings have favorable weather conditions</p>
            </div>
          ) : (
            activeAlerts.map((alert, idx) => (
              <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-red-500/30">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">{alert.booking_number}</p>
                    <p className="text-slate-400 text-sm">{alert.route}</p>
                    <p className="text-slate-500 text-xs mt-1">Journey: {alert.journey_date}</p>
                  </div>
                  <div className={`px-3 py-1 rounded ${getSafetyColor(alert.weather_status)}`}>
                    <span className="text-white text-sm font-medium capitalize">{alert.weather_status}</span>
                  </div>
                </div>
                <p className="text-orange-400 text-sm mt-3">{alert.recommendation}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default WeatherDashboard;
