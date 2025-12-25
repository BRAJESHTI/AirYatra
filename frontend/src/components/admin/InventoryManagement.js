import React, { useState, useEffect } from 'react';
import { Package, Calendar, Clock, Users, Plus, Lock, Unlock, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function InventoryManagement() {
  const [dashboard, setDashboard] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSlot, setNewSlot] = useState({
    aircraft_id: '', date: '', start_time: '09:00', end_time: '10:00',
    origin_helipad: '', max_bookings: 1, price_per_slot: 25000, slot_type: 'regular'
  });

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => { loadSlots(); }, [selectedDate]);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/inventory/dashboard');
      setDashboard(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const loadSlots = async () => {
    try {
      const res = await api.get(`/inventory/slots/available?date=${selectedDate}`);
      setSlots(res.data.available_slots || []);
    } catch (error) { console.error(error); }
  };

  const createSlot = async () => {
    try {
      await api.post('/inventory/slots/create', newSlot);
      setShowCreateModal(false);
      loadSlots();
      loadDashboard();
    } catch (error) { alert(error.response?.data?.detail || 'Failed'); }
  };

  const blockSlot = async (id) => {
    await api.post(`/inventory/slots/${id}/block`, { slot_id: id, reason: 'maintenance' });
    loadSlots();
  };

  const unblockSlot = async (id) => {
    await api.post(`/inventory/slots/${id}/unblock`);
    loadSlots();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
          <p className="text-slate-400">Slot availability & capacity</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowCreateModal(true)} className="bg-green-600"><Plus className="h-4 w-4 mr-2" /> Create Slot</Button>
          <Button onClick={loadDashboard} variant="outline"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <Package className="h-5 w-5 text-blue-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.today?.total_slots || 0}</p>
            <p className="text-slate-400 text-sm">Today's Slots</p>
          </div>
          <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
            <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.today?.available_slots || 0}</p>
            <p className="text-slate-400 text-sm">Available</p>
          </div>
          <div className="bg-orange-500/20 rounded-lg p-4 border border-orange-500/50">
            <Calendar className="h-5 w-5 text-orange-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.today?.booked_slots || 0}</p>
            <p className="text-slate-400 text-sm">Booked</p>
          </div>
          <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/50">
            <Lock className="h-5 w-5 text-red-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.today?.blocked_slots || 0}</p>
            <p className="text-slate-400 text-sm">Blocked</p>
          </div>
          <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
            <Users className="h-5 w-5 text-purple-400 mb-2" />
            <p className="text-2xl font-bold text-white">{dashboard.waitlist_count || 0}</p>
            <p className="text-slate-400 text-sm">Waitlist</p>
          </div>
        </div>
      )}

      {dashboard?.this_week && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Week Utilization: {dashboard.this_week.utilization_percent}%</h2>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-orange-500 rounded-full" style={{ width: `${dashboard.this_week.utilization_percent}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center space-x-4 mb-4">
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-800 w-48" />
        <Button onClick={loadSlots} variant="outline" size="sm"><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {slots.map(slot => (
          <div key={slot.id} className={`bg-slate-800 rounded-lg p-4 border ${slot.is_blocked ? 'border-red-500/50' : 'border-slate-700'}`}>
            <div className="flex justify-between mb-2">
              <p className="text-white font-medium">{slot.aircraft?.registration || 'Aircraft'}</p>
              <span className={`text-xs px-2 py-1 rounded ${slot.is_blocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                {slot.is_blocked ? 'Blocked' : `${slot.available_seats} seats`}
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-2"><Clock className="h-3 w-3 inline mr-1" />{slot.start_time} - {slot.end_time}</p>
            <div className="flex justify-between items-center">
              <span className="text-orange-400">₹{slot.price_per_slot?.toLocaleString()}</span>
              {slot.is_blocked ? (
                <Button size="sm" variant="outline" onClick={() => unblockSlot(slot.id)}><Unlock className="h-3 w-3" /></Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => blockSlot(slot.id)}><Lock className="h-3 w-3" /></Button>
              )}
            </div>
          </div>
        ))}
        {slots.length === 0 && (
          <div className="col-span-3 text-center py-12">
            <Package className="h-12 w-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No slots for this date</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Create Slot</h3>
            <div className="space-y-4">
              <Input placeholder="Aircraft ID" value={newSlot.aircraft_id} onChange={(e) => setNewSlot(p => ({ ...p, aircraft_id: e.target.value }))} className="bg-slate-700" />
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={newSlot.date} onChange={(e) => setNewSlot(p => ({ ...p, date: e.target.value }))} className="bg-slate-700" />
                <Input placeholder="Helipad" value={newSlot.origin_helipad} onChange={(e) => setNewSlot(p => ({ ...p, origin_helipad: e.target.value }))} className="bg-slate-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="time" value={newSlot.start_time} onChange={(e) => setNewSlot(p => ({ ...p, start_time: e.target.value }))} className="bg-slate-700" />
                <Input type="time" value={newSlot.end_time} onChange={(e) => setNewSlot(p => ({ ...p, end_time: e.target.value }))} className="bg-slate-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Max Bookings" value={newSlot.max_bookings} onChange={(e) => setNewSlot(p => ({ ...p, max_bookings: parseInt(e.target.value) }))} className="bg-slate-700" />
                <Input type="number" placeholder="Price" value={newSlot.price_per_slot} onChange={(e) => setNewSlot(p => ({ ...p, price_per_slot: parseInt(e.target.value) }))} className="bg-slate-700" />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={createSlot} className="bg-orange-500">Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryManagement;
