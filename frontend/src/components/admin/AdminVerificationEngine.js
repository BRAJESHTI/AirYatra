import React, { useState, useEffect } from 'react';
import { 
  Shield, Settings, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Users, FileCheck, Clock, Bell, ToggleLeft, ToggleRight, Save,
  ChevronDown, ChevronUp, Plus, Trash2, Edit2, History, AlertOctagon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Admin Verification Engine Configuration
 * From Document [2] & [5]
 */
const AdminVerificationEngine = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Load config on mount
  useEffect(() => {
    loadConfig();
    loadAuditLogs();
  }, []);

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/verification-engine/admin/full-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error('Failed to load config:', e);
      toast.error('Failed to load verification config');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/verification-engine/admin/audit-logs?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    }
  };

  const setMode = async (mode) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/verification-engine/admin/set-mode/${mode}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(`Mode changed to: ${mode}`);
        loadConfig();
        loadAuditLogs();
      } else {
        toast.error('Failed to change mode');
      }
    } catch (e) {
      toast.error('Error changing mode');
    } finally {
      setSaving(false);
    }
  };

  const setProvider = async (provider) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/verification-engine/admin/set-provider/${provider}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(`Provider changed to: ${provider}`);
        loadConfig();
      } else {
        toast.error('Failed to change provider');
      }
    } catch (e) {
      toast.error('Error changing provider');
    } finally {
      setSaving(false);
    }
  };

  const enableEmergencyOverride = async () => {
    const reason = prompt('Enter reason for emergency override:');
    if (!reason) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/verification-engine/admin/emergency-override`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason, duration_hours: 24, otp: '123456' })
      });
      if (res.ok) {
        toast.success('Emergency override enabled for 24 hours');
        loadConfig();
      }
    } catch (e) {
      toast.error('Failed to enable override');
    } finally {
      setSaving(false);
    }
  };

  const disableOverride = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/verification-engine/admin/disable-override`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Emergency override disabled');
        loadConfig();
      }
    } catch (e) {
      toast.error('Failed to disable override');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const modes = [
    { value: 'disabled', label: 'Disabled', labelHi: 'बंद', color: 'bg-slate-500', desc: 'No verification required' },
    { value: 'optional', label: 'Optional', labelHi: 'वैकल्पिक', color: 'bg-blue-500', desc: 'Badges earned, not required' },
    { value: 'mandatory', label: 'Mandatory', labelHi: 'अनिवार्य', color: 'bg-green-500', desc: 'Must verify to operate' }
  ];

  const providers = [
    { value: 'sandbox', label: 'Sandbox (Test)', icon: '🧪' },
    { value: 'surepass', label: 'SurePass', icon: '✅' },
    { value: 'signzy', label: 'Signzy', icon: '🔐' },
    { value: 'idfy', label: 'IDFY', icon: '🆔' },
    { value: 'hyperverge', label: 'HyperVerge', icon: '🔍' },
    { value: 'digilocker', label: 'DigiLocker', icon: '📁' }
  ];

  const scoringConfig = config?.scoring_config || {};

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-7 w-7 text-green-400" />
            Verification Rule Engine
          </h1>
          <p className="text-slate-400 mt-1">
            Admin-configurable verification system / सत्यापन नियम इंजन
          </p>
        </div>
        <div className="flex items-center gap-3">
          {config?.override_enabled && (
            <Badge className="bg-red-500/20 text-red-400 animate-pulse">
              <AlertOctagon className="h-3 w-3 mr-1" />
              Emergency Override Active
            </Badge>
          )}
          <Badge className={`${config?.sandbox_mode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
            {config?.sandbox_mode ? '🧪 Sandbox Mode' : '🚀 Production'}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Mode Selection */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-400" />
                Verification Mode / सत्यापन मोड
              </CardTitle>
              <CardDescription>Select how verification works for operators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modes.map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => setMode(mode.value)}
                    disabled={saving}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      config?.verification_mode === mode.value
                        ? `${mode.color} border-white/30`
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">{mode.label}</span>
                      {config?.verification_mode === mode.value && (
                        <CheckCircle className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <p className="text-sm text-slate-300">{mode.labelHi}</p>
                    <p className="text-xs text-slate-400 mt-1">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Emergency Override */}
          <Card className={`border-2 ${config?.override_enabled ? 'bg-red-500/10 border-red-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${config?.override_enabled ? 'text-red-400' : 'text-yellow-400'}`} />
                Emergency Override / आपातकालीन ओवरराइड
              </CardTitle>
              <CardDescription>
                Enable manual verification when APIs fail
              </CardDescription>
            </CardHeader>
            <CardContent>
              {config?.override_enabled ? (
                <div className="space-y-4">
                  <div className="bg-red-500/20 rounded-lg p-4">
                    <p className="text-red-400 font-medium">Override Active</p>
                    <p className="text-sm text-red-400/70 mt-1">
                      Reason: {config?.override_reason || 'N/A'}
                    </p>
                    <p className="text-sm text-red-400/70">
                      Expires: {config?.override_expires_at ? new Date(config.override_expires_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <Button 
                    onClick={disableOverride}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Return to Normal Mode
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-400 text-sm">
                    When APIs are down, enable emergency override to allow manual verification.
                    This should only be used in emergencies.
                  </p>
                  <Button 
                    onClick={enableEmergencyOverride}
                    disabled={saving}
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Enable Emergency Override
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Rules Preview */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-purple-400" />
                Booking Verification Rules / बुकिंग सत्यापन नियम
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(config?.booking_rules || []).map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium">
                        ₹{rule.min_amount?.toLocaleString('en-IN')} 
                        {rule.max_amount ? ` - ₹${rule.max_amount.toLocaleString('en-IN')}` : '+'}
                      </p>
                      <p className="text-slate-400 text-sm">{rule.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rule.required_verifications?.map((v, j) => (
                        <Badge key={j} className="bg-blue-500/20 text-blue-400 text-xs">
                          {v.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Verification Scoring Weights</CardTitle>
              <CardDescription>Points assigned for each verification type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { key: 'pan_score', label: 'PAN', icon: '🪪' },
                  { key: 'gst_score', label: 'GST', icon: '📋' },
                  { key: 'bank_score', label: 'Bank', icon: '🏦' },
                  { key: 'aadhaar_score', label: 'Aadhaar', icon: '🆔' },
                  { key: 'face_score', label: 'Face', icon: '👤' },
                  { key: 'company_reg_score', label: 'Company', icon: '🏢' },
                  { key: 'aoc_score', label: 'AOC', icon: '✈️' },
                  { key: 'insurance_score', label: 'Insurance', icon: '🛡️' },
                  { key: 'pilot_license_score', label: 'Pilot License', icon: '👨‍✈️' },
                ].map(item => (
                  <div key={item.key} className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <span className="text-2xl">{item.icon}</span>
                    <p className="text-white font-medium mt-2">{item.label}</p>
                    <p className="text-3xl font-bold text-orange-400 mt-1">
                      {scoringConfig[item.key] || 0}
                    </p>
                    <p className="text-slate-400 text-xs">points</p>
                  </div>
                ))}
              </div>

              {/* Badge Thresholds */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h4 className="text-white font-medium mb-4">Badge Thresholds / बैज सीमाएं</h4>
                <div className="flex gap-4">
                  <div className="flex-1 bg-yellow-500/20 rounded-lg p-4 text-center">
                    <span className="text-2xl">🥇</span>
                    <p className="text-yellow-400 font-bold text-xl">{scoringConfig.gold_threshold || 90}+</p>
                    <p className="text-slate-300 text-sm">Gold</p>
                  </div>
                  <div className="flex-1 bg-slate-400/20 rounded-lg p-4 text-center">
                    <span className="text-2xl">🥈</span>
                    <p className="text-slate-300 font-bold text-xl">{scoringConfig.silver_threshold || 70}+</p>
                    <p className="text-slate-300 text-sm">Silver</p>
                  </div>
                  <div className="flex-1 bg-amber-700/20 rounded-lg p-4 text-center">
                    <span className="text-2xl">🥉</span>
                    <p className="text-amber-600 font-bold text-xl">{scoringConfig.basic_threshold || 50}+</p>
                    <p className="text-slate-300 text-sm">Basic</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-red-400" />
                Auto Rules / ऑटो नियम
              </CardTitle>
              <CardDescription>Automatic actions based on verification status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(config?.auto_rules || []).map((rule, i) => (
                  <div key={i} className={`p-4 rounded-lg border ${rule.is_active ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-800/50 border-slate-700 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${rule.is_active ? 'bg-green-500/20' : 'bg-slate-600/20'}`}>
                          {rule.is_active ? (
                            <ToggleRight className="h-5 w-5 text-green-400" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">{rule.rule_name}</p>
                          <p className="text-slate-400 text-sm">
                            If <code className="bg-slate-600 px-1 rounded">{rule.condition_type}</code> = 
                            <code className="bg-slate-600 px-1 rounded ml-1">{rule.condition_value}</code>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`${
                          rule.action === 'suspend_operator' ? 'bg-red-500/20 text-red-400' :
                          rule.action === 'block_bookings' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {rule.action?.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                        {rule.grace_period_days > 0 && (
                          <p className="text-slate-400 text-xs mt-1">
                            Grace: {rule.grace_period_days} days
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">API Provider Selection</CardTitle>
              <CardDescription>Choose verification API provider</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {providers.map(provider => (
                  <button
                    key={provider.value}
                    onClick={() => setProvider(provider.value)}
                    disabled={saving}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      config?.primary_provider === provider.value
                        ? 'bg-green-500/20 border-green-500'
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{provider.icon}</span>
                      <div>
                        <p className="text-white font-medium">{provider.label}</p>
                        {config?.primary_provider === provider.value && (
                          <Badge className="bg-green-500/20 text-green-400 mt-1">Active</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="h-5 w-5 text-blue-400" />
                Audit Logs / ऑडिट लॉग
              </CardTitle>
              <CardDescription>Track all configuration changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No audit logs yet</p>
                ) : (
                  auditLogs.map((log, i) => (
                    <div key={i} className="p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-blue-500/20 text-blue-400">
                          {log.action?.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-slate-400 text-xs">
                          {new Date(log.changed_at).toLocaleString()}
                        </span>
                      </div>
                      {log.reason && (
                        <p className="text-slate-300 text-sm mt-1">Reason: {log.reason}</p>
                      )}
                      {log.otp_verified && (
                        <Badge className="bg-green-500/20 text-green-400 text-xs mt-1">OTP Verified</Badge>
                      )}
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

export default AdminVerificationEngine;
