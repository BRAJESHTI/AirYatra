import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
  User, Plane, CreditCard, Ban, ChevronRight, MessageSquare,
  FileText, IndianRupee, Calendar, Filter, Search, Bell,
  ThumbsUp, ThumbsDown, Eye, History, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Action types requiring approval
const actionTypes = {
  booking_cancellation: {
    label: 'Booking Cancellation',
    icon: Ban,
    color: 'red',
    description: 'Cancel confirmed booking'
  },
  refund_request: {
    label: 'Refund Request',
    icon: IndianRupee,
    color: 'yellow',
    description: 'Process refund over ₹10,000'
  },
  flight_reschedule: {
    label: 'Flight Reschedule',
    icon: Calendar,
    color: 'blue',
    description: 'Reschedule confirmed flight'
  },
  pilot_reassignment: {
    label: 'Pilot Reassignment',
    icon: User,
    color: 'purple',
    description: 'Change assigned pilot'
  },
  aircraft_swap: {
    label: 'Aircraft Swap',
    icon: Plane,
    color: 'cyan',
    description: 'Change assigned aircraft'
  },
  price_override: {
    label: 'Price Override',
    icon: CreditCard,
    color: 'orange',
    description: 'Manual price adjustment'
  },
  document_deletion: {
    label: 'Document Deletion',
    icon: FileText,
    color: 'red',
    description: 'Delete important documents'
  }
};

