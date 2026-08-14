import React, { useState, useEffect } from 'react';
import { 
  Shield, Upload, FileText, CheckCircle, AlertTriangle, Clock,
  X, Loader2, RefreshCw, Eye, Download, Trash2, CreditCard,
  User, Building2, ExternalLink, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function CustomerKYCUpload({ user }) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(null);

  // Upload form state
  const [selectedType, setSelectedType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [file, setFile] = useState(null);
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    loadDocumentTypes();
    loadDocuments();
  }, []);

  const loadDocumentTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/documents/types?category=customer&active_only=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDocumentTypes(data.document_types || []);
      if (data.document_types?.length > 0) {
        setSelectedType(data.document_types[0].code);
      }
    } catch (error) {
      // Fallback types
      setDocumentTypes([
        { code: 'AADHAR', name: 'Aadhar Card', name_hi: '', has_expiry: false, verification_api: 'AADHAR_KYC' },
        { code: 'PAN', name: 'PAN Card', name_hi: '', has_expiry: false, verification_api: 'PAN_VERIFY' },
        { code: 'PASSPORT', name: 'Passport', name_hi: '', has_expiry: true, verification_api: 'PASSPORT_VERIFY' },
        { code: 'DL', name: 'Driving License', name_hi: '', has_expiry: true, verification_api: 'DL_VERIFY' },
        { code: 'VOTER_ID', name: 'Voter ID', name_hi: '', has_expiry: false },
      ]);
      setSelectedType('AADHAR');
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/customer/kyc-documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to load KYC documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error('Only PDF and image files allowed');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File too large (max 5MB)');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedType || !documentNumber) {
      toast.error('Please fill all required fields');
      return;
    }

    const docType = documentTypes.find(t => t.code === selectedType);
    if (docType?.has_expiry && !expiryDate) {
      toast.error('Expiry date is required for this document');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', selectedType);
      formData.append('document_number', documentNumber);
      if (expiryDate) formData.append('expiry_date', expiryDate);

      const res = await fetch(`${API_URL}/api/customer/kyc-documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }

      const result = await res.json();
      toast.success('Document uploaded! Verification in progress...');

      // Reset form
      setShowUpload(false);
      setFile(null);
      setDocumentNumber('');
      setExpiryDate('');
      loadDocuments();

      // If auto-verification available, show status
      if (result.verification_status) {
        if (result.verification_status === 'verified') {
          toast.success('Document verified successfully!');
        } else if (result.verification_status === 'pending') {
          toast.info('Document uploaded. Verification pending.');
        }
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const verifyDocument = async (docId) => {
    setVerifying(docId);
    try {
      const token = localStorage.getItem('token');
      const doc = documents.find(d => d.id === docId);
      
      const res = await fetch(`${API_URL}/api/admin/documents/verify`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: doc.document_type,
          document_number: doc.document_number
        })
      });

      const result = await res.json();
      
      if (result.verified) {
        toast.success('Document verified successfully!');
        loadDocuments();
      } else {
        toast.info(result.message || 'Verification pending');
      }
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setVerifying(null);
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/customer/kyc-documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Document deleted');
      loadDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Verified
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Uploaded
          </span>
        );
    }
  };

  const selectedDocType = documentTypes.find(t => t.code === selectedType);

  // Check KYC completion
  const requiredDocs = documentTypes.filter(t => t.is_mandatory);
  const uploadedRequired = requiredDocs.filter(t => 
    documents.some(d => d.document_type === t.code && d.verification_status === 'verified')
  );
  const kycComplete = requiredDocs.length > 0 && uploadedRequired.length === requiredDocs.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-green-400" />
            KYC Documents</h2>
          <p className="text-slate-400 mt-1">Upload identity documents for verification</p>
        </div>
        <Button onClick={() => setShowUpload(true)} className="bg-green-600 hover:bg-green-700">
          <Upload className="h-4 w-4 mr-2" /> Upload Document
        </Button>
      </div>

      {/* KYC Status Card */}
      <div className={`rounded-xl p-6 border ${
        kycComplete 
          ? 'bg-green-900/20 border-green-700/30' 
          : 'bg-yellow-900/20 border-yellow-700/30'
      }`}>
        <div className="flex items-center gap-4">
          {kycComplete ? (
            <CheckCircle className="h-12 w-12 text-green-400" />
          ) : (
            <AlertTriangle className="h-12 w-12 text-yellow-400" />
          )}
          <div>
            <h3 className={`text-lg font-semibold ${kycComplete ? 'text-green-400' : 'text-yellow-400'}`}>
              {kycComplete ? 'KYC Complete' : 'KYC Incomplete'}
            </h3>
            <p className="text-slate-400">
              {kycComplete 
                ? 'All required documents verified. You can book flights without restrictions.'
                : `Upload required documents: ${requiredDocs.map(d => d.name).join(', ')}`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Your Documents</h3>
        
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="h-8 w-8 animate-spin text-green-400" />
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
            <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No documents uploaded yet</p>
            <p className="text-slate-500 text-sm mt-2">Upload Aadhar, PAN, or Passport for verification</p>
            <Button onClick={() => setShowUpload(true)} className="mt-4 bg-green-600 hover:bg-green-700">
              <Upload className="h-4 w-4 mr-2" /> Upload First Document
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {documents.map(doc => {
              const docType = documentTypes.find(t => t.code === doc.document_type);
              return (
                <div 
                  key={doc.id} 
                  className={`bg-slate-800/50 rounded-xl p-4 border transition-all ${
                    doc.verification_status === 'verified' ? 'border-green-700/30' :
                    doc.verification_status === 'rejected' ? 'border-red-700/30' :
                    'border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        doc.verification_status === 'verified' ? 'bg-green-500/20' : 'bg-blue-500/20'
                      }`}>
                        <CreditCard className={`h-6 w-6 ${
                          doc.verification_status === 'verified' ? 'text-green-400' : 'text-blue-400'
                        }`} />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {docType?.name || doc.document_type} 
                        </h4>
                        <p className="text-slate-400 text-sm">
                          Number: {doc.document_number?.slice(0, 4)}****{doc.document_number?.slice(-4)}
                        </p>
                        {doc.expiry_date && (
                          <p className="text-slate-500 text-xs">
                            Expires: {new Date(doc.expiry_date).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {getStatusBadge(doc.verification_status)}
                      
                      {doc.verification_status !== 'verified' && docType?.verification_api && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => verifyDocument(doc.id)}
                          disabled={verifying === doc.id}
                          className="border-green-500 text-green-400 hover:bg-green-500/10"
                        >
                          {verifying === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-1" /> Verify
                            </>
                          )}
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteDocument(doc.id)}
                        className="border-red-500 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Document Types */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Accepted Documents</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {documentTypes.map(type => {
            const isUploaded = documents.some(d => d.document_type === type.code);
            const isVerified = documents.some(d => d.document_type === type.code && d.verification_status === 'verified');
            return (
              <div 
                key={type.code}
                className={`p-3 rounded-lg border ${
                  isVerified ? 'bg-green-500/10 border-green-500/30' :
                  isUploaded ? 'bg-blue-500/10 border-blue-500/30' :
                  'bg-slate-900/50 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">{type.name}</span>
                  {isVerified ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : isUploaded ? (
                    <Clock className="h-4 w-4 text-blue-400" />
                  ) : null}
                </div>
                {type.is_mandatory && (
                  <span className="text-xs text-red-400">Required</span>
                )}
                {type.verification_api && (
                  <span className="text-xs text-green-400 ml-2">Auto-Verify</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-green-400" />
                Upload KYC Document
              </h3>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Document Type */}
              <div>
                <Label className="text-white">Document Type*</Label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {documentTypes.map(type => (
                    <option key={type.code} value={type.code}>
                      {type.name}
                      {type.verification_api ? ' (Auto-Verify)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Number */}
              <div>
                <Label className="text-white">Document Number*</Label>
                <Input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder={selectedType === 'AADHAR' ? '1234 5678 9012' : 
                               selectedType === 'PAN' ? 'ABCDE1234F' : 
                               'Enter document number'}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>

              {/* Expiry Date (if applicable) */}
              {selectedDocType?.has_expiry && (
                <div>
                  <Label className="text-white">Expiry Date*</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              )}

              {/* File Upload */}
              <div>
                <Label className="text-white">Document File*</Label>
                <div className="mt-1 border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-green-500/50 transition-colors relative">
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-green-400" />
                      <div className="text-left">
                        <p className="text-white">{file.name}</p>
                        <p className="text-slate-500 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button onClick={() => setFile(null)} className="text-red-400">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400">Click to select or drag & drop</p>
                      <p className="text-slate-500 text-xs mt-1">PDF, JPG, PNG (max 5MB)</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Verification Info */}
              {selectedDocType?.verification_api && (
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <p className="text-green-400 text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Auto-verification available for {selectedDocType.name}
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    Document will be verified with government database after upload
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => setShowUpload(false)} variant="outline" className="flex-1 border-slate-600">
                Cancel
              </Button>
              <Button 
                onClick={handleUpload}
                disabled={!file || !documentNumber || uploading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Upload & Verify</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerKYCUpload;
