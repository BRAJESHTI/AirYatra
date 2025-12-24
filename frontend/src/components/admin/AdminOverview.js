import React from 'react';
import { Users, Plane, Calendar, IndianRupee, AlertTriangle, TrendingUp, FileWarning, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PilotDutyWidget from './PilotDutyWidget';

function AdminOverview({ data, onRefresh, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  const stats = data?.statistics || {};
  const revenue = data?.revenue || {};
  const recentBookings = data?.recent_bookings || [];
  const emergencyAlerts = data?.emergency_alerts || [];

  const statCards = [
    { label: 'Total Bookings', value: stats.total_bookings || 0, icon: Calendar, color: 'blue' },
    { label: "Today's Bookings", value: stats.today_bookings || 0, icon: TrendingUp, color: 'green' },
    { label: 'Active Operators', value: stats.active_operators || 0, icon: Users, color: 'purple' },
    { label: 'Total Aircraft', value: stats.total_aircraft || 0, icon: Plane, color: 'cyan' },
    { label: 'Pending Approvals', value: stats.pending_operator_approvals || 0, icon: FileWarning, color: 'orange' },
    { label: 'Pending Permissions', value: stats.pending_landing_permissions || 0, icon: AlertTriangle, color: 'yellow' },
  ];

  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  const iconColorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 mt-1">Overview of platform performance and pending actions</p>
        </div>
        <Button onClick={onRefresh} variant="outline" className="border-slate-600 text-slate-300 hover:text-white">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className={`p-4 rounded-xl border ${colorClasses[stat.color]}`}>
              <div className="flex items-center justify-between">
                <Icon className={`h-8 w-8 ${iconColorClasses[stat.color]}`} />
                <span className="text-3xl font-bold text-white">{stat.value}</span>
              </div>
              <p className="text-sm mt-2 text-slate-300">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Revenue Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30">
          <div className="flex items-center space-x-3">
            <IndianRupee className="h-10 w-10 text-green-400" />
            <div>
              <p className="text-sm text-slate-400">Total Revenue</p>
              <p className="text-2xl font-bold text-white">₹{(revenue.total_revenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
          <div className="flex items-center space-x-3">
            <IndianRupee className="h-10 w-10 text-orange-400" />
            <div>
              <p className="text-sm text-slate-400">Platform Commission</p>
              <p className="text-2xl font-bold text-white">₹{(revenue.total_commission || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
          <div className="flex items-center space-x-3">
            <IndianRupee className="h-10 w-10 text-blue-400" />
            <div>
              <p className="text-sm text-slate-400">Operator Payouts</p>
              <p className="text-2xl font-bold text-white">₹{(revenue.operator_payout || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Bookings</h3>
          <div className="space-y-3">
            {recentBookings.length > 0 ? (
              recentBookings.slice(0, 5).map((booking, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div>
                    <p className="text-white font-medium">{booking.booking_number || `#${booking.id?.slice(0, 8)}`}</p>
                    <p className="text-sm text-slate-400">
                      {booking.from_location} → {booking.to_location}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      booking.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      booking.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                      booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {booking.status}
                    </span>
                    <p className="text-sm text-slate-400 mt-1">{booking.customer_name || 'Customer'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center py-4">No recent bookings</p>
            )}
          </div>
        </div>

        {/* Emergency Alerts */}
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            Emergency Alerts
          </h3>
          <div className="space-y-3">
            {emergencyAlerts.length > 0 ? (
              emergencyAlerts.map((alert, index) => (
                <div key={index} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-white font-medium">Booking: {alert.booking_number || alert.id?.slice(0, 8)}</p>
                  <p className="text-sm text-red-300">{alert.cancellation_reason || 'Emergency Alert'}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center py-4">No emergency alerts</p>
            )}
          </div>
        </div>
      </div>

      {/* Document Expiry Alerts */}
      <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
        <h3 className="text-lg font-semibold text-white mb-4">Document Expiry Alerts (Next 30 Days)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Pilot Documents Expiring</span>
              <span className="text-2xl font-bold text-yellow-400">{stats.expiring_pilot_documents || 0}</span>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Aircraft Documents Expiring</span>
              <span className="text-2xl font-bold text-yellow-400">{stats.expiring_aircraft_documents || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminOverview;
