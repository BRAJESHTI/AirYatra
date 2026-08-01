import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  DollarSign, TrendingUp, Clock, CreditCard, Users, FileText, 
  Download, RefreshCw, AlertTriangle, CheckCircle, ArrowUpRight,
  Calendar, Receipt, Wallet, ChevronRight, Link2, MessageCircle,
  Mail, Copy, Send, FileSpreadsheet
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminPaymentsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [paymentLinkDialog, setPaymentLinkDialog] = useState({ open: false, data: null, loading: false });
  const [reminderLoading, setReminderLoading] = useState({});
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/payments/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load payments dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Generate Payment Link
  const generatePaymentLink = async (bookingId) => {
    setPaymentLinkDialog({ open: true, data: null, loading: true });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/payments/generate-payment-link/${bookingId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setPaymentLinkDialog({ open: true, data: json, loading: false });
      } else {
        toast.error(json.detail || 'Failed to generate link');
        setPaymentLinkDialog({ open: false, data: null, loading: false });
      }
    } catch (err) {
      toast.error('Failed to generate payment link');
      setPaymentLinkDialog({ open: false, data: null, loading: false });
    }
  };

  // Send Balance Reminder Email
  const sendBalanceReminder = async (bookingId) => {
    setReminderLoading(prev => ({ ...prev, [bookingId]: true }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/payments/send-balance-reminder/${bookingId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Reminder sent to ${json.customer_email}`);
      } else {
        toast.error(json.message || 'Failed to send reminder');
      }
    } catch (err) {
      toast.error('Failed to send reminder');
    } finally {
      setReminderLoading(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  // Export CSV
  const exportCSV = async (reportType) => {
    setExportLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/payments/export/csv?report_type=${reportType}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers.get('Content-Disposition');
        const filename = disposition?.match(/filename="(.+)"/)?.[1] || `AirYatra_${reportType}.csv`;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('CSV downloaded successfully');
      } else {
        toast.error('Failed to export CSV');
      }
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="payments-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const pendingBalances = data?.pending_balances || [];
  const recentTxns = data?.recent_transactions || [];
  const dailyBreakdown = data?.daily_breakdown || [];

  return (
    <div className="space-y-6" data-testid="admin-payments-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-7 w-7 text-orange-500" />
            Payments Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Monitor collections, pending balances & transactions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Export Dropdown */}
          <div className="relative group">
            <Button 
              variant="outline" 
              className="border-green-600 text-green-400 hover:bg-green-500/20"
              disabled={exportLoading}
              data-testid="export-csv-btn"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {exportLoading ? 'Exporting...' : 'Export CSV'}
            </Button>
            <div className="absolute right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button 
                onClick={() => exportCSV('transactions')}
                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 rounded-t-lg flex items-center gap-2"
              >
                <Receipt className="h-4 w-4" />
                All Transactions (30 days)
              </button>
              <button 
                onClick={() => exportCSV('daily_summary')}
                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Daily Summary
              </button>
              <button 
                onClick={() => exportCSV('pending_balances')}
                className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 rounded-b-lg flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Pending Balances
              </button>
            </div>
          </div>
          <Button 
            onClick={loadDashboard} 
            variant="outline" 
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
            data-testid="refresh-payments"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-100 text-sm font-medium">Today's Collections</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="today-total">
                  {formatCurrency(kpis.today_total || 0)}
                </p>
                <p className="text-green-200 text-sm mt-1">{kpis.today_count || 0} payments</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-sm font-medium">This Week</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="week-total">
                  {formatCurrency(kpis.week_total || 0)}
                </p>
                <p className="text-blue-200 text-sm mt-1">Last 7 days</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-purple-100 text-sm font-medium">This Month</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="month-total">
                  {formatCurrency(kpis.month_total || 0)}
                </p>
                <p className="text-purple-200 text-sm mt-1">Current month</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-orange-100 text-sm font-medium">Pending Balances</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="pending-total">
                  {formatCurrency(kpis.pending_balance_total || 0)}
                </p>
                <p className="text-orange-200 text-sm mt-1">{kpis.pending_balance_count || 0} bookings</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All-time Total */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <CreditCard className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">All-Time Collections</p>
              <p className="text-2xl font-bold text-white" data-testid="alltime-total">
                {formatCurrency(kpis.all_time_total || 0)}
              </p>
            </div>
          </div>
          <Badge className="bg-green-500/20 text-green-400 border-0 px-3 py-1">
            <CheckCircle className="h-4 w-4 mr-1" />
            Stripe Test Mode
          </Badge>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-800 border-slate-700 p-1">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
            data-testid="tab-overview"
          >
            Daily Trend
          </TabsTrigger>
          <TabsTrigger 
            value="pending" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
            data-testid="tab-pending"
          >
            Pending Balances ({pendingBalances.length})
          </TabsTrigger>
          <TabsTrigger 
            value="transactions" 
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white"
            data-testid="tab-transactions"
          >
            Recent Transactions
          </TabsTrigger>
        </TabsList>

        {/* Daily Trend Chart */}
        <TabsContent value="overview" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                Last 7 Days Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyBreakdown.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyBreakdown} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#f97316' }}
                        formatter={(value, name) => [formatCurrency(value), 'Amount']}
                      />
                      <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-500">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Balances */}
        <TabsContent value="pending" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Bookings with Pending Balance
              </CardTitle>
              <CardDescription className="text-slate-400">
                Customers who paid advance but remaining 50% is due
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingBalances.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p>All balances cleared! No pending payments.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Booking</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Customer</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Route</th>
                        <th className="text-right py-3 px-2 text-slate-400 font-medium">Total</th>
                        <th className="text-right py-3 px-2 text-slate-400 font-medium">Paid</th>
                        <th className="text-right py-3 px-2 text-slate-400 font-medium">Remaining</th>
                        <th className="text-center py-3 px-2 text-slate-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingBalances.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3 px-2">
                            <span className="text-orange-400 font-mono text-xs">
                              {item.inquiry_number || item.booking_id?.slice(0, 8)}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="text-white font-medium">{item.customer_name}</div>
                            <div className="text-slate-500 text-xs">{item.customer_email}</div>
                          </td>
                          <td className="py-3 px-2 text-slate-300">{item.route}</td>
                          <td className="py-3 px-2 text-right text-slate-300">
                            {formatCurrency(item.total_amount)}
                          </td>
                          <td className="py-3 px-2 text-right text-green-400">
                            {formatCurrency(item.paid)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Badge className="bg-orange-500/20 text-orange-400 border-0">
                              {formatCurrency(item.remaining)}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-green-400 hover:bg-green-500/20"
                                onClick={() => generatePaymentLink(item.booking_id)}
                                title="Generate Payment Link"
                                data-testid={`payment-link-${idx}`}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-blue-400 hover:bg-blue-500/20"
                                onClick={() => sendBalanceReminder(item.booking_id)}
                                disabled={reminderLoading[item.booking_id]}
                                title="Send Reminder Email"
                                data-testid={`reminder-${idx}`}
                              >
                                {reminderLoading[item.booking_id] ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Transactions */}
        <TabsContent value="transactions" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-orange-500" />
                Recent Successful Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTxns.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Date</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Booking</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Customer</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Type</th>
                        <th className="text-right py-3 px-2 text-slate-400 font-medium">Amount</th>
                        <th className="text-left py-3 px-2 text-slate-400 font-medium">Gateway</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTxns.map((txn, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3 px-2 text-slate-400 text-xs">
                            {formatDate(txn.paid_at)}
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-orange-400 font-mono text-xs">
                              {txn.inquiry_number}
                            </span>
                            <div className="text-slate-500 text-xs truncate max-w-[150px]">
                              {txn.route}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="text-white">{txn.customer_name}</div>
                          </td>
                          <td className="py-3 px-2">
                            <Badge className={`border-0 ${
                              txn.payment_type === 'balance' 
                                ? 'bg-purple-500/20 text-purple-400' 
                                : 'bg-blue-500/20 text-blue-400'
                            }`}>
                              {txn.payment_type === 'balance' ? 'Balance' : 'Advance'}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-green-400 font-semibold">
                              {formatCurrency(txn.amount)}
                            </span>
                            {txn.voucher_discount > 0 && (
                              <div className="text-xs text-slate-500">
                                -₹{txn.voucher_discount} voucher
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <Badge className="bg-slate-700 text-slate-300 border-0 text-xs">
                              {txn.gateway}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Link Dialog */}
      <Dialog open={paymentLinkDialog.open} onOpenChange={(open) => setPaymentLinkDialog({ ...paymentLinkDialog, open })}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Link2 className="h-5 w-5 text-green-500" />
              Payment Link Generated
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Share this link with customer for balance payment
            </DialogDescription>
          </DialogHeader>
          
          {paymentLinkDialog.loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : paymentLinkDialog.data ? (
            <div className="space-y-4">
              {/* Amount */}
              <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 rounded-xl p-4 text-center border border-orange-500/30">
                <p className="text-slate-400 text-sm">Balance Amount</p>
                <p className="text-3xl font-bold text-orange-400">
                  {formatCurrency(paymentLinkDialog.data.amount)}
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  Booking: #{paymentLinkDialog.data.inquiry_number}
                </p>
              </div>
              
              {/* Payment URL */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Payment Link</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={paymentLinkDialog.data.payment_url}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300"
                  />
                  <Button
                    variant="outline"
                    className="border-slate-600"
                    onClick={() => copyToClipboard(paymentLinkDialog.data.payment_url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* WhatsApp */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">WhatsApp Message</label>
                <textarea 
                  readOnly 
                  value={paymentLinkDialog.data.whatsapp_message}
                  className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 resize-none"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => window.open(paymentLinkDialog.data.whatsapp_url, '_blank')}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Share via WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => copyToClipboard(paymentLinkDialog.data.whatsapp_message)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Message
                </Button>
              </div>
              
              <p className="text-xs text-slate-500 text-center">
                Link valid for 7 days • Expires: {new Date(paymentLinkDialog.data.expires_at).toLocaleDateString()}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
