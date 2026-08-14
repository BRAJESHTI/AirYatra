import React, { useState, useEffect, useCallback } from 'react';
import { 
  Target, TrendingUp, TrendingDown, RefreshCw, Plus, BarChart3,
  DollarSign, AlertTriangle, CheckCircle, Calendar, Filter, Edit2,
  PieChart, ArrowUp, ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const categoryLabels = {
  fuel_expenses: 'Fuel',
  maintenance: 'Maintenance',
  pilot_salaries: 'Pilot Salaries',
  crew_salaries: 'Crew Salaries',
  insurance: 'Insurance',
  hangar_rental: 'Hangar Rental',
  vendor_payments: 'Vendor Payments',
  marketing: 'Marketing',
  office_expenses: 'Office Expenses',
  travel: 'Travel',
  legal_compliance: 'Legal & Compliance',
  gst_tds: 'GST & TDS',
  utilities: 'Utilities',
  software_licenses: 'Software',
  training: 'Training',
  miscellaneous: 'Misc'
};

export default function BudgetVsActual() {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState({});
  const [categories, setCategories] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [newBudget, setNewBudget] = useState({
    category: '',
    month: selectedMonth,
    planned_amount: '',
    notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [budgetsRes, comparisonRes] = await Promise.all([
        api.get(`/finance/phase4/budget?month=${selectedMonth}`),
        api.get('/finance/phase4/budget/comparison?months=6')
      ]);
      setBudgets(budgetsRes.data.budgets || []);
      setSummary(budgetsRes.data.summary || {});
      setCategories(budgetsRes.data.categories || []);
      setComparison(comparisonRes.data.comparison || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBudget = async () => {
    try {
      await api.post('/finance/phase4/budget', {
        ...newBudget,
        month: selectedMonth,
        planned_amount: parseFloat(newBudget.planned_amount)
      });
      toast.success('Budget created/updated');
      setShowAddModal(false);
      setNewBudget({ category: '', month: selectedMonth, planned_amount: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create budget');
    }
  };

  const getVarianceColor = (variance, planned) => {
    if (planned === 0) return 'text-slate-400';
    const percent = (variance / planned) * 100;
    if (percent > 20) return 'text-green-400';
    if (percent > 0) return 'text-blue-400';
    if (percent > -10) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="budget-vs-actual">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="h-7 w-7 text-blue-400" />
            Budget vs Actual</h1>
          <p className="text-slate-400 mt-1">Track planned vs actual spending across categories</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40 bg-slate-800 border-slate-700 text-white"
          />
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
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Set Budget
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 border-blue-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">Total Budget</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(summary.total_planned)}</p>
              </div>
              <Target className="h-10 w-10 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 border-purple-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Actual Spent</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(summary.total_actual)}</p>
              </div>
              <DollarSign className="h-10 w-10 text-purple-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${summary.total_variance >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${summary.total_variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>Variance</p>
                <p className={`text-3xl font-bold mt-1 ${summary.total_variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {summary.total_variance >= 0 ? '+' : ''}{formatINR(summary.total_variance)}
                </p>
              </div>
              {summary.total_variance >= 0 ? 
                <TrendingDown className="h-10 w-10 text-green-400 opacity-80" /> :
                <TrendingUp className="h-10 w-10 text-red-400 opacity-80" />
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Utilization</p>
                <p className="text-3xl font-bold text-white mt-1">{summary.utilization_percent || 0}%</p>
              </div>
              <PieChart className="h-10 w-10 text-slate-400 opacity-80" />
            </div>
            <Progress value={summary.utilization_percent || 0} className="mt-3 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Budget by Category */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-400" />
            Budget by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No budgets set for {selectedMonth}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowAddModal(true)}
              >
                Set Your First Budget
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map(budget => {
                const utilization = budget.planned_amount > 0 
                  ? (budget.actual_amount / budget.planned_amount * 100) 
                  : 0;
                const isOverBudget = budget.variance < 0;
                
                return (
                  <div 
                    key={budget.id || budget._id}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-white font-medium">
                          {categoryLabels[budget.category] || budget.category}
                        </h4>
                        {budget.notes && (
                          <p className="text-xs text-slate-500">{budget.notes}</p>
                        )}
                      </div>
                      <Badge className={`${isOverBudget ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'} border-0`}>
                        {isOverBudget ? 
                          <><ArrowUp className="h-3 w-3 mr-1" />Over Budget</> :
                          <><ArrowDown className="h-3 w-3 mr-1" />Under Budget</>
                        }
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Planned</p>
                        <p className="text-white font-semibold">{formatINR(budget.planned_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Actual</p>
                        <p className="text-white font-semibold">{formatINR(budget.actual_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Variance</p>
                        <p className={`font-semibold ${getVarianceColor(budget.variance, budget.planned_amount)}`}>
                          {budget.variance >= 0 ? '+' : ''}{formatINR(budget.variance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Utilization</p>
                        <p className="text-white font-semibold">{utilization.toFixed(1)}%</p>
                      </div>
                    </div>
                    <Progress 
                      value={Math.min(utilization, 100)} 
                      className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-emerald-500'}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6-Month Comparison Chart */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            6-Month Trend / 6          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-48 gap-4">
            {comparison.map((month, idx) => {
              const maxValue = Math.max(...comparison.map(m => Math.max(m.planned, m.actual)));
              const plannedHeight = maxValue > 0 ? (month.planned / maxValue * 100) : 0;
              const actualHeight = maxValue > 0 ? (month.actual / maxValue * 100) : 0;
              
              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="flex gap-1 items-end h-36 w-full">
                    <div 
                      className="flex-1 bg-blue-500/30 rounded-t"
                      style={{ height: `${plannedHeight}%` }}
                      title={`Planned: ${formatINR(month.planned)}`}
                    />
                    <div 
                      className="flex-1 bg-purple-500/50 rounded-t"
                      style={{ height: `${actualHeight}%` }}
                      title={`Actual: ${formatINR(month.actual)}`}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{month.month?.slice(5)}</p>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500/30 rounded" />
              <span className="text-xs text-slate-400">Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500/50 rounded" />
              <span className="text-xs text-slate-400">Actual</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Budget Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-400" />
              Set Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Category *</label>
              <Select 
                value={newBudget.category} 
                onValueChange={(v) => setNewBudget({...newBudget, category: v})}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-white">
                      {categoryLabels[cat] || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Month</label>
              <Input 
                type="month"
                value={selectedMonth}
                disabled
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Planned Amount (₹) *</label>
              <Input 
                type="number"
                value={newBudget.planned_amount}
                onChange={(e) => setNewBudget({...newBudget, planned_amount: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Notes</label>
              <Input 
                value={newBudget.notes}
                onChange={(e) => setNewBudget({...newBudget, notes: e.target.value})}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBudget}
              disabled={!newBudget.category || !newBudget.planned_amount}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Set Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
