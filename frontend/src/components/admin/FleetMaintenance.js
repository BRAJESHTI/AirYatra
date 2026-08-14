import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, AlertTriangle, CheckCircle, Clock,
  Loader2, RefreshCw, Calendar, Package, FileText,
  Plane, Settings, Shield, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function FleetMaintenance() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [parts, setParts] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState({ status: '', type: '' });

  useEffect(() => {
    loadDashboard();
    loadSchedules();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/maintenance/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      
      const response = await api.get('/maintenance/schedule', { params });
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  };

  const loadParts = async () => {
    try {
      const response = await api.get('/maintenance/parts');
      setParts(response.data.parts || []);
    } catch (error) {
      console.error('Failed to load parts:', error);
    }
  };

  const loadCompliance = async () => {
    try {
      const response = await api.get('/maintenance/compliance');
      setCompliance(response.data.items || []);
    } catch (error) {
      console.error('Failed to load compliance:', error);
    }
  };

  const updateMaintenanceStatus = async (maintenanceId, status) => {
    try {
      await api.put(`/maintenance/schedule/${maintenanceId}`, { status });
      toast.success(`Maintenance ${status}`);
      loadSchedules();
      loadDashboard();
    } catch (error) {
      toast.error('Failed to update maintenance');
    }
  };

  const statusColors = {
    scheduled: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    completed: 'bg-green-500',
    cancelled: 'bg-red-500',
    valid: 'bg-green-500',
    expiring_soon: 'bg-yellow-500',
    expired: 'bg-red-500'
  };

  const priorityColors = {
    low: 'bg-slate-500',
    medium: 'bg-blue-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500'
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
            <Wrench className="h-6 w-6 text-orange-400" />
            Fleet Maintenance</h2>
          <p className="text-slate-400 mt-1">Aircraft maintenance scheduling, parts inventory & compliance</p>
        </div>
        <Button onClick={() => { loadDashboard(); loadSchedules(); }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Wrench },
          { id: 'schedules', label: 'Maintenance', icon: Calendar },
          { id: 'parts', label: 'Parts Inventory', icon: Package },
          { id: 'compliance', label: 'Compliance', icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { 
              setActiveTab(tab.id); 
              if (tab.id === 'parts') loadParts();
              if (tab.id === 'compliance') loadCompliance();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Alert Banner */}
          {(dashboard.overdue > 0 || dashboard.critical_priority > 0) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-200 font-medium">Attention Required</p>
                  <p className="text-red-200/70 text-sm">
                    {dashboard.overdue} overdue, {dashboard.critical_priority} critical maintenance items
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Upcoming</p>
                  <p className="text-white text-xl font-bold">{dashboard.upcoming_maintenance}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Wrench className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">In Progress</p>
                  <p className="text-yellow-400 text-xl font-bold">{dashboard.in_progress}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Overdue</p>
                  <p className="text-red-400 text-xl font-bold">{dashboard.overdue}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Critical</p>
                  <p className="text-orange-400 text-xl font-bold">{dashboard.critical_priority}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Package className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Low Stock Parts</p>
                  <p className="text-purple-400 text-xl font-bold">{dashboard.low_stock_parts}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Shield className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Expiring Docs</p>
                  <p className="text-green-400 text-xl font-bold">{dashboard.expiring_compliance}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Maintenance */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Recent Maintenance</h3>
            <div className="space-y-3">
              {dashboard.recent_maintenance?.map(item => (
                <div key={item.maintenance_number} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Plane className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-white font-medium">{item.aircraft_registration}</p>
                      <p className="text-slate-400 text-sm">{item.type} - {item.maintenance_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs text-white ${priorityColors[item.priority]}`}>
                      {item.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
              
              {(!dashboard.recent_maintenance || dashboard.recent_maintenance.length === 0) && (
                <p className="text-slate-400 text-center py-4">No maintenance records yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <select
                value={filters.status}
                onChange={(e) => { setFilters(f => ({...f, status: e.target.value})); setTimeout(loadSchedules, 100); }}
                className="bg-slate-800 border-slate-600 text-white rounded px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => { setFilters(f => ({...f, type: e.target.value})); setTimeout(loadSchedules, 100); }}
                className="bg-slate-800 border-slate-600 text-white rounded px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                <option value="scheduled">Scheduled</option>
                <option value="unscheduled">Unscheduled</option>
                <option value="inspection">Inspection</option>
                <option value="overhaul">Overhaul</option>
              </select>
            </div>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" /> Schedule Maintenance
            </Button>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Aircraft</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Type</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Scheduled Date</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Est. Cost</th>
                  <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Priority</th>
                  <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Status</th>
                  <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {schedules.map(schedule => (
                  <tr key={schedule.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{schedule.aircraft_registration}</p>
                      <p className="text-slate-500 text-xs">{schedule.maintenance_number}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300 capitalize">{schedule.type}</p>
                      <p className="text-slate-500 text-xs truncate max-w-[200px]">{schedule.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(schedule.scheduled_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-white">
                      ₹{schedule.estimated_cost?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs text-white ${priorityColors[schedule.priority]}`}>
                        {schedule.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[schedule.status]}`}>
                        {schedule.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {schedule.status === 'scheduled' && (
                          <Button size="sm" variant="ghost" onClick={() => updateMaintenanceStatus(schedule.id, 'in_progress')}>
                            <Wrench className="h-4 w-4" />
                          </Button>
                        )}
                        {schedule.status === 'in_progress' && (
                          <Button size="sm" variant="ghost" onClick={() => updateMaintenanceStatus(schedule.id, 'completed')}>
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {schedules.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No maintenance scheduled</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parts Inventory Tab */}
      {activeTab === 'parts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-purple-500 hover:bg-purple-600">
              <Plus className="h-4 w-4 mr-2" /> Add Part
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parts.map(part => (
              <div key={part.id} className={`bg-slate-800/50 rounded-xl p-4 border ${
                part.quantity <= part.min_quantity ? 'border-red-500/50' : 'border-slate-700'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">{part.name}</p>
                    <p className="text-slate-400 text-sm">{part.part_number}</p>
                  </div>
                  <span className="text-slate-500 text-xs bg-slate-700 px-2 py-1 rounded">
                    {part.category}
                  </span>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">In Stock</p>
                    <p className={`text-2xl font-bold ${
                      part.quantity <= part.min_quantity ? 'text-red-400' : 'text-white'
                    }`}>
                      {part.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">Unit Cost</p>
                    <p className="text-white font-semibold">₹{part.unit_cost?.toLocaleString()}</p>
                  </div>
                </div>
                
                {part.quantity <= part.min_quantity && (
                  <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    Low stock! Min: {part.min_quantity}
                  </div>
                )}
              </div>
            ))}
          </div>

          {parts.length === 0 && (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
              <Package className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <p className="text-white font-medium">No Parts in Inventory</p>
              <p className="text-slate-400 text-sm">Add parts to track inventory</p>
            </div>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-green-500 hover:bg-green-600">
              <Plus className="h-4 w-4 mr-2" /> Add Document
            </Button>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900">
                <tr>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Document</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Aircraft</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Issue Date</th>
                  <th className="text-left text-slate-400 text-sm font-medium px-4 py-3">Expiry Date</th>
                  <th className="text-center text-slate-400 text-sm font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {compliance.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium capitalize">{item.type?.replace('_', ' ')}</p>
                      <p className="text-slate-500 text-xs">{item.description}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {item.aircraft_id}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(item.issue_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(item.expiry_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[item.status]}`}>
                        {item.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {compliance.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No compliance documents</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FleetMaintenance;
