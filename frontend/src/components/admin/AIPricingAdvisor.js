import React, { useState } from 'react';
import { 
  Calculator, TrendingUp, MapPin, Plane, Users, Calendar,
  Sparkles, ArrowRight, RefreshCw, DollarSign, Info, CheckCircle,
  AlertCircle, Lightbulb, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AIRCRAFT_TYPES = [
  { value: 'helicopter', label: 'Helicopter', icon: '🚁' },
  { value: 'light_jet', label: 'Light Jet', icon: '✈️' },
  { value: 'mid_jet', label: 'Mid-Size Jet', icon: '🛩️' },
  { value: 'heavy_jet', label: 'Heavy Jet', icon: '🛫' },
];

const POPULAR_ROUTES = [
  { origin: 'Mumbai', destination: 'Pune' },
  { origin: 'Delhi', destination: 'Jaipur' },
  { origin: 'Mumbai', destination: 'Shirdi' },
  { origin: 'Bangalore', destination: 'Mysore' },
  { origin: 'Chennai', destination: 'Tirupati' },
  { origin: 'Mumbai', destination: 'Goa' },
];

function AIPricingAdvisor() {
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    aircraft_type: 'helicopter',
    passengers: 2,
    date: '',
    is_round_trip: false,
    special_requirements: []
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.origin || !formData.destination) {
      toast.error('Please enter origin and destination');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/ai-pricing/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      setResult(data);
      toast.success('Pricing suggestion generated!');
    } catch (error) {
      toast.error('Failed to get pricing suggestion');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectPopularRoute = (route) => {
    setFormData(prev => ({
      ...prev,
      origin: route.origin,
      destination: route.destination
    }));
  };

  const formatCurrency = (amount) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} Lakhs`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">AI Pricing Advisor</h1>
            <p className="text-slate-400">Smart route-based pricing suggestions powered by AI</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-purple-400" />
              Get Price Suggestion
            </h2>

            {/* Popular Routes */}
            <div className="mb-6">
              <Label className="text-slate-400 text-sm mb-2 block">Popular Routes</Label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_ROUTES.map((route, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectPopularRoute(route)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-purple-500/20 border border-slate-700 hover:border-purple-500/50 rounded-lg text-sm text-slate-300 hover:text-white transition-all"
                  >
                    {route.origin} → {route.destination}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Origin</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      value={formData.origin}
                      onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
                      placeholder="Mumbai"
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Destination</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      value={formData.destination}
                      onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                      placeholder="Pune"
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Aircraft Type</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {AIRCRAFT_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, aircraft_type: type.value }))}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        formData.aircraft_type === type.value
                          ? 'bg-purple-500/20 border-purple-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-purple-500/50'
                      }`}
                    >
                      <span className="text-xl mr-2">{type.icon}</span>
                      <span className="font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Passengers</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      min="1"
                      max="19"
                      value={formData.passengers}
                      onChange={(e) => setFormData(prev => ({ ...prev, passengers: parseInt(e.target.value) || 1 }))}
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Travel Date (Optional)</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_round_trip}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_round_trip: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-slate-300">Round Trip</span>
                </label>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 h-12"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Get AI Pricing Suggestion
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {result ? (
              <>
                {/* Main Price */}
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-2xl p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">AI Suggested Price</p>
                      <p className="text-4xl font-bold text-white mt-1">
                        {formatCurrency(result.suggested_price)}
                      </p>
                      <p className="text-purple-400 text-sm mt-1">
                        {formData.origin} → {formData.destination}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-purple-500 mb-2">
                        {Math.round(result.confidence * 100)}% Confidence
                      </Badge>
                      <p className="text-slate-400 text-xs">
                        {result.breakdown?.distance_km} km distance
                      </p>
                    </div>
                  </div>

                  {/* AI Message in Hindi */}
                  {result.ai_message && (
                    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-purple-500/30">
                      <p className="text-white font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        {result.ai_message}
                      </p>
                    </div>
                  )}
                </div>

                {/* Price Range */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                    Price Range
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-800 rounded-lg">
                      <p className="text-slate-400 text-xs">Minimum</p>
                      <p className="text-lg font-bold text-green-400">
                        {formatCurrency(result.price_range?.min)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-purple-500/20 rounded-lg border border-purple-500/50">
                      <p className="text-purple-300 text-xs">Competitive</p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(result.price_range?.competitive)}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-slate-800 rounded-lg">
                      <p className="text-slate-400 text-xs">Maximum</p>
                      <p className="text-lg font-bold text-orange-400">
                        {formatCurrency(result.price_range?.max)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pricing Factors */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Pricing Factors
                  </h3>
                  <div className="space-y-3">
                    {result.factors?.map((factor, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          {factor.impact === '+' ? (
                            <TrendingUp className="h-4 w-4 text-red-400" />
                          ) : factor.impact === '-' ? (
                            <TrendingUp className="h-4 w-4 text-green-400 rotate-180" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                          )}
                          <div>
                            <p className="text-white text-sm font-medium">{factor.name}</p>
                            <p className="text-slate-400 text-xs">{factor.description}</p>
                          </div>
                        </div>
                        <Badge className={
                          factor.impact === '+' ? 'bg-red-500/20 text-red-400' :
                          factor.impact === '-' ? 'bg-green-500/20 text-green-400' :
                          'bg-slate-700'
                        }>
                          {factor.multiplier}x
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {result.recommendations?.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-400" />
                      AI Recommendations
                    </h3>
                    <div className="space-y-2">
                      {result.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <p className="text-slate-300 text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <Sparkles className="h-16 w-16 text-purple-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-white mb-2">AI Pricing Advisor</h3>
                <p className="text-slate-400 max-w-sm mx-auto">
                  Enter route details to get intelligent pricing suggestions based on demand, 
                  season, and historical data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIPricingAdvisor;
