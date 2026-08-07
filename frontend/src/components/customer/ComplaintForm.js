import React, { useState, useCallback } from 'react';
import { AlertTriangle, Upload, X, Loader2, Send, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low / कम', color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  { value: 'medium', label: 'Medium / मध्यम', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  { value: 'high', label: 'High / गंभीर', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  { value: 'critical', label: 'Critical / अत्यंत गंभीर', color: 'bg-red-500/20 text-red-400 border-red-500/40' },
];

const CATEGORY_OPTIONS = [
  { value: 'safety', label: 'Safety Concern / सुरक्षा चिंता' },
  { value: 'service_quality', label: 'Service Quality / सेवा गुणवत्ता' },
  { value: 'cancellation', label: 'Cancellation Issue / रद्दीकरण' },
  { value: 'delay', label: 'Flight Delay / विलंब' },
  { value: 'equipment_failure', label: 'Equipment Failure / उपकरण खराबी' },
  { value: 'crew_behavior', label: 'Crew Behavior / क्रू व्यवहार' },
  { value: 'billing', label: 'Billing Issue / बिलिंग' },
  { value: 'feature_discrepancy', label: 'Service Discrepancy / सेवा विसंगति' },
  { value: 'other', label: 'Other / अन्य' },
];

export default function ComplaintForm({ isOpen, onClose, booking, onSuccess }) {
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    severity: 'medium',
    category: 'service_quality',
  });
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error('Only JPG, PNG, WEBP, PDF allowed / केवल JPG, PNG, WEBP, PDF');
      return;
    }

    // Max 5 files, 5MB each
    if (evidenceFiles.length + files.length > 5) {
      toast.error('Maximum 5 files allowed / अधिकतम 5 फाइलें');
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`);
          continue;
        }
        
        // Convert to base64 for now (in production, upload to storage)
        const reader = new FileReader();
        reader.onload = () => {
          setEvidenceFiles(prev => [...prev, {
            name: file.name,
            type: file.type,
            url: reader.result,
            size: file.size
          }]);
        };
        reader.readAsDataURL(file);
      }
      toast.success('Files attached / फाइलें जुड़ गईं');
    } catch (err) {
      toast.error('File upload failed');
    } finally {
      setUploading(false);
    }
  }, [evidenceFiles]);

  const removeFile = (index) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.subject.trim()) {
      toast.error('Subject is required / विषय आवश्यक है');
      return;
    }
    if (!formData.description.trim() || formData.description.length < 20) {
      toast.error('Description must be at least 20 characters / विवरण कम से कम 20 अक्षर');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        booking_id: booking.id,
        subject: formData.subject,
        description: formData.description,
        severity: formData.severity,
        category: formData.category,
        evidence_files: evidenceFiles.map(f => f.url),
      };

      const response = await api.post('/complaints/file', payload);
      
      toast.success(
        <div>
          <p className="font-semibold">Complaint Filed! / शिकायत दर्ज!</p>
          <p className="text-sm">#{response.data.complaint_number}</p>
          <p className="text-xs text-slate-400 mt-1">Operator must respond within 2 hours</p>
        </div>
      );
      
      // Reset form
      setFormData({ subject: '', description: '', severity: 'medium', category: 'service_quality' });
      setEvidenceFiles([]);
      onSuccess?.(response.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to file complaint / शिकायत दर्ज करने में विफल');
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            File Complaint / शिकायत दर्ज करें
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Booking Info */}
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-sm text-slate-400">Booking / बुकिंग</p>
            <p className="font-semibold text-white">{booking.booking_number || booking.inquiry_number || `#${booking.id?.slice(0, 8)}`}</p>
            <p className="text-sm text-slate-400 mt-1">
              {booking.pickup_location || booking.from_location} → {booking.drop_location || booking.to_location}
            </p>
          </div>

          {/* Subject */}
          <div>
            <Label className="text-slate-300">Subject / विषय *</Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Brief summary of the issue..."
              className="mt-1 bg-slate-800 border-slate-600 text-white"
              maxLength={100}
              data-testid="complaint-subject-input"
            />
          </div>

          {/* Category & Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Category / श्रेणी</Label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="mt-1 w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
                data-testid="complaint-category-select"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-slate-300">Severity / गंभीरता</Label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                className="mt-1 w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
                data-testid="complaint-severity-select"
              >
                {SEVERITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-slate-300">Description / विवरण *</Label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the issue in detail. Include dates, times, and specific incidents..."
              className="mt-1 w-full p-3 rounded-md bg-slate-800 border border-slate-600 text-white min-h-[120px]"
              data-testid="complaint-description-input"
            />
            <p className="text-xs text-slate-500 mt-1">{formData.description.length}/500 characters</p>
          </div>

          {/* Evidence Upload */}
          <div>
            <Label className="text-slate-300">Evidence / सबूत (Optional)</Label>
            <div className="mt-2 border-2 border-dashed border-slate-600 rounded-lg p-4 text-center">
              <input
                type="file"
                id="evidence-upload"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="evidence-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-400">
                  {uploading ? 'Uploading...' : 'Click to upload photos/documents'}
                </p>
                <p className="text-xs text-slate-500 mt-1">JPG, PNG, PDF (max 5MB each, up to 5 files)</p>
              </label>
            </div>

            {/* Uploaded Files */}
            {evidenceFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {evidenceFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                    {file.type.includes('image') ? (
                      <Image className="h-4 w-4 text-blue-400" />
                    ) : (
                      <FileText className="h-4 w-4 text-orange-400" />
                    )}
                    <span className="text-sm text-slate-300 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)}KB</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(idx)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm">
            <p className="text-orange-400 font-medium">Important / महत्वपूर्ण:</p>
            <ul className="text-slate-400 text-xs mt-1 space-y-1">
              <li>• Operator must respond within 2 hours / ऑपरेटर को 2 घंटे में जवाब देना होगा</li>
              <li>• AirYatra will investigate independently / एयरयात्रा स्वतंत्र रूप से जांच करेगा</li>
              <li>• Decision is final - no appeal / निर्णय अंतिम है</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-slate-300"
            disabled={submitting}
          >
            Cancel / रद्द करें
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.subject || !formData.description}
            className="bg-orange-500 hover:bg-orange-600"
            data-testid="submit-complaint-btn"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Filing...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> File Complaint</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
