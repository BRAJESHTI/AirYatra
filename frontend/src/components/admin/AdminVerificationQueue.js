import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, FileText, CheckCircle, XCircle, Clock, Eye, Download,
  Loader2, AlertTriangle, Search, Filter, RefreshCw, User,
  Plane, Building2, ChevronRight, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ VERIFICATION STATUS BADGE ============
const VerificationStatusBadge = ({ status }) => {
  const config = {
    pending: { color: 'bg-yellow-500 text-black', label: 'Pending Review' },
    approved: { color: 'bg-green-500 text-white', label: 'Approved' },
    rejected: { color: 'bg-red-500 text-white', label: 'Rejected' },
    verified: { color: 'bg-green-500 text-white', label: 'Verified' }
  };
  
  const c = config[status] || config.pending;
  
  return <Badge className={c.color}>{c.label}</Badge>;
};

// ============ DOCUMENT VERIFICATION MODAL ============
const DocumentVerificationModal = ({ document, onClose, onVerify }) => {
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async (verificationStatus) => {
    if (verificationStatus === 'rejected' && !notes.trim()) {
      toast.error('Please provide rejection reason');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      await axios.post(
        `${API_URL}/api/vault/verify/${document.document_id}`,
        {
          verification_status: verificationStatus,
          verified_by: user.id,
          verification_notes: notes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Document ${verificationStatus === 'verified' ? 'approved' : 'rejected'}!`);
      onVerify && onVerify();
      onClose();
    } catch (error) {
      toast.error('Failed to verify document');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-400" />
            Document Verification
          </CardTitle>
          <CardDescription>Review and verify this document</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Document Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-slate-400 text-sm">Document Name</p>
              <p className="text-white font-medium">{document.name}</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-slate-400 text-sm">Category</p>
              <p className="text-white font-medium capitalize">{document.category}</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-slate-400 text-sm">Type</p>
              <p className="text-white font-medium capitalize">{document.document_type?.replace(/_/g, ' ')}</p>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg">
              <p className="text-slate-400 text-sm">Uploaded</p>
              <p className="text-white font-medium">{new Date(document.created_at).toLocaleDateString()}</p>
            </div>
            {document.reference_number && (
              <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-slate-400 text-sm">Reference Number</p>
                <p className="text-white font-medium">{document.reference_number}</p>
              </div>
            )}
            {document.expiry_date && (
              <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-slate-400 text-sm">Expiry Date</p>
                <p className="text-white font-medium">{new Date(document.expiry_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {/* Preview Link */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1">
              <Eye className="h-4 w-4 mr-2" /> Preview Document
            </Button>
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          </div>

          {/* Verification Notes */}
          <div>
            <label className="text-slate-400 text-sm">Verification Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this document verification..."
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md text-white p-3 mt-1"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => handleVerify('rejected')}
              disabled={submitting}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
            <Button
              onClick={() => handleVerify('verified')}
              disabled={submitting}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============ MAIN VERIFICATION QUEUE ============
const AdminVerificationQueue = () => {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [verifiedDocs, setVerifiedDocs] = useState([]);
  const [rejectedDocs, setRejectedDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch all documents from all operators (admin view)
      // We'll use a special endpoint or aggregate from multiple sources
      const response = await axios.get(
        `${API_URL}/api/admin/document-vault/verification-queue`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const allDocs = response.data.documents || [];
        setPendingDocs(allDocs.filter(d => d.verification_status === 'pending'));
        setVerifiedDocs(allDocs.filter(d => d.verification_status === 'verified'));
        setRejectedDocs(allDocs.filter(d => d.verification_status === 'rejected'));
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      // If endpoint doesn't exist yet, show empty state
      setPendingDocs([]);
      setVerifiedDocs([]);
      setRejectedDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filterDocuments = (docs) => {
    return docs.filter(doc => {
      const matchesSearch = !searchQuery || 
        doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.reference_number?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !categoryFilter || doc.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="verification-queue">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-400" />
            Document Verification Queue</h2>
          <p className="text-slate-400 text-sm mt-1">
            Review and approve operator documents for verification
          </p>
        </div>
        <Button variant="outline" onClick={fetchDocuments} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-yellow-500/10 border-yellow-500/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-yellow-400">{pendingDocs.length}</div>
            <div className="text-slate-400 text-sm">Pending Review</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-green-400">{verifiedDocs.length}</div>
            <div className="text-slate-400 text-sm">Approved</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/50">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
            <div className="text-3xl font-bold text-red-400">{rejectedDocs.length}</div>
            <div className="text-slate-400 text-sm">Rejected</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md"
        >
          <option value="">All Categories</option>
          <option value="dgca">DGCA</option>
          <option value="insurance">Insurance</option>
          <option value="aircraft">Aircraft</option>
          <option value="pilot">Pilot</option>
          <option value="operator">Operator</option>
        </select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Clock className="h-4 w-4 mr-2" /> Pending ({pendingDocs.length})
          </TabsTrigger>
          <TabsTrigger value="verified" className="data-[state=active]:bg-green-500">
            <CheckCircle className="h-4 w-4 mr-2" /> Approved ({verifiedDocs.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-red-500">
            <XCircle className="h-4 w-4 mr-2" /> Rejected ({rejectedDocs.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-3">
          {filterDocuments(pendingDocs).length === 0 ? (
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
                <p className="text-slate-400">No documents pending verification</p>
              </CardContent>
            </Card>
          ) : (
            filterDocuments(pendingDocs).map((doc) => (
              <Card key={doc.document_id} className="bg-slate-900 border-slate-700 hover:border-yellow-500/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-yellow-500/20 rounded-lg">
                        <FileText className="h-6 w-6 text-yellow-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{doc.name}</h4>
                        <p className="text-slate-400 text-sm capitalize">{doc.category} • {doc.document_type?.replace(/_/g, ' ')}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <VerificationStatusBadge status={doc.verification_status} />
                      <Button
                        onClick={() => setSelectedDoc(doc)}
                        className="bg-orange-500 hover:bg-orange-600"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" /> Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Verified Tab */}
        <TabsContent value="verified" className="space-y-3">
          {filterDocuments(verifiedDocs).map((doc) => (
            <Card key={doc.document_id} className="bg-slate-900 border-slate-700 border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{doc.name}</h4>
                      <p className="text-slate-400 text-sm capitalize">{doc.category}</p>
                      <p className="text-green-400 text-xs mt-1">
                        Verified: {doc.verified_at ? new Date(doc.verified_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <VerificationStatusBadge status="approved" />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Rejected Tab */}
        <TabsContent value="rejected" className="space-y-3">
          {filterDocuments(rejectedDocs).map((doc) => (
            <Card key={doc.document_id} className="bg-slate-900 border-slate-700 border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <XCircle className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{doc.name}</h4>
                      <p className="text-slate-400 text-sm capitalize">{doc.category}</p>
                      {doc.verification_notes && (
                        <p className="text-red-400 text-xs mt-1">Reason: {doc.verification_notes}</p>
                      )}
                    </div>
                  </div>
                  <VerificationStatusBadge status="rejected" />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Verification Modal */}
      {selectedDoc && (
        <DocumentVerificationModal
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onVerify={() => {
            setSelectedDoc(null);
            fetchDocuments();
          }}
        />
      )}
    </div>
  );
};

export default AdminVerificationQueue;
