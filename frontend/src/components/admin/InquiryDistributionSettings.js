import React, { useState, useEffect } from 'react';
import { Radio, MapPin, Bell, MessageSquare, Clock, Users, Save, RefreshCw, TestTube, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { settingsAPI } from '@/services/api';
import { toast } from 'sonner';

function InquiryDistributionSettings() {
  const [settings, setSettings] = useState({
    broadcast_radius_km: 500,
    whatsapp_enabled: true,
    in_app_enabled: true,
    max_operators_per_inquiry: 50,
    auto_expire_minutes: 30,
    enabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testCoords, setTestCoords] = useState({ lat: 28.6139, lon: 77.2090 }); // Delhi default

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.getInquiryBroadcastSettings();
      if (response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updateInquiryBroadcastSettings(settings);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestBroadcast = async () => {
    try {
      const response = await settingsAPI.testInquiryBroadcast({
        pickup_lat: testCoords.lat,
        pickup_lon: testCoords.lon,
        radius_km: settings.broadcast_radius_km
      });
      setTestResult(response.data);
      toast.success(`Found ${response.data.eligible_operators} operators within ${settings.broadcast_radius_km}km`);
    } catch (error) {
      toast.error('Test failed');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="h-5 w-5 text-orange-400" />
            Inquiry Distribution Rules</h2>
          <p className="text-slate-400 text-sm mt-1">
            Configure how booking inquiries are distributed to operators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm ${settings.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {settings.enabled ? '● Active' : '○ Disabled'}
          </span>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-white font-medium">Enable Auto-Broadcast</Label>
            <p className="text-slate-400 text-sm mt-1">
              Automatically notify operators when new inquiries are created
            </p>
          </div>
          <Checkbox
            checked={settings.enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
          />
        </div>
      </div>

      {/* Broadcast Radius */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
        <Label className="text-orange-400 mb-3 block flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Broadcast Radius (KM)</Label>
        <div className="flex items-center gap-4">
          <Input
            type="number"
            value={settings.broadcast_radius_km}
            onChange={(e) => setSettings({ ...settings, broadcast_radius_km: parseInt(e.target.value) || 500 })}
            min="50"
            max="2000"
            className="bg-slate-800 border-slate-700 w-32"
          />
          <span className="text-slate-400">KM</span>
          <div className="flex-1">
            <input
              type="range"
              min="50"
              max="1500"
              step="50"
              value={settings.broadcast_radius_km}
              onChange={(e) => setSettings({ ...settings, broadcast_radius_km: parseInt(e.target.value) })}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>50 km</span>
              <span>500 km</span>
              <span>1000 km</span>
              <span>1500 km</span>
            </div>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-2">
          Operators within this radius from pickup location will receive inquiry notifications
        </p>
      </div>

      {/* Notification Channels */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
        <Label className="text-orange-400 block">Notification Channels</Label>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-white">In-App Notification</p>
              <p className="text-slate-400 text-sm"></p>
            </div>
          </div>
          <Checkbox
            checked={settings.in_app_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, in_app_enabled: checked })}
          />
        </div>
        
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-white">WhatsApp Notification</p>
              <p className="text-slate-400 text-sm"></p>
            </div>
          </div>
          <Checkbox
            checked={settings.whatsapp_enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, whatsapp_enabled: checked })}
          />
        </div>
      </div>

      {/* Additional Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <Label className="text-slate-300 mb-2 block flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            Max Operators per Inquiry
          </Label>
          <Input
            type="number"
            value={settings.max_operators_per_inquiry}
            onChange={(e) => setSettings({ ...settings, max_operators_per_inquiry: parseInt(e.target.value) || 50 })}
            min="5"
            max="200"
            className="bg-slate-800 border-slate-700"
          />
          <p className="text-slate-500 text-xs mt-1">Maximum operators to notify per inquiry</p>
        </div>
        
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <Label className="text-slate-300 mb-2 block flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            Auto-Expire Time (Minutes)
          </Label>
          <Input
            type="number"
            value={settings.auto_expire_minutes}
            onChange={(e) => setSettings({ ...settings, auto_expire_minutes: parseInt(e.target.value) || 30 })}
            min="10"
            max="1440"
            className="bg-slate-800 border-slate-700"
          />
          <p className="text-slate-500 text-xs mt-1">Inquiry expires after this time if not accepted</p>
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full bg-orange-500 hover:bg-orange-600">
        {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>

      {/* Test Broadcast Section */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-4">
        <Label className="text-blue-400 flex items-center gap-2">
          <TestTube className="h-4 w-4" />
          Test Broadcast</Label>
        <p className="text-slate-400 text-sm">
          Test to see how many operators would receive a notification from a specific location
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-400 text-xs">Latitude</Label>
            <Input
              type="number"
              step="0.0001"
              value={testCoords.lat}
              onChange={(e) => setTestCoords({ ...testCoords, lat: parseFloat(e.target.value) })}
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Longitude</Label>
            <Input
              type="number"
              step="0.0001"
              value={testCoords.lon}
              onChange={(e) => setTestCoords({ ...testCoords, lon: parseFloat(e.target.value) })}
              className="bg-slate-800 border-slate-700"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTestCoords({ lat: 28.6139, lon: 77.2090 })}>
            Delhi
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTestCoords({ lat: 19.0760, lon: 72.8777 })}>
            Mumbai
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTestCoords({ lat: 12.9716, lon: 77.5946 })}>
            Bangalore
          </Button>
        </div>
        
        <Button onClick={handleTestBroadcast} variant="outline" className="w-full">
          <TestTube className="h-4 w-4 mr-2" />
          Run Test
        </Button>
        
        {testResult && (
          <div className="p-3 rounded-lg bg-slate-800/50 mt-4">
            <p className="text-white font-medium">
              Found {testResult.eligible_operators} eligible operators within {testResult.radius_km}km
            </p>
            {testResult.operators && testResult.operators.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto">
                {testResult.operators.map((op, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-700">
                    <span className="text-slate-300">{op.company_name}</span>
                    <span className="text-orange-400">{op.distance_km} km</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InquiryDistributionSettings;
