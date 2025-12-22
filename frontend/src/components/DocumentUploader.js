import React, { useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

function DocumentUploader({ 
  onUploadComplete, 
  documentType, 
  entityId, 
  entityType = 'pilot', // 'pilot' or 'aircraft'
  apiService,
  label,
  accept = '.pdf,.jpg,.jpeg,.png',
  showExpiryDate = false,
  showIssueDate = false
}) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [issueDate, setIssueDate] = useState('');

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Get presigned URL
      const uploadData = {
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        document_type: documentType,
      };

      if (entityType === 'pilot') {
        uploadData.pilot_id = entityId;
      } else {
        uploadData.aircraft_id = entityId;
      }

      if (showExpiryDate && expiryDate) {
        uploadData.expiry_date = new Date(expiryDate).toISOString();
      }
      if (showIssueDate && issueDate) {
        uploadData.issue_date = new Date(issueDate).toISOString();
      }

      const urlResponse = await apiService.generateUploadUrl(uploadData);
      const { upload_url, document_id } = urlResponse.data;

      // Step 2: Upload to S3
      await axios.put(upload_url, file, {
        headers: {
          'Content-Type': file.type,
        },
      });

      // Step 3: Confirm upload
      await apiService.confirmUpload(document_id);

      toast.success('Document uploaded successfully!');
      setFile(null);
      setPreview(null);
      setExpiryDate('');
      setIssueDate('');
      
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
  };

  return (
    <div className="space-y-4" data-testid="document-uploader">
      <Label className="text-white">{label}</Label>
      
      {!file ? (
        <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-orange-500 transition-colors">
          <input
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            id={`file-input-${documentType}`}
            data-testid="file-input"
          />
          <label htmlFor={`file-input-${documentType}`} className="cursor-pointer">
            <Upload className="h-12 w-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 mb-1">Click to upload or drag and drop</p>
            <p className="text-slate-500 text-sm">{accept.toUpperCase()} files allowed</p>
          </label>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              {preview ? (
                <img src={preview} alt="Preview" className="h-16 w-16 object-cover rounded" />
              ) : (
                <FileText className="h-12 w-12 text-orange-500" />
              )}
              <div>
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFile}
              className="text-slate-400 hover:text-white"
              data-testid="clear-file-btn"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {showIssueDate && (
            <div className="mb-3">
              <Label className="text-white text-sm">Issue Date</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white mt-1"
                data-testid="issue-date-input"
              />
            </div>
          )}

          {showExpiryDate && (
            <div className="mb-3">
              <Label className="text-white text-sm">Expiry Date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white mt-1"
                data-testid="expiry-date-input"
              />
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-orange-500 hover:bg-orange-600"
            data-testid="upload-btn"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default DocumentUploader;