import React, { useState, useEffect } from 'react';
import { 
  Bell, Mail, MessageSquare, Smartphone, AlertTriangle, CheckCircle, 
  X, Filter, RefreshCw, Trash2, Archive, Eye, Clock, 
  MessageCircle, Shield, Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NOTIFICATION_TYPES = [
  { id: 'all', label: 'All', icon: Bell, color: 'text-slate-400' },
  { id: 'email', label: 'Email', icon: Mail, color: 'text-blue-400' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, color: 'text-green-400' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-400' },
  { id: 'push', label: 'Push', icon: Smartphone, color: 'text-purple-400' },
  { id: 'approval', label: 'Approvals', icon: Shield, color: 'text-orange-400' },
  { id: 'alert', label: 'Alerts', icon: AlertTriangle, color: 'text-red-400' },
];

const PRIORITY_COLORS = {
  low: 'bg-slate-500',
  normal: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500 animate-pulse'
};

function GlobalNotificationCenter({ user, isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, unread: 0, type_counts: {} });

  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications();
    }
  }, [isOpen, user, activeFilter]);

  const fetchNotifications = async () => {
    if (!user?._id && !user?.id) return;
    
    setLoading(true);
    try {
      const userId = user._id || user.id;
      const typeParam = activeFilter !== 'all' ? `&type=${activeFilter}` : '';
      const response = await fetch(`${API_URL}/api/notifications/user/${userId}?limit=50${typeParam}`);
      const data = await response.json();
      
      setNotifications(data.notifications || []);
      setStats({
        total: data.total || 0,
        unread: data.unread || 0,
        type_counts: data.type_counts || {}
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, is_read: true } : n)
      );
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?._id && !user?.id) return;
    
    try {
      const userId = user._id || user.id;
      await fetch(`${API_URL}/api/notifications/user/${userId}/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setStats(prev => ({ ...prev, unread: 0 }));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const archiveNotification = async (notificationId) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notificationId}/archive`, { method: 'PUT' });
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      toast.success('Notification archived');
    } catch (error) {
      console.error('Failed to archive:', error);
    }
  };

  const getTypeIcon = (type) => {
    const typeConfig = NOTIFICATION_TYPES.find(t => t.id === type);
    if (!typeConfig) return Bell;
    return typeConfig.icon;
  };

  const getTypeColor = (type) => {
    const typeConfig = NOTIFICATION_TYPES.find(t => t.id === type);
    return typeConfig?.color || 'text-slate-400';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden mt-16 mr-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Notifications</h2>
                <p className="text-white/80 text-sm">
                  {stats.unread} unread of {stats.total}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchNotifications}
                className="text-white hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-2 bg-slate-800 overflow-x-auto">
          {NOTIFICATION_TYPES.map(type => {
            const Icon = type.icon;
            const count = type.id === 'all' ? stats.unread : (stats.type_counts?.[type.id] || 0);
            return (
              <button
                key={type.id}
                onClick={() => setActiveFilter(type.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === type.id 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {type.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeFilter === type.id ? 'bg-white/20' : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mark All Read Button */}
        {stats.unread > 0 && (
          <div className="px-4 py-2 border-b border-slate-700">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-orange-400 hover:text-orange-300 text-xs"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Mark all as read
            </Button>
          </div>
        )}

        {/* Notifications List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {notifications.map(notification => {
                const TypeIcon = getTypeIcon(notification.type);
                return (
                  <div 
                    key={notification._id}
                    className={`p-4 hover:bg-slate-800/50 transition-colors ${
                      !notification.is_read ? 'bg-slate-800/30 border-l-2 border-orange-500' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg bg-slate-800 ${getTypeColor(notification.type)}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`font-medium ${notification.is_read ? 'text-slate-300' : 'text-white'}`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                          {/* Priority Badge */}
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${PRIORITY_COLORS[notification.priority]}`} />
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(notification.created_at)}
                          </span>
                          <div className="flex items-center gap-1">
                            {!notification.is_read && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => markAsRead(notification._id)}
                                className="h-7 px-2 text-slate-400 hover:text-white"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => archiveNotification(notification._id)}
                              className="h-7 px-2 text-slate-400 hover:text-red-400"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Action Button */}
                        {notification.action_url && (
                          <a 
                            href={notification.action_url}
                            className="inline-block mt-2 text-xs text-orange-400 hover:text-orange-300"
                          >
                            {notification.action_label || 'View Details'} →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800 border-t border-slate-700 text-center">
          <a href="/notifications" className="text-sm text-orange-400 hover:text-orange-300">
            View All Notifications →
          </a>
        </div>
      </div>
    </div>
  );
}

export default GlobalNotificationCenter;
