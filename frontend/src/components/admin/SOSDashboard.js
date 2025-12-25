import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, MapPin, Clock, User, Shield, CheckCircle, XCircle, RefreshCw, Eye, Edit, Bell, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function SOSDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [updateModal, setUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({ status: '', notes: '' });

  useEffect(() => {
    loadData();
    // Poll for active alerts every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, alertsRes] = await Promise.all([
        api.get('/api/sos/admin/dashboard'),
        api.get('/api/sos/admin/active')
      ]);
      setDashboard(dashRes.data);
      setActiveAlerts(alertsRes.data.alerts || []);
    } catch (error) {
      console.error('Failed to load SOS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewAlertDetails = async (alertId) => {
    try {
      const res = await api.get(`/api/sos/admin/alert/${alertId}`);
      setSelectedAlert(res.data);
    } catch (error) {
      console.error('Failed to load alert details:', error);
    }
  };

  const openUpdateModal = (alert) => {
    setSelectedAlert(alert);
    setUpdateData({ status: alert.status, notes: '' });
    setUpdateModal(true);
  };

  const updateAlert = async () => {
    try {
      await api.put(`/api/sos/admin/alert/${selectedAlert.id}`, updateData);
      setUpdateModal(false);
      loadData();
    } catch (error) {
      console.error('Failed to update alert:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-red-500 animate-pulse';
      case 'acknowledged': return 'bg-yellow-500';
      case 'responding': return 'bg-blue-500';
      case 'resolved': return 'bg-green-500';
      case 'cancelled': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  const getEmergencyTypeIcon = (type) => {
    switch (type) {
      case 'medical': return '🏥';
      case 'mechanical': return '🔧';
      case 'weather': return '🌧️';
      case 'security': return '🔒';
      default: return '🚨';
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Siren className="h-6 w-6 mr-2 text-red-500" />
            Emergency SOS Dashboard
          </h1>
          <p className="text-slate-400">Real-time emergency alert monitoring and response</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Active Alert Banner */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <span className="text-red-400 font-semibold">
              {activeAlerts.length} ACTIVE EMERGENCY ALERT{activeAlerts.length > 1 ? 'S' : ''}
            </span>
          </div>
          <Button variant="destructive" size="sm" onClick={() => viewAlertDetails(activeAlerts[0].id)}>
            View Now
          </Button>
        </div>
      )}

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/50">
            <div className="flex items-center space-x-2 text-red-400 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">Active Alerts</span>
            </div>
            <p className="text-3xl font-bold text-white">{dashboard.active_alerts}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-blue-400 mb-2">
              <Bell className="h-5 w-5" />
              <span className="text-sm">Total Alerts</span>
            </div>
            <p className="text-2xl font-bold text-white">{dashboard.total_alerts}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-green-400 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">Resolved Today</span>
            </div>
            <p className="text-2xl font-bold text-white">{dashboard.resolved_today}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm">By Type</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(dashboard.type_breakdown || {}).map(([type, count]) => (
                <span key={type} className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                  {getEmergencyTypeIcon(type)} {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Active Alerts List */}
        <div className="col-span-2 bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Active Alerts</h2>
          </div>
          <div className="divide-y divide-slate-700">
            {activeAlerts.length > 0 ? activeAlerts.map(alert => (
              <div key={alert.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex space-x-3">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatusColor(alert.status)}`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">{alert.alert_number}</span>
                        <span className="text-lg">{getEmergencyTypeIcon(alert.emergency_type)}</span>
                      </div>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-slate-400">
                        <span className="flex items-center"><User className="h-3 w-3 mr-1" />{alert.user_name}</span>
                        <span className="flex items-center"><Phone className="h-3 w-3 mr-1" />{alert.user_phone || 'N/A'}</span>
                      </div>
                      {alert.message && (
                        <p className="text-slate-300 text-sm mt-2 bg-slate-900 p-2 rounded">
                          "{alert.message}"
                        </p>
                      )}
                      <p className="text-slate-500 text-xs mt-2">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatTime(alert.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => viewAlertDetails(alert.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="default" className="bg-orange-500 hover:bg-orange-600" onClick={() => openUpdateModal(alert)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="text-slate-400">No active emergencies</p>
                <p className="text-slate-500 text-sm">All alerts have been resolved</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto">
            {dashboard?.recent_alerts?.map(alert => (
              <div key={alert.alert_number} className="p-3 hover:bg-slate-700/50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-white text-sm font-medium">{alert.alert_number}</p>
                    <p className="text-slate-400 text-xs">
                      {getEmergencyTypeIcon(alert.emergency_type)} {alert.emergency_type}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${alert.status === 'resolved' ? 'bg-green-500/20 text-green-400' : alert.status === 'active' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {alert.status}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-1">{formatTime(alert.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Emergency Contacts</h2>
        <div className="grid grid-cols-5 gap-4">
          {[
            { name: 'AirYatra Emergency', number: '1800-XXX-XXXX', icon: '🛫' },
            { name: 'Police', number: '100', icon: '👮' },
            { name: 'Ambulance', number: '102', icon: '🚑' },
            { name: 'DGCA Helpline', number: '011-2461-0243', icon: '✈️' },
            { name: 'Fire', number: '101', icon: '🚒' }
          ].map(contact => (
            <div key={contact.name} className="bg-slate-900 rounded-lg p-4 text-center">
              <span className="text-2xl">{contact.icon}</span>
              <p className="text-white font-medium mt-2">{contact.name}</p>
              <p className="text-orange-400 text-lg font-bold">{contact.number}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && !updateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedAlert.alert_number}</h3>
                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(selectedAlert.status).replace('animate-pulse', '')} text-white`}>
                  {selectedAlert.status?.toUpperCase()}
                </span>
              </div>
              <Button variant="ghost" onClick={() => setSelectedAlert(null)}>
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-slate-400 text-sm">User</p>
                  <p className="text-white">{selectedAlert.user_name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Phone</p>
                  <p className="text-white">{selectedAlert.user_phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Email</p>
                  <p className="text-white">{selectedAlert.user_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Emergency Type</p>
                  <p className="text-white">{getEmergencyTypeIcon(selectedAlert.emergency_type)} {selectedAlert.emergency_type}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-slate-400 text-sm">Location</p>
                  <p className="text-white">
                    {selectedAlert.current_location?.lat?.toFixed(4)}, {selectedAlert.current_location?.lon?.toFixed(4)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${selectedAlert.current_location?.lat},${selectedAlert.current_location?.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 text-sm hover:underline"
                  >
                    View on Map →
                  </a>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Created</p>
                  <p className="text-white">{formatTime(selectedAlert.created_at)}</p>
                </div>
                {selectedAlert.acknowledged_at && (
                  <div>
                    <p className="text-slate-400 text-sm">Acknowledged</p>
                    <p className="text-white">{formatTime(selectedAlert.acknowledged_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {selectedAlert.message && (
              <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                <p className="text-slate-400 text-sm mb-1">Message</p>
                <p className="text-white">"{selectedAlert.message}"</p>
              </div>
            )}

            {selectedAlert.booking_info && (
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-sm mb-2">Related Booking</p>
                <p className="text-white">{selectedAlert.booking_info.booking_number}</p>
                <p className="text-slate-300 text-sm">
                  {selectedAlert.booking_info.origin} → {selectedAlert.booking_info.destination}
                </p>
              </div>
            )}

            {selectedAlert.notes?.length > 0 && (
              <div className="mt-4">
                <p className="text-slate-400 text-sm mb-2">Notes</p>
                {selectedAlert.notes.map((note, idx) => (
                  <div key={idx} className="p-2 bg-slate-900 rounded mb-2">
                    <p className="text-white text-sm">{note.text}</p>
                    <p className="text-slate-500 text-xs mt-1">By {note.by_name} • {formatTime(note.at)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <Button onClick={() => openUpdateModal(selectedAlert)} className="bg-orange-500 hover:bg-orange-600">
                Update Status
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {updateModal && selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Update Alert: {selectedAlert.alert_number}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm">Status</label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="active">Active</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="responding">Responding</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              
              <div>
                <label className="text-slate-400 text-sm">Add Notes</label>
                <textarea
                  value={updateData.notes}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  rows="3"
                  placeholder="Add notes about the response..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => { setUpdateModal(false); setSelectedAlert(null); }}>Cancel</Button>
              <Button onClick={updateAlert} className="bg-orange-500 hover:bg-orange-600">Update Alert</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SOSDashboard;
