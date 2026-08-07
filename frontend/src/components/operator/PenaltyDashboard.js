import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, DollarSign, Clock, CheckCircle2, XCircle, RefreshCw, Loader2, TrendingUp, Calendar, CreditCard, Ban, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

const PENALTY_STATUS = {
  issued: { label: 'Issued / जारी', color: 'bg-red-500/20 text-red-400 border-red-500/40', icon: AlertCircle },
  paid: { label: 'Paid / भुगतान', color: 'bg-green-500/20 text-green-400 border-green-500/40', icon: CheckCircle2 },
  overdue: { label: 'Overdue / अतिदेय', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: AlertTriangle },
  waived: { label: 'Waived / माफ', color: 'bg-slate-500/20 text-slate-400 border-slate-500/40', icon: XCircle },
};

const PENALTY_TYPES = {
  'complaint_penalty': 'Complaint Penalty',
  'css_penalty': 'CSS Score Penalty',
  'non_cooperation': 'Non-Cooperation',
  'late_response': 'Late Response',
  'safety_violation': 'Safety Violation',
  'document_violation': 'Document Violation',
};

const PENALTY_RULES = {
  'first_serious_complaint': 'First Serious Complaint (₹10,000)',
  'two_complaints_30_days': '2 Complaints in 30 Days (₹20,000 + Suspension)',
  'three_complaints_60_days': '3+ Complaints in 60 Days (Delisting)',
  'css_below_60': 'CSS Below 60 (Suspension)',
  'css_below_50': 'CSS Below 50 (Delisting)',
  'non_cooperation': 'Non-Cooperation (₹5,000)',
  'late_response': 'Late Response (₹5,000)',
};

