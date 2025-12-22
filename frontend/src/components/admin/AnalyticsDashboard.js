import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Plane, IndianRupee, Calendar, Star, BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analyticsAPI } from '@/services/api';

function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await analyticsAPI.getDashboard(period);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading analytics...</div>;
  }

  const summary = data?.summary || {};
  const operators = data?.operators || {};
  const customers = data?.customers || {};

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-cyan-400" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Platform performance and insights</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d', '1y'].map(p => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              onClick={() => setPeriod(p)}
              className={period === p ? 'bg-cyan-500 hover:bg-cyan-600' : 'border-slate-600 text-slate-300'}
              size="sm"
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
            </Button>
          ))}
          <Button onClick={loadAnalytics} variant="outline" className="border-slate-600 text-slate-300" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
          <div className="flex items-center justify-between">
            <Calendar className="h-8 w-8 text-blue-400" />
            <span className="text-sm text-blue-400 flex items-center">
              <ArrowUpRight className="h-4 w-4" /> {summary.conversion_rate}%
            </span>
          </div>
          <p className="text-3xl font-bold text-white mt-2">{summary.total_bookings || 0}</p>
          <p className="text-sm text-slate-400">Total Bookings</p>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30">
          <div className="flex items-center justify-between">
            <IndianRupee className="h-8 w-8 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white mt-2">₹{(summary.total_revenue || 0).toLocaleString()}</p>
          <p className="text-sm text-slate-400">Total Revenue</p>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
          <div className="flex items-center justify-between">
            <IndianRupee className="h-8 w-8 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-white mt-2">₹{(summary.total_commission || 0).toLocaleString()}</p>
          <p className="text-sm text-slate-400">Platform Commission</p>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-8 w-8 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white mt-2">₹{(summary.average_booking_value || 0).toLocaleString()}</p>
          <p className="text-sm text-slate-400">Avg Booking Value</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-6 w-6 text-blue-400" />
            <span className="text-white font-medium">Operators</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-2xl font-bold text-white">{operators.total || 0}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{operators.active || 0}</p>
              <p className="text-xs text-slate-400">Active</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-6 w-6 text-purple-400" />
            <span className="text-white font-medium">Customers</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-2xl font-bold text-white">{customers.total || 0}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">{customers.new_in_period || 0}</p>
              <p className="text-xs text-slate-400">New ({period})</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <Star className="h-6 w-6 text-yellow-400" />
            <span className="text-white font-medium">Feedback</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-2xl font-bold text-white">{data?.feedback?.total_reviews || 0}</p>
              <p className="text-xs text-slate-400">Reviews</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{data?.feedback?.average_rating || 0}</p>
              <p className="text-xs text-slate-400">Avg Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Routes */}
      <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Top Routes</h3>
        <div className="space-y-3">
          {(data?.top_routes || []).slice(0, 5).map((route, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-sm flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-white">{route.route}</span>
              </div>
              <span className="text-slate-400">{route.count} bookings</span>
            </div>
          ))}
          {(data?.top_routes || []).length === 0 && (
            <p className="text-center text-slate-400 py-4">No route data available</p>
          )}
        </div>
      </div>

      {/* Top Operators */}
      <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Top Operators</h3>
        <div className="space-y-3">
          {(operators.top_operators || []).map((op, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-sm flex items-center justify-center">
                  {index + 1}
                </span>
                <div>
                  <span className="text-white">{op.company_name}</span>
                  {op.rating > 0 && (
                    <span className="text-yellow-400 text-sm ml-2">★ {op.rating}</span>
                  )}
                </div>
              </div>
              <span className="text-slate-400">{op.booking_count} bookings</span>
            </div>
          ))}
          {(operators.top_operators || []).length === 0 && (
            <p className="text-center text-slate-400 py-4">No operator data available</p>
          )}
        </div>
      </div>

      {/* Booking Trend Chart Placeholder */}
      <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Booking Trend</h3>
        <div className="h-48 flex items-end justify-around gap-1">
          {(data?.trends?.bookings || []).slice(-14).map((item, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div 
                className="w-6 bg-cyan-500/60 rounded-t"
                style={{ height: `${Math.max(10, (item.count / Math.max(...(data?.trends?.bookings || []).map(b => b.count), 1)) * 150)}px` }}
              />
              <span className="text-xs text-slate-500 transform -rotate-45 origin-left">
                {item.date?.slice(5) || ''}
              </span>
            </div>
          ))}
          {(data?.trends?.bookings || []).length === 0 && (
            <p className="text-center text-slate-400 w-full">No trend data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
