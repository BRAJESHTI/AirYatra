import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, Download, Trash2, Search, Filter, Eye, Share2, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, FolderPlus, RefreshCw, Building2, User, Calendar, Shield, Lock, Unlock, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const DOC_CATEGORIES = [
  { value: 'operator', label: 'Operator Documents', icon: Building2 },
  { value: 'customer', label: 'Customer KYCKYC', icon: User },
  { value: 'aircraft', label: 'Aircraft Documents', icon: FileText },
  { value: 'pilot', label: 'Pilot Documents', icon: Shield },
  { value: 'compliance', label: 'Compliance', icon: CheckCircle2 },
  { value: 'legal', label: 'Legal', icon: Lock },
];

const DOC_STATUS_BADGES = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: Clock },
  verified: { label: 'Verified', color: 'bg-green-500/20 text-green-400 border-green-500/40', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/40', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-red-500/20 text-red-400 border-red-500/40', icon: AlertTriangle },
  expiring_soon: { label: 'Expiring Soon', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: AlertTriangle },
};

export default function DocumentVaultAdmin() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    owner_type: 'operator',
    owner_id: '',
    document_type: '',
    title: '',
    file: null,
    expiry_date: '',
    notes: '',
  });

  // Verify form state
  const [verifyForm, setVerifyForm] = useState({
    action: 'verify',
    notes: '',
  });

  const loadDocuments = useCallback(async () => {
    try {
      // The existing document vault API uses /vault prefix
      // We'll fetch documents for all operators (admin view)
      const params = {
        page,
        limit: 20,
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(selectedStatus !== 'all' && { status: selectedStatus }),
        ...(searchQuery && { search: searchQuery }),
      };
      
      // Try to get admin list, fall back to showing placeholder
      try {
        const response = await api.get('/vault/documents/all', { params });
        setDocuments(response.data.documents || response.data || []);
        setTotalPages(response.data.pages || 1);
      } catch (err) {
        // API might not have admin endpoint - show placeholder
        setDocuments([]);
        setTotalPages(1);
      }
    } catch (err) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [page, selectedCategory, selectedStatus, searchQuery]);

  const loadStats = useCallback(async () => {
    try {
      // Try to get stats, but gracefully handle if endpoint doesn't exist
      try {
        const response = await api.get('/vault/statistics/admin');
        setStats(response.data);
      } catch (err) {
        // Set default stats if endpoint not available
        setStats({
          total_documents: 0,
          pending_verification: 0,
          verified: 0,
          expiring_soon: 0,
          expired: 0
        });
      }
    } catch (err) {
      console.error('Failed to load stats');
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [loadDocuments, loadStats]);

  const handleUpload = async () => {
    if (!uploadForm.owner_id || !uploadForm.document_type || !uploadForm.title || !uploadForm.file) {
      toast.error('Please fill all required fields');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('owner_type', uploadForm.owner_type);
      formData.append('owner_id', uploadForm.owner_id);
      formData.append('document_type', uploadForm.document_type);
      formData.append('title', uploadForm.title);
      formData.append('file', uploadForm.file);
      if (uploadForm.expiry_date) formData.append('expiry_date', uploadForm.expiry_date);
      if (uploadForm.notes) formData.append('notes', uploadForm.notes);

      await api.post('/vault/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Document uploaded successfully');
      setShowUploadDialog(false);
      setUploadForm({
        owner_type: 'operator',
        owner_id: '',
        document_type: '',
        title: '',
        file: null,
        expiry_date: '',
        notes: '',
      });
      loadDocuments();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedDoc) return;

    setVerifying(true);
    try {
      await api.post(`/vault/verify/${selectedDoc.document_id}`, {
        action: verifyForm.action,
        notes: verifyForm.notes,
      });

      toast.success(
        verifyForm.action === 'verify' 
          ? 'Document verified!' 
          : 'Document rejected'
      );
      setShowVerifyDialog(false);
      setVerifyForm({ action: 'verify', notes: '' });
      setSelectedDoc(null);
      loadDocuments();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await api.delete(`/vault/document/${doc.document_id}`);
      toast.success('Document deleted');
      loadDocuments();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 30) return 'expiring_soon';
    return null;
  };

  return (
    <div className="space-y-6" data-testid="document-vault-admin">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-400" />
            Document Vault</h1>
          <p className="text-slate-400 text-sm mt-1">Manage all operator & customer documents with 5-year retention</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadDocuments} variant="outline" className="border-slate-600 text-slate-300">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => setShowUploadDialog(true)} className="bg-blue-500 hover:bg-blue-600">
            <Upload className="h-4 w-4 mr-1" /> Upload Document
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="glass p-4 rounded-xl">
            <p className="text-3xl font-bold text-white">{stats.total_documents || 0}</p>
            <p className="text-sm text-slate-400">Total Documents</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-3xl font-bold text-yellow-400">{stats.pending_verification || 0}</p>
            <p className="text-sm text-slate-400">Pending Verification</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-3xl font-bold text-green-400">{stats.verified || 0}</p>
            <p className="text-sm text-slate-400">Verified</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-3xl font-bold text-orange-400">{stats.expiring_soon || 0}</p>
            <p className="text-sm text-slate-400">Expiring Soon</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-3xl font-bold text-red-400">{stats.expired || 0}</p>
            <p className="text-sm text-slate-400">Expired</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4 rounded-xl">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-600 text-white"
                data-testid="doc-search-input"
              />
            </div>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
            data-testid="doc-category-filter"
          >
            <option value="all">All Categories</option>
            {DOC_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
            data-testid="doc-status-filter"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
            <p className="text-slate-400 mt-2">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-slate-600" />
            <p className="text-slate-400 mt-2">No documents found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left p-4 text-slate-400 font-medium">Document</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Owner</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Category</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Expiry</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Uploaded</th>
                  <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const status = DOC_STATUS_BADGES[doc.status] || DOC_STATUS_BADGES.pending;
                  const expiryStatus = getExpiryStatus(doc.expiry_date);
                  const StatusIcon = status.icon;
                  
                  return (
                    <tr key={doc.document_id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileText className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{doc.title}</p>
                            <p className="text-xs text-slate-500">{doc.document_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-300">{doc.owner_name || doc.owner_id}</p>
                        <p className="text-xs text-slate-500 capitalize">{doc.owner_type}</p>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-slate-300 capitalize">{doc.category}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4">
                        {doc.expiry_date ? (
                          <div>
                            <p className={`text-sm ${expiryStatus === 'expired' ? 'text-red-400' : expiryStatus === 'expiring_soon' ? 'text-orange-400' : 'text-slate-300'}`}>
                              {formatDate(doc.expiry_date)}
                            </p>
                            {expiryStatus && (
                              <p className={`text-xs ${expiryStatus === 'expired' ? 'text-red-400' : 'text-orange-400'}`}>
                                {expiryStatus === 'expired' ? 'EXPIRED' : 'Expiring soon'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-slate-400">{formatDate(doc.uploaded_at)}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setSelectedDoc(doc); setShowViewDialog(true); }}
                            className="text-blue-400 hover:text-blue-300"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {doc.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setSelectedDoc(doc); setShowVerifyDialog(true); }}
                              className="text-green-400 hover:text-green-300"
                              title="Verify"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(doc)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-700">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-slate-600"
            >
              Previous
            </Button>
            <span className="text-slate-400">Page {page} of {totalPages}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="border-slate-600"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-400" />
              Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Owner Type</Label>
                <select
                  value={uploadForm.owner_type}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, owner_type: e.target.value }))}
                  className="mt-1 w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
                >
                  <option value="operator">Operator</option>
                  <option value="customer">Customer</option>
                  <option value="pilot">Pilot</option>
                  <option value="aircraft">Aircraft</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Owner ID *</Label>
                <Input
                  value={uploadForm.owner_id}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, owner_id: e.target.value }))}
                  placeholder="Enter ID..."
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Document Type *</Label>
              <Input
                value={uploadForm.document_type}
                onChange={(e) => setUploadForm(prev => ({ ...prev, document_type: e.target.value }))}
                placeholder="e.g., AOC Certificate, Insurance, License..."
                className="mt-1 bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Title *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Document title..."
                className="mt-1 bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">File *</Label>
              <Input
                type="file"
                onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files[0] }))}
                className="mt-1 bg-slate-800 border-slate-600 text-white"
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </div>
            <div>
              <Label className="text-slate-300">Expiry Date (if applicable)</Label>
              <Input
                type="date"
                value={uploadForm.expiry_date}
                onChange={(e) => setUploadForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                className="mt-1 bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Notes</Label>
              <textarea
                value={uploadForm.notes}
                onChange={(e) => setUploadForm(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1 w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
                rows={2}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading} className="bg-blue-500 hover:bg-blue-600">
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              Verify Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedDoc && (
              <div className="p-3 rounded-lg bg-slate-800/50">
                <p className="font-medium text-white">{selectedDoc.title}</p>
                <p className="text-sm text-slate-400">{selectedDoc.document_type}</p>
              </div>
            )}
            <div>
              <Label className="text-slate-300">Action</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={verifyForm.action === 'verify' ? 'default' : 'outline'}
                  onClick={() => setVerifyForm(prev => ({ ...prev, action: 'verify' }))}
                  className={verifyForm.action === 'verify' ? 'bg-green-500' : 'border-slate-600'}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Verify
                </Button>
                <Button
                  variant={verifyForm.action === 'reject' ? 'default' : 'outline'}
                  onClick={() => setVerifyForm(prev => ({ ...prev, action: 'reject' }))}
                  className={verifyForm.action === 'reject' ? 'bg-red-500' : 'border-slate-600'}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Notes {verifyForm.action === 'reject' ? '*' : ''}</Label>
              <textarea
                value={verifyForm.notes}
                onChange={(e) => setVerifyForm(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1 w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
                rows={3}
                placeholder={verifyForm.action === 'reject' ? 'Reason for rejection...' : 'Optional verification notes...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verifying || (verifyForm.action === 'reject' && !verifyForm.notes)}
              className={verifyForm.action === 'verify' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-400" />
              Document Details</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Title</p>
                  <p className="text-white font-medium">{selectedDoc.title}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Type</p>
                  <p className="text-white">{selectedDoc.document_type}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Owner</p>
                  <p className="text-white">{selectedDoc.owner_name || selectedDoc.owner_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${DOC_STATUS_BADGES[selectedDoc.status]?.color || ''}`}>
                    {selectedDoc.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Uploaded</p>
                  <p className="text-white">{formatDate(selectedDoc.uploaded_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Expiry</p>
                  <p className="text-white">{formatDate(selectedDoc.expiry_date) || 'N/A'}</p>
                </div>
              </div>
              {selectedDoc.file_url && (
                <div className="pt-4 border-t border-slate-700">
                  <Button asChild className="bg-blue-500 hover:bg-blue-600">
                    <a href={selectedDoc.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" /> Download Document
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
