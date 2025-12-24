import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronUp, RefreshCw, Filter, History, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { approvalAPI } from '@/services/api';
import { toast } from 'sonner';

function ApprovalQueue() {
  const [approvals, setApprovals] = useState({ pending: [], approved: [], rejected: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [actionType, setActionType] = useState('');
  const [remark, setRemark] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    loadApprovals();
  }, [filterType]);

  const loadApprovals = async () => {
    try {
      const response = await approvalAPI.getQueue({ status: activeTab, request_type: filterType || undefined });
      setApprovals(response.data);
    } catch (error) {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!remark.trim()) {
      toast.error('Remark is required / टिप्पणी आवश्यक है');
      return;
    }
    
    try {
      if (actionType === 'approve') {
        const response = await approvalAPI.approve(selectedApproval.id, { remark });
        toast.success(response.data.message);
      } else if (actionType === 'reject') {
        await approvalAPI.reject(selectedApproval.id, { remark });
        toast.success('Request rejected / अनुरोध अस्वीकृत');
      } else if (actionType === 'escalate') {
        await approvalAPI.escalate(selectedApproval.id, { reason: remark, escalate_to: 'super_admin' });
        toast.success('Request escalated / अनुरोध एस्केलेट किया गया');
      }
      
      setShowActionDialog(false);
      setRemark('');
      loadApprovals();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    }
  };

  const openActionDialog = (approval, action) => {
    setSelectedApproval(approval);
    setActionType(action);
    setRemark('');
    setShowActionDialog(true);
  };

  const getTypeColor = (type) => {
    const colors = {
      cancellation: 'bg-red-500/20 text-red-400 border-red-500/30',
      settlement: 'bg-green-500/20 text-green-400 border-green-500/30',
      refund: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      operator_onboarding: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    };
    return colors[type] || 'bg-slate-500/20 text-slate-400';
  };

  const getTypeLabel = (type) => {
    const labels = {
      cancellation: 'Cancellation / रद्दीकरण',
      settlement: 'Settlement / सेटलमेंट',
      refund: 'Refund / वापसी',
      operator_onboarding: 'Operator Onboarding'
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentApprovals = approvals[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="h-6 w-6 text-orange-400" />
            Approval Queue
          </h2>
          <p className="text-slate-400">अनुमोदन कतार - Manage pending approvals</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-10 px-3 rounded-md bg-slate-800 border border-slate-700 text-white"
          >
            <option value="">All Types</option>
            <option value="cancellation">Cancellation</option>
            <option value="settlement">Settlement</option>
            <option value="refund">Refund</option>
            <option value="operator_onboarding">Onboarding</option>
          </select>
          <Button onClick={loadApprovals} variant="outline" className="border-slate-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`p-4 rounded-lg border transition-all ${
            activeTab === 'pending' 
              ? 'bg-yellow-500/20 border-yellow-500' 
              : 'bg-slate-900/50 border-slate-800 hover:border-yellow-500/50'
          }`}
        >
          <p className="text-yellow-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-white">{approvals.counts?.pending || 0}</p>
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`p-4 rounded-lg border transition-all ${
            activeTab === 'approved' 
              ? 'bg-green-500/20 border-green-500' 
              : 'bg-slate-900/50 border-slate-800 hover:border-green-500/50'
          }`}
        >
          <p className="text-green-400 text-sm">Approved</p>
          <p className="text-2xl font-bold text-white">{approvals.counts?.approved || 0}</p>
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`p-4 rounded-lg border transition-all ${
            activeTab === 'rejected' 
              ? 'bg-red-500/20 border-red-500' 
              : 'bg-slate-900/50 border-slate-800 hover:border-red-500/50'
          }`}
        >
          <p className="text-red-400 text-sm">Rejected</p>
          <p className="text-2xl font-bold text-white">{approvals.counts?.rejected || 0}</p>
        </button>
      </div>

      {/* Approvals List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : currentApprovals.length === 0 ? (
        <div className="p-8 rounded-lg bg-slate-900/50 border border-slate-800 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-white font-medium">No {activeTab} approvals</p>
          <p className="text-slate-400 text-sm">कोई {activeTab} अनुमोदन नहीं</p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentApprovals.map((approval) => (
            <div 
              key={approval.id} 
              className={`p-6 rounded-lg bg-slate-900/50 border ${
                approval.needs_escalation ? 'border-red-500' : 'border-slate-800'
              }`}
            >
              {/* Escalation Warning */}
              {approval.needs_escalation && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <span className="text-red-400 text-sm">
                    ⚠️ Pending for {approval.hours_pending}+ hours - Needs escalation
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs border ${getTypeColor(approval.request_type)}`}>
                      {getTypeLabel(approval.request_type)}
                    </span>
                    <span className="text-slate-500 text-sm">Level {approval.approval_level || 1}</span>
                  </div>
                  <p className="text-white font-medium mt-2">
                    {approval.booking_details?.booking_number || approval.operator_name || `Request #${approval.id.slice(0, 8)}`}
                  </p>
                  <p className="text-slate-400 text-sm">Requested by: {approval.requested_by_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-sm">{formatDate(approval.created_at)}</p>
                  {approval.hours_pending && (
                    <p className={`text-xs ${approval.hours_pending > 24 ? 'text-red-400' : 'text-slate-500'}`}>
                      {Math.round(approval.hours_pending)}h pending
                    </p>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
                {approval.reason && (
                  <div className="mb-2">
                    <p className="text-slate-500 text-xs">Reason / कारण</p>
                    <p className="text-white">{approval.reason}</p>
                  </div>
                )}
                {approval.refund_amount > 0 && (
                  <div className="mb-2">
                    <p className="text-slate-500 text-xs">Refund Amount / वापसी राशि</p>
                    <p className="text-green-400 font-medium">₹{approval.refund_amount?.toLocaleString()}</p>
                  </div>
                )}
                {approval.booking_details && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Route</p>
                      <p className="text-white">
                        {approval.booking_details.from_location} → {approval.booking_details.to_location}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Amount</p>
                      <p className="text-white">₹{approval.booking_details.total_amount?.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Approval Chain */}
              {approval.approval_chain?.length > 0 && (
                <div className="mb-4">
                  <p className="text-slate-500 text-xs mb-2">Approval Chain</p>
                  <div className="flex gap-2 flex-wrap">
                    {approval.approval_chain.map((chain, index) => (
                      <span key={index} className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">
                        Level {chain.level}: {chain.approved_by_name} ✓
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {activeTab === 'pending' && (
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openActionDialog(approval, 'escalate')}
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20"
                  >
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Escalate
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openActionDialog(approval, 'reject')}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => openActionDialog(approval, 'approve')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              )}

              {/* Status for approved/rejected */}
              {activeTab === 'approved' && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span>Approved by {approval.final_approved_by_name} on {formatDate(approval.final_approved_at)}</span>
                </div>
              )}
              {activeTab === 'rejected' && (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span>Rejected by {approval.rejected_by_name}: {approval.rejection_remark}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {actionType === 'approve' && <CheckCircle className="h-5 w-5 text-green-400" />}
              {actionType === 'reject' && <XCircle className="h-5 w-5 text-red-400" />}
              {actionType === 'escalate' && <ChevronUp className="h-5 w-5 text-yellow-400" />}
              {actionType === 'approve' && 'Approve Request / अनुरोध स्वीकृत करें'}
              {actionType === 'reject' && 'Reject Request / अनुरोध अस्वीकृत करें'}
              {actionType === 'escalate' && 'Escalate Request / अनुरोध एस्केलेट करें'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-slate-400 text-sm">Request Type</p>
              <p className="text-white font-medium">{getTypeLabel(selectedApproval?.request_type)}</p>
              {selectedApproval?.reason && (
                <>
                  <p className="text-slate-400 text-sm mt-2">Reason</p>
                  <p className="text-white">{selectedApproval.reason}</p>
                </>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-white">
                {actionType === 'reject' ? 'Rejection Reason *' : 'Remark *'} / टिप्पणी *
              </Label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={
                  actionType === 'approve' ? 'Enter approval remark...' :
                  actionType === 'reject' ? 'Enter rejection reason...' :
                  'Enter escalation reason...'
                }
                rows={3}
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              />
            </div>
            
            {actionType === 'escalate' && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-yellow-400 text-sm">
                  ⚠️ This will escalate the request to Super Admin for final approval.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowActionDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleAction}
              className={
                actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                'bg-yellow-600 hover:bg-yellow-700'
              }
            >
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'escalate' && 'Escalate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ApprovalQueue;
