import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Smartphone, Mail, User, Calendar, Phone, Image, Shield, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { googleAuthAPI, authAPI } from '@/services/api';
import { toast } from 'sonner';

// Device info collector
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const info = {
    user_agent: ua,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    language: navigator.language,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine
  };
  
  // Battery info if available
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      info.battery_level = Math.round(battery.level * 100);
      info.battery_charging = battery.charging;
    }).catch(() => {});
  }
  
  // Connection info if available
  if ('connection' in navigator) {
    const conn = navigator.connection;
    info.network_type = conn.effectiveType;
    info.network_downlink = conn.downlink;
  }
  
  return info;
};

// Emergent Auth Callback Component - handles session_id from URL hash
function EmergentAuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState('processing');
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // CRITICAL: Use useRef to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    
    processAuthCallback();
  }, []);

  const processAuthCallback = async () => {
    try {
      // Extract session_id from URL hash (format: #session_id=xxx)
      const hash = window.location.hash;
      console.log('Auth callback - URL hash:', hash);
      
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (!sessionIdMatch) {
        console.error('No session_id found in URL hash:', hash);
        setStatus('error');
        return;
      }
      
      const sessionId = sessionIdMatch[1];
      console.log('Extracted session_id:', sessionId);
      
      // Exchange session_id for user data via Emergent API
      console.log('Calling Emergent API for session data...');
      const response = await fetch('https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data', {
        method: 'GET',
        headers: {
          'X-Session-ID': sessionId
        }
      });
      
      console.log('Emergent API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Emergent API error:', errorText);
        throw new Error(`Failed to exchange session for user data: ${response.status}`);
      }
      
      const emergentUserData = await response.json();
      console.log('Emergent user data received:', emergentUserData?.email);
      
      // Now call our backend to create/login user
      const deviceInfo = getDeviceInfo();
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      
      console.log('Calling backend:', `${backendUrl}/api/auth/google/emergent-callback`);
      const loginResponse = await fetch(`${backendUrl}/api/auth/google/emergent-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emergent_user: emergentUserData,
          device_info: deviceInfo,
          session_token: emergentUserData.session_token
        })
      });
      
      console.log('Backend response status:', loginResponse.status);
      
      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        console.error('Backend error:', errorText);
        throw new Error(`Failed to process login: ${loginResponse.status}`);
      }
      
      const loginData = await loginResponse.json();
      
      // Store token and user
      localStorage.setItem('token', loginData.access_token);
      localStorage.setItem('user', JSON.stringify(loginData.user));
      
      setUserData(loginData.user);
      setStatus('success');
      
      // Notify parent
      onLogin?.(loginData.user);
      
      toast.success(loginData.is_new_user 
        ? 'Account created successfully! / खाता बनाया गया!' 
        : 'Welcome back! / वापसी पर स्वागत है!');
      
      // Redirect based on role
      setTimeout(() => {
        const role = loginData.user.roles?.[0] || 'customer';
        // Role to path mapping
        const ROLE_HOME_PATH = {
          customer: '/customer',
          operator: '/operator',
          admin: '/admin',
          super_admin: '/admin',
          ceo: '/admin?tab=ceo',
          hr: '/hr',
          sales: '/sales',
          finance: '/finance',
          support: '/support',
          pilot: '/pilot-portal',
          employee: '/employee',
        };
        navigate(ROLE_HOME_PATH[role] || '/customer');
      }, 1500);
      
    } catch (error) {
      console.error('Auth callback error:', error);
      setStatus('error');
      toast.error('Login failed / लॉगिन विफल');
    }
  };

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 text-orange-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl text-white">Signing you in...</h2>
          <p className="text-slate-400">आपको साइन इन किया जा रहा है...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-xl text-white">Authentication Failed</h2>
          <p className="text-slate-400 mt-2">प्रमाणीकरण विफल</p>
          <Button onClick={() => navigate('/login')} className="mt-4">
            Try Again / पुनः प्रयास करें
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 border border-slate-800">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome! / स्वागत है!</h2>
          <p className="text-slate-400 mt-2">Successfully signed in with Google</p>
        </div>

        {userData && (
          <div className="space-y-4">
            {/* Profile Picture */}
            <div className="flex justify-center">
              {userData.profile_picture || userData.picture ? (
                <img
                  src={userData.profile_picture || userData.picture}
                  alt={userData.full_name || userData.name}
                  className="w-24 h-24 rounded-full border-4 border-orange-500"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <User className="h-12 w-12 text-orange-500" />
                </div>
              )}
            </div>

            {/* User Details */}
            <div className="space-y-3 bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Name / नाम</p>
                  <p className="text-white">{userData.full_name || userData.name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-white">{userData.email}</p>
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-slate-400">
              Redirecting... / रीडायरेक्ट किया जा रहा है...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleLoginButton({ onSuccess, onError, buttonText = "Continue with Google / Google से जारी रखें" }) {
  const [loading, setLoading] = useState(false);
  const [googleSettings, setGoogleSettings] = useState({ enabled: true, use_emergent_auth: true });

  useEffect(() => {
    loadGoogleSettings();
  }, []);

  const loadGoogleSettings = async () => {
    try {
      const response = await googleAuthAPI.getSettings();
      setGoogleSettings(response.data);
    } catch (error) {
      console.error('Failed to load Google settings');
      // Default to enabled
      setGoogleSettings({ enabled: true, use_emergent_auth: true });
    }
  };

  const loadGoogleScript = () => {
    // Load Google Identity Services script
    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      // Using Emergent Managed Google Auth - redirects to Emergent auth service
      const redirectUrl = window.location.origin + '/auth/google/callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } catch (error) {
      console.error('Google login error:', error);
      setLoading(false);
      onError?.(error);
    }
  };

  const handleGoogleResponse = async (response) => {
    try {
      const deviceInfo = getDeviceInfo();
      
      const result = await googleAuthAPI.verifyToken({
        id_token: response.credential,
        device_info: deviceInfo
      });
      
      setLoading(false);
      
      if (result.data.access_token) {
        // Store token
        localStorage.setItem('token', result.data.access_token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
        
        toast.success(result.data.is_new_user 
          ? 'Account created successfully! / खाता बनाया गया!' 
          : 'Welcome back! / वापसी पर स्वागत है!');
        
        onSuccess?.(result.data);
      }
    } catch (error) {
      setLoading(false);
      toast.error('Google login failed');
      onError?.(error);
    }
  };

  const handleRedirectLogin = () => {
    // Redirect to backend Google auth endpoint
    const backendUrl = process.env.REACT_APP_BACKEND_URL;
    window.location.href = `${backendUrl}/api/auth/google/login`;
  };

  return (
    <Button
      onClick={handleGoogleLogin}
      disabled={loading || !googleSettings?.enabled}
      className="w-full bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 flex items-center justify-center gap-3 py-6"
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="font-medium">{buttonText}</span>
        </>
      )}
    </Button>
  );
}

// Google Auth Success Page - handles callback
function GoogleAuthSuccess({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    const token = searchParams.get('token');
    const isNew = searchParams.get('is_new') === 'true';

    if (!token) {
      setStatus('error');
      return;
    }

    try {
      // Store token
      localStorage.setItem('token', token);
      
      // Fetch user profile
      const response = await authAPI.getProfile();
      const user = response.data;
      
      localStorage.setItem('user', JSON.stringify(user));
      setUserData(user);
      setStatus('success');
      
      // Notify parent and redirect
      onLogin?.(user);
      
      setTimeout(() => {
        if (isNew) {
          navigate('/profile/complete'); // New user - complete profile
        } else {
          navigate('/dashboard'); // Existing user - go to dashboard
        }
      }, 2000);
      
    } catch (error) {
      console.error('Auth callback error:', error);
      setStatus('error');
    }
  };

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 text-orange-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl text-white">Signing you in...</h2>
          <p className="text-slate-400">आपको साइन इन किया जा रहा है...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-xl text-white">Authentication Failed</h2>
          <p className="text-slate-400 mt-2">प्रमाणीकरण विफल</p>
          <Button onClick={() => navigate('/login')} className="mt-4">
            Try Again / पुनः प्रयास करें
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 border border-slate-800">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome! / स्वागत है!</h2>
          <p className="text-slate-400 mt-2">Successfully signed in with Google</p>
        </div>

        {userData && (
          <div className="space-y-4">
            {/* Profile Picture */}
            <div className="flex justify-center">
              {userData.profile_picture ? (
                <img
                  src={userData.profile_picture}
                  alt={userData.full_name}
                  className="w-24 h-24 rounded-full border-4 border-orange-500"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <User className="h-12 w-12 text-orange-500" />
                </div>
              )}
            </div>

            {/* User Details */}
            <div className="space-y-3 bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Name / नाम</p>
                  <p className="text-white">{userData.full_name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-white">{userData.email}</p>
                </div>
              </div>

              {userData.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Phone / फोन</p>
                    <p className="text-white">{userData.phone}</p>
                  </div>
                </div>
              )}

              {userData.date_of_birth && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Date of Birth / जन्म तिथि</p>
                    <p className="text-white">{userData.date_of_birth}</p>
                  </div>
                </div>
              )}

              {userData.last_device_info && (
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Device / डिवाइस</p>
                    <p className="text-white">
                      {userData.last_device_info.device_model || userData.last_device_info.device_type} 
                      {userData.last_device_info.os && ` (${userData.last_device_info.os})`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-center text-sm text-slate-400">
              Redirecting to dashboard... / डैशबोर्ड पर रीडायरेक्ट किया जा रहा है...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Google Auth Error Page
function GoogleAuthError() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get('message') || 'Authentication failed';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 border border-red-500/30 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="text-xl font-bold text-white">Authentication Error</h2>
        <p className="text-red-400 mt-2">{errorMessage}</p>
        <p className="text-slate-400 mt-1">प्रमाणीकरण में त्रुटि</p>
        
        <div className="mt-6 space-y-3">
          <Button onClick={() => navigate('/login')} className="w-full bg-orange-500 hover:bg-orange-600">
            Try Again / पुनः प्रयास करें
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            Go Home / होम जाएं
          </Button>
        </div>
      </div>
    </div>
  );
}

export { GoogleLoginButton, GoogleAuthSuccess, GoogleAuthError, EmergentAuthCallback, getDeviceInfo };
export default GoogleLoginButton;
