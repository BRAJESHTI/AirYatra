import React, { useState, useEffect } from 'react';
import { Video, Phone, Mic, MicOff, VideoOff, PhoneOff, RefreshCw, Users, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

function VoiceVideoSupport() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/voice-video/dashboard');
      setDashboard(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Video className="h-6 w-6 mr-2 text-blue-500" /> Voice/Video Support
          </h1>
          <p className="text-slate-400">Premium support with voice & video calls</p>
        </div>
        <Button onClick={loadDashboard} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
            <Phone className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.active_calls || 0}</p>
            <p className="text-slate-400 text-sm">Active Calls</p>
          </div>
          <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/50">
            <Video className="h-5 w-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.total_calls_today || 0}</p>
            <p className="text-slate-400 text-sm">Calls Today</p>
          </div>
          <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
            <Clock className="h-5 w-5 text-purple-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.avg_duration || '5:30'}</p>
            <p className="text-slate-400 text-sm">Avg Duration</p>
          </div>
          <div className="bg-orange-500/20 rounded-lg p-4 border border-orange-500/50">
            <Users className="h-5 w-5 text-orange-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.agents_online || 3}</p>
            <p className="text-slate-400 text-sm">Agents Online</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Active Support Queue</h2>
          {dashboard?.queue?.length > 0 ? (
            <div className="space-y-3">
              {dashboard.queue.map((item, i) => (
                <div key={i} className="p-4 bg-slate-900 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="text-white font-medium">{item.customer_name}</p>
                    <p className="text-slate-400 text-sm">{item.issue_type}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" className="bg-green-500"><Phone className="h-4 w-4" /></Button>
                    <Button size="sm" className="bg-blue-500"><Video className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">No customers in queue</p>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Call Controls</h2>
          {activeCall ? (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <Video className="h-12 w-12 text-blue-400" />
              </div>
              <p className="text-white text-xl mb-4">Call in Progress</p>
              <div className="flex justify-center space-x-4">
                <Button size="lg" variant="outline" className="rounded-full p-4"><MicOff className="h-6 w-6" /></Button>
                <Button size="lg" variant="outline" className="rounded-full p-4"><VideoOff className="h-6 w-6" /></Button>
                <Button size="lg" className="bg-red-500 rounded-full p-4" onClick={() => setActiveCall(null)}><PhoneOff className="h-6 w-6" /></Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <Phone className="h-12 w-12 text-slate-500" />
              </div>
              <p className="text-slate-400">No active call</p>
              <p className="text-slate-500 text-sm mt-2">Select a customer from queue to start</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoiceVideoSupport;
