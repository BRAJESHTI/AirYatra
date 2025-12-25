import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Check, X, Clock, AlertTriangle, 
  Loader2, Eye, Download, Shield, Building2, Users, BadgeCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAPI } from '@/services/api';
import { toast } from 'sonner';

// Required documents for village landing
const REQUIRED_DOCUMENTS = [
  {
    id: 'collector_noc',
    name: 'Collector NOC',
    name_hi: 'कलेक्टर NOC',
    description: 'No Objection Certificate from District Collector',
    description_hi: 'जिला कलेक्टर से अनापत्ति प्रमाण पत्र',
    icon: Building2,
    required: true
  },
  {
    id: 'fire_dept',
    name: 'Fire Department Acknowledgment',
    name_hi: 'फायर विभाग की पावती',
    description: 'Acknowledgment from Fire Department',
    description_hi: 'अग्निशमन विभाग से पावती',
    icon: Shield,
    required: true
  },
  {
    id: 'police_station',
    name: 'Local Police Station Acknowledgment',
    name_hi: 'स्थानीय थाना की पावती',
    description: 'Acknowledgment from local Police Station',
    description_hi: 'स्थानीय पुलिस थाने से पावती',
    icon: Users,
    required: true
  },
  {
    id: 'sp_dcp',
    name: 'SP/DCP Acknowledgment',
    name_hi: 'SP/DCP की पावती',
    description: 'Acknowledgment from SP or DCP office',
    description_hi: 'SP या DCP कार्यालय से पावती',
    icon: BadgeCheck,
    required: true
  }
];

const statusConfig = {
  pending: { 
    color: 'text-slate-400', 
    bg: 'bg-slate-500/20', 
    label: 'Not Uploaded / अपलोड नहीं हुआ' 
  },
  uploaded: { 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/20', 
    label: 'Uploaded - Pending Review / अपलोड - समीक्षा बाकी' 
  },
  under_review: { 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/20', 
    label: 'Under Review / समीक्षा में' 
  },
  approved: { 
    color: 'text-green-400', 
    bg: 'bg-green-500/20', 
    label: 'Approved / स्वीकृत ✓' 
  },
  rejected: { 
    color: 'text-red-400', 
    bg: 'bg-red-500/20', 
    label: 'Rejected / अस्वीकृत ✗' 
  }
};

