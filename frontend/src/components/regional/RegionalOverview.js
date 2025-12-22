import React, { useState, useEffect } from 'react';
import { Users, Plane, Calendar, IndianRupee, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { regionalManagerAPI } from '@/services/api';

function RegionalOverview({ profile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await regionalManagerAPI.getDashboard();
      setData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-white text-center py-12">Loading dashboard...</div>;
  }

  const stats = data?.statistics || {};
  const revenue = data?.revenue || {};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Regional Dashboard</h1>
          <p className="text-slate-400 mt-1">Managing {data?.region || 'All Regions'}</p>
        </div>
        <Button onClick={loadDashboard} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-purple-500/20 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <Users className="h-8 w-8 text-purple-400" />
            <span className="text-3xl font-bold text-white">{stats.total_operators || 0}</span>
          </div>
          <p className="text-sm mt-2 text-slate-300">Total Operators</p>
          <p className="text-xs text-purple-400">{stats.active_operators || 0} active</p>
        </div>
        
        <div className="p-4 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <Plane className="h-8 w-8 text-yellow-400" />
            <span className="text-3xl font-bold text-white">{stats.pending_operator_approvals || 0}</span>
          </div>
          <p className="text-sm mt-2 text-slate-300">Pending Approvals</p>
        </div>
        
        <div className="p-4 rounded-xl bg-blue-500/20 border border-blue-500/30">
          <div className="flex items-center justify-between">
            <Calendar className="h-8 w-8 text-blue-400" />
            <span className="text-3xl font-bold text-white">{stats.total_bookings || 0}</span>
          </div>
          <p className="text-sm mt-2 text-slate-300">Total Bookings</p>
          <p className="text-xs text-blue-400">{stats.today_bookings || 0} today</p>
        </div>
        
        <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/30">
          <div className="flex items-center justify-between">
            <IndianRupee className="h-8 w-8 text-green-400" />
            <span className="text-2xl font-bold text-white">₹{(revenue.total_revenue || 0).toLocaleString()}</span>
          </div>
          <p className="text-sm mt-2 text-slate-300">Regional Revenue</p>
        </div>
      </div>

      {/* Pending Operators */}
      {data?.pending_operators && data.pending_operators.length > 0 && (
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4">Pending Operator Approvals</h3>
          <div className="space-y-3">
            {data.pending_operators.map((op, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div>
                  <p className="text-white font-medium">{op.company_name}</p>
                  <p className="text-sm text-slate-400">{op.user_email}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                  Pending Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Bookings */}
      <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Bookings</h3>
        <div className="space-y-3">
          {data?.recent_bookings && data.recent_bookings.length > 0 ? (
            data.recent_bookings.slice(0, 5).map((booking, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div>
                  <p className="text-white font-medium">{booking.booking_number || `#${booking.id?.slice(0,8)}`}</p>
                  <p className="text-sm text-slate-400">{booking.from_location} → {booking.to_location}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  booking.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  booking.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {booking.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-slate-400 text-center py-4">No recent bookings</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegionalOverview;
