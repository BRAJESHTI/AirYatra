import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Key, RefreshCw, CheckCircle, XCircle, AlertTriangle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function TwoFactorAuth() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get('/2fa/status');
      setStatus(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const setup2FA = async () => {
    try {
      const res = await api.post('/2fa/setup');
      setSetupData(res.data);
      setShowSetup(true);
    } catch (error) { alert(error.response?.data?.detail || 'Failed'); }
  };

  const verify2FA = async () => {
    try {
      await api.post('/2fa/verify', { code: verifyCode });
      alert('2FA enabled successfully!');
      setShowSetup(false);
      loadStatus();
    } catch (error) { alert('Invalid code'); }
  };

  const disable2FA = async () => {
    if (!window.confirm('Are you sure you want to disable 2FA?')) return;
    try {
      await api.post('/2fa/disable');
      alert('2FA disabled');
      loadStatus();
    } catch (error) { alert(error.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Shield className="h-6 w-6 mr-2 text-green-500" /> Two-Factor Authentication
          </h1>
          <p className="text-slate-400">Enhanced account security with 2FA</p>
        </div>
        <Button onClick={loadStatus} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Current Status</h2>
          <div className="flex items-center space-x-4 p-4 rounded-lg mb-4" style={{ backgroundColor: status?.enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
            {status?.enabled ? (
              <CheckCircle className="h-8 w-8 text-green-400" />
            ) : (
              <XCircle className="h-8 w-8 text-red-400" />
            )}
            <div>
              <p className="text-white font-medium">2FA is {status?.enabled ? 'Enabled' : 'Disabled'}</p>
              <p className="text-slate-400 text-sm">{status?.enabled ? 'Your account is protected' : 'Enable for enhanced security'}</p>
            </div>
          </div>

          {status?.enabled ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <p className="text-slate-400 text-sm">Method</p>
                <p className="text-white font-medium">{status.method || 'Authenticator App'}</p>
              </div>
              <div className="p-4 bg-slate-900 rounded-lg">
                <p className="text-slate-400 text-sm">Last Used</p>
                <p className="text-white font-medium">{status.last_used || 'Never'}</p>
              </div>
              <Button onClick={disable2FA} variant="outline" className="w-full text-red-400 border-red-500 hover:bg-red-500/20">
                <XCircle className="h-4 w-4 mr-2" /> Disable 2FA
              </Button>
            </div>
          ) : (
            <Button onClick={setup2FA} className="w-full bg-green-500">
              <Shield className="h-4 w-4 mr-2" /> Enable 2FA
            </Button>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Security Tips</h2>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-slate-900 rounded-lg">
              <Smartphone className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Use Authenticator App</p>
                <p className="text-slate-400 text-sm">Google Authenticator or Authy recommended</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-slate-900 rounded-lg">
              <Key className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Save Backup Codes</p>
                <p className="text-slate-400 text-sm">Keep them in a safe place offline</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 bg-slate-900 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Never Share Codes</p>
                <p className="text-slate-400 text-sm">2FA codes are personal and time-sensitive</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSetup && setupData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Setup 2FA</h3>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg flex justify-center">
                <div className="w-48 h-48 bg-slate-200 flex items-center justify-center">
                  <p className="text-slate-500 text-center text-sm">QR Code<br/>Scan with app</p>
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between">
                <code className="text-white text-sm">{setupData.secret || 'XXXX-XXXX-XXXX-XXXX'}</code>
                <Button size="sm" variant="ghost"><Copy className="h-4 w-4" /></Button>
              </div>
              <Input placeholder="Enter 6-digit code" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} className="bg-slate-700 text-center text-2xl tracking-widest" maxLength={6} />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowSetup(false)}>Cancel</Button>
              <Button onClick={verify2FA} className="bg-green-500">Verify & Enable</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TwoFactorAuth;
