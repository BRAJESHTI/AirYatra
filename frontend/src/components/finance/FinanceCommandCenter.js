import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Eye,
  DollarSign, Building2, Users, FileText, Clock, CheckCircle, XCircle,
  Bell, Shield, Zap, BarChart3, PieChart, Target, ArrowRight, Calendar,
  Banknote, CreditCard, Wallet, Receipt, Calculator, AlertCircle, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/services/apiClient';

// Format currency in Indian format
const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function FinanceCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [cashflowData, setCashflowData] = useState(null);
  const [dailySummary, setDailySummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [cashflowRes, summaryRes, transactionsRes] = await Promise.all([
        api.get('/finance/forecast/cashflow'),
        api.get('/finance/summary/daily'),
        api.get('/finance/transactions?limit=20')
      ]);
      setCashflowData(cashflowRes.data);
      setDailySummary(summaryRes.data);
      setRecentTransactions(transactionsRes.data.transactions || []);
    } catch (error) {
      console.error('Error fetching command center data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds for real-time monitoring
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const { current, expected_inflow, expected_outflow, forecast, ai_insights } = cashflowData || {};

  return (
    <div className="space-y-6" data-testid="finance-command-center">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-orange-400" />
            Finance Command Center / वित्त कमांड सेंटर
          </h1>
          <p className="text-slate-400 mt-1">24x7 Real-time financial monitoring & AI insights</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-full border border-green-500/50">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm font-medium">LIVE</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-slate-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* AI Insights Banner */}
      {ai_insights && ai_insights.length > 0 && (
        <div className="space-y-2">
          {ai_insights.map((insight, idx) => (
            <div 
              key={idx}
              className={`p-4 rounded-xl flex items-start gap-4 ${
                insight.type === 'danger' ? 'bg-gradient-to-r from-red-500/20 to-red-900/20 border border-red-500/50' :
                insight.type === 'warning' ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-900/20 border border-yellow-500/50' :
                insight.type === 'success' ? 'bg-gradient-to-r from-green-500/20 to-green-900/20 border border-green-500/50' :
                'bg-gradient-to-r from-blue-500/20 to-blue-900/20 border border-blue-500/50'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                insight.type === 'danger' ? 'bg-red-500/30' :
                insight.type === 'warning' ? 'bg-yellow-500/30' :
                insight.type === 'success' ? 'bg-green-500/30' :
                'bg-blue-500/30'
              }`}>
                <Zap className={`h-5 w-5 ${
                  insight.type === 'danger' ? 'text-red-400' :
                  insight.type === 'warning' ? 'text-yellow-400' :
                  insight.type === 'success' ? 'text-green-400' :
                  'text-blue-400'
                }`} />
              </div>
              <div>
                <span className="text-white font-medium">{insight.message}</span>
                <p className="text-slate-400 text-sm mt-1">AI-powered insight based on current financial data</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cash Flow Overview */}
      <div className="grid grid-cols-3 gap-4">
        {/* Current Position */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-slate-300">
              <Wallet className="h-5 w-5 text-purple-400" />
              Current Position / वर्तमान स्थिति
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Bank Balance</span>
              <span className="text-white font-semibold">{formatINR(current?.bank_balance)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Cash Balance</span>
              <span className="text-white font-semibold">{formatINR(current?.cash_balance)}</span>
            </div>
            <hr className="border-slate-700" />
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">Total</span>
              <span className="text-2xl font-bold text-emerald-400">{formatINR(current?.total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Expected Inflow */}
        <Card className="bg-gradient-to-br from-green-900/30 to-green-950/30 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-green-300">
              <TrendingDown className="h-5 w-5" />
              Expected Inflow / अपेक्षित आवक
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Collections</span>
              <span className="text-green-400 font-semibold">{formatINR(expected_inflow?.collections)}</span>
            </div>
            <hr className="border-green-500/20" />
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">Total Inflow</span>
              <span className="text-2xl font-bold text-green-400">{formatINR(expected_inflow?.total)}</span>
            </div>
            <p className="text-xs text-slate-400">Pending bookings & receivables</p>
          </CardContent>
        </Card>

        {/* Expected Outflow */}
        <Card className="bg-gradient-to-br from-red-900/30 to-red-950/30 border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-300">
              <TrendingUp className="h-5 w-5" />
              Expected Outflow / अपेक्षित जावक
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Vendor Payments</span>
              <span className="text-red-400 font-semibold">{formatINR(expected_outflow?.vendor_payments)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Salaries</span>
              <span className="text-red-400 font-semibold">{formatINR(expected_outflow?.salaries)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Settlements</span>
              <span className="text-red-400 font-semibold">{formatINR(expected_outflow?.operator_settlements)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">EMIs</span>
              <span className="text-red-400 font-semibold">{formatINR(expected_outflow?.emis)}</span>
            </div>
            <hr className="border-red-500/20" />
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">Total Outflow</span>
              <span className="text-2xl font-bold text-red-400">{formatINR(expected_outflow?.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Card */}
      <Card className={`border-2 ${
        forecast?.health === 'good' ? 'bg-gradient-to-r from-emerald-900/30 to-emerald-950/50 border-emerald-500/50' :
        forecast?.health === 'warning' ? 'bg-gradient-to-r from-yellow-900/30 to-yellow-950/50 border-yellow-500/50' :
        'bg-gradient-to-r from-red-900/30 to-red-950/50 border-red-500/50'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl ${
                forecast?.health === 'good' ? 'bg-emerald-500/20' :
                forecast?.health === 'warning' ? 'bg-yellow-500/20' :
                'bg-red-500/20'
              }`}>
                <Target className={`h-8 w-8 ${
                  forecast?.health === 'good' ? 'text-emerald-400' :
                  forecast?.health === 'warning' ? 'text-yellow-400' :
                  'text-red-400'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">30-Day Cash Flow Forecast</h3>
                <p className="text-slate-400">AI-projected financial position</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${
                forecast?.health === 'good' ? 'text-emerald-400' :
                forecast?.health === 'warning' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {formatINR(forecast?.projected_balance)}
              </p>
              <p className="text-slate-400 text-sm">Projected Balance</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                forecast?.health === 'good' ? 'bg-emerald-500/20 text-emerald-400' :
                forecast?.health === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {forecast?.health === 'good' ? '✓ Healthy' :
                 forecast?.health === 'warning' ? '⚠ Caution' :
                 '⚠ Critical'}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <span>Net Change: </span>
            <span className={`font-semibold ${(forecast?.net_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(forecast?.net_change || 0) >= 0 ? '+' : ''}{formatINR(forecast?.net_change)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Today's Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingDown className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Bank Credits</p>
                <p className="text-xl font-bold text-white">{formatINR(dailySummary?.bank?.collections)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Bank Debits</p>
                <p className="text-xl font-bold text-white">{formatINR(dailySummary?.bank?.payments)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Banknote className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Cash Received</p>
                <p className="text-xl font-bold text-white">{formatINR(dailySummary?.cash?.received)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Calculator className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Net Today</p>
                <p className={`text-xl font-bold ${(dailySummary?.total?.net || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(dailySummary?.total?.net || 0) >= 0 ? '+' : ''}{formatINR(dailySummary?.total?.net)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-400" />
            Recent Transactions / हाल के लेनदेन
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('all')}
              className={activeFilter === 'all' ? 'bg-blue-600' : 'border-slate-600'}
            >
              All
            </Button>
            <Button
              variant={activeFilter === 'credit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('credit')}
              className={activeFilter === 'credit' ? 'bg-green-600' : 'border-slate-600'}
            >
              Credits
            </Button>
            <Button
              variant={activeFilter === 'debit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('debit')}
              className={activeFilter === 'debit' ? 'bg-red-600' : 'border-slate-600'}
            >
              Debits
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No transactions recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions
                .filter(t => activeFilter === 'all' || t.transaction_type === activeFilter)
                .slice(0, 10)
                .map((transaction) => (
                <div 
                  key={transaction._id}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      transaction.transaction_type === 'credit' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {transaction.transaction_type === 'credit' ? 
                        <TrendingDown className="h-4 w-4 text-green-400" /> :
                        <TrendingUp className="h-4 w-4 text-red-400" />
                      }
                    </div>
                    <div>
                      <p className="text-white font-medium">{transaction.description}</p>
                      <p className="text-xs text-slate-400">
                        {transaction.bank_name} • {transaction.category}
                        {transaction.counterparty && ` • ${transaction.counterparty}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      transaction.transaction_type === 'credit' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {transaction.transaction_type === 'credit' ? '+' : '-'}{formatINR(transaction.amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(transaction.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
