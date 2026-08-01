import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Download, Trash2, CheckCircle, AlertTriangle,
  Clock, Calendar, RefreshCw, User, Eye, X, Loader2, File
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function PilotDocumentUpload({ pilotId = null }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPilot, setSelectedPilot] = useState(pilotId);
  const [pilots, setPilots] = useState([]);
  
  // Upload form state
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('license');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

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
      
      // Auto-select first pilot if not provided
      if (!pilotId && json.pilots?.length > 0) {
        setSelectedPilot(json.pilots[0].id);
      }
    } catch (error) {
      console.error('Failed to load pilots');
    }
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
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error('Only PDF and image files allowed');
        return;
      }
      
      // Validate file size (5MB max)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File too large (max 5MB)');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedPilot) {
      toast.error('Please select a file');
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
      
      // Show verification status
      if (result.auto_verification) {
        if (result.auto_verification.status === 'expired') {
          toast.warning('Document has expired! / दस्तावेज़ समाप्त हो गया है!');
        } else if (result.auto_verification.status === 'expiring_soon') {
          toast.warning('Document expiring soon! / दस्तावेज़ जल्द समाप्त होगा!');
        }
      }
      
      // Reset form
      setShowUpload(false);
      setFile(null);
      setDocumentNumber('');
      setExpiryDate('');
      setNotes('');
      loadDocuments();
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
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'valid':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
          <CheckCircle className="h-3 w-3" /> Valid
        </span>;
      case 'expired':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Expired
        </span>;
      case 'expiring_soon':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" /> Expiring Soon
        </span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" /> Pending
        </span>;
    }
  };

  const getDocumentIcon = (type) => {
    return <FileText className="h-5 w-5 text-blue-400" />;
  };

  const selectedPilotName = pilots.find(p => p.id === selectedPilot)?.name || 'Select Pilot';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-400" />
            Pilot Documents / पायलट दस्तावेज़
          </h2>
          <p className="text-slate-400 mt-1">Upload and manage pilot licenses, medicals, and certificates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowUpload(true)} className="bg-blue-600 hover:bg-blue-700">
            <Upload className="h-4 w-4 mr-2" /> Upload Document
          </Button>
          <Button onClick={loadDocuments} variant="outline" className="border-slate-600">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pilot Selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-4 flex-wrap">
          <Label className="text-white">Select Pilot / पायलट चुनें:</Label>
          <select
            value={selectedPilot || ''}
            onChange={(e) => setSelectedPilot(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white min-w-[200px]"
          >
            <option value="">-- Select --</option>
            {pilots.map(pilot => (
              <option key={pilot.id} value={pilot.id}>
                {pilot.name} ({pilot.license_number || 'N/A'})
              </option>
            ))}
          </select>
          
          {data?.pilot && (
            <div className="flex items-center gap-2 ml-auto">
              <User className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">{data.pilot.name}</p>
                <p className="text-slate-500 text-xs">License: {data.pilot.license_number}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Type Stats */}
      {data?.documents?.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {['license', 'medical', 'type_rating', 'other'].map(type => {
            const docs = data.documents.filter(d => d.document_type === type);
            const validDocs = docs.filter(d => d.verification_status === 'valid');
            
            return (
              <div key={type} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  {getDocumentIcon(type)}
                  <span className="text-white font-medium capitalize">{type.replace('_', ' ')}</span>
                </div>
                <p className="text-2xl font-bold text-white">{docs.length}</p>
                <p className={`text-sm ${validDocs.length === docs.length ? 'text-green-400' : 'text-yellow-400'}`}>
                  {validDocs.length} valid
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : !selectedPilot ? (
        <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
          <User className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Select a pilot to view documents</p>
        </div>
      ) : data?.documents?.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
          <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">No documents uploaded yet</p>
          <p className="text-slate-500 mt-2">Upload licenses, medicals, and certificates</p>
          <Button onClick={() => setShowUpload(true)} className="mt-4 bg-blue-600 hover:bg-blue-700">
            <Upload className="h-4 w-4 mr-2" /> Upload First Document
          </Button>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-4 text-slate-400 font-medium">Document</th>
                <th className="text-left p-4 text-slate-400 font-medium">Type</th>
                <th className="text-left p-4 text-slate-400 font-medium">Number</th>
                <th className="text-left p-4 text-slate-400 font-medium">Expiry</th>
                <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                <th className="text-left p-4 text-slate-400 font-medium">Uploaded</th>
                <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <File className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{doc.file_name}</p>
                        <p className="text-slate-500 text-xs">
                          {(doc.file_size / 1024).toFixed(1)} KB • {doc.file_type?.split('/')[1]?.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-white capitalize">{doc.document_type?.replace('_', ' ')}</span>
                  </td>
                  <td className="p-4 text-slate-400">{doc.document_number || '-'}</td>
                  <td className="p-4">
                    {doc.expiry_date ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        <span className={`${
                          doc.verification_status === 'expired' ? 'text-red-400' :
                          doc.verification_status === 'expiring_soon' ? 'text-yellow-400' :
                          'text-slate-400'
                        }`}>
                          {new Date(doc.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {getStatusBadge(doc.verification_status)}
                  </td>
                  <td className="p-4 text-slate-400 text-sm">
                    {new Date(doc.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => downloadDocument(doc.id, doc.file_name)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="h-4 w-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-400" />
                Upload Document / दस्तावेज़ अपलोड करें
              </h3>
              <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Pilot Selection */}
              <div>
                <Label className="text-white">Pilot *</Label>
                <select
                  value={selectedPilot || ''}
                  onChange={(e) => setSelectedPilot(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">-- Select Pilot --</option>
                  {pilots.map(pilot => (
                    <option key={pilot.id} value={pilot.id}>{pilot.name}</option>
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
                  {data?.document_types?.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  )) || (
                    <>
                      <option value="license">Pilot License / पायलट लाइसेंस</option>
                      <option value="medical">Medical Certificate / चिकित्सा प्रमाणपत्र</option>
                      <option value="type_rating">Type Rating / टाइप रेटिंग</option>
                      <option value="other">Other / अन्य</option>
                    </>
                  )}
                </select>
              </div>
              
              {/* File Upload */}
              <div>
                <Label className="text-white">File / फ़ाइल *</Label>
                <div className="mt-1 border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-blue-500/50 transition-colors">
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
                    style={{ position: 'relative' }}
                  />
                </div>
              </div>
              
              {/* Document Number */}
              <div>
                <Label className="text-white">Document Number / नंबर</Label>
                <Input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="e.g., CPL-12345"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              {/* Expiry Date */}
              <div>
                <Label className="text-white">Expiry Date / समाप्ति तिथि</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
                <p className="text-slate-500 text-xs mt-1">Auto-verification will check expiry status</p>
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
              
              {/* Auto-verification Info */}
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <p className="text-blue-400 text-sm font-medium mb-1">Auto-Verification / स्वचालित सत्यापन</p>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>• Expiry date will be checked automatically</li>
                  <li>• Document status: Valid / Expiring Soon / Expired</li>
                  <li>• Pilot record will be updated with new expiry dates</li>
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
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PilotDocumentUpload;
