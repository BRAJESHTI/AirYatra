import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, Navigation, Users, Clock, Calendar, RefreshCw,
  Loader2, Battery, Signal, Car, CheckCircle, AlertTriangle,
  Phone, User, Target, Route, Eye, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function LiveTrackingDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeRoute, setEmployeeRoute] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [visits, setVisits] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadDashboard();
    
    // Auto refresh every 30 seconds
    let interval;
    if (autoRefresh) {
      interval = setInterval(loadDashboard, 30000);
    }
    
    return () => clearInterval(interval);
  }, [autoRefresh, selectedDate]);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/field-tracking/team-dashboard', {
        params: { date: selectedDate }
      });
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load tracking dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeRoute = async (employeeId) => {
    try {
      const response = await api.get(`/field-tracking/location/route/${employeeId}`, {
        params: { date: selectedDate }
      });
      setEmployeeRoute(response.data);
    } catch (error) {
      toast.error('Failed to load route');
    }
  };

  const loadEmployeeVisits = async (employeeId) => {
    try {
      const response = await api.get('/field-tracking/visits', {
        params: { employee_id: employeeId, date: selectedDate }
      });
      setVisits(response.data.visits || []);
    } catch (error) {
      console.error('Failed to load visits:', error);
    }
  };

  const selectEmployee = (emp) => {
    setSelectedEmployee(emp);
    loadEmployeeRoute(emp.employee_id);
    loadEmployeeVisits(emp.employee_id);
  };

  const getBatteryColor = (level) => {
    if (!level) return 'text-slate-400';
    if (level > 50) return 'text-green-400';
    if (level > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const visitStatusColors = {
    scheduled: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    completed: 'bg-green-500',
    cancelled: 'bg-red-500',
    no_show: 'bg-gray-500'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Navigation className="h-6 w-6 text-blue-400" />
            Live Field Tracking</h2>
          <p className="text-slate-400 mt-1">
            Track sales team locations and client visits in real-time
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800 border-slate-600 text-white w-40"
          />
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <Button onClick={loadDashboard} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Field Team</p>
              <p className="text-white text-2xl font-bold">{dashboard?.total_field_employees || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Target className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Visits</p>
              <p className="text-white text-2xl font-bold">{dashboard?.total_visits_today || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Completed</p>
              <p className="text-white text-2xl font-bold">{dashboard?.completed_visits || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">In Progress</p>
              <p className="text-white text-2xl font-bold">{dashboard?.in_progress_visits || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-white font-semibold">Field Employees</h3>
          </div>
          <div className="divide-y divide-slate-700 max-h-[500px] overflow-y-auto">
            {dashboard?.employees?.map((emp, idx) => (
              <div 
                key={idx}
                onClick={() => selectEmployee(emp)}
                className={`p-4 cursor-pointer transition hover:bg-slate-800/50 ${
                  selectedEmployee?.employee_id === emp.employee_id ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      emp.in_progress ? 'bg-yellow-500/20' : 'bg-slate-700'
                    }`}>
                      <User className={`h-5 w-5 ${emp.in_progress ? 'text-yellow-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{emp.employee_name}</p>
                      <p className="text-slate-400 text-xs flex items-center gap-2">
                        <span>{emp.visits_today} visits</span>
                        {emp.in_progress && (
                          <span className="text-yellow-400">• On visit</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {emp.battery_level && (
                      <div className={`flex items-center gap-1 ${getBatteryColor(emp.battery_level)}`}>
                        <Battery className="h-4 w-4" />
                        <span className="text-xs">{emp.battery_level}%</span>
                      </div>
                    )}
                    <p className="text-slate-500 text-xs mt-1">
                      {formatTime(emp.current_location?.last_update)}
                    </p>
                  </div>
                </div>
                {emp.current_location?.address && (
                  <p className="text-slate-400 text-xs mt-2 flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {emp.current_location.address}
                  </p>
                )}
              </div>
            ))}
            
            {(!dashboard?.employees || dashboard.employees.length === 0) && (
              <div className="p-8 text-center text-slate-400">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No field employees tracked today</p>
              </div>
            )}
          </div>
        </div>

        {/* Map Placeholder / Route Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map - Using placeholder since we can't use actual maps */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Route className="h-5 w-5 text-blue-400" />
                {selectedEmployee ? `Route: ${selectedEmployee.employee_name}` : 'Select an employee to view route'}
              </h3>
              {employeeRoute && (
                <span className="text-slate-400 text-sm">
                  {employeeRoute.route?.length || 0} location points • {(employeeRoute.route?.length || 0) > 0 ? 
                    `${((employeeRoute.route?.length || 0) * 0.5).toFixed(1)}km estimated` : ''}
                </span>
              )}
            </div>
            
            <div className="h-64 bg-slate-900/50 flex items-center justify-center">
              {selectedEmployee ? (
                employeeRoute?.route?.length > 0 ? (
                  <div className="text-center p-4">
                    <Navigation className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                    <p className="text-white font-medium">Route Tracked</p>
                    <p className="text-slate-400 text-sm">
                      {employeeRoute.route.length} locations recorded
                    </p>
                    <div className="mt-4 flex justify-center gap-4 text-sm">
                      <div className="bg-slate-800 px-3 py-2 rounded">
                        <p className="text-slate-400">Start</p>
                        <p className="text-green-400">{formatTime(employeeRoute.start_point?.time)}</p>
                      </div>
                      <div className="bg-slate-800 px-3 py-2 rounded">
                        <p className="text-slate-400">Last</p>
                        <p className="text-blue-400">{formatTime(employeeRoute.end_point?.time)}</p>
                      </div>
                    </div>
                    <p className="text-slate-500 text-xs mt-4">
                      💡 Integrate with Google Maps for visual route display
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No route data for this date</p>
                  </div>
                )
              ) : (
                <div className="text-center text-slate-400">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select an employee to view their route</p>
                </div>
              )}
            </div>
          </div>

          {/* Visits List */}
          {selectedEmployee && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-white font-semibold">
                  Today's Visits</h3>
              </div>
              <div className="divide-y divide-slate-700 max-h-[300px] overflow-y-auto">
                {visits.map((visit, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${visitStatusColors[visit.status]}`}></span>
                          <p className="text-white font-medium">{visit.client_name}</p>
                        </div>
                        <p className="text-slate-400 text-sm mt-1">{visit.client_address}</p>
                        <p className="text-slate-500 text-xs mt-2">
                          {visit.visit_type?.replace('_', ' ')} • {visit.scheduled_time || 'No time set'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs ${
                          visit.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          visit.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {visit.status}
                        </span>
                        {visit.duration_minutes && (
                          <p className="text-slate-400 text-xs mt-2">
                            {Math.round(visit.duration_minutes)} min
                          </p>
                        )}
                        {visit.distance_from_client && (
                          <p className={`text-xs mt-1 ${
                            visit.distance_from_client > 100 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {visit.distance_from_client}m from client
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {visits.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No visits scheduled for this date</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-200 font-medium">Mobile App Required for GPS Tracking</p>
          <p className="text-blue-200/70 text-sm mt-1">
            Field employees need to use the mobile app (PWA) to enable GPS tracking. 
            The app sends location updates every 5 minutes when on duty. 
            Auto check-in works when employee enters client's geofence (100m radius).
          </p>
        </div>
      </div>
    </div>
  );
}

export default LiveTrackingDashboard;
