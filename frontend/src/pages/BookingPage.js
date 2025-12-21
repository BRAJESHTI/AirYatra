import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, MapPin, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bookingAPI } from '../services/api';
import { toast } from 'sonner';

function BookingPage({ user }) {
  const [formData, setFormData] = useState({
    from_location: '',
    to_location: '',
    departure_date: '',
    passengers: 1,
    trip_type: 'one_way',
    special_requirements: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to book a flight');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const response = await bookingAPI.create(formData);
      toast.success('Booking request created! Operators will send quotes soon.');
      navigate('/customer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-slate-950" data-testid="booking-page">
      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white">AirYatra</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4" data-testid="booking-title">
            Book Your Flight
          </h1>
          <p className="text-xl text-slate-400">
            Search for helicopter charters and get instant quotes from verified operators
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="booking-form">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="from_location" className="text-white">From</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="from_location"
                  name="from_location"
                  placeholder="Mumbai"
                  value={formData.from_location}
                  onChange={handleChange}
                  required
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="from-location-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to_location" className="text-white">To</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="to_location"
                  name="to_location"
                  placeholder="Pune"
                  value={formData.to_location}
                  onChange={handleChange}
                  required
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="to-location-input"
                />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="departure_date" className="text-white">Departure Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="departure_date"
                  name="departure_date"
                  type="datetime-local"
                  value={formData.departure_date}
                  onChange={handleChange}
                  required
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="departure-date-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="passengers" className="text-white">Passengers</Label>
              <div className="relative">
                <Users className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="passengers"
                  name="passengers"
                  type="number"
                  min="1"
                  max="8"
                  value={formData.passengers}
                  onChange={handleChange}
                  required
                  className="pl-10 bg-slate-900 border-slate-700 text-white"
                  data-testid="passengers-input"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip_type" className="text-white">Trip Type</Label>
            <select
              id="trip_type"
              name="trip_type"
              value={formData.trip_type}
              onChange={handleChange}
              className="w-full h-10 px-3 rounded-md bg-slate-900 border-slate-700 text-white"
              data-testid="trip-type-select"
            >
              <option value="one_way">One Way</option>
              <option value="round_trip">Round Trip</option>
              <option value="hourly">Hourly Charter</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_requirements" className="text-white">Special Requirements (Optional)</Label>
            <textarea
              id="special_requirements"
              name="special_requirements"
              value={formData.special_requirements}
              onChange={handleChange}
              rows="3"
              placeholder="Any special requests or requirements..."
              className="w-full px-3 py-2 rounded-md bg-slate-900 border-slate-700 text-white"
              data-testid="special-requirements-input"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
            disabled={loading}
            data-testid="submit-booking-btn"
          >
            {loading ? 'Creating Request...' : 'Request Quotes'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default BookingPage;