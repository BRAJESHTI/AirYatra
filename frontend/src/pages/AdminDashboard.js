import React, { useState, useEffect } from 'react';
import { LogOut, Plane, LayoutDashboard, Users, Calendar, FileText, DollarSign, Shield, AlertTriangle, BarChart3, Settings, PieChart, UserCog, Ban, CheckSquare, Building2, TrendingUp, MessageSquare, Clock, Bell, MapPin, TreePine, Gift, Headphones, Key, Globe, Phone, Navigation, Wallet, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminAPI } from '@/services/api';
import NotificationBell from '@/components/shared/NotificationBell';

// Import admin components
import AdminOverview from '@/components/admin/AdminOverview';
import OperatorManagement from '@/components/admin/OperatorManagement';
import BookingManagement from '@/components/admin/BookingManagement';
import LandingPermissionApproval from '@/components/admin/LandingPermissionApproval';
import SettlementManagement from '@/components/admin/SettlementManagement';
import AuditLogs from '@/components/admin/AuditLogs';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';
import GlobalSettings from '@/components/admin/GlobalSettings';
import ReportsDashboard from '@/components/admin/ReportsDashboard';
import UserRoleManagement from '@/components/admin/UserRoleManagement';
import SuspendedOperators from '@/components/admin/SuspendedOperators';
import ApprovalQueue from '@/components/admin/ApprovalQueue';
import RolePermissionManager from '@/components/admin/RolePermissionManager';
import OperatorPerformance from '@/components/admin/OperatorPerformance';
import MultiLevelApproval from '@/components/admin/MultiLevelApproval';
import InAppChat from '@/components/shared/InAppChat';
import InquiryManagement from '@/components/admin/InquiryManagement';
import ReferralSettings from '@/components/admin/ReferralSettings';
import CRMDashboard from '@/components/admin/CRMDashboard';
import APIKeysSettings from '@/components/admin/APIKeysSettings';
import SchedulerStatus from '@/components/admin/SchedulerStatus';
import WebhookIntegration from '@/components/admin/WebhookIntegration';
import CallRecordingSettings from '@/components/admin/CallRecordingSettings';
import IncentiveConfig from '@/components/admin/IncentiveConfig';
import AttendancePayroll from '@/components/admin/AttendancePayroll';
import LiveTrackingDashboard from '@/components/admin/LiveTrackingDashboard';

// Landing Infrastructure Components
import LandingInfrastructure from '@/components/admin/LandingInfrastructure';
import HelipadAvailability from '@/components/admin/HelipadAvailability';
import LandingRentConfig from '@/components/admin/LandingRentConfig';
import VillagePermissionDashboard from '@/components/admin/VillagePermissionDashboard';

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'crm', label: 'CRM / Sales', icon: Headphones, highlight: true },
  { id: 'webhooks', label: 'Webhooks', icon: Globe },
  { id: 'inquiries', label: 'New Inquiries', icon: Bell, highlight: true },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: PieChart },
  { id: 'approvals', label: 'Approval Queue', icon: CheckSquare, highlight: true },
  { id: 'multi_approval', label: 'Multi-Level Approvals', icon: Shield, highlight: true },
  { id: 'users', label: 'User Management', icon: UserCog },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'operators', label: 'Operators', icon: Building2 },
  { id: 'operator_performance', label: 'Operator Performance', icon: TrendingUp },
  { id: 'suspended', label: 'Suspended Operators', icon: Ban },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'permissions', label: 'Landing Permissions', icon: Shield },
  { id: 'settlements', label: 'Settlements', icon: DollarSign },
  // Landing Infrastructure Section
  { id: 'landing_infra', label: 'Landing Points', icon: MapPin, section: 'landing' },
  { id: 'helipad_calendar', label: 'Helipad Calendar', icon: Calendar, section: 'landing' },
  { id: 'landing_rent', label: 'Landing Rent', icon: DollarSign, section: 'landing' },
  { id: 'village_permissions', label: 'Village Permissions', icon: TreePine, section: 'landing', highlight: true },
  { id: 'referral', label: 'Referral & Discount', icon: Gift },
  // HR Section
  { id: 'incentives', label: 'Incentives / इंसेंटिव', icon: Wallet, section: 'hr' },
  { id: 'attendance', label: 'Attendance & Payroll', icon: CreditCard, section: 'hr' },
  { id: 'field_tracking', label: 'Live Tracking', icon: Navigation, section: 'hr', highlight: true },
  { id: 'api_keys', label: 'API Keys (GST/PAN)', icon: Key },
  { id: 'call_recording', label: 'Call Recording', icon: Phone },
  { id: 'scheduler', label: 'Scheduler', icon: Clock },
  { id: 'chat', label: 'Messages', icon: MessageSquare },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await adminAPI.getDashboard();
      setDashboardData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview data={dashboardData} onRefresh={loadDashboard} loading={loading} onNavigate={setActiveTab} />;
      case 'crm':
        return <CRMDashboard />;
      case 'webhooks':
        return <WebhookIntegration />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'reports':
        return <ReportsDashboard />;
      case 'inquiries':
        return <InquiryManagement />;
      case 'approvals':
        return <ApprovalQueue />;
      case 'multi_approval':
        return <MultiLevelApproval />;
      case 'users':
        return <UserRoleManagement />;
      case 'roles':
        return <RolePermissionManager />;
      case 'operators':
        return <OperatorManagement />;
      case 'operator_performance':
        return <OperatorPerformance />;
      case 'suspended':
        return <SuspendedOperators />;
      case 'bookings':
        return <BookingManagement />;
      case 'permissions':
        return <LandingPermissionApproval />;
      case 'settlements':
        return <SettlementManagement />;
      // Landing Infrastructure
      case 'landing_infra':
        return <LandingInfrastructure />;
      case 'helipad_calendar':
        return <HelipadAvailability />;
      case 'landing_rent':
        return <LandingRentConfig />;
      case 'village_permissions':
        return <VillagePermissionDashboard />;
      case 'referral':
        return <ReferralSettings />;
      case 'api_keys':
        return <APIKeysSettings user={user} />;
      case 'call_recording':
        return <CallRecordingSettings />;
      case 'scheduler':
        return <SchedulerStatus />;
      case 'chat':
        return <InAppChat user={user} />;
      case 'audit':
        return <AuditLogs />;
      case 'settings':
        return <GlobalSettings />;
      default:
        return <AdminOverview data={dashboardData} onRefresh={loadDashboard} loading={loading} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950" data-testid="admin-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white">AirYatra Admin</span>
          </div>
          <div className="flex items-center space-x-4">
            {dashboardData?.statistics?.pending_operator_approvals > 0 && (
              <div className="flex items-center px-3 py-1 bg-orange-500/20 rounded-full">
                <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                <span className="text-orange-400 text-sm">
                  {dashboardData.statistics.pending_operator_approvals} Pending Approvals
                </span>
              </div>
            )}
            <NotificationBell user={user} />
            <span className="text-slate-300">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-orange-400" data-testid="logout-btn">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 min-h-[calc(100vh-73px)] bg-slate-900/50 border-r border-slate-800">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === item.id
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : item.highlight 
                        ? 'text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
