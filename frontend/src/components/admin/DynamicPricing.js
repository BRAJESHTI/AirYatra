import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, RefreshCw, Settings, Save, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function DynamicPricing() {
  const [config, setConfig] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testParams, setTestParams] = useState({
    origin: 'Delhi',
    destination: 'Mumbai',
    journey_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    base_price: 50000
  });
  const [newFestival, setNewFestival] = useState({ name: '', date: '', multiplier: 1.4 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, analysisRes] = await Promise.all([
        api.get('/api/pricing/config').catch(() => ({ data: null })),
        api.get('/api/pricing/analysis').catch(() => ({ data: null }))
      ]);
      if (configRes.data) setConfig(configRes.data);
      if (analysisRes.data) setAnalysis(analysisRes.data);
    } catch (error) {
      console.error('Failed to load pricing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTestPrice = async () => {
    try {
      const res = await api.post('/api/pricing/calculate', {
        ...testParams,
        passengers: 1
      });
      setTestResult(res.data);
    } catch (error) {
      console.error('Price calculation failed:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.post('/api/pricing/config', config);
      alert('Configuration saved!');
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const addFestival = async () => {
    if (!newFestival.name || !newFestival.date) return;
    try {
      await api.post('/api/pricing/festivals', newFestival);
      setNewFestival({ name: '', date: '', multiplier: 1.4 });
      loadData();
    } catch (error) {
      console.error('Failed to add festival:', error);
    }
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Dynamic Pricing Engine</h1>
          <p className="text-slate-400">AI-powered price optimization based on demand, season, and more</p>
        </div>
        <Button onClick={saveConfig} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Config'}
        </Button>
      </div>

      {/* Stats Cards */}
      {analysis && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-green-400 mb-2">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">Popular Routes</span>
            </div>
            <p className="text-2xl font-bold text-white">{analysis.popular_routes?.length || 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-blue-400 mb-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm">Avg Booking Value</span>
            </div>
            <p className="text-2xl font-bold text-white">
              ₹{(analysis.popular_routes?.[0]?.avg_price || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-purple-400 mb-2">
              <Calendar className="h-5 w-5" />
              <span className="text-sm">Peak Season Active</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {config?.peak_season_months?.includes(new Date().getMonth() + 1) ? 'Yes' : 'No'}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <Settings className="h-5 w-5" />
              <span className="text-sm">Price Range</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {(config?.min_multiplier || 0.7) * 100}% - {(config?.max_multiplier || 2.0) * 100}%
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Pricing Configuration</h2>
          
          {config && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-slate-300">Demand Pricing</label>
                <input
                  type="checkbox"
                  checked={config.demand_pricing_enabled}
                  onChange={(e) => updateConfig('demand_pricing_enabled', e.target.checked)}
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-slate-300">Seasonal Pricing</label>
                <input
                  type="checkbox"
                  checked={config.seasonal_pricing_enabled}
                  onChange={(e) => updateConfig('seasonal_pricing_enabled', e.target.checked)}
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-slate-300">Time-based Pricing</label>
                <input
                  type="checkbox"
                  checked={config.time_based_pricing_enabled}
                  onChange={(e) => updateConfig('time_based_pricing_enabled', e.target.checked)}
                  className="w-5 h-5"
                />
              </div>
              
              <hr className="border-slate-700" />
              
              <div>
                <label className="text-slate-300 block mb-2">High Demand Multiplier</label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.high_demand_multiplier}
                  onChange={(e) => updateConfig('high_demand_multiplier', parseFloat(e.target.value))}
                  className="bg-slate-700"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-2">Peak Season Multiplier</label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.peak_season_multiplier}
                  onChange={(e) => updateConfig('peak_season_multiplier', parseFloat(e.target.value))}
                  className="bg-slate-700"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-2">Advance Booking Discount (%)</label>
                <Input
                  type="number"
                  step="1"
                  value={(config.advance_booking_discount || 0.1) * 100}
                  onChange={(e) => updateConfig('advance_booking_discount', parseFloat(e.target.value) / 100)}
                  className="bg-slate-700"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-2">Last Minute Surcharge (%)</label>
                <Input
                  type="number"
                  step="1"
                  value={(config.last_minute_surcharge || 0.15) * 100}
                  onChange={(e) => updateConfig('last_minute_surcharge', parseFloat(e.target.value) / 100)}
                  className="bg-slate-700"
                />
              </div>
            </div>
          )}
        </div>

        {/* Price Calculator Test */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Price Calculator Test</h2>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-sm">Origin</label>
                  <Input
                    value={testParams.origin}
                    onChange={(e) => setTestParams(prev => ({ ...prev, origin: e.target.value }))}
                    className="bg-slate-700"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Destination</label>
                  <Input
                    value={testParams.destination}
                    onChange={(e) => setTestParams(prev => ({ ...prev, destination: e.target.value }))}
                    className="bg-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-sm">Journey Date</label>
                  <Input
                    type="date"
                    value={testParams.journey_date}
                    onChange={(e) => setTestParams(prev => ({ ...prev, journey_date: e.target.value }))}
                    className="bg-slate-700"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Base Price (₹)</label>
                  <Input
                    type="number"
                    value={testParams.base_price}
                    onChange={(e) => setTestParams(prev => ({ ...prev, base_price: parseInt(e.target.value) }))}
                    className="bg-slate-700"
                  />
                </div>
              </div>
              <Button onClick={calculateTestPrice} className="w-full bg-blue-600 hover:bg-blue-700">
                Calculate Price
              </Button>
            </div>

            {testResult && (
              <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-400">Base Price</span>
                  <span className="text-white">₹{testResult.base_price?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-400">Multiplier</span>
                  <span className={`font-semibold ${testResult.total_multiplier > 1 ? 'text-red-400' : 'text-green-400'}`}>
                    {testResult.total_multiplier}x
                  </span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t border-slate-700 pt-3">
                  <span className="text-white">Final Price</span>
                  <span className="text-orange-400">₹{testResult.final_price?.toLocaleString()}</span>
                </div>
                {testResult.price_factors?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-slate-400 text-sm">Applied Factors:</p>
                    {testResult.price_factors.map((factor, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-slate-500">{factor.type} ({factor.level || factor.season || factor.category})</span>
                        <span className="text-slate-300">{factor.multiplier}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Festival Dates */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Festival Pricing</h2>
            
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Input
                placeholder="Festival Name"
                value={newFestival.name}
                onChange={(e) => setNewFestival(prev => ({ ...prev, name: e.target.value }))}
                className="bg-slate-700"
              />
              <Input
                type="date"
                value={newFestival.date}
                onChange={(e) => setNewFestival(prev => ({ ...prev, date: e.target.value }))}
                className="bg-slate-700"
              />
              <Button onClick={addFestival} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {config?.festival_dates?.map((festival, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-slate-900 rounded">
                  <span className="text-white">{festival.name}</span>
                  <span className="text-slate-400">{festival.date}</span>
                  <span className="text-orange-400">{festival.multiplier}x</span>
                </div>
              ))}
              {(!config?.festival_dates || config.festival_dates.length === 0) && (
                <p className="text-slate-500 text-center py-3">No festivals configured</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Popular Routes */}
      {analysis?.popular_routes?.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Popular Routes (Last 30 Days)</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-700">
                  <th className="text-left py-2">Route</th>
                  <th className="text-right py-2">Bookings</th>
                  <th className="text-right py-2">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {analysis.popular_routes.map((route, idx) => (
                  <tr key={idx} className="border-b border-slate-700">
                    <td className="py-3 text-white">{route.route}</td>
                    <td className="py-3 text-right text-slate-300">{route.bookings}</td>
                    <td className="py-3 text-right text-orange-400">₹{route.avg_price?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DynamicPricing;
