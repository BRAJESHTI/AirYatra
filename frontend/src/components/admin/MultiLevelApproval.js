import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, ArrowUp, MessageSquare, User, Calendar, Filter, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { approvalAPI } from '@/services/api';
import { toast } from 'sonner';

const APPROVAL_TYPES = [
  { id: 'all', label: 'All Types / सभी', icon: '📋' },
  { id: 'cancellation', label: 'Cancellation / रद्दीकरण', icon: '❌' },
  { id: 'refund', label: 'Refund / वापसी', icon: '💰' },
  { id: 'settlement', label: 'Settlement / सेटलमेंट', icon: '🏦' },
  { id: 'operator_onboarding', label: 'Operator Onboarding / ऑपरेटर', icon: '✈️' },
  { id: 'document_verification', label: 'Document Verification / दस्तावेज़', icon: '📄' },
  { id: 'emergency_override', label: 'Emergency Override / आपातकालीन', icon: '🚨' },
  { id: 'price_change', label: 'Price Change / मूल्य परिवर्तन', icon: '💲' },
];

function MultiLevelApproval() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [expandedApproval, setExpandedApproval] = useState(null);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, escalated: 0 });

  useEffect(() => {
    loadApprovals();
  }, [selectedType, selectedStatus]);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const params = { status: selectedStatus };
      if (selectedType !== 'all') params.request_type = selectedType;
      
      const response = await approvalAPI.getQueue(params);
      setApprovals(response.data.queue || []);
      setStats({
        pending: response.data.stats?.pending || 0,
        approved: response.data.stats?.approved || 0,
        rejected: response.data.stats?.rejected || 0,
        escalated: response.data.stats?.escalated || 0
      });
    } catch (error) {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!remarks.trim()) {
      toast.error('Remarks are required / टिप्पणी आवश्यक है');
      return;
    }
    try {
      await approvalAPI.approve(selectedApproval.id, { remarks, approved_amount: selectedApproval.amount });
      toast.success('Approved successfully / स्वीकृत');
      setShowApproveDialog(false);
      setRemarks('');
      loadApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.error('Rejection reason is required / अस्वीकृति कारण आवश्यक है');
      return;
    }
    try {
      await approvalAPI.reject(selectedApproval.id, { remarks, reason: remarks });
      toast.success('Rejected / अस्वीकृत');
      setShowRejectDialog(false);
      setRemarks('');
      loadApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleEscalate = async () => {
    if (!escalationReason.trim()) {
      toast.error('Escalation reason required');
      return;
    }
    try {
      await approvalAPI.escalate(selectedApproval.id, { reason: escalationReason });
      toast.success('Escalated to higher authority / ऊपर भेजा गया');
      setShowEscalateDialog(false);
      setEscalationReason('');
      loadApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to escalate');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'escalated': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getLevelBadge = (level) => {
    const colors = {
      1: 'bg-blue-500/20 text-blue-400',
      2: 'bg-purple-500/20 text-purple-400',
      3: 'bg-orange-500/20 text-orange-400',
      4: 'bg-red-500/20 text-red-400'
    };
    const labels = {
      1: 'L1 - Supervisor',
      2: 'L2 - Manager',
      3: 'L3 - Head',
      4: 'L4 - Director'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[level] || colors[1]}`}>
        {labels[level] || `Level ${level}`}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-orange-400" />
            Multi-Level Approval Workflow
          </h2>
          <p className="text-slate-400 mt-1">बहु-स्तरीय अनुमोदन - Manage approval requests with escalation</p>
        </div>
        <Button variant="outline" onClick={loadApprovals}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedStatus('pending')}
          className={`p-4 rounded-xl border transition-all ${selectedStatus === 'pending' ? 'bg-yellow-500/20 border-yellow-500' : 'bg-slate-900/50 border-slate-800'}`}
        >
          <div className="flex items-center gap-3">
            <Clock className={`h-8 w-8 ${selectedStatus === 'pending' ? 'text-yellow-400' : 'text-slate-500'}`} />
            <div className="text-left">
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              <p className="text-slate-400 text-sm">Pending</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setSelectedStatus('approved')}
          className={`p-4 rounded-xl border transition-all ${selectedStatus === 'approved' ? 'bg-green-500/20 border-green-500' : 'bg-slate-900/50 border-slate-800'}`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle className={`h-8 w-8 ${selectedStatus === 'approved' ? 'text-green-400' : 'text-slate-500'}`} />
            <div className="text-left">
              <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
              <p className="text-slate-400 text-sm">Approved</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setSelectedStatus('rejected')}
          className={`p-4 rounded-xl border transition-all ${selectedStatus === 'rejected' ? 'bg-red-500/20 border-red-500' : 'bg-slate-900/50 border-slate-800'}`}
        >
          <div className="flex items-center gap-3">
            <XCircle className={`h-8 w-8 ${selectedStatus === 'rejected' ? 'text-red-400' : 'text-slate-500'}`} />
            <div className="text-left">
              <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
              <p className="text-slate-400 text-sm">Rejected</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setSelectedStatus('escalated')}
          className={`p-4 rounded-xl border transition-all ${selectedStatus === 'escalated' ? 'bg-purple-500/20 border-purple-500' : 'bg-slate-900/50 border-slate-800'}`}
        >
          <div className="flex items-center gap-3">
            <ArrowUp className={`h-8 w-8 ${selectedStatus === 'escalated' ? 'text-purple-400' : 'text-slate-500'}`} />
            <div className="text-left">
              <p className="text-2xl font-bold text-purple-400">{stats.escalated}</p>
              <p className="text-slate-400 text-sm">Escalated</p>
            </div>
          </div>
        </button>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2">
        {APPROVAL_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => setSelectedType(type.id)}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${selectedType === type.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <span>{type.icon}</span>
            <span className="text-sm">{type.label.split('/')[0].trim()}</span>
          </button>
        ))}
      </div>

      {/* Approvals List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading approvals...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-slate-400">No {selectedStatus} approvals / कोई {selectedStatus} अनुमोदन नहीं</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(approval => (
            <div key={approval.id} className={`p-4 rounded-xl bg-slate-900/50 border ${getStatusColor(approval.status)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{APPROVAL_TYPES.find(t => t.id === approval.request_type)?.icon || '📋'}</span>
                    <h4 className="text-white font-medium">{approval.title || approval.request_type}</h4>
                    {getLevelBadge(approval.current_level || 1)}
                    {approval.needs_escalation && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 animate-pulse">
                        ⚠️ Needs Escalation
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-slate-500">Requested By</p>
                      <p className="text-slate-300">{approval.requested_by_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Amount</p>
                      <p className="text-white font-medium">₹{(approval.amount || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Pending For</p>
                      <p className={approval.hours_pending > 24 ? 'text-red-400' : 'text-slate-300'}>
                        {approval.hours_pending || 0} hours
                      </p>
                    </div>
                  </div>

                  {approval.booking_details && (
                    <p className="text-slate-400 text-sm">
                      Booking: {approval.booking_details.booking_number} | {approval.booking_details.from_location} → {approval.booking_details.to_location}
                    </p>
                  )}

                  {/* Expand for history */}
                  <button
                    onClick={() => setExpandedApproval(expandedApproval === approval.id ? null : approval.id)}
                    className="text-sm text-orange-400 mt-2 flex items-center gap-1"
                  >
                    {expandedApproval === approval.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    View History
                  </button>

                  {expandedApproval === approval.id && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-800/50">
                      <p className="text-slate-400 text-sm mb-2">Approval Timeline:</p>
                      <div className="space-y-2">
                        {(approval.history || []).map((h, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <span className={`w-2 h-2 rounded-full ${h.action === 'approved' ? 'bg-green-400' : h.action === 'rejected' ? 'bg-red-400' : 'bg-yellow-400'}`}></span>
                            <span className="text-slate-400">{h.timestamp}</span>
                            <span className="text-white">{h.user_name}</span>
                            <span className="text-slate-500">- {h.action}</span>
                          </div>
                        ))}
                        {(!approval.history || approval.history.length === 0) && (
                          <p className="text-slate-500 text-sm">No history yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {approval.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => { setSelectedApproval(approval); setShowApproveDialog(true); }}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setSelectedApproval(approval); setShowRejectDialog(true); }}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedApproval(approval); setShowEscalateDialog(true); }}
                    >
                      <ArrowUp className="h-4 w-4 mr-1" /> Escalate
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Approve Request / अनुरोध स्वीकृत करें</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <p className="text-green-400">Amount: ₹{(selectedApproval?.amount || 0).toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <Label>Remarks / टिप्पणी *</Label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows="3"
                placeholder="Enter approval remarks (mandatory)"
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Request / अनुरोध अस्वीकार करें</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason / अस्वीकृति कारण *</Label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows="3"
                placeholder="Enter rejection reason (mandatory)"
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button onClick={handleReject} variant="destructive">Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalate Dialog */}
      <Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Escalate to Higher Authority / ऊपर भेजें</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <p className="text-purple-400">Current Level: {selectedApproval?.current_level || 1} → Next Level: {(selectedApproval?.current_level || 1) + 1}</p>
            </div>
            <div className="space-y-2">
              <Label>Escalation Reason *</Label>
              <textarea
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                rows="3"
                placeholder="Why are you escalating this request?"
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEscalateDialog(false)}>Cancel</Button>
            <Button onClick={handleEscalate} className="bg-purple-600 hover:bg-purple-700">
              <ArrowUp className="h-4 w-4 mr-2" /> Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MultiLevelApproval;
