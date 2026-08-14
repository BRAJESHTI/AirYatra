import React, { useState, useEffect } from 'react';
import { MessageSquare, MapPin, Calendar, Users, Send, Sparkles, AlertTriangle, TreePine, Building2, Plane, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { quoteAPI, fleetAPI } from '../../services/api';
import api from '../../services/api';
import { toast } from 'sonner';

function InquiryInbox({ operator }) {
  const [inquiries, setInquiries] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [feePreview, setFeePreview] = useState(null);
  const [quoteData, setQuoteData] = useState({
    aircraft_id: '',
    quoted_price: '',
    validity_hours: '24',
    special_notes: '',
  });

  useEffect(() => {
    const amount = parseFloat(quoteData.quoted_price);
    if (!selectedInquiry || !amount || amount <= 0) {
      setFeePreview(null);
      return;
    }
    const booking = selectedInquiry.booking || {};
    const t = setTimeout(async () => {
      try {
        const res = await api.post('/platform-fees/preview', {
          from_location: booking.from_location || booking.pickup_location || '',
          to_location: booking.to_location || booking.drop_location || '',
          amount,
          departure_date: booking.departure_date || booking.travel_date || null,
          departure_time: booking.departure_time || booking.travel_time || null,
        });
        setFeePreview(res.data);
      } catch (e) {
        setFeePreview(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [quoteData.quoted_price, selectedInquiry]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [inquiriesRes, aircraftRes] = await Promise.all([
        quoteAPI.getInquiries(),
        fleetAPI.getAll(),
      ]);
      setInquiries(inquiriesRes.data.inquiries);
      setAircraft(aircraftRes.data.aircraft);
    } catch (error) {
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQuoteDialog = (inquiry) => {
    setSelectedInquiry(inquiry);
    setIsQuoteDialogOpen(true);
    
    // Set suggested price if AI suggestion exists
    if (inquiry.booking?.ai_price_suggestion?.total_estimated_price) {
      setQuoteData(prev => ({
        ...prev,
        quoted_price: inquiry.booking.ai_price_suggestion.total_estimated_price.toString()
      }));
    }
  };

  const handleSubmitQuote = async (e) => {
    e.preventDefault();
    
    try {
      await quoteAPI.create({
        booking_id: selectedInquiry.booking_id,
        aircraft_id: quoteData.aircraft_id,
        quoted_price: parseFloat(quoteData.quoted_price),
        validity_hours: parseInt(quoteData.validity_hours),
        special_notes: quoteData.special_notes,
      });
      
      toast.success('Quote submitted successfully!');
      setIsQuoteDialogOpen(false);
      setQuoteData({
        aircraft_id: '',
        quoted_price: '',
        validity_hours: '24',
        special_notes: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit quote');
    }
  };

  const handleChange = (e) => {
    setQuoteData({ ...quoteData, [e.target.name]: e.target.value });
  };

  if (loading) {
    return <div className="text-white">Loading inquiries...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto" data-testid="inquiry-inbox">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2" data-testid="inquiries-title">Booking Inquiries</h1>
        <p className="text-slate-400">Respond to customer booking requests with competitive quotes</p>
      </div>

      {/* Inquiries List */}
      <div className="glass p-6 rounded-lg">
        {inquiries.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No inquiries yet</p>
            <p className="text-slate-500 text-sm">Booking inquiries will appear here once your profile is verified</p>
          </div>
        ) : (
          <div className="space-y-4">
            {inquiries.map((inquiry) => {
              const booking = inquiry.booking;
              if (!booking) return null;
              
              return (
                <div key={inquiry.id} className="bg-slate-800 p-6 rounded-lg border border-slate-700" data-testid={`inquiry-${inquiry.id}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{booking.booking_number}</h3>
                      <div className="flex items-center space-x-4 text-sm text-slate-400">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{booking.from_location || booking.pickup_location} → {booking.to_location || booking.drop_location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(booking.departure_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{booking.passengers || booking.total_passengers} passengers</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleOpenQuoteDialog(inquiry)}
                      className="bg-orange-500 hover:bg-orange-600"
                      data-testid={`respond-btn-${inquiry.id}`}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Quote
                    </Button>
                  </div>

                  {/* Landing Point Details */}
                  {(booking.pickup_landing_point_type || booking.drop_landing_point_type) && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      {/* Pickup Landing Point */}
                      <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                        <p className="text-xs text-green-400 font-medium mb-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Pickup Point
                        </p>
                        <p className="text-white text-sm font-medium">
                          {booking.pickup_landing_point_name || booking.pickup_location}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {booking.pickup_landing_point_type === 'airport' && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                              <Plane className="h-3 w-3" /> Airport
                            </span>
                          )}
                          {booking.pickup_landing_point_type === 'govt_helipad' && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Govt Helipad
                            </span>
                          )}
                          {booking.pickup_landing_point_type === 'private_helipad' && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Private Helipad
                            </span>
                          )}
                          {booking.pickup_landing_point_type === 'village_land' && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs flex items-center gap-1">
                              <TreePine className="h-3 w-3" /> Village Land
                            </span>
                          )}
                          {booking.pickup_permission_required && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Permission
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Drop Landing Point */}
                      <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                        <p className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Drop Point
                        </p>
                        <p className="text-white text-sm font-medium">
                          {booking.drop_landing_point_name || booking.drop_location}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {booking.drop_landing_point_type === 'airport' && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                              <Plane className="h-3 w-3" /> Airport
                            </span>
                          )}
                          {booking.drop_landing_point_type === 'govt_helipad' && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Govt Helipad
                            </span>
                          )}
                          {booking.drop_landing_point_type === 'private_helipad' && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Private Helipad
                            </span>
                          )}
                          {booking.drop_landing_point_type === 'village_land' && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs flex items-center gap-1">
                              <TreePine className="h-3 w-3" /> Village Land
                            </span>
                          )}
                          {booking.drop_permission_required && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Permission
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Village Landing Permission Warning */}
                  {booking.permission_required && (
                    <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-yellow-400 font-medium text-sm">Village Landing - Documents Required</p>
                          <p className="text-yellow-400/70 text-xs mt-1">
                            Customer needs to upload: Collector NOC, Fire Dept, Police & SP/DCP Acknowledgments.
                            Flight only after all documents approved.
                          </p>
                          <p className="text-yellow-400/70 text-xs">
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Landing Rent Info */}
                  {booking.landing_rent_breakdown?.total > 0 && (
                    <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="text-green-400 font-medium text-sm">Landing Charges Included</p>
                          <p className="text-green-400/70 text-xs">
                            Total Landing Rent: ₹{booking.landing_rent_breakdown.total.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {booking.special_requirements && (
                    <div className="mt-4 p-3 bg-slate-900/50 rounded border border-slate-700">
                      <p className="text-sm text-slate-300">
                        <strong className="text-white">Special Requirements:</strong> {booking.special_requirements}
                      </p>
                    </div>
                  )}

                  {booking.ai_price_suggestion && (
                    <div className="mt-4 p-3 bg-blue-500/10 rounded border border-blue-500/30 flex items-start space-x-2">
                      <Sparkles className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-300 font-medium">AI Price Suggestion</p>
                        <p className="text-lg font-bold text-white">
                          ₹{booking.ai_price_suggestion.total_estimated_price?.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {booking.ai_price_suggestion.reasoning}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quote Dialog */}
      <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Submit Quote</DialogTitle>
          </DialogHeader>
          {selectedInquiry && (
            <form onSubmit={handleSubmitQuote} className="space-y-4" data-testid="quote-form">
              <div className="bg-slate-800 p-4 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Booking Details</p>
                <p className="text-white font-semibold">{selectedInquiry.booking?.booking_number}</p>
                <p className="text-slate-300 text-sm">
                  {selectedInquiry.booking?.from_location} → {selectedInquiry.booking?.to_location}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aircraft_id">Select Aircraft *</Label>
                <select
                  id="aircraft_id"
                  name="aircraft_id"
                  value={quoteData.aircraft_id}
                  onChange={handleChange}
                  required
                  className="w-full h-10 px-3 rounded-md bg-slate-800 border-slate-700 text-white"
                  data-testid="aircraft-select"
                >
                  <option value="">Choose an aircraft</option>
                  {aircraft.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.aircraft_type} - {a.registration_number} (Capacity: {a.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quoted_price">Quoted Price (₹) *</Label>
                <Input
                  id="quoted_price"
                  name="quoted_price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="75000"
                  value={quoteData.quoted_price}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-700"
                  data-testid="quoted-price-input"
                />
              </div>

              {feePreview && (
                <div className="bg-slate-800/80 border border-orange-500/30 rounded-lg p-4 space-y-1.5" data-testid="fee-breakdown">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Payout Breakdown (auto platform fee)</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Your Payout (Earning)</span>
                    <span className="text-green-400 font-semibold" data-testid="fee-operator-payout">₹{feePreview.operator_payout.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">+ Platform Fee <span className="text-slate-500 text-xs">({feePreview.rule_label})</span></span>
                    <span className="text-orange-400 font-semibold" data-testid="fee-platform-fee">₹{feePreview.platform_fee.toLocaleString()}</span>
                  </div>
                  {feePreview.urgency_surcharge > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">+ Urgency Surcharge <span className="text-yellow-500 text-xs">({feePreview.urgency_label})</span></span>
                      <span className="text-yellow-400 font-semibold" data-testid="fee-urgency-surcharge">₹{feePreview.urgency_surcharge.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base border-t border-slate-700 pt-1.5">
                    <span className="text-white font-semibold">= Customer Total</span>
                    <span className="text-white font-bold" data-testid="fee-customer-total">₹{feePreview.customer_total.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="validity_hours">Quote Validity (Hours) *</Label>
                <Input
                  id="validity_hours"
                  name="validity_hours"
                  type="number"
                  min="1"
                  max="168"
                  value={quoteData.validity_hours}
                  onChange={handleChange}
                  required
                  className="bg-slate-800 border-slate-700"
                  data-testid="validity-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="special_notes">Special Notes (Optional)</Label>
                <textarea
                  id="special_notes"
                  name="special_notes"
                  value={quoteData.special_notes}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Any special terms or conditions..."
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border-slate-700 text-white"
                  data-testid="special-notes-input"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" data-testid="submit-quote-btn">
                Submit Quote
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InquiryInbox;