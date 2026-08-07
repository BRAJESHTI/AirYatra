import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Plane, Clock, Users, MapPin, RefreshCw, Filter,
  Loader2, Eye, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

/**
 * Booking Calendar View
 * Visual calendar for admin/operators to manage bookings
 */
export default function BookingCalendar({ userRole = 'admin' }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month, week
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch bookings for the current month
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get start and end of month
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      // Try inquiries endpoint first (main booking flow)
      const res = await api.get('/inquiries/admin/all', {
        params: {
          start_date: startDate,
          end_date: endDate,
          limit: 500
        }
      });
      
      if (res.data.inquiries) {
        setBookings(res.data.inquiries);
      } else if (Array.isArray(res.data)) {
        setBookings(res.data);
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      // Try alternative endpoint
      try {
        const res = await api.get('/bookings/list', {
          params: { limit: 500 }
        });
        setBookings(res.data.bookings || res.data || []);
      } catch {
        setBookings([]);
      }
    }
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay, year, month };
  };

  const { daysInMonth, startingDay, year, month } = getDaysInMonth(currentDate);

  // Get bookings for a specific date
  const getBookingsForDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    return bookings.filter(b => {
      const bookingDate = b.departure_date || b.date || b.travel_date;
      if (!bookingDate) return false;
      
      const bDateStr = typeof bookingDate === 'string' 
        ? bookingDate.split('T')[0] 
        : new Date(bookingDate).toISOString().split('T')[0];
      
      return bDateStr === dateStr;
    }).filter(b => {
      if (statusFilter === 'all') return true;
      return b.status === statusFilter;
    });
  };

  // Navigation
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Status colors
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'approved':
        return 'bg-green-500';
      case 'pending':
      case 'pending_payment':
        return 'bg-yellow-500';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-500';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
      case 'pending_payment':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Render calendar grid
  const renderCalendarDays = () => {
    const days = [];
    const today = new Date();
    const isToday = (day) => 
      today.getDate() === day && 
      today.getMonth() === month && 
      today.getFullYear() === year;

    // Empty cells for days before the first day of month
    for (let i = 0; i < startingDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="h-28 bg-slate-900/30 border border-slate-800" />
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayBookings = getBookingsForDate(day);
      const hasBookings = dayBookings.length > 0;

      days.push(
        <div
          key={day}
          className={`h-28 border border-slate-700 p-1 cursor-pointer transition-all hover:bg-slate-700/50 ${
            isToday(day) ? 'bg-orange-500/10 border-orange-500' : 'bg-slate-800/50'
          } ${selectedDate === day ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => {
            setSelectedDate(day);
            if (dayBookings.length === 1) {
              setSelectedBooking(dayBookings[0]);
            }
          }}
        >
          {/* Day number */}
          <div className={`text-sm font-medium mb-1 ${isToday(day) ? 'text-orange-500' : 'text-slate-300'}`}>
            {day}
          </div>

          {/* Booking indicators */}
          <div className="space-y-0.5 overflow-hidden max-h-20">
            {dayBookings.slice(0, 3).map((booking, idx) => (
              <div
                key={booking.id || idx}
                className={`text-xs px-1 py-0.5 rounded truncate ${getStatusColor(booking.status)} bg-opacity-20 text-white`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBooking(booking);
                }}
                title={`${booking.from_city || 'Origin'} → ${booking.to_city || 'Dest'}`}
              >
                <span className="flex items-center gap-1">
                  <Plane className="h-3 w-3" />
                  {booking.from_city?.substring(0, 3) || 'DEP'} → {booking.to_city?.substring(0, 3) || 'ARR'}
                </span>
              </div>
            ))}
            {dayBookings.length > 3 && (
              <div className="text-xs text-slate-400 pl-1">
                +{dayBookings.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="space-y-4" data-testid="booking-calendar">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-orange-500" />
            Booking Calendar
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Visual overview of all scheduled flights
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>

          <Button variant="outline" onClick={fetchBookings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <Button variant="ghost" onClick={goToPrevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <h3 className="text-xl font-bold text-white">
          {monthNames[month]} {year}
        </h3>

        <Button variant="ghost" onClick={goToNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['all', 'confirmed', 'pending', 'completed', 'cancelled'].map(status => {
          const count = status === 'all' 
            ? bookings.length 
            : bookings.filter(b => b.status === status).length;
          
          return (
            <div 
              key={status}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                statusFilter === status 
                  ? 'bg-orange-500/20 border-orange-500' 
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
              onClick={() => setStatusFilter(status)}
            >
              <p className="text-xs text-slate-400 capitalize">{status === 'all' ? 'Total' : status}</p>
              <p className="text-xl font-bold text-white">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-slate-800">
            {dayNames.map(day => (
              <div key={day} className="text-center py-2 text-sm font-medium text-slate-400 border-b border-slate-700">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {renderCalendarDays()}
          </div>
        </div>
      )}

      {/* Selected Date Bookings */}
      {selectedDate && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h4 className="text-lg font-semibold text-white mb-3">
            Bookings for {monthNames[month]} {selectedDate}, {year}
          </h4>
          
          {getBookingsForDate(selectedDate).length === 0 ? (
            <p className="text-slate-400">No bookings on this date</p>
          ) : (
            <div className="space-y-2">
              {getBookingsForDate(selectedDate).map((booking, idx) => (
                <div
                  key={booking.id || idx}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 cursor-pointer"
                  onClick={() => setSelectedBooking(booking)}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(booking.status)}
                    <div>
                      <p className="font-medium text-white">
                        {booking.from_city} → {booking.to_city}
                      </p>
                      <p className="text-sm text-slate-400">
                        {booking.customer_name || booking.email || 'Customer'} • {booking.passenger_count || 1} pax
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-400">
                      ₹{(booking.total_amount || booking.amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">{booking.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Detail Modal */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-orange-500" />
              Booking Details
            </DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedBooking.status)}
                <span className={`px-3 py-1 rounded-full text-sm capitalize ${
                  selectedBooking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                  selectedBooking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  selectedBooking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {selectedBooking.status}
                </span>
              </div>

              {/* Route */}
              <div className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{selectedBooking.from_city?.substring(0, 3).toUpperCase() || 'DEP'}</p>
                    <p className="text-sm text-slate-400">{selectedBooking.from_city}</p>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="border-t-2 border-dashed border-slate-600 w-16" />
                    <Plane className="h-5 w-5 text-orange-500 mx-2" />
                    <div className="border-t-2 border-dashed border-slate-600 w-16" />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{selectedBooking.to_city?.substring(0, 3).toUpperCase() || 'ARR'}</p>
                    <p className="text-sm text-slate-400">{selectedBooking.to_city}</p>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Date</p>
                  <p className="font-medium text-white">{selectedBooking.departure_date || selectedBooking.date}</p>
                </div>
                <div>
                  <p className="text-slate-400">Time</p>
                  <p className="font-medium text-white">{selectedBooking.departure_time || 'TBD'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Passengers</p>
                  <p className="font-medium text-white">{selectedBooking.passenger_count || 1}</p>
                </div>
                <div>
                  <p className="text-slate-400">Aircraft</p>
                  <p className="font-medium text-white">{selectedBooking.aircraft_type || 'Helicopter'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Customer</p>
                  <p className="font-medium text-white">{selectedBooking.customer_name || selectedBooking.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Booking ID</p>
                  <p className="font-medium text-white font-mono">{selectedBooking.id?.substring(0, 8) || 'N/A'}</p>
                </div>
              </div>

              {/* Amount */}
              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Total Amount</span>
                  <span className="text-2xl font-bold text-orange-400">
                    ₹{(selectedBooking.total_amount || selectedBooking.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(`/admin/bookings/${selectedBooking.id}`, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
