import React, { useState, useEffect } from 'react';
import { 
  Calendar, User, Plane, ChevronLeft, ChevronRight, Check, X,
  AlertCircle, Clock, Phone, RefreshCw, UserPlus, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function PilotAssignmentCalendar() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_URL}/api/operator/pilots/availability?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const json = await res.json();
      setData(json);
    } catch (error) {
      toast.error('Failed to load pilot availability');
    } finally {
      setLoading(false);
    }
  };

  const assignPilot = async (pilotId) => {
    if (!selectedBooking) return;
    
    setAssigning(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/operator/pilots/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: selectedBooking.id,
          pilot_id: pilotId
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Assignment failed');
      }
      
      toast.success('Pilot assigned successfully!');
      setSelectedBooking(null);
      loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAssigning(false);
    }
  };

  const unassignPilot = async (bookingId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/operator/pilots/assign/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      toast.success('Pilot unassigned');
      loadData();
    } catch (error) {
      toast.error('Failed to unassign pilot');
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isPilotAvailable = (pilot, date) => {
    // Check if pilot has assignment on this date
    const hasAssignment = pilot.assignments?.some(a => a.date?.startsWith(date));
    const isUnavailable = pilot.unavailable_dates?.includes(date);
    return !hasAssignment && !isUnavailable;
  };

  const getPilotAssignment = (pilot, date) => {
    return pilot.assignments?.find(a => a.date?.startsWith(date));
  };

  const renderCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    const today = new Date();
    
    // Empty cells
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-1 h-20 bg-slate-900/30" />);
    }
    
    // Calendar days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = data?.bookings?.filter(b => b.date?.startsWith(dateKey)) || [];
      
      const isToday = today.getDate() === day && 
                      today.getMonth() === month && 
                      today.getFullYear() === year;
      
      const isSelected = selectedDate === dateKey;
      
      days.push(
        <div 
          key={day}
          onClick={() => setSelectedDate(dateKey)}
          className={`p-1 h-20 border border-slate-700 cursor-pointer transition-all overflow-hidden ${
            isToday ? 'bg-blue-500/10 border-blue-500/50' : 'bg-slate-800/30 hover:bg-slate-800/50'
          } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
            {day}
          </div>
          <div className="space-y-0.5">
            {dayBookings.slice(0, 2).map((booking, idx) => (
              <div 
                key={idx}
                className={`text-xs px-1 py-0.5 rounded truncate ${
                  booking.assigned_pilot_id 
                    ? 'bg-green-500/20 text-green-400 border-l-2 border-green-500' 
                    : 'bg-orange-500/20 text-orange-400 border-l-2 border-orange-500'
                }`}
              >
                {booking.route?.split('→')[0]?.trim()?.slice(0, 8)}
              </div>
            ))}
            {dayBookings.length > 2 && (
              <div className="text-xs text-slate-500">+{dayBookings.length - 2}</div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  const selectedBookings = selectedDate 
    ? (data?.bookings?.filter(b => b.date?.startsWith(selectedDate)) || [])
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-blue-400" />
            Pilot Assignment</h2>
          <p className="text-slate-400 mt-1">Assign pilots to bookings from calendar view</p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-slate-600">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
          <User className="h-6 w-6 text-blue-400 mb-2" />
          <p className="text-3xl font-bold text-white">{data?.total_pilots || 0}</p>
          <p className="text-slate-400 text-sm">Total Pilots</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
          <Check className="h-6 w-6 text-green-400 mb-2" />
          <p className="text-3xl font-bold text-green-400">
            {(data?.bookings?.length || 0) - (data?.unassigned_bookings || 0)}
          </p>
          <p className="text-slate-400 text-sm">Assigned</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-xl p-4 border border-orange-500/30">
          <AlertCircle className="h-6 w-6 text-orange-400 mb-2" />
          <p className="text-3xl font-bold text-orange-400">{data?.unassigned_bookings || 0}</p>
          <p className="text-slate-400 text-sm">Unassigned</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
          <Plane className="h-6 w-6 text-purple-400 mb-2" />
          <p className="text-3xl font-bold text-purple-400">{data?.bookings?.length || 0}</p>
          <p className="text-slate-400 text-sm">Total Bookings</p>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={prevMonth} variant="outline" size="sm" className="border-slate-600">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-white font-semibold text-lg min-w-[200px] text-center">
            {currentDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h3>
          <Button onClick={nextMonth} variant="outline" size="sm" className="border-slate-600">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" /> Assigned
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-500" /> Unassigned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-slate-400 font-medium text-sm">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        </div>

        {/* Right Panel - Bookings & Assignment */}
        <div className="space-y-4">
          {/* Selected Date Bookings */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-400" />
              {selectedDate ? new Date(selectedDate).toLocaleDateString('en-IN', { 
                weekday: 'short', day: 'numeric', month: 'short' 
              }) : 'Select a date'}
            </h4>
            
            {selectedBookings.length > 0 ? (
              <div className="space-y-2">
                {selectedBookings.map((booking) => (
                  <div 
                    key={booking.id}
                    onClick={() => setSelectedBooking(booking)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedBooking?.id === booking.id 
                        ? 'bg-blue-500/20 border border-blue-500/50' 
                        : 'bg-slate-900/50 hover:bg-slate-800/50'
                    } ${booking.assigned_pilot_id ? 'border-l-4 border-green-500' : 'border-l-4 border-orange-500'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium text-sm">{booking.route}</span>
                      {booking.assigned_pilot_id ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-400" />
                      )}
                    </div>
                    <p className="text-slate-400 text-xs">{booking.customer}</p>
                    {booking.assigned_pilot_id && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-green-400 text-xs">
                          Pilot assigned
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); unassignPilot(booking.id); }}
                          className="text-red-400 text-xs hover:text-red-300"
                        >
                          Unassign
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">
                {selectedDate ? 'No bookings on this date' : 'Click a date to see bookings'}
              </p>
            )}
          </div>

          {/* Pilot Selection for Assignment */}
          {selectedBooking && !selectedBooking.assigned_pilot_id && (
            <div className="bg-slate-800/50 rounded-xl border border-blue-500/30 p-4">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-400" />
                Assign Pilot</h4>
              <p className="text-slate-400 text-sm mb-3">
                Select pilot for: <span className="text-white">{selectedBooking.route}</span>
              </p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data?.pilots?.map((pilotData) => {
                  const pilot = pilotData.pilot;
                  const isAvailable = isPilotAvailable(pilotData, selectedDate);
                  const assignment = getPilotAssignment(pilotData, selectedDate);
                  
                  return (
                    <div 
                      key={pilot.id}
                      className={`p-3 rounded-lg ${
                        isAvailable 
                          ? 'bg-slate-900/50 hover:bg-green-500/10 cursor-pointer' 
                          : 'bg-slate-900/30 opacity-50'
                      }`}
                      onClick={() => isAvailable && assignPilot(pilot.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className={`h-5 w-5 ${isAvailable ? 'text-green-400' : 'text-slate-500'}`} />
                          <div>
                            <p className="text-white text-sm font-medium">{pilot.name}</p>
                            <p className="text-slate-500 text-xs">{pilot.license_number}</p>
                          </div>
                        </div>
                        {isAvailable ? (
                          <span className="text-green-400 text-xs px-2 py-1 bg-green-500/20 rounded">
                            Available
                          </span>
                        ) : (
                          <span className="text-red-400 text-xs px-2 py-1 bg-red-500/20 rounded">
                            {assignment ? 'Assigned' : 'Unavailable'}
                          </span>
                        )}
                      </div>
                      {assignment && (
                        <p className="text-slate-500 text-xs mt-1">
                          Already on: {assignment.route}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <Button 
                onClick={() => setSelectedBooking(null)}
                variant="outline" 
                className="w-full mt-3 border-slate-600"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Pilots Availability Grid */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-blue-400" />
            Pilot Overview</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium text-sm">Pilot</th>
                <th className="text-left p-3 text-slate-400 font-medium text-sm">License</th>
                <th className="text-left p-3 text-slate-400 font-medium text-sm">Phone</th>
                <th className="text-center p-3 text-slate-400 font-medium text-sm">This Month Assignments</th>
                <th className="text-center p-3 text-slate-400 font-medium text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.pilots?.map((pilotData) => {
                const pilot = pilotData.pilot;
                const assignmentCount = pilotData.assignments?.length || 0;
                
                return (
                  <tr key={pilot.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className="text-white font-medium">{pilot.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400">{pilot.license_number || 'N/A'}</td>
                    <td className="p-3">
                      {pilot.phone && (
                        <span className="text-slate-400 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {pilot.phone}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm ${
                        assignmentCount > 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {assignmentCount} flights
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PilotAssignmentCalendar;
