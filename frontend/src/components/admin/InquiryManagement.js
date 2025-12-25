import React, { useState, useEffect } from 'react';
import { Bell, Search, Filter, RefreshCw, MapPin, Calendar, Users, Plane, Clock, Check, X, DollarSign, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { adminAPI, inquiryBroadcastAPI } from '@/services/api';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending_acceptance: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
  quote_received: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Quote Received' },
  quote_accepted: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Accepted' },
  passenger_details_filled: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Details Filled' },
  payment_pending: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Payment Pending' },
  confirmed: { bg: 'bg-green-600/20', text: 'text-green-500', label: 'Confirmed' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
  expired: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Expired' },
};

function InquiryManagement() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadInquiries();
  }, [filterStatus]);

  const loadInquiries = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getInquiries({ status: filterStatus === 'all' ? undefined : filterStatus });
      setInquiries(response.data.inquiries || []);
    } catch (error) {
      console.error('Failed to load inquiries');
      // Fallback to broadcasts if inquiries endpoint doesn't exist
      try {
        const broadcastResponse = await inquiryBroadcastAPI.getAllBroadcasts(filterStatus === 'all' ? undefined : filterStatus);
        setInquiries(broadcastResponse.data.broadcasts || []);
      } catch (e) {
        setInquiries([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (inquiry) => {
    setSelectedInquiry(inquiry);
    setShowDetailsDialog(true);
  };

  const getStatusBadge = (status) => {
    const config = STATUS_COLORS[status] || STATUS_COLORS.pending_acceptance;
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const filteredInquiries = inquiries.filter(inquiry => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inquiry.inquiry_number?.toLowerCase().includes(term) ||
      inquiry.customer_name?.toLowerCase().includes(term) ||
      inquiry.pickup_location?.toLowerCase().includes(term) ||
      inquiry.drop_location?.toLowerCase().includes(term)
    );
  });

  const stats = {
    total: inquiries.length,
    pending: inquiries.filter(i => i.status === 'pending_acceptance').length,
    quote_received: inquiries.filter(i => i.status === 'quote_received').length,
    accepted: inquiries.filter(i => ['quote_accepted', 'confirmed'].includes(i.status)).length,
  };

  return (
    <div className="space-y-6" data-testid="inquiry-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-orange-400" />
            Inquiry Management / इंक्वायरी प्रबंधन
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            View and manage all customer booking inquiries
          </p>
        </div>
        <Button onClick={loadInquiries} className="bg-slate-700 hover:bg-slate-600">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Total Inquiries</p>
          <p className="text-white text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
          <p className="text-yellow-400 text-sm">Pending</p>
          <p className="text-yellow-400 text-2xl font-bold">{stats.pending}</p>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
          <p className="text-blue-400 text-sm">Quote Received</p>
          <p className="text-blue-400 text-2xl font-bold">{stats.quote_received}</p>
        </div>
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
          <p className="text-green-400 text-sm">Accepted</p>
          <p className="text-green-400 text-2xl font-bold">{stats.accepted}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by number, customer, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
        >
          <option value="all">All Status</option>
          <option value="pending_acceptance">Pending</option>
          <option value="quote_received">Quote Received</option>
          <option value="quote_accepted">Accepted</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Inquiries List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-slate-700">
          <Bell className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No inquiries found</p>
          <p className="text-slate-500 text-sm mt-1">New inquiries will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors"
            >
              {/* Main Row */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Inquiry Number */}
                  <div className="min-w-[120px]">
                    <p className="text-orange-400 font-mono font-bold">
                      {inquiry.inquiry_number || inquiry.id?.slice(0, 8)}
                    </p>
                    <p className="text-slate-500 text-xs">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Customer Info */}
                  <div className="min-w-[150px]">
                    <p className="text-white font-medium">{inquiry.customer_name || 'Unknown'}</p>
                    <p className="text-slate-400 text-sm">{inquiry.customer_email}</p>
                  </div>

                  {/* Route */}
                  <div className="flex-1 hidden md:block">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-green-400" />
                      <span className="text-slate-300">{inquiry.pickup_location || 'N/A'}</span>
                      <span className="text-slate-500">→</span>
                      <MapPin className="h-4 w-4 text-red-400" />
                      <span className="text-slate-300">{inquiry.drop_location || 'N/A'}</span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1">
                      {inquiry.distance_km ? `${inquiry.distance_km} km` : ''} • 
                      {inquiry.aircraft_type === 'helicopter' ? ' 🚁 Helicopter' : ' ✈️ Plane'}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right min-w-[100px]">
                    <p className="text-white font-bold">
                      ₹{(inquiry.estimated_price || 0).toLocaleString()}
                    </p>
                    <p className="text-slate-500 text-xs">Est. Amount</p>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3 ml-4">
                  {getStatusBadge(inquiry.status)}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedId(expandedId === inquiry.id ? null : inquiry.id)}
                    className="border-slate-600"
                  >
                    {expandedId === inquiry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openDetails(inquiry)}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === inquiry.id && (
                <div className="px-4 pb-4 border-t border-slate-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-slate-500">Flight Type</p>
                      <p className="text-white">{inquiry.udan_prakar || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Booking For</p>
                      <p className="text-white">{inquiry.booking_for || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Purpose</p>
                      <p className="text-white">{inquiry.booking_purpose || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Passengers</p>
                      <p className="text-white">{inquiry.total_passengers || 0} Adults + {inquiry.children_count || 0} Children</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Date & Time</p>
                      <p className="text-white">{inquiry.departure_date} {inquiry.pickup_time}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Operator Responses</p>
                      <p className="text-white">{inquiry.operator_responses?.length || 0} responses</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-400" />
              Inquiry Details / इंक्वायरी विवरण
            </DialogTitle>
          </DialogHeader>
          
          {selectedInquiry && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                {getStatusBadge(selectedInquiry.status)}
              </div>

              {/* Customer Info */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-white font-semibold mb-2">Customer Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="text-white">{selectedInquiry.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="text-white">{selectedInquiry.customer_email}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Phone</p>
                    <p className="text-white">{selectedInquiry.customer_phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-white font-semibold mb-2">Booking Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Aircraft Type</p>
                    <p className="text-white">{selectedInquiry.aircraft_type === 'helicopter' ? '🚁 Helicopter' : '✈️ Plane'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Passengers</p>
                    <p className="text-white">{selectedInquiry.total_passengers} Adults, {selectedInquiry.children_count || 0} Children</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Flight Type</p>
                    <p className="text-white">{selectedInquiry.udan_prakar}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Purpose</p>
                    <p className="text-white">{selectedInquiry.booking_purpose}</p>
                  </div>
                </div>
              </div>

              {/* Route */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-white font-semibold mb-2">Route Details</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-green-400 flex items-center gap-1"><MapPin className="h-4 w-4" /> Pickup</p>
                    <p className="text-white">{selectedInquiry.pickup_location}</p>
                    <p className="text-slate-500 text-xs">{selectedInquiry.pickup_district}, {selectedInquiry.pickup_state}</p>
                  </div>
                  <div className="text-slate-500">→</div>
                  <div className="flex-1">
                    <p className="text-red-400 flex items-center gap-1"><MapPin className="h-4 w-4" /> Drop</p>
                    <p className="text-white">{selectedInquiry.drop_location}</p>
                    <p className="text-slate-500 text-xs">{selectedInquiry.drop_district}, {selectedInquiry.drop_state}</p>
                  </div>
                </div>
                <p className="text-orange-400 mt-2">Distance: {selectedInquiry.distance_km} KM</p>
              </div>

              {/* Pricing */}
              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
                <h4 className="text-orange-400 font-semibold mb-2">Estimated Price</h4>
                <p className="text-orange-400 text-3xl font-bold">
                  ₹{(selectedInquiry.estimated_price || 0).toLocaleString()}
                </p>
              </div>

              {/* Operator Responses */}
              {selectedInquiry.operator_responses?.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <h4 className="text-white font-semibold mb-2">Operator Responses ({selectedInquiry.operator_responses.length})</h4>
                  <div className="space-y-2">
                    {selectedInquiry.operator_responses.map((response, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                        <span className="text-white">{response.operator_name}</span>
                        <span className="text-orange-400">₹{response.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)} className="border-slate-600">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InquiryManagement;
