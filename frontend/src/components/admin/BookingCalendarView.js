import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { 
  ChevronLeft, ChevronRight, Plane, MapPin, User, Clock, 
  CreditCard, CheckCircle, AlertTriangle, Calendar as CalendarIcon,
  RefreshCw, Filter
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BookingCalendarView() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadBookings();
  }, [currentMonth]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Get start and end of current month view (with padding for calendar)
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);
      
      const res = await fetch(
        `${API_URL}/api/admin/payments/calendar-bookings?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        setBookings(data.flights || []);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get bookings for a specific date
  const getBookingsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter(b => b.departure_date === dateStr);
  };

  // Get selected date bookings
  const selectedDateBookings = getBookingsForDate(selectedDate);
  
  // Filter bookings by payment status
  const filteredBookings = filterStatus === 'all' 
    ? selectedDateBookings 
    : selectedDateBookings.filter(b => {
        if (filterStatus === 'paid') return b.payment_status === 'paid' || b.payment_status === 'fully_paid';
        if (filterStatus === 'pending') return !b.payment_status || b.payment_status === 'pending';
        return true;
      });

  // Get payment status badge
  const getPaymentBadge = (booking) => {
    const status = booking.payment_status;
    if (status === 'fully_paid') {
      return <Badge className="bg-green-500/20 text-green-400 border-0"><CheckCircle className="h-3 w-3 mr-1" />Fully Paid</Badge>;
    }
    if (status === 'paid') {
      return <Badge className="bg-blue-500/20 text-blue-400 border-0"><CreditCard className="h-3 w-3 mr-1" />Advance Paid</Badge>;
    }
    return <Badge className="bg-orange-500/20 text-orange-400 border-0"><AlertTriangle className="h-3 w-3 mr-1" />Payment Pending</Badge>;
  };

  // Custom day render for calendar
  const getDayContent = (day) => {
    const dayBookings = getBookingsForDate(day);
    if (dayBookings.length === 0) return null;
    
    const hasPending = dayBookings.some(b => !b.payment_status || b.payment_status === 'pending');
    const hasPartial = dayBookings.some(b => b.payment_status === 'paid');
    const allPaid = dayBookings.every(b => b.payment_status === 'fully_paid');
    
    return (
      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
        {dayBookings.length <= 3 ? (
          dayBookings.map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full ${
                allPaid ? 'bg-green-500' : hasPartial ? 'bg-blue-500' : 'bg-orange-500'
              }`}
            />
          ))
        ) : (
          <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            allPaid ? 'bg-green-500' : hasPartial ? 'bg-blue-500' : 'bg-orange-500'
          } text-white`}>
            {dayBookings.length}
          </div>
        )}
      </div>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6" data-testid="booking-calendar-view">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-orange-500" />
            Flight Calendar
          </h1>
          <p className="text-slate-400 mt-1">View all upcoming flights with payment status</p>
        </div>
        <Button 
          onClick={loadBookings} 
          variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid lg:grid-cols-[400px_1fr] gap-6">
        {/* Calendar */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="text-slate-400 hover:text-white">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-white text-lg">
                {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="text-slate-400 hover:text-white">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="[&_.rdp]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="rounded-md"
                classNames={{
                  day_selected: "bg-orange-500 text-white hover:bg-orange-600",
                  day_today: "bg-slate-700 text-orange-400",
                  day: "relative h-10 w-10 text-slate-300 hover:bg-slate-700 rounded-lg",
                }}
                components={{
                  DayContent: ({ date }) => (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span>{date.getDate()}</span>
                      {getDayContent(date)}
                    </div>
                  ),
                }}
              />
            </div>
            
            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-slate-400">Fully Paid</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-400">Advance Paid</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-slate-400">Payment Pending</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Bookings */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-white flex items-center gap-2">
                <Plane className="h-5 w-5 text-orange-500" />
                {selectedDate.toLocaleDateString('en-IN', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long',
                  year: 'numeric'
                })}
                {selectedDateBookings.length > 0 && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-0 ml-2">
                    {selectedDateBookings.length} flight{selectedDateBookings.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              
              {/* Filter */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  className={filterStatus === 'all' ? 'bg-orange-500' : 'border-slate-600 text-slate-400'}
                  onClick={() => setFilterStatus('all')}
                >
                  All
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'paid' ? 'default' : 'outline'}
                  className={filterStatus === 'paid' ? 'bg-green-600' : 'border-slate-600 text-slate-400'}
                  onClick={() => setFilterStatus('paid')}
                >
                  Paid
                </Button>
                <Button 
                  size="sm" 
                  variant={filterStatus === 'pending' ? 'default' : 'outline'}
                  className={filterStatus === 'pending' ? 'bg-orange-600' : 'border-slate-600 text-slate-400'}
                  onClick={() => setFilterStatus('pending')}
                >
                  Pending
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-12">
                <Plane className="h-16 w-16 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400">No flights scheduled for this date</p>
                <p className="text-slate-500 text-sm mt-1">Select another date from the calendar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((booking, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 hover:border-orange-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Route */}
                        <div className="flex items-center gap-2 text-white font-semibold">
                          <MapPin className="h-4 w-4 text-orange-500" />
                          {booking.from_location || 'Origin'} → {booking.to_location || 'Destination'}
                        </div>
                        
                        {/* Customer & Details */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {booking.customer_name || 'Customer'}
                          </span>
                          {booking.departure_time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {booking.departure_time}
                            </span>
                          )}
                          <span className="text-orange-400 font-mono text-xs">
                            #{booking.inquiry_number || booking.booking_number || booking.id?.slice(0, 8)}
                          </span>
                        </div>
                        
                        {/* Amount */}
                        {(booking.accepted_quote?.amount || booking.estimated_price) && (
                          <div className="mt-2">
                            <span className="text-slate-500 text-sm">Amount: </span>
                            <span className="text-white font-semibold">
                              {formatCurrency(booking.accepted_quote?.amount || booking.estimated_price)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Payment Status */}
                      <div className="text-right">
                        {getPaymentBadge(booking)}
                        {booking.payment_status === 'paid' && (
                          <p className="text-xs text-orange-400 mt-1">50% pending</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
