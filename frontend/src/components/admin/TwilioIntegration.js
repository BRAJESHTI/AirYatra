import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, PhoneOff, Settings, Play, Pause, Download, Mic, Clock, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { integrationsAPI } from '@/services/api';

export default function TwilioIntegration() {
  const [dashboard, setDashboard] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    account_sid: '',
    auth_token: '',
    phone_number: '',
    recording_enabled: true,
    webhook_url: ''
  });
  const [calls, setCalls] = useState([]);
  const [callForm, setCallForm] = useState({ to_number: '', call_type: 'support' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, configRes, callsRes] = await Promise.all([
        integrationsAPI.getTwilioDashboard(),
        integrationsAPI.getTwilioConfig(),
        integrationsAPI.getTwilioCalls()
      ]);
      setDashboard(dashRes.data);
      setConfig(configRes.data);
      setCalls(callsRes.data.calls || []);
    } catch (error) {
      console.error('Failed to load Twilio data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      await integrationsAPI.updateTwilioConfig(configForm);
      setShowConfig(false);
      loadData();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const initiateCall = async () => {
    try {
      await integrationsAPI.initiateCall(callForm);
      setCallForm({ to_number: '', call_type: 'support' });
      loadData();
    } catch (error) {
      console.error('Failed to initiate call:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-white">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Twilio Integration / ट्विलियो इंटीग्रेशन</h2>
          <p className="text-slate-400">Call Recording & VoIP Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfig(!showConfig)}>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <PhoneCall className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.total_calls || 0}</p>
                <p className="text-slate-400 text-sm">Total Calls / कुल कॉल</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Phone className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.today_calls || 0}</p>
                <p className="text-slate-400 text-sm">Today's Calls / आज की कॉल</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Clock className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.total_duration_minutes || 0} min</p>
                <p className="text-slate-400 text-sm">Total Duration / कुल अवधि</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <Mic className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.recordings_count || 0}</p>
                <p className="text-slate-400 text-sm">Recordings / रिकॉर्डिंग</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Settings className="h-5 w-5 mr-2" /> Twilio Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Account SID</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="ACxxxxxxxxxxxx"
                  value={configForm.account_sid}
                  onChange={(e) => setConfigForm({...configForm, account_sid: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Auth Token</Label>
                <Input
                  type="password"
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="Your auth token"
                  value={configForm.auth_token}
                  onChange={(e) => setConfigForm({...configForm, auth_token: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Twilio Phone Number</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="+1234567890"
                  value={configForm.phone_number}
                  onChange={(e) => setConfigForm({...configForm, phone_number: e.target.value})}
                />
              </div>
              <div>
                <Label className="text-slate-300">Webhook URL</Label>
                <Input
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="https://your-domain.com/api/twilio/webhook"
                  value={configForm.webhook_url}
                  onChange={(e) => setConfigForm({...configForm, webhook_url: e.target.value})}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={configForm.recording_enabled}
                onChange={(e) => setConfigForm({...configForm, recording_enabled: e.target.checked})}
                className="rounded border-slate-600"
              />
              <Label className="text-slate-300">Enable Call Recording</Label>
            </div>
            <Button onClick={saveConfig} className="bg-orange-500 hover:bg-orange-600">
              Save Configuration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Make Call Panel */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Make a Call / कॉल करें</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              className="bg-slate-700 border-slate-600 text-white flex-1"
              placeholder="Enter phone number (+91...)"
              value={callForm.to_number}
              onChange={(e) => setCallForm({...callForm, to_number: e.target.value})}
            />
            <select
              className="bg-slate-700 border-slate-600 text-white rounded-md px-3"
              value={callForm.call_type}
              onChange={(e) => setCallForm({...callForm, call_type: e.target.value})}
            >
              <option value="support">Support</option>
              <option value="sales">Sales</option>
              <option value="outbound">Outbound</option>
            </select>
            <Button onClick={initiateCall} className="bg-green-500 hover:bg-green-600">
              <Phone className="h-4 w-4 mr-2" /> Call
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Call Logs */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Call Logs / कॉल लॉग</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {calls.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No calls yet</p>
            ) : (
              calls.map((call, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${call.status === 'completed' ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                      {call.status === 'completed' ? (
                        <PhoneOff className="h-4 w-4 text-green-400" />
                      ) : (
                        <PhoneCall className="h-4 w-4 text-yellow-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">{call.to_number}</p>
                      <p className="text-slate-400 text-sm">{call.call_type} • {call.duration}s</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {call.recording_url && (
                      <Button size="sm" variant="outline">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <span className="text-slate-400 text-sm">{new Date(call.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <div className="text-center text-slate-500 text-sm">
        {dashboard?.is_configured ? (
          <span className="text-green-400">✓ Twilio Connected</span>
        ) : (
          <span className="text-yellow-400">⚠ Demo Mode - Configure Twilio credentials to enable live calls</span>
        )}
      </div>
    </div>
  );
}
