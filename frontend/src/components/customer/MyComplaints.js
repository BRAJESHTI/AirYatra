import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, CheckCircle2, XCircle, MessageSquare, FileText, ChevronRight, RefreshCw, Filter, Search, Eye, Calendar, Building2, Loader2, Flag, Scale, AlertCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const STATUS_BADGES = {
  open: { label: 'Open / खुला', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', icon: AlertCircle },
  operator_response_pending: { label: 'Awaiting Operator', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: Clock },
  under_investigation: { label: 'Under Investigation', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40', icon: Scale },
  resolved_upheld: { label: 'Upheld / मान्य', color: 'bg-green-500/20 text-green-400 border-green-500/40', icon: CheckCircle2 },
  resolved_dismissed: { label: 'Dismissed / खारिज', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40', icon: XCircle },
  resolved_partial: { label: 'Partial / आंशिक', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: AlertTriangle },
  closed: { label: 'Closed / बंद', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40', icon: CheckCircle2 },
};

const SEVERITY_BADGES = {
  low: { label: 'Low', color: 'text-green-400' },
  medium: { label: 'Medium', color: 'text-yellow-400' },
  high: { label: 'High', color: 'text-orange-400' },
  critical: { label: 'Critical', color: 'text-red-400' },
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

export default function MyComplaints({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0 });

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      };
      
      const response = await api.get('/complaints/my-complaints', { params });
      setComplaints(response.data.complaints || []);
      setTotalPages(response.data.pages || 1);
      setStats({
        total: response.data.total || 0,
        open: (response.data.complaints || []).filter(c => ['open', 'operator_response_pending', 'under_investigation'].includes(c.status)).length,
        resolved: (response.data.complaints || []).filter(c => c.status?.startsWith('resolved')).length,
      });
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

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
    
    if (diffMs <= 0) return { expired: true, text: 'EXPIRED' };
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return { expired: false, text: `${hours}h ${minutes}m remaining` };
    return { expired: false, text: `${minutes}m remaining`, urgent: true };
  };

  const filteredComplaints = complaints.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.complaint_number?.toLowerCase().includes(query) ||
      c.subject?.toLowerCase().includes(query) ||
      c.description?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6" data-testid="my-complaints-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flag className="h-6 w-6 text-orange-400" />
            My Complaints / मेरी शिकायतें
          </h1>
          <p className="text-slate-400 text-sm mt-1">Track your filed complaints and their status</p>
        </div>
        <Button onClick={loadComplaints} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass p-4 rounded-xl">
          <p className="text-3xl font-bold text-white">{stats.total}</p>
          <p className="text-sm text-slate-400">Total Complaints</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-3xl font-bold text-yellow-400">{stats.open}</p>
          <p className="text-sm text-slate-400">Open / In Progress</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-3xl font-bold text-green-400">{stats.resolved}</p>
          <p className="text-sm text-slate-400">Resolved</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass p-4 rounded-xl">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-600 text-white"
                data-testid="complaint-search-input"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
            data-testid="complaint-status-filter"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="operator_response_pending">Awaiting Response</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="resolved_upheld">Upheld</option>
            <option value="resolved_dismissed">Dismissed</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {loading ? (
          <div className="glass rounded-xl p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
            <p className="text-slate-400 mt-2">Loading complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <Flag className="h-12 w-12 mx-auto text-slate-600" />
            <p className="text-slate-400 mt-2">No complaints found</p>
            <p className="text-slate-500 text-sm mt-1">You can file a complaint from your booking details page</p>
          </div>
        ) : (
          filteredComplaints.map((complaint) => {
            const status = STATUS_BADGES[complaint.status] || STATUS_BADGES.open;
            const severity = SEVERITY_BADGES[complaint.severity] || SEVERITY_BADGES.medium;
            const StatusIcon = status.icon;
            const deadline = getTimeRemaining(complaint.operator_response_required_at);
            
            return (
              <div
                key={complaint.complaint_id}
                className="glass rounded-xl p-5 hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => { setSelectedComplaint(complaint); setShowDetailDialog(true); }}
                data-testid={`complaint-card-${complaint.complaint_id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                      <span className={`text-xs font-semibold ${severity.color}`}>
                        {severity.label}
                      </span>
                      <span className="text-slate-500 text-xs">
                        {CATEGORY_LABELS[complaint.category] || complaint.category}
                      </span>
                    </div>
                    
                    <h3 className="text-white font-semibold truncate">{complaint.subject}</h3>
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{complaint.description}</p>
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {complaint.complaint_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(complaint.created_at)}
                      </span>
                      {!complaint.operator_response_received && deadline && (
                        <span className={`flex items-center gap-1 ${deadline.expired ? 'text-red-400' : deadline.urgent ? 'text-orange-400' : 'text-yellow-400'}`}>
                          <Clock className="h-3 w-3" />
                          Operator: {deadline.text}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
                </div>
                
                {/* Response Status */}
                {complaint.operator_response_received && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Operator responded on {formatDate(complaint.operator_response_date)}
                    </p>
                  </div>
                )}
                
                {/* Decision */}
                {complaint.airyatra_decision && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <p className={`text-xs flex items-center gap-1 ${
                      complaint.airyatra_decision === 'upheld' ? 'text-green-400' :
                      complaint.airyatra_decision === 'dismissed' ? 'text-slate-400' :
                      'text-orange-400'
                    }`}>
                      <Scale className="h-3 w-3" />
                      Decision: {complaint.airyatra_decision.charAt(0).toUpperCase() + complaint.airyatra_decision.slice(1)} on {formatDate(complaint.decision_date)}
                    </p>
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

      {/* Complaint Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-orange-400" />
              Complaint Details / शिकायत विवरण
            </DialogTitle>
          </DialogHeader>
          
          {selectedComplaint && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`p-3 rounded-lg ${STATUS_BADGES[selectedComplaint.status]?.color?.replace('text-', 'bg-').replace('/20', '/10') || 'bg-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-2 font-medium ${STATUS_BADGES[selectedComplaint.status]?.color?.split(' ')[1] || 'text-white'}`}>
                    {React.createElement(STATUS_BADGES[selectedComplaint.status]?.icon || AlertCircle, { className: "h-4 w-4" })}
                    {STATUS_BADGES[selectedComplaint.status]?.label || selectedComplaint.status}
                  </span>
                  <span className="text-slate-400 text-sm">{selectedComplaint.complaint_number}</span>
                </div>
              </div>
              
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Category / श्रेणी</p>
                  <p className="text-white">{CATEGORY_LABELS[selectedComplaint.category] || selectedComplaint.category}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Severity / गंभीरता</p>
                  <p className={SEVERITY_BADGES[selectedComplaint.severity]?.color || 'text-white'}>
                    {selectedComplaint.severity?.charAt(0).toUpperCase() + selectedComplaint.severity?.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Filed On / दर्ज तारीख</p>
                  <p className="text-white">{formatDate(selectedComplaint.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Booking</p>
                  <p className="text-white font-mono text-sm">{selectedComplaint.booking_id?.slice(0, 12)}...</p>
                </div>
              </div>
              
              {/* Subject & Description */}
              <div>
                <p className="text-xs text-slate-400 mb-1">Subject / विषय</p>
                <p className="text-white font-medium">{selectedComplaint.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Description / विवरण</p>
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{selectedComplaint.description}</p>
              </div>
              
              {/* Evidence */}
              {selectedComplaint.evidence_files?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Evidence Attached / सबूत</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedComplaint.evidence_files.map((file, idx) => (
                      <span key={idx} className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-300">
                        <FileText className="h-3 w-3 inline mr-1" />
                        File {idx + 1}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Timeline */}
              <div className="pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-400 mb-3">Timeline / समयरेखा</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5" />
                    <div>
                      <p className="text-sm text-white">Complaint Filed</p>
                      <p className="text-xs text-slate-500">{formatDate(selectedComplaint.created_at)}</p>
                    </div>
                  </div>
                  
                  {selectedComplaint.operator_response_received ? (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5" />
                      <div>
                        <p className="text-sm text-white">Operator Responded</p>
                        <p className="text-xs text-slate-500">{formatDate(selectedComplaint.operator_response_date)}</p>
                        {selectedComplaint.operator_response && (
                          <p className="text-xs text-slate-400 mt-1">{selectedComplaint.operator_response.slice(0, 100)}...</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 animate-pulse" />
                      <div>
                        <p className="text-sm text-yellow-400">Awaiting Operator Response</p>
                        <p className="text-xs text-slate-500">
                          Deadline: {formatDate(selectedComplaint.operator_response_required_at)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedComplaint.investigation_start_date && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5" />
                      <div>
                        <p className="text-sm text-white">Investigation Started</p>
                        <p className="text-xs text-slate-500">{formatDate(selectedComplaint.investigation_start_date)}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedComplaint.airyatra_decision && (
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                        selectedComplaint.airyatra_decision === 'upheld' ? 'bg-green-400' :
                        selectedComplaint.airyatra_decision === 'dismissed' ? 'bg-slate-400' : 'bg-orange-400'
                      }`} />
                      <div>
                        <p className="text-sm text-white">
                          Decision: {selectedComplaint.airyatra_decision.charAt(0).toUpperCase() + selectedComplaint.airyatra_decision.slice(1)}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(selectedComplaint.decision_date)}</p>
                        {selectedComplaint.decision_notes && (
                          <p className="text-xs text-slate-400 mt-1">{selectedComplaint.decision_notes}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Help Section */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-blue-400 font-medium mb-1">Need Help? / मदद चाहिए?</p>
                <p className="text-xs text-slate-400">
                  AirYatra investigates all complaints independently. Decisions are final with no appeal.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" className="border-blue-500/50 text-blue-400 h-7 text-xs">
                    <Phone className="h-3 w-3 mr-1" /> Support
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
