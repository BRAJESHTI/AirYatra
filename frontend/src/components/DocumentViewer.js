import React, { useState, useEffect } from 'react';
import { FileText, Image as ImageIcon, Download, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function DocumentViewer({ documents, onDelete, onRefresh }) {
  const [selectedImage, setSelectedImage] = useState(null);

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', text: 'Expired', color: 'red' };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring', text: `Expires in ${daysUntilExpiry} days`, color: 'orange' };
    } else {
      return { status: 'valid', text: 'Valid', color: 'green' };
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await onDelete(documentId);
      toast.success('Document deleted');
      if (onRefresh) onRefresh();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const isImageFile = (fileName) => {
    return /\.(jpg|jpeg|png|webp)$/i.test(fileName);
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <FileText className="h-12 w-12 mx-auto mb-2 text-slate-600" />
        <p>No documents uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="document-viewer">
      {documents.map((doc) => {
        const expiryStatus = getExpiryStatus(doc.expiry_date);
        const isImage = isImageFile(doc.file_name);
        
        return (
          <div key={doc.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700" data-testid={`document-${doc.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3 flex-1">
                {isImage ? (
                  <button
                    onClick={() => setSelectedImage(doc.download_url)}
                    className="flex-shrink-0"
                  >
                    <img
                      src={doc.download_url}
                      alt={doc.file_name}
                      className="h-16 w-16 object-cover rounded cursor-pointer hover:opacity-80"
                    />
                  </button>
                ) : (
                  <FileText className="h-12 w-12 text-orange-500 flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-slate-400 text-sm capitalize">
                      {doc.type?.replace(/_/g, ' ')}
                    </span>
                    {doc.issue_date && (
                      <span className="text-slate-500 text-sm">
                        Issued: {new Date(doc.issue_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  {expiryStatus && (
                    <div className="flex items-center space-x-2 mt-2">
                      {expiryStatus.status === 'expired' ? (
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      ) : expiryStatus.status === 'expiring' ? (
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      )}
                      <span className={`text-sm text-${expiryStatus.color}-400`}>
                        {expiryStatus.text}
                        {doc.expiry_date && ` - ${new Date(doc.expiry_date).toLocaleDateString()}`}
                      </span>
                    </div>
                  )}

                  {doc.ai_verification && (
                    <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/30">
                      <p className="text-blue-300 text-xs">
                        AI Verified: {doc.ai_verification.is_valid ? '✓ Valid' : '✗ Issues Found'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <a href={doc.download_url} download target="_blank" rel="noopener noreferrer">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-orange-400 hover:text-orange-300"
                    data-testid={`download-btn-${doc.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(doc.id)}
                  className="text-red-400 hover:text-red-300"
                  data-testid={`delete-btn-${doc.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;