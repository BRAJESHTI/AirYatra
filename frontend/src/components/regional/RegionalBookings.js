import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { regionalManagerAPI } from '@/services/api';

function RegionalBookings({ region }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadBookings();
  }, [filter]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const response = await regionalManagerAPI.getBookings(status);
      setBookings(response.data.bookings || []);
    } catch (error) {
      console.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      confirmed: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Regional Bookings</h1>
          <p className="text-slate-400 mt-1">Bookings in {region || 'your region'}</p>
        </div>
        <Button onClick={loadBookings} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(status => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            onClick={() => setFilter(status)}
            className={filter === status ? 'bg-purple-500 hover:bg-purple-600' : 'border-slate-600 text-slate-300'}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white font-semibold">{booking.booking_number || `#${booking.id?.slice(0,8)}`}</p>
                  <div className="flex items-center gap-2 mt-2 text-slate-400">
                    <MapPin className="h-4 w-4 text-green-400" />
                    <span>{booking.from_location}</span>
                    <span>→</span>
                    <MapPin className="h-4 w-4 text-red-400" />
                    <span>{booking.to_location}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {booking.departure_date ? new Date(booking.departure_date).toLocaleDateString() : 'TBD'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(booking.status)}`}>
                    {booking.status}
                  </span>
                  <p className="text-white font-semibold mt-2">₹{(booking.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RegionalBookings;
