import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, BarChart3, RefreshCw, DollarSign, 
  CreditCard, AlertTriangle, CheckCircle, Calendar, Users,
  ArrowUp, ArrowDown, Wallet, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import api from '@/services/apiClient';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const gatewayColors = {
  stripe: '#6772e5',
  razorpay: '#2d8cf0',
  upi: '#128807',
  neft: '#ff9900',
  other: '#6b7280'
};

export default function FinanceAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revenueTrends, setRevenueTrends] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [collectionSummary, setCollectionSummary] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [revenuePeriod, setRevenuePeriod] = useState('6months');
  const [reconPeriod, setReconPeriod] = useState('month');

  const fetchData = useCallback(async () => {
    try {
      const [trendsRes, reconRes, summaryRes, customersRes] = await Promise.all([
        api.get(`/finance/analytics/revenue-trends?period=${revenuePeriod}`),
        api.get(`/finance/analytics/gateway-reconciliation?period=${reconPeriod}`),
        api.get('/finance/analytics/collection-summary'),
        api.get('/finance/analytics/top-customers?limit=5')
      ]);
      setRevenueTrends(trendsRes.data);
      setReconciliation(reconRes.data);
      setCollectionSummary(summaryRes.data);
      setTopCustomers(customersRes.data?.customers || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [revenuePeriod, reconPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const maxRevenue = Math.max(...(revenueTrends?.monthly_breakdown?.map(m => m.revenue) || [1]));

  return (
    <div className="space-y-6" data-testid="finance-analytics-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-indigo-400" />
            Finance Analytics / वित्त विश्लेषण
          </h1>
          <p className="text-slate-400 mt-1">Revenue trends, gateway reconciliation & collection insights</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { setRefreshing(true); fetchData(); }}
          disabled={refreshing}
          className="border-slate-600"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Collection Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-emerald-600/30 to-emerald-800/30 border-emerald-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-200 text-xs">{collectionSummary?.today?.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{formatINR(collectionSummary?.today?.amount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 border-blue-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs">{collectionSummary?.week?.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{formatINR(collectionSummary?.week?.amount)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 border-purple-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-xs">{collectionSummary?.month?.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{formatINR(collectionSummary?.month?.amount)}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-600/30 to-indigo-800/30 border-indigo-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-xs">{collectionSummary?.all_time?.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{formatINR(collectionSummary?.all_time?.amount)}</p>
              </div>
              <Wallet className="h-8 w-8 text-indigo-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-600/30 to-orange-800/30 border-orange-500/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-200 text-xs">Pending ({collectionSummary?.pending_balance?.count})</p>
                <p className="text-2xl font-bold text-white mt-1">{formatINR(collectionSummary?.pending_balance?.amount)}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="revenue" className="data-[state=active]:bg-indigo-600">
            Revenue Trends
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-purple-600">
            Gateway Reconciliation
          </TabsTrigger>
          <TabsTrigger value="customers" className="data-[state=active]:bg-emerald-600">
            Top Customers
          </TabsTrigger>
        </TabsList>

        {/* Revenue Trends Tab */}
        <TabsContent value="revenue">
          <div className="grid grid-cols-3 gap-4">
            {/* Monthly Revenue Chart */}
            <Card className="col-span-2 bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-400" />
                  Monthly Revenue Trend / मासिक राजस्व
                </CardTitle>
                <Select value={revenuePeriod} onValueChange={setRevenuePeriod}>
                  <SelectTrigger className="w-32 bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="3months" className="text-white">3 Months</SelectItem>
                    <SelectItem value="6months" className="text-white">6 Months</SelectItem>
                    <SelectItem value="12months" className="text-white">12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {revenueTrends?.monthly_breakdown?.length > 0 ? (
                  <div className="h-64 flex items-end gap-2">
                    {revenueTrends.monthly_breakdown.map((month, idx) => {
                      const height = maxRevenue > 0 ? (month.revenue / maxRevenue * 100) : 0;
                      
                      return (
                        <div key={month.month} className="flex-1 flex flex-col items-center">
                          <div className="relative w-full">
                            {/* Growth indicator */}
                            <div className={`text-xs mb-1 text-center ${
                              month.growth_rate >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {month.growth_rate > 0 ? '+' : ''}{month.growth_rate}%
                            </div>
                            {/* Stacked bar */}
                            <div 
                              className="w-full rounded-t relative overflow-hidden"
                              style={{ height: `${height * 2}px`, minHeight: '4px' }}
                            >
                              <div 
                                className="absolute bottom-0 w-full bg-indigo-500"
                                style={{ height: `${month.advance / (month.revenue || 1) * 100}%` }}
                              />
                              <div 
                                className="absolute bottom-0 w-full bg-purple-400"
                                style={{ 
                                  height: `${month.balance / (month.revenue || 1) * 100}%`,
                                  bottom: `${month.advance / (month.revenue || 1) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-2 -rotate-45 origin-left">
                            {month.month.slice(-5)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No revenue data available</p>
                  </div>
                )}
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-500 rounded" />
                    <span className="text-slate-400 text-sm">Advance Payments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-400 rounded" />
                    <span className="text-slate-400 text-sm">Balance Payments</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="space-y-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-5">
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">Total Revenue</p>
                    <p className="text-3xl font-bold text-white mt-2">{formatINR(revenueTrends?.total_revenue)}</p>
                    <p className="text-slate-500 text-sm mt-1">Last {revenuePeriod.replace('months', ' months')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-5">
                  <div className="text-center">
                    <p className="text-slate-400 text-sm">Avg Monthly</p>
                    <p className="text-3xl font-bold text-white mt-2">{formatINR(revenueTrends?.average_monthly)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-400">By Payment Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white">Advance</span>
                    <span className="text-indigo-400 font-semibold">{formatINR(revenueTrends?.by_payment_type?.advance)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white">Balance</span>
                    <span className="text-purple-400 font-semibold">{formatINR(revenueTrends?.by_payment_type?.balance)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-400">By Gateway</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(revenueTrends?.by_gateway || {}).filter(([_, v]) => v > 0).map(([gw, amount]) => (
                    <div key={gw} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: gatewayColors[gw] || '#6b7280' }} />
                        <span className="text-white capitalize">{gw}</span>
                      </div>
                      <span className="text-slate-400 font-medium">{formatINR(amount)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Gateway Reconciliation Tab */}
        <TabsContent value="reconciliation">
          <div className="grid grid-cols-3 gap-4">
            {/* Summary */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-400" />
                  Reconciliation Summary
                </CardTitle>
                <Select value={reconPeriod} onValueChange={setReconPeriod}>
                  <SelectTrigger className="w-28 bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="week" className="text-white">Week</SelectItem>
                    <SelectItem value="month" className="text-white">Month</SelectItem>
                    <SelectItem value="quarter" className="text-white">Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-400 text-sm">Total Collected</p>
                  <p className="text-2xl font-bold text-white">{formatINR(reconciliation?.summary?.total_collected)}</p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <p className="text-green-300 text-sm">Settled</p>
                  <p className="text-2xl font-bold text-green-400">{formatINR(reconciliation?.summary?.total_settled)}</p>
                </div>
                <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                  <p className="text-orange-300 text-sm">Pending Settlement</p>
                  <p className="text-2xl font-bold text-orange-400">{formatINR(reconciliation?.summary?.pending_settlement)}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-slate-400">Settlement Rate</span>
                  <span className="text-white font-bold">{reconciliation?.summary?.settlement_rate}%</span>
                </div>
                <Progress value={reconciliation?.summary?.settlement_rate || 0} className="h-2" />
              </CardContent>
            </Card>

            {/* By Gateway */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-400" />
                  By Gateway
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(reconciliation?.by_gateway || {}).map(([gw, data]) => (
                  <div key={gw} className="p-3 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: gatewayColors[gw] || '#6b7280' }} 
                        />
                        <span className="text-white font-medium capitalize">{gw}</span>
                      </div>
                      <Badge className="bg-slate-700 text-slate-300 border-0">
                        {data.count} txns
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-slate-500">Collected</p>
                        <p className="text-white font-semibold">{formatINR(data.collected)}</p>
                      </div>
                      <div>
                        <p className="text-green-400">Settled</p>
                        <p className="text-white font-semibold">{formatINR(data.settled)}</p>
                      </div>
                      <div>
                        <p className="text-orange-400">Pending</p>
                        <p className="text-white font-semibold">{formatINR(data.pending)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(reconciliation?.by_gateway || {}).length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No gateway data</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  Reconciliation Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {reconciliation?.alerts?.map((alert, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      alert.type === 'warning' 
                        ? 'bg-orange-500/10 border-orange-500/30' 
                        : 'bg-blue-500/10 border-blue-500/30'
                    }`}
                  >
                    <p className={`font-medium ${
                      alert.type === 'warning' ? 'text-orange-300' : 'text-blue-300'
                    }`}>
                      {alert.message}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">{alert.action}</p>
                  </div>
                ))}
                {(!reconciliation?.alerts || reconciliation.alerts.length === 0) && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400 opacity-80" />
                    <p className="text-green-400 font-medium">All Clear!</p>
                    <p className="text-slate-400 text-sm">No reconciliation issues</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Customers Tab */}
        <TabsContent value="customers">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                Top Customers by Revenue / शीर्ष ग्राहक
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length > 0 ? (
                <div className="space-y-3">
                  {topCustomers.map((customer, idx) => (
                    <div 
                      key={customer.user_id}
                      className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          idx === 1 ? 'bg-slate-400/20 text-slate-300' :
                          idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {idx < 3 ? (
                            <span className="text-lg font-bold">#{idx + 1}</span>
                          ) : (
                            <span className="text-sm">{idx + 1}</span>
                          )}
                        </div>
                        <div>
                          <h4 className="text-white font-medium">{customer.name}</h4>
                          <p className="text-sm text-slate-400">{customer.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-slate-400 text-xs">Bookings</p>
                          <p className="text-white font-semibold">{customer.booking_count}</p>
                        </div>
                        {customer.membership && customer.membership !== 'none' && (
                          <Badge className={`${
                            customer.membership === 'black' ? 'bg-slate-900 text-white' :
                            customer.membership === 'platinum' ? 'bg-purple-500/20 text-purple-300' :
                            customer.membership === 'gold' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-slate-500/20 text-slate-300'
                          } border-0 capitalize`}>
                            {customer.membership}
                          </Badge>
                        )}
                        <div className="text-right">
                          <p className="text-slate-400 text-xs">Revenue</p>
                          <p className="text-emerald-400 font-bold text-lg">{formatINR(customer.total_revenue)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No customer data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
