import React, { useState, useEffect } from 'react';
import { LogOut, Plane, Home, DollarSign, FileText, CreditCard, TrendingUp, ChevronDown, ChevronRight, BarChart3, Settings, Calculator, Receipt, Wallet, PieChart, Building2, RefreshCw, Users, BanknoteIcon, Percent, CheckCircle, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/shared/NotificationBell';
import api from '@/services/apiClient';

// Import Finance Components
import SettlementManagement from '@/components/admin/SettlementManagement';
import InvoiceManagement from '@/components/admin/InvoiceManagement';
import DynamicPricing from '@/components/admin/DynamicPricing';
import AccountingIntegration from '@/components/admin/AccountingIntegration';
import CurrencyConverter from '@/components/admin/CurrencyConverter';

// Lazy load new Finance components
const BulkSalaryPayment = React.lazy(() => import('@/components/finance/BulkSalaryPayment'));
const VendorBillPayment = React.lazy(() => import('@/components/finance/VendorBillPayment'));
const TDSConfiguration = React.lazy(() => import('@/components/finance/TDSConfiguration'));
const ApprovalWorkflow = React.lazy(() => import('@/components/finance/ApprovalWorkflow'));
const GSTDashboard = React.lazy(() => import('@/components/finance/GSTDashboard'));
const GSTReturns = React.lazy(() => import('@/components/finance/GSTReturns'));
const GSTPayments = React.lazy(() => import('@/components/finance/GSTPayments'));
const ITCManagement = React.lazy(() => import('@/components/finance/ITCManagement'));
const VendorCompliance = React.lazy(() => import('@/components/finance/VendorCompliance'));

// Organized Navigation Structure - 7 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Dashboard / डैशबोर्ड',
    icon: Home,
    items: [
      { id: 'overview', label: 'Overview / ओवरव्यू', icon: BarChart3 },
      { id: 'pending_approvals', label: 'Pending Approvals', icon: Clock, highlight: true },
    ]
  },
  {
    id: 'payroll',
    label: 'Payroll / वेतन',
    icon: BanknoteIcon,
    items: [
      { id: 'bulk_salary', label: 'Bulk Salary Payment', icon: Users, highlight: true },
      { id: 'approval_workflow', label: 'Approval Workflow', icon: CheckCircle },
    ]
  },
  {
    id: 'vendors',
    label: 'Vendors / वेंडर',
    icon: Building2,
    items: [
      { id: 'vendor_bills', label: 'Vendor Bill Payment', icon: Receipt, highlight: true },
      { id: 'tds_config', label: 'TDS Configuration', icon: Percent },
    ]
  },
  {
    id: 'billing',
    label: 'Billing / बिलिंग',
    icon: Receipt,
    items: [
      { id: 'invoices', label: 'Invoice & GST Billing', icon: FileText, highlight: true },
      { id: 'payments', label: 'Payments / भुगतान', icon: CreditCard },
      { id: 'refunds', label: 'Refunds / वापसी', icon: RefreshCw },
    ]
  },
  {
    id: 'gst',
    label: 'GST Compliance / GST',
    icon: FileText,
    items: [
      { id: 'gst_dashboard', label: 'GST Dashboard', icon: BarChart3, highlight: true },
      { id: 'gst_returns', label: 'File GST Returns', icon: FileText },
      { id: 'gst_payments', label: 'GST Payments', icon: CreditCard },
      { id: 'itc_management', label: 'Input/Output ITC', icon: TrendingUp },
      { id: 'vendor_compliance', label: 'Vendor Compliance', icon: Building2 },
    ]
  },
  {
    id: 'settlements',
    label: 'Settlements / निपटान',
    icon: DollarSign,
    items: [
      { id: 'all_settlements', label: 'All Settlements / सभी', icon: DollarSign },
      { id: 'operator_payouts', label: 'Operator Payouts', icon: Building2 },
      { id: 'helipad_payouts', label: 'Helipad Payouts', icon: Building2 },
    ]
  },
  {
    id: 'accounting',
    label: 'Accounting / लेखा',
    icon: FileText,
    items: [
      { id: 'accounting_integration', label: 'Tally/QuickBooks', icon: FileText },
      { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
    ]
  },
];

function FinanceDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['main', 'payroll']);
  const [stats, setStats] = useState({
    total_revenue: 1250000,
    pending_settlements: 45000,
    this_month: 350000,
    pending_invoices: 12,
    pending_approvals: 0
  });

  useEffect(() => {
    let isMounted = true;
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/payments/finance/dashboard');
        if (response.data && isMounted) {
          setStats(prev => ({
            ...prev,
            pending_approvals: response.data.pending_approvals || 0,
            pending_settlements: response.data.today_transactions?.total_amount || prev.pending_settlements
          }));
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      }
    };
    fetchDashboardData();
    return () => { isMounted = false; };
  }, []);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleNavClick = (itemId, groupId) => {
    setActiveTab(itemId);
    if (!expandedGroups.includes(groupId)) {
      setExpandedGroups(prev => [...prev, groupId]);
    }
  };

  const getActiveGroup = () => {
    for (const group of navGroups) {
      if (group.items.some(item => item.id === activeTab)) {
        return group.id;
      }
    }
    return null;
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'all_settlements':
      case 'pending_settlements':
        return <SettlementManagement />;
      case 'invoices':
        return <InvoiceManagement />;
      case 'dynamic_pricing':
        return <DynamicPricing />;
      case 'accounting_integration':
        return <AccountingIntegration />;
      case 'currency':
        return <CurrencyConverter />;
      case 'bulk_salary':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <BulkSalaryPayment />
          </React.Suspense>
        );
      case 'approval_workflow':
      case 'pending_approvals':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <ApprovalWorkflow userRole={user?.role} />
          </React.Suspense>
        );
      case 'vendor_bills':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <VendorBillPayment />
          </React.Suspense>
        );
      case 'tds_config':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <TDSConfiguration />
          </React.Suspense>
        );
      // GST Compliance Routes - Individual Components
      case 'gst_dashboard':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <GSTDashboard />
          </React.Suspense>
        );
      case 'gst_returns':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <GSTReturns />
          </React.Suspense>
        );
      case 'gst_payments':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <GSTPayments />
          </React.Suspense>
        );
      case 'itc_management':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <ITCManagement />
          </React.Suspense>
        );
      case 'vendor_compliance':
        return (
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-500" /></div>}>
            <VendorCompliance />
          </React.Suspense>
        );
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Finance Dashboard / वित्त डैशबोर्ड</h1>
              <p className="text-slate-400">Revenue, settlements, payroll and vendor payments</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
                <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{(stats.total_revenue / 100000).toFixed(1)}L</p>
                <p className="text-slate-400 text-sm">Total Revenue / कुल राजस्व</p>
              </div>
              <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/50">
                <DollarSign className="h-5 w-5 text-yellow-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{(stats.pending_settlements / 1000).toFixed(0)}K</p>
                <p className="text-slate-400 text-sm">Pending Settlements</p>
              </div>
              <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/50">
                <BarChart3 className="h-5 w-5 text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-white">₹{(stats.this_month / 100000).toFixed(1)}L</p>
                <p className="text-slate-400 text-sm">This Month / इस महीने</p>
              </div>
              <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/50">
                <FileText className="h-5 w-5 text-red-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.pending_invoices}</p>
                <p className="text-slate-400 text-sm">Pending Invoices</p>
              </div>
              <button onClick={() => setActiveTab('pending_approvals')} className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50 text-left hover:bg-purple-500/30 transition-colors">
                <CheckCircle className="h-5 w-5 text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.pending_approvals}</p>
                <p className="text-slate-400 text-sm">Pending Approvals</p>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4">
              <button onClick={() => setActiveTab('bulk_salary')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Users className="h-8 w-8 text-emerald-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Bulk Salary Payment</h3>
                <p className="text-slate-400 text-sm">बल्क सैलरी भुगतान</p>
              </button>
              <button onClick={() => setActiveTab('vendor_bills')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Receipt className="h-8 w-8 text-orange-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Vendor Payments</h3>
                <p className="text-slate-400 text-sm">TDS के साथ वेंडर भुगतान</p>
              </button>
              <button onClick={() => setActiveTab('invoices')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <FileText className="h-8 w-8 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Manage Invoices</h3>
                <p className="text-slate-400 text-sm">चालान प्रबंधित करें</p>
              </button>
              <button onClick={() => setActiveTab('tds_config')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Percent className="h-8 w-8 text-yellow-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">TDS Configuration</h3>
                <p className="text-slate-400 text-sm">टीडीएस सेटिंग्स</p>
              </button>
            </div>

            {/* Approval Workflow Info */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-purple-400" />
                Approval Workflow / अनुमोदन वर्कफ़्लो
              </h2>
              <div className="flex items-center justify-center space-x-4 py-4">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto">
                    <Users className="h-6 w-6 text-orange-400" />
                  </div>
                  <p className="text-white mt-2 text-sm">HR</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600" />
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                    <BanknoteIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <p className="text-white mt-2 text-sm">Finance</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600" />
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto">
                    <Shield className="h-6 w-6 text-purple-400" />
                  </div>
                  <p className="text-white mt-2 text-sm">Admin</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600" />
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                  </div>
                  <p className="text-white mt-2 text-sm">Execute</p>
                </div>
              </div>
              <p className="text-center text-slate-400 text-sm mt-2">
                Admin can override and approve directly / एडमिन सीधे अनुमोदित कर सकते हैं
              </p>
            </div>
          </div>
        );
    }
  };

  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-slate-950" data-testid="finance-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-emerald-500" />
            <span className="text-2xl font-bold text-white">AirYatra Finance</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center px-3 py-1 bg-yellow-500/20 rounded-full">
              <DollarSign className="h-4 w-4 text-yellow-500 mr-2" />
              <span className="text-yellow-400 text-sm">₹{(stats.pending_settlements / 1000).toFixed(0)}K Pending</span>
            </div>
            <NotificationBell user={user} />
            <span className="text-slate-300">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-emerald-400">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className="w-72 bg-slate-900/50 border-r border-slate-800 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="p-3 space-y-1">
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups.includes(group.id);
              const isActiveGroup = activeGroup === group.id;

              return (
                <div key={group.id} className="mb-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                      isActiveGroup
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <GroupIcon className={`h-5 w-5 ${isActiveGroup ? 'text-emerald-400' : ''}`} />
                      <span className="font-medium text-sm">{group.label}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-1 ml-4 space-y-0.5 border-l border-slate-700 pl-3">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id, group.id)}
                            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                              activeTab === item.id
                                ? 'bg-emerald-500 text-white'
                                : item.highlight
                                  ? 'text-yellow-400 hover:bg-yellow-500/20'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <ItemIcon className="h-4 w-4" />
                            <span>{item.label}</span>
                            {item.highlight && activeTab !== item.id && (
                              <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default FinanceDashboard;
