import React, { useState, useEffect } from 'react';
import { PieChart, BarChart3, TrendingUp } from 'lucide-react';
import { reportsAPI } from '@/services/api';

function BookingPurposeChart() {
  const [purposeData, setPurposeData] = useState([]);
  const [bookingForData, setBookingForData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState('purpose'); // purpose or booking_for

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [purposeRes, bookingForRes] = await Promise.all([
        reportsAPI.getBookingsByPurpose({}),
        reportsAPI.getBookingsByBookingFor({})
      ]);
      setPurposeData(purposeRes.data.purposes || []);
      setBookingForData(bookingForRes.data.categories || []);
    } catch (error) {
      console.error('Failed to load purpose data');
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (index) => {
    const colors = [
      'bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
      'bg-pink-500', 'bg-yellow-500', 'bg-cyan-500', 'bg-red-500',
      'bg-indigo-500', 'bg-teal-500', 'bg-amber-500'
    ];
    return colors[index % colors.length];
  };

  const getBarColorLight = (index) => {
    const colors = [
      'bg-orange-500/20', 'bg-blue-500/20', 'bg-green-500/20', 'bg-purple-500/20',
      'bg-pink-500/20', 'bg-yellow-500/20', 'bg-cyan-500/20', 'bg-red-500/20',
      'bg-indigo-500/20', 'bg-teal-500/20', 'bg-amber-500/20'
    ];
    return colors[index % colors.length];
  };

  const getTextColor = (index) => {
    const colors = [
      'text-orange-400', 'text-blue-400', 'text-green-400', 'text-purple-400',
      'text-pink-400', 'text-yellow-400', 'text-cyan-400', 'text-red-400',
      'text-indigo-400', 'text-teal-400', 'text-amber-400'
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return <div className="text-slate-400 text-center py-8">Loading chart data...</div>;
  }

  const currentData = viewType === 'purpose' ? purposeData : bookingForData;
  const maxBookings = Math.max(...currentData.map(d => d.total_bookings), 1);

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewType('purpose')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'purpose'
              ? 'bg-orange-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <PieChart className="h-4 w-4 inline mr-2" />
          By Purpose
        </button>
        <button
          onClick={() => setViewType('booking_for')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'booking_for'
              ? 'bg-orange-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          By Booking For
        </button>
      </div>

      {currentData.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No booking data available</div>
      ) : (
        <>
          {/* Bar Chart */}
          <div className="space-y-3">
            {currentData.map((item, index) => (
              <div key={index} className={`p-3 rounded-lg ${getBarColorLight(index)} border border-slate-700`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium text-sm">
                    {viewType === 'purpose' ? item.purpose_label : item.category_label}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${getTextColor(index)}`}>
                      {item.total_bookings} bookings
                    </span>
                    <span className="text-slate-400 text-sm">
                      ({item.percentage}%)
                    </span>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getBarColor(index)} transition-all duration-500`}
                    style={{ width: `${(item.total_bookings / maxBookings) * 100}%` }}
                  />
                </div>
                {viewType === 'purpose' && (
                  <div className="mt-2 flex justify-between text-xs text-slate-400">
                    <span>Passengers: {item.total_passengers}</span>
                    <span>Revenue: ₹{item.total_revenue?.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary Pie Chart Representation */}
          <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <h4 className="text-white font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              Distribution Summary
            </h4>
            <div className="flex flex-wrap gap-3">
              {currentData.slice(0, 6).map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getBarColor(index)}`} />
                  <span className="text-slate-300 text-sm">
                    {(viewType === 'purpose' ? item.purpose_label : item.category_label).split('/')[0].trim()}
                  </span>
                  <span className={`${getTextColor(index)} text-sm font-medium`}>
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BookingPurposeChart;
