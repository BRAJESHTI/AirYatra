import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Calendar, Plane, Clock, ChevronLeft, ChevronRight, 
  RefreshCw, AlertCircle, CheckCircle, X, GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Get week dates
const getWeekDates = (startDate) => {
  const dates = [];
  const start = new Date(startDate);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  return dates;
};

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const formatDateShort = (date) => {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
};

function CrewSchedulingBoard() {
  const [loading, setLoading] = useState(true);
  const [pilots, setPilots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [draggingBooking, setDraggingBooking] = useState(null);
  const [saving, setSaving] = useState(false);

  const weekDates = getWeekDates(currentWeekStart);

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Load pilots
      const pilotsRes = await fetch(`${API_URL}/api/operator/pilots`, { headers });
      if (pilotsRes.ok) {
        const data = await pilotsRes.json();
        setPilots(data.pilots || []);
      }

      // Load pilot availability for the week
      const startDate = formatDate(weekDates[0]);
      const endDate = formatDate(weekDates[6]);
      
      const availRes = await fetch(
        `${API_URL}/api/operator/pilots/availability?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      );
      if (availRes.ok) {
        const data = await availRes.json();
        // Build assignments map
        const assignmentMap = {};
        (data.assignments || []).forEach(a => {
          const key = `${a.pilot_id}_${a.date}`;
          assignmentMap[key] = a;
        });
        setAssignments(assignmentMap);
        setBookings(data.bookings || []);
      }
    } catch (error) {
      toast.error('Failed to load scheduling data');
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeekStart(newDate);
  };

  const handleDragStart = (booking, e) => {
    setDraggingBooking(booking);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (pilotId, date, e) => {
    e.preventDefault();
    if (!draggingBooking) return;

    const bookingDate = draggingBooking.travel_date || draggingBooking.departure_date;
    if (bookingDate !== formatDate(date)) {
      toast.error('Booking date does not match this slot');
      setDraggingBooking(null);
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/operator/pilots/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: draggingBooking.id,
          pilot_id: pilotId
        })
      });

      if (res.ok) {
        const pilot = pilots.find(p => p.id === pilotId);
        toast.success(`Assigned ${pilot?.name || 'Pilot'} to ${draggingBooking.id.slice(0, 8)}`);
        loadData(); // Refresh
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Assignment failed');
      }
    } catch (error) {
      toast.error('Failed to assign pilot');
    } finally {
      setSaving(false);
      setDraggingBooking(null);
    }
  };

  const removeAssignment = async (bookingId) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/operator/pilots/assign/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Assignment removed');
        loadData();
      } else {
        toast.error('Failed to remove assignment');
      }
    } catch (error) {
      toast.error('Failed to remove assignment');
    } finally {
      setSaving(false);
    }
  };

  // Get unassigned bookings for the week
  const unassignedBookings = bookings.filter(b => {
    const bookingDate = b.travel_date || b.departure_date;
    return !b.assigned_pilot_id && 
           weekDates.some(d => formatDate(d) === bookingDate);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-orange-500" />
            Crew Scheduling Board
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Drag & drop bookings to assign pilots / पायलट असाइन करने के लिए बुकिंग खींचें
          </p>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek(-1)}
            className="border-slate-700 text-slate-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="bg-slate-800 px-4 py-2 rounded-lg text-white min-w-[200px] text-center">
            {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek(1)}
            className="border-slate-700 text-slate-300"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setCurrentWeekStart(new Date())}
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300"
          >
            Today
          </Button>
          <Button onClick={loadData} variant="ghost" size="sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Unassigned Bookings Panel */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 sticky top-4">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Unassigned Bookings ({unassignedBookings.length})
            </h2>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {unassignedBookings.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">
                  All bookings assigned! 🎉
                </p>
              ) : (
                unassignedBookings.map(booking => (
                  <div
                    key={booking.id}
                    draggable
                    onDragStart={(e) => handleDragStart(booking, e)}
                    className="bg-slate-700/50 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-slate-700 transition-colors border border-slate-600 group"
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-slate-500 mt-1 group-hover:text-orange-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-orange-400 font-mono text-xs">
                          {(booking.id || '').slice(0, 8)}
                        </p>
                        <p className="text-white text-sm truncate">
                          {booking.from_location || booking.origin} → {booking.to_location || booking.destination}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                          <Calendar className="h-3 w-3" />
                          {booking.travel_date || booking.departure_date}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="lg:col-span-3 overflow-x-auto">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden min-w-[700px]">
            {/* Header Row - Days */}
            <div className="grid grid-cols-8 bg-slate-900/50">
              <div className="p-3 border-b border-r border-slate-700">
                <p className="text-slate-400 text-sm">Pilots</p>
              </div>
              {weekDates.map((date, idx) => {
                const isToday = formatDate(date) === formatDate(new Date());
                return (
                  <div 
                    key={idx} 
                    className={`p-3 border-b border-r border-slate-700 text-center ${
                      isToday ? 'bg-orange-500/10' : ''
                    }`}
                  >
                    <p className={`text-xs ${isToday ? 'text-orange-400' : 'text-slate-400'}`}>
                      {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </p>
                    <p className={`font-semibold ${isToday ? 'text-orange-400' : 'text-white'}`}>
                      {date.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Pilot Rows */}
            {pilots.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No pilots found. Add pilots first from Pilot Management.
              </div>
            ) : (
              pilots.map(pilot => (
                <div key={pilot.id} className="grid grid-cols-8">
                  {/* Pilot Name Cell */}
                  <div className="p-3 border-b border-r border-slate-700 bg-slate-800/30">
                    <p className="text-white text-sm font-medium truncate">{pilot.name}</p>
                    <p className="text-xs text-slate-400 truncate">{pilot.license_number}</p>
                  </div>

                  {/* Day Cells */}
                  {weekDates.map((date, dayIdx) => {
                    const dateStr = formatDate(date);
                    const assignmentKey = `${pilot.id}_${dateStr}`;
                    const assignment = assignments[assignmentKey];
                    const isToday = dateStr === formatDate(new Date());

                    return (
                      <div
                        key={dayIdx}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(pilot.id, date, e)}
                        className={`p-2 border-b border-r border-slate-700 min-h-[80px] transition-colors ${
                          isToday ? 'bg-orange-500/5' : ''
                        } ${
                          draggingBooking ? 'hover:bg-slate-700/50' : ''
                        }`}
                      >
                        {assignment ? (
                          <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-2 relative group">
                            <button
                              onClick={() => removeAssignment(assignment.booking_id)}
                              className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                            <p className="text-xs text-green-400 font-mono">
                              {(assignment.booking_id || '').slice(0, 6)}
                            </p>
                            <p className="text-xs text-white truncate">
                              {assignment.route || 'N/A'}
                            </p>
                          </div>
                        ) : (
                          <div className={`h-full flex items-center justify-center text-xs text-slate-600 ${
                            draggingBooking ? 'border-2 border-dashed border-slate-600 rounded-lg' : ''
                          }`}>
                            {draggingBooking ? 'Drop here' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600/20 border border-green-500/30 rounded" />
          <span className="text-slate-400">Assigned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500/10 rounded" />
          <span className="text-slate-400">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-500" />
          <span className="text-slate-400">Drag booking to assign</span>
        </div>
      </div>

      {/* Saving Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-orange-500 animate-spin" />
            <span className="text-white">Saving...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrewSchedulingBoard;
