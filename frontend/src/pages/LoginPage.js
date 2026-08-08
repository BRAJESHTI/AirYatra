import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Mail, Lock, User, Phone, Shield, Smartphone, CheckCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { authAPI } from '../services/api';
import { toast } from 'sonner';
import { GoogleLoginButton } from '../components/auth/GoogleLogin';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function LoginPage({ setUser }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    roles: ['customer'],
    user_type: 'customer'
  });
  const [loading, setLoading] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [trustDevice, setTrustDevice] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpMessage, setOtpMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const otpRefs = useRef([]);
  const navigate = useNavigate();

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  // Role to dashboard path mapping
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
    regional_manager: '/regional',
    helipad_owner: '/helipad-owner',
  };

  const getHomePath = (role) => {
    return ROLE_HOME_PATH[role] || '/customer';
  };

  // Phone OTP Login Functions
  const sendPhoneOTP = async () => {
    if (!formData.phone || formData.phone.length < 10) {
      toast.error('Please enter a valid phone number / कृपया सही फोन नंबर दर्ज करें');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setPhoneOtpSent(true);
        toast.success(data.message_hi || 'OTP भेजा गया!');
        
        // Show mock OTP in dev mode
        if (data.mock_otp) {
          toast.info(`Test OTP: ${data.mock_otp}`, { duration: 10000 });
        }
      } else {
        toast.error(data.detail || 'Failed to send OTP');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOTP = async () => {
    if (!phoneOtpCode || phoneOtpCode.length !== 6) {
      toast.error('Please enter 6-digit OTP / कृपया 6 अंकों का OTP दर्ज करें');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/phone/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: formData.phone,
          otp_code: phoneOtpCode
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        
        toast.success(data.message_hi || 'Login successful!');
        
        const role = data.user.roles?.[0] || 'customer';
        navigate(getHomePath(role));
      } else {
        toast.error(data.detail || 'Invalid OTP');
      }
    } catch (error) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (data) => {
    setUser(data.user);
    const role = data.user.roles[0];
    navigate(getHomePath(role));
  };

  const handleGoogleError = (error) => {
    console.error('Google login failed:', error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone,
        roles: formData.roles
      };

      if (isLogin) {
        const response = await authAPI.login({ 
          email: formData.email, 
          password: formData.password 
        });
        
        // Check if TOTP 2FA is required
        if (response.data.totp_required) {
          setTotpRequired(true);
          setTempToken(response.data.temp_token);
          toast.info('🔐 Google Authenticator code required');
        }
        // Check if Email OTP is required
        else if (response.data.otp_required) {
          setOtpRequired(true);
          setOtpMessage(response.data.message || 'OTP sent to your email');
          toast.info(`🔐 ${response.data.message}`);
          
          if (response.data.cooldown) {
            setOtpCooldown(response.data.remaining_seconds || 60);
          }
        } else {
          // Direct login (trusted device or OTP disabled)
          completeLogin(response.data);
        }
      } else {
        // Registration
        const response = await authAPI.register(submitData);
        completeLogin(response.data);
        toast.success('Registration successful!');
      }
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      
      if (status === 429) {
        toast.error('⚠️ Too many login attempts. Please wait a minute and try again. / बहुत सारे लॉगिन प्रयास। कृपया एक मिनट प्रतीक्षा करें।');
      } else if (status === 401) {
        toast.error('❌ Incorrect email or password. / गलत ईमेल या पासवर्ड।');
      } else {
        toast.error(detail || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const otp = otpCode.join('');
    
    if (otp.length !== 6) {
      toast.error('Please enter complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyOTP({
        email: formData.email,
        otp_code: otp,
        trust_device: trustDevice
      });
      
      completeLogin(response.data);
      
      if (trustDevice) {
        toast.success('✅ Login successful! Device trusted for 30 days');
      } else {
        toast.success('✅ Login successful!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
      // Clear OTP fields on error
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Handle TOTP (Google Authenticator) verification
  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    
    if (totpCode.length !== 6) {
      toast.error('Please enter complete 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login/verify-totp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temp_token: tempToken,
          code: totpCode
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Invalid code');
      }
      
      completeLogin(data);
      toast.success('✅ Login successful with 2FA!');
    } catch (error) {
      toast.error(error.message || 'Invalid authenticator code');
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    
    setLoading(true);
    try {
      const response = await authAPI.resendOTP({
        email: formData.email,
        password: formData.password
      });
      
      if (response.data.cooldown) {
        setOtpCooldown(response.data.remaining_seconds || 60);
        toast.warning(response.data.message);
      } else {
        toast.success('🔐 New OTP sent to your email');
        setOtpCode(['', '', '', '', '', '']);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = (data) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    
    const role = data.user.roles[0];
    navigate(getHomePath(role));
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpCode];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtpCode(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6" data-testid="login-page">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-4" data-testid="logo-link">
            <Plane className="h-10 w-10 text-orange-500" />
            <span className="text-3xl font-bold text-white">AirYatra</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="auth-title">
            {totpRequired ? 'Authenticator Code' : (otpRequired ? 'Verify OTP' : (isLogin ? 'Welcome Back' : 'Create Account'))}
          </h1>
          <p className="text-slate-400">
            {totpRequired
              ? 'Enter code from Google Authenticator'
              : (otpRequired 
                ? otpMessage 
                : (isLogin ? 'Login to access your account' : 'Sign up to start booking flights'))}
          </p>
        </div>

        {/* TOTP (Google Authenticator) Verification Form */}
        {totpRequired ? (
          <form onSubmit={handleTotpSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="totp-form">
            {/* TOTP Icon */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mx-auto flex items-center justify-center mb-4">
                <Smartphone className="h-8 w-8 text-white" />
              </div>
              <p className="text-slate-400 text-sm">
                Open Google Authenticator app and enter<br/>
                the 6-digit code for <span className="text-white font-medium">AirYatra</span>
              </p>
            </div>

            {/* TOTP Input */}
            <div className="space-y-2">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]*"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-3xl tracking-[0.5em] font-mono bg-slate-800 border-slate-600 text-white h-16"
                data-testid="totp-input"
                autoFocus
              />
            </div>

            {/* Submit TOTP */}
            <Button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-12"
              data-testid="verify-totp-btn"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Verify Code
                </>
              )}
            </Button>

            {/* Back to Login */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTotpRequired(false);
                setTotpCode('');
                setTempToken('');
              }}
              className="w-full text-slate-400 hover:text-white"
            >
              Back to Login
            </Button>
          </form>
        ) : otpRequired ? (
          <form onSubmit={handleOtpSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="otp-form">
            {/* OTP Icon */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full mx-auto flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <p className="text-slate-400 text-sm">
                Enter the 6-digit code sent to<br/>
                <span className="text-white font-medium">{formData.email}</span>
              </p>
            </div>

            {/* OTP Input Fields */}
            <div className="flex justify-center gap-2">
              {otpCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold bg-slate-800 border-2 border-slate-600 rounded-lg text-white focus:border-orange-500 focus:outline-none transition-colors"
                  data-testid={`otp-input-${index}`}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {/* Trust Device Checkbox */}
            <div className="flex items-center space-x-3 bg-slate-800/50 p-4 rounded-lg">
              <Checkbox
                id="trustDevice"
                checked={trustDevice}
                onCheckedChange={setTrustDevice}
                className="border-orange-500 data-[state=checked]:bg-orange-500"
              />
              <label htmlFor="trustDevice" className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <Smartphone className="h-4 w-4 text-orange-400" />
                Trust this device for 30 days
              </label>
            </div>

            {/* Submit OTP */}
            <Button
              type="submit"
              disabled={loading || otpCode.join('').length !== 6}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white h-12"
              data-testid="verify-otp-btn"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Verify & Login
                </>
              )}
            </Button>

            {/* Resend OTP */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpCooldown > 0 || loading}
                className={`text-sm ${otpCooldown > 0 ? 'text-slate-500' : 'text-orange-400 hover:text-orange-300'}`}
              >
                {otpCooldown > 0 
                  ? `Resend OTP in ${otpCooldown}s` 
                  : "Didn't receive code? Resend OTP"}
              </button>
            </div>

            {/* Back to Login */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setOtpRequired(false);
                  setOtpCode(['', '', '', '', '', '']);
                }}
                className="text-slate-400 hover:text-white text-sm"
              >
                ← Back to Login
              </button>
            </div>
          </form>
        ) : (
          /* Regular Login/Register Form */
          <form onSubmit={loginMethod === 'phone' ? (e) => { e.preventDefault(); phoneOtpSent ? verifyPhoneOTP() : sendPhoneOTP(); } : handleSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="auth-form">
            
            {/* Login Method Tabs - Only for Login */}
            {isLogin && (
              <div className="flex rounded-lg bg-slate-800/50 p-1 mb-4">
                <button
                  type="button"
                  onClick={() => { setLoginMethod('email'); setPhoneOtpSent(false); }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    loginMethod === 'email' 
                      ? 'bg-orange-500 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMethod('phone'); setPhoneOtpSent(false); }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    loginMethod === 'phone' 
                      ? 'bg-orange-500 text-white' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Phone className="h-4 w-4" />
                  Phone OTP
                </button>
              </div>
            )}

            {/* Phone OTP Login - only shown when login method is phone */}
            {isLogin && loginMethod === 'phone' ? (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <Phone className="h-12 w-12 mx-auto text-orange-500 mb-2" />
                  <p className="text-slate-400 text-sm">
                    {phoneOtpSent 
                      ? 'OTP भेजा गया! अपना 6 अंकों का कोड दर्ज करें' 
                      : 'फ़ोन नंबर से लॉग इन करें'}
                  </p>
                </div>
                
                {!phoneOtpSent ? (
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white">Phone Number / फ़ोन नंबर</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+91 9876543210"
                        value={formData.phone}
                        onChange={handleChange}
                        className="pl-10 bg-slate-900 border-slate-700 text-white"
                        data-testid="phone-login-input"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="phoneOtp" className="text-white">Enter OTP / OTP दर्ज करें</Label>
                    <Input
                      id="phoneOtp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={phoneOtpCode}
                      onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center text-2xl tracking-widest bg-slate-900 border-slate-700 text-white"
                      data-testid="phone-otp-input"
                      autoFocus
                    />
                    <p className="text-xs text-slate-500 text-center">
                      OTP sent to {formData.phone}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || (!phoneOtpSent && !formData.phone) || (phoneOtpSent && phoneOtpCode.length !== 6)}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white h-12"
                  data-testid="phone-otp-btn"
                >
                  {loading ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : phoneOtpSent ? (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Verify & Login
                    </>
                  ) : (
                    <>
                      <Phone className="h-5 w-5 mr-2" />
                      Send OTP / OTP भेजें
                    </>
                  )}
                </Button>

                {phoneOtpSent && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setPhoneOtpSent(false); setPhoneOtpCode(''); }}
                      className="text-orange-400 hover:text-orange-300 text-sm"
                    >
                      ← Change Phone Number
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Email/Password Login Form */}
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user_type" className="text-white">I am a *</Label>
                  <select
                    id="user_type"
                    name="user_type"
                    value={formData.user_type}
                    onChange={(e) => {
                      const type = e.target.value;
                      setFormData({ ...formData, user_type: type, roles: [type] });
                    }}
                    className="w-full h-10 px-3 rounded-md bg-slate-900 border-slate-700 text-white"
                    data-testid="user-type-select"
                  >
                    <option value="customer">Customer (Book Flights)</option>
                    <option value="operator">Operator (Provide Services)</option>
                  </select>
                </div>

              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-white">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="pl-10 bg-slate-900 border-slate-700 text-white"
                    data-testid="full-name-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="pl-10 bg-slate-900 border-slate-700 text-white"
                    data-testid="phone-input"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="pl-10 bg-slate-900 border-slate-700 text-white"
                data-testid="email-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                className="pl-10 pr-10 bg-slate-900 border-slate-700 text-white"
                data-testid="password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            
            {/* Password Strength Meter - Only show during registration */}
            {!isLogin && (
              <PasswordStrengthMeter 
                password={formData.password} 
                showRequirements={true}
              />
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
            disabled={loading}
            data-testid="submit-btn"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
          </Button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-900 text-slate-400">या / or</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <GoogleLoginButton 
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            buttonText={isLogin ? "Google से Login करें" : "Google से Sign up करें"}
          />

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-orange-500 hover:text-orange-400 text-sm"
              data-testid="toggle-auth-btn"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
            </button>
          </div>
              </>
            )}
        </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;