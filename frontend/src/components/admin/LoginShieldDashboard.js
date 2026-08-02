/**
 * Login Shield AI™ Dashboard
 * Security monitoring and risk analysis for Admin/CEO/HR panels
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, Activity, Users, Lock, Unlock,
  Eye, CheckCircle, XCircle, Clock, Globe, Smartphone,
  TrendingUp, TrendingDown, RefreshCw, ChevronRight,
  AlertCircle, Ban, UserX, FileText
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Risk level colors
const riskColors = {
  LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const riskBgColors = {
  LOW: 'bg-green-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

// Format time ago
const timeAgo = (dateStr) => {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateStr;
  }
};

export default function LoginShieldDashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [highRiskLogins, setHighRiskLogins] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [statsRes, alertsRes, loginsRes, incidentsRes] = await Promise.all([
        fetch(`${API_URL}/api/auth/login-shield/stats`, { headers }),
        fetch(`${API_URL}/api/auth/login-shield/alerts?limit=20`, { headers }),
        fetch(`${API_URL}/api/auth/login-shield/high-risk-logins?hours=24`, { headers }),
        fetch(`${API_URL}/api/auth/login-shield/incidents?status=open`, { headers }),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (alertsRes.ok) {
        const alertData = await alertsRes.json();
        setAlerts(alertData.alerts || []);
      }
      if (loginsRes.ok) {
        const loginData = await loginsRes.json();
        setHighRiskLogins(loginData.logins || []);
      }
      if (incidentsRes.ok) {
        const incidentData = await incidentsRes.json();
        setIncidents(incidentData.incidents || []);
      }
    } catch (error) {
      console.error('Failed to load Login Shield data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMarkAlertRead = async (alertId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/login-shield/alerts/${alertId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
        toast.success('Alert marked as read');
      }
    } catch (error) {
      toast.error('Failed to update alert');
    }
  };

  const handleResolveIncident = async (incidentId) => {
    const resolution = window.prompt('Enter resolution notes:');
    if (!resolution) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/login-shield/incidents/${incidentId}/resolve`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolution })
      });

      if (res.ok) {
        setIncidents(incidents.filter(i => i.id !== incidentId));
        toast.success('Incident resolved');
      }
    } catch (error) {
      toast.error('Failed to resolve incident');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const unreadAlerts = alerts.filter(a => !a.is_read).length;

  return (
    <div className="space-y-6" data-testid="login-shield-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Login Shield AI™</h2>
            <p className="text-slate-400 text-sm">Real-time security monitoring & threat detection</p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Logins (24h)</p>
                  <p className="text-2xl font-bold text-white">{stats.total_logins}</p>
                </div>
                <Activity className="h-8 w-8 text-green-400 opacity-50" />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-green-400">{stats.success_rate}% success</span>
                <span className="text-slate-500">|</span>
                <span className="text-red-400">{stats.failed_logins} failed</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Blocked Logins</p>
                  <p className="text-2xl font-bold text-red-400">{stats.blocked_logins}</p>
                </div>
                <Ban className="h-8 w-8 text-red-400 opacity-50" />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                High-risk attempts blocked
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Open Incidents</p>
                  <p className={`text-2xl font-bold ${stats.open_incidents > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                    {stats.open_incidents}
                  </p>
                </div>
                <AlertTriangle className={`h-8 w-8 ${stats.open_incidents > 0 ? 'text-orange-400' : 'text-green-400'} opacity-50`} />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Requiring investigation
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Suspicious IPs</p>
                  <p className={`text-2xl font-bold ${stats.suspicious_ips > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {stats.suspicious_ips}
                  </p>
                </div>
                <Globe className="h-8 w-8 text-yellow-400 opacity-50" />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                IPs with 3+ failed attempts
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk Level Breakdown */}
      {stats && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Risk Distribution (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {Object.entries(stats.risk_breakdown || {}).map(([level, count]) => (
                <div key={level} className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400 capitalize">{level}</span>
                    <span className="text-white font-semibold">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${riskBgColors[level.toUpperCase()] || 'bg-slate-500'} rounded-full transition-all`}
                      style={{ width: `${Math.min((count / Math.max(stats.total_logins, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            High Risk Logins
          </TabsTrigger>
          <TabsTrigger 
            value="alerts" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white relative"
          >
            Alerts
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="incidents" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white relative"
          >
            Incidents
            {incidents.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                {incidents.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* High Risk Logins Tab */}
        <TabsContent value="overview" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                High Risk Login Attempts (24h)
              </CardTitle>
              <CardDescription className="text-slate-400">
                Login attempts with MEDIUM or higher risk scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {highRiskLogins.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-green-400 font-medium">All Clear!</p>
                  <p className="text-slate-500 text-sm">No high-risk login attempts detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {highRiskLogins.slice(0, 10).map((login, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 rounded-lg border ${riskColors[login.level]} bg-opacity-10`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge className={riskColors[login.level]}>
                            {login.level} ({login.score})
                          </Badge>
                          <span className="text-white font-medium">{login.email}</span>
                        </div>
                        <span className="text-slate-400 text-sm">{timeAgo(login.assessed_at)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {login.ip_address}
                        </span>
                        {login.location && (
                          <span className="flex items-center gap-1">
                            📍 {login.location.city}, {login.location.country}
                            {login.location.is_proxy && <span className="text-yellow-400 ml-1">(VPN)</span>}
                            {login.location.is_hosting && <span className="text-orange-400 ml-1">(Datacenter)</span>}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {login.action?.type === 'block' ? (
                            <XCircle className="h-3 w-3 text-red-400" />
                          ) : login.action?.type === 'alert' ? (
                            <AlertCircle className="h-3 w-3 text-orange-400" />
                          ) : (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          )}
                          {login.action?.type}
                        </span>
                      </div>
                      {login.factors && login.factors.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {login.factors.filter(f => f.score > 0).map((factor, fIdx) => (
                            <span key={fIdx} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                              {factor.detail}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Security Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-green-400 font-medium">No Alerts</p>
                  <p className="text-slate-500 text-sm">System is running smoothly</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        alert.is_read 
                          ? 'bg-slate-700/30 border-slate-600' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {!alert.is_read && (
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          )}
                          <span className="text-white font-medium">{alert.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-sm">{timeAgo(alert.created_at)}</span>
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAlertRead(alert.id)}
                              className="text-slate-400 hover:text-white"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm">{alert.message}</p>
                      {alert.details && (
                        <div className="mt-2 text-xs text-slate-500">
                          <span>Risk Score: {alert.details.risk_score}</span>
                          <span className="mx-2">|</span>
                          <span>IP: {alert.details.ip_address}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incidents Tab */}
        <TabsContent value="incidents" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                Open Security Incidents
              </CardTitle>
              <CardDescription className="text-slate-400">
                Critical security events requiring investigation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-green-400 font-medium">No Open Incidents</p>
                  <p className="text-slate-500 text-sm">All security incidents have been resolved</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((incident, idx) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-lg border border-red-500/30 bg-red-500/10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            {incident.severity?.toUpperCase()}
                          </Badge>
                          <span className="text-white font-medium">{incident.type}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolveIncident(incident.id)}
                          className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      </div>
                      <p className="text-slate-400 text-sm">User: {incident.email}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>IP: {incident.ip_address}</span>
                        <span>Created: {timeAgo(incident.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
