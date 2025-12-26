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

// Organized Navigation Structure - 6 Main Categories
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
      { id: 'gst_reports', label: 'GST Reports', icon: FileText },
    ]
  },
];

function FinanceDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['main', 'billing']);
  const [stats, setStats] = useState({
    total_revenue: 1250000,
    pending_settlements: 45000,
    this_month: 350000,
    pending_invoices: 12
  });

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
      case 'salary_reconciliation':
        return (
          <React.Suspense fallback={<div className="text-white">Loading...</div>}>
            <BulkSalaryPayment activeTab={activeTab} />
          </React.Suspense>
        );
      case 'vendor_bills':
      case 'vendor_master':
        return (
          <React.Suspense fallback={<div className="text-white">Loading...</div>}>
            <VendorBillPayment activeTab={activeTab} />
          </React.Suspense>
        );
      case 'tds_reports':
        return (
          <React.Suspense fallback={<div className="text-white">Loading...</div>}>
            <TDSReports />
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
            <div className="grid grid-cols-4 gap-4">
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
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('invoices')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <FileText className="h-8 w-8 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Manage Invoices</h3>
                <p className="text-slate-400 text-sm">चालान प्रबंधित करें</p>
              </button>
              <button onClick={() => setActiveTab('all_settlements')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <DollarSign className="h-8 w-8 text-green-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Process Settlements</h3>
                <p className="text-slate-400 text-sm">निपटान प्रक्रिया</p>
              </button>
              <button onClick={() => setActiveTab('accounting_integration')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Calculator className="h-8 w-8 text-purple-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Accounting</h3>
                <p className="text-slate-400 text-sm">लेखा एकीकरण</p>
              </button>
            </div>

            {/* Revenue Chart Placeholder */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Revenue Overview / राजस्व अवलोकन</h2>
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400">Revenue chart visualization</p>
                </div>
              </div>
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
