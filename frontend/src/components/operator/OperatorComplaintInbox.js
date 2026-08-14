import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, CheckCircle2, XCircle, MessageSquare, FileText, RefreshCw, Filter, Search, Eye, Send, Loader2, Flag, Scale, AlertCircle, Upload, X, User, Building2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const STATUS_BADGES = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', icon: AlertCircle },
  operator_response_pending: { label: 'Response Needed', color: 'bg-red-500/20 text-red-400 border-red-500/40', icon: Clock },
  under_investigation: { label: 'Under Investigation', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40', icon: Scale },
  resolved_upheld: { label: 'Upheld', color: 'bg-red-500/20 text-red-400 border-red-500/40', icon: XCircle },
  resolved_dismissed: { label: 'Dismissed', color: 'bg-green-500/20 text-green-400 border-green-500/40', icon: CheckCircle2 },
  resolved_partial: { label: 'Partial', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: AlertTriangle },
  closed: { label: 'Closed', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40', icon: CheckCircle2 },
};

const SEVERITY_BADGES = {
  low: { label: 'Low', color: 'text-green-400', bg: 'bg-green-500/10' },
  medium: { label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10' },
};

const CATEGORY_LABELS = {
  safety: 'Safety Concern',
  service_quality: 'Service Quality',
  cancellation: 'Cancellation',
  delay: 'Flight Delay',
  equipment_failure: 'Equipment Issue',
  crew_behavior: 'Crew Behavior',
  billing: 'Billing Issue',
  feature_discrepancy: 'Service Discrepancy',
  other: 'Other',
};

export default function OperatorComplaintInbox({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Response form
  const [responseForm, setResponseForm] = useState({
    response_text: '',
    action_taken: '',
    accepts_responsibility: false,
    evidence_files: [],
  });

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      };
      
      const response = await api.get('/complaints/operator/against-me', { params });
      let complaintsList = response.data.complaints || [];
      
      // Filter pending only if needed
      if (pendingOnly) {
        complaintsList = complaintsList.filter(c => !c.operator_response_received);
      }
      
      setComplaints(complaintsList);
      setTotalPages(response.data.pages || 1);
      setPendingCount(response.data.pending_response || 0);
    } catch (err) {
      if (err.response?.status === 404) {
        // Operator profile not found - might be new operator
        setComplaints([]);
      } else {
        toast.error('Failed to load complaints');
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, pendingOnly]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate - now;
    
    if (diffMs <= 0) return { expired: true, text: 'DEADLINE PASSED', hours: 0 };
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { 
      expired: false, 
      text: hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`,
      urgent: hours < 6,
      hours
    };
  };

  const handleSubmitResponse = async () => {
    if (!responseForm.response_text.trim()) {
      toast.error('Please provide a response');
      return;
    }
    if (responseForm.response_text.trim().length < 50) {
      toast.error('Response must be at least 50 characters');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        complaint_id: selectedComplaint.complaint_id,
        response_text: responseForm.response_text,
        action_taken: responseForm.action_taken,
        accepts_responsibility: responseForm.accepts_responsibility,
        evidence_files: responseForm.evidence_files,
      };

      const response = await api.post('/complaints/operator/respond', payload);
      
      if (response.data.is_late) {
        toast.warning(
          <div>
            <p className="font-semibold">Response Submitted (Late)</p>
            <p className="text-sm">Penalty: ₹{response.data.penalty_amount?.toLocaleString()}</p>
          </div>
        );
      } else {
        toast.success('Response submitted successfully!');
      }
      
      setShowResponseDialog(false);
      setSelectedComplaint(null);
      setResponseForm({
        response_text: '',
        action_taken: '',
        accepts_responsibility: false,
        evidence_files: [],
      });
      loadComplaints();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const openResponseDialog = (complaint) => {
    setSelectedComplaint(complaint);
    setResponseForm({
      response_text: '',
      action_taken: '',
      accepts_responsibility: false,
      evidence_files: [],
    });
    setShowResponseDialog(true);
  };

  return (
    <div className="space-y-6" data-testid="operator-complaint-inbox">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag className="h-6 w-6 text-red-400" />
            Complaints Against Me</h1>
          <p className="text-slate-400 text-sm mt-1">
            Respond within 24 hours to avoid penalties / 24          </p>
        </div>
        <Button onClick={loadComplaints} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Urgent Alert Banner */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />
            </div>
            <div>
              <p className="text-red-400 font-semibold">{pendingCount} Complaints Need Your Response!</p>
              <p className="text-slate-400 text-sm">Late responses incur ₹5,000 penalty per complaint</p>
            </div>
          </div>
          <Button 
            onClick={() => setPendingOnly(true)}
            className="bg-red-500 hover:bg-red-600"
          >
            View Urgent
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4 rounded-xl">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={pendingOnly ? "default" : "outline"}
              onClick={() => setPendingOnly(!pendingOnly)}
              className={pendingOnly ? "bg-red-500" : "border-slate-600"}
            >
              <Clock className="h-4 w-4 mr-1" />
              Pending Response ({pendingCount})
            </Button>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
            data-testid="operator-complaint-filter"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="resolved_upheld">Upheld (Against Me)</option>
            <option value="resolved_dismissed">Dismissed (In My Favor)</option>
          </select>
        </div>
      </div>

      {/* Complaints List */}
      <div className="space-y-3">
        {loading ? (
          <div className="glass rounded-xl p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
            <p className="text-slate-400 mt-2">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-400" />
            <p className="text-green-400 mt-2 font-medium">No complaints!</p>
            <p className="text-slate-500 text-sm mt-1">Keep up the excellent service!</p>
          </div>
        ) : (
          complaints.map((complaint) => {
            const status = STATUS_BADGES[complaint.status] || STATUS_BADGES.open;
            const severity = SEVERITY_BADGES[complaint.severity] || SEVERITY_BADGES.medium;
            const StatusIcon = status.icon;
            const deadline = getTimeRemaining(complaint.operator_response_required_at);
            const isExpanded = expandedId === complaint.complaint_id;
            const needsResponse = !complaint.operator_response_received && ['open', 'operator_response_pending'].includes(complaint.status);
            
            return (
              <div
                key={complaint.complaint_id}
                className={`glass rounded-xl overflow-hidden transition-all ${needsResponse ? 'border border-red-500/40' : ''}`}
                data-testid={`operator-complaint-${complaint.complaint_id}`}
              >
                {/* Main Row */}
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-800/30"
                  onClick={() => setExpandedId(isExpanded ? null : complaint.complaint_id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${severity.bg} ${severity.color}`}>
                          {severity.label}
                        </span>
                        {needsResponse && deadline && (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            deadline.expired ? 'bg-red-500/30 text-red-400' : 
                            deadline.urgent ? 'bg-orange-500/30 text-orange-400' : 
                            'bg-yellow-500/30 text-yellow-400'
                          }`}>
                            <Clock className="h-3 w-3 inline mr-1" />
                            {deadline.text}
                          </span>
                        )}
                        {complaint.operator_response_received && (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                            <CheckCircle2 className="h-3 w-3 inline mr-1" />
                            Responded
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-white font-semibold">{complaint.subject}</h3>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {complaint.customer_name || 'Customer'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(complaint.created_at)}
                        </span>
                        <span className="font-mono">{complaint.complaint_number}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {needsResponse && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openResponseDialog(complaint); }}
                          className="bg-red-500 hover:bg-red-600"
                          data-testid={`respond-btn-${complaint.complaint_id}`}
                        >
                          <Send className="h-4 w-4 mr-1" /> Respond
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Customer Complaint</p>
                      <p className="text-slate-300 text-sm">{complaint.description}</p>
                    </div>
                    
                    {complaint.evidence_files?.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Evidence Attached</p>
                        <p className="text-slate-500 text-sm">{complaint.evidence_files.length} file(s)</p>
                      </div>
                    )}
                    
                    {complaint.operator_response && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="text-xs text-green-400 mb-1">Your Response</p>
                        <p className="text-slate-300 text-sm">{complaint.operator_response}</p>
                        {complaint.operator_action_taken && (
                          <p className="text-slate-400 text-xs mt-2">Action: {complaint.operator_action_taken}</p>
                        )}
                      </div>
                    )}
                    
                    {complaint.airyatra_decision && (
                      <div className={`p-3 rounded-lg ${
                        complaint.airyatra_decision === 'dismissed' ? 'bg-green-500/10 border border-green-500/30' :
                        complaint.airyatra_decision === 'upheld' ? 'bg-red-500/10 border border-red-500/30' :
                        'bg-orange-500/10 border border-orange-500/30'
                      }`}>
                        <p className="text-xs text-slate-400 mb-1">AirYatra Decision</p>
                        <p className={`font-semibold ${
                          complaint.airyatra_decision === 'dismissed' ? 'text-green-400' :
                          complaint.airyatra_decision === 'upheld' ? 'text-red-400' : 'text-orange-400'
                        }`}>
                          {complaint.airyatra_decision.charAt(0).toUpperCase() + complaint.airyatra_decision.slice(1)}
                        </p>
                        {complaint.decision_notes && (
                          <p className="text-slate-400 text-sm mt-1">{complaint.decision_notes}</p>
                        )}
                        {complaint.penalty_issued && (
                          <p className="text-red-400 text-sm mt-2">
                            Penalty: ₹{complaint.penalty_amount?.toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {!complaint.operator_response_received && (
                      <Button
                        onClick={() => openResponseDialog(complaint)}
                        className="w-full bg-red-500 hover:bg-red-600"
                      >
                        <Send className="h-4 w-4 mr-2" /> Submit Response Now
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-slate-600"
          >
            Previous
          </Button>
          <span className="text-slate-400">Page {page} of {totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-slate-600"
          >
            Next
          </Button>
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-400" />
              Respond to Complaint</DialogTitle>
          </DialogHeader>
          
          {selectedComplaint && (
            <div className="space-y-4">
              {/* Complaint Summary */}
              <div className="p-3 rounded-lg bg-slate-800/50">
                <p className="text-xs text-slate-400">Complaint</p>
                <p className="text-white font-medium">{selectedComplaint.subject}</p>
                <p className="text-slate-400 text-sm mt-1 line-clamp-2">{selectedComplaint.description}</p>
              </div>
              
              {/* Deadline Warning */}
              {(() => {
                const deadline = getTimeRemaining(selectedComplaint.operator_response_required_at);
                if (!deadline) return null;
                return (
                  <div className={`p-3 rounded-lg ${deadline.expired ? 'bg-red-500/20 border border-red-500/40' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                    <p className={`text-sm font-medium ${deadline.expired ? 'text-red-400' : 'text-yellow-400'}`}>
                      <Clock className="h-4 w-4 inline mr-1" />
                      {deadline.expired ? 'DEADLINE PASSED - ₹5,000 penalty will apply' : `Deadline: ${deadline.text}`}
                    </p>
                  </div>
                );
              })()}
              
              {/* Response Text */}
              <div>
                <Label className="text-slate-300">Your Response*</Label>
                <textarea
                  value={responseForm.response_text}
                  onChange={(e) => setResponseForm(prev => ({ ...prev, response_text: e.target.value }))}
                  placeholder="Provide a detailed response to the complaint. Explain your side of the story..."
                  className="mt-1 w-full p-3 rounded-md bg-slate-800 border border-slate-600 text-white min-h-[150px]"
                  data-testid="operator-response-textarea"
                />
                <p className="text-xs text-slate-500 mt-1">{responseForm.response_text.length}/500 (min 50)</p>
              </div>
              
              {/* Action Taken */}
              <div>
                <Label className="text-slate-300">Action Taken (if any)</Label>
                <Input
                  value={responseForm.action_taken}
                  onChange={(e) => setResponseForm(prev => ({ ...prev, action_taken: e.target.value }))}
                  placeholder="e.g., Refund issued, Pilot counseled, etc."
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              {/* Accepts Responsibility */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="accepts-responsibility"
                  checked={responseForm.accepts_responsibility}
                  onChange={(e) => setResponseForm(prev => ({ ...prev, accepts_responsibility: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                />
                <Label htmlFor="accepts-responsibility" className="text-slate-300 text-sm">
                  I accept responsibility for this issue</Label>
              </div>
              
              {/* Info Box */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-400 font-medium">Important</p>
                <ul className="text-xs text-slate-400 mt-1 space-y-1">
                  <li>• AirYatra will investigate and make final decision</li>
                  <li>• Your response will be shared with the customer</li>
                  <li>• Late response incurs ₹5,000 penalty</li>
                  <li>• Decision is final - no appeal allowed</li>
                </ul>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowResponseDialog(false)}
              className="border-slate-600 text-slate-300"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitResponse}
              disabled={submitting || responseForm.response_text.length < 50}
              className="bg-blue-500 hover:bg-blue-600"
              data-testid="submit-response-btn"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Submit Response</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
