import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, Settings, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Users, FileCheck, Clock, Bell, Save, History, AlertOctagon,
  Scale, Building2, Plane, User, Briefcase, CreditCard, FileText,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Plus, Trash2, Edit2,
  Loader2, Phone, Mail, CheckSquare, Fingerprint, BadgeCheck, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Complete Verification Rule Engine (VRE) Admin Panel
 * 18-point configurable verification system with Sandbox.co.in integration
 */
const AdminVerificationEngine = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // State
  const [globalConfig, setGlobalConfig] = useState(null);
  const [customerServices, setCustomerServices] = useState([]);
  const [operatorServices, setOperatorServices] = useState([]);
  const [bookingRules, setBookingRules] = useState([]);
  const [autoRules, setAutoRules] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [emergencyStatus, setEmergencyStatus] = useState(null);

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, dashboardRes, customerRes, operatorRes, rulesRes, autoRes, permRes, auditRes, emergRes] = await Promise.all([
        axios.get(`${API_URL}/api/vre/admin/global-config`, authHeaders).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/vre/admin/dashboard`, authHeaders).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/vre/admin/services/customer`, authHeaders).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/vre/admin/services/operator`, authHeaders).catch(() => ({ data: null })),
        axios.get(`${API_URL}/api/vre/admin/booking-rules`, authHeaders).catch(() => ({ data: { rules: [] } })),
        axios.get(`${API_URL}/api/vre/admin/auto-rules`, authHeaders).catch(() => ({ data: { rules: [] } })),
        axios.get(`${API_URL}/api/vre/admin/permissions`, authHeaders).catch(() => ({ data: { permissions: [] } })),
        axios.get(`${API_URL}/api/vre/admin/audit-logs?limit=20`, authHeaders).catch(() => ({ data: { logs: [] } })),
        axios.get(`${API_URL}/api/vre/admin/emergency-status`, authHeaders).catch(() => ({ data: null }))
      ]);

      setGlobalConfig(configRes.data);
      setDashboard(dashboardRes.data);
      setCustomerServices(customerRes.data?.services || []);
      setOperatorServices(operatorRes.data?.services || []);
      setBookingRules(rulesRes.data?.rules || []);
      setAutoRules(autoRes.data?.rules || []);
      setPermissions(permRes.data?.permissions || []);
      setAuditLogs(auditRes.data?.logs || []);
      setEmergencyStatus(emergRes.data);
    } catch (e) {
      console.error('Load error:', e);
      toast.error('Failed to load VRE configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize VRE if not configured
  const initializeVRE = async () => {
    try {
      await axios.post(`${API_URL}/api/vre/admin/initialize`, {}, authHeaders);
      toast.success('VRE initialized successfully!');
      loadData();
    } catch (e) {
      toast.error('Failed to initialize VRE');
    }
  };

  // Toggle sandbox/production mode
  const toggleMode = async (field, value) => {
    try {
      await axios.put(`${API_URL}/api/vre/admin/global-config`, {
        [field]: value,
        reason: `Toggled ${field}`
      }, authHeaders);
      toast.success(`${field} updated`);
      loadData();
    } catch (e) {
      toast.error('Failed to update mode');
    }
  };

  // Update service mode
  const updateServiceMode = async (category, serviceType, newMode) => {
    try {
      await axios.put(`${API_URL}/api/vre/admin/services/${category}/${serviceType}`, {
        mode: newMode,
        reason: `Changed ${serviceType} to ${newMode}`
      }, authHeaders);
      toast.success(`${serviceType} mode updated to ${newMode}`);
      loadData();
    } catch (e) {
      toast.error('Failed to update service');
    }
  };

  // Toggle auto rule
  const toggleAutoRule = async (ruleId) => {
    try {
      await axios.put(`${API_URL}/api/vre/admin/auto-rules/${ruleId}/toggle`, {}, authHeaders);
      toast.success('Rule toggled');
      loadData();
    } catch (e) {
      toast.error('Failed to toggle rule');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!globalConfig) {
    return (
      <Card className="bg-slate-900 border-orange-500/50">
        <CardContent className="p-8 text-center">
          <Shield className="h-16 w-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Verification Rule Engine</h2>
          <p className="text-slate-400 mb-6">VRE is not initialized. Click below to set up default configuration.</p>
          <Button onClick={initializeVRE} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" /> Initialize VRE
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="vre-admin-panel">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-500" />
            Verification Rule Engine</h2>
          <p className="text-slate-400 text-sm">
            18-point configurable verification system • Sandbox.co.in Integration
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className={globalConfig.sandbox_mode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}>
            {globalConfig.sandbox_mode ? '🧪 Sandbox Mode' : '🚀 Production Mode'}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
          <TabsTrigger value="services">⚙️ Services</TabsTrigger>
          <TabsTrigger value="booking-rules">💰 Booking Rules</TabsTrigger>
          <TabsTrigger value="auto-rules">🤖 Auto Rules</TabsTrigger>
          <TabsTrigger value="emergency">🚨 Emergency</TabsTrigger>
          <TabsTrigger value="audit">📜 Audit Logs</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {dashboard && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<CheckCircle className="h-5 w-5" />}
                  label="Total Verifications"
                  value={dashboard.stats?.total_verifications || 0}
                  color="blue"
                />
                <StatCard
                  icon={<CheckSquare className="h-5 w-5" />}
                  label="Verified"
                  value={dashboard.stats?.verified || 0}
                  color="green"
                />
                <StatCard
                  icon={<XCircle className="h-5 w-5" />}
                  label="Failed"
                  value={dashboard.stats?.failed || 0}
                  color="red"
                />
                <StatCard
                  icon={<Scale className="h-5 w-5" />}
                  label="Success Rate"
                  value={`${dashboard.stats?.success_rate || 0}%`}
                  color="orange"
                />
              </div>

              {/* Badge Distribution */}
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BadgeCheck className="h-5 w-5 text-orange-500" />
                    Badge Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                      <div className="text-3xl font-bold text-yellow-400">{dashboard.badge_distribution?.gold || 0}</div>
                      <div className="text-sm text-slate-400">🟢 Gold (90+)</div>
                    </div>
                    <div className="text-center p-4 bg-slate-500/10 rounded-lg border border-slate-500/30">
                      <div className="text-3xl font-bold text-slate-300">{dashboard.badge_distribution?.silver || 0}</div>
                      <div className="text-sm text-slate-400">🔵 Silver (80+)</div>
                    </div>
                    <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                      <div className="text-3xl font-bold text-orange-400">{dashboard.badge_distribution?.basic || 0}</div>
                      <div className="text-sm text-slate-400">🟡 Basic (60+)</div>
                    </div>
                    <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                      <div className="text-3xl font-bold text-red-400">{dashboard.badge_distribution?.pending || 0}</div>
                      <div className="text-sm text-slate-400">🔴 Pending</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mode Toggles */}
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Settings className="h-5 w-5 text-orange-500" />
                    System Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">🧪 Sandbox Mode</div>
                      <div className="text-slate-400 text-sm">Fake data, all verifications pass automatically</div>
                    </div>
                    <Switch
                      checked={globalConfig.sandbox_mode}
                      onCheckedChange={(v) => toggleMode('sandbox_mode', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                    <div>
                      <div className="text-white font-medium">🚀 Production Mode</div>
                      <div className="text-slate-400 text-sm">Real API calls to Sandbox.co.in</div>
                    </div>
                    <Switch
                      checked={globalConfig.production_mode}
                      onCheckedChange={(v) => toggleMode('production_mode', v)}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          {/* Customer Services */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                Customer Verification Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customerServices.map((service) => (
                  <ServiceRow
                    key={service.service_type}
                    service={service}
                    onModeChange={(mode) => updateServiceMode('customer', service.service_type, mode)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Operator Services */}
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-green-500" />
                Operator Verification Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {operatorServices.map((service) => (
                  <ServiceRow
                    key={service.service_type}
                    service={service}
                    onModeChange={(mode) => updateServiceMode('operator', service.service_type, mode)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Rules Tab */}
        <TabsContent value="booking-rules" className="space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-500" />
                Booking Amount Rules</CardTitle>
              <CardDescription className="text-slate-400">
                Different verification requirements based on booking amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bookingRules.map((rule) => (
                  <div key={rule.rule_id} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-white">{rule.description}</div>
                      <Badge className={rule.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rule.required_verifications?.map((v) => (
                        <Badge key={v} variant="outline" className="text-orange-400 border-orange-400">
                          {getServiceIcon(v)} {v.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Amount: ₹{rule.min_amount?.toLocaleString()} - {rule.max_amount ? `₹${rule.max_amount.toLocaleString()}` : 'No Limit'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto Rules Tab */}
        <TabsContent value="auto-rules" className="space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertOctagon className="h-5 w-5 text-red-500" />
                Auto Rules (If X Then Y)</CardTitle>
              <CardDescription className="text-slate-400">
                Automated actions triggered by verification events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {autoRules.map((rule) => (
                  <div key={rule.rule_id} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-white">{rule.name}</div>
                      </div>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleAutoRule(rule.rule_id)}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge className="bg-red-500/20 text-red-400">
                        Trigger: {rule.trigger?.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-slate-500">→</span>
                      {rule.actions?.map((action, idx) => (
                        <Badge key={idx} className="bg-blue-500/20 text-blue-400">
                          {action.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Tab */}
        <TabsContent value="emergency" className="space-y-6">
          <Card className="bg-slate-900 border-red-500/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Emergency Override</CardTitle>
              <CardDescription className="text-slate-400">
                Switch to manual verification mode when APIs are down
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={`p-4 rounded-lg border text-center ${emergencyStatus?.global_status === 'normal' ? 'bg-green-500/10 border-green-500' : 'bg-slate-800 border-slate-700'}`}>
                  <div className="text-2xl mb-1">🟢</div>
                  <div className="text-white font-medium">Normal</div>
                  <div className="text-slate-400 text-xs">All APIs working</div>
                </div>
                <div className={`p-4 rounded-lg border text-center ${emergencyStatus?.global_status === 'manual_mode' ? 'bg-yellow-500/10 border-yellow-500' : 'bg-slate-800 border-slate-700'}`}>
                  <div className="text-2xl mb-1">🟡</div>
                  <div className="text-white font-medium">Manual Mode</div>
                  <div className="text-slate-400 text-xs">Human review</div>
                </div>
                <div className={`p-4 rounded-lg border text-center ${emergencyStatus?.global_status === 'disabled' ? 'bg-red-500/10 border-red-500' : 'bg-slate-800 border-slate-700'}`}>
                  <div className="text-2xl mb-1">🔴</div>
                  <div className="text-white font-medium">Disabled</div>
                  <div className="text-slate-400 text-xs">All verifications off</div>
                </div>
              </div>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="text-yellow-400 font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Emergency Override Info
                </div>
                <div className="text-slate-400 text-sm mt-2">
                  When any verification API fails, system automatically switches to Manual Mode.
                  Compliance Officer will receive alert and can manually verify users.
                  No booking will be stopped due to API issues.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="h-5 w-5 text-orange-500" />
                Audit Logs (Immutable)</CardTitle>
              <CardDescription className="text-slate-400">
                All configuration changes are logged and cannot be deleted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">No audit logs yet</div>
                ) : (
                  auditLogs.map((log, idx) => (
                    <div key={idx} className="p-3 bg-slate-800 rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-white font-medium">{log.service_or_setting}</div>
                        <Badge className={log.risk_level === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}>
                          {log.risk_level}
                        </Badge>
                      </div>
                      <div className="text-slate-400 text-xs">
                        By: {log.changed_by_email} | {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="text-slate-500 text-xs mt-1">
                        Reason: {log.reason} | OTP: {log.otp_verified ? '✅' : '❌'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400'
  };

  return (
    <div className={`p-4 rounded-lg bg-gradient-to-br border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-slate-400 text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
};

