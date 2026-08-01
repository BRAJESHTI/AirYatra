import React, { useState, useCallback } from 'react';
import { 
  Upload, X, File, CheckCircle, AlertCircle, Loader2, 
  FileText, Trash2, FolderUp, Image, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// File type icons
const getFileIcon = (type) => {
  if (type?.includes('image')) return Image;
  if (type?.includes('pdf')) return FileText;
  if (type?.includes('spreadsheet') || type?.includes('excel')) return FileSpreadsheet;
  return File;
};

// Format file size
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function BulkDocumentUpload({ pilotId, pilotName, onComplete, onClose }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  // Handle file input change
  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
    e.target.value = ''; // Reset input
  };

  // Add files to queue
  const addFiles = (newFiles) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    const validFiles = newFiles.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Only PDF and images allowed`);
        return false;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large (max 5MB)`);
        return false;
      }
      // Check if already added
      if (files.some(f => f.file.name === file.name && f.file.size === file.size)) {
        toast.warning(`${file.name}: Already added`);
        return false;
      }
      return true;
    });

    const fileEntries = validFiles.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending', // pending, uploading, success, error
      progress: 0,
      documentType: 'other',
      error: null
    }));

    setFiles(prev => [...prev, ...fileEntries]);
  };

  // Remove file from queue
  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Update file document type
  const updateFileType = (id, docType) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, documentType: docType } : f
    ));
  };

  // Upload single file
  const uploadFile = async (fileEntry) => {
    const formData = new FormData();
    formData.append('file', fileEntry.file);
    formData.append('pilot_id', pilotId);
    formData.append('document_type', fileEntry.documentType);
    formData.append('document_number', '');
    formData.append('expiry_date', '');
    formData.append('issue_date', '');
    formData.append('issuing_authority', 'DGCA');
    formData.append('notes', `Bulk uploaded: ${fileEntry.name}`);

    const token = localStorage.getItem('token');

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setFiles(prev => prev.map(f => 
            f.id === fileEntry.id ? { ...f, progress, status: 'uploading' } : f
          ));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setFiles(prev => prev.map(f => 
            f.id === fileEntry.id ? { ...f, progress: 100, status: 'success' } : f
          ));
          resolve(JSON.parse(xhr.responseText));
        } else {
          const error = xhr.responseText ? JSON.parse(xhr.responseText).detail : 'Upload failed';
          setFiles(prev => prev.map(f => 
            f.id === fileEntry.id ? { ...f, status: 'error', error } : f
          ));
          reject(new Error(error));
        }
      });

      xhr.addEventListener('error', () => {
        setFiles(prev => prev.map(f => 
          f.id === fileEntry.id ? { ...f, status: 'error', error: 'Network error' } : f
        ));
        reject(new Error('Network error'));
      });

      xhr.open('POST', `${API_URL}/api/maintenance/pilot-documents/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  };

  // Upload all files
  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    
    if (pendingFiles.length === 0) {
      toast.warning('No files to upload');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const fileEntry of pendingFiles) {
      try {
        await uploadFile(fileEntry);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Failed to upload ${fileEntry.name}:`, error);
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} file(s) failed to upload`);
    }

    if (successCount > 0 && onComplete) {
      onComplete();
    }
  };

  // Calculate stats
  const stats = {
    total: files.length,
    pending: files.filter(f => f.status === 'pending').length,
    uploading: files.filter(f => f.status === 'uploading').length,
    success: files.filter(f => f.status === 'success').length,
    error: files.filter(f => f.status === 'error').length
  };

  const overallProgress = files.length > 0 
    ? Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length)
    : 0;

  const documentTypes = [
    { value: 'license', label: 'License' },
    { value: 'medical', label: 'Medical' },
    { value: 'type_rating', label: 'Type Rating' },
    { value: 'passport', label: 'Passport' },
    { value: 'id_proof', label: 'ID Proof' },
    { value: 'training_certificate', label: 'Training' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-3xl border border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FolderUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Bulk Document Upload</h3>
              <p className="text-sm text-slate-400">Upload multiple documents for {pilotName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div 
          className={`mx-6 mt-6 border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive 
              ? 'border-blue-500 bg-blue-500/10' 
              : 'border-slate-600 hover:border-slate-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className={`h-12 w-12 mx-auto mb-4 ${dragActive ? 'text-blue-400' : 'text-slate-500'}`} />
          <p className="text-white font-medium mb-2">
            {dragActive ? 'Drop files here...' : 'Drag & drop files here'}
          </p>
          <p className="text-slate-400 text-sm mb-4">or click to browse</p>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileInput}
            className="hidden"
            id="bulk-file-input"
          />
          <label htmlFor="bulk-file-input">
            <Button variant="outline" className="border-slate-600 cursor-pointer" asChild>
              <span>Select Files</span>
            </Button>
          </label>
          <p className="text-slate-500 text-xs mt-3">PDF, JPG, PNG • Max 5MB each</p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Progress Summary */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-400">{stats.total} file(s)</span>
                {stats.success > 0 && (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> {stats.success} uploaded
                  </span>
                )}
                {stats.error > 0 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {stats.error} failed
                  </span>
                )}
              </div>
              {uploading && (
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-400">{overallProgress}%</span>
                </div>
              )}
            </div>

            {/* File Items */}
            <div className="space-y-2">
              {files.map((fileEntry) => {
                const FileIcon = getFileIcon(fileEntry.type);
                return (
                  <div 
                    key={fileEntry.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      fileEntry.status === 'success' ? 'bg-green-500/10 border-green-500/30' :
                      fileEntry.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                      fileEntry.status === 'uploading' ? 'bg-blue-500/10 border-blue-500/30' :
                      'bg-slate-800/50 border-slate-700'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${
                      fileEntry.status === 'success' ? 'bg-green-500/20' :
                      fileEntry.status === 'error' ? 'bg-red-500/20' :
                      'bg-slate-700'
                    }`}>
                      {fileEntry.status === 'uploading' ? (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      ) : fileEntry.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : fileEntry.status === 'error' ? (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      ) : (
                        <FileIcon className="h-5 w-5 text-slate-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{fileEntry.name}</p>
                      <p className="text-slate-400 text-xs">
                        {formatSize(fileEntry.size)}
                        {fileEntry.error && (
                          <span className="text-red-400 ml-2">• {fileEntry.error}</span>
                        )}
                      </p>
                      {fileEntry.status === 'uploading' && (
                        <div className="w-full h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-200"
                            style={{ width: `${fileEntry.progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Document Type */}
                    {fileEntry.status === 'pending' && (
                      <select
                        value={fileEntry.documentType}
                        onChange={(e) => updateFileType(fileEntry.id, e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                      >
                        {documentTypes.map(dt => (
                          <option key={dt.value} value={dt.value}>{dt.label}</option>
                        ))}
                      </select>
                    )}

                    {/* Actions */}
                    {(fileEntry.status === 'pending' || fileEntry.status === 'error') && !uploading && (
                      <button
                        onClick={() => removeFile(fileEntry.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    {/* Status Badge */}
                    {fileEntry.status === 'success' && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                        Uploaded
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30 flex items-center justify-between">
          <Button variant="outline" onClick={onClose} className="border-slate-600">
            {stats.success > 0 && stats.pending === 0 ? 'Done' : 'Cancel'}
          </Button>
          <div className="flex items-center gap-3">
            {files.length > 0 && stats.pending > 0 && (
              <button
                onClick={() => setFiles([])}
                className="text-sm text-slate-400 hover:text-white"
              >
                Clear All
              </button>
            )}
            <Button
              onClick={uploadAll}
              disabled={stats.pending === 0 || uploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {stats.pending} File{stats.pending !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkDocumentUpload;
