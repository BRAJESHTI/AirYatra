import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, Download, Search, Filter, Clock, CheckCircle2, 
  XCircle, AlertCircle, FileText, ChevronRight, Loader2,
  Calendar, CreditCard, Info, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '../../services/api';
import { toast } from 'sonner';

/**
 * Refund History Page Component
 * Shows customer's refund history with status tracking
 */
export default function RefundHistory({ userId }) {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRefund, setSelectedRefund] = useState(null);

  useEffect(() => {
    loadRefunds();
  }, []);

  const loadRefunds = async () => {
    setLoading(true);
    try {
      // For customers, this would be filtered by user ID on backend
      const res = await api.get('/refunds/admin/list?limit=100');
      if (res.data.success) {
        setRefunds(res.data.refunds || []);
      }
    } catch (err) {
      console.error('Failed to load refunds:', err);
      // Try customer endpoint if admin fails
      try {
        const res = await api.get('/refunds/my-refunds');
        if (res.data.success) {
          setRefunds(res.data.refunds || []);
        }
      } catch {
        toast.error('Failed to load refund history');
      }
    }
    setLoading(false);
  };

  const downloadReceipt = async (refundId) => {
    try {
      const response = await api.get(`/receipts/refund/${refundId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AirYatra_Refund_${refundId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Receipt downloaded!');
    } catch (err) {
      toast.error('Failed to download receipt');
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      SUCCESS: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', label: 'Completed' },
      PENDING: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Processing' },
      FAILED: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Failed' },
      INITIATED: { icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Initiated' }
    };
    return configs[status] || configs.PENDING;
  };

  const filteredRefunds = refunds.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.id?.toLowerCase().includes(term) ||
      r.booking_id?.toLowerCase().includes(term) ||
      r.refund_reason?.toLowerCase().includes(term)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-orange-500" />
            Refund History
          </h2>
          <p className="text-sm text-slate-500">Track your cancellations and refunds</p>
        </div>
        <Button variant="outline" onClick={loadRefunds} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ID, booking, or reason..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border">
          <p className="text-sm text-slate-500">Total Refunds</p>
          <p className="text-2xl font-bold">{refunds.length}</p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border">
          <p className="text-sm text-slate-500">Total Amount</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{refunds.reduce((sum, r) => sum + (r.refund_amount || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-green-600">
            {refunds.filter(r => r.gateway_status === 'SUCCESS').length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border">
          <p className="text-sm text-slate-500">Processing</p>
          <p className="text-2xl font-bold text-yellow-600">
            {refunds.filter(r => r.gateway_status === 'PENDING').length}
          </p>
        </div>
      </div>

      {/* Refunds List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : filteredRefunds.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border">
          <RotateCcw className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600">No Refunds Found</h3>
          <p className="text-sm text-slate-400 mt-1">
            {searchTerm ? 'Try a different search term' : 'You haven\'t made any cancellations yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRefunds.map((refund) => {
            const statusConfig = getStatusConfig(refund.gateway_status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={refund.id}
                className="p-4 bg-white dark:bg-slate-800 rounded-xl border hover:border-orange-300 transition-all cursor-pointer"
                onClick={() => setSelectedRefund(selectedRefund?.id === refund.id ? null : refund)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={`p-2 rounded-full ${statusConfig.bg}`}>
                      <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                    </div>

                    {/* Main Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">Refund #{refund.id?.slice(0, 8)}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Booking: {refund.booking_id?.slice(0, 8)} • {refund.payment_gateway}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(refund.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      ₹{(refund.refund_amount || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      of ₹{(refund.original_amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedRefund?.id === refund.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {/* Deduction Breakdown */}
                    {refund.deductions && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                        <p className="text-sm font-medium mb-2">Deduction Breakdown</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Original Amount</span>
                            <span>₹{(refund.original_amount || 0).toLocaleString()}</span>
                          </div>
                          {refund.deductions.cancellation_deduction && (
                            <div className="flex justify-between text-red-500">
                              <span>Cancellation ({refund.deductions.cancellation_deduction.percent}%)</span>
                              <span>-₹{refund.deductions.cancellation_deduction.amount?.toLocaleString()}</span>
                            </div>
                          )}
                          {refund.deductions.processing_fee && (
                            <div className="flex justify-between text-red-500">
                              <span>Processing Fee</span>
                              <span>-₹{refund.deductions.processing_fee.amount?.toLocaleString()}</span>
                            </div>
                          )}
                          {refund.deductions.admin_fee && (
                            <div className="flex justify-between text-red-500">
                              <span>Admin Fee</span>
                              <span>-₹{refund.deductions.admin_fee?.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold pt-2 border-t mt-2">
                            <span>Net Refund</span>
                            <span className="text-green-600">₹{(refund.refund_amount || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reason */}
                    {refund.refund_reason && (
                      <div>
                        <p className="text-sm font-medium">Reason</p>
                        <p className="text-sm text-slate-500">{refund.refund_reason}</p>
                      </div>
                    )}

                    {/* Rule Applied */}
                    {refund.rule_applied && (
                      <div className="flex items-start gap-2 text-sm">
                        <Info className="h-4 w-4 text-slate-400 mt-0.5" />
                        <span className="text-slate-500">{refund.rule_applied}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadReceipt(refund.id);
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download Receipt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info Note */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Refund Processing Time</p>
            <p className="text-sm text-blue-600 mt-1">
              Refunds are typically processed within 5-7 business days and will be credited to your original payment method.
              For PayPal refunds, the amount will be in USD equivalent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
