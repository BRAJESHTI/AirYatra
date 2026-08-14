import React, { useState } from 'react';
import { 
  Leaf, Calculator, Plane, Car, Train, TreePine, 
  Loader2, ArrowRight, Info, TrendingDown, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

// Popular routes for quick calculation
const POPULAR_ROUTES = [
  { origin: 'Mumbai', destination: 'Shirdi', distance: 235 },
  { origin: 'Mumbai', destination: 'Pune', distance: 150 },
  { origin: 'Delhi', destination: 'Agra', distance: 200 },
  { origin: 'Bangalore', destination: 'Coorg', distance: 270 },
  { origin: 'Chennai', destination: 'Tirupati', distance: 135 },
  { origin: 'Delhi', destination: 'Shimla', distance: 350 },
];

const AIRCRAFT_TYPES = [
  { value: 'helicopter', label: 'Helicopter', icon: '🚁' },
  { value: 'small_aircraft', label: 'Small Aircraft', icon: '✈️' },
  { value: 'turboprop', label: 'Turboprop', icon: '🛩️' },
  { value: 'light_jet', label: 'Light Jet', icon: '🛫' },
];

function CarbonCalculator() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Form state
  const [distance, setDistance] = useState('');
  const [aircraftType, setAircraftType] = useState('helicopter');
  const [passengers, setPassengers] = useState(1);
  const [roundTrip, setRoundTrip] = useState(false);
  
  // Route-based calculation
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [calcMode, setCalcMode] = useState('distance'); // 'distance' or 'route'

  const calculateEmissions = async () => {
    if (calcMode === 'distance' && (!distance || parseFloat(distance) <= 0)) {
      toast.error('Please enter a valid distance');
      return;
    }
    if (calcMode === 'route' && (!origin || !destination)) {
      toast.error('Please select origin and destination');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (calcMode === 'distance') {
        response = await api.get('/carbon/calculate', {
          params: {
            distance_km: parseFloat(distance),
            aircraft_type: aircraftType,
            passenger_count: passengers,
            round_trip: roundTrip
          }
        });
      } else {
        response = await api.get('/carbon/route', {
          params: {
            origin: origin,
            destination: destination,
            aircraft_type: aircraftType,
            passenger_count: passengers
          }
        });
      }
      
      setResult(response.data);
      toast.success('Carbon footprint calculated!');
    } catch (error) {
      toast.error('Failed to calculate emissions');
    } finally {
      setLoading(false);
    }
  };

  const selectRoute = (route) => {
    setOrigin(route.origin);
    setDestination(route.destination);
    setDistance(route.distance.toString());
    setCalcMode('route');
  };

  const getBadgeColor = (level) => {
    switch(level) {
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Leaf className="h-6 w-6 text-green-400" />
            Carbon Calculator</h2>
          <p className="text-slate-400 mt-1">Check your flight&apos;s environmental impact</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-200 font-medium">AirYatra Green Sky Initiative</p>
            <p className="text-green-200/70 text-sm mt-1">
              We&apos;re committed to carbon-neutral aviation. Calculate your footprint and contribute to our tree-planting program.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator Input */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-orange-400" />
            Calculate Emissions</h3>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setCalcMode('distance')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                calcMode === 'distance' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              By Distance</button>
            <button
              onClick={() => setCalcMode('route')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                calcMode === 'route' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              By Route</button>
          </div>

          {calcMode === 'distance' ? (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Distance (km)</Label>
                <Input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="Enter distance in kilometers"
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Origin</Label>
                  <Input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Mumbai"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Destination</Label>
                  <Input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Shirdi"
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-slate-300">Aircraft Type</Label>
              <select
                value={aircraftType}
                onChange={(e) => setAircraftType(e.target.value)}
                className="w-full mt-1 h-10 px-3 rounded-md bg-slate-900 border border-slate-600 text-white"
              >
                {AIRCRAFT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-slate-300">Passengers</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={passengers}
                onChange={(e) => setPassengers(parseInt(e.target.value) || 1)}
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="roundTrip"
                checked={roundTrip}
                onChange={(e) => setRoundTrip(e.target.checked)}
                className="rounded border-slate-600"
              />
              <Label htmlFor="roundTrip" className="text-slate-300 cursor-pointer">
                Round Trip</Label>
            </div>
          </div>

          <Button 
            onClick={calculateEmissions} 
            disabled={loading}
            className="w-full mt-6 bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Leaf className="h-4 w-4 mr-2" />
            )}
            Calculate Carbon Footprint
          </Button>

          {/* Quick Routes */}
          <div className="mt-6">
            <p className="text-slate-400 text-sm mb-2">Popular Routes</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_ROUTES.slice(0, 4).map((route, idx) => (
                <button
                  key={idx}
                  onClick={() => selectRoute(route)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-full text-xs text-slate-300 transition"
                >
                  {route.origin} → {route.destination}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Main Result Card */}
              <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-xl p-6 border border-green-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Your Carbon Footprint</h3>
                  <span className={`px-3 py-1 rounded-full text-sm border ${getBadgeColor(result.eco_rating?.level)}`}>
                    {result.eco_rating?.badge} {result.eco_rating?.label}
                  </span>
                </div>

                <div className="text-center py-6">
                  <div className="text-5xl font-bold text-green-400">
                    {result.emissions?.total_kg?.toFixed(1)}
                  </div>
                  <div className="text-slate-400 mt-1">kg CO₂</div>
                  <div className="text-slate-500 text-sm mt-2">
                    ({result.emissions?.per_passenger_kg?.toFixed(1)} kg per passenger)
                  </div>
                </div>

                {/* Journey Details */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
                  <div className="text-center">
                    <div className="text-white font-semibold">{result.journey?.distance_km} km</div>
                    <div className="text-slate-500 text-xs">Distance</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-semibold">{result.journey?.passenger_count}</div>
                    <div className="text-slate-500 text-xs">Passengers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-semibold capitalize">{result.journey?.aircraft_type}</div>
                    <div className="text-slate-500 text-xs">Aircraft</div>
                  </div>
                </div>
              </div>

              {/* Comparison Card */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-blue-400" />
                  Compare with Other Transport
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-300">Car</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-medium">{result.comparison?.car_kg} kg</span>
                      <span className="text-orange-400 text-xs ml-2">{result.comparison?.vs_car}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Train className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-300">Train</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-medium">{result.comparison?.train_kg} kg</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-300">Commercial Flight</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-medium">{result.comparison?.commercial_flight_kg} kg</span>
                      <span className="text-orange-400 text-xs ml-2">{result.comparison?.vs_commercial}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Offset Card */}
              <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 rounded-xl p-6 border border-emerald-500/30">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <TreePine className="h-4 w-4 text-emerald-400" />
                  Carbon Offset</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-slate-900/50 rounded-lg">
                    <div className="text-3xl font-bold text-emerald-400">{result.offset?.trees_equivalent}</div>
                    <div className="text-slate-400 text-sm">Trees to Plant</div>
                  </div>
                  <div className="text-center p-4 bg-slate-900/50 rounded-lg">
                    <div className="text-3xl font-bold text-emerald-400">₹{result.offset?.cost_inr?.toFixed(0)}</div>
                    <div className="text-slate-400 text-sm">Offset Cost</div>
                  </div>
                </div>
                <p className="text-emerald-200/70 text-sm mt-4">{result.offset?.description}</p>
              </div>

              {/* Tips */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  Eco Tips</h4>
                <ul className="space-y-2">
                  {result.tips?.map((tip, idx) => (
                    <li key={idx} className="text-slate-400 text-sm">{tip}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
              <Leaf className="h-16 w-16 text-green-400/30 mx-auto mb-4" />
              <p className="text-white font-medium">Enter journey details</p>
              <p className="text-slate-400 text-sm mt-1">
                Calculate your carbon footprint and learn how to offset it
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CarbonCalculator;
