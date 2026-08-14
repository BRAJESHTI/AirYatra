import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Clock, MapPin, Users, Calendar, Plane, DollarSign, AlertTriangle, RefreshCw, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { inquiryBroadcastAPI } from '@/services/api';
import { toast } from 'sonner';

function InquiryNotifications({ operator }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReviseDialog, setShowReviseDialog] = useState(false);
  const [acceptRemark, setAcceptRemark] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [reviseData, setReviseData] = useState({ amount: '', notes: '' });
  const [processing, setProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadInquiries();
    // Auto refresh every 30 seconds
    const interval = setInterval(loadInquiries, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInquiries = async () => {
    try {
      const response = await inquiryBroadcastAPI.getPendingInquiries();
      setInquiries(response.data.inquiries || []);
    } catch (error) {
      console.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedInquiry) return;
    
    setProcessing(true);
    try {
      await inquiryBroadcastAPI.acceptInquiry(selectedInquiry.id, { remark: acceptRemark });
      toast.success('🎉 Inquiry accepted! Customer will be notified.');
      setShowAcceptDialog(false);
      setAcceptRemark('');
      loadInquiries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to accept inquiry');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedInquiry) return;
    
    setProcessing(true);
    try {
      await inquiryBroadcastAPI.rejectInquiry(selectedInquiry.id, { reason: rejectReason });
      toast.success('Inquiry rejected');
      setShowRejectDialog(false);
      setRejectReason('');
      loadInquiries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject inquiry');
    } finally {
      setProcessing(false);
    }
  };

  const openAcceptDialog = (inquiry) => {
    setSelectedInquiry(inquiry);
    setShowAcceptDialog(true);
  };

  const openRejectDialog = (inquiry) => {
    setSelectedInquiry(inquiry);
    setShowRejectDialog(true);
  };

  const openReviseDialog = (inquiry) => {
    setSelectedInquiry(inquiry);
    setReviseData({ 
      amount: inquiry.booking_details?.estimated_amount || '', 
      notes: '' 
    });
    setShowReviseDialog(true);
  };

  const handleReviseQuote = async () => {
    if (!selectedInquiry) return;
    if (!reviseData.amount || reviseData.amount <= 0) {
      toast.error('Please enter valid amount');
      return;
    }
    
    setProcessing(true);
    try {
      await inquiryBroadcastAPI.reviseQuote(selectedInquiry.id, {
        amount: parseFloat(reviseData.amount),
        notes: reviseData.notes
      });
      toast.success('💰 Revised quote sent to customer!');
      setShowReviseDialog(false);
      setReviseData({ amount: '', notes: '' });
      loadInquiries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send revised quote');
    } finally {
      setProcessing(false);
    }
  };

  const getTimeRemaining = (expireAt) => {
    const expire = new Date(expireAt);
    const now = new Date();
    const diff = expire - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getPurposeColor = (purpose) => {
    const colors = {
      wedding: 'bg-pink-500/20 text-pink-400',
      medical_emergency: 'bg-red-500/20 text-red-400',
      election_tour: 'bg-purple-500/20 text-purple-400',
      company_tour: 'bg-blue-500/20 text-blue-400',
      temple_yatra: 'bg-orange-500/20 text-orange-400',
      pilgrimage: 'bg-yellow-500/20 text-yellow-400',
      film_shooting: 'bg-cyan-500/20 text-cyan-400',
      general_tour: 'bg-green-500/20 text-green-400'
    };
    return colors[purpose] || 'bg-slate-500/20 text-slate-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-orange-400" />
            New Booking Inquiries</h2>
          <p className="text-slate-400 mt-1">
            Accept or reject booking requests within 500km of your location
          </p>
        </div>
        <div className="flex items-center gap-3">
          {inquiries.length > 0 && (
            <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 animate-pulse">
              {inquiries.length} New
            </span>
          )}
          <Button variant="outline" onClick={loadInquiries}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {inquiries.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-xl border border-slate-800">
          <Bell className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No new inquiries</p>
          <p className="text-slate-500 text-sm mt-2">
            New booking requests from customers within 500km will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map(inquiry => {
            const details = inquiry.booking_details || {};
            const isExpanded = expandedId === inquiry.id;
            
            return (
              <div
                key={inquiry.id}
                className="rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden hover:border-orange-500/50 transition-all"
              >
                {/* Header */}
                <div className="p-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPurposeColor(details.purpose)}`}>
                        {details.purpose || 'General'}
                      </span>
                      <span className="text-slate-500 text-sm">
                        #{details.booking_number}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-slate-400">
                        <Clock className="h-3 w-3" />
                        {getTimeRemaining(inquiry.expire_at)} left
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Customer Type</p>
                        <p className="text-white font-medium">{details.customer_type || 'Individual'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Passengers</p>
                        <p className="text-white font-medium">{details.passengers || 1} pax</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Trip Type</p>
                        <p className="text-white font-medium">{details.trip_type || 'One Way'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Distance from you</p>
                        <p className="text-orange-400 font-medium">{inquiry.distance_km || '?'} km</p>
                      </div>
                    </div>
                    
                    {/* Route */}
                    <div className="mt-3 p-3 rounded-lg bg-slate-800/50">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-white">{details.pickup_location || 'N/A'}</span>
                        {details.pickup_district && (
                          <span className="text-slate-400 text-sm">({details.pickup_district}, {details.pickup_state})</span>
                        )}
                      </div>
                      <div className="ml-1.5 my-1 w-0.5 h-4 bg-slate-600"></div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-white">{details.drop_location || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Date & Estimated Amount */}
                    <div className="mt-3 flex items-center gap-6 text-sm">
                      <span className="flex items-center gap-2 text-slate-300">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {details.booking_date} at {details.booking_time}
                      </span>
                      <span className="flex items-center gap-2 text-green-400 font-bold">
                        <DollarSign className="h-4 w-4" />
                        ₹{(details.estimated_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      onClick={() => openAcceptDialog(inquiry)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" /> Accept
                    </Button>
                    <Button
                      onClick={() => openReviseDialog(inquiry)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <DollarSign className="h-4 w-4 mr-1" /> Revise Quote
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => openRejectDialog(inquiry)}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
                
                {/* Expandable Details */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : inquiry.id)}
                  className="w-full px-4 py-2 bg-slate-800/50 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" /> Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" /> View Full Details
                    </>
                  )}
                </button>
                
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Generated By</p>
                        <p className="text-white">{details.generated_by || 'Customer'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Purpose</p>
                        <p className="text-white">{details.purpose || 'General Tour'}</p>
                      </div>
                    </div>
                    {details.special_instructions && (
                      <div>
                        <p className="text-slate-500 text-sm">Special Instructions</p>
                        <p className="text-yellow-400 text-sm p-2 rounded bg-yellow-500/10">
                          {details.special_instructions}
                        </p>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="text-red-400 text-xs flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Customer contact details will be revealed only after accepting the booking
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Accept Dialog */}
      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Check className="h-5 w-5 text-green-400" />
              Accept Inquiry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-green-400 text-sm">
                By accepting, you agree to provide helicopter service for this booking request.
                Customer contact details will be shared after acceptance.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Remark (Optional)</Label>
              <Input
                value={acceptRemark}
                onChange={(e) => setAcceptRemark(e.target.value)}
                placeholder="Any additional notes..."
                className="bg-slate-800 border-slate-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAcceptDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAccept}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Confirm Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <X className="h-5 w-5 text-red-400" />
              Reject Inquiry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Reason (Optional)</Label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              >
                <option value="">Select reason...</option>
                <option value="no_aircraft_available">No aircraft available</option>
                <option value="date_conflict">Date conflict</option>
                <option value="route_not_serviceable">Route not serviceable</option>
                <option value="price_mismatch">Price expectations too low</option>
                <option value="too_far">Location too far</option>
                <option value="other">Other reason</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              onClick={handleReject}
              disabled={processing}
              variant="destructive"
            >
              {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revise Quote Dialog */}
      <Dialog open={showReviseDialog} onOpenChange={setShowReviseDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-400" />
              Send Revised Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-slate-400 text-sm">Customer's Expected Amount:</p>
              <p className="text-white text-xl font-bold">
                ₹{(selectedInquiry?.booking_details?.estimated_amount || 0).toLocaleString()}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Your Quote Amount (₹)*</Label>
              <Input
                type="number"
                value={reviseData.amount}
                onChange={(e) => setReviseData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter your quote amount"
                className="bg-slate-800 border-slate-700 text-white text-lg"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Notes for Customer (Optional)</Label>
              <textarea
                value={reviseData.notes}
                onChange={(e) => setReviseData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Explain your pricing, included services, etc..."
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white h-24"
              />
            </div>

            {reviseData.amount && (
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <p className="text-orange-400 text-sm">Your Revised Quote:</p>
                <p className="text-orange-400 text-2xl font-bold">
                  ₹{parseFloat(reviseData.amount || 0).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReviseDialog(false)}>Cancel</Button>
            <Button
              onClick={handleReviseQuote}
              disabled={processing || !reviseData.amount}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {processing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
              Send Revised Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InquiryNotifications;
