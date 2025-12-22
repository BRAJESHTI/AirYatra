import React, { useState, useEffect } from 'react';
import { Shield, MapPin, FileText, Calendar, User, Phone, Download, Eye, Building2, FireExtinguisher, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { landingPermissionAPI, bookingAPI } from '../../services/api';
import { toast } from 'sonner';

function LandingPermissionViewer({ operator }) {
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      // Get operator's confirmed/in-progress bookings
      const response = await bookingAPI.getAll('confirmed');
      setBookings(response.data.bookings || []);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async (bookingId) => {
    try {
      const response = await landingPermissionAPI.getBookingPermissions(bookingId);
      setPermissions(response.data.permissions || []);
    } catch (error) {
      toast.error('Failed to load permissions');
    }
  };

  const handleBookingSelect = (booking) => {
    setSelectedBooking(booking);
    fetchPermissions(booking.id);
  };

  const handleViewDetail = (permission) => {
    setSelectedPermission(permission);
    setShowDetailDialog(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
    };
    return badges[status] || badges.pending;
  };

  const documentTypes = [
    { key: 'collector_permission', label: 'Collector Permission', icon: Building2 },
    { key: 'fire_dept_acknowledgment', label: 'Fire Dept. Acknowledgment', icon: FireExtinguisher },
    { key: 'police_station_info', label: 'Police Station NOC', icon: Shield },
    { key: 'location_coords', label: 'Landing Coordinates', icon: MapPinned },
  ];

  return (
    <div className="max-w-6xl mx-auto" data-testid="landing-permissions">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Landing Permissions</h1>
        <p className="text-slate-400">View landing permission documents uploaded by customers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bookings List */}
        <div className="lg:col-span-1">
          <div className="glass p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">Select Booking</h3>
            {loading ? (
              <p className="text-slate-400">Loading...</p>
            ) : bookings.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No active bookings</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => handleBookingSelect(booking)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedBooking?.id === booking.id
                        ? 'bg-orange-500/20 border border-orange-500/30'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                  >
                    <p className="text-white font-medium">{booking.booking_number}</p>
                    <p className="text-sm text-slate-400 flex items-center mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      {booking.from_location} → {booking.to_location}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(booking.departure_date)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Permissions Display */}
        <div className="lg:col-span-2">
          {selectedBooking ? (
            <div className="glass p-6 rounded-lg">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Booking: {selectedBooking.booking_number}</h3>
                  <p className="text-slate-400">{selectedBooking.from_location} → {selectedBooking.to_location}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadge(selectedBooking.status)}`}>
                  {selectedBooking.status}
                </span>
              </div>

              {permissions.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No landing permissions uploaded yet</p>
                  <p className="text-sm text-slate-500">Customer needs to upload permission documents</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {permissions.map((permission) => (
                    <div key={permission.id} className="bg-slate-800 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-white font-medium">Landing Location</h4>
                          <p className="text-slate-300">{permission.landing_location || 'Not specified'}</p>
                          {permission.latitude && permission.longitude && (
                            <p className="text-xs text-slate-400 mt-1">
                              Coordinates: {permission.latitude}, {permission.longitude}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(permission.approval_status)}`}>
                            {permission.approval_status || 'pending'}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetail(permission)}
                            className="border-orange-500/30 text-orange-400"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Document Summary */}
                      {permission.documents && permission.documents.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <p className="text-sm text-slate-400 mb-2">Uploaded Documents:</p>
                          <div className="flex flex-wrap gap-2">
                            {permission.documents.map((doc, idx) => (
                              <span key={idx} className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs flex items-center">
                                <FileText className="h-3 w-3 mr-1" />
                                {doc.document_type?.replace(/_/g, ' ') || `Doc ${idx + 1}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="glass p-6 rounded-lg text-center py-16">
              <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Select a booking to view landing permissions</p>
            </div>
          )}
        </div>
      </div>

      {/* Permission Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Landing Permission Details</DialogTitle>
          </DialogHeader>
          
          {selectedPermission && (
            <div className="space-y-6">
              {/* Location Info */}
              <div className="p-4 rounded-lg bg-slate-800">
                <h4 className="text-orange-400 font-medium mb-2">Landing Location</h4>
                <p className="text-white">{selectedPermission.landing_location || 'Not specified'}</p>
                {selectedPermission.latitude && selectedPermission.longitude && (
                  <div className="mt-2 p-2 bg-slate-700 rounded">
                    <p className="text-sm text-slate-300">
                      <MapPinned className="h-4 w-4 inline mr-1" />
                      Lat: {selectedPermission.latitude}, Long: {selectedPermission.longitude}
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Info */}
              {selectedPermission.customer_name && (
                <div className="p-4 rounded-lg bg-slate-800">
                  <h4 className="text-orange-400 font-medium mb-2">Customer Information</h4>
                  <p className="text-white flex items-center"><User className="h-4 w-4 mr-2" />{selectedPermission.customer_name}</p>
                  {selectedPermission.customer_phone && (
                    <p className="text-slate-300 flex items-center mt-1"><Phone className="h-4 w-4 mr-2" />{selectedPermission.customer_phone}</p>
                  )}
                </div>
              )}

              {/* Documents */}
              <div className="p-4 rounded-lg bg-slate-800">
                <h4 className="text-orange-400 font-medium mb-3">Permission Documents</h4>
                {selectedPermission.documents && selectedPermission.documents.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPermission.documents.map((doc, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-700 rounded">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-orange-400 mr-3" />
                          <div>
                            <p className="text-white">{doc.document_type?.replace(/_/g, ' ') || `Document ${idx + 1}`}</p>
                            <p className="text-xs text-slate-400">{doc.file_name || 'File'}</p>
                          </div>
                        </div>
                        {doc.download_url && (
                          <a
                            href={doc.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center px-3 py-1 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30"
                          >
                            <Download className="h-4 w-4 mr-1" /> View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">No documents uploaded</p>
                )}
              </div>

              {/* Approval Info */}
              <div className="p-4 rounded-lg bg-slate-800">
                <h4 className="text-orange-400 font-medium mb-2">Approval Status</h4>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full ${getStatusBadge(selectedPermission.approval_status)}`}>
                    {selectedPermission.approval_status || 'pending'}
                  </span>
                  {selectedPermission.approved_by_name && (
                    <span className="text-slate-400 text-sm">by {selectedPermission.approved_by_name}</span>
                  )}
                </div>
                {selectedPermission.approval_notes && (
                  <p className="mt-2 text-slate-300 text-sm">{selectedPermission.approval_notes}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LandingPermissionViewer;
