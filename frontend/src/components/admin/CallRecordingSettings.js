import React, { useState, useEffect } from 'react';
import { 
  Phone, Settings, Save, Loader2, CheckCircle, XCircle, 
  AlertTriangle, ExternalLink, Play, Pause, Volume2, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function CallRecordingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    call_recording_enabled: 'false',
    call_provider: 'twilio',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    exotel_sid: '',
    exotel_token: '',
    exotel_subdomain: '',
    exotel_caller_id: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/call-recording');
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.log('Call recording settings not found, using defaults');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings/call-recording', settings);
      toast.success('Call recording settings saved! / कॉल रिकॉर्डिंग सेटिंग्स सेव हो गईं!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Phone className="h-6 w-6 text-green-400" />
            Call Recording Settings / कॉल रिकॉर्डिंग सेटिंग्स
          </h2>
          <p className="text-slate-400 mt-1">
            Configure call recording integration for CRM
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-500 hover:bg-green-600"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-200 font-medium">How Call Recording Works</p>
          <p className="text-blue-200/70 text-sm mt-1">
            When a sales person makes a call from CRM, the call goes through your chosen provider 
            (Twilio/Exotel). The provider records the call and stores the recording URL, 
            which is then linked to the lead's call history in CRM.
          </p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">Call Recording</h3>
            <p className="text-slate-400 text-sm">Enable automatic call recording for all CRM calls</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={settings.call_recording_enabled === 'true'}
              onChange={(e) => handleChange('call_recording_enabled', e.target.checked ? 'true' : 'false')}
            />
            <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            <span className="ml-2 text-sm text-slate-300">
              {settings.call_recording_enabled === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Select Provider / प्रोवाइडर चुनें</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleChange('call_provider', 'twilio')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              settings.call_provider === 'twilio'
                ? 'border-red-500 bg-red-500/10'
                : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📞</span>
              </div>
              <div>
                <p className="text-white font-semibold">Twilio</p>
                <p className="text-slate-400 text-xs">Global cloud communications</p>
              </div>
              {settings.call_provider === 'twilio' && (
                <CheckCircle className="h-5 w-5 text-red-400 ml-auto" />
              )}
            </div>
          </button>
          
          <button
            onClick={() => handleChange('call_provider', 'exotel')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              settings.call_provider === 'exotel'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">☎️</span>
              </div>
              <div>
                <p className="text-white font-semibold">Exotel</p>
                <p className="text-slate-400 text-xs">India-focused cloud telephony</p>
              </div>
              {settings.call_provider === 'exotel' && (
                <CheckCircle className="h-5 w-5 text-blue-400 ml-auto" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Twilio Configuration */}
      {settings.call_provider === 'twilio' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-2xl">📞</span>
              Twilio Configuration
            </h3>
            <a 
              href="https://console.twilio.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
            >
              Get API Keys <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Account SID</Label>
              <Input
                value={settings.twilio_account_sid}
                onChange={(e) => handleChange('twilio_account_sid', e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Auth Token</Label>
              <Input
                type="password"
                value={settings.twilio_auth_token}
                onChange={(e) => handleChange('twilio_auth_token', e.target.value)}
                placeholder="Your Twilio Auth Token"
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Phone Number (with country code)</Label>
              <Input
                value={settings.twilio_phone_number}
                onChange={(e) => handleChange('twilio_phone_number', e.target.value)}
                placeholder="+1234567890"
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400 text-sm">
              <span className="text-red-400 font-medium">Setup Steps:</span>
            </p>
            <ol className="text-slate-400 text-sm mt-2 list-decimal list-inside space-y-1">
              <li>Sign up at <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-red-400">twilio.com</a></li>
              <li>Get Account SID and Auth Token from Console</li>
              <li>Buy a phone number with Voice capability</li>
              <li>Enable call recording in Twilio settings</li>
            </ol>
          </div>
        </div>
      )}

      {/* Exotel Configuration */}
      {settings.call_provider === 'exotel' && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span className="text-2xl">☎️</span>
              Exotel Configuration
            </h3>
            <a 
              href="https://my.exotel.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              Get API Keys <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Exotel SID (Account SID)</Label>
              <Input
                value={settings.exotel_sid}
                onChange={(e) => handleChange('exotel_sid', e.target.value)}
                placeholder="Your Exotel Account SID"
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">API Token</Label>
              <Input
                type="password"
                value={settings.exotel_token}
                onChange={(e) => handleChange('exotel_token', e.target.value)}
                placeholder="Your Exotel API Token"
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Subdomain</Label>
              <Input
                value={settings.exotel_subdomain}
                onChange={(e) => handleChange('exotel_subdomain', e.target.value)}
                placeholder="api.exotel.com or your custom subdomain"
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Caller ID (Exophone Number)</Label>
              <Input
                value={settings.exotel_caller_id}
                onChange={(e) => handleChange('exotel_caller_id', e.target.value)}
                placeholder="Your Exophone number"
                className="bg-slate-900 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400 text-sm">
              <span className="text-blue-400 font-medium">Setup Steps:</span>
            </p>
            <ol className="text-slate-400 text-sm mt-2 list-decimal list-inside space-y-1">
              <li>Sign up at <a href="https://exotel.com" target="_blank" rel="noopener noreferrer" className="text-blue-400">exotel.com</a></li>
              <li>Get API credentials from Dashboard → Settings → API</li>
              <li>Purchase an Exophone (virtual number)</li>
              <li>Enable call recording in Exotel settings</li>
            </ol>
          </div>
        </div>
      )}

      {/* Call Recording Features Info */}
      <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-xl p-6 border border-green-500/30">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-green-400" />
          Call Recording Features / कॉल रिकॉर्डिंग सुविधाएं
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Play className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Click-to-Call</p>
              <p className="text-slate-400 text-xs">Call leads directly from CRM</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Volume2 className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Auto Recording</p>
              <p className="text-slate-400 text-xs">All calls recorded automatically</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Download className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Download & Playback</p>
              <p className="text-slate-400 text-xs">Listen to calls in CRM</p>
            </div>
          </div>
        </div>
      </div>

      {settings.call_recording_enabled !== 'true' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-200 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Call recording is currently disabled. Enable it and configure your provider to start recording calls.
          </p>
        </div>
      )}
    </div>
  );
}

export default CallRecordingSettings;
