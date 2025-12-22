import React, { useState, useEffect } from 'react';
import { Plane, MapPin, Calendar, Clock, IndianRupee, Star, MessageSquare, FileText, X, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { customerAPI, feedbackAPI } from '../../services/api';
import { toast } from 'sonner';

function MyTrips({ user }) {
  const [trips, setTrips] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [reviewData, setReviewData] = useState({ overall_rating: 5, comment: '', recommend: true });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const response = await customerAPI.getTrips();
      setTrips(response.data.trips || []);
      setStatistics(response.data.statistics || {});
    } catch (error) {
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!selectedTrip || !cancelReason) return;
    setProcessing(true);
    try {
      const response = await customerAPI.cancelTrip(selectedTrip.id, {
        reason: cancelReason,
        is_emergency: isEmergency
      });
      toast.success(`Booking cancelled. Refund: ₹${response.data.refund_amount?.toLocaleString()}`);
      setShowCancelDialog(false);
      setSelectedTrip(null);
      setCancelReason('');
      loadTrips();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedTrip) return;
    setProcessing(true);
    try {
      await feedbackAPI.create({
        booking_id: selectedTrip.id,
        ...reviewData
      });
      toast.success('Review submitted!');
      setShowReviewDialog(false);
      setSelectedTrip(null);
      loadTrips();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit review');
    } finally {
      setProcessing(false);
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

  const filteredTrips = trips.filter(trip => {
    if (activeTab === 'upcoming') return ['pending', 'confirmed'].includes(trip.status);
    if (activeTab === 'completed') return trip.status === 'completed';
    if (activeTab === 'cancelled') return trip.status === 'cancelled';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto" data-testid="my-trips">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">My Trips</h1>
        <p className="text-slate-400 mt-1">View and manage your helicopter bookings</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="glass p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-white">{statistics.total_trips || 0}</p>
          <p className="text-sm text-slate-400">Total Trips</p>
        </div>
        <div className="glass p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-400">{statistics.upcoming_count || 0}</p>
          <p className="text-sm text-slate-400">Upcoming</p>
        </div>
        <div className="glass p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-400">{statistics.completed_count || 0}</p>
          <p className="text-sm text-slate-400">Completed</p>
        </div>
        <div className="glass p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-orange-400">₹{(statistics.total_spent || 0).toLocaleString()}</p>
          <p className="text-sm text-slate-400">Total Spent</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['upcoming', 'completed', 'cancelled', 'all'].map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'bg-orange-500 hover:bg-orange-600' : 'border-slate-600 text-slate-300'}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {/* Trips List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading trips...</div>
      ) : filteredTrips.length === 0 ? (
        <div className="text-center py-12">
          <Plane className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No trips found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrips.map((trip) => (
            <div key={trip.id} className="glass p-6 rounded-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-white font-semibold text-lg">{trip.booking_number || `#${trip.id?.slice(0, 8)}`}</p>
                  <div className="flex items-center gap-2 mt-2 text-slate-300">
                    <MapPin className="h-4 w-4 text-green-400" />
                    <span>{trip.from_location}</span>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                    <MapPin className="h-4 w-4 text-red-400" />
                    <span>{trip.to_location}</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadge(trip.status)}`}>
                  {trip.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="h-4 w-4" />
                  <span>{trip.departure_date ? new Date(trip.departure_date).toLocaleDateString() : 'TBD'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Plane className="h-4 w-4" />
                  <span>{trip.operator?.company_name || 'Operator TBD'}</span>
                </div>
                <div className="flex items-center gap-2 text-white font-semibold">
                  <IndianRupee className="h-4 w-4" />
                  <span>₹{(trip.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-slate-700">
                {trip.status === 'completed' && !trip.feedback && (
                  <Button
                    size="sm"
                    className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                    onClick={() => { setSelectedTrip(trip); setShowReviewDialog(true); }}
                  >
                    <Star className="h-4 w-4 mr-1" /> Rate Trip
                  </Button>
                )}
                {['pending', 'confirmed'].includes(trip.status) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setSelectedTrip(trip); setShowCancelDialog(true); }}
                  >
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                  onClick={() => setSelectedTrip(trip)}
                >
                  <FileText className="h-4 w-4 mr-1" /> Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                >
                  <MessageSquare className="h-4 w-4 mr-1" /> Chat
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Cancel Booking
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-400">Are you sure you want to cancel this booking?</p>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Reason for cancellation *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                rows={3}
                placeholder="Please provide a reason..."
              />
            </div>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
                className="rounded"
              />
              <span>This is an emergency cancellation (full refund)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="border-slate-600 text-slate-300">
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancelTrip} disabled={processing || !cancelReason}>
              {processing ? 'Processing...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Rate Your Trip</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Overall Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewData({ ...reviewData, overall_rating: star })}
                    className={`p-2 rounded ${star <= reviewData.overall_rating ? 'text-yellow-400' : 'text-slate-600'}`}
                  >
                    <Star className="h-8 w-8" fill={star <= reviewData.overall_rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Your Review</label>
              <textarea
                value={reviewData.comment}
                onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
                rows={3}
                placeholder="Share your experience..."
              />
            </div>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={reviewData.recommend}
                onChange={(e) => setReviewData({ ...reviewData, recommend: e.target.checked })}
                className="rounded"
              />
              <span>I would recommend this operator</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={processing} className="bg-orange-500 hover:bg-orange-600">
              {processing ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MyTrips;
