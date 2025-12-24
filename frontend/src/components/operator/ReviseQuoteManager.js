import React, { useState, useEffect } from 'react';
import { DollarSign, Send, Check, X, Clock, RefreshCw, Eye, MessageSquare, Calculator, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { operatorAPI, bookingAPI } from '@/services/api';
import { toast } from 'sonner';

function ReviseQuoteManager({ operator }) {
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    amount: '',
    validity_hours: 24,
    notes: '',
    breakdown: {
      base_price: 0,
      fuel_surcharge: 0,
      landing_fees: 0,
      pilot_charges: 0,
      other_charges: 0
    }
  });

  useEffect(() => {
    loadQuoteRequests();
  }, []);

  const loadQuoteRequests = async () => {
    setLoading(true);
    try {
      const response = await operatorAPI.getQuoteRequests();
      setQuoteRequests(response.data.requests || []);
    } catch (error) {
      // Mock data if API not available
      setQuoteRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQuoteDialog = (request) => {
    setSelectedRequest(request);
    // Pre-fill with estimated price if available
    setQuoteForm({
      amount: request.estimated_price || '',
      validity_hours: 24,
      notes: '',
      breakdown: {
        base_price: request.estimated_price * 0.7 || 0,
        fuel_surcharge: request.estimated_price * 0.15 || 0,
        landing_fees: request.estimated_price * 0.05 || 0,
        pilot_charges: request.estimated_price * 0.08 || 0,
        other_charges: request.estimated_price * 0.02 || 0
      }
    });
    setShowQuoteDialog(true);
  };

  const calculateTotalFromBreakdown = () => {
    const { base_price, fuel_surcharge, landing_fees, pilot_charges, other_charges } = quoteForm.breakdown;
    return (parseFloat(base_price) || 0) + 
           (parseFloat(fuel_surcharge) || 0) + 
           (parseFloat(landing_fees) || 0) + 
           (parseFloat(pilot_charges) || 0) + 
           (parseFloat(other_charges) || 0);
  };

  const handleSubmitQuote = async () => {
    if (!quoteForm.amount || parseFloat(quoteForm.amount) <= 0) {
      toast.error('Please enter a valid quote amount');
      return;
    }

    setSubmitting(true);
    try {
      await operatorAPI.submitRevisedQuote({
        booking_id: selectedRequest.id,
        amount: parseFloat(quoteForm.amount),
        validity_hours: quoteForm.validity_hours,
        notes: quoteForm.notes,
        breakdown: quoteForm.breakdown
      });
      
      toast.success('Quote submitted successfully! / कोट सफलतापूर्वक भेजा गया');
      setShowQuoteDialog(false);
      loadQuoteRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit quote');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'quote_requested': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'quote_sent': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'accepted': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'quote_requested': return 'Quote Requested / कोट मांगा';
      case 'quote_sent': return 'Quote Sent / कोट भेजा';
      case 'accepted': return 'Accepted / स्वीकार';
      case 'rejected': return 'Rejected / अस्वीकार';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
        Loading quote requests...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-orange-400" />
            Quote Requests / कोट अनुरोध
          </h2>
          <p className="text-slate-400 mt-1">Respond to customer quote requests with revised prices</p>
        </div>
        <Button variant="outline" onClick={loadQuoteRequests}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-2xl font-bold text-yellow-400">
            {quoteRequests.filter(r => r.status === 'quote_requested').length}
          </p>
          <p className="text-slate-400 text-sm">Pending Requests</p>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="text-2xl font-bold text-blue-400">
            {quoteRequests.filter(r => r.status === 'quote_sent').length}
          </p>
          <p className="text-slate-400 text-sm">Quotes Sent</p>
        </div>
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <p className="text-2xl font-bold text-green-400">
            {quoteRequests.filter(r => r.status === 'accepted').length}
          </p>
          <p className="text-slate-400 text-sm">Accepted</p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-2xl font-bold text-red-400">
            {quoteRequests.filter(r => r.status === 'rejected').length}
          </p>
          <p className="text-slate-400 text-sm">Rejected</p>
        </div>
      </div>

      {/* Quote Requests List */}
      {quoteRequests.length === 0 ? (
        <div className="text-center py-16">
          <DollarSign className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No quote requests yet</p>
          <p className="text-slate-500">कोई कोट अनुरोध नहीं है</p>
        </div>
      ) : (
        <div className="space-y-4">
          {quoteRequests.map(request => (
            <div
              key={request.id}
              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                    <span className="text-slate-500 text-sm">#{request.booking_number}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-slate-500 text-xs">Flight Type</p>
                      <p className="text-white font-medium">{request.flight_type_details?.name || request.flight_type}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Route</p>
                      <p className="text-white">{request.from_location} → {request.to_location}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Date & Time</p>
                      <p className="text-white">{request.departure_date} at {request.pickup_time}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Passengers</p>
                      <p className="text-white">{request.passengers} pax</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-400">
                      Customer Estimate: <span className="text-orange-400 font-medium">₹{(request.estimated_price || 0).toLocaleString()}</span>
                    </span>
                    {request.your_quote && (
                      <span className="text-slate-400">
                        Your Quote: <span className="text-green-400 font-medium">₹{request.your_quote.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {request.status === 'quote_requested' && (
                    <Button
                      onClick={() => handleOpenQuoteDialog(request)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Quote
                    </Button>
                  )}
                  {request.status === 'quote_sent' && (
                    <Button
                      variant="outline"
                      onClick={() => handleOpenQuoteDialog(request)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Revise Quote
                    </Button>
                  )}
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quote Dialog */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Calculator className="h-5 w-5 text-orange-400" />
              Send Revised Quote / संशोधित कोट भेजें
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {/* Booking Summary */}
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-slate-400 text-sm">Booking: #{selectedRequest.booking_number}</p>
                <p className="text-white">{selectedRequest.from_location} → {selectedRequest.to_location}</p>
                <p className="text-slate-400 text-sm">{selectedRequest.departure_date} | {selectedRequest.passengers} passengers</p>
              </div>
              
              {/* Price Breakdown */}
              <div className="space-y-3">
                <Label className="text-orange-400">Price Breakdown / मूल्य विवरण</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Base Price</Label>
                    <Input
                      type="number"
                      value={quoteForm.breakdown.base_price}
                      onChange={(e) => setQuoteForm({
                        ...quoteForm,
                        breakdown: { ...quoteForm.breakdown, base_price: e.target.value }
                      })}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Fuel Surcharge</Label>
                    <Input
                      type="number"
                      value={quoteForm.breakdown.fuel_surcharge}
                      onChange={(e) => setQuoteForm({
                        ...quoteForm,
                        breakdown: { ...quoteForm.breakdown, fuel_surcharge: e.target.value }
                      })}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Landing Fees</Label>
                    <Input
                      type="number"
                      value={quoteForm.breakdown.landing_fees}
                      onChange={(e) => setQuoteForm({
                        ...quoteForm,
                        breakdown: { ...quoteForm.breakdown, landing_fees: e.target.value }
                      })}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">Pilot Charges</Label>
                    <Input
                      type="number"
                      value={quoteForm.breakdown.pilot_charges}
                      onChange={(e) => setQuoteForm({
                        ...quoteForm,
                        breakdown: { ...quoteForm.breakdown, pilot_charges: e.target.value }
                      })}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                  <span className="text-slate-400">Calculated Total:</span>
                  <span className="text-white font-medium">₹{calculateTotalFromBreakdown().toLocaleString()}</span>
                </div>
              </div>
              
              {/* Final Quote Amount */}
              <div className="space-y-2">
                <Label className="text-orange-400">Final Quote Amount / अंतिम कोट राशि *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">₹</span>
                  <Input
                    type="number"
                    value={quoteForm.amount}
                    onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })}
                    placeholder="Enter your quote amount"
                    className="bg-slate-800 border-slate-700 pl-8 text-xl font-bold"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuoteForm({ ...quoteForm, amount: calculateTotalFromBreakdown() })}
                  className="text-blue-400"
                >
                  Use calculated total
                </Button>
              </div>
              
              {/* Validity */}
              <div className="space-y-2">
                <Label className="text-slate-300">Quote Validity / कोट वैधता</Label>
                <select
                  value={quoteForm.validity_hours}
                  onChange={(e) => setQuoteForm({ ...quoteForm, validity_hours: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                >
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours</option>
                  <option value={48}>48 Hours</option>
                  <option value={72}>72 Hours</option>
                </select>
              </div>
              
              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-slate-300">Notes for Customer / ग्राहक के लिए नोट</Label>
                <textarea
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  placeholder="Any special conditions, inclusions, or terms..."
                  rows="3"
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
                />
              </div>
              
              {/* Comparison */}
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Customer's Estimate:</span>
                  <span className="text-slate-300">₹{(selectedRequest.estimated_price || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-orange-400 font-medium">Your Quote:</span>
                  <span className="text-orange-400 font-bold text-lg">₹{(parseFloat(quoteForm.amount) || 0).toLocaleString()}</span>
                </div>
                {quoteForm.amount && selectedRequest.estimated_price && (
                  <p className="text-xs mt-2 text-slate-500">
                    {parseFloat(quoteForm.amount) < selectedRequest.estimated_price 
                      ? `${((1 - parseFloat(quoteForm.amount) / selectedRequest.estimated_price) * 100).toFixed(1)}% lower than estimate`
                      : `${((parseFloat(quoteForm.amount) / selectedRequest.estimated_price - 1) * 100).toFixed(1)}% higher than estimate`
                    }
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowQuoteDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitQuote}
              disabled={submitting || !quoteForm.amount}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Quote / कोट भेजें
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReviseQuoteManager;
