import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Calendar, Users, Clock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bookingAPI } from '../services/api';
import { toast } from 'sonner';
import PinCodeInput from '../components/shared/PinCodeInput';
import PriceCalculator from '../components/shared/PriceCalculator';

function BookingPage({ user }) {
  const [formData, setFormData] = useState({
    from_pincode: '',
    from_location: '',
    from_state: '',
    from_district: '',
    from_area: '',
    from_latitude: null,
    from_longitude: null,
    to_pincode: '',
    to_location: '',
    to_state: '',
    to_district: '',
    to_area: '',
    to_latitude: null,
    to_longitude: null,
    departure_date: '',
    passengers: 1,
    trip_type: 'one_way',
    waiting_hours: 0,
    special_requirements: ''
  });
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePickupLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      from_pincode: location.pincode,
      from_location: `${location.area}, ${location.district}`,
      from_state: location.state,
      from_district: location.district,
      from_area: location.area,
      from_latitude: location.latitude,
      from_longitude: location.longitude
    }));
  };

  const handleDropLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      to_pincode: location.pincode,
      to_location: `${location.area}, ${location.district}`,
      to_state: location.state,
      to_district: location.district,
      to_area: location.area,
      to_latitude: location.latitude,
      to_longitude: location.longitude
    }));
  };

  const handlePriceCalculated = (estimate) => {
    setPriceEstimate(estimate);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to book a flight');
      navigate('/login');
      return;
    }

    if (!formData.from_latitude || !formData.to_latitude) {
      toast.error('Please enter valid PIN codes for pickup and drop locations');
      return;
    }

    setLoading(true);
    try {
      const bookingData = {
        from_location: formData.from_location,
        from_pincode: formData.from_pincode,
        from_state: formData.from_state,
        from_district: formData.from_district,
        from_area: formData.from_area,
        from_coordinates: {
          latitude: formData.from_latitude,
          longitude: formData.from_longitude
        },
        to_location: formData.to_location,
        to_pincode: formData.to_pincode,
        to_state: formData.to_state,
        to_district: formData.to_district,
        to_area: formData.to_area,
        to_coordinates: {
          latitude: formData.to_latitude,
          longitude: formData.to_longitude
        },
        departure_date: formData.departure_date,
        passengers: formData.passengers,
        trip_type: formData.trip_type,
        waiting_hours: formData.waiting_hours,
        special_requirements: formData.special_requirements,
        estimated_distance_km: priceEstimate?.distance_km,
        estimated_price: priceEstimate?.total_price,
        advance_amount: priceEstimate?.advance_amount
      };

      const response = await bookingAPI.create(bookingData);
      toast.success('Booking request created! Operators will send quotes soon.');
      navigate('/customer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
          {user && (
            <Link to="/customer" className="text-orange-400 hover:text-orange-300">
              My Dashboard →
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4" data-testid="booking-title">
            Book Your Flight
          </h1>
          <p className="text-xl text-slate-400">
            Search for helicopter charters and get instant price estimates
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="booking-form">
              {/* Pickup Location */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white text-sm flex items-center justify-center">1</span>
                  Pickup Location
                </h3>
                <PinCodeInput
                  label="Pickup PIN Code"
                  value={formData.from_pincode}
                  onChange={(val) => setFormData(prev => ({ ...prev, from_pincode: val }))}
                  onLocationSelect={handlePickupLocationSelect}
                  placeholder="Enter pickup PIN code"
                  required
                />
              </div>

              {/* Drop Location */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-sm flex items-center justify-center">2</span>
                  Drop Location
                </h3>
                <PinCodeInput
                  label="Drop PIN Code"
                  value={formData.to_pincode}
                  onChange={(val) => setFormData(prev => ({ ...prev, to_pincode: val }))}
                  onLocationSelect={handleDropLocationSelect}
                  placeholder="Enter drop PIN code"
                  required
                />
              </div>

              {/* Trip Details */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-sm flex items-center justify-center">3</span>
                  Trip Details
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departure_date" className="text-white">Departure Date & Time</Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="trip_type" className="text-white">Trip Type</Label>
                    <select
                      id="trip_type"
                      name="trip_type"
                      value={formData.trip_type}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-white"
                      data-testid="trip-type-select"
                    >
                      <option value="one_way">One Way</option>
                      <option value="round_trip">Round Trip</option>
                      <option value="hourly">Hourly Charter</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="waiting_hours" className="text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-400" />
                      Waiting Time (Hours)
                    </Label>
                    <Input
                      id="waiting_hours"
                      name="waiting_hours"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.waiting_hours}
                      onChange={handleChange}
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Special Requirements */}
              <div className="space-y-2">
                <Label htmlFor="special_requirements" className="text-white">Special Requirements (Optional)</Label>
                <textarea
                  id="special_requirements"
                  name="special_requirements"
                  value={formData.special_requirements}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Any special requests or requirements..."
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-white"
                  data-testid="special-requirements-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
                disabled={loading || !formData.from_latitude || !formData.to_latitude}
                data-testid="submit-booking-btn"
              >
                {loading ? 'Creating Request...' : 'Request Quotes'}
              </Button>
            </form>
          </div>

          {/* Price Calculator Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              <PriceCalculator
                pickupLocation={{
                  latitude: formData.from_latitude,
                  longitude: formData.from_longitude,
                  area: formData.from_area,
                  district: formData.from_district
                }}
                dropLocation={{
                  latitude: formData.to_latitude,
                  longitude: formData.to_longitude,
                  area: formData.to_area,
                  district: formData.to_district
                }}
                onPriceCalculated={handlePriceCalculated}
                showWaitingTime={false}
              />

              {/* Pricing Info */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <h4 className="text-white font-medium mb-3">Pricing Info</h4>
                <ul className="text-sm text-slate-400 space-y-2">
                  <li>• Base price: ₹50,000 (up to 50 km)</li>
                  <li>• Additional: ₹1,000/km after 50 km</li>
                  <li>• Waiting: ₹5,000/hour</li>
                  <li>• GST: 18%</li>
                  <li>• Advance: 5% required</li>
                </ul>
              </div>

              {/* Payment Info */}
              {priceEstimate && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <CreditCard className="h-5 w-5" />
                    <span className="font-medium">Ready to Book!</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Pay ₹{priceEstimate.advance_amount?.toLocaleString()} advance to confirm your booking.
                    Remaining amount to be paid after trip completion.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingPage;
