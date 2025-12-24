import React, { useState, useEffect } from 'react';
import { Settings, IndianRupee, Percent, Calendar, MapPin, Save, Plus, Trash2, Mail, MessageSquare, Calculator } from 'lucide-react';
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
  const [regions, setRegions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRegionDialog, setShowRegionDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
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

  const handleCreateRegion = async () => {
    try {
      await settingsAPI.createRegion({
        ...newRegion,
        states: newRegion.states.split(',').map(s => s.trim())
      });
      toast.success('Region created');
      setShowRegionDialog(false);
      setNewRegion({ region_name: '', region_code: '', states: '', is_active: true });
      loadSettings();
    } catch (error) {
      toast.error('Failed to create region');
    }
  };

  const handleCreateTemplate = async () => {
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

  const handleDeleteRegion = async (regionId) => {
    if (!window.confirm('Delete this region?')) return;
    try {
      await settingsAPI.deleteRegion(regionId);
      toast.success('Region deleted');
      loadSettings();
    } catch (error) {
      toast.error('Failed to delete region');
    }
  };

  const tabs = [
    { id: 'platform', label: 'Platform Settings', icon: Settings },
    { id: 'pricing', label: 'Pricing Settings', icon: Calculator },
    { id: 'regions', label: 'Regions', icon: MapPin },
    { id: 'templates', label: 'Notification Templates', icon: Mail },
  ];

  return (
    <div className="space-y-6" data-testid="global-settings">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Settings className="h-8 w-8 text-orange-400" />
          Global Settings
        </h1>
        <p className="text-slate-400 mt-1">Configure platform-wide settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
                <h3 className="text-lg font-semibold text-white">Helicopter Charter Pricing</h3>
                <p className="text-sm text-slate-400">Configure pricing for customer bookings</p>
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
                  <p className="text-xs text-slate-500">Minimum price for flights up to 50 km</p>
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
                  <p className="text-xs text-slate-500">Additional charge per km beyond 50 km</p>
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
                  <p className="text-xs text-slate-500">Charge per hour of waiting time</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-blue-400" />
                    GST (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={pricingSettings.gst_percent || 18}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, gst_percent: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-cyan-400" />
                    Advance Payment (%)
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={pricingSettings.advance_percent || 5}
                    onChange={(e) => setPricingSettings({ ...pricingSettings, advance_percent: parseFloat(e.target.value) })}
                    className="bg-slate-800 border-slate-700 max-w-xs"
                  />
                  <p className="text-xs text-slate-500">Percentage of total amount required as advance payment</p>
                </div>
              </div>
              
              {/* Price Preview */}
              <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <h4 className="text-white font-medium mb-3">Price Preview (Example: 100 km trip)</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Base Price (50 km)</span>
                    <span className="text-white">₹{(pricingSettings.base_price_upto_50km || 50000).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Extra 50 km</span>
                    <span className="text-white">₹{(50 * (pricingSettings.rate_per_km_after_50 || 1000)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-white">₹{((pricingSettings.base_price_upto_50km || 50000) + 50 * (pricingSettings.rate_per_km_after_50 || 1000)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">GST ({pricingSettings.gst_percent || 18}%)</span>
                    <span className="text-white">₹{Math.round(((pricingSettings.base_price_upto_50km || 50000) + 50 * (pricingSettings.rate_per_km_after_50 || 1000)) * (pricingSettings.gst_percent || 18) / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between col-span-2 pt-2 border-t border-slate-700">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-orange-400 font-bold">₹{Math.round(((pricingSettings.base_price_upto_50km || 50000) + 50 * (pricingSettings.rate_per_km_after_50 || 1000)) * (1 + (pricingSettings.gst_percent || 18) / 100)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-cyan-400">Advance Payment ({pricingSettings.advance_percent || 5}%)</span>
                    <span className="text-cyan-400 font-semibold">₹{Math.round(((pricingSettings.base_price_upto_50km || 50000) + 50 * (pricingSettings.rate_per_km_after_50 || 1000)) * (1 + (pricingSettings.gst_percent || 18) / 100) * (pricingSettings.advance_percent || 5) / 100).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <Button onClick={handleSavePricingSettings} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Pricing Settings'}
              </Button>
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
                        <h3 className="text-white font-semibold flex items-center gap-2">
                          {template.template_type === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                          {template.template_name}
                        </h3>
                        <p className="text-sm text-slate-400">Type: {template.template_type}</p>
                        {template.subject && <p className="text-sm text-slate-400">Subject: {template.subject}</p>}
                      </div>
                      <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs">{template.template_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Region Dialog */}
      <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader><DialogTitle>Add Region</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Region Name</Label>
              <Input value={newRegion.region_name} onChange={(e) => setNewRegion({ ...newRegion, region_name: e.target.value })} className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <Label>Region Code</Label>
              <Input value={newRegion.region_code} onChange={(e) => setNewRegion({ ...newRegion, region_code: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="e.g., WEST" />
            </div>
            <div className="space-y-2">
              <Label>States (comma separated)</Label>
              <Input value={newRegion.states} onChange={(e) => setNewRegion({ ...newRegion, states: e.target.value })} className="bg-slate-800 border-slate-700" placeholder="Maharashtra, Gujarat, Goa" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegionDialog(false)} className="border-slate-600">Cancel</Button>
            <Button onClick={handleCreateRegion} className="bg-orange-500 hover:bg-orange-600">Create Region</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader><DialogTitle>Add Notification Template</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={newTemplate.template_name} onChange={(e) => setNewTemplate({ ...newTemplate, template_name: e.target.value })} className="bg-slate-800 border-slate-700" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select value={newTemplate.template_type} onChange={(e) => setNewTemplate({ ...newTemplate, template_type: e.target.value })} className="w-full p-2 rounded bg-slate-800 border-slate-700">
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            {newTemplate.template_type === 'email' && (
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={newTemplate.subject} onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })} className="bg-slate-800 border-slate-700" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Content</Label>
              <textarea value={newTemplate.content} onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })} className="w-full p-3 rounded bg-slate-800 border-slate-700 h-32" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)} className="border-slate-600">Cancel</Button>
            <Button onClick={handleCreateTemplate} className="bg-orange-500 hover:bg-orange-600">Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GlobalSettings;
