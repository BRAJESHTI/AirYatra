import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, TrendingUp, Clock, CreditCard, Users, FileText, 
  Download, RefreshCw, AlertTriangle, CheckCircle, ArrowUpRight,
  Calendar, Receipt, Wallet, ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminPaymentsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-7 w-7 text-orange-500" />
            Payments Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Monitor collections, pending balances & transactions</p>
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
    </div>
  );
}
