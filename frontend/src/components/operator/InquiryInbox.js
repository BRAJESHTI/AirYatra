import React, { useState, useEffect } from 'react';
import { MessageSquare, MapPin, Calendar, Users, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { quoteAPI, fleetAPI } from '../../services/api';
import { toast } from 'sonner';

function InquiryInbox({ operator }) {
  const [inquiries, setInquiries] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteData, setQuoteData] = useState({
    aircraft_id: '',
    quoted_price: '',
    validity_hours: '24',
    special_notes: '',
  });

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
                          <span>{booking.from_location} → {booking.to_location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(booking.departure_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{booking.passengers} passengers</span>
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