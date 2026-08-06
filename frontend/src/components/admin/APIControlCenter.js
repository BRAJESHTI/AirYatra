import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Shield, CreditCard, MessageSquare, Mail, Map, Cloud,
  Building2, Brain, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, Activity, Clock, IndianRupee, Zap,
  ChevronDown, ChevronUp, History, AlertOctagon, Loader2, Search,
  Server, Wifi, WifiOff, Globe, Lock, Unlock, TrendingUp, TrendingDown,
  Download, FileText, ArrowRightLeft, BarChart3, Calendar
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
  const [activeTab, setActiveTab] = useState('apis');
  const [costReport, setCostReport] = useState(null);
  const [failoverStatus, setFailoverStatus] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, failoverRes, recsRes] = await Promise.all([
        axios.get(`${API_URL}/api/api-control/admin/dashboard`, authHeaders).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/api-control/admin/failover/status`, authHeaders).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/api-control/admin/failover/recommendations`, authHeaders).catch(() => ({ data: { recommendations: [] } }))
      ]);
      
      setDashboard(dashRes.data);
      setFailoverStatus(failoverRes.data);
      setRecommendations(recsRes.data?.recommendations || []);
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

  // Load monthly cost report
  const loadCostReport = async (year, month) => {
    try {
      const now = new Date();
      const y = year || now.getFullYear();
      const m = month || (now.getMonth() + 1);
      const response = await axios.get(
        `${API_URL}/api/api-control/admin/cost-reports/monthly?year=${y}&month=${m}`,
        authHeaders
      );
      setCostReport(response.data);
    } catch (error) {
      toast.error('Failed to load cost report');
    }
  };

  // Configure failover
  const configureFailover = async (primaryId, failoverId) => {
    try {
      await axios.post(`${API_URL}/api/api-control/admin/failover/configure`, null, {
        ...authHeaders,
        params: {
          api_id: primaryId,
          failover_api_id: failoverId,
          auto_switch: true,
          switch_threshold: 3,
          cooldown_minutes: 15
        }
      });
      toast.success('Failover configured!');
      loadDashboard();
    } catch (error) {
      toast.error('Failed to configure failover');
    }
  };

  // Switch back from failover
  const switchBackToPrimary = async (apiId) => {
    try {
      await axios.post(`${API_URL}/api/api-control/admin/failover/switch-back?api_id=${apiId}`, {}, authHeaders);
      toast.success('Switched back to primary!');
      loadDashboard();
    } catch (error) {
      toast.error('Failed to switch back');
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

      {/* Recommendations Alert */}
      {recommendations.length > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <h4 className="text-yellow-400 font-medium">
                  {recommendations.filter(r => r.priority === 'critical').length} Critical Recommendations
                </h4>
                <p className="text-slate-400 text-sm">
                  {recommendations[0]?.message}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="apis">🖥️ APIs</TabsTrigger>
          <TabsTrigger value="failover">🔄 Failover</TabsTrigger>
          <TabsTrigger value="costs">💰 Cost Reports</TabsTrigger>
          <TabsTrigger value="audit">📜 Audit Logs</TabsTrigger>
        </TabsList>

        {/* APIs Tab */}
        <TabsContent value="apis" className="space-y-4">
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
        </TabsContent>

        {/* Failover Tab */}
        <TabsContent value="failover" className="space-y-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                Failover Status / फेलओवर स्थिति
              </CardTitle>
              <CardDescription className="text-slate-400">
                Automatic failover switches to backup API when primary fails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active Failovers */}
              {failoverStatus?.active_failovers > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-400 font-medium">
                    <AlertTriangle className="h-5 w-5" />
                    {failoverStatus.active_failovers} Active Failover(s)
                  </div>
                  <div className="mt-2 space-y-2">
                    {failoverStatus?.apis?.filter(a => a.failover_config?.is_using_failover).map(api => (
                      <div key={api.api_id} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                        <div>
                          <span className="text-white">{api.name}</span>
                          <span className="text-slate-400 mx-2">→</span>
                          <span className="text-green-400">{api.failover_provider}</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => switchBackToPrimary(api.api_id)}>
                          Switch Back
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Configured Failovers */}
              <div className="space-y-3">
                <h4 className="text-white font-medium">Configured Failovers</h4>
                {failoverStatus?.apis?.map(api => (
                  <div key={api.api_id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${api.failover_config?.is_using_failover ? 'bg-yellow-400' : 'bg-green-400'}`} />
                      <div>
                        <span className="text-white">{api.name}</span>
                        {api.failover_provider && (
                          <span className="text-slate-400 ml-2">
                            → {api.failover_provider}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {api.failover_config?.auto_switch && (
                        <Badge className="bg-green-500/20 text-green-400">Auto</Badge>
                      )}
                      <Badge className={api.failover_config?.is_using_failover ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'}>
                        {api.failover_config?.is_using_failover ? 'On Failover' : 'Primary'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-white font-medium">Recommendations</h4>
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${
                      rec.priority === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                      rec.priority === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                      'bg-slate-800 border-slate-700'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={
                          rec.priority === 'critical' ? 'bg-red-500 text-white' :
                          rec.priority === 'high' ? 'bg-orange-500 text-white' :
                          'bg-slate-500 text-white'
                        }>
                          {rec.priority}
                        </Badge>
                        <span className="text-white text-sm">{rec.api_id}</span>
                      </div>
                      <p className="text-slate-400 text-sm">{rec.message}</p>
                      <p className="text-slate-500 text-xs mt-1">{rec.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Reports Tab */}
        <TabsContent value="costs" className="space-y-4">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    Monthly Cost Report / मासिक लागत रिपोर्ट
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    API usage costs for finance team
                  </CardDescription>
                </div>
                <Button onClick={() => loadCostReport()} variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" /> Load This Month
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {costReport ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-800 rounded-lg text-center">
                      <div className="text-2xl font-bold text-white">{costReport.summary?.total_apis}</div>
                      <div className="text-slate-400 text-sm">Total APIs</div>
                    </div>
                    <div className="p-4 bg-slate-800 rounded-lg text-center">
                      <div className="text-2xl font-bold text-white">{costReport.summary?.total_calls?.toLocaleString()}</div>
                      <div className="text-slate-400 text-sm">Total Calls</div>
                    </div>
                    <div className="p-4 bg-green-500/10 rounded-lg text-center border border-green-500/30">
                      <div className="text-2xl font-bold text-green-400">₹{costReport.summary?.total_cost?.toLocaleString()}</div>
                      <div className="text-slate-400 text-sm">Total Cost</div>
                    </div>
                    <div className="p-4 bg-slate-800 rounded-lg text-center">
                      <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                        costReport.summary?.cost_change_percent > 0 ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {costReport.summary?.cost_change_percent > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        {costReport.summary?.cost_change_percent}%
                      </div>
                      <div className="text-slate-400 text-sm">vs Last Month</div>
                    </div>
                  </div>

                  {/* By API */}
                  <div className="space-y-2">
                    <h4 className="text-white font-medium">Cost by API</h4>
                    {costReport.items?.map(item => (
                      <div key={item.api_id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center">
                            <Server className="h-5 w-5 text-orange-400" />
                          </div>
                          <div>
                            <div className="text-white font-medium">{item.api_name}</div>
                            <div className="text-slate-500 text-xs">{item.category}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-medium">₹{item.current_month?.cost?.toLocaleString()}</div>
                          <div className="text-slate-500 text-xs">{item.current_month?.calls?.toLocaleString()} calls</div>
                        </div>
                        <div className={`text-sm flex items-center gap-1 ${
                          item.change?.cost_percent > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {item.change?.cost_percent > 0 ? '↑' : '↓'} {Math.abs(item.change?.cost_percent)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Click Load This Month to generate cost report
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
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
            <div className="space-y-2 max-h-96 overflow-y-auto">
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
        </TabsContent>
      </Tabs>
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
