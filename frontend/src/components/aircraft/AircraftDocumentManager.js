import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, Camera, FileText, Trash2, Eye, Download, X,
  CheckCircle, AlertTriangle, Clock, Loader2, Shield,
  Image, File, Plus, RefreshCw, Calendar, Lock, ZoomIn,
  ChevronLeft, ChevronRight, Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ DOCUMENT CATEGORIES FOR AIRCRAFT ============
const DOCUMENT_CATEGORIES = {
  regulatory: {
    label: 'DGCA & Regulatory / DGCA और नियामक',
    types: [
      { id: 'registration_certificate', label: 'Registration Certificate / पंजीकरण प्रमाणपत्र', required: true, has_expiry: false },
      { id: 'certificate_of_airworthiness', label: 'Certificate of Airworthiness / उड़ान योग्यता', required: true, has_expiry: true },
      { id: 'aoc', label: 'Air Operator Certificate (AOC)', required: false, has_expiry: true },
      { id: 'dgca_permissions', label: 'DGCA Permissions', required: false, has_expiry: true },
      { id: 'noise_certificate', label: 'Noise Certificate', required: false, has_expiry: false },
    ]
  },
  insurance: {
    label: 'Insurance / बीमा',
    types: [
      { id: 'insurance_policy', label: 'Aircraft Insurance Policy / विमान बीमा', required: true, has_expiry: true },
      { id: 'third_party_insurance', label: 'Third Party Insurance / तृतीय पक्ष बीमा', required: false, has_expiry: true },
      { id: 'passenger_liability', label: 'Passenger Liability / यात्री देयता', required: false, has_expiry: true },
      { id: 'hull_insurance', label: 'Hull Insurance / हल बीमा', required: false, has_expiry: true },
    ]
  },
  maintenance: {
    label: 'Maintenance / रखरखाव',
    types: [
      { id: 'maintenance_release', label: 'Maintenance Release / रखरखाव रिलीज़', required: true, has_expiry: true },
      { id: 'tech_log', label: 'Technical Log / तकनीकी लॉग', required: false, has_expiry: false },
      { id: 'component_history', label: 'Component History', required: false, has_expiry: false },
      { id: 'ad_compliance', label: 'Airworthiness Directive Compliance', required: false, has_expiry: false },
    ]
  }
};

// ============ PHOTO CATEGORIES ============
const PHOTO_CATEGORIES = [
  { id: 'front', label: 'Front View / सामने', required: true },
  { id: 'rear', label: 'Rear View / पीछे', required: true },
  { id: 'left', label: 'Left Side / बाईं ओर', required: true },
  { id: 'right', label: 'Right Side / दाईं ओर', required: true },
  { id: 'cockpit', label: 'Cockpit / कॉकपिट', required: true },
  { id: 'cabin', label: 'Cabin / केबिन', required: true },
  { id: 'interior', label: 'Interior / इंटीरियर', required: false },
  { id: 'vip_cabin', label: 'VIP Cabin / VIP केबिन', required: false },
  { id: 'emergency_equipment', label: 'Emergency Equipment / आपातकालीन', required: false },
];

// ============ FILE UPLOAD COMPONENT ============
const FileUploadZone = ({ onFileSelect, accept, label, icon: Icon }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
        dragActive 
          ? 'border-orange-500 bg-orange-500/10' 
          : 'border-slate-600 hover:border-orange-500/50'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        className="hidden"
      />
      <Icon className="h-10 w-10 text-slate-400 mx-auto mb-3" />
      <p className="text-slate-300">{label}</p>
      <p className="text-slate-500 text-sm mt-1">Drag & drop or click to browse</p>
    </div>
  );
};

