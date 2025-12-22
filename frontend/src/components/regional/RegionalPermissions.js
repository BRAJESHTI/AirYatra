import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { regionalManagerAPI } from '@/services/api';
import { toast } from 'sonner';

function RegionalPermissions({ region }) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const response = await regionalManagerAPI.getLandingPermissions('pending');
      setPermissions(response.data.permissions || []);
    } catch (error) {
      console.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPermission) return;
    setProcessing(true);
    try {
      await regionalManagerAPI.approveLandingPermission(selectedPermission.id, approvalNotes);
      toast.success('Permission approved');
      setShowApproveDialog(false);
      setSelectedPermission(null);
      setApprovalNotes('');
      loadPermissions();
    } catch (error) {
      toast.error('Failed to approve permission');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Shield className="h-8 w-8 text-purple-400" />
          Landing Permission Approvals
        </h1>
        <p className="text-slate-400 mt-1">Review permissions in {region || 'your region'}</p>
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
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : permissions.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No pending permissions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {permissions.map((permission) => (
            <div key={permission.id} className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white font-semibold">Landing Location: {permission.landing_location || 'Not specified'}</p>
                  {permission.latitude && permission.longitude && (
                    <p className="text-sm text-slate-400 mt-1">
                      <MapPin className="h-4 w-4 inline mr-1" />
                      {permission.latitude}, {permission.longitude}
                    </p>
                  )}
                  {permission.booking_id && (
                    <p className="text-sm text-slate-500 mt-1">Booking: {permission.booking_id.slice(0, 8)}...</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setSelectedPermission(permission);
                      setShowApproveDialog(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Approve Landing Permission</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm text-slate-400 mb-2">Approval Notes (Optional)</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
              rows={3}
              placeholder="Add approval notes..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing ? 'Processing...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RegionalPermissions;
