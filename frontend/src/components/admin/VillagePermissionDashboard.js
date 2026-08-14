import React, { useState, useEffect } from 'react';
import { 
  FileText, Check, X, Eye, Download, AlertTriangle, Clock, 
  MapPin, User, Phone, Loader2, ChevronDown, ChevronUp,
  FileCheck, FileX, Upload, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { landingAPI, adminAPI } from '@/services/api';
import { toast } from 'sonner';

const statusColors = {
  documents_pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  under_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  expired: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const statusLabels = {
  documents_pending: 'Documents Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

const docTypeLabels = {
  collector_noc: 'Collector NOCNOC',
  fire_dept: 'Fire Dept. Acknowledgment',
  police_station: 'Police Station Acknowledgment',
  sp_dcp: 'SP/DCP Acknowledgment / SP/DCP',
  sp_noc: 'Superintendent of Police NOC',
  fire_noc: 'Fire Department NOC',
  gram_panchayat: 'Gram Panchayat Consent',
  land_ownership: 'Land Ownership Proof',
  site_photos: 'Site Photos & GPS',
  other: 'Other Document'
};

function VillagePermissionDashboard() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);

  const [stats, setStats] = useState({
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0
  });

  useEffect(() => {
    loadPermissions();
  }, [filterStatus]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      // Get all village permissions (admin can see all)
      const response = await landingAPI.getMyVillagePermissions();
      let allPermissions = response.data.permissions || [];
      
      // Calculate stats
      setStats({
        pending: allPermissions.filter(p => p.status === 'documents_pending').length,
        under_review: allPermissions.filter(p => p.status === 'under_review').length,
        approved: allPermissions.filter(p => p.status === 'approved').length,
        rejected: allPermissions.filter(p => p.status === 'rejected').length
      });
      
      // Filter
      if (filterStatus !== 'all') {
        allPermissions = allPermissions.filter(p => p.status === filterStatus);
      }
      
      setPermissions(allPermissions);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDocument = async (permissionId, documentId) => {
    try {
      await landingAPI.verifyDocument(permissionId, {
        document_id: documentId,
        action: 'approve'
      });
      toast.success('Document approved');
      loadPermissions();
      if (selectedPermission?.id === permissionId) {
        loadPermissionDetails(permissionId);
      }
    } catch (error) {
      toast.error('Failed to approve document');
    }
  };

  const handleRejectDocument = async () => {
    if (!rejectReason) {
      toast.error('Please provide rejection reason');
      return;
    }
    
    try {
      await landingAPI.verifyDocument(selectedPermission.id, {
        document_id: selectedDocId,
        action: 'reject',
        reason: rejectReason
      });
      toast.success('Document rejected');
      setShowRejectModal(false);
      setRejectReason('');
      loadPermissions();
    } catch (error) {
      toast.error('Failed to reject document');
    }
  };

  const handleApprovePermission = async (permissionId) => {
    try {
      await landingAPI.approvePermission(permissionId, {
        notes: 'All documents verified and approved'
      });
      toast.success('Permission approved successfully');
      loadPermissions();
      setShowDetailModal(false);
    } catch (error) {
      toast.error('Failed to approve permission');
    }
  };

  const handleRejectPermission = async (permissionId) => {
    const reason = prompt('Please provide rejection reason:');
    if (!reason) return;
    
    try {
      await landingAPI.rejectPermission(permissionId, { reason });
      toast.success('Permission rejected');
      loadPermissions();
      setShowDetailModal(false);
    } catch (error) {
      toast.error('Failed to reject permission');
    }
  };

  const loadPermissionDetails = async (permissionId) => {
    try {
      const response = await landingAPI.getVillagePermission(permissionId);
      setSelectedPermission(response.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load permission details');
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getDocumentStatus = (permission, docType) => {
    const docInfo = permission.required_documents?.[docType];
    if (!docInfo) return { status: 'missing', label: 'Required' };
    if (docInfo.verified) return { status: 'verified', label: 'Verified' };
    if (docInfo.uploaded) return { status: 'uploaded', label: 'Uploaded - Pending Review' };
    return { status: 'pending', label: 'Not Uploaded' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Village Landing Permissions</h2>
          <p className="text-slate-400">Review and approve village landing permission requests</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div 
          className={`glass p-4 rounded-xl cursor-pointer transition-all ${filterStatus === 'documents_pending' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setFilterStatus('documents_pending')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Upload className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
              <p className="text-sm text-slate-400">Docs Pending</p>
            </div>
          </div>
        </div>
        <div 
          className={`glass p-4 rounded-xl cursor-pointer transition-all ${filterStatus === 'under_review' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setFilterStatus('under_review')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.under_review}</p>
              <p className="text-sm text-slate-400">Under Review</p>
            </div>
          </div>
        </div>
        <div 
          className={`glass p-4 rounded-xl cursor-pointer transition-all ${filterStatus === 'approved' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setFilterStatus('approved')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <FileCheck className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.approved}</p>
              <p className="text-sm text-slate-400">Approved</p>
            </div>
          </div>
        </div>
        <div 
          className={`glass p-4 rounded-xl cursor-pointer transition-all ${filterStatus === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setFilterStatus('rejected')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <FileX className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.rejected}</p>
              <p className="text-sm text-slate-400">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-white">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="documents_pending">Documents Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => setFilterStatus('all')} className="border-slate-600">
          Clear Filter
        </Button>
      </div>

      {/* Permissions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
          </div>
        ) : permissions.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center">
            <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-white text-lg">No permission requests found</p>
            <p className="text-slate-400">Village landing permission requests will appear here</p>
          </div>
        ) : (
          permissions.map((permission) => (
            <div key={permission.id} className="glass rounded-xl overflow-hidden">
              {/* Header Row */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50"
                onClick={() => toggleExpand(permission.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/20 rounded-lg">
                    <FileText className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{permission.permission_number}</p>
                    <p className="text-slate-400 text-sm flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {permission.location_name}, {permission.village_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm border ${statusColors[permission.status]}`}>
                    {statusLabels[permission.status]}
                  </span>
                  <span className="text-slate-400 text-sm">
                    {permission.district}, {permission.state}
                  </span>
                  {expandedId === permission.id ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === permission.id && (
                <div className="border-t border-slate-700 p-4 bg-slate-800/30">
                  <div className="grid grid-cols-3 gap-6">
                    {/* Location Details */}
                    <div>
                      <h4 className="text-white font-medium mb-3">Location Details</h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-slate-400">
                          <span className="text-slate-500">Village:</span> {permission.village_name}
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">District:</span> {permission.district}
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">State:</span> {permission.state}
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">Coordinates:</span> {permission.latitude?.toFixed(4)}, {permission.longitude?.toFixed(4)}
                        </p>
                      </div>
                    </div>

                    {/* Land Owner Details */}
                    <div>
                      <h4 className="text-white font-medium mb-3">Land Owner</h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-slate-400 flex items-center gap-2">
                          <User className="h-4 w-4" /> {permission.land_owner_name || 'Not specified'}
                        </p>
                        <p className="text-slate-400 flex items-center gap-2">
                          <Phone className="h-4 w-4" /> {permission.land_owner_phone || 'Not specified'}
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">Area:</span> {permission.land_area_sqft?.toLocaleString()} sq.ft
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">Type:</span> {permission.land_type || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {/* Documents Status */}
                    <div>
                      <h4 className="text-white font-medium mb-3">Documents Checklist</h4>
                      <div className="space-y-2">
                        {Object.keys(docTypeLabels).slice(0, 6).map(docType => {
                          const docStatus = getDocumentStatus(permission, docType);
                          return (
                            <div key={docType} className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">{docTypeLabels[docType]}</span>
                              <span className={`
                                ${docStatus.status === 'verified' ? 'text-green-400' : ''}
                                ${docStatus.status === 'uploaded' ? 'text-blue-400' : ''}
                                ${docStatus.status === 'pending' ? 'text-yellow-400' : ''}
                              `}>
                                {docStatus.status === 'verified' && <Check className="h-4 w-4 inline" />}
                                {docStatus.status === 'uploaded' && <Clock className="h-4 w-4 inline" />}
                                {docStatus.status === 'pending' && <X className="h-4 w-4 inline" />}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => loadPermissionDetails(permission.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" /> View Full Details
                    </Button>
                    {permission.status === 'under_review' && (
                      <>
                        <Button 
                          variant="outline" 
                          className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                          onClick={() => handleRejectPermission(permission.id)}
                        >
                          <X className="h-4 w-4 mr-2" /> Reject
                        </Button>
                        <Button 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprovePermission(permission.id)}
                        >
                          <Check className="h-4 w-4 mr-2" /> Approve All
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Permission Details - {selectedPermission?.permission_number}
            </DialogTitle>
          </DialogHeader>

          {selectedPermission && (
            <div className="space-y-6 py-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-lg border ${statusColors[selectedPermission.status]}`}>
                <p className="font-medium">{statusLabels[selectedPermission.status]}</p>
                {selectedPermission.review_notes && (
                  <p className="text-sm mt-1 opacity-80">{selectedPermission.review_notes}</p>
                )}
              </div>

              {/* Location Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-white font-medium">Location</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-300">{selectedPermission.location_name}</p>
                    <p className="text-slate-400">{selectedPermission.village_name}</p>
                    <p className="text-slate-400">{selectedPermission.district}, {selectedPermission.state}</p>
                    <p className="text-slate-400">PIN: {selectedPermission.pincode}</p>
                    <p className="text-slate-400 font-mono text-xs">
                      📍 {selectedPermission.latitude?.toFixed(6)}, {selectedPermission.longitude?.toFixed(6)}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-white font-medium">Land Owner</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-300">{selectedPermission.land_owner_name}</p>
                    <p className="text-slate-400">{selectedPermission.land_owner_phone}</p>
                    <p className="text-slate-400">Area: {selectedPermission.land_area_sqft?.toLocaleString()} sq.ft</p>
                    <p className="text-slate-400">Type: {selectedPermission.land_type}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-white font-medium mb-4">Uploaded Documents</h4>
                <div className="space-y-3">
                  {(selectedPermission.documents || []).length === 0 ? (
                    <p className="text-slate-400 text-sm">No documents uploaded yet</p>
                  ) : (
                    selectedPermission.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-slate-400" />
                          <div>
                            <p className="text-white">{docTypeLabels[doc.doc_type] || doc.doc_type}</p>
                            <p className="text-sm text-slate-400">{doc.file_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            doc.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                            doc.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {doc.status}
                          </span>
                          {doc.download_url && (
                            <a href={doc.download_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                          {doc.status === 'pending' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-green-400"
                                onClick={() => handleApproveDocument(selectedPermission.id, doc.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-red-400"
                                onClick={() => {
                                  setSelectedDocId(doc.id);
                                  setShowRejectModal(true);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Final Actions */}
              {selectedPermission.status === 'under_review' && (
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <Button 
                    variant="outline" 
                    className="border-red-500/50 text-red-400"
                    onClick={() => handleRejectPermission(selectedPermission.id)}
                  >
                    <X className="h-4 w-4 mr-2" /> Reject Permission
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprovePermission(selectedPermission.id)}
                  >
                    <Check className="h-4 w-4 mr-2" /> Approve Permission
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Document Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Document</DialogTitle>
            <DialogDescription className="text-slate-400">
              Please provide a reason for rejecting this document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-300">Rejection Reason *</Label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
                rows={3}
                placeholder="e.g., Document is not legible, Missing signature, etc."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleRejectDocument} className="bg-red-600 hover:bg-red-700">
                Reject Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VillagePermissionDashboard;
