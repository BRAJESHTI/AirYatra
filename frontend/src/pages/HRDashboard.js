import React, { useState, useEffect, Suspense } from 'react';
import { LogOut, Plane, Home, Users, Calendar, DollarSign, Clock, MapPin, ChevronDown, ChevronRight, BarChart3, Settings, User, Wallet, CreditCard, Navigation, Target, Award, FileText, CheckSquare, Receipt, Upload, BanknoteIcon, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/shared/NotificationBell';

// Import HR Components
import IncentiveConfig from '@/components/admin/IncentiveConfig';
import AttendancePayroll from '@/components/admin/AttendancePayroll';
import EmployeeManagement from '@/components/admin/EmployeeManagement';
import TeamAttendanceToday from '@/components/admin/TeamAttendanceToday';
import HolidayCalendar from '@/components/admin/HolidayCalendar';
import LiveTrackingDashboard from '@/components/admin/LiveTrackingDashboard';
import LoginShieldDashboard from '@/components/admin/LoginShieldDashboard';
import LeaveManagement from '@/components/hr/LeaveManagement';
import SessionManager from '@/components/auth/SessionManager';

// Lazy load new components
const ExpenseReimbursement = React.lazy(() => import('@/components/hr/ExpenseReimbursement'));
const SalesTargets = React.lazy(() => import('@/components/hr/SalesTargets'));
const AutoSalaryPayment = React.lazy(() => import('@/components/hr/AutoSalaryPayment'));

// Organized Navigation Structure - 6 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Dashboard',
    icon: Home,
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'attendance', label: 'Today Attendance', icon: CheckSquare, highlight: true },
    ]
  },
  {
    id: 'employees',
    label: 'Employees',
    icon: Users,
    items: [
      { id: 'all_employees', label: 'All Employees', icon: Users },
      { id: 'field_staff', label: 'Field Staff', icon: MapPin },
      { id: 'field_tracking', label: 'Live Tracking', icon: Navigation, highlight: true },
    ]
  },
  {
    id: 'payroll',
    label: 'Payroll',
    icon: CreditCard,
    items: [
      { id: 'attendance_payroll', label: 'Attendance & Payroll', icon: Calendar },
      { id: 'salary', label: 'Salary Processing', icon: DollarSign },
      { id: 'auto_salary', label: 'Auto Salary Payment', icon: BanknoteIcon, highlight: true },
      { id: 'leaves', label: 'Leave Management', icon: Calendar },
      { id: 'holidays', label: 'Holiday Calendar', icon: Calendar, highlight: true },
    ]
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: Receipt,
    items: [
      { id: 'expense_claims', label: 'Expense Claims', icon: Receipt, highlight: true },
      { id: 'pending_approvals', label: 'Pending Approvals', icon: CheckSquare },
      { id: 'reimbursement_history', label: 'Reimbursement History', icon: FileText },
    ]
  },
  {
    id: 'incentives',
    label: 'Incentives',
    icon: Award,
    items: [
      { id: 'incentive_config', label: 'Incentive Config', icon: Settings },
      { id: 'sales_targets', label: 'Sales Targets', icon: Target, highlight: true },
      { id: 'achievements', label: 'Achievements', icon: Award },
      { id: 'leaderboard', label: 'Leaderboard', icon: BarChart3 },
    ]
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    items: [
      { id: 'attendance_report', label: 'Attendance Report', icon: FileText },
      { id: 'payroll_report', label: 'Payroll Report', icon: FileText },
      { id: 'performance', label: 'Performance Report', icon: BarChart3 },
    ]
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    items: [
      { id: 'login_shield', label: 'Login Shield AI™', icon: Shield, highlight: true },
      { id: 'session_manager', label: 'Session Manager', icon: Users },
    ]
  },
];

function HRDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['main', 'employees']);
  const [stats, setStats] = useState({
    total_employees: 25,
    present_today: 22,
    on_leave: 3,
    field_active: 8
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
      case 'attendance':
        return <TeamAttendanceToday />;
      case 'holidays':
        return <HolidayCalendar />;
      case 'all_employees':
      case 'field_staff':
        return <EmployeeManagement />;
      case 'field_tracking':
        return <LiveTrackingDashboard />;
      case 'attendance_payroll':
      case 'attendance_report':
      case 'payroll_report':
      case 'salary':
        return <AttendancePayroll />;
      case 'leaves':
        return <LeaveManagement />;
      case 'incentive_config':
        return <IncentiveConfig />;
      case 'expense_claims':
      case 'pending_approvals':
      case 'reimbursement_history':
        return (
          <React.Suspense fallback={<div className="text-white">Loading...</div>}>
            <ExpenseReimbursement activeTab={activeTab} user={user} />
          </React.Suspense>
        );
      case 'sales_targets':
      case 'leaderboard':
      case 'performance':
      case 'achievements':
        return (
          <React.Suspense fallback={<div className="text-white">Loading...</div>}>
            <SalesTargets activeTab={activeTab} user={user} />
          </React.Suspense>
        );
      case 'auto_salary':
        return (
          <React.Suspense fallback={<div className="text-white">Loading...</div>}>
            <AutoSalaryPayment user={user} />
          </React.Suspense>
        );
      case 'login_shield':
        return <LoginShieldDashboard />;
      case 'session_manager':
        return <SessionManager />;
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">HR Dashboard</h1>
              <p className="text-slate-400">Employee management and payroll</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/50">
                <Users className="h-5 w-5 text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.total_employees}</p>
                <p className="text-slate-400 text-sm">Total Employees</p>
              </div>
              <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
                <CheckSquare className="h-5 w-5 text-green-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.present_today}</p>
                <p className="text-slate-400 text-sm">Present Today</p>
              </div>
              <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/50">
                <Calendar className="h-5 w-5 text-yellow-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.on_leave}</p>
                <p className="text-slate-400 text-sm">On Leave</p>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
                <Navigation className="h-5 w-5 text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.field_active}</p>
                <p className="text-slate-400 text-sm">Field Active</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4">
              <button onClick={() => setActiveTab('attendance_payroll')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Calendar className="h-8 w-8 text-green-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Mark Attendance</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
              <button onClick={() => setActiveTab('expense_claims')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Receipt className="h-8 w-8 text-orange-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Expense Claims</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
              <button onClick={() => setActiveTab('auto_salary')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <BanknoteIcon className="h-8 w-8 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Auto Salary</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
              <button onClick={() => setActiveTab('sales_targets')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Target className="h-8 w-8 text-yellow-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Sales Targets</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
            </div>
          </div>
        );
    }
  };

  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-slate-950" data-testid="hr-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-green-500" />
            <span className="text-2xl font-bold text-white">AirYatra HR</span>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell user={user} />
            <span className="text-slate-300">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-green-400">
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
                        ? 'bg-green-500/20 text-green-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <GroupIcon className={`h-5 w-5 ${isActiveGroup ? 'text-green-400' : ''}`} />
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
                                ? 'bg-green-500 text-white'
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

export default HRDashboard;
