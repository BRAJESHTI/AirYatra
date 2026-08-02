import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, Building2, TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  Plus, ArrowUpRight, ArrowDownRight, DollarSign, PiggyBank, CreditCard,
  Clock, CheckCircle, XCircle, AlertCircle, ChevronRight, Eye, Calendar,
  BarChart3, PieChart, Banknote, Receipt, FileText, Bell, Calculator
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

export default function TreasuryDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState('overview'); // overview, banks, transactions
  const [showAddBankModal, setShowAddBankModal] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashRes, banksRes] = await Promise.all([
        api.get('/finance/treasury/dashboard'),
        api.get('/finance/bank-accounts')
      ]);
      setDashboardData(dashRes.data);
      setBankAccounts(banksRes.data.accounts || []);
    } catch (error) {
      console.error('Error fetching treasury data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const { summary, pending, upcoming, monthly, alerts } = dashboardData || {};

  return (
    <div className="space-y-6" data-testid="treasury-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="h-7 w-7 text-emerald-400" />
            Treasury Dashboard / खजाना डैशबोर्ड
          </h1>
          <p className="text-slate-400 mt-1">Real-time financial position for ₹100 Cr+ operations</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button 
            onClick={() => setShowAddBankModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Bank Account
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, idx) => (
            <div 
              key={idx}
              className={`p-3 rounded-lg flex items-center gap-3 ${
                alert.type === 'danger' ? 'bg-red-500/20 border border-red-500/50' :
                alert.type === 'warning' ? 'bg-yellow-500/20 border border-yellow-500/50' :
                'bg-blue-500/20 border border-blue-500/50'
              }`}
            >
              <AlertTriangle className={`h-5 w-5 ${
                alert.type === 'danger' ? 'text-red-400' :
                alert.type === 'warning' ? 'text-yellow-400' : 'text-blue-400'
              }`} />
              <span className="text-white text-sm">{alert.message}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                alert.priority === 'high' ? 'bg-red-500' : 'bg-slate-600'
              } text-white`}>
                {alert.priority?.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Main KPI Cards - Cash Position */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-600/30 to-emerald-800/30 border-emerald-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-200 text-sm">Cash in Hand / नकद</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(summary?.total_cash)}</p>
              </div>
              <PiggyBank className="h-10 w-10 text-emerald-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-600/30 to-blue-800/30 border-blue-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">Bank Balance / बैंक</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(summary?.total_bank_balance)}</p>
                <p className="text-xs text-blue-300 mt-1">{bankAccounts.length} accounts</p>
              </div>
              <Building2 className="h-10 w-10 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-600/30 to-purple-800/30 border-purple-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Total Available / उपलब्ध</p>
                <p className="text-3xl font-bold text-white mt-1">{formatINR(summary?.total_available)}</p>
              </div>
              <Wallet className="h-10 w-10 text-purple-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-600/30 to-orange-800/30 border-orange-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-200 text-sm">Net Today / आज का</p>
                <p className={`text-3xl font-bold mt-1 ${(summary?.net_today || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(summary?.net_today || 0) >= 0 ? '+' : ''}{formatINR(summary?.net_today)}
                </p>
              </div>
              {(summary?.net_today || 0) >= 0 ? 
                <TrendingUp className="h-10 w-10 text-green-400 opacity-80" /> :
                <TrendingDown className="h-10 w-10 text-red-400 opacity-80" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Collections & Payments */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-green-400">
              <ArrowDownRight className="h-5 w-5" />
              Today&apos;s Collection / आज की वसूली
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-white">{formatINR(summary?.today_collection)}</p>
            <p className="text-slate-400 text-sm mt-2">Credits received today</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-400">
              <ArrowUpRight className="h-5 w-5" />
              Today&apos;s Payments / आज का भुगतान
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-white">{formatINR(summary?.today_payment)}</p>
            <p className="text-slate-400 text-sm mt-2">Debits paid today</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Items Grid */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-500/50 cursor-pointer transition-colors">
          <CardContent className="p-4 text-center">
            <Receipt className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{pending?.gst || 0}</p>
            <p className="text-xs text-slate-400">GST Pending</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-500/50 cursor-pointer transition-colors">
          <CardContent className="p-4 text-center">
            <FileText className="h-6 w-6 text-orange-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{pending?.tds || 0}</p>
            <p className="text-xs text-slate-400">TDS Pending</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-500/50 cursor-pointer transition-colors">
          <CardContent className="p-4 text-center">
            <Building2 className="h-6 w-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{pending?.vendor_payments || 0}</p>
            <p className="text-xs text-slate-400">Vendor Bills</p>
            <p className="text-xs text-slate-500">{formatINR(pending?.vendor_amount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-500/50 cursor-pointer transition-colors">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-6 w-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{pending?.operator_settlements || 0}</p>
            <p className="text-xs text-slate-400">Settlements</p>
            <p className="text-xs text-slate-500">{formatINR(pending?.settlement_amount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-500/50 cursor-pointer transition-colors">
          <CardContent className="p-4 text-center">
            <RefreshCw className="h-6 w-6 text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{pending?.refunds || 0}</p>
            <p className="text-xs text-slate-400">Refunds</p>
            <p className="text-xs text-slate-500">{formatINR(pending?.refund_amount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            Bank Accounts / बैंक खाते
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAddBankModal(true)}
            className="border-slate-600"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          {bankAccounts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No bank accounts configured</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowAddBankModal(true)}
              >
                Add Your First Bank Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((account) => (
                <div 
                  key={account._id}
                  className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      account.is_primary ? 'bg-emerald-500/20' : 'bg-slate-700'
                    }`}>
                      <Building2 className={`h-6 w-6 ${account.is_primary ? 'text-emerald-400' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{account.bank_name}</span>
                        {account.is_primary && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Primary</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{account.account_name}</p>
                      <p className="text-xs text-slate-500">
                        A/C: ****{account.account_number?.slice(-4)} | {account.account_type?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{formatINR(account.current_balance)}</p>
                    <p className="text-xs text-slate-400">Current Balance</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Performance & Upcoming */}
      <div className="grid grid-cols-2 gap-4">
        {/* Monthly Performance */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              Monthly Performance / मासिक प्रदर्शन
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Revenue / राजस्व</span>
              <span className="text-green-400 font-semibold">{formatINR(monthly?.revenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Expenses / खर्च</span>
              <span className="text-red-400 font-semibold">{formatINR(monthly?.expenses)}</span>
            </div>
            <hr className="border-slate-700" />
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Profit / लाभ</span>
              <span className={`text-xl font-bold ${(monthly?.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatINR(monthly?.profit)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Margin</span>
              <span className={`font-semibold ${(monthly?.profit_margin || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {monthly?.profit_margin || 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-400" />
              Upcoming (30 Days) / आगामी
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-orange-400" />
                <span className="text-slate-300">EMIs ({upcoming?.emi_count || 0})</span>
              </div>
              <span className="text-orange-400 font-semibold">{formatINR(upcoming?.emi_amount)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-400" />
                <span className="text-slate-300">Insurance ({upcoming?.insurance_count || 0})</span>
              </div>
              <span className="text-blue-400 font-semibold">{formatINR(upcoming?.insurance_amount)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5 text-yellow-400" />
                <span className="text-slate-300">Salary Pending</span>
              </div>
              <span className="text-yellow-400 font-semibold">{formatINR(pending?.salary_amount)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Bank Account Modal */}
      {showAddBankModal && (
        <AddBankAccountModal 
          onClose={() => setShowAddBankModal(false)}
          onSuccess={() => {
            setShowAddBankModal(false);
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
}

// Add Bank Account Modal Component
function AddBankAccountModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    ifsc_code: '',
    branch: '',
    account_type: 'current',
    opening_balance: '',
    is_primary: false,
    notes: ''
  });

  const bankOptions = [
    'ICICI Bank', 'HDFC Bank', 'State Bank of India', 'Axis Bank', 
    'Bank of Baroda', 'Yes Bank', 'Kotak Mahindra', 'Punjab National Bank',
    'Canara Bank', 'IDBI Bank', 'Other'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/finance/bank-accounts', {
        ...formData,
        opening_balance: parseFloat(formData.opening_balance) || 0
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding bank account:', error);
      alert(error.response?.data?.detail || 'Failed to add bank account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-400" />
          Add Bank Account / बैंक खाता जोड़ें
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Bank Name / बैंक का नाम *</label>
            <select
              value={formData.bank_name}
              onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              required
            >
              <option value="">Select Bank</option>
              {bankOptions.map(bank => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Account Name / खाते का नाम *</label>
            <input
              type="text"
              value={formData.account_name}
              onChange={(e) => setFormData({...formData, account_name: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              placeholder="e.g., Main Operating Account"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account Number *</label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">IFSC Code *</label>
              <input
                type="text"
                value={formData.ifsc_code}
                onChange={(e) => setFormData({...formData, ifsc_code: e.target.value.toUpperCase()})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                placeholder="e.g., ICIC0001234"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Branch *</label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => setFormData({...formData, branch: e.target.value})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Account Type</label>
              <select
                value={formData.account_type}
                onChange={(e) => setFormData({...formData, account_type: e.target.value})}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="current">Current Account</option>
                <option value="savings">Savings Account</option>
                <option value="overdraft">Overdraft</option>
                <option value="fixed_deposit">Fixed Deposit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Opening Balance (₹)</label>
            <input
              type="number"
              value={formData.opening_balance}
              onChange={(e) => setFormData({...formData, opening_balance: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              placeholder="0"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={formData.is_primary}
              onChange={(e) => setFormData({...formData, is_primary: e.target.checked})}
              className="rounded border-slate-600"
            />
            <label htmlFor="is_primary" className="text-slate-300 text-sm">
              Set as Primary Account / मुख्य खाता बनाएं
            </label>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="flex-1 border-slate-600"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