function CommandCenter({ user }) {
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [processedApprovals, setProcessedApprovals] = useState([]);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedType, setSelectedType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [pendingRes, processedRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/approvals?status=pending`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/admin/approvals?status=processed&limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingApprovals(data.approvals || []);
      }
      if (processedRes.ok) {
        const data = await processedRes.json();
        setProcessedApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('Failed to load approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval) => {
    setProcessing(approval.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/approvals/${approval.id}/approve`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          approved_by: user?.id,
          notes: 'Approved via Command Center'
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Approval failed');
      }

      toast.success('Action approved and executed!');
      loadApprovals();
      setShowDetailModal(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (approval) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setProcessing(approval.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/approvals/${approval.id}/reject`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          rejected_by: user?.id,
          reason: rejectionReason
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Rejection failed');
      }

      toast.success('Action rejected');
      loadApprovals();
      setShowDetailModal(null);
      setRejectionReason('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProcessing(null);
    }
  };

  const getActionConfig = (type) => actionTypes[type] || {
    label: type,
    icon: AlertTriangle,
    color: 'slate',
    description: 'Pending action'
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Approved</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs">{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'critical':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs animate-pulse">CRITICAL</span>;
      case 'high':
        return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">MEDIUM</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs">LOW</span>;
    }
  };

  const filteredPending = pendingApprovals.filter(a => {
    if (selectedType !== 'all' && a.action_type !== selectedType) return false;
    if (searchTerm && !a.description?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !a.requested_by_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filteredProcessed = processedApprovals.filter(a => {
    if (selectedType !== 'all' && a.action_type !== selectedType) return false;
    if (searchTerm && !a.description?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !a.requested_by_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Stats
  const stats = {
    pending: pendingApprovals.length,
    critical: pendingApprovals.filter(a => a.priority === 'critical').length,
    approved: processedApprovals.filter(a => a.status === 'approved').length,
    rejected: processedApprovals.filter(a => a.status === 'rejected').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-orange-400" />
            Command Center / कमांड सेंटर
          </h2>
          <p className="text-slate-400 mt-1">Review and approve critical actions</p>
        </div>
        <Button onClick={loadApprovals} variant="outline" className="border-slate-600">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-900/30 to-slate-900 rounded-xl p-4 border border-yellow-700/30">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
          <p className="text-xs text-slate-500">Awaiting review</p>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-slate-900 rounded-xl p-4 border border-red-700/30">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">Critical</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{stats.critical}</p>
          <p className="text-xs text-slate-500">Needs immediate attention</p>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-slate-900 rounded-xl p-4 border border-green-700/30">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Approved</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{stats.approved}</p>
          <p className="text-xs text-slate-500">This week</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Rejected</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats.rejected}</p>
          <p className="text-xs text-slate-500">This week</p>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedTab('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedTab === 'pending' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Clock className="h-4 w-4" /> Pending ({stats.pending})
          </button>
          <button
            onClick={() => setSelectedTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              selectedTab === 'history' 
                ? 'bg-orange-500 text-white' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <History className="h-4 w-4" /> History
          </button>
        </div>

        <div className="flex gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="pl-10 w-48 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="all">All Types</option>
            {Object.entries(actionTypes).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : selectedTab === 'pending' ? (
        /* Pending Approvals */
        <div className="space-y-4">
          {filteredPending.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-white text-lg font-medium">All Clear!</p>
              <p className="text-slate-400 mt-2">No pending approvals at the moment</p>
            </div>
          ) : (
            filteredPending.map(approval => {
              const config = getActionConfig(approval.action_type);
              const Icon = config.icon;
              return (
                <div 
                  key={approval.id}
                  className={`bg-slate-800/50 rounded-xl border transition-all ${
                    approval.priority === 'critical' ? 'border-red-500/50 animate-pulse' :
                    approval.priority === 'high' ? 'border-orange-500/50' :
                    'border-slate-700'
                  }`}
                >
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${config.color}-500/20`}>
                        <Icon className={`h-6 w-6 text-${config.color}-400`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold">{config.label}</h3>
                          {getPriorityBadge(approval.priority)}
                        </div>
                        <p className="text-slate-400 text-sm">{approval.description}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          Requested by: {approval.requested_by_name || 'Unknown'} • 
                          {new Date(approval.created_at).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDetailModal(approval)}
                        className="border-slate-600"
                      >
                        <Eye className="h-4 w-4 mr-1" /> Details
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(approval)}
                        disabled={processing === approval.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {processing === approval.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><ThumbsUp className="h-4 w-4 mr-1" /> Approve</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowDetailModal(approval)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* History */
        <div className="space-y-4">
          {filteredProcessed.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
              <History className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No approval history</p>
            </div>
          ) : (
            filteredProcessed.map(approval => {
              const config = getActionConfig(approval.action_type);
              const Icon = config.icon;
              return (
                <div 
                  key={approval.id}
                  className="bg-slate-800/50 rounded-xl border border-slate-700"
                >
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${config.color}-500/20 opacity-60`}>
                        <Icon className={`h-5 w-5 text-${config.color}-400`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-medium">{config.label}</h3>
                          {getStatusBadge(approval.status)}
                        </div>
                        <p className="text-slate-400 text-sm">{approval.description}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {approval.status === 'approved' 
                            ? `Approved by: ${approval.approved_by_name || 'Admin'}`
                            : `Rejected by: ${approval.rejected_by_name || 'Admin'}`
                          } • {new Date(approval.processed_at || approval.updated_at).toLocaleString('en-IN')}
                        </p>
                        {approval.rejection_reason && (
                          <p className="text-red-400 text-xs mt-1">Reason: {approval.rejection_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Detail/Reject Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-lg border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Action Details</h3>
              <button onClick={() => { setShowDetailModal(null); setRejectionReason(''); }} className="text-slate-400 hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Action Type</p>
                <p className="text-white font-medium">{getActionConfig(showDetailModal.action_type).label}</p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Description</p>
                <p className="text-white">{showDetailModal.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Requested By</p>
                  <p className="text-white">{showDetailModal.requested_by_name || 'Unknown'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Priority</p>
                  {getPriorityBadge(showDetailModal.priority)}
                </div>
              </div>

              {showDetailModal.metadata && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-2">Additional Details</p>
                  <pre className="text-white text-xs overflow-auto">
                    {JSON.stringify(showDetailModal.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {showDetailModal.status === 'pending' && (
                <div>
                  <Label className="text-white">Rejection Reason (if rejecting)</Label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    rows={3}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              )}
            </div>

            {showDetailModal.status === 'pending' && (
              <div className="flex gap-3 mt-6">
                <Button 
                  onClick={() => handleReject(showDetailModal)}
                  disabled={processing === showDetailModal.id}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {processing === showDetailModal.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><ThumbsDown className="h-4 w-4 mr-2" /> Reject</>
                  )}
                </Button>
                <Button 
                  onClick={() => handleApprove(showDetailModal)}
                  disabled={processing === showDetailModal.id}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processing === showDetailModal.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><ThumbsUp className="h-4 w-4 mr-2" /> Approve</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CommandCenter;
