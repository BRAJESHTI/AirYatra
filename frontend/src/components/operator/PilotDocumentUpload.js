import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Download, Trash2, CheckCircle, AlertTriangle,
  Clock, Calendar, RefreshCw, User, Eye, X, Loader2, File, Bell,
  Mail, ChevronDown, ChevronUp, Shield, Plus, Send, AlertCircle,
  Search, Filter, Users, FolderUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import BulkDocumentUpload from './BulkDocumentUpload';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function PilotDocumentUpload({ pilotId = null }) {
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploadPilot, setBulkUploadPilot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(pilotId);
  const [pilots, setPilots] = useState([]);
  const [expandedPilot, setExpandedPilot] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sendingAlert, setSendingAlert] = useState(null);
  const [allPilotsData, setAllPilotsData] = useState({});
  
  // Upload form state
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('license');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('DGCA');

  // Document types with required fields
  const documentTypes = [
    { value: 'license', label: 'Pilot License / पायलट लाइसेंस', requiresNumber: true, requiresExpiry: true },
    { value: 'medical', label: 'Medical Certificate / चिकित्सा प्रमाणपत्र', requiresNumber: true, requiresExpiry: true },
    { value: 'type_rating', label: 'Type Rating / टाइप रेटिंग', requiresNumber: true, requiresExpiry: true },
    { value: 'instrument_rating', label: 'Instrument Rating', requiresNumber: true, requiresExpiry: true },
    { value: 'english_proficiency', label: 'English Proficiency (ICAO)', requiresNumber: false, requiresExpiry: true },
    { value: 'id_proof', label: 'ID Proof / आधार/पैन', requiresNumber: true, requiresExpiry: false },
    { value: 'passport', label: 'Passport / पासपोर्ट', requiresNumber: true, requiresExpiry: true },
    { value: 'training_certificate', label: 'Training Certificate', requiresNumber: false, requiresExpiry: false },
    { value: 'emergency_training', label: 'Emergency Training', requiresNumber: false, requiresExpiry: true },
    { value: 'security_clearance', label: 'Security Clearance', requiresNumber: true, requiresExpiry: true },
    { value: 'other', label: 'Other / अन्य', requiresNumber: false, requiresExpiry: false }
  ];

  useEffect(() => {
    loadPilots();
  }, []);

  useEffect(() => {
    if (selectedPilot) {
      loadDocuments();
    }
  }, [selectedPilot]);

  const loadPilots = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/operator/pilots`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      setPilots(json.pilots || []);
      
      // Load document summary for all pilots
      if (json.pilots?.length > 0) {
        loadAllPilotsDocumentSummary(json.pilots);
      }
    } catch (error) {
      console.error('Failed to load pilots');
    } finally {
      setLoading(false);
    }
  };

  const loadAllPilotsDocumentSummary = async (pilotsList) => {
    const token = localStorage.getItem('token');
    const summaryData = {};
    
    for (const pilot of pilotsList) {
      try {
        const res = await fetch(`${API_URL}/api/maintenance/pilot-documents?pilot_id=${pilot.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        
        const docs = json.documents || [];
        const expiredCount = docs.filter(d => d.verification_status === 'expired').length;
        const expiringCount = docs.filter(d => d.verification_status === 'expiring_soon').length;
        const validCount = docs.filter(d => d.verification_status === 'valid').length;
        
        summaryData[pilot.id] = {
          total: docs.length,
          expired: expiredCount,
          expiring: expiringCount,
          valid: validCount,
          documents: docs
        };
      } catch (e) {
        summaryData[pilot.id] = { total: 0, expired: 0, expiring: 0, valid: 0, documents: [] };
      }
    }
    
    setAllPilotsData(summaryData);
  };

  const loadDocuments = async () => {
    if (!selectedPilot) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/maintenance/pilot-documents?pilot_id=${selectedPilot}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      setData(json);
    } catch (error) {
      toast.error('Failed to load documents');
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
    if (!file || !selectedPilot) {
      toast.error('Please select a file and pilot');
      return;
    }
    
    const docTypeConfig = documentTypes.find(dt => dt.value === documentType);
    if (docTypeConfig?.requiresNumber && !documentNumber) {
      toast.error('Document number is required for this type');
      return;
    }
    if (docTypeConfig?.requiresExpiry && !expiryDate) {
      toast.error('Expiry date is required for this type');
      return;
    }
    
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pilot_id', selectedPilot);
      formData.append('document_type', documentType);
      formData.append('document_number', documentNumber);
      formData.append('expiry_date', expiryDate);
      formData.append('issue_date', issueDate);
      formData.append('issuing_authority', issuingAuthority);
      formData.append('notes', notes);
      
      const res = await fetch(`${API_URL}/api/maintenance/pilot-documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }
      
      const result = await res.json();
      toast.success('Document uploaded successfully! / दस्तावेज़ अपलोड हो गया!');
      
      if (result.auto_verification) {
        if (result.auto_verification.status === 'expired') {
          toast.warning('⚠️ Document has expired! Alert will be sent.');
        } else if (result.auto_verification.status === 'expiring_soon') {
          toast.warning(`⏰ Document expires in ${result.auto_verification.days_left} days!`);
        }
      }
      
      // Reset form
      setShowUpload(false);
      setFile(null);
      setDocumentNumber('');
      setExpiryDate('');
      setIssueDate('');
      setNotes('');
      loadDocuments();
      loadPilots(); // Refresh summary
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (docId, fileName) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/maintenance/pilot-documents/${docId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Delete this document? / यह दस्तावेज़ हटाएं?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/maintenance/pilot-documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Document deleted');
      loadDocuments();
      loadPilots();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const sendExpiryAlert = async (pilotId, documentId = null) => {
    setSendingAlert(pilotId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/maintenance/pilot-documents/send-alert`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pilot_id: pilotId, document_id: documentId })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to send alert');
      }
      
      const result = await res.json();
      toast.success(`🔔 Alert sent! ${result.message}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingAlert(null);
    }
  };

  const getStatusBadge = (status, daysLeft = null) => {
    switch (status) {
      case 'valid':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Valid {daysLeft && `(${daysLeft}d)`}
          </span>
        );
      case 'expired':
        return (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs flex items-center gap-1 animate-pulse">
            <AlertTriangle className="h-3 w-3" /> EXPIRED
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" /> Expiring {daysLeft && `in ${daysLeft}d`}
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" /> Pending
          </span>
        );
    }
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const exp = new Date(expiryDate);
    const now = new Date();
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  };

  const filteredPilots = pilots.filter(pilot => {
    const matchesSearch = !searchTerm || 
      pilot.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pilot.license_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterStatus === 'all') return true;
    
    const summary = allPilotsData[pilot.id] || {};
    if (filterStatus === 'expired') return summary.expired > 0;
    if (filterStatus === 'expiring') return summary.expiring > 0;
    if (filterStatus === 'valid') return summary.total > 0 && summary.expired === 0 && summary.expiring === 0;
    if (filterStatus === 'no_docs') return summary.total === 0;
    
    return true;
  });

  const openUploadForPilot = (pilotId) => {
    setSelectedPilot(pilotId);
    setShowUpload(true);
  };

  const openBulkUpload = (pilot) => {
    setBulkUploadPilot(pilot);
    setShowBulkUpload(true);
  };

  const handleBulkUploadComplete = () => {
    loadPilots(); // Refresh data
    setShowBulkUpload(false);
    setBulkUploadPilot(null);
  };

  // Summary stats
  const totalExpired = Object.values(allPilotsData).reduce((sum, p) => sum + (p.expired || 0), 0);
  const totalExpiring = Object.values(allPilotsData).reduce((sum, p) => sum + (p.expiring || 0), 0);
  const totalDocs = Object.values(allPilotsData).reduce((sum, p) => sum + (p.total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" />
            Pilot Document Portal / पायलट दस्तावेज़ पोर्टल
          </h2>
          <p className="text-slate-400 mt-1">Manage licenses, medicals, certificates with expiry alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadPilots} variant="outline" className="border-slate-600">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Users className="h-5 w-5" />
            <span className="text-sm">Total Pilots</span>
          </div>
          <p className="text-3xl font-bold text-white">{pilots.length}</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-900/30 to-slate-900 rounded-xl p-4 border border-green-700/30">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <FileText className="h-5 w-5" />
            <span className="text-sm">Total Documents</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalDocs}</p>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-900/30 to-slate-900 rounded-xl p-4 border border-yellow-700/30">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Clock className="h-5 w-5" />
            <span className="text-sm">Expiring Soon</span>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{totalExpiring}</p>
          <p className="text-xs text-slate-500">Within 30 days</p>
        </div>
        
        <div className="bg-gradient-to-br from-red-900/30 to-slate-900 rounded-xl p-4 border border-red-700/30">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Expired</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{totalExpired}</p>
          <p className="text-xs text-slate-500">Needs renewal</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search pilot name or license..."
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'All', count: pilots.length },
            { id: 'expired', label: 'Expired', count: pilots.filter(p => allPilotsData[p.id]?.expired > 0).length, color: 'red' },
            { id: 'expiring', label: 'Expiring', count: pilots.filter(p => allPilotsData[p.id]?.expiring > 0).length, color: 'yellow' },
            { id: 'no_docs', label: 'No Docs', count: pilots.filter(p => !allPilotsData[p.id]?.total).length, color: 'slate' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === filter.id
                  ? filter.color === 'red' ? 'bg-red-500 text-white' :
                    filter.color === 'yellow' ? 'bg-yellow-500 text-black' :
                    'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      </div>

      {/* Pilots List with Document Summary */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : filteredPilots.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
            <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No pilots found</p>
          </div>
        ) : (
          filteredPilots.map(pilot => {
            const summary = allPilotsData[pilot.id] || { total: 0, expired: 0, expiring: 0, valid: 0, documents: [] };
            const isExpanded = expandedPilot === pilot.id;
            const hasIssues = summary.expired > 0 || summary.expiring > 0;
            
            return (
              <div 
                key={pilot.id} 
                className={`bg-slate-800/50 rounded-xl border transition-all ${
                  summary.expired > 0 ? 'border-red-500/50' :
                  summary.expiring > 0 ? 'border-yellow-500/50' :
                  'border-slate-700'
                }`}
              >
                {/* Pilot Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/80"
                  onClick={() => setExpandedPilot(isExpanded ? null : pilot.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      hasIssues ? 'bg-red-500/20' : 'bg-blue-500/20'
                    }`}>
                      <User className={`h-6 w-6 ${hasIssues ? 'text-red-400' : 'text-blue-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        {pilot.name || 'Unknown Pilot'}
                        {summary.expired > 0 && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs animate-pulse">
                            {summary.expired} EXPIRED
                          </span>
                        )}
                        {summary.expiring > 0 && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                            {summary.expiring} expiring
                          </span>
                        )}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        License: {pilot.license_number || 'N/A'} • Phone: {pilot.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Document Count Badges */}
                    <div className="flex items-center gap-2 mr-4">
                      <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                        {summary.total} docs
                      </span>
                      {summary.valid > 0 && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          {summary.valid} ✓
                        </span>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <Button
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); openUploadForPilot(pilot.id); }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Upload className="h-4 w-4 mr-1" /> Upload
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openBulkUpload(pilot); }}
                      className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
                    >
                      <FolderUp className="h-4 w-4 mr-1" /> Bulk
                    </Button>
                    
                    {hasIssues && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); sendExpiryAlert(pilot.id); }}
                        disabled={sendingAlert === pilot.id}
                        className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                      >
                        {sendingAlert === pilot.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Bell className="h-4 w-4 mr-1" /> Send Alert
                          </>
                        )}
                      </Button>
                    )}
                    
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
                
                {/* Expanded Documents List */}
                {isExpanded && (
                  <div className="border-t border-slate-700 p-4">
                    {summary.documents.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No documents uploaded for this pilot</p>
                        <Button
                          size="sm"
                          onClick={() => openUploadForPilot(pilot.id)}
                          className="mt-3 bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Upload First Document
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-900/50">
                            <tr>
                              <th className="text-left p-3 text-slate-400 font-medium text-sm">Type</th>
                              <th className="text-left p-3 text-slate-400 font-medium text-sm">Document No.</th>
                              <th className="text-left p-3 text-slate-400 font-medium text-sm">Expiry Date</th>
                              <th className="text-left p-3 text-slate-400 font-medium text-sm">Days Left</th>
                              <th className="text-left p-3 text-slate-400 font-medium text-sm">Status</th>
                              <th className="text-right p-3 text-slate-400 font-medium text-sm">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.documents.map((doc) => {
                              const daysLeft = getDaysUntilExpiry(doc.expiry_date);
                              return (
                                <tr key={doc.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-blue-400" />
                                      <span className="text-white capitalize">{doc.document_type?.replace('_', ' ')}</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span className="text-slate-300 font-mono text-sm">{doc.document_number || '-'}</span>
                                  </td>
                                  <td className="p-3">
                                    {doc.expiry_date ? (
                                      <span className={`${
                                        daysLeft && daysLeft < 0 ? 'text-red-400' :
                                        daysLeft && daysLeft < 30 ? 'text-yellow-400' :
                                        'text-slate-400'
                                      }`}>
                                        {new Date(doc.expiry_date).toLocaleDateString('en-IN', { 
                                          day: '2-digit', month: 'short', year: 'numeric' 
                                        })}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">No expiry</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {daysLeft !== null ? (
                                      <span className={`font-bold ${
                                        daysLeft < 0 ? 'text-red-400' :
                                        daysLeft < 30 ? 'text-yellow-400' :
                                        daysLeft < 90 ? 'text-blue-400' :
                                        'text-green-400'
                                      }`}>
                                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">-</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {getStatusBadge(doc.verification_status, daysLeft > 0 ? daysLeft : null)}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => downloadDocument(doc.id, doc.file_name)}
                                        className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                                        title="Download"
                                      >
                                        <Download className="h-4 w-4 text-blue-400" />
                                      </button>
                                      {(doc.verification_status === 'expired' || doc.verification_status === 'expiring_soon') && (
                                        <button
                                          onClick={() => sendExpiryAlert(pilot.id, doc.id)}
                                          className="p-1.5 hover:bg-orange-500/20 rounded transition-colors"
                                          title="Send Alert"
                                        >
                                          <Bell className="h-4 w-4 text-orange-400" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => deleteDocument(doc.id)}
                                        className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-400" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-400" />
                Upload Document / दस्तावेज़ अपलोड
              </h3>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Pilot Selection */}
              <div>
                <Label className="text-white">Pilot / पायलट *</Label>
                <select
                  value={selectedPilot || ''}
                  onChange={(e) => setSelectedPilot(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">-- Select Pilot --</option>
                  {pilots.map(pilot => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilot.name} ({pilot.license_number || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Document Type */}
              <div>
                <Label className="text-white">Document Type / प्रकार *</Label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  {documentTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Document Number */}
              <div>
                <Label className="text-white">
                  Document Number / नंबर 
                  {documentTypes.find(dt => dt.value === documentType)?.requiresNumber && ' *'}
                </Label>
                <Input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="e.g., CPL-12345, AADHAR-XXXX"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              {/* Issue Date */}
              <div>
                <Label className="text-white">Issue Date / जारी तिथि</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              {/* Expiry Date */}
              <div>
                <Label className="text-white">
                  Expiry Date / समाप्ति तिथि 
                  {documentTypes.find(dt => dt.value === documentType)?.requiresExpiry && ' *'}
                </Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
                {expiryDate && (
                  <p className="text-xs mt-1">
                    {(() => {
                      const days = getDaysUntilExpiry(expiryDate);
                      if (days < 0) return <span className="text-red-400">⚠️ Already expired ({Math.abs(days)} days ago)</span>;
                      if (days < 30) return <span className="text-yellow-400">⏰ Expires in {days} days - Alert will be triggered</span>;
                      return <span className="text-green-400">✓ Valid for {days} days</span>;
                    })()}
                  </p>
                )}
              </div>
              
              {/* Issuing Authority */}
              <div>
                <Label className="text-white">Issuing Authority / प्राधिकरण</Label>
                <select
                  value={issuingAuthority}
                  onChange={(e) => setIssuingAuthority(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="DGCA">DGCA (India)</option>
                  <option value="FAA">FAA (USA)</option>
                  <option value="EASA">EASA (Europe)</option>
                  <option value="UIDAI">UIDAI (Aadhaar)</option>
                  <option value="MEA">MEA (Passport)</option>
                  <option value="Hospital">Hospital/Medical</option>
                  <option value="Training_Institute">Training Institute</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              {/* File Upload */}
              <div>
                <Label className="text-white">File / फ़ाइल *</Label>
                <div className="mt-1 border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors relative">
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <File className="h-8 w-8 text-blue-400" />
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
              
              {/* Notes */}
              <div>
                <Label className="text-white">Notes / टिप्पणी</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              {/* Alert Info */}
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <p className="text-orange-400 text-sm font-medium mb-1 flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Auto-Alert System
                </p>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>• Expired documents: Alert sent immediately to Operator &amp; Admin</li>
                  <li>• Expiring within 30 days: Daily reminder alerts</li>
                  <li>• Pilot record updated automatically</li>
                </ul>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button onClick={() => setShowUpload(false)} variant="outline" className="flex-1 border-slate-600">
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={!file || !selectedPilot || uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && bulkUploadPilot && (
        <BulkDocumentUpload
          pilotId={bulkUploadPilot.id}
          pilotName={bulkUploadPilot.name || 'Unknown Pilot'}
          onComplete={handleBulkUploadComplete}
          onClose={() => {
            setShowBulkUpload(false);
            setBulkUploadPilot(null);
          }}
        />
      )}
    </div>
  );
}

export default PilotDocumentUpload;