// ============ DOCUMENT UPLOAD MODAL ============
const DocumentUploadModal = ({ aircraft, category, documentType, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formData, setFormData] = useState({
    reference_number: '',
    issued_by: '',
    issued_date: '',
    expiry_date: '',
    description: ''
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const token = localStorage.getItem('token');
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('owner_id', aircraft.operator_id);
      uploadData.append('owner_type', 'operator');
      uploadData.append('name', `${documentType.label} - ${aircraft.basic_info.registration_number}`);
      uploadData.append('category', category);
      uploadData.append('document_type', documentType.id);
      uploadData.append('description', formData.description || `${documentType.label} for aircraft ${aircraft.basic_info.registration_number}`);
      uploadData.append('reference_number', formData.reference_number);
      uploadData.append('issued_by', formData.issued_by);
      if (formData.issued_date) uploadData.append('issued_date', formData.issued_date);
      if (formData.expiry_date) uploadData.append('expiry_date', formData.expiry_date);
      uploadData.append('tags', `aircraft,${aircraft.id},${documentType.id}`);

      setProgress(30);

      const response = await axios.post(`${API_URL}/api/vault/upload`, uploadData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 70) / progressEvent.total) + 30;
          setProgress(Math.min(percent, 95));
        }
      });

      setProgress(100);

      if (response.data.success) {
        toast.success('Document uploaded successfully!');
        onSuccess && onSuccess(response.data.document);
        onClose();
      } else {
        toast.error(response.data.detail || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Upload Document</CardTitle>
            <CardDescription>{documentType.label}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Aircraft Info */}
          <div className="p-3 bg-slate-800 rounded-lg">
            <p className="text-slate-400 text-sm">Aircraft</p>
            <p className="text-white font-medium">
              {aircraft.basic_info.manufacturer} {aircraft.basic_info.model} ({aircraft.basic_info.registration_number})
            </p>
          </div>

          {/* File Upload */}
          {!file ? (
            <FileUploadZone
              onFileSelect={setFile}
              accept=".pdf,.jpg,.jpeg,.png"
              label="Select PDF or Image"
              icon={FileText}
            />
          ) : (
            <div className="p-3 bg-slate-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-white text-sm truncate max-w-[200px]">{file.name}</p>
                  <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-slate-400 text-sm text-center">{progress}% uploaded</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-400">Reference Number</Label>
              <Input
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="Document number"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-400">Issued By</Label>
              <Input
                value={formData.issued_by}
                onChange={(e) => setFormData({ ...formData, issued_by: e.target.value })}
                placeholder="DGCA, Insurance Co."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            {documentType.has_expiry && (
              <>
                <div>
                  <Label className="text-slate-400">Issue Date</Label>
                  <Input
                    type="date"
                    value={formData.issued_date}
                    onChange={(e) => setFormData({ ...formData, issued_date: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Expiry Date *</Label>
                  <Input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <Label className="text-slate-400">Notes / Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              data-testid="upload-document-submit"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Upload</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============ PHOTO UPLOAD MODAL ============
const PhotoUploadModal = ({ aircraft, photoCategory, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select an image');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const token = localStorage.getItem('token');
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('owner_id', aircraft.operator_id);
      uploadData.append('owner_type', 'operator');
      uploadData.append('name', `${photoCategory.label} - ${aircraft.basic_info.registration_number}`);
      uploadData.append('category', 'aircraft');
      uploadData.append('document_type', `photo_${photoCategory.id}`);
      uploadData.append('description', `${photoCategory.label} photo for aircraft ${aircraft.basic_info.registration_number}`);
      uploadData.append('tags', `aircraft,photo,${aircraft.id},${photoCategory.id}`);

      setProgress(30);

      const response = await axios.post(`${API_URL}/api/vault/upload`, uploadData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 70) / progressEvent.total) + 30;
          setProgress(Math.min(percent, 95));
        }
      });

      setProgress(100);

      if (response.data.success) {
        toast.success('Photo uploaded successfully!');
        onSuccess && onSuccess(response.data.document);
        onClose();
      } else {
        toast.error(response.data.detail || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Upload Photo</CardTitle>
            <CardDescription>{photoCategory.label}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview or Upload Zone */}
          {preview ? (
            <div className="relative">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-2 right-2"
                onClick={() => { setFile(null); setPreview(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <FileUploadZone
              onFileSelect={handleFileSelect}
              accept="image/*"
              label="Select Aircraft Photo"
              icon={Camera}
            />
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-slate-400 text-sm text-center">{progress}% uploaded</p>
            </div>
          )}

          {/* Tips */}
          <div className="p-3 bg-slate-800 rounded-lg">
            <p className="text-slate-400 text-sm">
              <strong className="text-orange-400">Tips:</strong> Use high-quality images. 
              Minimum 1920x1080 recommended. {photoCategory.required && <Badge className="ml-2 bg-orange-500">Required</Badge>}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              data-testid="upload-photo-submit"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Upload Photo</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============ PHOTO GALLERY LIGHTBOX ============
const PhotoGalleryLightbox = ({ photos, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const currentPhoto = photos[currentIndex];
  
  const goNext = () => {
    setLoading(true);
    setImageError(false);
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };
  
  const goPrev = () => {
    setLoading(true);
    setImageError(false);
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length]);

  if (!currentPhoto) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation Arrows */}
      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Image Container */}
      <div 
        className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-orange-400 animate-spin" />
          </div>
        )}
        
        {imageError ? (
          <div className="flex flex-col items-center justify-center text-slate-400 p-8">
            <Image className="h-16 w-16 mb-4" />
            <p>Failed to load image</p>
          </div>
        ) : (
          <img
            src={currentPhoto.file_url || currentPhoto.thumbnail_url}
            alt={currentPhoto.name || 'Aircraft photo'}
            className={`max-w-full max-h-[85vh] object-contain rounded-lg ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setImageError(true); }}
          />
        )}
      </div>

      {/* Photo Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{currentPhoto.name}</p>
            <p className="text-slate-400 text-sm">
              {currentPhoto.document_type?.replace('photo_', '').replace(/_/g, ' ')} • 
              {currentPhoto.file_size ? ` ${(currentPhoto.file_size / 1024).toFixed(1)} KB` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-700 text-white">
              {currentIndex + 1} / {photos.length}
            </Badge>
            {currentPhoto.verification_status === 'verified' && (
              <Badge className="bg-green-500 text-white">
                <CheckCircle className="h-3 w-3 mr-1" /> Verified
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN AIRCRAFT DOCUMENT MANAGER ============
const AircraftDocumentManager = ({ aircraft, onUpdate }) => {
  const [documents, setDocuments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [complianceScore, setComplianceScore] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!aircraft?.operator_id) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch documents tagged with this aircraft
      const docsResponse = await axios.get(
        `${API_URL}/api/vault/documents/${aircraft.operator_id}?search=${aircraft.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (docsResponse.data.success) {
        const allDocs = docsResponse.data.documents || [];
        // Separate photos from documents
        setDocuments(allDocs.filter(d => !d.document_type?.startsWith('photo_')));
        setPhotos(allDocs.filter(d => d.document_type?.startsWith('photo_')));
      }

      // Fetch compliance score
      const scoreResponse = await axios.get(
        `${API_URL}/api/compliance/aircraft/${aircraft.id}/score`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setComplianceScore(scoreResponse.data.compliance_score);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  }, [aircraft]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDocumentDelete = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/vault/document/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const getDocumentForType = (typeId) => {
    return documents.find(d => d.document_type === typeId);
  };

  const getPhotoForCategory = (categoryId) => {
    return photos.find(p => p.document_type === `photo_${categoryId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="aircraft-document-manager">
      {/* Compliance Score */}
      {complianceScore && (
        <Card className={`border-2 ${
          complianceScore.percentage >= 90 ? 'border-green-500 bg-green-500/10' :
          complianceScore.percentage >= 60 ? 'border-yellow-500 bg-yellow-500/10' :
          'border-red-500 bg-red-500/10'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${
                  complianceScore.percentage >= 90 ? 'text-green-400' :
                  complianceScore.percentage >= 60 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {complianceScore.percentage}%
                </div>
                <div>
                  <p className="text-white font-medium">Compliance Score / अनुपालन स्कोर</p>
                  <p className="text-slate-400 text-sm">
                    Grade: <span className="font-bold text-lg">{complianceScore.grade}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {complianceScore.percentage >= 90 ? (
                  <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Excellent</Badge>
                ) : complianceScore.percentage >= 60 ? (
                  <Badge className="bg-yellow-500 text-black"><AlertTriangle className="h-3 w-3 mr-1" /> Needs Attention</Badge>
                ) : (
                  <Badge className="bg-red-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" /> Incomplete</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="documents" className="data-[state=active]:bg-orange-500">
            <FileText className="h-4 w-4 mr-2" /> Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="photos" className="data-[state=active]:bg-orange-500">
            <Camera className="h-4 w-4 mr-2" /> Photos ({photos.length})
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          {Object.entries(DOCUMENT_CATEGORIES).map(([categoryKey, category]) => (
            <Card key={categoryKey} className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg">{category.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {category.types.map((docType) => {
                    const existingDoc = getDocumentForType(docType.id);
                    
                    return (
                      <div 
                        key={docType.id}
                        className={`p-3 rounded-lg flex items-center justify-between ${
                          existingDoc ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className={`h-5 w-5 ${existingDoc ? 'text-green-400' : 'text-slate-500'}`} />
                          <div>
                            <p className="text-white text-sm">{docType.label}</p>
                            {existingDoc && (
                              <p className="text-slate-400 text-xs">
                                Uploaded: {new Date(existingDoc.created_at).toLocaleDateString()}
                                {existingDoc.expiry_date && ` • Expires: ${new Date(existingDoc.expiry_date).toLocaleDateString()}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {docType.required && !existingDoc && (
                            <Badge className="bg-orange-500 text-white text-xs">Required</Badge>
                          )}
                          {existingDoc ? (
                            <>
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
                                onClick={() => handleDocumentDelete(existingDoc.document_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setUploadModal({ category: categoryKey, documentType: docType })}
                              className="bg-orange-500 hover:bg-orange-600"
                            >
                              <Upload className="h-4 w-4 mr-1" /> Upload
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Photos Tab */}
        <TabsContent value="photos" className="space-y-4">
          {/* Photo Gallery Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PHOTO_CATEGORIES.map((photoCategory, catIndex) => {
              const existingPhoto = getPhotoForCategory(photoCategory.id);
              const photoIndex = photos.findIndex(p => p.document_type === `photo_${photoCategory.id}`);
              
              return (
                <Card 
                  key={photoCategory.id} 
                  className={`bg-slate-900 border-slate-700 overflow-hidden group ${
                    existingPhoto ? 'border-green-500/50' : ''
                  }`}
                >
                  {existingPhoto ? (
                    <div 
                      className="relative h-36 bg-slate-800 cursor-pointer overflow-hidden"
                      onClick={() => setLightboxIndex(photoIndex >= 0 ? photoIndex : 0)}
                    >
                      {/* Show actual image thumbnail */}
                      {existingPhoto.thumbnail_url || existingPhoto.file_url ? (
                        <img
                          src={existingPhoto.thumbnail_url || existingPhoto.file_url}
                          alt={photoCategory.label}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      {/* Fallback icon */}
                      <div className="absolute inset-0 items-center justify-center hidden">
                        <Image className="h-12 w-12 text-green-400" />
                      </div>
                      
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30">
                          <ZoomIn className="h-4 w-4 mr-1" /> Preview
                        </Button>
                      </div>
                      
                      {/* Badges */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge className="bg-green-500 text-white text-xs">Uploaded</Badge>
                        {existingPhoto.verification_status === 'verified' && (
                          <Badge className="bg-blue-500 text-white text-xs">
                            <CheckCircle className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>

                      {/* Storage indicator */}
                      {existingPhoto.storage_type === 'object_storage' && (
                        <div className="absolute bottom-2 left-2">
                          <Badge className="bg-purple-500/80 text-white text-xs">
                            Cloud Storage
                          </Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      className="h-36 bg-slate-800 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors border-2 border-dashed border-slate-600 hover:border-orange-500/50"
                      onClick={() => setPhotoModal(photoCategory)}
                    >
                      <Camera className="h-10 w-10 text-slate-500 mb-2" />
                      <p className="text-slate-400 text-sm">Upload {photoCategory.label.split('/')[0]}</p>
                    </div>
                  )}
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{photoCategory.label.split('/')[0]}</p>
                        <p className="text-slate-500 text-xs">{photoCategory.label.split('/')[1] || ''}</p>
                        {photoCategory.required && !existingPhoto && (
                          <Badge className="bg-orange-500 text-white text-xs mt-1">Required</Badge>
                        )}
                      </div>
                      {existingPhoto && (
                        <div className="flex gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-slate-400 hover:text-white h-8 w-8"
                            onClick={() => setLightboxIndex(photoIndex >= 0 ? photoIndex : 0)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-red-400 hover:text-red-300 h-8 w-8"
                            onClick={() => handleDocumentDelete(existingPhoto.document_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Upload Stats */}
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <Camera className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Photo Upload Progress</p>
                    <p className="text-slate-400 text-sm">
                      {photos.length} / {PHOTO_CATEGORIES.length} photos uploaded
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={(photos.length / PHOTO_CATEGORIES.length) * 100} 
                    className="w-32 h-2"
                  />
                  <span className="text-slate-400 text-sm">
                    {Math.round((photos.length / PHOTO_CATEGORIES.length) * 100)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Modals */}
      {uploadModal && (
        <DocumentUploadModal
          aircraft={aircraft}
          category={uploadModal.category}
          documentType={uploadModal.documentType}
          onClose={() => setUploadModal(null)}
          onSuccess={() => fetchDocuments()}
        />
      )}

      {photoModal && (
        <PhotoUploadModal
          aircraft={aircraft}
          photoCategory={photoModal}
          onClose={() => setPhotoModal(null)}
          onSuccess={() => fetchDocuments()}
        />
      )}

      {/* Photo Gallery Lightbox */}
      {lightboxIndex !== null && photos.length > 0 && (
        <PhotoGalleryLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};

export default AircraftDocumentManager;
