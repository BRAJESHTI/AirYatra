import React, { useState, useEffect } from 'react';
import { Calendar, Link, Download, RefreshCw, CheckCircle, Settings, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function CalendarSync() {
  const [settings, setSettings] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [settingsRes, eventsRes] = await Promise.all([
        api.get('/calendar/settings'),
        api.get('/calendar/events')
      ]);
      setSettings(settingsRes.data);
      setEvents(eventsRes.data.events || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const updateSettings = async (updates) => {
    try {
      await api.put('/calendar/settings', { ...settings, ...updates });
      setSettings(prev => ({ ...prev, ...updates }));
    } catch (error) { alert('Failed to update settings'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Calendar className="h-6 w-6 mr-2 text-blue-500" /> Calendar Sync
          </h1>
          <p className="text-slate-400">Sync bookings with your calendar apps</p>
        </div>
        <Button onClick={loadData} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Connected Calendars</h2>
            <div className="space-y-3">
              {['Google Calendar', 'Apple iCal', 'Outlook'].map((cal, i) => (
                <div key={cal} className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-slate-500' : 'bg-blue-500'}`}>
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{cal}</p>
                      <p className="text-slate-400 text-sm">{settings?.[cal.toLowerCase().replace(' ', '_')] ? 'Connected' : 'Not connected'}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    {settings?.[cal.toLowerCase().replace(' ', '_')] ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Upcoming Events</h2>
            {events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event, i) => (
                  <div key={i} className="p-4 bg-slate-900 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-medium">{event.title}</p>
                        <p className="text-slate-400 text-sm">{event.description}</p>
                      </div>
                      <span className="text-orange-400 text-sm">{event.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400">No upcoming events</p>
                <p className="text-slate-500 text-sm">Events from bookings will appear here</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" /> Sync Settings
            </h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">Auto-sync bookings</span>
                <input type="checkbox" checked={settings?.auto_sync || false} onChange={(e) => updateSettings({ auto_sync: e.target.checked })} className="w-5 h-5 accent-orange-500" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">Reminder notifications</span>
                <input type="checkbox" checked={settings?.reminders || false} onChange={(e) => updateSettings({ reminders: e.target.checked })} className="w-5 h-5 accent-orange-500" />
              </label>
              <div>
                <p className="text-white mb-2">Reminder before (minutes)</p>
                <Input type="number" value={settings?.reminder_minutes || 30} onChange={(e) => updateSettings({ reminder_minutes: parseInt(e.target.value) })} className="bg-slate-700" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">Export</h2>
            <div className="space-y-3">
              <Button className="w-full bg-blue-600"><Download className="h-4 w-4 mr-2" /> Download ICS File</Button>
              <Button variant="outline" className="w-full"><Link className="h-4 w-4 mr-2" /> Copy Subscribe URL</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalendarSync;
