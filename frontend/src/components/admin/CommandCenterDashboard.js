import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Plane, AlertTriangle, Shield, Clock, RefreshCw, 
  Bell, Users, DollarSign, Radio, Eye, CheckCircle, XCircle,
  MapPin, Wifi, Heart, Zap, TrendingUp, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function CommandCenterDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/command-center/dashboard`);
      const result = await response.json();
      setData(result);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch command center data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    
    // Auto refresh every 30 seconds
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchDashboard, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchDashboard, autoRefresh]);

  const acknowledgeWarning = async (warningId) => {
    try {
      await fetch(`${API_URL}/api/command-center/ai-warning/${warningId}/acknowledge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: 'admin' })
      });
      toast.success('Warning acknowledged');
      fetchDashboard();
    } catch (error) {
      toast.error('Failed to acknowledge warning');
    }
  };

  const resolveSOS = async (alertId) => {
    try {
      await fetch(`${API_URL}/api/command-center/sos-alert/${alertId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_by: 'admin', resolution_notes: 'Resolved from Command Center' })
      });
      toast.success('SOS Alert resolved');
      fetchDashboard();
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const systemHealth = data?.system_health || {};

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl">
            <Radio className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Command Center</h1>
            <p className="text-slate-400">24×7 Real-Time Monitoring Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
            {lastUpdate && `Last updated: ${lastUpdate.toLocaleTimeString()}`}
          </div>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Wifi className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button onClick={fetchDashboard} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard 
          icon={Plane} 
          label="Active Flights" 
          value={stats.active_flights || 0} 
          color="text-blue-400"
          bgColor="bg-blue-500/20"
        />
        <StatCard 
          icon={Clock} 
          label="Bookings Today" 
          value={stats.total_bookings_today || 0} 
          color="text-green-400"
          bgColor="bg-green-500/20"
        />
        <StatCard 
          icon={Shield} 
          label="Pending Approvals" 
          value={stats.pending_approvals || 0} 
          color="text-orange-400"
          bgColor="bg-orange-500/20"
        />
        <StatCard 
          icon={AlertTriangle} 
          label="SOS Alerts" 
          value={stats.sos_alerts_24h || 0} 
          color="text-red-400"
          bgColor="bg-red-500/20"
          pulse={stats.sos_alerts_24h > 0}
        />
        <StatCard 
          icon={Users} 
          label="Active Operators" 
          value={stats.active_operators || 0} 
          color="text-purple-400"
          bgColor="bg-purple-500/20"
        />
        <StatCard 
          icon={Users} 
          label="Active Pilots" 
          value={stats.active_pilots || 0} 
          color="text-cyan-400"
          bgColor="bg-cyan-500/20"
        />
        <StatCard 
          icon={DollarSign} 
          label="Revenue Today" 
          value={`₹${((stats.revenue_today || 0) / 100000).toFixed(1)}L`} 
          color="text-yellow-400"
          bgColor="bg-yellow-500/20"
        />
        <StatCard 
          icon={Eye} 
          label="Online Users" 
          value={stats.customers_online || 0} 
          color="text-pink-400"
          bgColor="bg-pink-500/20"
        />
      </div>

      {/* System Health */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-400" />
          System Health
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(systemHealth).map(([service, status]) => (
            <div key={service} className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg">
              {status === 'healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-slate-300 text-sm capitalize">{service.replace('_', ' ')}</span>
              <Badge variant={status === 'healthy' ? 'default' : 'destructive'} className="text-xs">
                {status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Live Flights */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="bg-blue-500/10 border-b border-slate-800 p-4 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Plane className="h-5 w-5 text-blue-400" />
              Live Flights ({data?.live_flights?.length || 0})
            </h3>
            <Badge className="bg-blue-500">{data?.live_flights?.length || 0} Active</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {(data?.live_flights || []).length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Plane className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No active flights</p>
              </div>
            ) : (
              data.live_flights.map((flight, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {flight.origin || 'N/A'} → {flight.destination || 'N/A'}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {flight.operator_name || 'Unknown Operator'} • {flight.pilot_name || 'Pilot TBA'}
                      </p>
                    </div>
                    <Badge className={
                      flight.status === 'in_progress' ? 'bg-green-500' :
                      flight.status === 'boarding' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }>
                      {flight.status?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="bg-orange-500/10 border-b border-slate-800 p-4 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-400" />
              Pending Approvals ({data?.pending_approvals?.length || 0})
            </h3>
            <Badge className="bg-orange-500">{data?.pending_approvals?.length || 0} Pending</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {(data?.pending_approvals || []).length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Shield className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No pending approvals</p>
              </div>
            ) : (
              data.pending_approvals.map((approval, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{approval.action_type || 'Action'}</p>
                      <p className="text-slate-400 text-sm">
                        By {approval.requester_name || 'Unknown'} • {approval.reason || 'No reason'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8">
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-8">
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SOS Alerts */}
        <div className="bg-slate-900 border border-red-500/50 rounded-xl overflow-hidden">
          <div className="bg-red-500/10 border-b border-slate-800 p-4 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />
              SOS Alerts (24h)
            </h3>
            <Badge variant="destructive">{data?.sos_alerts?.length || 0} Alerts</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {(data?.sos_alerts || []).length === 0 ? (
              <div className="p-8 text-center text-green-400">
                <CheckCircle className="h-10 w-10 mx-auto mb-2" />
                <p>No active SOS alerts</p>
              </div>
            ) : (
              data.sos_alerts.map((alert, idx) => (
                <div key={idx} className="p-4 bg-red-500/5 hover:bg-red-500/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-red-400 font-bold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {alert.type?.toUpperCase()} - {alert.severity?.toUpperCase()}
                      </p>
                      <p className="text-white mt-1">{alert.message}</p>
                      {alert.location && (
                        <p className="text-slate-400 text-sm mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {alert.location}
                        </p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => resolveSOS(alert._id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Warnings */}
        <div className="bg-slate-900 border border-yellow-500/50 rounded-xl overflow-hidden">
          <div className="bg-yellow-500/10 border-b border-slate-800 p-4 flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              AI Warnings
            </h3>
            <Badge className="bg-yellow-500 text-black">{data?.ai_warnings?.length || 0} Active</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
            {(data?.ai_warnings || []).length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Zap className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No AI warnings</p>
              </div>
            ) : (
              data.ai_warnings.map((warning, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-800/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-yellow-400 font-medium">{warning.title}</p>
                      <p className="text-slate-400 text-sm mt-1">{warning.description}</p>
                      {warning.recommended_action && (
                        <p className="text-green-400 text-sm mt-2">
                          💡 {warning.recommended_action}
                        </p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => acknowledgeWarning(warning._id)}
                    >
                      Acknowledge
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bgColor, pulse }) {
  return (
    <div className={`${bgColor} border border-slate-700 rounded-xl p-4 ${pulse ? 'animate-pulse' : ''}`}>
      <Icon className={`h-6 w-6 ${color} mb-2`} />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-xs">{label}</p>
    </div>
  );
}

export default CommandCenterDashboard;
