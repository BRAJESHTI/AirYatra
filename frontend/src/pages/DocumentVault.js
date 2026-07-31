import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  FolderOpen, FileText, Upload, Search, Filter, Grid, List,
  Download, Share2, Trash2, Eye, Clock, AlertTriangle, 
  CheckCircle, Lock, Plus, MoreVertical, ChevronRight, X,
  File, FileImage, FileType, Shield, Calendar, Tag
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DocumentVault = ({ user, ownerType = 'user' }) => {
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const fileInputRef = useRef(null);

  const [uploadForm, setUploadForm] = useState({
    name: '', category: 'personal', document_type: 'other',
    description: '', expiry_date: '', reference_number: '',
    issued_by: '', tags: '', is_sensitive: false
  });

  const categories = [
    { value: 'dgca', label: 'DGCA', icon: Shield },
    { value: 'insurance', label: 'Insurance', icon: Shield },
    { value: 'aircraft', label: 'Aircraft', icon: FileText },
    { value: 'pilot', label: 'Pilot', icon: FileText },
    { value: 'operator', label: 'Operator', icon: FileText },
    { value: 'corporate', label: 'Corporate', icon: FileText },
    { value: 'personal', label: 'Personal', icon: FileText },
    { value: 'contract', label: 'Contract', icon: FileText },
    { value: 'invoice', label: 'Invoice', icon: FileText },
    { value: 'other', label: 'Other', icon: File }
  ];

  const documentTypes = {
    dgca: ['aoc', 'ppc', 'medical', 'license', 'type_rating'],
    insurance: ['hull_insurance', 'liability_insurance', 'passenger_insurance'],
    aircraft: ['registration', 'airworthiness', 'maintenance_record'],
    corporate: ['gst_certificate', 'pan_card', 'company_registration'],
    personal: ['aadhaar', 'passport', 'voter_id', 'driving_license'],
    contract: ['service_agreement', 'nda', 'booking_contract'],
    other: ['other']
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user, selectedCategory, selectedStatus]);

  const fetchData = async () => {
    setLoading(true);
    const ownerId = user.id;
    
    try {
      let docsUrl = `${API_URL}/api/vault/documents/${ownerId}?`;
      if (selectedCategory) docsUrl += `category=${selectedCategory}&`;
      if (selectedStatus) docsUrl += `status=${selectedStatus}&`;
      if (searchQuery) docsUrl += `search=${searchQuery}&`;

      const [docsRes, foldersRes, statsRes, expiringRes] = await Promise.all([
        fetch(docsUrl),
        fetch(`${API_URL}/api/vault/folders/${ownerId}`),
        fetch(`${API_URL}/api/vault/statistics/${ownerId}`),
        fetch(`${API_URL}/api/vault/expiring/${ownerId}?days=30`)
      ]);

      const [docsData, foldersData, statsData, expiringData] = await Promise.all([
        docsRes.json(), foldersRes.json(), statsRes.json(), expiringRes.json()
      ]);

      if (docsData.success) setDocuments(docsData.documents);
      if (foldersData.success) setFolders(foldersData.folders);
      if (statsData.success) setStatistics(statsData.statistics);
      if (expiringData.success) setExpiringDocs(expiringData.expiring_documents);
    } catch (error) {
      console.error('Error fetching vault data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadForm({ ...uploadForm, name: file.name.split('.')[0] });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files[0];
    if (!file) {
      alert('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('owner_id', user.id);
    formData.append('owner_type', ownerType);
    formData.append('name', uploadForm.name);
    formData.append('category', uploadForm.category);
    formData.append('document_type', uploadForm.document_type);
    formData.append('description', uploadForm.description);
    formData.append('reference_number', uploadForm.reference_number);
    formData.append('issued_by', uploadForm.issued_by);
    formData.append('tags', uploadForm.tags);
    formData.append('is_sensitive', uploadForm.is_sensitive);
    if (uploadForm.expiry_date) {
      formData.append('expiry_date', uploadForm.expiry_date);
    }

    setUploadProgress(10);

    try {
      const response = await fetch(`${API_URL}/api/vault/upload`, {
        method: 'POST',
        body: formData
      });

      setUploadProgress(80);
      const data = await response.json();
      
      if (data.success) {
        setUploadProgress(100);
        alert('Document uploaded successfully!');
        setShowUpload(false);
        setUploadForm({
          name: '', category: 'personal', document_type: 'other',
          description: '', expiry_date: '', reference_number: '',
          issued_by: '', tags: '', is_sensitive: false
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchData();
      } else {
        alert(data.detail || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploadProgress(0);
    }
  };

  const handleDelete = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${API_URL}/api/vault/document/${documentId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        alert('Document deleted');
        fetchData();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'verified': return 'bg-blue-500';
      case 'expiring_soon': return 'bg-amber-500';
      case 'expired': return 'bg-red-500';
      case 'pending_verification': return 'bg-purple-500';
      default: return 'bg-slate-500';
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return <FileType className="h-8 w-8 text-red-400" />;
    if (fileType?.includes('image')) return <FileImage className="h-8 w-8 text-blue-400" />;
    return <FileText className="h-8 w-8 text-slate-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Lock className="h-8 w-8 text-orange-500" />
              Smart Document Vault
            </h1>
            <p className="text-slate-400">Secure, encrypted storage for all your important documents</p>
          </div>
          <Button 
            data-testid="upload-document-btn"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setShowUpload(true)}
          >
            <Upload className="h-4 w-4 mr-2" /> Upload Document
          </Button>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <FileText className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{statistics.total_documents}</p>
                <p className="text-xs text-slate-400">Total Documents</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <FolderOpen className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{statistics.total_size_mb} MB</p>
                <p className="text-xs text-slate-400">Storage Used</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{statistics.documents_by_status?.active || 0}</p>
                <p className="text-xs text-slate-400">Active</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{statistics.expiring_soon_count}</p>
                <p className="text-xs text-slate-400">Expiring Soon</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{statistics.expired_count}</p>
                <p className="text-xs text-slate-400">Expired</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <Share2 className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{statistics.documents_by_status?.shared || 0}</p>
                <p className="text-xs text-slate-400">Shared</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Expiring Soon Alert */}
        {expiringDocs.length > 0 && (
          <Card className="bg-amber-500/10 border-amber-500/50 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <div className="flex-1">
                  <p className="text-amber-400 font-medium">{expiringDocs.length} documents expiring within 30 days</p>
                  <p className="text-amber-300/70 text-sm">
                    {expiringDocs.slice(0, 3).map(d => d.name).join(', ')}
                    {expiringDocs.length > 3 && ` and ${expiringDocs.length - 3} more`}
                  </p>
                </div>
                <Button variant="outline" className="border-amber-500 text-amber-400 hover:bg-amber-500/20">
                  View All
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters & Search */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              data-testid="search-documents"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchData()}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md min-w-[150px]"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 px-3 bg-slate-800 border border-slate-700 text-white rounded-md min-w-[150px]"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
            <option value="verified">Verified</option>
          </select>
          <div className="flex border border-slate-700 rounded-md overflow-hidden">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className={viewMode === 'grid' ? 'bg-orange-500' : 'text-slate-400'}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className={viewMode === 'list' ? 'bg-orange-500' : 'text-slate-400'}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white">Upload Document</CardTitle>
                  <CardDescription>Add a new document to your vault</CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setShowUpload(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpload} className="space-y-4">
                  {/* File Input */}
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-orange-500 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                    />
                    <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-300">Click to select a file or drag and drop</p>
                    <p className="text-slate-500 text-sm mt-1">PDF, Images, Word, Excel up to 10MB</p>
                  </div>

                  {uploadProgress > 0 && (
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-slate-400">Document Name *</label>
                      <Input 
                        value={uploadForm.name}
                        onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Category *</label>
                      <select 
                        value={uploadForm.category}
                        onChange={(e) => setUploadForm({...uploadForm, category: e.target.value, document_type: 'other'})}
                        className="w-full h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Document Type *</label>
                      <select 
                        value={uploadForm.document_type}
                        onChange={(e) => setUploadForm({...uploadForm, document_type: e.target.value})}
                        className="w-full h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
                      >
                        {(documentTypes[uploadForm.category] || ['other']).map(type => (
                          <option key={type} value={type}>
                            {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Expiry Date</label>
                      <Input 
                        type="date"
                        value={uploadForm.expiry_date}
                        onChange={(e) => setUploadForm({...uploadForm, expiry_date: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Reference Number</label>
                      <Input 
                        value={uploadForm.reference_number}
                        onChange={(e) => setUploadForm({...uploadForm, reference_number: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Issued By</label>
                      <Input 
                        value={uploadForm.issued_by}
                        onChange={(e) => setUploadForm({...uploadForm, issued_by: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">Description</label>
                    <Input 
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">Tags (comma separated)</label>
                    <Input 
                      value={uploadForm.tags}
                      onChange={(e) => setUploadForm({...uploadForm, tags: e.target.value})}
                      placeholder="important, 2024, renewal"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      checked={uploadForm.is_sensitive}
                      onChange={(e) => setUploadForm({...uploadForm, is_sensitive: e.target.checked})}
                      className="rounded"
                    />
                    <label className="text-slate-300">Mark as sensitive document</label>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowUpload(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="submit-upload-btn" className="flex-1 bg-orange-500 hover:bg-orange-600">
                      Upload Document
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Documents Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <Card 
                key={doc.document_id} 
                data-testid={`document-${doc.document_id}`}
                className="bg-slate-800/50 border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer group"
                onClick={() => setSelectedDoc(doc)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    {getFileIcon(doc.file_type)}
                    <Badge className={getStatusColor(doc.status)}>
                      {doc.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h3 className="text-white font-medium truncate mb-1">{doc.name}</h3>
                  <p className="text-slate-400 text-sm truncate mb-3">{doc.category}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{formatFileSize(doc.file_size)}</span>
                    {doc.expiry_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(doc.expiry_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="flex-1 text-slate-400">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 text-slate-400">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 text-slate-400">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="flex-1 text-red-400"
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.document_id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left text-slate-400 p-4 font-medium">Document</th>
                    <th className="text-left text-slate-400 p-4 font-medium">Category</th>
                    <th className="text-left text-slate-400 p-4 font-medium">Status</th>
                    <th className="text-left text-slate-400 p-4 font-medium">Size</th>
                    <th className="text-left text-slate-400 p-4 font-medium">Expiry</th>
                    <th className="text-left text-slate-400 p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.document_id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.file_type)}
                          <div>
                            <p className="text-white font-medium">{doc.name}</p>
                            <p className="text-slate-400 text-sm">{doc.reference_number || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300 capitalize">{doc.category}</td>
                      <td className="p-4">
                        <Badge className={getStatusColor(doc.status)}>
                          {doc.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-300">{formatFileSize(doc.file_size)}</td>
                      <td className="p-4 text-slate-300">
                        {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="text-slate-400">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-slate-400">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-400"
                            onClick={() => handleDelete(doc.document_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {documents.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-12 text-center">
              <FolderOpen className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Documents Yet</h3>
              <p className="text-slate-400 mb-6">Upload your first document to get started</p>
              <Button 
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => setShowUpload(true)}
              >
                <Upload className="h-4 w-4 mr-2" /> Upload Document
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DocumentVault;
