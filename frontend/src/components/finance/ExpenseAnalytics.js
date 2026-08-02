import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart, RefreshCw, Filter,
  DollarSign, Calendar, ChevronRight, ArrowUp, ArrowDown, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import api from '@/services/apiClient';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const categoryColors = {
  fuel: '#ef4444',
  maintenance: '#f97316',
  insurance: '#eab308',
  salaries: '#22c55e',
  vendor: '#3b82f6',
  services: '#8b5cf6',
  equipment: '#ec4899',
  travel: '#06b6d4',
  marketing: '#14b8a6',
  other: '#6b7280'
};

export default function ExpenseAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get(`/finance/phase5/analytics/expenses?period=${selectedPeriod}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  const fetchDrilldown = async (category) => {
    try {
      const response = await api.get(`/finance/phase5/analytics/category/${category}`);
      setDrilldown(response.data);
      setSelectedCategory(category);
    } catch (error) {
      console.error('Error fetching drilldown:', error);
    }
  };

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

  const maxCategoryAmount = Math.max(...(analytics?.top_categories?.map(c => c.amount) || [1]));

  return (
    <div className="space-y-6" data-testid="expense-analytics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-rose-400" />
            Expense Analytics / खर्च विश्लेषण
          </h1>
          <p className="text-slate-400 mt-1">Spending trends by category with drill-down analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="day" className="text-white">Daily</SelectItem>
              <SelectItem value="week" className="text-white">Weekly</SelectItem>
              <SelectItem value="month" className="text-white">Monthly</SelectItem>
              <SelectItem value="quarter" className="text-white">Quarterly</SelectItem>
              <SelectItem value="year" className="text-white">Yearly</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-rose-600/30 to-rose-800/30 border-rose-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-rose-200 text-sm">Total Expenses</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(analytics?.total_expense)}</p>
              </div>
              <TrendingUp className="h-10 w-10 text-rose-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 border-blue-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">Avg Monthly</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(analytics?.average_monthly)}</p>
              </div>
              <Target className="h-10 w-10 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Categories</p>
                <p className="text-3xl font-bold text-white mt-1">{analytics?.top_categories?.length || 0}</p>
              </div>
              <PieChart className="h-10 w-10 text-slate-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Trend Chart */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-rose-400" />
            Expense Trend / खर्च का रुझान
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.expense_by_period && Object.keys(analytics.expense_by_period).length > 0 ? (
            <div className="h-64 flex items-end gap-2">
              {Object.entries(analytics.expense_by_period).slice(-12).map(([period, amount], idx) => {
                const maxAmount = Math.max(...Object.values(analytics.expense_by_period));
                const height = maxAmount > 0 ? (amount / maxAmount * 100) : 0;
                
                return (
                  <div key={period} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t hover:from-rose-500 hover:to-rose-300 transition-colors cursor-pointer"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${period}: ${formatINR(amount)}`}
                    />
                    <p className="text-xs text-slate-500 mt-2 -rotate-45 origin-left">
                      {period.length > 7 ? period.slice(-5) : period}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No expense data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown & Growth */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Categories */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-400" />
              Top Categories / शीर्ष श्रेणियाँ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics?.top_categories?.slice(0, 8).map((category, idx) => {
              const percentage = (category.amount / analytics.total_expense * 100) || 0;
              const color = categoryColors[category.category] || '#6b7280';
              
              return (
                <div 
                  key={category.category}
                  className="p-3 bg-slate-900/50 rounded-lg cursor-pointer hover:bg-slate-900 transition-colors"
                  onClick={() => fetchDrilldown(category.category)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-white capitalize">{category.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{formatINR(category.amount)}</span>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                  <Progress value={percentage} className="h-1.5" />
                  <p className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}% of total</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Growth Trend */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-400" />
              Growth Trend / वृद्धि रुझान
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics?.growth_trend?.slice(-8).map((item, idx) => (
              <div 
                key={item.period}
                className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">{item.period}</p>
                  <p className="text-sm text-slate-400">{formatINR(item.amount)}</p>
                </div>
                <div className={`flex items-center gap-1 ${
                  item.growth_rate >= 0 ? 'text-red-400' : 'text-green-400'
                }`}>
                  {item.growth_rate >= 0 ? 
                    <ArrowUp className="h-4 w-4" /> : 
                    <ArrowDown className="h-4 w-4" />
                  }
                  <span className="font-semibold">{Math.abs(item.growth_rate)}%</span>
                </div>
              </div>
            ))}
            {(!analytics?.growth_trend || analytics.growth_trend.length === 0) && (
              <div className="text-center py-8 text-slate-400">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No growth data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Drilldown */}
      {selectedCategory && drilldown && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-400" />
              {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Drilldown
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => { setSelectedCategory(null); setDrilldown(null); }}
              className="border-slate-600"
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-slate-400 text-sm">Total Amount</p>
                <p className="text-2xl font-bold text-white">{formatINR(drilldown.total_amount)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-slate-400 text-sm">Transactions</p>
                <p className="text-2xl font-bold text-white">{drilldown.transaction_count}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-slate-400 text-sm">Vendors</p>
                <p className="text-2xl font-bold text-white">{Object.keys(drilldown.by_vendor || {}).length}</p>
              </div>
            </div>
            
            <h4 className="text-white font-medium mb-3">Top Vendors</h4>
            <div className="space-y-2">
              {Object.entries(drilldown.by_vendor || {}).slice(0, 5).map(([vendor, amount]) => (
                <div key={vendor} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <span className="text-white">{vendor}</span>
                  <span className="text-slate-400 font-semibold">{formatINR(amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
