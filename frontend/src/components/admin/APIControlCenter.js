import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Shield, CreditCard, MessageSquare, Mail, Map, Cloud,
  Building2, Brain, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, Activity, Clock, IndianRupee, Zap,
  ChevronDown, ChevronUp, History, AlertOctagon, Loader2, Search,
  Server, Wifi, WifiOff, Globe, Lock, Unlock, TrendingUp, TrendingDown,
  Download, FileText, ArrowRightLeft, BarChart3, Calendar, Bell, 
  Wallet, TestTube, Play, Square, Send, Slack, MailIcon
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
  
  // Budget & Alerts State
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [budgetConfig, setBudgetConfig] = useState({
    monthly_budget: '',
    warning_threshold: 80,
    critical_threshold: 95,
    notify_emails: '',
    slack_webhook: ''
  });
  const [alertConfig, setAlertConfig] = useState({
    slack_webhook: '',
    email_recipients: '',
    enable_failover_alerts: true,
    enable_budget_alerts: true,
    enable_health_alerts: true
  });
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [testingAlerts, setTestingAlerts] = useState(false);
  
  // Failover Test Mode State
  const [testSessions, setTestSessions] = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const [startingTest, setStartingTest] = useState(false);
  const [selectedApiForTest, setSelectedApiForTest] = useState('');

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

  // Load Budget Status
  const loadBudgetStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/api-control/admin/budget/status`, authHeaders);
      setBudgetStatus(response.data);
    } catch (error) {
      console.error('Failed to load budget status:', error);
    }
  };

  // Save Budget Config
  const saveBudgetConfig = async () => {
    try {
      setSavingBudget(true);
      const emails = budgetConfig.notify_emails.split(',').map(e => e.trim()).filter(e => e);
      await axios.post(`${API_URL}/api/api-control/admin/budget/configure`, null, {
        ...authHeaders,
        params: {
          monthly_budget: parseFloat(budgetConfig.monthly_budget),
          warning_threshold_percent: budgetConfig.warning_threshold,
          critical_threshold_percent: budgetConfig.critical_threshold,
          notify_emails: emails,
          notify_slack_webhook: budgetConfig.slack_webhook || null
        }
      });
      toast.success('Budget configured!');
      loadBudgetStatus();
    } catch (error) {
      toast.error('Failed to save budget config');
    } finally {
      setSavingBudget(false);
    }
  };

  // Save Alert Channels Config
  const saveAlertConfig = async () => {
    try {
      setSavingAlerts(true);
      const emails = alertConfig.email_recipients.split(',').map(e => e.trim()).filter(e => e);
      await axios.post(`${API_URL}/api/api-control/admin/alerts/configure`, null, {
        ...authHeaders,
        params: {
          slack_webhook: alertConfig.slack_webhook || null,
          email_recipients: emails,
          enable_failover_alerts: alertConfig.enable_failover_alerts,
          enable_budget_alerts: alertConfig.enable_budget_alerts,
          enable_health_alerts: alertConfig.enable_health_alerts
        }
      });
      toast.success('Alert channels configured!');
    } catch (error) {
      toast.error('Failed to save alert config');
    } finally {
      setSavingAlerts(false);
    }
  };

  // Test Alert Channels
  const testAlerts = async (channel = 'all') => {
    try {
      setTestingAlerts(true);
      const response = await axios.post(`${API_URL}/api/api-control/admin/alerts/test?channel=${channel}`, {}, authHeaders);
      toast.success(`Test alert sent! Results: ${JSON.stringify(response.data.results)}`);
    } catch (error) {
      toast.error('Failed to send test alert - configure channels first');
    } finally {
      setTestingAlerts(false);
    }
  };

  // Load Failover Test Sessions
  const loadTestSessions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/api-control/admin/failover/test-mode/sessions`, authHeaders);
      setTestSessions(response.data.sessions || []);
      const active = response.data.sessions?.find(s => s.status === 'running');
      setActiveTest(active || null);
    } catch (error) {
      console.error('Failed to load test sessions:', error);
    }
  };

  // Start Failover Test
  const startFailoverTest = async () => {
    if (!selectedApiForTest) {
      toast.error('Select an API to test');
      return;
    }
    try {
      setStartingTest(true);
      const response = await axios.post(`${API_URL}/api/api-control/admin/failover/test-mode/start`, null, {
        ...authHeaders,
        params: { api_id: selectedApiForTest, simulate_failures: 3 }
      });
      toast.success(response.data.message_hi || response.data.message);
      setActiveTest({ test_id: response.data.test_id, api_id: selectedApiForTest, status: 'running', failures_simulated: 0 });
      loadTestSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start test');
    } finally {
      setStartingTest(false);
    }
  };

  // Simulate Failure in Test
  const simulateFailure = async () => {
    if (!activeTest?.test_id) return;
    try {
      const response = await axios.post(`${API_URL}/api/api-control/admin/failover/test-mode/simulate-failure?test_id=${activeTest.test_id}`, {}, authHeaders);
      toast.info(response.data.message_hi || response.data.message);
      if (response.data.failover_triggered) {
        toast.success('🔄 Failover would be triggered!');
      }
      loadTestSessions();
    } catch (error) {
      toast.error('Failed to simulate failure');
    }
  };

  // Stop Failover Test
  const stopFailoverTest = async () => {
    if (!activeTest?.test_id) return;
    try {
      const response = await axios.post(`${API_URL}/api/api-control/admin/failover/test-mode/stop?test_id=${activeTest.test_id}`, {}, authHeaders);
      toast.success('Test stopped!');
      setActiveTest(null);
      loadTestSessions();
    } catch (error) {
      toast.error('Failed to stop test');
    }
  };

  // Run Full Auto Test
  const runFullAutoTest = async () => {
    if (!selectedApiForTest) {
      toast.error('Select an API to test');
      return;
    }
    try {
      setStartingTest(true);
      const response = await axios.post(`${API_URL}/api/api-control/admin/failover/test-mode/run-full-test?api_id=${selectedApiForTest}`, {}, authHeaders);
      toast.success('Full test completed!');
      loadTestSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to run full test');
    } finally {
      setStartingTest(false);
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
            API Control Center / API          </h2>
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
        <TabsList className="bg-slate-800 border border-slate-700 flex-wrap">
          <TabsTrigger value="apis">🖥️ APIs</TabsTrigger>
          <TabsTrigger value="failover">🔄 Failover</TabsTrigger>
          <TabsTrigger value="costs">💰 Cost Reports</TabsTrigger>
          <TabsTrigger value="budget" onClick={loadBudgetStatus}>💸 Budget Alerts</TabsTrigger>
          <TabsTrigger value="test" onClick={loadTestSessions}>🧪 Test Mode</TabsTrigger>
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
                Failover Status</CardTitle>
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
                    Monthly Cost Report</CardTitle>
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

        {/* Budget Alerts Tab */}
        <TabsContent value="budget" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Budget Status Card */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-green-500" />
                  Budget Status</CardTitle>
              </CardHeader>
              <CardContent>
                {budgetStatus?.configured ? (
                  <div className="space-y-4">
                    {/* Status Badge */}
                    <div className={`p-4 rounded-lg border ${
                      budgetStatus.status === 'critical' ? 'bg-red-500/10 border-red-500/50' :
                      budgetStatus.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/50' :
                      'bg-green-500/10 border-green-500/50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">
                          {budgetStatus.status_emoji} {budgetStatus.status === 'critical' ? 'CRITICAL' : budgetStatus.status === 'warning' ? 'WARNING' : 'HEALTHY'}
                        </span>
                        <span className={`text-2xl font-bold ${
                          budgetStatus.status === 'critical' ? 'text-red-400' :
                          budgetStatus.status === 'warning' ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {budgetStatus.spending?.percent}%
                        </span>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full transition-all ${
                            budgetStatus.status === 'critical' ? 'bg-red-500' :
                            budgetStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(budgetStatus.spending?.percent || 0, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-slate-400 text-xs">Monthly Budget</div>
                        <div className="text-white font-bold">₹{budgetStatus.budget?.monthly?.toLocaleString()}</div>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-slate-400 text-xs">Current Spend</div>
                        <div className="text-orange-400 font-bold">₹{budgetStatus.spending?.current?.toLocaleString()}</div>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-slate-400 text-xs">Remaining</div>
                        <div className="text-green-400 font-bold">₹{budgetStatus.spending?.remaining?.toLocaleString()}</div>
                      </div>
                      <div className="p-3 bg-slate-800 rounded-lg">
                        <div className="text-slate-400 text-xs">Projected This Month</div>
                        <div className={`font-bold ${budgetStatus.spending?.projected > budgetStatus.budget?.monthly ? 'text-red-400' : 'text-blue-400'}`}>
                          ₹{budgetStatus.spending?.projected?.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Thresholds */}
                    <div className="text-sm text-slate-400">
                      <p>⚠️ Warning at: ₹{budgetStatus.budget?.warning_at?.toLocaleString()} ({budgetStatus.thresholds?.warning_percent}%)</p>
                      <p>🔴 Critical at: ₹{budgetStatus.budget?.critical_at?.toLocaleString()} ({budgetStatus.thresholds?.critical_percent}%)</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Wallet className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400">Budget not configured</p>
                    <p className="text-slate-500 text-sm">Configure budget on the right →</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Budget Configuration */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-orange-500" />
                  Configure Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-slate-400 text-sm">Monthly Budget (₹)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 50000"
                    value={budgetConfig.monthly_budget}
                    onChange={(e) => setBudgetConfig({...budgetConfig, monthly_budget: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-sm">Warning Threshold %</label>
                    <Input
                      type="number"
                      value={budgetConfig.warning_threshold}
                      onChange={(e) => setBudgetConfig({...budgetConfig, warning_threshold: parseInt(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-sm">Critical Threshold %</label>
                    <Input
                      type="number"
                      value={budgetConfig.critical_threshold}
                      onChange={(e) => setBudgetConfig({...budgetConfig, critical_threshold: parseInt(e.target.value)})}
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-sm flex items-center gap-1">
                    <MailIcon className="h-4 w-4" /> Alert Emails (comma separated)
                  </label>
                  <Input
                    type="text"
                    placeholder="finance@company.com, cfo@company.com"
                    value={budgetConfig.notify_emails}
                    onChange={(e) => setBudgetConfig({...budgetConfig, notify_emails: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-sm flex items-center gap-1">
                    <Bell className="h-4 w-4" /> Slack Webhook URL
                  </label>
                  <Input
                    type="text"
                    placeholder="https://hooks.slack.com/services/..."
                    value={budgetConfig.slack_webhook}
                    onChange={(e) => setBudgetConfig({...budgetConfig, slack_webhook: e.target.value})}
                    className="bg-slate-800 border-slate-700 text-white mt-1"
                  />
                  <p className="text-slate-500 text-xs mt-1">Create at: Slack → Apps → Incoming Webhooks</p>
                </div>

                <Button 
                  onClick={saveBudgetConfig} 
                  disabled={savingBudget || !budgetConfig.monthly_budget}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  {savingBudget ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save Budget Config</Button>
              </CardContent>
            </Card>
          </div>

          {/* Alert Channels Configuration */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-500" />
                Alert Channels</CardTitle>
              <CardDescription className="text-slate-400">
                Configure Slack & Email notifications for API failures, budget alerts, health issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-slate-400 text-sm flex items-center gap-1">
                      <Bell className="h-4 w-4 text-purple-400" /> Slack Webhook URL
                    </label>
                    <Input
                      type="text"
                      placeholder="https://hooks.slack.com/services/..."
                      value={alertConfig.slack_webhook}
                      onChange={(e) => setAlertConfig({...alertConfig, slack_webhook: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-sm flex items-center gap-1">
                      <MailIcon className="h-4 w-4 text-blue-400" /> Email Recipients (comma separated)
                    </label>
                    <Input
                      type="text"
                      placeholder="admin@company.com, ops@company.com"
                      value={alertConfig.email_recipients}
                      onChange={(e) => setAlertConfig({...alertConfig, email_recipients: e.target.value})}
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-medium">Alert Types</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer">
                      <Switch
                        checked={alertConfig.enable_failover_alerts}
                        onCheckedChange={(v) => setAlertConfig({...alertConfig, enable_failover_alerts: v})}
                      />
                      <div>
                        <span className="text-white">🔄 Failover Alerts</span>
                        <p className="text-slate-500 text-xs">When API switches to backup</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer">
                      <Switch
                        checked={alertConfig.enable_budget_alerts}
                        onCheckedChange={(v) => setAlertConfig({...alertConfig, enable_budget_alerts: v})}
                      />
                      <div>
                        <span className="text-white">💰 Budget Alerts</span>
                        <p className="text-slate-500 text-xs">When spending exceeds thresholds</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer">
                      <Switch
                        checked={alertConfig.enable_health_alerts}
                        onCheckedChange={(v) => setAlertConfig({...alertConfig, enable_health_alerts: v})}
                      />
                      <div>
                        <span className="text-white">❤️ Health Alerts</span>
                        <p className="text-slate-500 text-xs">When API goes down or degrades</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={saveAlertConfig} 
                  disabled={savingAlerts}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {savingAlerts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Save Alert Config
                </Button>
                <Button 
                  onClick={() => testAlerts('all')} 
                  disabled={testingAlerts}
                  variant="outline"
                >
                  {testingAlerts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Test Alert
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Failover Test Mode Tab */}
        <TabsContent value="test" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Start New Test */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-purple-500" />
                  Failover Test Mode</CardTitle>
                <CardDescription className="text-slate-400">
                  Simulate failures safely without affecting production
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTest ? (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-purple-500 text-white animate-pulse">
                        🧪 TEST IN PROGRESS
                      </Badge>
                      <span className="text-slate-400 text-sm">{activeTest.api_id}</span>
                    </div>
                    <div className="text-white mb-3">
                      Failures Simulated: <span className="text-orange-400 font-bold">{activeTest.failures_simulated || 0}</span> / 3
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={simulateFailure} className="bg-orange-500 hover:bg-orange-600">
                        <AlertTriangle className="h-4 w-4 mr-2" /> Simulate Failure
                      </Button>
                      <Button onClick={stopFailoverTest} variant="destructive">
                        <Square className="h-4 w-4 mr-2" /> Stop Test
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-400 text-sm">Select API to Test</label>
                      <select
                        value={selectedApiForTest}
                        onChange={(e) => setSelectedApiForTest(e.target.value)}
                        className="w-full mt-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      >
                        <option value="">-- Select API --</option>
                        {failoverStatus?.apis?.filter(a => a.failover_provider).map(api => (
                          <option key={api.api_id} value={api.api_id}>
                            {api.name} → {api.failover_provider}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={startFailoverTest} 
                        disabled={startingTest || !selectedApiForTest}
                        className="bg-purple-500 hover:bg-purple-600"
                      >
                        {startingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                        Start Manual Test
                      </Button>
                      <Button 
                        onClick={runFullAutoTest} 
                        disabled={startingTest || !selectedApiForTest}
                        variant="outline"
                      >
                        <Zap className="h-4 w-4 mr-2" /> Run Full Auto Test
                      </Button>
                    </div>

                    <div className="p-3 bg-slate-800 rounded-lg text-sm">
                      <p className="text-slate-400">ℹ️ <strong className="text-white">Manual Test:</strong> You simulate failures step-by-step</p>
                      <p className="text-slate-400">ℹ️ <strong className="text-white">Auto Test:</strong> Runs full cycle automatically and generates report</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test History */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-blue-500" />
                    Test History</CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadTestSessions}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {testSessions.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {testSessions.map((session, idx) => (
                      <div key={idx} className="p-3 bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{session.api_id}</span>
                          <Badge className={
                            session.status === 'running' ? 'bg-purple-500 text-white' :
                            session.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            session.status === 'failover_simulated' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          }>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="text-slate-400 text-xs">
                          <p>Failover: {session.failover_api_id}</p>
                          <p>Failures: {session.failures_simulated}/{session.simulate_failures}</p>
                          <p>Started: {new Date(session.started_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <TestTube className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No test sessions yet</p>
                    <p className="text-xs">Run a test to see history</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* How Failover Testing Works */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <h4 className="text-white font-medium mb-2">🧪 How Failover Testing Works</h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-purple-400 font-medium">1️⃣ Select API</div>
                  <p className="text-slate-400">Choose an API that has a failover provider configured</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-orange-400 font-medium">2️⃣ Simulate Failures</div>
                  <p className="text-slate-400">Each click simulates one API failure without actual impact</p>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg">
                  <div className="text-green-400 font-medium">3️⃣ Verify Failover</div>
                  <p className="text-slate-400">After threshold (3 failures), failover would trigger - shown in test report</p>
                </div>
              </div>
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
              Recent API Changes</CardTitle>
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