function VillageLandingDocuments({ 
  inquiryId, 
  permissionId, 
  permissionData,
  onUpdate,
  readOnly = false 
}) {
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permissionData?.documents && permissionData.documents.length > 0) {
      const docsMap = {};
      permissionData.documents.forEach(doc => {
        docsMap[doc.doc_type] = {
          document_type: doc.doc_type,
          file_url: doc.file_url,
          file_name: doc.file_name,
          status: doc.status || 'uploaded',
          rejection_reason: doc.rejection_reason,
          uploaded_at: doc.uploaded_at
        };
      });
      setDocuments(docsMap);
    } else if (permissionData?.uploaded_documents) {
      // Legacy support
      const docsMap = {};
      permissionData.uploaded_documents.forEach(doc => {
        docsMap[doc.document_type] = doc;
      });
      setDocuments(docsMap);
    }
    setLoading(false);
  }, [permissionData]);

  const handleFileUpload = async (docType, file) => {
    if (!file) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (file.size > maxSize) {
      toast.error('File size should be less than 5MB / फाइल साइज 5MB से कम होना चाहिए');
      return;
    }
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, PNG files allowed / सिर्फ PDF, JPG, PNG फाइल');
      return;
    }

    setUploading(prev => ({ ...prev, [docType]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);

      const response = await landingAPI.uploadVillageDocumentDirect(permissionId, formData);
      
      setDocuments(prev => ({
        ...prev,
        [docType]: {
          document_type: docType,
          file_url: response.data.file_url,
          file_name: response.data.file_name || file.name,
          status: response.data.status || 'uploaded',
          uploaded_at: new Date().toISOString()
        }
      }));

      const docName = REQUIRED_DOCUMENTS.find(d => d.id === docType)?.name || docType;
      toast.success(`${docName} uploaded successfully! / सफलतापूर्वक अपलोड हुआ!`);
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Upload failed / अपलोड विफल');
    } finally {
      setUploading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const getOverallStatus = () => {
    const uploadedCount = Object.keys(documents).length;
    const approvedCount = Object.values(documents).filter(d => d.status === 'approved').length;
    const rejectedCount = Object.values(documents).filter(d => d.status === 'rejected').length;
    
    if (approvedCount === REQUIRED_DOCUMENTS.length) {
      return { status: 'approved', message: 'All documents approved! Pilot can proceed with flight.' };
    }
    if (rejectedCount > 0) {
      return { status: 'rejected', message: 'Some documents rejected. Please re-upload.' };
    }
    if (uploadedCount < REQUIRED_DOCUMENTS.length) {
      return { status: 'pending', message: `${uploadedCount}/${REQUIRED_DOCUMENTS.length} documents uploaded` };
    }
    return { status: 'under_review', message: 'All documents submitted. Under review.' };
  };

  const overall = getOverallStatus();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-yellow-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-yellow-400 font-semibold text-lg">
              Village Landing Documents / गांव लैंडिंग दस्तावेज़
            </h3>
            <p className="text-yellow-400/70 text-sm mt-1">
              Please upload all required documents from authorities. 
              Flight will be scheduled only after all documents are approved.
            </p>
            <p className="text-yellow-400/70 text-sm">
              कृपया सभी आवश्यक दस्तावेज़ अधिकारियों से प्राप्त करके अपलोड करें।
              सभी दस्तावेज़ स्वीकृत होने के बाद ही उड़ान निर्धारित की जाएगी।
            </p>
          </div>
        </div>
        
        {/* Overall Status */}
        <div className={`mt-3 p-2 rounded-lg ${statusConfig[overall.status]?.bg}`}>
          <p className={`text-sm font-medium ${statusConfig[overall.status]?.color}`}>
            Status: {overall.message}
          </p>
        </div>
      </div>

      {/* Documents List */}
      <div className="p-4 space-y-4">
        {REQUIRED_DOCUMENTS.map((doc) => {
          const uploadedDoc = documents[doc.id];
          const isUploading = uploading[doc.id];
          const docStatus = uploadedDoc?.status || 'pending';
          const Icon = doc.icon;

          return (
            <div 
              key={doc.id}
              className={`p-4 rounded-lg border ${
                docStatus === 'approved' ? 'border-green-500/30 bg-green-500/5' :
                docStatus === 'rejected' ? 'border-red-500/30 bg-red-500/5' :
                docStatus === 'uploaded' || docStatus === 'under_review' ? 'border-blue-500/30 bg-blue-500/5' :
                'border-slate-600 bg-slate-800/30'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-3 rounded-lg ${
                  docStatus === 'approved' ? 'bg-green-500/20' :
                  docStatus === 'rejected' ? 'bg-red-500/20' :
                  'bg-slate-700'
                }`}>
                  <Icon className={`h-6 w-6 ${
                    docStatus === 'approved' ? 'text-green-400' :
                    docStatus === 'rejected' ? 'text-red-400' :
                    'text-slate-400'
                  }`} />
                </div>

                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-medium">{doc.name}</h4>
                    {doc.required && (
                      <span className="text-red-400 text-xs">*Required</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{doc.name_hi}</p>
                  <p className="text-slate-500 text-xs mt-1">{doc.description}</p>

                  {/* Status Badge */}
                  <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded text-xs ${statusConfig[docStatus]?.bg} ${statusConfig[docStatus]?.color}`}>
                    {docStatus === 'approved' && <Check className="h-3 w-3" />}
                    {docStatus === 'rejected' && <X className="h-3 w-3" />}
                    {docStatus === 'under_review' && <Clock className="h-3 w-3" />}
                    {statusConfig[docStatus]?.label}
                  </div>

                  {/* Rejection Reason */}
                  {uploadedDoc?.rejection_reason && (
                    <p className="text-red-400 text-xs mt-2">
                      Reason: {uploadedDoc.rejection_reason}
                    </p>
                  )}

                  {/* Uploaded File Info */}
                  {uploadedDoc?.file_name && (
                    <div className="flex items-center gap-2 mt-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-400 text-xs truncate">{uploadedDoc.file_name}</span>
                      {uploadedDoc.file_url && (
                        <a 
                          href={uploadedDoc.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                {!readOnly && (docStatus === 'pending' || docStatus === 'rejected') && (
                  <div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(doc.id, e.target.files[0])}
                        disabled={isUploading}
                      />
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isUploading 
                          ? 'bg-slate-600 text-slate-400' 
                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                      }`}>
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <span className="text-sm">
                          {isUploading ? 'Uploading...' : docStatus === 'rejected' ? 'Re-upload' : 'Upload'}
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Approved/Under Review Status */}
                {(docStatus === 'approved' || docStatus === 'under_review' || docStatus === 'uploaded') && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    docStatus === 'approved' ? 'bg-green-500/20' : 'bg-blue-500/20'
                  }`}>
                    {docStatus === 'approved' ? (
                      <Check className="h-5 w-5 text-green-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-blue-400" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Note */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-700">
        <p className="text-slate-400 text-xs">
          📝 <strong>Note:</strong> Upload clear scanned copies or photos of documents. 
          Accepted formats: PDF, JPG, PNG (Max 5MB each).
        </p>
        <p className="text-slate-500 text-xs mt-1">
          नोट: दस्तावेज़ों की स्पष्ट स्कैन कॉपी या फोटो अपलोड करें। 
          स्वीकृत प्रारूप: PDF, JPG, PNG (अधिकतम 5MB प्रत्येक)
        </p>
      </div>
    </div>
  );
}

export default VillageLandingDocuments;
