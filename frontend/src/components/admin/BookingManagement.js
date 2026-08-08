import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Eye, ArrowRightLeft, MapPin, User, Phone, Mail, Copy, Download, Trash2, FileText, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { adminAPI } from '@/services/api';
import { ContextMenu } from '@/components/shared/ContextMenu';
import { toast } from 'sonner';

function BookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignOperatorId, setReassignOperatorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadBookings();
    loadOperators();
  }, [filter]);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const response = await adminAPI.getAllBookings(status);
      setBookings(response.data.bookings || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOperators = async () => {
    try {
      const response = await adminAPI.getOperators('active');
      setOperators(response.data.operators || []);
    } catch (error) {
      console.error('Failed to load operators:', error);
    }
  };

  const handleReassign = async () => {
    if (!selectedBooking || !reassignOperatorId) return;
    setProcessing(true);
    try {
      await adminAPI.reassignBooking(selectedBooking.id, {
        operator_id: reassignOperatorId,
        reason: reassignReason
      });
      setShowReassignDialog(false);
      setSelectedBooking(null);
      setReassignOperatorId('');
      setReassignReason('');
      loadBookings();
    } catch (error) {
      console.error('Failed to reassign booking:', error);
    } finally {
      setProcessing(false);
    }
  };

  const filteredBookings = bookings.filter(b => 
    b.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.from_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.to_location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      confirmed: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
      in_progress: 'bg-purple-500/20 text-purple-400',
      payment_pending: 'bg-orange-500/20 text-orange-400',
      quote_accepted: 'bg-cyan-500/20 text-cyan-400',
      pending_quotes: 'bg-yellow-500/20 text-yellow-400',
    };
    return badges[status] || badges.pending;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white">Booking Management</h1>
          <p className="text-slate-400 mt-1">View and manage all platform bookings</p>
        </div>
        <Button onClick={loadBookings} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(status => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              onClick={() => setFilter(status)}
              className={`text-sm ${filter === status ? 'bg-orange-500 hover:bg-orange-600' : 'border-slate-600 text-slate-300'}`}
            >
              {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading bookings...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Booking</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Route</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Operator</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredBookings.map((booking) => (
                <tr key={booking.id} className="bg-slate-900/30 hover:bg-slate-900/50">
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">{booking.booking_number || `#${booking.id?.slice(0, 8)}`}</span>
                    <p className="text-xs mt-0.5 flex items-center gap-1" data-testid={`booking-operator-${booking.id}`}>
                      <Building2 className="h-3 w-3 text-orange-400" />
                      <span className={booking.operator_name ? 'text-orange-300' : 'text-slate-500'}>
                        {booking.operator_name || 'Unassigned'}
                      </span>
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-green-400" />
                      <span className="text-slate-300">{booking.from_location}</span>
                      <span className="text-slate-500">→</span>
                      <MapPin className="h-3 w-3 text-red-400" />
                      <span className="text-slate-300">{booking.to_location}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="text-white text-sm">{booking.customer_name || 'N/A'}</p>
                      <p className="text-xs text-slate-400">{booking.customer_email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-slate-300 text-sm">{booking.operator_name || 'Unassigned'}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-slate-300 text-sm">{formatDate(booking.departure_date || booking.created_at)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(booking.status)}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-white font-medium">₹{(booking.total_amount || 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-4">
                    <ContextMenu
                      position="left"
                      actions={[
                        {
                          id: 'view',
                          label: 'View Details',
                          icon: Eye,
                          onClick: () => setSelectedBooking(booking)
                        },
                        {
                          id: 'copy-id',
                          label: 'Copy Booking ID',
                          icon: Copy,
                          onClick: () => {
                            navigator.clipboard.writeText(booking.id || booking.booking_number);
                            toast.success('Booking ID copied!');
                          }
                        },
                        {
                          id: 'download-invoice',
                          label: 'Download Invoice',
                          icon: Download,
                          onClick: () => toast.info('Invoice download coming soon')
                        },
                        { divider: true },
                        ...(booking.status !== 'completed' && booking.status !== 'cancelled' ? [{
                          id: 'reassign',
                          label: 'Reassign Operator',
                          icon: ArrowRightLeft,
                          warning: true,
                          onClick: () => {
                            setSelectedBooking(booking);
                            setShowReassignDialog(true);
                          }
                        }] : []),
                        ...(booking.status === 'pending' ? [{
                          id: 'cancel',
                          label: 'Cancel Booking',
                          icon: Trash2,
                          danger: true,
                          onClick: () => toast.warning('Cancel booking feature coming soon')
                        }] : [])
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBookings.length === 0 && (
            <div className="text-center py-12 text-slate-400">No bookings found</div>
          )}
        </div>
      )}

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedBooking && !showReassignDialog} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-sm text-slate-400">Booking Number</p>
                  <p className="text-white font-semibold">{selectedBooking.booking_number || `#${selectedBooking.id?.slice(0, 8)}`}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-sm text-slate-400">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </span>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-slate-800/50">
                <p className="text-sm text-slate-400 mb-2">Route</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-400" />
                  <span className="text-white">{selectedBooking.from_location}</span>
                  <span className="text-slate-500">→</span>
                  <MapPin className="h-4 w-4 text-red-400" />
                  <span className="text-white">{selectedBooking.to_location}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-sm text-slate-400 mb-2">Customer</p>
                  <div className="space-y-1">
                    <p className="text-white flex items-center gap-2">
                      <User className="h-4 w-4" /> {selectedBooking.customer_name || 'N/A'}
                    </p>
                    <p className="text-slate-300 text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" /> {selectedBooking.customer_email || 'N/A'}
                    </p>
                    <p className="text-slate-300 text-sm flex items-center gap-2">
                      <Phone className="h-4 w-4" /> {selectedBooking.customer_phone || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50">
                  <p className="text-sm text-slate-400 mb-2">Payment</p>
                  <p className="text-2xl font-bold text-green-400">₹{(selectedBooking.total_amount || 0).toLocaleString()}</p>
                  <p className="text-sm text-slate-400">Commission: ₹{(selectedBooking.commission_amount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBooking(null)} className="border-slate-600 text-slate-300">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Reassign Booking</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-400">
              Reassign booking <strong className="text-white">{selectedBooking?.booking_number || selectedBooking?.id?.slice(0, 8)}</strong> to another operator
            </p>
            
            <div>
              <label className="block text-sm text-slate-400 mb-2">Select Operator</label>
              <select
                value={reassignOperatorId}
                onChange={(e) => setReassignOperatorId(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="">Select an operator...</option>
                {operators.map(op => (
                  <option key={op.id} value={op.id}>{op.company_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Reason</label>
              <textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-orange-500 focus:outline-none"
                rows={3}
                placeholder="Reason for reassignment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              disabled={processing || !reassignOperatorId}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {processing ? 'Reassigning...' : 'Reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BookingManagement;
