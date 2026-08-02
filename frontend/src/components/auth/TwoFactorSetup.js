import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Shield, Smartphone, Key, Copy, Check, AlertTriangle, 
  RefreshCw, Eye, EyeOff, Trash2, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * TOTP Two-Factor Authentication Setup Component
 * Enables users to set up Google Authenticator
 */
function TwoFactorSetup({ user, onStatusChange }) {
  const [status, setStatus] = useState({ enabled: false, setup_pending: false });
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/2fa/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        onStatusChange?.(data);
      }
    } catch (err) {
      console.error('Error fetching 2FA status:', err);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.detail || 'Setup failed');
        return;
      }
      
      setSetupData(data);
      setRecoveryCodes(data.recovery_codes || []);
      toast.success('QR code generated! अब Google Authenticator में scan करें');
    } catch (err) {
      toast.error('Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (verifyCode.length !== 6) {
      toast.error('Please enter 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/2fa/verify-setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: verifyCode })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.detail || 'Verification failed');
        return;
      }
      
      toast.success('2FA enabled successfully! / 2FA सफलतापूर्वक enable हुआ');
      setSetupData(null);
      setVerifyCode('');
      setShowRecoveryCodes(true);
      fetchStatus();
    } catch (err) {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!disablePassword) {
      toast.error('Password required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: disablePassword })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.detail || 'Failed to disable 2FA');
        return;
      }
      
      toast.success('2FA disabled / 2FA बंद कर दिया गया');
      setShowDisableModal(false);
      setDisablePassword('');
      fetchStatus();
    } catch (err) {
      toast.error('Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const regenerateRecoveryCodes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/2fa/regenerate-recovery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.detail || 'Failed to regenerate codes');
        return;
      }
      
      setRecoveryCodes(data.recovery_codes);
      setShowRecoveryCodes(true);
      toast.success('New recovery codes generated!');
    } catch (err) {
      toast.error('Failed to regenerate codes');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(index);
      setTimeout(() => setCopiedCode(null), 2000);
      toast.success('Copied!');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const downloadRecoveryCodes = () => {
    const content = `AirYatra 2FA Recovery Codes
Generated: ${new Date().toLocaleString()}
User: ${user?.email}

IMPORTANT: Store these codes safely. Each code can only be used once.

${recoveryCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

---
These codes allow you to access your account if you lose your phone.
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airyatra-2fa-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Recovery codes downloaded');
  };

  if (loading && !setupData) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 text-orange-500 animate-spin mr-2" />
          <span className="text-slate-400">Loading 2FA status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden" data-testid="two-factor-setup">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-white">
            Two-Factor Authentication / दो-चरणीय प्रमाणीकरण
          </h3>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          Google Authenticator से अपने account को extra secure करें
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status.enabled ? 'bg-green-500/20' : 'bg-slate-700'}`}>
              <Shield className={`h-6 w-6 ${status.enabled ? 'text-green-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="font-medium text-white">
                {status.enabled ? '2FA Enabled / सक्रिय' : '2FA Disabled / निष्क्रिय'}
              </p>
              {status.enabled && status.recovery_codes_remaining !== undefined && (
                <p className="text-xs text-slate-400">
                  {status.recovery_codes_remaining} recovery codes remaining
                </p>
              )}
            </div>
          </div>
          
          {status.enabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisableModal(true)}
              className="text-red-400 border-red-400/30 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Disable
            </Button>
          )}
        </div>

        {/* Setup Flow */}
        {!status.enabled && !setupData && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="font-medium text-white mb-2">How it works / कैसे काम करता है:</h4>
            <ol className="text-sm text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <span>Google Authenticator app download करें (iOS/Android)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span>QR code scan करें app में</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <span>6-digit code enter करें verify करने के लिए</span>
              </li>
            </ol>
            
            <Button 
              onClick={startSetup}
              disabled={loading}
              className="mt-4 bg-orange-500 hover:bg-orange-600"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              Setup 2FA
            </Button>
          </div>
        )}

        {/* QR Code Display */}
        {setupData && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-400 mb-4">
                इस QR code को Google Authenticator में scan करें
              </p>
              
              <div className="inline-block bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={setupData.provisioning_uri} 
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
              
              {/* Manual Entry Option */}
              <div className="mt-4">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-orange-400 hover:underline flex items-center gap-1 mx-auto"
                >
                  {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showSecret ? 'Hide secret key' : 'Can\'t scan? Enter manually'}
                </button>
                
                {showSecret && (
                  <div className="mt-2 bg-slate-900 p-3 rounded border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Secret Key:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-orange-400 font-mono">{setupData.secret}</code>
                      <button
                        onClick={() => copyToClipboard(setupData.secret, 'secret')}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        {copiedCode === 'secret' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Verify Code */}
            <div className="space-y-3">
              <Label className="text-white">Enter 6-digit code from app:</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]*"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  className="bg-slate-800 border-slate-700 text-white text-center text-2xl tracking-widest font-mono"
                  data-testid="totp-verify-input"
                />
                <Button
                  onClick={verifySetup}
                  disabled={loading || verifyCode.length !== 6}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
            </div>

            {/* Recovery Codes Warning */}
            {recoveryCodes.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-200 font-medium">
                      Save your recovery codes! / Recovery codes save करें!
                    </p>
                    <p className="text-xs text-yellow-200/70 mt-1">
                      ये codes phone खो जाने पर account access करने में मदद करेंगे
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recovery Codes Display */}
        {(showRecoveryCodes || (status.enabled && recoveryCodes.length > 0)) && recoveryCodes.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-orange-500" />
                Recovery Codes
              </h4>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadRecoveryCodes}
                  className="text-slate-400 hover:text-white"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                {status.enabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={regenerateRecoveryCodes}
                    disabled={loading}
                    className="text-slate-400 hover:text-white"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    New Codes
                  </Button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700"
                >
                  <code className="text-sm text-slate-300 font-mono">{code}</code>
                  <button
                    onClick={() => copyToClipboard(code, index)}
                    className="p-1 hover:bg-slate-700 rounded"
                  >
                    {copiedCode === index ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-slate-500 mt-3">
              Each code can only be used once. Store them safely.
            </p>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecoveryCodes(false)}
              className="mt-3"
            >
              Hide Codes
            </Button>
          </div>
        )}

        {/* Disable Modal */}
        {showDisableModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-white mb-2">Disable 2FA</h3>
              <p className="text-sm text-slate-400 mb-4">
                Are you sure? This will make your account less secure.
                Enter your password to confirm.
              </p>
              
              <Input
                type="password"
                placeholder="Enter your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white mb-4"
              />
              
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDisableModal(false);
                    setDisablePassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={disable2FA}
                  disabled={loading || !disablePassword}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Disable 2FA
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TwoFactorSetup;
