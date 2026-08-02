import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, RotateCw, Loader2, FileText, AlertTriangle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * PDF Document Viewer Component
 * Features:
 * - Inline preview using iframe/object
 * - Zoom controls
 * - Page navigation (for supported viewers)
 * - Download button
 * - Fullscreen mode
 */
const PDFDocumentViewer = ({ 
  document, 
  onClose,
  showDownload = true,
  showFullscreen = true 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    if (document) {
      // Construct the PDF URL
      const token = localStorage.getItem('token');
      const fileId = document.file_id;
      
      // Use the file endpoint with auth
      const url = `${API_URL}/api/vault/file/${fileId}`;
      setPdfUrl(url);
      setLoading(false);
    }
  }, [document]);

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/vault/file/${document.file_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name || 'document.pdf';
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download document');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleZoomIn = () => setZoom(Math.min(zoom + 25, 200));
  const handleZoomOut = () => setZoom(Math.max(zoom - 25, 50));
  const resetZoom = () => setZoom(100);

  if (!document) return null;

  const containerClass = isFullscreen 
    ? "fixed inset-0 z-[100] bg-black" 
    : "fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4";

  const viewerClass = isFullscreen
    ? "w-full h-full"
    : "w-full max-w-5xl h-[85vh] bg-slate-900 rounded-lg overflow-hidden flex flex-col";

  return (
    <div className={containerClass} onClick={!isFullscreen ? onClose : undefined}>
      <div className={viewerClass} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-orange-400" />
            <div>
              <h3 className="text-white font-medium truncate max-w-[300px]">
                {document.name || document.file_name}
              </h3>
              <p className="text-slate-400 text-xs">
                {document.category} • {(document.file_size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-700 rounded-lg px-2 py-1">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7 text-slate-300 hover:text-white"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-slate-300 text-sm w-12 text-center">{zoom}%</span>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7 text-slate-300 hover:text-white"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-7 w-7 text-slate-300 hover:text-white"
                onClick={resetZoom}
                title="Reset Zoom"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Download */}
            {showDownload && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-slate-300"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
            )}

            {/* Fullscreen */}
            {showFullscreen && (
              <Button 
                size="icon" 
                variant="ghost" 
                className="text-slate-300 hover:text-white"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
            )}

            {/* Close */}
            <Button 
              size="icon" 
              variant="ghost" 
              className="text-slate-300 hover:text-white"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-slate-900 overflow-auto" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-12 w-12 text-orange-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <AlertTriangle className="h-16 w-16 mb-4 text-red-400" />
              <p className="text-lg">{error}</p>
              <Button className="mt-4" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" /> Download Instead
              </Button>
            </div>
          ) : (
            <PDFEmbed 
              url={pdfUrl}
              fileId={document.file_id}
              onError={() => setError('Unable to preview PDF. Try downloading.')}
              onLoad={() => setLoading(false)}
            />
          )}
        </div>

        {/* Footer with document info */}
        <div className="flex items-center justify-between p-2 bg-slate-800 border-t border-slate-700 text-xs">
          <div className="flex items-center gap-4 text-slate-400">
            {document.reference_number && (
              <span>Ref: {document.reference_number}</span>
            )}
            {document.issued_by && (
              <span>Issued by: {document.issued_by}</span>
            )}
            {document.expiry_date && (
              <span className={new Date(document.expiry_date) < new Date() ? 'text-red-400' : ''}>
                Expires: {new Date(document.expiry_date).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {document.verification_status === 'verified' && (
              <Badge className="bg-green-500 text-white text-xs">Verified</Badge>
            )}
            {document.verification_status === 'pending' && (
              <Badge className="bg-yellow-500 text-black text-xs">Pending</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PDF Embed Component - handles the actual PDF rendering
 * Uses iframe with PDF.js fallback for better browser support
 */
const PDFEmbed = ({ url, fileId, onError, onLoad }) => {
  const [useFallback, setUseFallback] = useState(false);
  const token = localStorage.getItem('token');
  
  // For secure PDFs, we need to fetch with auth and create blob URL
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    const fetchPDF = async () => {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch PDF');
        }
        
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        onLoad && onLoad();
      } catch (err) {
        console.error('PDF fetch error:', err);
        onError && onError();
      }
    };

    fetchPDF();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url, token]);

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 text-orange-400 animate-spin" />
      </div>
    );
  }

  // Try iframe first (works in most modern browsers)
  if (!useFallback) {
    return (
      <iframe
        src={blobUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
        onError={() => setUseFallback(true)}
      />
    );
  }

  // Fallback to object tag
  return (
    <object
      data={blobUrl}
      type="application/pdf"
      className="w-full h-full"
    >
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <FileText className="h-16 w-16 mb-4" />
        <p className="text-lg mb-4">PDF preview not available in your browser</p>
        <p className="text-sm mb-4">Please download the file to view it</p>
      </div>
    </object>
  );
};

export default PDFDocumentViewer;
