import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Users, MessageSquare, TrendingUp, AlertCircle, Fuel, BookOpen, MapPin, ChevronRight } from 'lucide-react';
import { operatorAPI } from '../../services/api';
import { toast } from 'sonner';
import DocumentExpiryAlerts from './DocumentExpiryAlerts';

function OperatorHome({ operator }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await operatorAPI.getDashboard();
      setDashboard(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path) => {
    navigate(`/operator/${path}`);
  };

  if (loading) {
    return <div className="text-white">Loading dashboard...</div>;
  }

  const stats = dashboard?.statistics || {};

  return (
    <div className="max-w-6xl mx-auto" data-testid="operator-home">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2" data-testid="welcome-title">
          Welcome, {operator?.company_name}
        </h1>
        <p className="text-slate-400">Manage your fleet, respond to inquiries, and track bookings</p>
      </div>

      {/* Verification Alert */}
      {operator?.status === 'pending' && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-8 flex items-start space-x-3" data-testid="verification-alert">
          <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
          <div>
            <h3 className="text-orange-400 font-semibold">Verification Pending</h3>
            <p className="text-slate-300 text-sm">
              Your operator profile is under review. You can add aircraft and pilots, but won't receive 
              inquiries until verification is complete.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid - CLICKABLE */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <button 
          onClick={() => handleNavigate('fleet')}
          className="glass p-6 rounded-lg corner-markers hover:bg-slate-800/50 transition-all duration-200 transform hover:scale-105 cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <Plane className="h-8 w-8 text-orange-500" />
            <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
          </div>
          <div className="text-3xl font-bold text-white" data-testid="total-aircraft">{stats.total_aircraft || 0}</div>
          <div className="text-slate-400 text-sm uppercase">Aircraft</div>
        </button>

        <button 
          onClick={() => handleNavigate('pilots')}
          className="glass p-6 rounded-lg corner-markers hover:bg-slate-800/50 transition-all duration-200 transform hover:scale-105 cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <Users className="h-8 w-8 text-orange-500" />
            <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
          </div>
          <div className="text-3xl font-bold text-white" data-testid="total-pilots">{stats.total_pilots || 0}</div>
          <div className="text-slate-400 text-sm uppercase">Pilots</div>
        </button>

        <button 
          onClick={() => handleNavigate('inquiries')}
          className="glass p-6 rounded-lg corner-markers hover:bg-slate-800/50 transition-all duration-200 transform hover:scale-105 cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <MessageSquare className="h-8 w-8 text-orange-500" />
            <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
          </div>
          <div className="text-3xl font-bold text-orange-400" data-testid="pending-inquiries">{stats.pending_inquiries || 0}</div>
          <div className="text-slate-400 text-sm uppercase">Pending Inquiries</div>
        </button>

        <button 
          onClick={() => handleNavigate('flight-records')}
          className="glass p-6 rounded-lg corner-markers hover:bg-slate-800/50 transition-all duration-200 transform hover:scale-105 cursor-pointer text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="h-8 w-8 text-orange-500" />
            <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
          </div>
          <div className="text-3xl font-bold text-white" data-testid="total-bookings">{stats.total_bookings || 0}</div>
          <div className="text-slate-400 text-sm uppercase">Total Bookings</div>
        </button>
      </div>

      {/* Recent Bookings - CLICKABLE */}
      <div className="glass p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Recent Bookings</h2>
          <button 
            onClick={() => handleNavigate('inquiries')}
            className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            View All <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {dashboard?.recent_bookings?.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dashboard?.recent_bookings?.map((booking) => (
              <button 
                key={booking.id} 
                onClick={() => handleNavigate('inquiries')}
                className="w-full bg-slate-800 p-4 rounded-lg flex justify-between items-center hover:bg-slate-700/70 transition-colors cursor-pointer text-left" 
                data-testid={`booking-${booking.id}`}
              >
                <div>
                  <div className="font-semibold text-white">{booking.booking_number}</div>
                  <div className="text-slate-400 text-sm">
                    {booking.from_location || booking.pickup_location} → {booking.to_location || booking.drop_location}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    booking.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>
                    {booking.status?.replace(/_/g, ' ')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="glass p-6 rounded-lg text-center">
          <Plane className="h-12 w-12 text-orange-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Add Aircraft</h3>
          <p className="text-slate-400 text-sm mb-4">Expand your fleet with new helicopters</p>
          <a href="/operator/fleet" className="text-orange-500 hover:text-orange-400 text-sm font-medium">
            Go to Fleet →
          </a>
        </div>

        <div className="glass p-6 rounded-lg text-center">
          <Users className="h-12 w-12 text-orange-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Manage Pilots</h3>
          <p className="text-slate-400 text-sm mb-4">Add and manage your pilot roster</p>
          <a href="/operator/pilots" className="text-orange-500 hover:text-orange-400 text-sm font-medium">
            Manage Pilots →
          </a>
        </div>

        <div className="glass p-6 rounded-lg text-center">
          <MessageSquare className="h-12 w-12 text-orange-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">View Inquiries</h3>
          <p className="text-slate-400 text-sm mb-4">Respond to customer booking requests</p>
          <a href="/operator/inquiries" className="text-orange-500 hover:text-orange-400 text-sm font-medium">
            View Inquiries →
          </a>
        </div>
      </div>

      {/* Second Row of Quick Actions - Tracking */}
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="glass p-6 rounded-lg text-center">
          <BookOpen className="h-12 w-12 text-cyan-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Flight Records</h3>
          <p className="text-slate-400 text-sm mb-4">Log and track flight history</p>
          <a href="/operator/flight-records" className="text-cyan-500 hover:text-cyan-400 text-sm font-medium">
            View Records →
          </a>
        </div>

        <div className="glass p-6 rounded-lg text-center">
          <Fuel className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Fuel Tracking</h3>
          <p className="text-slate-400 text-sm mb-4">Track fuel consumption and costs</p>
          <a href="/operator/fuel-records" className="text-green-500 hover:text-green-400 text-sm font-medium">
            View Fuel Records →
          </a>
        </div>

        <div className="glass p-6 rounded-lg text-center">
          <MapPin className="h-12 w-12 text-purple-500 mx-auto mb-3" />
          <h3 className="text-white font-semibold mb-2">Live Tracking</h3>
          <p className="text-slate-400 text-sm mb-4">Track aircraft in real-time on map</p>
          <a href="/operator/live-tracking" className="text-purple-500 hover:text-purple-400 text-sm font-medium">
            Open Map →
          </a>
        </div>
      </div>

      {/* Document Expiry Alerts */}
      <div className="mt-8">
        <DocumentExpiryAlerts />
      </div>
    </div>
  );
}

export default OperatorHome;