import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, MessageSquare, Plane, Calendar, AlertTriangle, 
  Settings, Users, FileText, Shield, Trash2, Clock, Filter, AlertCircle } from 'lucide-react';
import { notificationAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

// Security Alert Sound - Base64 encoded beep sound
const ALERT_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+fm5eTiH16dnR0eH+Ij5WZmpqYlI+LhoJ+e3t8gISJjpKVl5iXlZKPi4eCfnt6e36ChoqOkZSWl5eVko+Lh4N/fHt7fYGFiY2RlJaXl5WTkIyIhIB9e3t8gIOHi4+SlZeXl5WSkY2JhYF+fHx9gYWJjZGUlpeXlpOQjImFgX58fH2Bg4eMkJOWl5eWlJGNioaCf3x8fYCEiIyQk5aXl5aUkY6KhoJ/fXx9gISIjJCTlpeXlpSRjouHg398fX2AhImNkZSWl5eWk5COi4eDf3x9fYGFiY2Rk5aXl5aTkI2Kh4N/fX19gYWJjZGUlpeWlZKPjIiFgn9+fX6Bg4eLj5KVl5eVk5CPjImFgn9+fn+Dh4uPkpWXl5WTkI6LiIR/';

function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [showCriticalBanner, setShowCriticalBanner] = useState(false);
  const dropdownRef = useRef(null);
  const audioRef = useRef(null);
  const lastAlertIdRef = useRef(null);
  const navigate = useNavigate();

  const tabs = [
    { id: 'all', label: 'All', icon: Bell },
    { id: 'booking', label: 'Bookings', icon: Plane },
    { id: 'system', label: 'System', icon: Settings },
    { id: 'alert', label: 'Alerts', icon: AlertTriangle },
    { id: 'security', label: '🔴 Security', icon: Shield }
  ];

  // Play alert sound for critical notifications
  const playAlertSound = useCallback(() => {
    try {
      // Create audio context for beep
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create oscillator for "wip wip" sound
      const playBeep = (startTime, frequency, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.5, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Play "wip wip" pattern (two beeps)
      const now = audioContext.currentTime;
      playBeep(now, 880, 0.15);        // First wip (A5)
      playBeep(now + 0.2, 880, 0.15);  // Second wip (A5)
      playBeep(now + 0.5, 1760, 0.15); // Higher pitch (A6)
      playBeep(now + 0.7, 1760, 0.15); // Higher pitch (A6)
      
    } catch (error) {
      console.log('Could not play alert sound:', error);
    }
  }, []);

  // Check for critical security alerts
  const checkCriticalAlerts = useCallback(async () => {
    if (!user) return;
    
    const userRoles = user.roles || [];
    const isSecurityAdmin = userRoles.some(r => ['admin', 'ceo', 'hr'].includes(r));
    
    if (!isSecurityAdmin) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login-shield/alerts?unread_only=true&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const newCriticalAlerts = (data.alerts || []).filter(a => 
          a.severity === 'critical' || a.severity === 'high'
        );
        
        // Check if there are new alerts
        if (newCriticalAlerts.length > 0) {
          const newestAlert = newCriticalAlerts[0];
          
          // Play sound only for new alerts
          if (lastAlertIdRef.current !== newestAlert.id) {
            lastAlertIdRef.current = newestAlert.id;
            playAlertSound();
            setShowCriticalBanner(true);
            
            // Auto-hide banner after 10 seconds
            setTimeout(() => setShowCriticalBanner(false), 10000);
          }
          
          setCriticalAlerts(newCriticalAlerts);
        }
      }
    } catch (error) {
      console.error('Failed to check critical alerts');
    }
  }, [user, playAlertSound]);

  useEffect(() => {
    loadNotifications();
    checkCriticalAlerts();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadNotifications();
      checkCriticalAlerts();
    }, 30000);
    
    // Check critical alerts more frequently (every 10 seconds)
    const criticalInterval = setInterval(checkCriticalAlerts, 10000);
    
    return () => {
      clearInterval(interval);
      clearInterval(criticalInterval);
    };
  }, [checkCriticalAlerts]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationAPI.getInApp(false);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationAPI.markRead(notificationId);
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read first
    if (!notification.read) {
      handleMarkRead(notification.id);
    }
    
    // Navigate based on type and reference
    if (notification.reference_id) {
      switch (notification.type) {
        case 'booking_update':
        case 'booking_reminder':
        case 'booking_confirmed':
          navigate(`/customer/bookings/${notification.reference_id}`);
          break;
        case 'quote_received':
          navigate(`/customer/inquiries/${notification.reference_id}`);
          break;
        case 'new_inquiry':
          if (user?.roles?.includes('operator')) {
            navigate(`/operator/inquiries`);
          }
          break;
        case 'document_expiry':
          if (user?.roles?.includes('operator')) {
            navigate(`/operator/pilot-documents`);
          }
          break;
        default:
          break;
      }
    }
    setIsOpen(false);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'chat_message': return MessageSquare;
      case 'booking_update': 
      case 'booking_confirmed':
      case 'booking_reminder': return Plane;
      case 'quote_received':
      case 'new_inquiry': return FileText;
      case 'document_expiry':
      case 'alert': return AlertTriangle;
      case 'system': return Settings;
      case 'user_activity': return Users;
      case 'compliance': return Shield;
      case 'security_alert': return AlertCircle;
      default: return Bell;
    }
  };

  const getNotificationColor = (type, severity) => {
    if (type === 'security_alert' || severity === 'critical') {
      return 'text-red-500 bg-red-500/30 border border-red-500/50 animate-pulse';
    }
    switch (type) {
      case 'alert':
      case 'document_expiry': return 'text-red-400 bg-red-500/20';
      case 'booking_confirmed': return 'text-green-400 bg-green-500/20';
      case 'new_inquiry':
      case 'quote_received': return 'text-blue-400 bg-blue-500/20';
      case 'system': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-orange-400 bg-orange-500/20';
    }
  };

  const getTabCategory = (type) => {
    if (['booking_update', 'booking_confirmed', 'booking_reminder', 'quote_received', 'new_inquiry'].includes(type)) {
      return 'booking';
    }
    if (['alert', 'document_expiry', 'compliance'].includes(type)) {
      return 'alert';
    }
    if (['system', 'settings'].includes(type)) {
      return 'system';
    }
    if (['security_alert'].includes(type)) {
      return 'security';
    }
    return 'all';
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return getTabCategory(n.type) === activeTab;
  });

  const tabCounts = {
    all: notifications.length,
    booking: notifications.filter(n => getTabCategory(n.type) === 'booking').length,
    system: notifications.filter(n => getTabCategory(n.type) === 'system').length,
    alert: notifications.filter(n => getTabCategory(n.type) === 'alert').length
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="relative" ref={dropdownRef} data-testid="notification-bell">
      {/* Critical Security Alert Banner - Shows on top of screen */}
      {showCriticalBanner && criticalAlerts.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 shadow-lg animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <AlertCircle className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <p className="font-bold text-lg">🚨 CRITICAL SECURITY ALERT</p>
                <p className="text-sm opacity-90">
                  {criticalAlerts[0]?.title || 'Suspicious login detected'} - 
                  {criticalAlerts[0]?.details?.user_email || 'Unknown user'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setIsOpen(true);
                  setActiveTab('security');
                  setShowCriticalBanner(false);
                }}
                className="px-4 py-2 bg-white text-red-600 font-bold rounded-lg hover:bg-red-100 transition-colors"
              >
                View Details
              </button>
              <button 
                onClick={() => setShowCriticalBanner(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-slate-700/50 ${
          criticalAlerts.length > 0 ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-900' : ''
        }`}
        data-testid="notification-bell-button"
      >
        <Bell className={`h-5 w-5 ${criticalAlerts.length > 0 ? 'text-red-400 animate-bounce' : ''}`} />
        {(unreadCount > 0 || criticalAlerts.length > 0) && (
          <span className={`absolute -top-0.5 -right-0.5 w-5 h-5 ${
            criticalAlerts.length > 0 ? 'bg-red-600' : 'bg-orange-500'
          } text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse`}>
            {criticalAlerts.length > 0 ? '!' : (unreadCount > 99 ? '99+' : unreadCount)}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 100px)' }}>
          
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-400" />
                <h3 className="text-white font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">All read</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-700 bg-slate-800/30">
            {tabs.map(tab => {
              const TabIcon = tab.icon;
              const count = tabCounts[tab.id];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    isActive 
                      ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-500/10' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-orange-500/30' : 'bg-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {/* Security Tab - Show Critical Alerts */}
            {activeTab === 'security' && criticalAlerts.length > 0 && (
              <div className="bg-red-500/10 border-b border-red-500/30">
                <div className="px-4 py-2 bg-red-500/20">
                  <p className="text-red-400 font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 animate-pulse" />
                    Critical Security Alerts ({criticalAlerts.length})
                  </p>
                </div>
                {criticalAlerts.map((alert, idx) => (
                  <div key={idx} className="px-4 py-3 border-b border-red-500/20 hover:bg-red-500/10">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-500/30 rounded-lg">
                        <Shield className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">{alert.title}</p>
                        <p className="text-red-300 text-xs mt-1">{alert.message}</p>
                        {alert.details && (
                          <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs space-y-1">
                            <p className="text-slate-300">
                              <span className="text-slate-500">User:</span> {alert.details.user_email}
                            </p>
                            <p className="text-slate-300">
                              <span className="text-slate-500">IP:</span> {alert.details.ip_address}
                            </p>
                            <p className="text-slate-300">
                              <span className="text-slate-500">Risk Score:</span> 
                              <span className="text-red-400 font-bold ml-1">{alert.details.risk_score}/100</span>
                            </p>
                            {alert.details.risk_factors && alert.details.risk_factors.length > 0 && (
                              <div className="mt-1">
                                <span className="text-slate-500">Factors:</span>
                                <ul className="mt-1 space-y-0.5">
                                  {alert.details.risk_factors.slice(0, 3).map((f, i) => (
                                    <li key={i} className="text-red-300 flex items-center gap-1">
                                      <span className="text-red-500">•</span> {f}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-slate-500 text-[10px] mt-2">
                          {formatTime(alert.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 text-sm mt-2">Loading...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No {activeTab !== 'all' ? activeTab : ''} notifications</p>
                <p className="text-slate-500 text-xs mt-1">You are all caught up!</p>
              </div>
            ) : (
              filteredNotifications.slice(0, 15).map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const colorClass = getNotificationColor(notification.type, notification.severity);
                const isUnread = !notification.read;
                const isCritical = notification.type === 'security_alert' || notification.severity === 'critical';
                
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-all cursor-pointer ${
                      isUnread ? 'bg-slate-800/30' : ''
                    } ${isCritical ? 'bg-red-500/10 border-l-4 border-l-red-500' : ''}`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                        <Icon className={`h-4 w-4 ${isCritical ? 'text-red-400' : colorClass.split(' ')[0]}`} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium leading-tight ${
                            isUnread ? 'text-white' : 'text-slate-300'
                          }`}>
                            {notification.title}
                          </p>
                          {isUnread && (
                            <span className="w-2 h-2 bg-orange-500 rounded-full shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(notification.created_at)}
                          </span>
                          {notification.reference_id && (
                            <span className="text-[10px] text-orange-400">Click to view →</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkRead(notification.id, e)}
                          className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded shrink-0 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setIsOpen(false);
                }}
                className="w-full text-sm text-orange-400 hover:text-orange-300 text-center py-1 rounded hover:bg-orange-500/10 transition-colors"
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
