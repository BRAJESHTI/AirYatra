/**
 * Session Manager Component
 * Displays active sessions and trusted devices with management options
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, Smartphone, Monitor, Laptop, Tablet, Globe, 
  Clock, MapPin, LogOut, Trash2, RefreshCw, CheckCircle,
  AlertTriangle, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { authAPI } from '../../services/authService';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Device icon helper
const getDeviceIcon = (deviceName) => {
  const name = (deviceName || '').toLowerCase();
  if (name.includes('iphone') || name.includes('android phone')) {
    return <Smartphone className="h-5 w-5" />;
  }
  if (name.includes('ipad') || name.includes('tablet')) {
    return <Tablet className="h-5 w-5" />;
  }
  if (name.includes('mac') || name.includes('laptop')) {
    return <Laptop className="h-5 w-5" />;
  }
  return <Monitor className="h-5 w-5" />;
};

// Format date helper
const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

// Time ago helper
const timeAgo = (dateStr) => {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
};

export default function SessionManager() {
  const [sessions, setSessions] = useState([]);
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [securitySettings, setSecuritySettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, devicesRes, settingsRes] = await Promise.all([
        authAPI.getSessions(),
        authAPI.getTrustedDevices(),
        authAPI.getSecuritySettings()
      ]);
      
      setSessions(sessionsRes.data.sessions || []);
      setTrustedDevices(devicesRes.data.devices || []);
      setSecuritySettings(settingsRes.data || {});
    } catch (error) {
      console.error('Failed to load security data:', error);
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    setActionLoading(`session-${sessionId}`);
    try {
      await authAPI.revokeSession(sessionId);
      toast.success('Session revoked successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to revoke session');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!window.confirm('This will log you out from ALL devices including this one. Continue?')) {
      return;
    }
    
    setActionLoading('logout-all');
    try {
      await authAPI.logoutAllDevices();
      toast.success('Logged out from all devices');
      // Clear local storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } catch (error) {
      toast.error('Failed to logout from all devices');
      setActionLoading(null);
    }
  };

  const handleRevokeTrustedDevice = async (deviceId) => {
    setActionLoading(`device-${deviceId}`);
    try {
      await authAPI.revokeTrustedDevice(deviceId);
      toast.success('Device trust revoked');
      loadData();
    } catch (error) {
      toast.error('Failed to revoke device trust');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTrustCurrentDevice = async () => {
    setActionLoading('trust-current');
    try {
      await authAPI.trustCurrentDevice();
      toast.success('This device is now trusted for 30 days');
      loadData();
    } catch (error) {
      toast.error('Failed to trust device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleOTP = async (enabled) => {
    setActionLoading('toggle-otp');
    try {
      await authAPI.updateSecuritySettings({ otp_enabled: enabled });
      setSecuritySettings({ ...securitySettings, otp_enabled: enabled });
      toast.success(enabled ? 'OTP enabled' : 'OTP disabled');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Security Overview
          </CardTitle>
          <CardDescription className="text-slate-400">
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{sessions.length}</p>
              <p className="text-sm text-slate-400">Active Sessions</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{trustedDevices.length}</p>
              <p className="text-sm text-slate-400">Trusted Devices</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 text-center">
              <p className={`text-3xl font-bold ${securitySettings.otp_enabled ? 'text-green-400' : 'text-yellow-400'}`}>
                {securitySettings.otp_enabled ? 'ON' : 'OFF'}
              </p>
              <p className="text-sm text-slate-400">OTP Protection</p>
            </div>
          </div>

          {/* OTP Toggle */}
          <div className="mt-6 p-4 bg-slate-700/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-orange-400" />
              <div>
                <p className="text-white font-medium">Email OTP on Login</p>
                <p className="text-xs text-slate-400">Require OTP verification for new devices</p>
              </div>
            </div>
            <Switch
              checked={securitySettings.otp_enabled !== false}
              onCheckedChange={handleToggleOTP}
              disabled={actionLoading === 'toggle-otp'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Active Sessions
            </CardTitle>
            <CardDescription className="text-slate-400">
              Devices currently logged into your account
            </CardDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogoutAllDevices}
            disabled={actionLoading === 'logout-all'}
            className="bg-red-600 hover:bg-red-700"
          >
            {actionLoading === 'logout-all' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                Logout All
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No active sessions</p>
            ) : (
              sessions.map((session, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    session.is_current 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${session.is_current ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}>
                      {getDeviceIcon(session.device_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{session.device_name || 'Unknown Device'}</p>
                        {session.is_current && (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.ip_address || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(session.last_activity)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.device_hash || session.ip_address)}
                      disabled={actionLoading === `session-${session.device_hash}`}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {actionLoading === `session-${session.device_hash}` ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trusted Devices */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-500" />
              Trusted Devices
            </CardTitle>
            <CardDescription className="text-slate-400">
              Devices that skip OTP verification
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTrustCurrentDevice}
            disabled={actionLoading === 'trust-current'}
            className="border-green-500/50 text-green-400 hover:bg-green-500/10"
          >
            {actionLoading === 'trust-current' ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Trust This Device
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {trustedDevices.length === 0 ? (
              <div className="text-center py-6">
                <Smartphone className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No trusted devices</p>
                <p className="text-xs text-slate-500 mt-1">
                  Trusted devices can login without OTP verification
                </p>
              </div>
            ) : (
              trustedDevices.map((device, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                      {getDeviceIcon(device.device_name)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{device.device_name || 'Unknown Device'}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>Trusted: {formatDate(device.created_at)}</span>
                        <span>Expires: {formatDate(device.expires_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeTrustedDevice(device.id)}
                    disabled={actionLoading === `device-${device.id}`}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    {actionLoading === `device-${device.id}` ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-amber-400 font-medium">Security Tips</p>
              <ul className="text-sm text-amber-300/80 mt-2 space-y-1">
                <li>• Review active sessions regularly and remove unknown devices</li>
                <li>• Only trust devices you personally own and control</li>
                <li>• Keep OTP enabled for maximum account security</li>
                <li>• Change your password immediately if you see suspicious activity</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
