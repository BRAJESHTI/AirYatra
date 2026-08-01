import React, { useState, useEffect } from 'react';
import { 
  Shield, Plus, Edit2, Trash2, Check, X, RefreshCw, 
  Search, Settings, Eye, EyeOff, Zap, Server, Key,
  ChevronDown, ChevronUp, Activity, AlertTriangle, CheckCircle,
  Loader2, ExternalLink, Copy, Lock, Unlock, TestTube, 
  IndianRupee, Clock, BarChart3, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Provider logos/colors
const providerConfig = {
  'UIDAI / Surepass / Digio': { color: 'blue', badge: 'Govt' },
  'NSDL / Surepass / Karza': { color: 'green', badge: 'Tax' },
  'Cashfree / Razorpay / Surepass': { color: 'purple', badge: 'Banking' },
  'DGCA / Custom Integration': { color: 'orange', badge: 'Aviation' },
  'GSTN / Surepass': { color: 'cyan', badge: 'GST' },
  'MCA / Karza': { color: 'yellow', badge: 'Corporate' }
};

function VerificationAPISettings() {
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAPI, setEditingAPI] = useState(null);
  const [expandedAPI, setExpandedAPI] = useState(null);
  const [testingAPI, setTestingAPI] = useState(null);
  const [stats, setStats] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    provider: '',
    api_endpoint: '',
    api_key: '',
    api_secret: '',
    sandbox_mode: true,
    is_enabled: false,
    verification_fields: [],
    rate_limit: 100,
    cost_per_call: 0,
    notes: ''
  });

  useEffect(() => {
    loadAPIs();
    loadStats();
  }, []);

  const loadAPIs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/documents/verification-apis`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setApis(data.verification_apis || []);
    } catch (error) {
      toast.error('Failed to load verification APIs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/documents/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      toast.error('Name and Code are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingAPI 
        ? `${API_URL}/api/admin/documents/verification-apis/${editingAPI.id}`
        : `${API_URL}/api/admin/documents/verification-apis`;
      
      const res = await fetch(url, {
        method: editingAPI ? 'PUT' : 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save');
      }

      toast.success(editingAPI ? 'API updated!' : 'API created!');
      setShowAddModal(false);
      setEditingAPI(null);
      resetForm();
      loadAPIs();
      loadStats();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (apiId) => {
    if (!window.confirm('Delete this verification API configuration?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/admin/documents/verification-apis/${apiId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('API configuration deleted');
      loadAPIs();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const toggleAPI = async (api) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/documents/verification-apis/${api.id}/toggle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast.success(data.message);
      loadAPIs();
      loadStats();
    } catch (error) {
      toast.error('Failed to toggle API');
    }
  };

  const testAPI = async (api) => {
    setTestingAPI(api.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/documents/verification-apis/${api.id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(`✅ ${data.message} (${data.latency_ms}ms)`);
      } else {
        toast.error(`❌ Test failed: ${data.message}`);
      }
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setTestingAPI(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      provider: '',
      api_endpoint: '',
      api_key: '',
      api_secret: '',
      sandbox_mode: true,
      is_enabled: false,
      verification_fields: [],
      rate_limit: 100,
      cost_per_call: 0,
      notes: ''
    });
  };

  const openEditModal = (api) => {
    setFormData({
      name: api.name || '',
      code: api.code || '',
      provider: api.provider || '',
      api_endpoint: api.api_endpoint || '',
      api_key: '', // Don't pre-fill sensitive data
      api_secret: '',
      sandbox_mode: api.sandbox_mode !== false,
      is_enabled: api.is_enabled || false,
      verification_fields: api.verification_fields || [],
      rate_limit: api.rate_limit || 100,
      cost_per_call: api.cost_per_call || 0,
      notes: api.notes || ''
    });
    setEditingAPI(api);
    setShowAddModal(true);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-green-400" />
            Verification API Settings / सत्यापन API सेटिंग्स
          </h2>
          <p className="text-slate-400 mt-1">Configure government & third-party verification APIs</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setEditingAPI(null); setShowAddModal(true); }} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" /> Add API
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-900/30 to-slate-900 rounded-xl p-4 border border-green-700/30">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Server className="h-5 w-5" />
            <span className="text-sm">Total APIs</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.verification_apis?.total || 0}</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-900/30 to-slate-900 rounded-xl p-4 border border-blue-700/30">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Zap className="h-5 w-5" />
            <span className="text-sm">Enabled</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.verification_apis?.enabled || 0}</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 rounded-xl p-4 border border-purple-700/30">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Activity className="h-5 w-5" />
            <span className="text-sm">Total Verifications</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.verifications?.total || 0}</p>
        </div>
        
        <div className="bg-gradient-to-br from-orange-900/30 to-slate-900 rounded-xl p-4 border border-orange-700/30">
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm">Success Rate</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.verifications?.success_rate || 0}%</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-blue-400 font-medium">API Integration Guide / API इंटीग्रेशन गाइड</h4>
            <p className="text-slate-300 text-sm mt-1">
              To enable real verification, you need API keys from providers like:
            </p>
            <ul className="text-slate-400 text-sm mt-2 space-y-1">
              <li>• <span className="text-white">Surepass</span> - Aadhar, PAN, Bank, DL, Passport (surepass.io)</li>
              <li>• <span className="text-white">Karza</span> - KYC & Corporate verification (karza.in)</li>
              <li>• <span className="text-white">Digio</span> - e-Sign & Aadhar eKYC (digio.in)</li>
              <li>• <span className="text-white">Signzy</span> - Video KYC & verification (signzy.com)</li>
              <li>• <span className="text-white">DGCA</span> - Pilot license verification (requires MOU)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-green-400" />
          </div>
        ) : apis.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
            <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No verification APIs configured</p>
            <p className="text-slate-500 text-sm mt-2">Go to Document Type Master and click &quot;Seed Defaults&quot; to create standard APIs</p>
          </div>
        ) : (
          apis.map(api => {
            const isExpanded = expandedAPI === api.id;
            const providerInfo = Object.entries(providerConfig).find(([key]) => 
              api.provider?.toLowerCase().includes(key.split('/')[0].toLowerCase().trim())
            );
            
            return (
              <div 
                key={api.id}
                className={`bg-slate-800/50 rounded-xl border transition-all ${
                  api.is_enabled ? 'border-green-500/30' : 'border-slate-700'
                }`}
              >
                {/* Main Row */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/80"
                  onClick={() => setExpandedAPI(isExpanded ? null : api.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      api.is_enabled ? 'bg-green-500/20' : 'bg-slate-700'
                    }`}>
                      <Shield className={`h-6 w-6 ${api.is_enabled ? 'text-green-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{api.name}</h3>
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs font-mono">{api.code}</span>
                        {api.sandbox_mode && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">Sandbox</span>
                        )}
                        {api.is_enabled ? (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-600 text-slate-400 rounded text-xs">Disabled</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm flex items-center gap-3 mt-1">
                        <span>{api.provider}</span>
                        <span className="flex items-center gap-1">
                          <IndianRupee className="h-3 w-3" /> ₹{api.cost_per_call}/call
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" /> {api.total_calls || 0} calls
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); testAPI(api); }}
                      disabled={testingAPI === api.id}
                      className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                    >
                      {testingAPI === api.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); toggleAPI(api); }}
                      className={api.is_enabled ? 'border-red-500 text-red-400' : 'border-green-500 text-green-400'}
                    >
                      {api.is_enabled ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openEditModal(api); }}
                      className="border-slate-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleDelete(api.id); }}
                      className="border-red-500 text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-700 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">API Endpoint</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-slate-300 text-sm overflow-x-auto">
                            {api.api_endpoint || 'Not configured'}
                          </code>
                          {api.api_endpoint && (
                            <button onClick={() => copyToClipboard(api.api_endpoint)} className="text-slate-400 hover:text-white">
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">API Key</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-slate-300 text-sm">
                            {api.api_key || 'Not configured'}
                          </code>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Verification Fields</p>
                        <div className="flex flex-wrap gap-1">
                          {(api.verification_fields || []).map((field, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Rate Limit</p>
                        <p className="text-white">{api.rate_limit} calls/day</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Stats</p>
                        <p className="text-white">
                          <span className="text-green-400">{api.successful_calls || 0}</span> success / 
                          <span className="text-red-400 ml-1">{api.failed_calls || 0}</span> failed
                        </p>
                      </div>
                    </div>
                    
                    {api.notes && (
                      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                        <p className="text-slate-400 text-sm mb-1">Notes</p>
                        <p className="text-slate-300 text-sm">{api.notes}</p>
                      </div>
                    )}
                    
                    {api.last_used && (
                      <p className="text-slate-500 text-xs mt-3">
                        Last used: {new Date(api.last_used).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingAPI ? 'Edit Verification API' : 'Add Verification API'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingAPI(null); }} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">API Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Aadhar eKYC"
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                    required
                  />
                </div>
                <div>
                  <Label className="text-white">Unique Code * (Auto uppercase)</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s/g, '_')})}
                    placeholder="e.g., AADHAR_KYC"
                    className="mt-1 bg-slate-800 border-slate-600 text-white font-mono"
                    required
                    disabled={editingAPI}
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-white">Provider</Label>
                <Input
                  value={formData.provider}
                  onChange={(e) => setFormData({...formData, provider: e.target.value})}
                  placeholder="e.g., Surepass / Karza / UIDAI"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              <div>
                <Label className="text-white">API Endpoint URL</Label>
                <Input
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData({...formData, api_endpoint: e.target.value})}
                  placeholder="https://api.provider.com/v1/verify"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">API Key</Label>
                  <Input
                    type="password"
                    value={formData.api_key}
                    onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                    placeholder={editingAPI ? "Leave empty to keep existing" : "Enter API Key"}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">API Secret</Label>
                  <Input
                    type="password"
                    value={formData.api_secret}
                    onChange={(e) => setFormData({...formData, api_secret: e.target.value})}
                    placeholder={editingAPI ? "Leave empty to keep existing" : "Enter API Secret"}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-white">Verification Fields (comma-separated)</Label>
                <Input
                  value={formData.verification_fields.join(', ')}
                  onChange={(e) => setFormData({...formData, verification_fields: e.target.value.split(',').map(f => f.trim()).filter(f => f)})}
                  placeholder="e.g., aadhaar_number, otp, name"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Rate Limit (calls/day)</Label>
                  <Input
                    type="number"
                    value={formData.rate_limit}
                    onChange={(e) => setFormData({...formData, rate_limit: parseInt(e.target.value) || 100})}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Cost per Call (₹)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.cost_per_call}
                    onChange={(e) => setFormData({...formData, cost_per_call: parseFloat(e.target.value) || 0})}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-white">Notes</Label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Configuration notes, documentation links..."
                  rows={3}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sandbox_mode}
                    onChange={(e) => setFormData({...formData, sandbox_mode: e.target.checked})}
                    className="rounded border-slate-600"
                  />
                  <span className="text-white text-sm">Sandbox/Test Mode</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_enabled}
                    onChange={(e) => setFormData({...formData, is_enabled: e.target.checked})}
                    className="rounded border-slate-600"
                  />
                  <span className="text-white text-sm">Enable API</span>
                </label>
              </div>
              
              {formData.is_enabled && !formData.sandbox_mode && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Production mode enabled! Real API calls will be made and may incur charges.
                  </p>
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <Button type="button" onClick={() => { setShowAddModal(false); setEditingAPI(null); }} variant="outline" className="flex-1 border-slate-600">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                  {editingAPI ? 'Update API' : 'Create API'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerificationAPISettings;
