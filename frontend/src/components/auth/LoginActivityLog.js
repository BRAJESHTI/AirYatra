import React, { useState, useEffect } from 'react';
import { 
  Shield, Monitor, Smartphone, Tablet, Globe, Clock, 
  MapPin, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Chrome, Laptop, Apple
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Login Activity Log Component
 * Shows users their recent login history with device, location, and status
 */
function LoginActivityLog({ user }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLoginActivity();
  }, []);

  const fetchLoginActivity = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/auth/login-activity?limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch login activity');
      }
      
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (err) {
      console.error('Error fetching login activity:', err);
      setError('Unable to load login history');
      toast.error('Failed to load login history');
    } finally {
      setLoading(false);
    }
  };

  // Get device icon based on device type
  const getDeviceIcon = (device) => {
    switch (device?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  // Get browser icon/color
  const getBrowserBadge = (browser) => {
    const browserLower = browser?.toLowerCase() || '';
    
    if (browserLower.includes('chrome')) {
      return { color: 'bg-blue-500/20 text-blue-400', icon: '🌐' };
    } else if (browserLower.includes('safari')) {
      return { color: 'bg-cyan-500/20 text-cyan-400', icon: '🧭' };
    } else if (browserLower.includes('firefox')) {
      return { color: 'bg-orange-500/20 text-orange-400', icon: '🦊' };
    } else if (browserLower.includes('edge')) {
      return { color: 'bg-green-500/20 text-green-400', icon: '📐' };
    }
    return { color: 'bg-slate-500/20 text-slate-400', icon: '🌐' };
  };

  // Get status badge
  const getStatusBadge = (action, status) => {
    if (action === 'login' && status === 'success') {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'bg-green-500/20 text-green-400',
        label: 'Login Successful'
      };
    } else if (action === 'login_failed') {
      return {
        icon: <XCircle className="h-4 w-4" />,
        color: 'bg-red-500/20 text-red-400',
        label: 'Login Failed'
      };
    } else if (action === 'otp_verified') {
      return {
        icon: <Shield className="h-4 w-4" />,
        color: 'bg-blue-500/20 text-blue-400',
        label: 'OTP Verified'
      };
    } else if (action === 'logout') {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'bg-yellow-500/20 text-yellow-400',
        label: 'Logout'
      };
    }
    return {
      icon: <Globe className="h-4 w-4" />,
      color: 'bg-slate-500/20 text-slate-400',
      label: action
    };
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get risk level badge
  const getRiskBadge = (riskLevel) => {
    if (!riskLevel) return null;
    
    const level = riskLevel.toUpperCase();
    if (level === 'LOW') {
      return <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Low Risk</span>;
    } else if (level === 'MEDIUM') {
      return <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Medium Risk</span>;
    } else if (level === 'HIGH' || level === 'CRITICAL') {
      return <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">{level} Risk</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 text-orange-500 animate-spin mr-2" />
          <span className="text-slate-400">Loading login history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error}</p>
          <Button 
            onClick={fetchLoginActivity}
            className="mt-4 bg-orange-500 hover:bg-orange-600"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden" data-testid="login-activity-log">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-white">Login Activity</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={fetchLoginActivity}
          className="text-slate-400 hover:text-white"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-slate-800">
        {activities.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No login activity found</p>
          </div>
        ) : (
          activities.map((activity, index) => {
            const statusBadge = getStatusBadge(activity.action, activity.status);
            const browserBadge = getBrowserBadge(activity.browser);
            
            return (
              <div 
                key={activity.id || index}
                className="p-4 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Device Icon */}
                  <div className={`p-2 rounded-lg ${statusBadge.color}`}>
                    {getDeviceIcon(activity.device)}
                  </div>
                  
                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Status & Time Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusBadge.color}`}>
                        {statusBadge.icon}
                        {statusBadge.label}
                      </span>
                      {getRiskBadge(activity.risk_level)}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                    
                    {/* Device & Browser Row */}
                    <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${browserBadge.color}`}>
                        {browserBadge.icon} {activity.browser}
                      </span>
                      <span className="text-slate-500">on</span>
                      <span className="text-slate-300">{activity.os}</span>
                    </div>
                    
                    {/* Location & IP Row */}
                    <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {activity.location || 'Unknown Location'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        IP: {activity.ip_address || 'Unknown'}
                      </span>
                    </div>
                    
                    {/* Reason (if failed) */}
                    {activity.reason && activity.action === 'login_failed' && (
                      <div className="mt-1 text-xs text-red-400">
                        Reason: {activity.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Note */}
      {activities.length > 0 && (
        <div className="p-3 bg-slate-800/50 border-t border-slate-800">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Showing last {activities.length} login activities. If you notice any suspicious activity, change your password immediately.</p>
        </div>
      )}
    </div>
  );
}

export default LoginActivityLog;
