import React, { useState, useEffect } from 'react';
import { Settings, IndianRupee, Percent, Calendar, MapPin, Save, Plus, Trash2, Mail, MessageSquare, Calculator, Key, Shield, FileText, Eye, EyeOff, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { settingsAPI } from '@/services/api';
import { toast } from 'sonner';

function GlobalSettings() {
  const [activeTab, setActiveTab] = useState('platform');
  const [platformSettings, setPlatformSettings] = useState({});
  const [pricingSettings, setPricingSettings] = useState({});
  const [flightTypePricing, setFlightTypePricing] = useState({});
  const [apiKeys, setApiKeys] = useState({});
  const [termsSettings, setTermsSettings] = useState({});
  const [termsAgreements, setTermsAgreements] = useState([]);
  const [regions, setRegions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegionDialog, setShowRegionDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState({});
  const [newRegion, setNewRegion] = useState({ region_name: '', region_code: '', states: '', is_active: true });
  const [newTemplate, setNewTemplate] = useState({ template_name: '', template_type: 'email', subject: '', content: '' });

  useEffect(() => {
    loadSettings();
  }, [activeTab]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      if (activeTab === 'platform') {
        const response = await settingsAPI.getPlatformSettings();
        setPlatformSettings(response.data);
      } else if (activeTab === 'pricing') {
        const response = await settingsAPI.getPricingSettings();
        setPricingSettings(response.data);
      } else if (activeTab === 'flight_types') {
        const response = await settingsAPI.getFlightTypePricingAdmin();
        setFlightTypePricing(response.data);
      } else if (activeTab === 'apikeys') {
        const response = await settingsAPI.getAPIKeys();
        setApiKeys(response.data);
      } else if (activeTab === 'terms') {
        const [termsRes, agreementsRes] = await Promise.all([
          settingsAPI.getTermsConditions(),
          settingsAPI.getTermsAgreements({})
        ]);
        setTermsSettings(termsRes.data);
        setTermsAgreements(agreementsRes.data.agreements || []);
      } else if (activeTab === 'regions') {
        const response = await settingsAPI.getRegions();
        setRegions(response.data.regions || []);
      } else if (activeTab === 'templates') {
        const response = await settingsAPI.getNotificationTemplates();
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlatformSettings = async () => {
    setSaving(true);
    try {
      await settingsAPI.updatePlatformSettings(platformSettings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricingSettings = async () => {
    setSaving(true);
    try {
      await settingsAPI.updatePricingSettings(pricingSettings);
      toast.success('Pricing settings saved successfully');
    } catch (error) {
      toast.error('Failed to save pricing settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKeys = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateAPIKeys(apiKeys);
      toast.success('API keys saved successfully');
    } catch (error) {
      toast.error('Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTerms = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateTermsConditions(termsSettings);
      toast.success('Terms & Conditions saved successfully');
    } catch (error) {
      toast.error('Failed to save terms');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFlightTypePricing = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateFlightTypePricing(flightTypePricing);
      toast.success('Flight type pricing saved successfully / उड़ान प्रकार मूल्य सहेजा गया');
    } catch (error) {
      toast.error('Failed to save flight type pricing');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRegion = async () => {
    try {
      const regionData = {
        ...newRegion,
        states: newRegion.states.split(',').map(s => s.trim())
      };
      await settingsAPI.createRegion(regionData);
      toast.success('Region created');
      setShowRegionDialog(false);
      setNewRegion({ region_name: '', region_code: '', states: '', is_active: true });
      loadSettings();
    } catch (error) {
      toast.error('Failed to create region');
    }
  };

  const handleDeleteRegion = async (regionId) => {
    try {
      await settingsAPI.deleteRegion(regionId);
      toast.success('Region deleted');
      loadSettings();
    } catch (error) {
      toast.error('Failed to delete region');
    }
  };

  const handleAddTemplate = async () => {
    try {
      await settingsAPI.createNotificationTemplate(newTemplate);
      toast.success('Template created');
      setShowTemplateDialog(false);
      setNewTemplate({ template_name: '', template_type: 'email', subject: '', content: '' });
      loadSettings();
    } catch (error) {
      toast.error('Failed to create template');
    }
  };

  const toggleShowKey = (keyName) => {
    setShowApiKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const tabs = [
    { id: 'platform', label: 'Platform', icon: Settings },
    { id: 'pricing', label: 'Pricing', icon: Calculator },
    { id: 'flight_types', label: 'Flight Types', icon: Plane, highlight: true },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'terms', label: 'Terms & Conditions', icon: FileText },
    { id: 'regions', label: 'Regions', icon: MapPin },
    { id: 'templates', label: 'Templates', icon: Mail },
  ];

  const apiKeyFields = [
    { section: 'Email Service (SendGrid)', fields: [
      { key: 'sendgrid_api_key', label: 'API Key', type: 'password' },
      { key: 'sendgrid_from_email', label: 'From Email', type: 'email' },
      { key: 'sendgrid_from_name', label: 'From Name', type: 'text' },
    ]},
    { section: 'SMS Service (Twilio)', fields: [
      { key: 'twilio_account_sid', label: 'Account SID', type: 'password' },
      { key: 'twilio_auth_token', label: 'Auth Token', type: 'password' },
      { key: 'twilio_phone_number', label: 'Phone Number', type: 'text' },
    ]},
    { section: 'Payment (Razorpay)', fields: [
      { key: 'razorpay_key_id', label: 'Key ID', type: 'password' },
      { key: 'razorpay_key_secret', label: 'Key Secret', type: 'password' },
      { key: 'razorpay_webhook_secret', label: 'Webhook Secret', type: 'password' },
    ]},
    { section: 'Maps & Location (Google)', fields: [
      { key: 'google_maps_api_key', label: 'Maps API Key', type: 'password' },
    ]},
    { section: 'Storage (AWS S3)', fields: [
      { key: 'aws_access_key_id', label: 'Access Key ID', type: 'password' },
      { key: 'aws_secret_access_key', label: 'Secret Access Key', type: 'password' },
      { key: 'aws_s3_bucket', label: 'S3 Bucket Name', type: 'text' },
      { key: 'aws_region', label: 'AWS Region', type: 'text' },
    ]},
    { section: 'Insurance Provider', fields: [
      { key: 'insurance_provider_api_key', label: 'API Key', type: 'password' },
      { key: 'insurance_provider_email', label: 'Provider Email', type: 'email' },
    ]},
    { section: 'GST Verification API', fields: [
      { key: 'gst_verification_api_key', label: 'API Key', type: 'password' },
      { key: 'gst_verification_api_url', label: 'API URL', type: 'text' },
      { key: 'gst_verification_enabled', label: 'Enable GST Verification', type: 'select', options: ['true', 'false'] },
    ]},
    { section: 'PAN Verification API', fields: [
      { key: 'pan_verification_api_key', label: 'API Key', type: 'password' },
      { key: 'pan_verification_api_url', label: 'API URL', type: 'text' },
      { key: 'pan_verification_enabled', label: 'Enable PAN Verification', type: 'select', options: ['true', 'false'] },
    ]},
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Global Settings</h2>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <>
          {/* Platform Settings */}
          {activeTab === 'platform' && (
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-orange-400" />
                    Platform Commission (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={platformSettings.platform_commission_percent || 10}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, platform_commission_percent: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-orange-400" />
                    Cancellation Fee (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={platformSettings.cancellation_fee_percent || 10}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, cancellation_fee_percent: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-green-400" />
                    Min Booking Amount (₹)
                  </Label>
                  <Input
                    type="number"
                    value={platformSettings.min_booking_amount || 5000}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, min_booking_amount: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-green-400" />
                    Max Booking Amount (₹)
                  </Label>
                  <Input
                    type="number"
                    value={platformSettings.max_booking_amount || 5000000}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, max_booking_amount: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-blue-400" />
                    GST (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={platformSettings.gst_percent || 18}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, gst_percent: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    Refund Processing Days
                  </Label>
                  <Input
                    type="number"
                    value={platformSettings.refund_processing_days || 7}
                    onChange={(e) => setPlatformSettings({ ...platformSettings, refund_processing_days: parseInt(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>
              <Button onClick={handleSavePlatformSettings} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          )}

          {/* Pricing Settings */}
          {activeTab === 'pricing' && (
            <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Flight Pricing</h3>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-green-400" />
                    Base Price (up to 50 km)
                  </Label>
                  <Input
                    type="number"
                    value={pricingSettings.base_price_upto_50km || 50000}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, base_price_upto_50km: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-orange-400" />
                    Rate per KM (after 50 km)
                  </Label>
                  <Input
                    type="number"
                    value={pricingSettings.rate_per_km_after_50 || 1000}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, rate_per_km_after_50: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-purple-400" />
                    Waiting Charge (per hour)
                  </Label>
                  <Input
                    type="number"
                    value={pricingSettings.waiting_charge_per_hour || 5000}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, waiting_charge_per_hour: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-cyan-400" />
                    Advance Payment (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={pricingSettings.advance_percent || 5}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, advance_percent: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>

              {/* Insurance Settings */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  Insurance Settings
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Insurance Enabled</Label>
                    <select
                      value={pricingSettings.insurance_enabled ? 'true' : 'false'}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, insurance_enabled: e.target.value === 'true' })}
                      className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Coverage Amount (₹)</Label>
                    <Input
                      type="number"
                      value={pricingSettings.insurance_coverage_amount || 10000000}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, insurance_coverage_amount: parseFloat(e.target.value) })}
                      className="bg-slate-800 border-slate-700"
                    />
                    <p className="text-xs text-slate-500">₹{((pricingSettings.insurance_coverage_amount || 10000000) / 10000000).toFixed(1)} Crore</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Rate Type</Label>
                    <select
                      value={pricingSettings.insurance_rate_type || 'fixed'}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, insurance_rate_type: e.target.value })}
                      className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                    >
                      <option value="fixed">Fixed Rate per Passenger</option>
                      <option value="percentage">Percentage of Coverage</option>
                    </select>
                  </div>
                  {pricingSettings.insurance_rate_type === 'fixed' ? (
                    <div className="space-y-2">
                      <Label>Fixed Rate (₹ per passenger)</Label>
                      <Input
                        type="number"
                        value={pricingSettings.insurance_fixed_rate || 500}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, insurance_fixed_rate: parseFloat(e.target.value) })}
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Percentage Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={pricingSettings.insurance_percentage_rate || 0.00001}
                        onChange={(e) => setPricingSettings({ ...pricingSettings, insurance_percentage_rate: parseFloat(e.target.value) })}
                        className="bg-slate-800 border-slate-700"
                      />
                      <p className="text-xs text-slate-500">
                        Premium: ₹{Math.round((pricingSettings.insurance_coverage_amount || 10000000) * (pricingSettings.insurance_percentage_rate || 0.00001) / 100)} per passenger
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleSavePricingSettings} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Pricing Settings'}
              </Button>
            </div>
          )}

          {/* API Keys Settings */}
          {activeTab === 'apikeys' && (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-yellow-400 text-sm">
                  🔐 API keys are stored securely. Enter new values to update existing keys.
                </p>
              </div>

              {apiKeyFields.map((section, idx) => (
                <div key={idx} className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
                  <h3 className="text-lg font-semibold text-white mb-4">{section.section}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {section.fields.map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label className="text-slate-400">{field.label}</Label>
                        {field.type === 'select' ? (
                          <select
                            value={apiKeys[field.key] || 'false'}
                            onChange={(e) => setApiKeys({ ...apiKeys, [field.key]: e.target.value })}
                            className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
                          >
                            {field.options.map(opt => (
                              <option key={opt} value={opt}>{opt === 'true' ? 'Yes / हाँ' : 'No / नहीं'}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="relative">
                            <Input
                              type={showApiKeys[field.key] ? 'text' : field.type}
                              value={apiKeys[field.key] || ''}
                              onChange={(e) => setApiKeys({ ...apiKeys, [field.key]: e.target.value })}
                              placeholder={`Enter ${field.label}`}
                              className="bg-slate-800 border-slate-700 pr-10"
                            />
                            {field.type === 'password' && (
                              <button
                                type="button"
                                onClick={() => toggleShowKey(field.key)}
                                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                              >
                                {showApiKeys[field.key] ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Button onClick={handleSaveApiKeys} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save API Keys'}
              </Button>
            </div>
          )}

          {/* Terms & Conditions */}
          {activeTab === 'terms' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-6">
                <h3 className="text-lg font-semibold text-white">Terms & Conditions Content</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white">Customer Terms & Conditions</Label>
                    <textarea
                      value={termsSettings.customer_terms || ''}
                      onChange={(e) => setTermsSettings({ ...termsSettings, customer_terms: e.target.value })}
                      rows="5"
                      placeholder="Enter terms for customers..."
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white">Operator Terms & Conditions</Label>
                    <textarea
                      value={termsSettings.operator_terms || ''}
                      onChange={(e) => setTermsSettings({ ...termsSettings, operator_terms: e.target.value })}
                      rows="5"
                      placeholder="Enter terms for operators..."
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white">Pilot Terms & Conditions</Label>
                    <textarea
                      value={termsSettings.pilot_terms || ''}
                      onChange={(e) => setTermsSettings({ ...termsSettings, pilot_terms: e.target.value })}
                      rows="5"
                      placeholder="Enter terms for pilots..."
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white">Privacy Policy</Label>
                    <textarea
                      value={termsSettings.privacy_policy || ''}
                      onChange={(e) => setTermsSettings({ ...termsSettings, privacy_policy: e.target.value })}
                      rows="5"
                      placeholder="Enter privacy policy..."
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white">Insurance Terms</Label>
                    <textarea
                      value={termsSettings.insurance_terms || ''}
                      onChange={(e) => setTermsSettings({ ...termsSettings, insurance_terms: e.target.value })}
                      rows="5"
                      placeholder="Enter insurance terms..."
                      className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveTerms} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                  <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Terms'}
                </Button>
              </div>

              {/* Terms Agreements Log */}
              <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Terms Agreement Records</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400">User Type</th>
                        <th className="text-left py-3 px-4 text-slate-400">Name</th>
                        <th className="text-left py-3 px-4 text-slate-400">Email</th>
                        <th className="text-left py-3 px-4 text-slate-400">Phone</th>
                        <th className="text-left py-3 px-4 text-slate-400">Verified</th>
                        <th className="text-left py-3 px-4 text-slate-400">Agreed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {termsAgreements.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-slate-500">No agreements recorded yet</td>
                        </tr>
                      ) : (
                        termsAgreements.map((agreement, idx) => (
                          <tr key={idx} className="border-b border-slate-800">
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${
                                agreement.user_type === 'customer' ? 'bg-blue-500/20 text-blue-400' :
                                agreement.user_type === 'operator' ? 'bg-green-500/20 text-green-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {agreement.user_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-white">{agreement.full_name}</td>
                            <td className="py-3 px-4 text-slate-300">{agreement.email}</td>
                            <td className="py-3 px-4 text-slate-300">{agreement.phone}</td>
                            <td className="py-3 px-4">
                              <span className="text-green-400">✓ Email & Phone</span>
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {new Date(agreement.agreed_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Regions */}
          {activeTab === 'regions' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowRegionDialog(true)} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" /> Add Region
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {regions.map(region => (
                  <div key={region.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-white font-semibold">{region.region_name}</h3>
                        <p className="text-sm text-slate-400">Code: {region.region_code}</p>
                        <p className="text-sm text-slate-400 mt-1">States: {region.states?.join(', ')}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDeleteRegion(region.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className={`mt-2 inline-block px-2 py-1 rounded-full text-xs ${
                      region.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {region.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Templates */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowTemplateDialog(true)} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" /> Add Template
                </Button>
              </div>
              <div className="space-y-4">
                {templates.map(template => (
                  <div key={template.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          {template.template_type === 'email' ? (
                            <Mail className="h-4 w-4 text-blue-400" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-green-400" />
                          )}
                          <h3 className="text-white font-semibold">{template.template_name}</h3>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{template.subject}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        template.template_type === 'email' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {template.template_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Region Dialog */}
      <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Region</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Region Name</Label>
              <Input
                value={newRegion.region_name}
                onChange={(e) => setNewRegion({ ...newRegion, region_name: e.target.value })}
                placeholder="e.g., North India"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Region Code</Label>
              <Input
                value={newRegion.region_code}
                onChange={(e) => setNewRegion({ ...newRegion, region_code: e.target.value })}
                placeholder="e.g., NORTH"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>States (comma separated)</Label>
              <Input
                value={newRegion.states}
                onChange={(e) => setNewRegion({ ...newRegion, states: e.target.value })}
                placeholder="e.g., Delhi, Punjab, Haryana"
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRegionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddRegion} className="bg-orange-500 hover:bg-orange-600">Add Region</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Add Notification Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={newTemplate.template_name}
                onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })}
                placeholder="e.g., Booking Confirmation"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                value={newTemplate.template_type}
                onChange={(e) => setNewTemplate({ ...newTemplate, template_type: e.target.value })}
                className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                placeholder="Email subject or SMS title"
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <textarea
                value={newTemplate.content}
                onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                rows="4"
                placeholder="Template content..."
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={handleAddTemplate} className="bg-orange-500 hover:bg-orange-600">Add Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GlobalSettings;
