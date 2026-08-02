import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Unlock, Loader2, CheckCircle, XCircle, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Account Unlock Page
 * Accessible via email link: /unlock-account?email=xxx&token=xxx
 */
const UnlockAccountPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('pending'); // pending, loading, success, error
  const [message, setMessage] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const email = searchParams.get('email');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!email || !token) {
      setStatus('error');
      setMessage('Invalid unlock link. Please check your email for the correct link.');
    }
  }, [email, token]);

  const handleUnlock = async () => {
    if (!email || !token) return;
    
    setUnlocking(true);
    setStatus('loading');
    
    try {
      const response = await axios.post(`${API_URL}/api/auth/unlock-account`, {
        email,
        token
      });
      
      if (response.data.success) {
        setStatus('success');
        setMessage(response.data.message || 'Account unlocked successfully!');
        toast.success('Account unlocked! You can now login.');
      } else {
        setStatus('error');
        setMessage(response.data.detail || 'Failed to unlock account');
      }
    } catch (error) {
      setStatus('error');
      const detail = error.response?.data?.detail;
      setMessage(typeof detail === 'string' ? detail : 'Failed to unlock account. The link may have expired.');
    } finally {
      setUnlocking(false);
    }
  };

  const goToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-700">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'success' ? (
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
            ) : status === 'error' ? (
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-400" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center">
                <Lock className="h-10 w-10 text-orange-400" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {status === 'success' ? 'Account Unlocked!' : status === 'error' ? 'Unlock Failed' : 'Unlock Your Account'}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {status === 'success' 
              ? 'Your account has been successfully unlocked.'
              : status === 'error'
              ? message
              : 'Click the button below to unlock your AirYatra account.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Email Display */}
          {email && status !== 'error' && (
            <div className="p-4 bg-slate-800 rounded-lg">
              <p className="text-slate-400 text-sm">Account Email</p>
              <p className="text-white font-medium">{email}</p>
            </div>
          )}

          {/* Status Messages */}
          {status === 'pending' && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 font-medium">Account Locked</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Your account was locked due to multiple failed login attempts.
                      Click below to unlock it.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleUnlock}
                disabled={unlocking}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                size="lg"
                data-testid="unlock-account-btn"
              >
                {unlocking ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Unlocking...
                  </>
                ) : (
                  <>
                    <Unlock className="h-5 w-5 mr-2" />
                    Unlock My Account
                  </>
                )}
              </Button>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-12 w-12 text-orange-400 animate-spin mb-4" />
              <p className="text-slate-400">Unlocking your account...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-medium">Success!</p>
                    <p className="text-slate-400 text-sm mt-1">
                      Your account is now unlocked. You can login with your credentials.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={goToLogin}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                size="lg"
              >
                Go to Login
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium">Unable to Unlock</p>
                    <p className="text-slate-400 text-sm mt-1">
                      {message || 'The unlock link may have expired or is invalid.'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Button 
                  onClick={goToLogin}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  Try Logging In
                </Button>
                <p className="text-slate-500 text-xs text-center">
                  If your account auto-unlocks after 30 minutes, you can try logging in again.
                </p>
              </div>
            </div>
          )}

          {/* Security Tips */}
          {status !== 'loading' && (
            <div className="p-4 bg-slate-800 rounded-lg mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-blue-400" />
                <h4 className="text-white font-medium">Security Tips</h4>
              </div>
              <ul className="text-slate-400 text-sm space-y-2">
                <li>• Use a strong, unique password</li>
                <li>• Enable Two-Factor Authentication (2FA)</li>
                <li>• Never share your login credentials</li>
                <li>• Check for suspicious login activity</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AirYatra Branding */}
      <div className="fixed bottom-4 text-center w-full">
        <p className="text-slate-600 text-sm">
          AirYatra - India&apos;s Premium Aviation Platform
        </p>
      </div>
    </div>
  );
};

export default UnlockAccountPage;
