import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Eye, MapPin, Calendar, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { adminLandingPermissionAPI } from '@/services/api';

function LandingPermissionApproval() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [action, setAction] = useState(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await adminLandingPermissionAPI.getPending();
      setPermissions(response.data.pending_permissions || []);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedPermission || !action) return;
    setProcessing(true);
    try {
      if (action === 'approve') {
        await adminLandingPermissionAPI.approve(selectedPermission.id, { notes });
      } else {
        await adminLandingPermissionAPI.reject(selectedPermission.id, { reason: notes });
      }
      setShowActionDialog(false);
      setSelectedPermission(null);
      setNotes('');
      loadPermissions();
    } catch (error) {
      console.error('Failed to process permission:', error);
    } finally {
      setProcessing(false);
    }
  };

  const openActionDialog = (permission, actionType) => {
    setSelectedPermission(permission);
    setAction(actionType);
    setShowActionDialog(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Shield className="h-8 w-8 text-orange-400" />
          Landing Permission Approvals
        </h1>
        <p className="text-slate-400 mt-1">Review and approve landing permission requests</p>
      </div>

      {/* Stats */}
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Pending Approvals</span>
          <span className="text-2xl font-bold text-yellow-400">{permissions.length}</span>
        </div>
      </div>

      {/* Permissions List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading permissions...</div>
      ) : permissions.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No pending landing permission requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {permissions.map((permission) => (
            <div key={permission.id} className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  {/* Booking Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
                      {permission.booking_details?.booking_number || 'Booking'}
                    </span>
                    <span className="text-slate-400 text-sm">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      {formatDate(permission.booking_details?.departure_date)}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-green-400" />
                    <span className="text-white">{permission.booking_details?.from_location}</span>
                    <span className="text-slate-500">→</span>
                    <MapPin className="h-4 w-4 text-red-400" />
                    <span className="text-white">{permission.booking_details?.to_location}</span>
                  </div>

                  {/* Landing Location */}
                  <div className="p-3 rounded-lg bg-slate-800/50 mb-3">
                    <p className="text-sm text-slate-400">Landing Location</p>
                    <p className="text-white">{permission.landing_location || 'Not specified'}</p>
                    {permission.latitude && permission.longitude && (
                      <p className="text-xs text-slate-400 mt-1">
                        Coordinates: {permission.latitude}, {permission.longitude}
                      </p>
                    )}
                  </div>

                  {/* Customer */}
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <User className="h-4 w-4" />
                    <span>{permission.customer_name || 'Customer'}</span>
                    {permission.customer_phone && (
                      <span>• {permission.customer_phone}</span>
                    )}
                  </div>

                  {/* Documents */}
                  {permission.documents && permission.documents.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-slate-400 mb-2">Uploaded Documents</p>
                      <div className="flex gap-2 flex-wrap">
                        {permission.documents.map((doc, idx) => (
                          <span key={idx} className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {doc.document_type || `Document ${idx + 1}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 lg:flex-col">
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => openActionDialog(permission, 'approve')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => openActionDialog(permission, 'reject')}
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-600 text-slate-300"
                    onClick={() => setSelectedPermission(permission)}
                  >
                    <Eye className="h-4 w-4 mr-2" /> Details
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve' : 'Reject'} Landing Permission
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-400 mb-4">
              {action === 'approve' 
                ? 'Approve this landing permission request?'
                : 'Please provide a reason for rejection:'
              }
            </p>
            <label className="block text-sm text-slate-400 mb-2">
              {action === 'approve' ? 'Notes (Optional)' : 'Reason (Required)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-orange-500 focus:outline-none"
              rows={3}
              placeholder={action === 'approve' ? 'Add approval notes...' : 'Reason for rejection...'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing || (action === 'reject' && !notes.trim())}
              className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LandingPermissionApproval;
