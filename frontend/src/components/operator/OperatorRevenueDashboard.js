import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, TrendingUp, Wallet, CreditCard, CheckCircle, Clock, 
  Calendar, RefreshCw, ArrowUpRight, ArrowDownRight, Percent, 
  Building2, Plane, PieChart, BarChart3, Download
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function OperatorRevenueDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadRevenueData();
  }, []);

  const loadRevenueData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/operator/revenue/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="revenue-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const monthlyData = data?.monthly_breakdown || [];
  const recentPayouts = data?.recent_payouts || [];
  const commissionBreakdown = data?.commission_breakdown || {};

  // Pie chart data for commission breakdown
  const pieData = [
    { name: 'Your Earnings', value: commissionBreakdown.operator_share || 0, color: '#22c55e' },
    { name: 'Platform Fee', value: commissionBreakdown.platform_fee || 0, color: '#f97316' },
    { name: 'Taxes', value: commissionBreakdown.taxes || 0, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 p-6" data-testid="operator-revenue-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-green-500" />
            Revenue Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Track your earnings, commissions & payouts</p>
        </div>
        <Button 
          onClick={loadRevenueData} 
          variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
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
                <p className="text-green-100 text-sm font-medium">Total Earnings</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="total-earnings">
                  {formatCurrency(stats.total_earnings)}
                </p>
                <p className="text-green-200 text-sm mt-1 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  {stats.completed_flights || 0} flights completed
                </p>
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
                <p className="text-blue-100 text-sm font-medium">This Month</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {formatCurrency(stats.month_earnings)}
                </p>
                <p className="text-blue-200 text-sm mt-1">
                  {stats.month_flights || 0} flights
                </p>
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
                <p className="text-purple-100 text-sm font-medium">Pending Payout</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {formatCurrency(stats.pending_payout)}
                </p>
                <p className="text-purple-200 text-sm mt-1">
                  Next: {stats.next_payout_date || 'TBD'}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Wallet className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-orange-100 text-sm font-medium">Commission Rate</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stats.commission_rate || 85}%
                </p>
                <p className="text-orange-200 text-sm mt-1">
                  Your share per booking
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Percent className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-800 border-slate-700 p-1">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Monthly Trend
          </TabsTrigger>
          <TabsTrigger 
            value="commission" 
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Commission Breakdown
          </TabsTrigger>
          <TabsTrigger 
            value="payouts" 
            className="data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            Payout History
          </TabsTrigger>
        </TabsList>

        {/* Monthly Trend Chart */}
        <TabsContent value="overview" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-500" />
                Monthly Earnings (Last 6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        labelStyle={{ color: '#22c55e' }}
                        formatter={(value) => [formatCurrency(value), 'Earnings']}
                      />
                      <Bar dataKey="earnings" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No earnings data yet</p>
                    <p className="text-sm mt-1">Complete flights to see your revenue</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Breakdown */}
        <TabsContent value="commission" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-green-500" />
                  Revenue Split
                </CardTitle>
                <CardDescription className="text-slate-400">
                  How your booking revenue is distributed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-500">
                    No commission data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Commission Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-slate-400 text-sm">Your Earnings</p>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(commissionBreakdown.operator_share)}
                      </p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-0 text-lg px-3">
                      {stats.commission_rate || 85}%
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-700">
                    <span className="text-slate-400">Gross Booking Value</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(commissionBreakdown.gross_value)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-700">
                    <span className="text-slate-400">Platform Fee (15%)</span>
                    <span className="text-orange-400">
                      - {formatCurrency(commissionBreakdown.platform_fee)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-700">
                    <span className="text-slate-400">GST & Taxes</span>
                    <span className="text-blue-400">
                      - {formatCurrency(commissionBreakdown.taxes)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-slate-900/50 rounded-lg px-3 -mx-3">
                    <span className="text-white font-semibold">Net Earnings</span>
                    <span className="text-2xl font-bold text-green-400">
                      {formatCurrency(commissionBreakdown.operator_share)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payout History */}
        <TabsContent value="payouts" className="mt-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-500" />
                Payout History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentPayouts.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No payouts yet</p>
                  <p className="text-sm mt-1">Payouts are processed weekly</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Date</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Period</th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">Flights</th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">Amount</th>
                        <th className="text-center py-3 px-4 text-slate-400 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPayouts.map((payout, idx) => (
                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-4 px-4 text-slate-300">
                            {formatDate(payout.paid_at || payout.created_at)}
                          </td>
                          <td className="py-4 px-4 text-slate-400">
                            {payout.period || '-'}
                          </td>
                          <td className="py-4 px-4 text-right text-white">
                            {payout.flight_count || 0}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-green-400 font-semibold">
                              {formatCurrency(payout.amount)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {payout.status === 'paid' ? (
                              <Badge className="bg-green-500/20 text-green-400 border-0">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Paid
                              </Badge>
                            ) : payout.status === 'pending' ? (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-0">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-500/20 text-slate-400 border-0">
                                {payout.status}
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-500 font-mono text-xs">
                            {payout.reference || payout.id?.slice(0, 12)}
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
