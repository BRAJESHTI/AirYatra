import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, Loader2, CheckCircle, XCircle, Eye, EyeOff,
  Shield, Key, Globe, AlertTriangle, RefreshCw, TestTube
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function APIKeysSettings({ user }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({ gst: false, pan: false });
  const [showKeys, setShowKeys] = useState({ gst: false, pan: false });
  const [settings, setSettings] = useState({
    // GST Verification
    gst_verification_enabled: 'false',
    gst_verification_api_key: '',
    gst_verification_api_url: '',
    gst_test_result: null,
    
    // PAN Verification
    pan_verification_enabled: 'false',
    pan_verification_api_key: '',
    pan_verification_api_url: '',
    pan_test_result: null,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings/api-keys');
      if (response.data) {
        setSettings(prev => ({
          ...prev,
          ...response.data
        }));
      }
    } catch (error) {
      console.log('Settings not found, using defaults');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings/api-keys', settings);
      toast.success('API settings saved successfully! / API सेटिंग्स सेव हो गईं!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testGSTAPI = async () => {
    if (!settings.gst_verification_api_key || !settings.gst_verification_api_url) {
      toast.error('Please configure GST API URL and Key first');
      return;
    }
    
    setTesting(prev => ({ ...prev, gst: true }));
    try {
      // Test with sample GSTIN
      const response = await api.post('/verification/gst/verify', {
        gstin: '27AABCU9603R1ZM'  // Sample GSTIN
      });
      
      if (response.data.verified) {
        setSettings(prev => ({ ...prev, gst_test_result: 'success' }));
        toast.success('GST API test successful!');
      } else {
        setSettings(prev => ({ ...prev, gst_test_result: 'failed' }));
        toast.warning('GST API returned but verification failed');
      }
    } catch (error) {
      setSettings(prev => ({ ...prev, gst_test_result: 'error' }));
      toast.error('GST API test failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTesting(prev => ({ ...prev, gst: false }));
    }
  };

  const testPANAPI = async () => {
    if (!settings.pan_verification_api_key || !settings.pan_verification_api_url) {
      toast.error('Please configure PAN API URL and Key first');
      return;
    }
    
    setTesting(prev => ({ ...prev, pan: true }));
    try {
      // Test with sample PAN
      const response = await api.post('/verification/pan/verify', {
        pan: 'ABCDE1234F'  // Sample PAN
      });
      
      if (response.data.verified) {
        setSettings(prev => ({ ...prev, pan_test_result: 'success' }));
        toast.success('PAN API test successful!');
      } else {
        setSettings(prev => ({ ...prev, pan_test_result: 'failed' }));
        toast.warning('PAN API returned but verification failed');
      }
    } catch (error) {
      setSettings(prev => ({ ...prev, pan_test_result: 'error' }));
      toast.error('PAN API test failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTesting(prev => ({ ...prev, pan: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key className="h-6 w-6 text-yellow-400" />
            API Keys Configuration / API कुंजी विन्यास
          </h2>
          <p className="text-slate-400 mt-1">
            Configure external verification APIs for GST and PAN
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-500 hover:bg-purple-600"
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

      {/* Warning Note */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-200 font-medium">Important Note / महत्वपूर्ण सूचना</p>
          <p className="text-yellow-200/70 text-sm mt-1">
            API keys are sensitive. Keep them secure and never share. When APIs are disabled, the system uses sample/mocked data for testing.
          </p>
          <p className="text-yellow-200/70 text-sm">
            API कुंजियाँ संवेदनशील हैं। उन्हें सुरक्षित रखें। जब API अक्षम होते हैं, सिस्टम परीक्षण के लिए नमूना डेटा का उपयोग करता है।
          </p>
        </div>
      </div>

      {/* GST Verification API */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            GST Verification API / GST सत्यापन API
          </h3>
          <div className="flex items-center gap-3">
            {settings.gst_test_result && (
              <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                settings.gst_test_result === 'success' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {settings.gst_test_result === 'success' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {settings.gst_test_result === 'success' ? 'Working' : 'Failed'}
              </span>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.gst_verification_enabled === 'true'}
                onChange={(e) => handleChange('gst_verification_enabled', e.target.checked ? 'true' : 'false')}
              />
              <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              <span className="ml-2 text-sm text-slate-300">
                {settings.gst_verification_enabled === 'true' ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="text-slate-300">API URL</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={settings.gst_verification_api_url}
                onChange={(e) => handleChange('gst_verification_api_url', e.target.value)}
                placeholder="https://api.example.com/gst/verify"
                className="bg-slate-900 border-slate-600 text-white"
              />
              <Button variant="outline" className="border-slate-600" onClick={() => window.open('https://rapidapi.com/search/gst%20verification', '_blank')}>
                <Globe className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-slate-500 text-xs mt-1">Example providers: RapidAPI, Sandbox, GSTN</p>
          </div>
          
          <div className="md:col-span-2">
            <Label className="text-slate-300">API Key</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Input
                  type={showKeys.gst ? 'text' : 'password'}
                  value={settings.gst_verification_api_key}
                  onChange={(e) => handleChange('gst_verification_api_key', e.target.value)}
                  placeholder="Enter your GST API key"
                  className="bg-slate-900 border-slate-600 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(prev => ({ ...prev, gst: !prev.gst }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showKeys.gst ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                className="border-slate-600"
                onClick={testGSTAPI}
                disabled={testing.gst || settings.gst_verification_enabled !== 'true'}
              >
                {testing.gst ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                Test
              </Button>
            </div>
          </div>
        </div>

        {settings.gst_verification_enabled !== 'true' && (
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400 text-sm">
              <span className="text-yellow-400">Mocked Mode:</span> Using sample GST data for testing. 
              Enable API and configure keys for live verification.
            </p>
          </div>
        )}
      </div>

      {/* PAN Verification API */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" />
            PAN Verification API / PAN सत्यापन API
          </h3>
          <div className="flex items-center gap-3">
            {settings.pan_test_result && (
              <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                settings.pan_test_result === 'success' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {settings.pan_test_result === 'success' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {settings.pan_test_result === 'success' ? 'Working' : 'Failed'}
              </span>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.pan_verification_enabled === 'true'}
                onChange={(e) => handleChange('pan_verification_enabled', e.target.checked ? 'true' : 'false')}
              />
              <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              <span className="ml-2 text-sm text-slate-300">
                {settings.pan_verification_enabled === 'true' ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="text-slate-300">API URL</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={settings.pan_verification_api_url}
                onChange={(e) => handleChange('pan_verification_api_url', e.target.value)}
                placeholder="https://api.example.com/pan/verify"
                className="bg-slate-900 border-slate-600 text-white"
              />
              <Button variant="outline" className="border-slate-600" onClick={() => window.open('https://rapidapi.com/search/pan%20verification', '_blank')}>
                <Globe className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-slate-500 text-xs mt-1">Example providers: RapidAPI, Sandbox, NSDL</p>
          </div>
          
          <div className="md:col-span-2">
            <Label className="text-slate-300">API Key</Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Input
                  type={showKeys.pan ? 'text' : 'password'}
                  value={settings.pan_verification_api_key}
                  onChange={(e) => handleChange('pan_verification_api_key', e.target.value)}
                  placeholder="Enter your PAN API key"
                  className="bg-slate-900 border-slate-600 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(prev => ({ ...prev, pan: !prev.pan }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showKeys.pan ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                className="border-slate-600"
                onClick={testPANAPI}
                disabled={testing.pan || settings.pan_verification_enabled !== 'true'}
              >
                {testing.pan ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                Test
              </Button>
            </div>
          </div>
        </div>

        {settings.pan_verification_enabled !== 'true' && (
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <p className="text-slate-400 text-sm">
              <span className="text-yellow-400">Mocked Mode:</span> Using sample PAN data for testing. 
              Enable API and configure keys for live verification.
            </p>
          </div>
        )}
      </div>

      {/* Sample Data Info */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TestTube className="h-5 w-5 text-purple-400" />
          Sample Test Data / नमूना परीक्षण डेटा
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          Use these sample numbers for testing when APIs are disabled:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-white font-medium mb-2">Sample GST Numbers:</h4>
            <ul className="space-y-1 text-sm">
              <li className="text-slate-300"><code className="bg-slate-900 px-2 py-0.5 rounded">27AABCU9603R1ZM</code> - Infosys</li>
              <li className="text-slate-300"><code className="bg-slate-900 px-2 py-0.5 rounded">07AABCT1332L1ZD</code> - TCS</li>
              <li className="text-slate-300"><code className="bg-slate-900 px-2 py-0.5 rounded">06AABCR9876H1ZP</code> - Reliance</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-2">Sample PAN Numbers:</h4>
            <ul className="space-y-1 text-sm">
              <li className="text-slate-300"><code className="bg-slate-900 px-2 py-0.5 rounded">ABCDE1234F</code> - Rahul Sharma</li>
              <li className="text-slate-300"><code className="bg-slate-900 px-2 py-0.5 rounded">PQRST5678G</code> - Priya Gupta</li>
              <li className="text-slate-300"><code className="bg-slate-900 px-2 py-0.5 rounded">AABCU9603R</code> - Infosys Ltd</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default APIKeysSettings;