// Service Row Component
const ServiceRow = ({ service, onModeChange }) => {
  const modeColors = {
    disabled: 'bg-slate-500/20 text-slate-400',
    optional: 'bg-yellow-500/20 text-yellow-400',
    mandatory: 'bg-green-500/20 text-green-400'
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-700 rounded">
          {getServiceIcon(service.service_type)}
        </div>
        <div>
          <div className="text-white font-medium">{service.description || service.service_type.replace(/_/g, ' ')}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-orange-500/20 text-orange-400">{service.score_weight} pts</Badge>
        <select
          value={service.mode}
          onChange={(e) => onModeChange(e.target.value)}
          className={`px-3 py-1 rounded text-sm border-0 ${modeColors[service.mode]} cursor-pointer`}
        >
          <option value="disabled">Disabled</option>
          <option value="optional">Optional</option>
          <option value="mandatory">Mandatory</option>
        </select>
      </div>
    </div>
  );
};

// Get icon for service type
const getServiceIcon = (type) => {
  const icons = {
    mobile_otp: <Phone className="h-4 w-4 text-blue-400" />,
    email_otp: <Mail className="h-4 w-4 text-green-400" />,
    pan: <FileText className="h-4 w-4 text-orange-400" />,
    gst: <Building2 className="h-4 w-4 text-purple-400" />,
    aadhaar: <Fingerprint className="h-4 w-4 text-cyan-400" />,
    bank_account: <CreditCard className="h-4 w-4 text-green-400" />,
    face: <User className="h-4 w-4 text-pink-400" />,
    cin: <Briefcase className="h-4 w-4 text-indigo-400" />,
    digilocker: <FileCheck className="h-4 w-4 text-blue-400" />,
  };
  return icons[type] || <CheckCircle className="h-4 w-4 text-slate-400" />;
};

export default AdminVerificationEngine;
