import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, 
  Download, FileText, Calendar, Search, Filter, Play,
  ArrowRightLeft, Building2, CreditCard, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/services/apiClient';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const statusColors = {
  matched: 'bg-green-500/20 text-green-400 border-green-500/30',
  unmatched: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  disputed: 'bg-red-500/20 text-red-400 border-red-500/30',
  pending: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
};

const statusIcons = {
  matched: CheckCircle2,
  unmatched: Clock,
  disputed: XCircle,
  pending: AlertTriangle
};

export default function PaymentReconciliation() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalTxns, setTotalTxns] = useState(0);
  const [running, setRunning] = useState(false);
  const [period, setPeriod] = useState('month');
  const [gateway, setGateway] = useState('all');
  const [status, setStatus] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPreview, setReportPreview] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await api.get(`/finance/reconciliation/summary?period=${period}`);
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, [period]);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (gateway !== 'all') params.append('gateway', gateway);
      if (status) params.append('status', status);
      
      const response = await api.get(`/finance/reconciliation/transactions?${params.toString()}`);
      setTransactions(response.data.transactions || []);
      setTotalTxns(response.data.total || 0);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [gateway, status]);

  useEffect(() => {
    fetchSummary();
    fetchTransactions();
  }, [fetchSummary, fetchTransactions]);

  const runAutoReconciliation = async () => {
    setRunning(true);
    try {
      const response = await api.post(`/finance/reconciliation/auto-match?gateway=${gateway !== 'all' ? gateway : ''}`);
      toast.success(`Reconciliation complete: ${response.data.matched} matched, ${response.data.failed} failed`);
      fetchSummary();
      fetchTransactions();
    } catch (error) {
      toast.error('Auto-reconciliation failed');
    } finally {
      setRunning(false);
    }
  };

  const fetchReportPreview = async () => {
    try {
      const response = await api.get(`/finance/reconciliation/reports/quick-summary?month=${reportMonth}&year=${reportYear}`);
      setReportPreview(response.data);
    } catch (error) {
      toast.error('Failed to load report preview');
    }
  };

  const generatePDFReport = async () => {
    setGeneratingReport(true);
    try {
      const response = await api.post('/finance/reconciliation/reports/monthly-pdf', {
        month: reportMonth,
        year: reportYear
      }, { responseType: 'blob' });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AirYatra_Finance_Report_${reportMonth}_${reportYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report downloaded successfully');
      setShowReportModal(false);
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="payment-reconciliation">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="h-7 w-7 text-purple-400" />
            Payment Reconciliation / भुगतान मिलान
          </h1>
          <p className="text-slate-400 mt-1">Auto-match gateway settlements with system transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20"
            onClick={() => { setShowReportModal(true); fetchReportPreview(); }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Button 
            onClick={runAutoReconciliation}
            disabled={running}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {running ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Auto-Match
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs">Total Transactions</p>
                <p className="text-2xl font-bold text-white mt-1">{summary?.summary?.total_transactions || 0}</p>
              </div>
              <CreditCard className="h-8 w-8 text-slate-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-600/20 to-green-800/20 border-green-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-xs">Matched</p>
                <p className="text-2xl font-bold text-white mt-1">{summary?.summary?.matched || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border-yellow-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-200 text-xs">Unmatched (System)</p>
                <p className="text-2xl font-bold text-white mt-1">{summary?.summary?.unmatched_system || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-600/20 to-red-800/20 border-red-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-200 text-xs">Disputed</p>
                <p className="text-2xl font-bold text-white mt-1">{summary?.summary?.disputed || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border-purple-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-xs">Match Rate</p>
                <p className="text-2xl font-bold text-white mt-1">{summary?.summary?.match_rate || 0}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Amount Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Matched Amount</p>
              <p className="text-2xl font-bold text-green-400">{formatINR(summary?.amounts?.total_matched)}</p>
            </div>
            <CheckCircle2 className="h-10 w-10 text-green-500/30" />
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Unmatched Amount</p>
              <p className="text-2xl font-bold text-orange-400">{formatINR(summary?.amounts?.total_unmatched)}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-orange-500/30" />
          </CardContent>
        </Card>
      </div>

      {/* Gateway Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(summary?.by_gateway || {}).map(([gw, data]) => (
          <Card key={gw} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className={`h-5 w-5 ${gw === 'stripe' ? 'text-indigo-400' : 'text-blue-400'}`} />
                <span className="text-white font-medium capitalize">{gw}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">System Txns</p>
                  <p className="text-white font-semibold">{data.transactions}</p>
                </div>
                <div>
                  <p className="text-slate-400">Settlements</p>
                  <p className="text-white font-semibold">{data.settlements}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transactions List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Transactions ({totalTxns})</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={gateway} onValueChange={setGateway}>
              <SelectTrigger className="w-32 bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="Gateway" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-white">All</SelectItem>
                <SelectItem value="stripe" className="text-white">Stripe</SelectItem>
                <SelectItem value="razorpay" className="text-white">Razorpay</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32 bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="" className="text-white">All Status</SelectItem>
                <SelectItem value="matched" className="text-white">Matched</SelectItem>
                <SelectItem value="unmatched" className="text-white">Unmatched</SelectItem>
                <SelectItem value="disputed" className="text-white">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((txn) => {
                const StatusIcon = statusIcons[txn.reconciliation_status] || Clock;
                return (
                  <div 
                    key={txn.id} 
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center gap-4">
                      <StatusIcon className={`h-5 w-5 ${
                        txn.reconciliation_status === 'matched' ? 'text-green-400' :
                        txn.reconciliation_status === 'disputed' ? 'text-red-400' :
                        'text-yellow-400'
                      }`} />
                      <div>
                        <p className="text-white font-medium">{txn.booking_id || txn.id}</p>
                        <p className="text-slate-400 text-sm">
                          {txn.gateway?.toUpperCase()} • {txn.payment_type} • {new Date(txn.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={`${statusColors[txn.reconciliation_status || 'pending']} border`}>
                        {txn.reconciliation_status || 'pending'}
                      </Badge>
                      <span className="text-white font-semibold">{formatINR(txn.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transactions found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Generation Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-400" />
              Generate Monthly Finance Report
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Month</label>
                <Select value={reportMonth.toString()} onValueChange={(v) => setReportMonth(parseInt(v))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Array.from({length: 12}, (_, i) => (
                      <SelectItem key={i+1} value={(i+1).toString()} className="text-white">
                        {new Date(2024, i, 1).toLocaleString('en', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Year</label>
                <Select value={reportYear.toString()} onValueChange={(v) => setReportYear(parseInt(v))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {[2024, 2025, 2026].map(y => (
                      <SelectItem key={y} value={y.toString()} className="text-white">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {reportPreview && (
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-white font-medium mb-3">Preview: {reportPreview.month}</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Revenue</p>
                    <p className="text-green-400 font-semibold">{formatINR(reportPreview.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Expenses</p>
                    <p className="text-red-400 font-semibold">{formatINR(reportPreview.expenses)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Net</p>
                    <p className={`font-semibold ${reportPreview.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatINR(reportPreview.net)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t border-slate-700">
                  <div>
                    <p className="text-slate-400">Transactions</p>
                    <p className="text-white">{reportPreview.transactions}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Bookings</p>
                    <p className="text-white">{reportPreview.bookings}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={generatePDFReport} 
              disabled={generatingReport}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {generatingReport ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
