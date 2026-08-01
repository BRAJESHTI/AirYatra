import React, { useState, useEffect } from 'react';
import { 
  Calendar, Wrench, Plane, ChevronLeft, ChevronRight, Download,
  AlertTriangle, Clock, DollarSign, User, RefreshCw, Filter,
  CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function FleetMaintenanceCalendar() {
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadCalendar();
  }, [currentDate]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_URL}/api/maintenance/calendar?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const json = await res.json();
      setCalendarData(json);
    } catch (error) {
      toast.error('Failed to load maintenance calendar');
    } finally {
      setLoading(false);
    }
  };

  const exportIcal = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/maintenance/calendar/ical?months_ahead=3`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `maintenance_calendar_${new Date().toISOString().split('T')[0]}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Calendar exported! Import to Google Calendar/Outlook');
    } catch (error) {
      toast.error('Failed to export calendar');
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'in_progress': return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <Clock className="h-4 w-4 text-yellow-400" />;
    }
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
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 h-24 bg-slate-900/30" />);
    }
    
    // Calendar days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = calendarData?.calendar?.[dateKey] || [];
      const filteredEvents = filterStatus === 'all' 
        ? dayEvents 
        : dayEvents.filter(e => e.status === filterStatus);
      
      const isToday = today.getDate() === day && 
                      today.getMonth() === month && 
                      today.getFullYear() === year;
      
      const isSelected = selectedDate === dateKey;
      
      days.push(
        <div 
          key={day}
          onClick={() => setSelectedDate(dateKey)}
          className={`p-2 h-24 border border-slate-700 cursor-pointer transition-all overflow-hidden ${
            isToday ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-800/30 hover:bg-slate-800/50'
          } ${isSelected ? 'ring-2 ring-orange-500' : ''}`}
        >
          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-orange-400' : 'text-slate-400'}`}>
            {day}
          </div>
          <div className="space-y-1">
            {filteredEvents.slice(0, 2).map((event, idx) => (
              <div 
                key={idx}
                className={`text-xs px-1 py-0.5 rounded truncate ${getPriorityColor(event.priority)}/20 border-l-2 ${getPriorityColor(event.priority)}`}
              >
                <span className="text-white">{event.aircraft_registration}</span>
              </div>
            ))}
            {filteredEvents.length > 2 && (
              <div className="text-xs text-slate-500">+{filteredEvents.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  const selectedEvents = selectedDate ? (calendarData?.calendar?.[selectedDate] || []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-400" />
            Maintenance Calendar / रखरखाव कैलेंडर
          </h2>
          <p className="text-slate-400 mt-1">Fleet maintenance schedule overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportIcal} variant="outline" className="border-slate-600">
            <Download className="h-4 w-4 mr-2" /> Export iCal
          </Button>
          <Button onClick={loadCalendar} variant="outline" className="border-slate-600">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-4 border border-blue-500/30">
          <Wrench className="h-6 w-6 text-blue-400 mb-2" />
          <p className="text-3xl font-bold text-white">{calendarData?.summary?.total || 0}</p>
          <p className="text-slate-400 text-sm">Total Scheduled / कुल</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-xl p-4 border border-yellow-500/30">
          <Clock className="h-6 w-6 text-yellow-400 mb-2" />
          <p className="text-3xl font-bold text-yellow-400">{calendarData?.summary?.by_status?.scheduled || 0}</p>
          <p className="text-slate-400 text-sm">Pending / लंबित</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
          <CheckCircle className="h-6 w-6 text-green-400 mb-2" />
          <p className="text-3xl font-bold text-green-400">{calendarData?.summary?.by_status?.completed || 0}</p>
          <p className="text-slate-400 text-sm">Completed / पूर्ण</p>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl p-4 border border-red-500/30">
          <AlertTriangle className="h-6 w-6 text-red-400 mb-2" />
          <p className="text-3xl font-bold text-red-400">{calendarData?.summary?.by_priority?.critical || 0}</p>
          <p className="text-slate-400 text-sm">Critical / गंभीर</p>
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
          <Button onClick={goToToday} variant="outline" size="sm" className="border-slate-600 ml-2">
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Priority Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">Priority:</span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" /> Critical
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-500" /> High
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500" /> Medium
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" /> Low
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-slate-400 font-medium text-sm">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-400" />
            {selectedDate ? (
              <>
                {new Date(selectedDate).toLocaleDateString('en-IN', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </>
            ) : (
              'Select a date'
            )}
          </h4>
          
          {selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map((event, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border-l-4 ${getPriorityColor(event.priority)} bg-slate-900/50`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-blue-400" />
                      <span className="text-white font-medium">{event.aircraft_registration}</span>
                    </div>
                    {getStatusIcon(event.status)}
                  </div>
                  
                  <p className="text-sm text-slate-300 mb-2">{event.description}</p>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Wrench className="h-3 w-3" />
                      {event.type}
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      {event.estimated_hours}h
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <DollarSign className="h-3 w-3" />
                      ₹{event.estimated_cost?.toLocaleString()}
                    </div>
                    {event.assigned_technician && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <User className="h-3 w-3" />
                        {event.assigned_technician}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      event.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      event.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      event.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {event.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {selectedDate ? 'No maintenance scheduled' : 'Click on a date to see details'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Maintenance List */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-400" />
            This Month&apos;s Maintenance / इस महीने का रखरखाव
          </h3>
        </div>
        
        {calendarData?.schedules?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Date</th>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Aircraft</th>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Type</th>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Description</th>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Priority</th>
                  <th className="text-left p-3 text-slate-400 font-medium text-sm">Status</th>
                  <th className="text-right p-3 text-slate-400 font-medium text-sm">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {calendarData.schedules.slice(0, 10).map((schedule, idx) => (
                  <tr key={idx} className="border-t border-slate-700 hover:bg-slate-800/50">
                    <td className="p-3 text-slate-300">
                      {new Date(schedule.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="p-3">
                      <span className="text-white font-medium">{schedule.aircraft_registration}</span>
                      <span className="text-slate-500 text-xs block">{schedule.aircraft_type}</span>
                    </td>
                    <td className="p-3 text-slate-400 capitalize">{schedule.type}</td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{schedule.description}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        schedule.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                        schedule.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        schedule.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {schedule.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(schedule.status)}
                        <span className="text-slate-400 text-sm capitalize">{schedule.status?.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right text-green-400">₹{schedule.estimated_cost?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Wrench className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No maintenance scheduled this month</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FleetMaintenanceCalendar;
