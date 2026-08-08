import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Mail, Phone, Lock, ArrowLeft, RefreshCw, CheckCircle, Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Enter Email/Phone, 2: Verify OTP, 3: New Password
  const [method, setMethod] = useState('email'); // 'email' or 'phone'
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef([]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Step 1: Send OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!identifier.trim()) {
      toast.error(method === 'email' ? 'Please enter your email' : 'Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          method: method
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'OTP sent successfully');
        setStep(2);
        setCooldown(60);
        
        // Show mock OTP in dev mode
        if (data.mock_otp) {
          toast.info(`Test OTP: ${data.mock_otp}`, { duration: 10000 });
        }
      } else {
        if (data.cooldown) {
          setCooldown(data.remaining_seconds || 60);
          toast.warning(data.message);
        } else {
          toast.error(data.message || 'Failed to send OTP');
        }
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otp = otpCode.join('');

    if (otp.length !== 6) {
      toast.error('Please enter complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp_code: otp,
          method: method
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResetToken(data.reset_token || '');
        toast.success('OTP verified successfully');
        setStep(3);
      } else {
        toast.error(data.detail || data.message || 'Invalid OTP');
        // Clear OTP on error
        setOtpCode(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch (error) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          reset_token: resetToken,
          new_password: newPassword,
          method: method
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || 'Password reset successful!');
        navigate('/login');
      } else {
        toast.error(data.detail || data.message || 'Failed to reset password');
      }
    } catch (error) {
      toast.error('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Input Handlers
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

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setOtpCode(['', '', '', '', '', '']);
    await handleSendOTP({ preventDefault: () => {} });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6" data-testid="forgot-password-page">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-4">
            <Plane className="h-10 w-10 text-orange-500" />
            <span className="text-3xl font-bold text-white">AirYatra</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="page-title">
            {step === 1 && 'Forgot Password'}
            {step === 2 && 'Verify OTP'}
            {step === 3 && 'New Password'}
          </h1>
          <p className="text-slate-400">
            {step === 1 && 'Enter your email or phone to reset password'}
            {step === 2 && `OTP sent to ${identifier}`}
            {step === 3 && 'Create a strong new password'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-10 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-orange-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Enter Email/Phone */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className="glass p-8 rounded-lg space-y-6" data-testid="step-1-form">
            {/* Method Toggle */}
            <div className="flex rounded-lg bg-slate-800/50 p-1">
              <button
                type="button"
                onClick={() => { setMethod('email'); setIdentifier(''); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  method === 'email' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => { setMethod('phone'); setIdentifier(''); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  method === 'phone' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="h-4 w-4" />
                Phone
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-white">
                {method === 'email' ? 'Email Address' : 'Phone Number'}
              </Label>
              <div className="relative">
                {method === 'email' ? (
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                ) : (
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                )}
                <Input
                  id="identifier"
                  type={method === 'email' ? 'email' : 'tel'}
                  placeholder={method === 'email' ? 'you@example.com' : '+91 9876543210'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="identifier-input"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white h-12"
              data-testid="send-otp-btn"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Shield className="h-5 w-5 mr-2" />
                  Send OTP
                </>
              )}
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-orange-400 hover:text-orange-300 text-sm flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </form>
        )}

        {/* Step 2: Verify OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="glass p-8 rounded-lg space-y-6" data-testid="step-2-form">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full mx-auto flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <p className="text-slate-400 text-sm">
                Enter the 6-digit code sent to<br/>
                <span className="text-white font-medium">{identifier}</span>
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
                  Verify OTP
                </>
              )}
            </Button>

            {/* Resend OTP */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={cooldown > 0 || loading}
                className={`text-sm ${cooldown > 0 ? 'text-slate-500' : 'text-orange-400 hover:text-orange-300'}`}
              >
                {cooldown > 0 
                  ? `Resend OTP in ${cooldown}s` 
                  : "Didn't receive code? Resend OTP"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setStep(1); setOtpCode(['', '', '', '', '', '']); }}
                className="text-slate-400 hover:text-white text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Change {method === 'email' ? 'Email' : 'Phone'}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="glass p-8 rounded-lg space-y-6" data-testid="step-3-form">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mx-auto flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-white">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="new-password-input"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="confirm-password-input"
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-12"
              data-testid="reset-password-btn"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
