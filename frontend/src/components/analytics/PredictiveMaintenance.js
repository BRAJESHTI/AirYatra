import React, { useState, useEffect } from 'react';
import { 
  Wrench, AlertTriangle, CheckCircle, Clock, TrendingUp,
  Loader2, RefreshCw, Cpu, Gauge, DollarSign, Calendar,
  ShieldCheck, Activity, Zap, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  CartesianGrid, Legend
} from 'recharts';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RISK_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  optimal: '#10b981'
};

function PredictiveMaintenance() {
  const [predictions, setPredictions] = useState(null);
  const [components, setComponents] = useState(null);
  const [costForecast, setCostForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('predictions');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [predRes, compRes, costRes] = await Promise.all([
        fetch(`${API_URL}/api/maintenance/ai/predictions`, { headers }),
        fetch(`${API_URL}/api/maintenance/ai/component-health`, { headers }),
        fetch(`${API_URL}/api/maintenance/ai/cost-forecast?months=6`, { headers })
      ]);

      if (predRes.ok) setPredictions(await predRes.json());
      if (compRes.ok) setComponents(await compRes.json());
      if (costRes.ok) setCostForecast(await costRes.json());
    } catch (error) {
      toast.error('Failed to load maintenance predictions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-slate-400">Analyzing fleet data with AI...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'predictions', label: 'AI Predictions', icon: Cpu },
    { id: 'components', label: 'Component Health', icon: Settings },
    { id: 'costs', label: 'Cost Forecast', icon: DollarSign },
  ];

  const getRiskIcon = (level) => {
    switch(level) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'high': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'medium': return <Clock className="h-5 w-5 text-yellow-500" />;
      default: return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="predictive-maintenance">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="h-7 w-7 text-purple-500" />
            Predictive Maintenance AI
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered maintenance predictions, pattern analysis & cost forecasting
          </p>
        </div>
        <Button onClick={fetchAllData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === tab.id 
                ? 'bg-purple-600 text-white' 
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Predictions Tab */}
      {activeTab === 'predictions' && predictions && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <p className="text-blue-400 text-sm">Total Aircraft</p>
              <p className="text-3xl font-bold text-white">{predictions.summary.total_aircraft}</p>
            </div>
            <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-600/30 rounded-xl p-4">
              <p className="text-red-400 text-sm">Critical Alerts</p>
              <p className="text-3xl font-bold text-white">{predictions.summary.critical_alerts}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-600/30 rounded-xl p-4">
              <p className="text-yellow-400 text-sm">Medium Alerts</p>
              <p className="text-3xl font-bold text-white">{predictions.summary.medium_alerts}</p>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
              <p className="text-green-400 text-sm">Healthy Aircraft</p>
              <p className="text-3xl font-bold text-white">{predictions.summary.healthy_aircraft}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
              <p className="text-purple-400 text-sm">Fleet Health</p>
              <p className="text-3xl font-bold text-white">{predictions.summary.fleet_health_score}%</p>
            </div>
          </div>

          {/* AI Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {predictions.ai_insights.map((insight, idx) => (
              <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  {insight.type === 'trend' && <TrendingUp className="h-5 w-5 text-blue-500" />}
                  {insight.type === 'optimization' && <Zap className="h-5 w-5 text-yellow-500" />}
                  {insight.type === 'prediction' && <Activity className="h-5 w-5 text-purple-500" />}
                  <h4 className="font-semibold text-white">{insight.title}</h4>
                </div>
                <p className="text-slate-300 text-sm">{insight.insight}</p>
                <p className="text-orange-400 text-xs mt-2">→ {insight.action}</p>
              </div>
            ))}
          </div>

          {/* Predictions Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-500" />
              Aircraft Maintenance Predictions
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                    <th className="pb-3">Aircraft</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Hours Used</th>
                    <th className="pb-3">Until Due</th>
                    <th className="pb-3">Risk Level</th>
                    <th className="pb-3">Predicted Date</th>
                    <th className="pb-3">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.predictions.map((pred) => (
                    <tr key={pred.aircraft_id} className="border-b border-slate-700/50">
                      <td className="py-3">
                        <span className="font-mono text-white bg-slate-700 px-2 py-1 rounded">
                          {pred.registration}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300">{pred.aircraft_type}</td>
                      <td className="py-3 text-slate-300">{pred.hours_since_maintenance}h</td>
                      <td className="py-3">
                        <span className={`font-bold ${pred.hours_until_due <= 0 ? 'text-red-400' : 'text-white'}`}>
                          {pred.hours_until_due <= 0 ? 'OVERDUE' : `${pred.hours_until_due}h`}
                        </span>
                      </td>
                      <td className="py-3">
                        <span 
                          className="px-2 py-1 rounded text-xs font-bold uppercase"
                          style={{ 
                            backgroundColor: `${RISK_COLORS[pred.risk_level]}20`,
                            color: RISK_COLORS[pred.risk_level]
                          }}
                        >
                          {pred.risk_level}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300">{pred.predicted_maintenance_date}</td>
                      <td className="py-3 text-sm text-slate-400 max-w-xs truncate">{pred.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Distribution Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Critical', value: predictions.predictions.filter(p => p.risk_level === 'critical').length },
                    { name: 'High', value: predictions.predictions.filter(p => p.risk_level === 'high').length },
                    { name: 'Medium', value: predictions.predictions.filter(p => p.risk_level === 'medium').length },
                    { name: 'Low', value: predictions.predictions.filter(p => p.risk_level === 'low').length },
                    { name: 'Optimal', value: predictions.predictions.filter(p => p.risk_level === 'optimal').length },
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill={RISK_COLORS.critical} />
                  <Cell fill={RISK_COLORS.high} />
                  <Cell fill={RISK_COLORS.medium} />
                  <Cell fill={RISK_COLORS.low} />
                  <Cell fill={RISK_COLORS.optimal} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Components Tab */}
      {activeTab === 'components' && components && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {components.aircraft_components.map((aircraft) => (
              <div key={aircraft.aircraft_id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="font-mono bg-orange-600 px-2 py-1 rounded text-sm">
                      {aircraft.registration}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-slate-400" />
                    <span className={`text-xl font-bold ${
                      aircraft.overall_health > 70 ? 'text-green-400' :
                      aircraft.overall_health > 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {aircraft.overall_health}%
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(aircraft.components).map(([key, comp]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm text-slate-400 w-32">{comp.name}</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            comp.health_percentage > 70 ? 'bg-green-500' :
                            comp.health_percentage > 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${comp.health_percentage}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-12 text-right ${
                        comp.health_percentage > 70 ? 'text-green-400' :
                        comp.health_percentage > 40 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {comp.health_percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Forecast Tab */}
      {activeTab === 'costs' && costForecast && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
              <p className="text-green-400 text-sm">Total Forecast ({costForecast.summary.forecast_period_months}mo)</p>
              <p className="text-2xl font-bold text-white">₹{(costForecast.summary.total_forecast_cost / 100000).toFixed(1)}L</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <p className="text-blue-400 text-sm">Avg Monthly</p>
              <p className="text-2xl font-bold text-white">₹{(costForecast.summary.avg_monthly_cost / 100000).toFixed(1)}L</p>
            </div>
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-xl p-4">
              <p className="text-orange-400 text-sm">Fleet Size</p>
              <p className="text-2xl font-bold text-white">{costForecast.summary.fleet_size}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
              <p className="text-purple-400 text-sm">Cost/Aircraft/Month</p>
              <p className="text-2xl font-bold text-white">₹{(costForecast.summary.cost_per_aircraft / 1000).toFixed(0)}K</p>
            </div>
          </div>

          {/* Cost Forecast Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">6-Month Cost Forecast</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costForecast.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value) => [`₹${(value / 100000).toFixed(1)}L`, 'Predicted Cost']}
                />
                <Bar dataKey="predicted_cost" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Budget Recommendations */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Budget Allocation Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {costForecast.budget_recommendations.map((rec) => (
                <div key={rec.category} className="bg-slate-700/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">{rec.category}</p>
                  <p className="text-2xl font-bold text-white">₹{(rec.amount / 100000).toFixed(1)}L</p>
                  <p className="text-orange-400 text-sm">{rec.percentage}% of total</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PredictiveMaintenance;
