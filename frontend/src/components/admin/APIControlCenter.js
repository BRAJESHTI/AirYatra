import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Shield, CreditCard, MessageSquare, Mail, Map, Cloud,
  Building2, Brain, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, Activity, Clock, IndianRupee, Zap,
  ChevronDown, ChevronUp, History, AlertOctagon, Loader2, Search,
  Server, Wifi, WifiOff, Globe, Lock, Unlock, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * API Control Center - Centralized API Management
 * Game Changer Feature for AirYatra OS
 */
const APIControlCenter = () => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [healthChecking, setHealthChecking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/api-control/admin/dashboard`, authHeaders);
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load API dashboard:', error);
      // Auto-initialize if not found
      if (error.response?.status === 404 || !dashboard) {
        try {
          await axios.post(`${API_URL}/api/api-control/admin/initialize`, {}, authHeaders);
          const response = await axios.get(`${API_URL}/api/api-control/admin/dashboard`, authHeaders);
          setDashboard(response.data);
          toast.success('API Control Center initialized!');
        } catch (e) {
          toast.error('Failed to initialize API Control Center');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const toggleAPI = async (apiId) => {
    try {
      await axios.post(`${API_URL}/api/api-control/admin/apis/${apiId}/toggle`, {}, authHeaders);
      toast.success('API toggled');
      loadDashboard();
    } catch (error) {
      toast.error('Failed to toggle API');
    }
  };

  const switchMode = async (apiId, newMode) => {
    try {
      await axios.post(`${API_URL}/api/api-control/admin/apis/${apiId}/mode?mode=${newMode}`, {}, authHeaders);
      toast.success(`Mode switched to ${newMode}`);
      loadDashboard();
    } catch (error) {
      toast.error('Failed to switch mode');
    }
  };

  const checkAllHealth = async () => {
    try {
      setHealthChecking(true);
      await axios.post(`${API_URL}/api/api-control/admin/health-check-all`, {}, authHeaders);
      toast.success('Health check complete!');
      loadDashboard();
    } catch (error) {
      toast.error('Health check failed');
    } finally {
      setHealthChecking(false);
    }
  };

  const setEmergencyOverride = async (apiId, status, fallbackMode) => {
    try {
      await axios.post(`${API_URL}/api/api-control/admin/emergency-override`, {
        api_id: apiId,
        new_status: status,
        fallback_mode: fallbackMode,
        reason: `Emergency override to ${status}`
      }, authHeaders);
      toast.success('Emergency override set');
      loadDashboard();
    } catch (error) {
      toast.error('Failed to set override');
    }
  };

  const categories = [
    { id: 'all', label: 'All APIs', icon: <Globe className="h-4 w-4" /> },
    { id: 'payment', label: 'Payment', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'verification', label: 'Verification', icon: <Shield className="h-4 w-4" /> },
    { id: 'messaging', label: 'Messaging', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
    { id: 'maps', label: 'Maps', icon: <Map className="h-4 w-4" /> },
    { id: 'weather', label: 'Weather', icon: <Cloud className="h-4 w-4" /> },
    { id: 'finance', label: 'AI/Finance', icon: <Brain className="h-4 w-4" /> },
  ];

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      down: 'bg-red-500/20 text-red-400 border-red-500/30',
      disabled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      maintenance: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    };
    return colors[status] || colors.disabled;
  };

  const getStatusIcon = (status) => {
    const icons = {
      active: <CheckCircle className="h-4 w-4 text-green-400" />,
      degraded: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
      down: <XCircle className="h-4 w-4 text-red-400" />,
      disabled: <WifiOff className="h-4 w-4 text-slate-400" />,
      maintenance: <Settings className="h-4 w-4 text-orange-400 animate-spin" />
    };
    return icons[status] || icons.disabled;
  };

  const filteredAPIs = dashboard?.apis?.filter(api => {
    const matchesCategory = selectedCategory === 'all' || api.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      api.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="api-control-center">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="h-6 w-6 text-orange-500" />
            API Control Center / API नियंत्रण केंद्र
          </h2>
          <p className="text-slate-400 text-sm">
            Manage all APIs • Monitor health • Emergency override
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={checkAllHealth}
            disabled={healthChecking}
          >
            {healthChecking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            Health Check All
          </Button>
          <Button variant="outline" onClick={loadDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {dashboard?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard icon={<Globe />} label="Total APIs" value={dashboard.stats.total_apis} color="blue" />
          <StatCard icon={<CheckCircle />} label="Active" value={dashboard.stats.active} color="green" />
          <StatCard icon={<AlertTriangle />} label="Degraded" value={dashboard.stats.degraded} color="yellow" />
          <StatCard icon={<XCircle />} label="Down" value={dashboard.stats.down} color="red" />
          <StatCard icon={<WifiOff />} label="Disabled" value={dashboard.stats.disabled} color="slate" />
          <StatCard icon={<Zap />} label="Calls Today" value={dashboard.stats.calls_today} color="purple" />
          <StatCard icon={<IndianRupee />} label="Cost Today" value={`₹${dashboard.stats.cost_today}`} color="orange" />
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className={selectedCategory === cat.id ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            {cat.icon}
            <span className="ml-2">{cat.label}</span>
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search APIs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {/* API Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAPIs.map(api => (
          <APICard
            key={api.api_id}
            api={api}
            onToggle={() => toggleAPI(api.api_id)}
            onModeSwitch={(mode) => switchMode(api.api_id, mode)}
            onEmergencyOverride={(status, mode) => setEmergencyOverride(api.api_id, status, mode)}
            getStatusColor={getStatusColor}
            getStatusIcon={getStatusIcon}
          />
        ))}
      </div>

      {/* Recent Audit Logs */}
      {dashboard?.recent_logs?.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <History className="h-5 w-5 text-orange-500" />
              Recent API Changes / हाल के बदलाव
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {dashboard.recent_logs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-800 rounded text-sm">
                  <div>
                    <span className="text-white font-medium">{log.api_id}</span>
                    <span className="text-slate-400 ml-2">• {log.action}</span>
                  </div>
                  <div className="text-slate-500 text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-400',
    green: 'from-green-500/20 to-green-600/10 text-green-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 text-yellow-400',
    red: 'from-red-500/20 to-red-600/10 text-red-400',
    slate: 'from-slate-500/20 to-slate-600/10 text-slate-400',
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-400',
    orange: 'from-orange-500/20 to-orange-600/10 text-orange-400'
  };

  return (
    <div className={`p-3 rounded-lg bg-gradient-to-br ${colors[color]} border border-slate-700`}>
      <div className="flex items-center gap-2 mb-1">
        {React.cloneElement(icon, { className: 'h-4 w-4' })}
        <span className="text-slate-400 text-xs">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
};

// API Card Component
const APICard = ({ api, onToggle, onModeSwitch, onEmergencyOverride, getStatusColor, getStatusIcon }) => {
  const [expanded, setExpanded] = useState(false);

  const getCategoryIcon = (category) => {
    const icons = {
      payment: <CreditCard className="h-5 w-5" />,
      verification: <Shield className="h-5 w-5" />,
      messaging: <MessageSquare className="h-5 w-5" />,
      email: <Mail className="h-5 w-5" />,
      maps: <Map className="h-5 w-5" />,
      weather: <Cloud className="h-5 w-5" />,
      finance: <Brain className="h-5 w-5" />
    };
    return icons[category] || <Globe className="h-5 w-5" />;
  };

  return (
    <Card className={`bg-slate-900 border-slate-700 ${api.emergency_override ? 'ring-2 ring-red-500' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${api.is_enabled ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'}`}>
              {getCategoryIcon(api.category)}
            </div>
            <div>
              <CardTitle className="text-white text-lg">{api.name}</CardTitle>
              <p className="text-slate-500 text-xs">{api.provider}</p>
            </div>
          </div>
          <Switch
            checked={api.is_enabled}
            onCheckedChange={onToggle}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge className={`${getStatusColor(api.health_status)} border`}>
            {getStatusIcon(api.health_status)}
            <span className="ml-1 capitalize">{api.health_status}</span>
          </Badge>
          <Badge variant="outline" className={api.mode === 'production' ? 'text-green-400 border-green-400' : 'text-yellow-400 border-yellow-400'}>
            {api.mode === 'production' ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
            {api.mode}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm">{api.description}</p>
        <p className="text-slate-500 text-xs">{api.description_hi}</p>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-slate-800 rounded">
            <div className="text-white font-medium">{api.calls_today || 0}</div>
            <div className="text-slate-500 text-xs">Today</div>
          </div>
          <div className="p-2 bg-slate-800 rounded">
            <div className="text-white font-medium">{api.daily_limit || '∞'}</div>
            <div className="text-slate-500 text-xs">Limit</div>
          </div>
          <div className="p-2 bg-slate-800 rounded">
            <div className="text-white font-medium">₹{api.cost_per_call || 0}</div>
            <div className="text-slate-500 text-xs">Per Call</div>
          </div>
        </div>

        {/* Response Time */}
        {api.last_response_time && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400">Response: {api.last_response_time}ms</span>
          </div>
        )}

        {/* Expand/Collapse */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-slate-400"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          {expanded ? 'Less Options' : 'More Options'}
        </Button>

        {/* Expanded Options */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-slate-700">
            {/* Mode Switch */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Mode</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={api.mode === 'sandbox' ? 'default' : 'outline'}
                  className={api.mode === 'sandbox' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                  onClick={() => onModeSwitch('sandbox')}
                >
                  Sandbox
                </Button>
                <Button
                  size="sm"
                  variant={api.mode === 'production' ? 'default' : 'outline'}
                  className={api.mode === 'production' ? 'bg-green-500 hover:bg-green-600' : ''}
                  onClick={() => onModeSwitch('production')}
                >
                  Production
                </Button>
              </div>
            </div>

            {/* Emergency Override */}
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-red-400 text-sm font-medium mb-2 flex items-center gap-1">
                <AlertOctagon className="h-4 w-4" />
                Emergency Override
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-400 border-green-400 hover:bg-green-500/10"
                  onClick={() => onEmergencyOverride('active', 'normal')}
                >
                  🟢 Normal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-yellow-400 border-yellow-400 hover:bg-yellow-500/10"
                  onClick={() => onEmergencyOverride('degraded', 'manual')}
                >
                  🟡 Manual
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-400 border-red-400 hover:bg-red-500/10"
                  onClick={() => onEmergencyOverride('disabled', 'disable')}
                >
                  🔴 Disable
                </Button>
              </div>
            </div>

            {/* Failover Provider */}
            {api.failover_provider && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Failover</span>
                <Badge variant="outline" className="text-blue-400 border-blue-400">
                  {api.failover_provider}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Emergency Override Badge */}
        {api.emergency_override && (
          <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-center">
            <span className="text-red-400 text-sm">⚠️ Emergency Override Active</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default APIControlCenter;
