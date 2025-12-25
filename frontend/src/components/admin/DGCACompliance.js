import React, { useState, useEffect } from 'react';
import { Shield, Clock, AlertTriangle, CheckCircle, User, Plane, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function DGCACompliance() {
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [limits, setLimits] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pilotSearch, setPilotSearch] = useState('');
  const [pilotCompliance, setPilotCompliance] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, alertsRes, limitsRes] = await Promise.all([
        api.get('/dgca/dashboard'),
        api.get('/dgca/alerts'),
        api.get('/dgca/limits')
      ]);
      setDashboard(dashRes.data);
      setAlerts(alertsRes.data.alerts || []);
      setLimits(limitsRes.data.limits || limitsRes.data || {});
    } catch (error) { 
      console.error('Failed to load DGCA data:', error); 
    }
    finally { setLoading(false); }
  };

  const checkPilotCompliance = async () => {
    if (!pilotSearch) return;
    try {
      const res = await api.get(`/dgca/pilot/${pilotSearch}/compliance`);
      setPilotCompliance(res.data);
    } catch (error) { alert('Pilot not found'); }
  };

  const getSeverityColor = (severity) => {
    return severity === 'critical' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Shield className="h-6 w-6 mr-2 text-blue-500" /> DGCA Compliance
          </h1>
          <p className="text-slate-400">Flight duty time & regulatory compliance</p>
        </div>
        <Button onClick={loadData} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {alerts.filter(a => a.severity === 'critical').length > 0 && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center">
          <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
          <p className="text-red-400 font-semibold">{alerts.filter(a => a.severity === 'critical').length} CRITICAL VIOLATIONS</p>
        </div>
      )}

      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/50">
            <AlertTriangle className="h-5 w-5 text-red-400 mb-2" />
            <p className="text-3xl font-bold text-white">{dashboard.alerts_summary?.critical || 0}</p>
            <p className="text-slate-400 text-sm">Critical</p>
          </div>
          <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/50">
            <Clock className="h-5 w-5 text-yellow-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.alerts_summary?.warnings || 0}</p>
            <p className="text-slate-400 text-sm">Warnings</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <Plane className="h-5 w-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.this_month?.total_flight_hours || 0}h</p>
            <p className="text-slate-400 text-sm">Flight Hours (Month)</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <User className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.this_month?.active_pilots || 0}</p>
            <p className="text-slate-400 text-sm">Active Pilots</p>
          </div>
        </div>
      )}

      <div className="flex space-x-4 border-b border-slate-700">
        {['dashboard', 'alerts', 'pilot_check', 'limits'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400'}`}>
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.map((alert, idx) => (
            <div key={idx} className={`rounded-lg p-4 border ${getSeverityColor(alert.severity)}`}>
              <div className="flex justify-between">
                <span className="font-medium">{alert.pilot_name}</span>
                <span className="text-xs uppercase font-bold">{alert.severity}</span>
              </div>
              {alert.messages?.map((msg, i) => <p key={i} className="text-sm mt-1">• {msg}</p>)}
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-slate-400">All pilots compliant!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pilot_check' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Check Pilot Compliance</h2>
            <div className="flex space-x-3">
              <Input placeholder="Pilot ID" value={pilotSearch} onChange={(e) => setPilotSearch(e.target.value)} className="bg-slate-700 flex-1" />
              <Button onClick={checkPilotCompliance} className="bg-blue-600">Check</Button>
            </div>
          </div>

          {pilotCompliance && (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Status</h2>
                <span className={`px-3 py-1 rounded-full ${pilotCompliance.is_compliant ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {pilotCompliance.is_compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                {['daily', 'weekly', 'monthly', 'yearly'].map(period => (
                  <div key={period} className="bg-slate-900 rounded-lg p-4 text-center">
                    <p className="text-slate-400 text-xs uppercase">{period}</p>
                    <p className="text-2xl font-bold text-white">{pilotCompliance.hours?.[period]?.total_hours || 0}h</p>
                    <p className="text-slate-500 text-xs">/ {limits[`max_flight_time_${period}`]}h</p>
                  </div>
                ))}
              </div>
              {pilotCompliance.violations?.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 font-medium">Violations:</p>
                  {pilotCompliance.violations.map((v, i) => <p key={i} className="text-red-300 text-sm">• {v}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'limits' && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">DGCA Limits</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(limits).map(([key, value]) => (
              <div key={key} className="flex justify-between p-3 bg-slate-900 rounded">
                <span className="text-slate-300 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && dashboard?.recent_alerts && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Alerts</h2>
          {dashboard.recent_alerts.slice(0, 5).map((alert, idx) => (
            <div key={idx} className={`p-3 mb-2 rounded border ${getSeverityColor(alert.severity)}`}>
              <div className="flex justify-between">
                <span className="font-medium">{alert.pilot_name}</span>
                <span className="text-xs uppercase">{alert.severity}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DGCACompliance;