export default function PenaltyDashboard({ operatorId, compact = false }) {
  const [penalties, setPenalties] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);

  const loadPenalties = useCallback(async () => {
    if (!operatorId) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/complaints/penalties/operator/${operatorId}`);
      const penaltyList = response.data.penalties || [];
      setPenalties(penaltyList);
      
      // Calculate stats
      const total = penaltyList.length;
      const unpaid = penaltyList.filter(p => p.status === 'issued' || p.status === 'overdue');
      const unpaidAmount = unpaid.reduce((sum, p) => sum + (p.penalty_amount || 0), 0);
      const paidAmount = penaltyList.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.penalty_amount || 0), 0);
      
      setStats({
        total,
        unpaid: unpaid.length,
        unpaidAmount,
        paidAmount,
        overdue: penaltyList.filter(p => p.status === 'overdue' || (p.status === 'issued' && new Date(p.payment_due_date) < new Date())).length
      });
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error('Failed to load penalties');
      }
      setPenalties([]);
      setStats({ total: 0, unpaid: 0, unpaidAmount: 0, paidAmount: 0, overdue: 0 });
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    loadPenalties();
  }, [loadPenalties]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return 0;
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  if (loading) {
    return (
      <div className={`glass rounded-xl ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading penalties...</span>
        </div>
      </div>
    );
  }

  // Compact mode - just summary stats
  if (compact) {
    return (
      <div 
        className={`rounded-xl p-4 ${stats?.unpaid > 0 ? 'bg-red-500/10 border border-red-500/40' : 'bg-slate-800/50 border border-slate-700'}`}
        data-testid="penalty-widget-compact"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className={`h-5 w-5 ${stats?.unpaid > 0 ? 'text-red-400' : 'text-slate-400'}`} />
            <span className="text-sm text-slate-300">Penalties</span>
          </div>
          <div className="text-right">
            {stats?.unpaid > 0 ? (
              <div>
                <p className="text-red-400 font-bold">{formatCurrency(stats.unpaidAmount)}</p>
                <p className="text-xs text-red-400/70">{stats.unpaid} unpaid</p>
              </div>
            ) : (
              <div>
                <p className="text-green-400 font-semibold">Clear</p>
                <p className="text-xs text-slate-500">No pending</p>
              </div>
            )}
          </div>
        </div>
        {stats?.overdue > 0 && (
          <div className="mt-2 p-2 rounded bg-red-500/20 text-xs text-red-400">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {stats.overdue} overdue - pay immediately to avoid action
          </div>
        )}
      </div>
    );
  }

  // Full dashboard
  return (
    <div className="space-y-6" data-testid="penalty-dashboard-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-red-400" />
            Penalty Dashboard / जुर्माना डैशबोर्ड
          </h2>
          <p className="text-slate-400 text-sm mt-1">View and manage your penalty history</p>
        </div>
        <Button onClick={loadPenalties} variant="outline" size="sm" className="border-slate-600">
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl">
          <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
          <p className="text-xs text-slate-400">Total Penalties</p>
        </div>
        <div className={`p-4 rounded-xl ${stats?.unpaid > 0 ? 'bg-red-500/10 border border-red-500/40' : 'glass'}`}>
          <p className={`text-2xl font-bold ${stats?.unpaid > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatCurrency(stats?.unpaidAmount)}
          </p>
          <p className="text-xs text-slate-400">{stats?.unpaid || 0} Unpaid</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.paidAmount)}</p>
          <p className="text-xs text-slate-400">Total Paid</p>
        </div>
        <div className={`p-4 rounded-xl ${stats?.overdue > 0 ? 'bg-orange-500/10 border border-orange-500/40' : 'glass'}`}>
          <p className={`text-2xl font-bold ${stats?.overdue > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
            {stats?.overdue || 0}
          </p>
          <p className="text-xs text-slate-400">Overdue</p>
        </div>
      </div>

      {/* Urgent Warning */}
      {stats?.overdue > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-500/20">
              <AlertTriangle className="h-6 w-6 text-red-400 animate-pulse" />
            </div>
            <div>
              <p className="text-red-400 font-semibold">Overdue Penalties! / बकाया जुर्माना!</p>
              <p className="text-slate-400 text-sm">
                Pay immediately to avoid suspension or delisting. Contact support if you need payment plan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Penalties List */}
      <div className="space-y-3">
        {penalties.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-400" />
            <p className="text-green-400 mt-2 font-medium">No Penalties! / कोई जुर्माना नहीं</p>
            <p className="text-slate-500 text-sm mt-1">Keep up the excellent service!</p>
          </div>
        ) : (
          penalties.map((penalty) => {
            const status = PENALTY_STATUS[penalty.status] || PENALTY_STATUS.issued;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === penalty.penalty_id;
            const daysOverdue = getDaysOverdue(penalty.payment_due_date);
            const isOverdue = penalty.status === 'issued' && daysOverdue > 0;
            
            return (
              <div
                key={penalty.penalty_id}
                className={`glass rounded-xl overflow-hidden ${isOverdue ? 'border border-orange-500/40' : ''}`}
                data-testid={`penalty-${penalty.penalty_id}`}
              >
                {/* Header Row */}
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-800/30"
                  onClick={() => setExpandedId(isExpanded ? null : penalty.penalty_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${status.color.split(' ')[0]}`}>
                        <StatusIcon className={`h-5 w-5 ${status.color.split(' ')[1]}`} />
                      </div>
                      <div>
                        <p className="text-white font-semibold">
                          {formatCurrency(penalty.penalty_amount)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {PENALTY_TYPES[penalty.penalty_type] || penalty.penalty_type}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs border ${status.color}`}>
                        {status.label}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">
                          {daysOverdue} days overdue
                        </span>
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
                  <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Penalty ID</p>
                        <p className="text-white font-mono text-xs">{penalty.penalty_id}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Issued On</p>
                        <p className="text-white">{formatDate(penalty.issued_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Due Date</p>
                        <p className={isOverdue ? 'text-orange-400' : 'text-white'}>
                          {formatDate(penalty.payment_due_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Rule</p>
                        <p className="text-white text-xs">{PENALTY_RULES[penalty.penalty_rule] || penalty.penalty_rule}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-400">Reason</p>
                      <p className="text-slate-300 text-sm">{penalty.triggered_by || 'Complaint penalty'}</p>
                    </div>
                    
                    {penalty.suspension_triggered && (
                      <div className="p-2 rounded bg-red-500/20 text-red-400 text-sm">
                        <Ban className="h-4 w-4 inline mr-1" />
                        Suspension: {penalty.suspension_duration_days || 7} days
                      </div>
                    )}
                    
                    {penalty.delisting_triggered && (
                      <div className="p-2 rounded bg-red-500/30 text-red-400 text-sm font-semibold">
                        <XCircle className="h-4 w-4 inline mr-1" />
                        Account Delisted
                      </div>
                    )}
                    
                    {penalty.status === 'issued' && (
                      <div className="pt-2 border-t border-slate-700">
                        <Button className="w-full bg-blue-500 hover:bg-blue-600">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay Now / अभी भुगतान करें
                        </Button>
                        <p className="text-xs text-slate-500 text-center mt-2">
                          Contact support for payment issues: support@airyatra.com
                        </p>
                      </div>
                    )}
                    
                    {penalty.status === 'paid' && penalty.paid_at && (
                      <div className="p-2 rounded bg-green-500/10 text-green-400 text-sm">
                        <CheckCircle2 className="h-4 w-4 inline mr-1" />
                        Paid on {formatDate(penalty.paid_at)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Info Section */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
        <p className="text-sm text-blue-400 font-medium mb-2">Penalty Policy / जुर्माना नीति</p>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• First serious complaint: ₹10,000</li>
          <li>• 2 complaints in 30 days: ₹20,000 + 7-day suspension</li>
          <li>• 3+ complaints in 60 days: Automatic delisting</li>
          <li>• Late response to complaint: ₹5,000</li>
          <li>• CSS below 60: 7-14 day suspension</li>
          <li>• CSS below 50: Automatic delisting</li>
        </ul>
      </div>
    </div>
  );
}
