import React, { useState, useEffect } from 'react';
import { 
  User, AlertTriangle, CheckCircle, Clock, Plane, Calendar,
  Shield, TrendingUp, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  Phone, FileText, Activity, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function PilotDutyTracker() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [expandedPilot, setExpandedPilot] = useState(null);

  useEffect(() => {
    loadDutyStatus();
  }, []);

  const loadDutyStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/dgca/operator/pilots/duty-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      setData(json);
    } catch (error) {
      toast.error('Failed to load duty status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ok':
        return (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> OK
          </span>
        );
      case 'watch':
        return (
          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium flex items-center gap-1">
            <AlertCircle className="h-4 w-4" /> WATCH
          </span>
        );
      case 'over':
        return (
          <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> OVER
          </span>
        );
      default:
        return null;
    }
  };

  const getProgressColor = (percent) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" />
            Pilot Duty Tracker</h2>
          <p className="text-slate-400 mt-1">DGCA FDTL Compliance Dashboard</p>
        </div>
        <Button onClick={loadDutyStatus} variant="outline" className="border-slate-600">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
          <User className="h-6 w-6 text-blue-400 mb-2" />
          <p className="text-3xl font-bold text-white">{data?.summary?.total || 0}</p>
          <p className="text-slate-400 text-sm">Total Pilots</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
          <CheckCircle className="h-6 w-6 text-green-400 mb-2" />
          <p className="text-3xl font-bold text-green-400">{data?.summary?.ok || 0}</p>
          <p className="text-slate-400 text-sm">OK Status</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-xl p-4 border border-yellow-500/30">
          <AlertCircle className="h-6 w-6 text-yellow-400 mb-2" />
          <p className="text-3xl font-bold text-yellow-400">{data?.summary?.watch || 0}</p>
          <p className="text-slate-400 text-sm">Watch Status</p>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl p-4 border border-red-500/30">
          <AlertTriangle className="h-6 w-6 text-red-400 mb-2" />
          <p className="text-3xl font-bold text-red-400">{data?.summary?.over || 0}</p>
          <p className="text-slate-400 text-sm">Over Limit</p>
        </div>
      </div>

      {/* DGCA Limits Reference */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-400" />
          DGCA FDTL Limits / DGCA        </h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400">Daily Max</p>
            <p className="text-white font-bold">{data?.dgca_limits?.max_flight_time_daily || 8} hours</p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400">Weekly Max</p>
            <p className="text-white font-bold">{data?.dgca_limits?.max_flight_time_weekly || 30} hours</p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400">Monthly Max</p>
            <p className="text-white font-bold">{data?.dgca_limits?.max_flight_time_monthly || 100} hours</p>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400">Min Rest</p>
            <p className="text-white font-bold">{data?.dgca_limits?.min_rest_period || 10} hours</p>
          </div>
        </div>
      </div>

      {/* Pilots List */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-400" />
            Pilot Duty Status</h3>
        </div>

        {data?.pilots?.length > 0 ? (
          <div className="divide-y divide-slate-700">
            {data.pilots.map((pilot) => (
              <div key={pilot.pilot_id} className="bg-slate-900/30">
                {/* Main Row */}
                <div 
                  className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${
                    pilot.status === 'over' ? 'border-l-4 border-red-500' :
                    pilot.status === 'watch' ? 'border-l-4 border-yellow-500' :
                    'border-l-4 border-green-500'
                  }`}
                  onClick={() => setExpandedPilot(expandedPilot === pilot.pilot_id ? null : pilot.pilot_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        pilot.status === 'over' ? 'bg-red-500/20' :
                        pilot.status === 'watch' ? 'bg-yellow-500/20' :
                        'bg-green-500/20'
                      }`}>
                        <User className={`h-6 w-6 ${
                          pilot.status === 'over' ? 'text-red-400' :
                          pilot.status === 'watch' ? 'text-yellow-400' :
                          'text-green-400'
                        }`} />
                      </div>
                      <div>
                        <p className="text-white font-semibold">{pilot.name}</p>
                        <p className="text-slate-500 text-sm">License: {pilot.license_number || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {/* Monthly Hours Progress */}
                      <div className="text-right">
                        <p className="text-slate-400 text-xs mb-1">Monthly Hours</p>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-3 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${getProgressColor(pilot.usage_percent)}`}
                              style={{ width: `${Math.min(100, pilot.usage_percent)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${
                            pilot.usage_percent >= 90 ? 'text-red-400' :
                            pilot.usage_percent >= 70 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {pilot.hours?.monthly || 0}h / {pilot.limits?.monthly || 100}h
                          </span>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      {getStatusBadge(pilot.status)}
                      
                      {/* Can Fly Badge */}
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        pilot.can_fly ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pilot.can_fly ? '✓ Can Fly' : '✗ Grounded'}
                      </div>
                      
                      {/* Expand Icon */}
                      {expandedPilot === pilot.pilot_id ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedPilot === pilot.pilot_id && (
                  <div className="p-4 bg-slate-800/30 border-t border-slate-700">
                    <div className="grid grid-cols-3 gap-6">
                      {/* Hours Breakdown */}
                      <div>
                        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                          <Timer className="h-4 w-4 text-blue-400" />
                          Flight Hours</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                            <span className="text-slate-400">Daily</span>
                            <span className={`font-bold ${
                              pilot.hours?.daily > pilot.limits?.daily * 0.9 ? 'text-red-400' : 'text-white'
                            }`}>
                              {pilot.hours?.daily || 0}h / {pilot.limits?.daily || 8}h
                            </span>
                          </div>
                          <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                            <span className="text-slate-400">Weekly</span>
                            <span className={`font-bold ${
                              pilot.hours?.weekly > pilot.limits?.weekly * 0.9 ? 'text-red-400' : 'text-white'
                            }`}>
                              {pilot.hours?.weekly || 0}h / {pilot.limits?.weekly || 30}h
                            </span>
                          </div>
                          <div className="flex justify-between p-2 bg-slate-900/50 rounded">
                            <span className="text-slate-400">Yearly</span>
                            <span className="text-white font-bold">
                              {pilot.hours?.yearly || 0}h / {pilot.limits?.yearly || 1000}h
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Last Flight & Rest */}
                      <div>
                        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                          <Plane className="h-4 w-4 text-orange-400" />
                          Last Flight</h4>
                        <div className="space-y-2">
                          <div className="p-3 bg-slate-900/50 rounded">
                            <p className="text-slate-400 text-xs">Date</p>
                            <p className="text-white">{pilot.last_flight?.date || 'No recent flight'}</p>
                          </div>
                          <div className="p-3 bg-slate-900/50 rounded">
                            <p className="text-slate-400 text-xs">Route</p>
                            <p className="text-white">{pilot.last_flight?.route || 'N/A'}</p>
                          </div>
                          <div className="p-3 bg-slate-900/50 rounded">
                            <p className="text-slate-400 text-xs">Rest Since Duty</p>
                            <p className={`font-bold ${
                              pilot.rest_hours_since_duty && pilot.rest_hours_since_duty < pilot.min_rest_required
                                ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {pilot.rest_hours_since_duty ? `${pilot.rest_hours_since_duty}h` : 'N/A'}
                              <span className="text-slate-500 font-normal text-sm ml-1">
                                (min {pilot.min_rest_required}h required)
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Violations & Warnings */}
                      <div>
                        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          Alerts</h4>
                        <div className="space-y-2">
                          {pilot.violations?.length > 0 ? (
                            pilot.violations.map((v, i) => (
                              <div key={i} className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                                ⚠️ {v}
                              </div>
                            ))
                          ) : pilot.warnings?.length > 0 ? (
                            pilot.warnings.map((w, i) => (
                              <div key={i} className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
                                ⚡ {w}
                              </div>
                            ))
                          ) : (
                            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-center">
                              ✓ No violations or warnings
                            </div>
                          )}
                        </div>
                        
                        {/* Contact */}
                        {pilot.phone && (
                          <div className="mt-3 p-2 bg-slate-900/50 rounded flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-400">{pilot.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <User className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No pilots found</p>
            <p className="text-slate-500 text-sm">Add pilots in Pilot Management section</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PilotDutyTracker;
