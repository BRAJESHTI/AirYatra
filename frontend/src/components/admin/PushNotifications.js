import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, Calendar, RefreshCw, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function PushNotifications() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSendModal, setShowSendModal] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '', body: '', target_type: 'all', target_ids: []
  });

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/notifications/dashboard');
      setDashboard(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const sendNotification = async () => {
    try {
      await api.post('/notifications/send', newNotification);
      alert('Notification sent!');
      setShowSendModal(false);
      loadDashboard();
    } catch (error) { alert(error.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Bell className="h-6 w-6 mr-2 text-yellow-500" /> Push Notifications
          </h1>
          <p className="text-slate-400">Send and manage push notifications</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowSendModal(true)} className="bg-orange-500"><Send className="h-4 w-4 mr-2" /> Send</Button>
          <Button onClick={loadDashboard} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/50">
            <Send className="h-5 w-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.total_sent || 0}</p>
            <p className="text-slate-400 text-sm">Total Sent</p>
          </div>
          <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
            <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.delivered || 0}</p>
            <p className="text-slate-400 text-sm">Delivered</p>
          </div>
          <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/50">
            <Clock className="h-5 w-5 text-yellow-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.scheduled || 0}</p>
            <p className="text-slate-400 text-sm">Scheduled</p>
          </div>
          <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
            <Users className="h-5 w-5 text-purple-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.subscribers || 0}</p>
            <p className="text-slate-400 text-sm">Subscribers</p>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Notifications</h2>
        {dashboard?.recent?.length > 0 ? (
          <div className="space-y-3">
            {dashboard.recent.map((n, i) => (
              <div key={i} className="p-4 bg-slate-900 rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-white font-medium">{n.title}</p>
                  <p className="text-slate-400 text-sm">{n.body?.substring(0, 50)}...</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${n.status === 'delivered' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{n.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell className="h-12 w-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No notifications yet</p>
          </div>
        )}
      </div>

      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Send Notification</h3>
            <div className="space-y-4">
              <Input placeholder="Title" value={newNotification.title} onChange={(e) => setNewNotification(p => ({ ...p, title: e.target.value }))} className="bg-slate-700" />
              <textarea placeholder="Message" value={newNotification.body} onChange={(e) => setNewNotification(p => ({ ...p, body: e.target.value }))} className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 text-white" rows={3} />
              <select value={newNotification.target_type} onChange={(e) => setNewNotification(p => ({ ...p, target_type: e.target.value }))} className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 text-white">
                <option value="all">All Users</option>
                <option value="customers">Customers Only</option>
                <option value="operators">Operators Only</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowSendModal(false)}>Cancel</Button>
              <Button onClick={sendNotification} className="bg-orange-500">Send</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PushNotifications;
