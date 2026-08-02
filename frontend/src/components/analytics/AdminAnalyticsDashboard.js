import React, { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Users, DollarSign, Download,
  Loader2, RefreshCw, Calendar, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, FileText, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  CartesianGrid, Legend, Funnel, FunnelChart, LabelList
} from 'recharts';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

function AdminAnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [exports, setExports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      const [dashRes, exportRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/admin/dashboard?period=${period}`, { headers }),
        fetch(`${API_URL}/api/analytics/admin/export/summary`, { headers })
      ]);

      if (dashRes.ok) setData(await dashRes.json());
      if (exportRes.ok) setExports(await exportRes.json());
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (endpoint) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = endpoint.split('/').pop() + '.csv';
        a.click();
        toast.success('Export downloaded!');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-slate-400">Loading Analytics...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'exports', label: 'Export Center', icon: Download },
  ];

  return (
    <div className="space-y-6" data-testid="admin-analytics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-orange-500" />
            Admin Analytics Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Revenue trends, Booking patterns, Customer segments
          </p>
        </div>
        <div className="flex gap-2">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Period Info */}
      {data && (
        <div className="text-sm text-slate-400">
          <Calendar className="h-4 w-4 inline mr-1" />
          {data.date_range.start} to {data.date_range.end}
        </div>
      )}

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
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-sm">Total Revenue</p>
                <DollarSign className="h-5 w-5 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-white mt-2">₹{(data.revenue.total / 100000).toFixed(1)}L</p>
              <p className="text-xs text-slate-400 mt-1">Avg: ₹{data.revenue.avg_booking_value.toLocaleString()}/booking</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-blue-400 text-sm">Total Bookings</p>
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-white mt-2">{data.bookings.total}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-purple-400 text-sm">Total Customers</p>
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <p className="text-3xl font-bold text-white mt-2">{data.customers.total}</p>
              <p className="text-xs text-green-400 mt-1">+{data.customers.new_in_period} new</p>
            </div>
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-orange-400 text-sm">Active Fleet</p>
                <BarChart3 className="h-5 w-5 text-orange-400" />
              </div>
              <p className="text-3xl font-bold text-white mt-2">{data.operations.active_fleet}</p>
              <p className="text-xs text-slate-400 mt-1">{data.operations.total_pilots} pilots</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.revenue.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion Funnel */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h3>
              <div className="space-y-3">
                {data.bookings.conversion_funnel.map((stage, idx) => {
                  const maxCount = data.bookings.conversion_funnel[0].count || 1;
                  const percentage = Math.round((stage.count / maxCount) * 100);
                  return (
                    <div key={stage.stage}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{stage.stage}</span>
                        <span className="text-white font-bold">{stage.count}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div 
                          className="h-3 rounded-full"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: COLORS[idx % COLORS.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Routes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Top Routes by Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.top_routes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="route" stroke="#9ca3af" fontSize={10} width={150} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && data && (
        <div className="space-y-6">
          {/* Customer Segments */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(data.customers.segments).map(([segment, count]) => (
              <div key={segment} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-slate-400 text-sm capitalize">{segment} Customers</p>
                <p className="text-3xl font-bold text-white mt-2">{count}</p>
              </div>
            ))}
          </div>

          {/* Top Customers */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Top Customers by Revenue</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                    <th className="pb-3">#</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Email</th>
                    <th className="pb-3">Bookings</th>
                    <th className="pb-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.top_customers.map((cust, idx) => (
                    <tr key={cust.customer_id} className="border-b border-slate-700/50">
                      <td className="py-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? 'bg-yellow-500 text-black' :
                          idx === 1 ? 'bg-slate-400 text-black' :
                          idx === 2 ? 'bg-orange-600' : 'bg-slate-700'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 text-white font-medium">{cust.name}</td>
                      <td className="py-3 text-slate-400">{cust.email}</td>
                      <td className="py-3 text-white">{cust.bookings}</td>
                      <td className="py-3 text-green-400 font-bold">₹{(cust.revenue / 1000).toFixed(0)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Export Center Tab */}
      {activeTab === 'exports' && exports && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exports.available_exports.map((exp) => (
              <div key={exp.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-400" />
                      {exp.name}
                    </h4>
                    <p className="text-sm text-slate-400 mt-1">{exp.description}</p>
                    <p className="text-xs text-orange-400 mt-2">{exp.record_count.toLocaleString()} records</p>
                  </div>
                  <Button 
                    onClick={() => handleExport(exp.endpoint)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAnalyticsDashboard;
