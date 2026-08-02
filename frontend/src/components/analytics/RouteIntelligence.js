import React, { useState, useEffect } from 'react';
import { 
  Map, TrendingUp, DollarSign, BarChart3, Calendar, 
  ArrowUpRight, ArrowDownRight, Loader2, RefreshCw,
  Target, Flame, Sparkles, Sun, Cloud, Snowflake, Leaf
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  CartesianGrid, Legend
} from 'recharts';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
const SEASON_ICONS = { Q1: Snowflake, Q2: Leaf, Q3: Sun, Q4: Cloud };

function RouteIntelligence() {
  const [data, setData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [routeRes, profitRes, forecastRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/routes/intelligence`, { headers }),
        fetch(`${API_URL}/api/analytics/routes/profit-analysis`, { headers }),
        fetch(`${API_URL}/api/analytics/routes/demand-forecast`, { headers })
      ]);

      if (routeRes.ok) setData(await routeRes.json());
      if (profitRes.ok) setProfitData(await profitRes.json());
      if (forecastRes.ok) setForecastData(await forecastRes.json());
    } catch (error) {
      toast.error('Failed to load route intelligence');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-slate-400">Loading Route Intelligence...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Map },
    { id: 'profit', label: 'Profit Analysis', icon: DollarSign },
    { id: 'forecast', label: 'Demand Forecast', icon: Calendar },
  ];

  return (
    <div className="space-y-6" data-testid="route-intelligence">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Map className="h-7 w-7 text-orange-500" />
            Route Intelligence Engine
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-powered route analysis, demand patterns & profit optimization
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
                ? 'bg-orange-600 text-white' 
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && data && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-xl p-4">
              <p className="text-orange-400 text-sm">Total Routes</p>
              <p className="text-3xl font-bold text-white">{data.summary.total_routes}</p>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
              <p className="text-green-400 text-sm">Total Bookings</p>
              <p className="text-3xl font-bold text-white">{data.summary.total_bookings}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <p className="text-blue-400 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-white">₹{(data.summary.total_revenue / 100000).toFixed(1)}L</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
              <p className="text-purple-400 text-sm">Top Route</p>
              <p className="text-lg font-bold text-white truncate">{data.summary.top_route || 'N/A'}</p>
            </div>
          </div>

          {/* Top Routes Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Top 10 Popular Routes
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                    <th className="pb-3">#</th>
                    <th className="pb-3">Route</th>
                    <th className="pb-3">Bookings</th>
                    <th className="pb-3">Revenue</th>
                    <th className="pb-3">Avg Price</th>
                    <th className="pb-3">Conversion</th>
                    <th className="pb-3">Peak Season</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_routes.map((route, idx) => (
                    <tr key={route.route} className="border-b border-slate-700/50 text-white">
                      <td className="py-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-slate-400 text-black' :
                          idx === 2 ? 'bg-orange-600' : 'bg-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 font-medium">{route.route}</td>
                      <td className="py-3">{route.bookings}</td>
                      <td className="py-3 text-green-400">₹{(route.revenue / 1000).toFixed(0)}K</td>
                      <td className="py-3">₹{route.avg_price.toLocaleString()}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          route.conversion_rate > 50 ? 'bg-green-600/20 text-green-400' :
                          route.conversion_rate > 25 ? 'bg-yellow-600/20 text-yellow-400' :
                          'bg-red-600/20 text-red-400'
                        }`}>
                          {route.conversion_rate}%
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs">
                          {route.peak_season}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend Chart */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Monthly Booking Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="bookings" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Seasonal Distribution */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Seasonal Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(data.seasonal_trends).map(([quarter, value]) => ({
                      name: quarter,
                      value
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.keys(data.seasonal_trends).map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {Object.entries(data.seasonal_trends).map(([q, v], idx) => {
                  const Icon = SEASON_ICONS[q];
                  return (
                    <div key={q} className="flex items-center gap-1 text-sm text-slate-400">
                      <Icon className="h-4 w-4" style={{ color: COLORS[idx] }} />
                      <span>{q}: {v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Demand Heatmap */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-red-500" />
              City Demand Heatmap
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {data.demand_heatmap.slice(0, 10).map((city, idx) => (
                <div 
                  key={city.city}
                  className={`p-3 rounded-lg text-center ${
                    idx === 0 ? 'bg-red-600/30 border border-red-500' :
                    idx < 3 ? 'bg-orange-600/20 border border-orange-500/50' :
                    'bg-slate-700/50'
                  }`}
                >
                  <p className="font-semibold text-white">{city.city}</p>
                  <p className="text-2xl font-bold text-orange-400">{city.total}</p>
                  <p className="text-xs text-slate-400">
                    ↑{city.outbound} ↓{city.inbound}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Profit Analysis Tab */}
      {activeTab === 'profit' && profitData && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
              <p className="text-green-400 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-white">₹{(profitData.summary.total_revenue / 100000).toFixed(1)}L</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <p className="text-blue-400 text-sm">Total Profit</p>
              <p className="text-3xl font-bold text-white">₹{(profitData.summary.total_profit / 100000).toFixed(1)}L</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
              <p className="text-purple-400 text-sm">Avg Margin</p>
              <p className="text-3xl font-bold text-white">{profitData.summary.avg_profit_margin}%</p>
            </div>
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-xl p-4">
              <p className="text-orange-400 text-sm">Routes Analyzed</p>
              <p className="text-3xl font-bold text-white">{profitData.summary.total_routes_analyzed}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Profitable */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-green-500" />
                Most Profitable Routes
              </h3>
              <div className="space-y-3">
                {profitData.most_profitable_routes.map((route, idx) => (
                  <div key={route.route} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-white">{route.route}</p>
                      <p className="text-sm text-slate-400">{route.bookings} bookings</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">₹{(route.net_profit / 1000).toFixed(0)}K</p>
                      <p className="text-sm text-slate-400">{route.profit_margin}% margin</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Needs Optimization */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5 text-red-500" />
                Routes Needing Optimization
              </h3>
              <div className="space-y-3">
                {profitData.needs_optimization.map((route, idx) => (
                  <div key={route.route} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-white">{route.route}</p>
                      <p className="text-sm text-slate-400">{route.bookings} bookings</p>
                    </div>
                    <div className="text-right">
                      <p className={route.profit_margin < 0 ? 'text-red-400' : 'text-yellow-400'} style={{ fontWeight: 'bold' }}>
                        {route.profit_margin}% margin
                      </p>
                      <p className="text-sm text-slate-400">₹{route.avg_profit_per_booking}/trip</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Profit Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Route Profit Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitData.all_routes.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="route" stroke="#9ca3af" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value) => [`₹${(value / 1000).toFixed(0)}K`, '']}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" />
                <Bar dataKey="net_profit" name="Net Profit" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Demand Forecast Tab */}
      {activeTab === 'forecast' && forecastData && (
        <div className="space-y-6">
          {/* Forecast Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-xl p-4">
              <p className="text-orange-400 text-sm">Peak Day</p>
              <p className="text-2xl font-bold text-white">{forecastData.forecast_summary.peak_day}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <p className="text-blue-400 text-sm">Peak Month</p>
              <p className="text-2xl font-bold text-white">{forecastData.forecast_summary.peak_month}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
              <p className="text-purple-400 text-sm">Next High Demand</p>
              <p className="text-xl font-bold text-white">{forecastData.forecast_summary.next_high_demand_event}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Day of Week Pattern */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Day of Week Pattern</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={forecastData.day_of_week_pattern}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="bookings" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Pattern */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Monthly Pattern</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={forecastData.monthly_pattern}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Line type="monotone" dataKey="bookings" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Upcoming High Demand Events
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {forecastData.upcoming_high_demand_events.map(event => (
                <div 
                  key={event.name}
                  className={`p-4 rounded-lg ${
                    event.expected_demand === 'High' 
                      ? 'bg-red-600/20 border border-red-500/50' 
                      : 'bg-yellow-600/20 border border-yellow-500/50'
                  }`}
                >
                  <p className="font-semibold text-white">{event.name}</p>
                  <p className="text-sm text-slate-400">{event.date}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      event.expected_demand === 'High' ? 'bg-red-600' : 'bg-yellow-600'
                    }`}>
                      {event.expected_demand} Demand
                    </span>
                    <span className="text-sm text-slate-400">{event.days_away} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Recommendations */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Pricing Recommendations
            </h3>
            <div className="space-y-3">
              {forecastData.pricing_recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-4 bg-slate-700/50 rounded-lg p-4">
                  <div className={`w-2 h-full rounded ${
                    rec.recommendation.includes('Increase') || rec.recommendation.includes('Surge') 
                      ? 'bg-green-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="font-medium text-white">{rec.trigger}</p>
                    <p className="text-orange-400">{rec.recommendation}</p>
                    <p className="text-sm text-slate-400 mt-1">{rec.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteIntelligence;
