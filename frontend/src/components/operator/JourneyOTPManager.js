import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, MapPin, Clock, Send, Key, Users, Plane, AlertTriangle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { journeyAPI, operatorAPI } from '@/services/api';
import { toast } from 'sonner';

function JourneyOTPManager({ operator }) {
  const [activeBookings, setActiveBookings] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedPilot, setSelectedPilot] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [currentOTPType, setCurrentOTPType] = useState('');
  const [processingOTP, setProcessingOTP] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load active bookings that need journey management
      const bookingsResponse = await operatorAPI.getInquiries({ status: 'confirmed,in_progress' });
      setActiveBookings(bookingsResponse.data.inquiries || []);
      
      // Load pilots
      const pilotsResponse = await operatorAPI.getPilots();
      setPilots(pilotsResponse.data.pilots || []);
    } catch (error) {
      console.error('Failed to load journey data');
    } finally {
      setLoading(false);
    }
  };

  const getJourneyStatusColor = (status) => {
    const colors = {
      confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pilot_enroute: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      pickup_verified: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      in_flight: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      awaiting_completion_otp: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30'
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getJourneyStatusLabel = (status) => {
    const labels = {
      confirmed: 'Confirmed - Awaiting Pilot Assignment',
      pilot_enroute: 'Pilot En Route - Pickup OTP Sent',
      pickup_verified: 'Pickup Verified - Ready to Start',
      in_flight: 'In Flight',
      awaiting_completion_otp: 'Awaiting Completion OTP',
      completed: 'Journey Completed'
    };
    return labels[status] || status;
  };

  const handleInitiatePickup = async (booking) => {
    if (!selectedPilot) {
      toast.error('Please select a pilot first');
      return;
    }

    setProcessingOTP(true);
    try {
      const response = await journeyAPI.initiatePickup({
        booking_id: booking.id,
        pilot_id: selectedPilot
      });
      
      toast.success(`Pickup initiated! OTP sent to customer\nDebug OTP: ${response.data.debug_otp}`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate pickup');
    } finally {
      setProcessingOTP(false);
    }
  };

  const openOTPVerification = (booking, otpType) => {
    setSelectedBooking(booking);
    setCurrentOTPType(otpType);
    setOtpInput('');
    setShowOTPDialog(true);
  };

  const handleVerifyOTP = async () => {
    if (!otpInput || otpInput.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setProcessingOTP(true);
    try {
      let response;
      
      if (currentOTPType === 'pickup') {
        response = await journeyAPI.verifyPickupOTP({
          booking_id: selectedBooking.id,
          otp: otpInput,
          otp_type: 'pickup'
        });
        toast.success(`Pickup verified! Start journey OTP sent.\nDebug OTP: ${response.data.debug_otp}`);
      } else if (currentOTPType === 'start_journey') {
        response = await journeyAPI.verifyStartJourney({
          booking_id: selectedBooking.id,
          otp: otpInput,
          otp_type: 'start_journey'
        });
        toast.success('Journey started! Flight in progress.');
      } else if (currentOTPType === 'complete_journey') {
        response = await journeyAPI.verifyCompletion({
          booking_id: selectedBooking.id,
          otp: otpInput,
          otp_type: 'complete_journey'
        });
        toast.success(`Journey completed! Duration: ${response.data.flight_duration_hours} hours`);
      }
      
      setShowOTPDialog(false);
      setOtpInput('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'OTP verification failed');
    } finally {
      setProcessingOTP(false);
    }
  };

  const handleInitiateCompletion = async (booking) => {
    setProcessingOTP(true);
    try {
      const response = await journeyAPI.initiateCompletion(booking.id);
      toast.success(`Completion OTP sent to customer!\nDebug OTP: ${response.data.debug_otp}`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate completion');
    } finally {
      setProcessingOTP(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 p-4">Loading journey data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Journey OTP Management</h2>
          <p className="text-slate-400">Manage journey OTP verifications for active bookings</p>
        </div>
        <Button onClick={loadData} variant="outline" className="border-slate-700">
          Refresh</Button>
      </div>

      {/* Journey Flow Guide */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30">
        <h3 className="text-white font-semibold mb-3">Journey OTP Flow</h3>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="px-3 py-1 rounded bg-blue-500/20 text-blue-400">1. Assign Pilot</span>
          <span className="text-slate-500">→</span>
          <span className="px-3 py-1 rounded bg-yellow-500/20 text-yellow-400">2. Pickup OTP</span>
          <span className="text-slate-500">→</span>
          <span className="px-3 py-1 rounded bg-orange-500/20 text-orange-400">3. Start Journey OTP</span>
          <span className="text-slate-500">→</span>
          <span className="px-3 py-1 rounded bg-purple-500/20 text-purple-400">4. In Flight</span>
          <span className="text-slate-500">→</span>
          <span className="px-3 py-1 rounded bg-green-500/20 text-green-400">5. Complete OTP</span>
        </div>
      </div>

      {/* Active Bookings */}
      <div className="space-y-4">
        {activeBookings.length === 0 ? (
          <div className="p-8 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
            <Plane className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No active bookings requiring journey management</p>
            <p className="text-slate-500 text-sm"></p>
          </div>
        ) : (
          activeBookings.map((booking) => (
            <div key={booking.id} className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              {/* Booking Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {booking.booking_number || booking.id.slice(0, 8)}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs border ${getJourneyStatusColor(booking.journey_status || booking.status)}`}>
                      {getJourneyStatusLabel(booking.journey_status || booking.status)}
                    </span>
                  </div>
                  <p className="text-slate-400 mt-1">
                    {booking.from_location} → {booking.to_location}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-sm">Date: {booking.departure_date}</p>
                  <p className="text-slate-400 text-sm">Time: {booking.pickup_time || 'TBD'}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">{booking.passengers} Passengers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">
                    {booking.passenger_details?.[0]?.phone || booking.customer_phone || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">{booking.booking_purpose || 'General'}</span>
                </div>
              </div>

              {/* Action Buttons based on journey status */}
              <div className="flex gap-3 flex-wrap">
                {/* Step 1: Assign Pilot & Initiate Pickup */}
                {(!booking.journey_status || booking.journey_status === 'confirmed' || booking.status === 'confirmed') && (
                  <div className="flex items-center gap-2 flex-1">
                    <select
                      value={selectedPilot}
                      onChange={(e) => setSelectedPilot(e.target.value)}
                      className="h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white flex-1 max-w-xs"
                    >
                      <option value="">Select Pilot</option>
                      {pilots.filter(p => !p.is_restricted).map((pilot) => (
                        <option key={pilot.id} value={pilot.id}>
                          {pilot.name} ({pilot.license_number})
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={() => handleInitiatePickup(booking)}
                      disabled={!selectedPilot || processingOTP}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {processingOTP ? 'Sending...' : 'Initiate Pickup'}
                    </Button>
                  </div>
                )}

                {/* Step 2: Verify Pickup OTP */}
                {booking.journey_status === 'pilot_enroute' && (
                  <Button
                    onClick={() => openOTPVerification(booking, 'pickup')}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Enter Pickup OTP
                  </Button>
                )}

                {/* Step 3: Verify Start Journey OTP */}
                {booking.journey_status === 'pickup_verified' && (
                  <Button
                    onClick={() => openOTPVerification(booking, 'start_journey')}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Enter Start Journey OTP
                  </Button>
                )}

                {/* Step 4: In Flight - Send Completion OTP */}
                {booking.journey_status === 'in_flight' && (
                  <Button
                    onClick={() => handleInitiateCompletion(booking)}
                    disabled={processingOTP}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {processingOTP ? 'Sending...' : 'Send Completion OTP'}
                  </Button>
                )}

                {/* Step 5: Verify Completion OTP */}
                {booking.journey_status === 'awaiting_completion_otp' && (
                  <Button
                    onClick={() => openOTPVerification(booking, 'complete_journey')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Enter Completion OTP
                  </Button>
                )}

                {/* Completed */}
                {booking.journey_status === 'completed' && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span>Journey Completed</span>
                  </div>
                )}
              </div>

              {/* Journey Timeline */}
              {booking.journey_status && booking.journey_status !== 'confirmed' && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-2">Journey Timeline</p>
                  <div className="flex gap-2 text-xs">
                    {booking.pickup_initiated_at && (
                      <span className="px-2 py-1 rounded bg-slate-800 text-slate-400">
                        Pickup: {new Date(booking.pickup_initiated_at).toLocaleTimeString()}
                      </span>
                    )}
                    {booking.pickup_verified_at && (
                      <span className="px-2 py-1 rounded bg-slate-800 text-slate-400">
                        Verified: {new Date(booking.pickup_verified_at).toLocaleTimeString()}
                      </span>
                    )}
                    {booking.journey_started_at && (
                      <span className="px-2 py-1 rounded bg-slate-800 text-slate-400">
                        Started: {new Date(booking.journey_started_at).toLocaleTimeString()}
                      </span>
                    )}
                    {booking.journey_completed_at && (
                      <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
                        Completed: {new Date(booking.journey_completed_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* OTP Verification Dialog */}
      <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-orange-400" />
              Enter OTP</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-slate-400 text-sm">
                {currentOTPType === 'pickup' && 'Collect the Pickup OTP from the customer'}
                {currentOTPType === 'start_journey' && 'Collect the Start Journey OTP from the customer'}
                {currentOTPType === 'complete_journey' && 'Collect the Completion OTP from the customer'}
              </p>
              <p className="text-white font-medium mt-1">
                Booking: {selectedBooking?.booking_number || selectedBooking?.id?.slice(0, 8)}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-white">6-Digit OTP</Label>
              <Input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit OTP"
                className="bg-slate-800 border-slate-700 text-white text-center text-2xl tracking-widest"
              />
            </div>
            
            <p className="text-xs text-slate-500">
              The OTP is sent to the customer's phone via SMS/WhatsApp.</p>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowOTPDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleVerifyOTP} 
              disabled={processingOTP || otpInput.length !== 6}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processingOTP ? 'Verifying...' : 'Verify OTP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JourneyOTPManager;
