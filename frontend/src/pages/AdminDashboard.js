import React, { useState, useEffect } from 'react';
import { LogOut, Plane, LayoutDashboard, Users, Calendar, FileText, DollarSign, Shield, AlertTriangle, BarChart3, Settings, PieChart, UserCog, Ban, CheckSquare, Building2, TrendingUp, MessageSquare, Clock, Bell, MapPin, TreePine, Gift, Headphones, Key, Globe, Phone, Navigation, Wallet, CreditCard, Star, Cloud, Route, Siren, BookOpen, Calculator, Radio, FileCheck, Package, ChevronDown, ChevronRight, Briefcase, Cog, Users2, Map, Map as MapIcon, Bot, HardDrive, Database, Percent, Menu, Server, Flag, FlaskConical, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminAPI } from '@/services/api';
import NotificationBell from '@/components/shared/NotificationBell';
import GlobalSearch from '@/components/shared/GlobalSearch';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { useResponsiveSidebar, MobileMenuButton, ResponsiveSidebar, CollapsibleNavGroup, NavItem } from '@/components/shared/Sidebar';

// Import admin components
import AdminOverview from '@/components/admin/AdminOverview';
import OperatorManagement from '@/components/admin/OperatorManagement';
import BookingManagement from '@/components/admin/BookingManagement';
import BookingCalendarView from '@/components/admin/BookingCalendarView';
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
import AdminDiscountCodes from '@/components/admin/AdminDiscountCodes';
import CRMDashboard from '@/components/admin/CRMDashboard';
import APIKeysSettings from '@/components/admin/APIKeysSettings';
import LaunchChecklist from '@/components/admin/LaunchChecklist';
import SchedulerStatus from '@/components/admin/SchedulerStatus';
import WebhookIntegration from '@/components/admin/WebhookIntegration';
import CallRecordingSettings from '@/components/admin/CallRecordingSettings';
import IncentiveConfig from '@/components/admin/IncentiveConfig';
import AttendancePayroll from '@/components/admin/AttendancePayroll';
import LiveTrackingDashboard from '@/components/admin/LiveTrackingDashboard';
import SupportDashboard from '@/components/admin/SupportDashboard';
import ReviewsManagement from '@/components/admin/ReviewsManagement';
import WeatherDashboard from '@/components/admin/WeatherDashboard';

// Landing Infrastructure Components
import LandingInfrastructure from '@/components/admin/LandingInfrastructure';
import HelipadAvailability from '@/components/admin/HelipadAvailability';
import LandingRentConfig from '@/components/admin/LandingRentConfig';
import VillagePermissionDashboard from '@/components/admin/VillagePermissionDashboard';

// Priority 2 Features
import InvoiceManagement from '@/components/admin/InvoiceManagement';
import LoyaltyProgram from '@/components/admin/LoyaltyProgram';
import MarketingCampaigns from '@/components/admin/MarketingCampaigns';
import FleetMaintenance from '@/components/admin/FleetMaintenance';

// Priority 3 Features
import DynamicPricing from '@/components/admin/DynamicPricing';
import AdminPricingControls from '@/components/admin/AdminPricingControls';
import RouteOptimization from '@/components/admin/RouteOptimization';
import InsuranceModule from '@/components/admin/InsuranceModule';
import KnowledgeBase from '@/components/admin/KnowledgeBase';
import SOSDashboard from '@/components/admin/SOSDashboard';

// Production Advanced Features
import LiveFlightTracking from '@/components/admin/LiveFlightTracking';
import DocumentVerification from '@/components/admin/DocumentVerification';
import MultiLegBooking from '@/components/admin/MultiLegBooking';
import InventoryManagement from '@/components/admin/InventoryManagement';
import DGCACompliance from '@/components/admin/DGCACompliance';
// Medium Priority Features
import PushNotifications from '@/components/admin/PushNotifications';
import BoardingPass from '@/components/admin/BoardingPass';
import CurrencyConverter from '@/components/admin/CurrencyConverter';
import PredictiveAnalytics from '@/components/admin/PredictiveAnalytics';
import VoiceVideoSupport from '@/components/admin/VoiceVideoSupport';
// Low Priority Features
import AIChatbot from '@/components/admin/AIChatbot';
import TwoFactorAuth from '@/components/admin/TwoFactorAuth';
import CalendarSync from '@/components/admin/CalendarSync';
import AccountingIntegration from '@/components/admin/AccountingIntegration';
// Advanced Integrations
import TwilioIntegration from '@/components/admin/TwilioIntegration';
import TallyIntegration from '@/components/admin/TallyIntegration';
import ZohoIntegration from '@/components/admin/ZohoIntegration';
import ExchangeManagement from '@/components/admin/ExchangeManagement';
import CEODashboard from '@/components/admin/CEODashboard';
import PartnerManagement from '@/components/admin/PartnerManagement';
import AdminPaymentsDashboard from '@/components/admin/AdminPaymentsDashboard';
import PaymentRulesPanel from '@/components/admin/PaymentRulesPanel';
import PlatformFeesPanel from '@/components/admin/PlatformFeesPanel';
import AdminPricingPanel from '@/components/admin/AdminPricingPanel';
import RevenueReports from '@/components/admin/RevenueReports';
import RefundApprovals from '@/components/admin/RefundApprovals';
import CancellationReasonsManager from '@/components/admin/CancellationReasonsManager';
import GSTReports from '@/components/admin/GSTReports';
import OperatorScorecards from '@/components/admin/OperatorScorecards';
import AdminCommissionSettings from '@/components/admin/AdminCommissionSettings';
import DocumentTypeMaster from '@/components/admin/DocumentTypeMaster';
import VerificationAPISettings from '@/components/admin/VerificationAPISettings';
import DocumentExpiryDashboard from '@/components/admin/DocumentExpiryDashboard';
import CommandCenter from '@/components/admin/CommandCenter';
import LoginShieldDashboard from '@/components/admin/LoginShieldDashboard';
import SessionManager from '@/components/auth/SessionManager';
// AI Compliance Monitor & Document Verification
import ComplianceDashboard from '@/components/admin/ComplianceDashboard';
import AdminVerificationQueue from '@/components/admin/AdminVerificationQueue';
// Verification Rule Engine
import AdminVerificationEngine from '@/components/admin/AdminVerificationEngine';
// API Control Center
import APIControlCenter from '@/components/admin/APIControlCenter';
import MapCacheSettings from '@/components/admin/MapCacheSettings';
// Document Vault Admin
import DocumentVaultAdmin from '@/components/admin/DocumentVaultAdmin';
// WhatsApp CRM
import WhatsAppCRM from '@/components/admin/WhatsAppCRM';
// Complaint Analytics
import ComplaintAnalytics from '@/components/admin/ComplaintAnalytics';
// Bulk Discount Upload
import BulkDiscountUpload from '@/components/admin/BulkDiscountUpload';
// Template Settings
import TemplateSettings from '@/components/admin/TemplateSettings';
// Legal Documents Admin
import LegalDocsAdmin from '@/components/admin/LegalDocsAdmin';
// Email Click Heatmap
import EmailClickHeatmap from '@/components/admin/EmailClickHeatmap';
// Booking Calendar
import BookingCalendar from '@/components/admin/BookingCalendar';
// Email A/B Testing
import EmailABTesting from '@/components/admin/EmailABTesting';

// Organized Navigation Structure - 8 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Main Dashboard',
    icon: LayoutDashboard,
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'command_center', label: 'Command Center', icon: Shield, highlight: true },
      { id: 'inquiries', label: 'New Inquiries', icon: Bell, highlight: true },
      { id: 'approvals', label: 'Approval Queue', icon: CheckSquare, highlight: true },
      { id: 'exchange', label: 'Aviation Exchange', icon: Plane, highlight: true },
      { id: 'multi_approval', label: 'Multi-Level Approvals', icon: Shield },
    ]
  },
  {
    id: 'bookings',
    label: 'Bookings & Flights',
    icon: Calendar,
    items: [
      { id: 'bookings', label: 'All Bookings', icon: Calendar },
      { id: 'flight_calendar', label: 'Flight Calendar', icon: Calendar, highlight: true },
      { id: 'multileg', label: 'Multi-Leg Booking', icon: Route },
      { id: 'live_tracking', label: 'Live Flight Tracking', icon: Radio, highlight: true },
      { id: 'boarding_pass', label: 'Digital Boarding Pass', icon: FileCheck },
      { id: 'inventory', label: 'Inventory / Slots', icon: Package },
      { id: 'weather', label: 'Weather / Flight Safety', icon: Cloud },
      { id: 'sos', label: 'Emergency SOS', icon: Siren, highlight: true },
    ]
  },
  {
    id: 'operators',
    label: 'Operators & Fleet',
    icon: Building2,
    items: [
      { id: 'operators', label: 'Operator Management', icon: Building2 },
      { id: 'operator_performance', label: 'Operator Performance', icon: TrendingUp },
      { id: 'operator_scorecards', label: 'Operator Scorecards', icon: TrendingUp, highlight: true },
      { id: 'suspended', label: 'Suspended Operators', icon: Ban },
      { id: 'fleet_maintenance', label: 'Fleet Maintenance', icon: Settings },
      { id: 'doc_verify', label: 'Document Verification', icon: FileCheck },
      { id: 'dgca', label: 'DGCA Compliance', icon: Shield, highlight: true },
      { id: 'permissions', label: 'Landing Permissions', icon: Shield },
    ]
  },
  {
    id: 'landing',
    label: 'Landing Infrastructure',
    icon: Map,
    items: [
      { id: 'landing_infra', label: 'Landing Points', icon: MapPin },
      { id: 'helipad_calendar', label: 'Helipad Calendar', icon: Calendar },
      { id: 'landing_rent', label: 'Landing Rent', icon: DollarSign },
      { id: 'village_permissions', label: 'Village Permissions', icon: TreePine, highlight: true },
      { id: 'route_optimization', label: 'Route Optimization', icon: Route },
    ]
  },
  {
    id: 'finance',
    label: 'Finance & Billing',
    icon: DollarSign,
    items: [
      { id: 'payments_dashboard', label: 'Payments Dashboard', icon: Wallet, highlight: true },
      { id: 'payment_rules', label: 'Payment Rules', icon: SlidersHorizontal, highlight: true },
      { id: 'platform_fees', label: 'Platform Fees', icon: SlidersHorizontal, highlight: true },
      { id: 'route_pricing', label: 'Route Pricing & Own Fleet', icon: SlidersHorizontal, highlight: true },
      { id: 'revenue_reports', label: 'Revenue Reports', icon: SlidersHorizontal, highlight: true },
      { id: 'refund_approvals', label: 'Refund Approvals', icon: SlidersHorizontal, highlight: true },
      { id: 'launch_checklist', label: 'Launch Checklist', icon: SlidersHorizontal, highlight: true },
      { id: 'commission_settings', label: 'Commission Settings', icon: Percent, highlight: true },
      { id: 'settlements', label: 'Settlements', icon: DollarSign },
      { id: 'invoices', label: 'Invoice & GST Billing', icon: FileText },
      { id: 'gst_reports', label: 'GST/TDS Reports', icon: FileText, highlight: true },
      { id: 'pricing_engine', label: 'Pricing Engine', icon: Calculator, highlight: true },
      { id: 'dynamic_pricing', label: 'Dynamic Pricing', icon: Calculator },
      { id: 'currency', label: 'Currency Converter', icon: DollarSign },
      { id: 'insurance', label: 'Insurance Module', icon: Shield },
      { id: 'accounting', label: 'Accounting Integration', icon: Calculator },
    ]
  },
  {
    id: 'crm_support',
    label: 'CRM & Support',
    icon: Headphones,
    items: [
      { id: 'crm', label: 'CRM / Sales', icon: Headphones, highlight: true },
      { id: 'support', label: 'Support Helpdesk', icon: Headphones },
      { id: 'reviews', label: 'Reviews & Ratings', icon: Star },
      { id: 'chat', label: 'Messages', icon: MessageSquare },
      { id: 'ai_chatbot', label: 'AI Chatbot', icon: Bot },
      { id: 'voice_video', label: 'Voice/Video Support', icon: Phone },
      { id: 'knowledge_base', label: 'Knowledge Base/FAQ', icon: BookOpen },
    ]
  },
  {
    id: 'users_hr',
    label: 'Users & HR',
    icon: Users2,
    items: [
      { id: 'users', label: 'User Management', icon: UserCog },
      { id: 'roles', label: 'Roles & Permissions', icon: Shield },
      { id: 'incentives', label: 'Incentives', icon: Wallet },
      { id: 'attendance', label: 'Attendance & Payroll', icon: CreditCard },
      { id: 'field_tracking', label: 'Field Live Tracking', icon: Navigation, highlight: true },
      { id: 'two_factor', label: '2FA Security', icon: Shield },
      { id: 'login_shield', label: 'Login Shield AI™', icon: Shield, highlight: true },
      { id: 'session_manager', label: 'Session Manager', icon: Users },
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics & Reports',
    icon: BarChart3,
    items: [
      { id: 'ceo', label: 'CEO Dashboard', icon: TrendingUp, highlight: true },
      { id: 'analytics', label: 'Analytics Dashboard', icon: BarChart3 },
      { id: 'complaint_analytics', label: 'Complaint Analytics', icon: Flag, highlight: true },
      { id: 'reports', label: 'Reports', icon: PieChart },
      { id: 'predictive', label: 'Predictive Analytics', icon: BarChart3, highlight: true },
      { id: 'audit', label: 'Audit Logs', icon: FileText },
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing & Loyalty',
    icon: Gift,
    items: [
      { id: 'marketing', label: 'Marketing Campaigns', icon: TrendingUp },
      { id: 'loyalty', label: 'VIP & Loyalty Program', icon: Gift },
      { id: 'referral', label: 'Referral Settings', icon: Gift },
      { id: 'discount_codes', label: 'Discount Codes', icon: Percent, highlight: true },
      { id: 'push_notifications', label: 'Push Notifications', icon: Bell },
    ]
  },
  {
    id: 'settings',
    label: 'Settings & System',
    icon: Cog,
    items: [
      { id: 'settings', label: 'Global Settings', icon: Settings },
      { id: 'cancellation_reasons', label: 'Cancellation Reasons', icon: Ban, highlight: true },
      { id: 'template_settings', label: 'Template Settings', icon: FileText, highlight: true },
      { id: 'legal_docs', label: 'Legal Docs', icon: Shield, highlight: true },
      { id: 'email_heatmap', label: 'Email Analytics', icon: BarChart3, highlight: true },
      { id: 'booking_calendar', label: 'Booking Calendar', icon: Calendar, highlight: true },
      { id: 'email_ab_testing', label: 'A/B Testing', icon: FlaskConical, highlight: true },
      { id: 'api_keys', label: 'API Keys (GST/PAN)', icon: Key },
      { id: 'webhooks', label: 'Webhooks', icon: Globe },
      { id: 'call_recording', label: 'Call Recording', icon: Phone },
      { id: 'calendar_sync', label: 'Calendar Sync', icon: Calendar },
      { id: 'scheduler', label: 'Scheduler', icon: Clock },
    ]
  },
  {
    id: 'document_master',
    label: 'Document Master',
    icon: Shield,
    items: [
      { id: 'document_vault', label: 'Document Vault', icon: FileText, highlight: true },
      { id: 'verification_engine', label: 'Verification Engine', icon: Shield, highlight: true },
      { id: 'compliance_dashboard', label: 'AI Compliance Monitor', icon: Shield, highlight: true },
      { id: 'verification_queue', label: 'Verification Queue', icon: CheckSquare, highlight: true },
      { id: 'document_types', label: 'Document Types', icon: FileText, highlight: true },
      { id: 'verification_apis', label: 'Verification APIs / API', icon: Shield, highlight: true },
      { id: 'document_expiry', label: 'Expiry Dashboard', icon: AlertTriangle, highlight: true },
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: HardDrive,
    items: [
      { id: 'whatsapp_crm', label: 'WhatsApp CRM', icon: MessageSquare, highlight: true },
      { id: 'api_control_center', label: 'API Control Center / API', icon: Server, highlight: true },
      { id: 'map_cache', label: 'Offline Map Cache', icon: MapIcon, highlight: true },
      { id: 'partners', label: 'Partner API Platform', icon: Key, highlight: true },
      { id: 'twilio', label: 'Twilio (VoIP/Calls)', icon: Phone, highlight: true },
      { id: 'tally', label: 'Tally Accounting', icon: Calculator, highlight: true },
      { id: 'zoho', label: 'Zoho CRM/Books', icon: Cloud, highlight: true },
    ]
  },
];

import { useLocation } from 'react-router-dom';

function AdminDashboard({ user, onLogout }) {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const initialTab = urlParams.get('tab') || 'overview';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(['main']); // Main dashboard expanded by default
  
  // Responsive sidebar hook
  const sidebar = useResponsiveSidebar();

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

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleNavClick = (itemId, groupId) => {
    setActiveTab(itemId);
    // Auto-expand the group when item is selected
    if (!expandedGroups.includes(groupId)) {
      setExpandedGroups(prev => [...prev, groupId]);
    }
    // Close mobile sidebar on item click
    sidebar.closeMobile();
  };

  // Find which group the active tab belongs to
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
      case 'overview':
        return <AdminOverview data={dashboardData} onRefresh={loadDashboard} loading={loading} onNavigate={setActiveTab} />;
      // New Priority 1 Features
      case 'support':
        return <SupportDashboard />;
      case 'reviews':
        return <ReviewsManagement />;
      case 'weather':
        return <WeatherDashboard />;
      // Priority 2 Features
      case 'payments_dashboard':
        return <AdminPaymentsDashboard />;
      case 'payment_rules':
        return <PaymentRulesPanel />;
      case 'platform_fees':
        return <PlatformFeesPanel />;
      case 'route_pricing':
        return <AdminPricingPanel />;
      case 'revenue_reports':
        return <RevenueReports />;
      case 'refund_approvals':
        return <RefundApprovals />;
      case 'cancellation_reasons':
        return <CancellationReasonsManager />;
      case 'gst_reports':
        return <GSTReports />;
      case 'launch_checklist':
        return <LaunchChecklist />;
      case 'commission_settings':
        return <AdminCommissionSettings />;
      case 'flight_calendar':
        return <BookingCalendarView />;
      case 'invoices':
        return <InvoiceManagement />;
      case 'loyalty':
        return <LoyaltyProgram />;
      case 'marketing':
        return <MarketingCampaigns />;
      case 'discount_codes':
        return <BulkDiscountUpload />;
      case 'complaint_analytics':
        return <ComplaintAnalytics />;
      case 'template_settings':
        return <TemplateSettings />;
      case 'legal_docs':
        return <LegalDocsAdmin />;
      case 'email_heatmap':
        return <EmailClickHeatmap />;
      case 'booking_calendar':
        return <BookingCalendar userRole={user?.roles?.[0]} />;
      case 'email_ab_testing':
        return <EmailABTesting />;
      case 'fleet_maintenance':
        return <FleetMaintenance />;
      // Priority 3 Features
      case 'pricing_engine':
        return <AdminPricingControls />;
      case 'dynamic_pricing':
        return <DynamicPricing />;
      case 'route_optimization':
        return <RouteOptimization />;
      case 'insurance':
        return <InsuranceModule />;
      case 'knowledge_base':
        return <KnowledgeBase />;
      case 'sos':
        return <SOSDashboard />;
      // Production Advanced Features
      case 'live_tracking':
        return <LiveFlightTracking />;
      case 'doc_verify':
        return <DocumentVerification />;
      case 'multileg':
        return <MultiLegBooking />;
      case 'inventory':
        return <InventoryManagement />;
      case 'dgca':
        return <DGCACompliance />;
      // Medium Priority Features
      case 'push_notifications':
        return <PushNotifications />;
      case 'boarding_pass':
        return <BoardingPass />;
      case 'currency':
        return <CurrencyConverter />;
      case 'predictive':
        return <PredictiveAnalytics />;
      case 'voice_video':
        return <VoiceVideoSupport />;
      // Low Priority Features
      case 'ai_chatbot':
        return <AIChatbot />;
      case 'two_factor':
        return <TwoFactorAuth />;
      case 'login_shield':
        return <LoginShieldDashboard />;
      case 'session_manager':
        return <SessionManager />;
      case 'calendar_sync':
        return <CalendarSync />;
      case 'accounting':
        return <AccountingIntegration />;
      // Advanced Integrations
      case 'api_control_center':
        return <APIControlCenter />;
      case 'map_cache':
        return <MapCacheSettings />;
      case 'document_vault':
        return <DocumentVaultAdmin />;
      case 'whatsapp_crm':
        return <WhatsAppCRM />;
      case 'twilio':
        return <TwilioIntegration />;
      case 'tally':
        return <TallyIntegration />;
      case 'zoho':
        return <ZohoIntegration />;
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
      case 'exchange':
        return <ExchangeManagement />;
      case 'ceo':
        return <CEODashboard />;
      case 'partners':
        return <PartnerManagement />;
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
      case 'operator_scorecards':
        return <OperatorScorecards />;
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
      // HR Section
      case 'incentives':
        return <IncentiveConfig />;
      case 'attendance':
        return <AttendancePayroll />;
      case 'field_tracking':
        return <LiveTrackingDashboard />;
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
      case 'document_types':
        return <DocumentTypeMaster />;
      case 'verification_apis':
        return <VerificationAPISettings />;
      case 'document_expiry':
        return <DocumentExpiryDashboard />;
      case 'compliance_dashboard':
        return <ComplianceDashboard />;
      case 'verification_queue':
        return <AdminVerificationQueue />;
      case 'verification_engine':
        return <AdminVerificationEngine />;
      case 'command_center':
        return <CommandCenter user={user} />;
      default:
        return <AdminOverview data={dashboardData} onRefresh={loadDashboard} loading={loading} />;
    }
  };

  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-slate-950" data-testid="admin-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 lg:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {/* Mobile Menu Button */}
            <MobileMenuButton 
              onClick={sidebar.toggleMobile} 
              isOpen={sidebar.isMobileOpen}
            />
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-xl lg:text-2xl font-bold text-white">AirYatra Admin</span>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-4">
            <GlobalSearch user={user} />
            {dashboardData?.statistics?.pending_operator_approvals > 0 && (
              <div className="hidden md:flex items-center px-3 py-1 bg-orange-500/20 rounded-full">
                <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                <span className="text-orange-400 text-sm">
                  {dashboardData.statistics.pending_operator_approvals} Pending
                </span>
              </div>
            )}
            <NotificationBell user={user} />
            <ThemeToggle />
            <span className="text-slate-300 hidden lg:inline">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-orange-400" data-testid="logout-btn">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Responsive Sidebar */}
        <ResponsiveSidebar
          isCollapsed={sidebar.isCollapsed}
          isMobileOpen={sidebar.isMobileOpen}
          isHovered={sidebar.isHovered}
          setIsHovered={sidebar.setIsHovered}
          closeMobile={sidebar.closeMobile}
          toggleCollapse={sidebar.toggleCollapse}
        >
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups.includes(group.id);
            const isActiveGroup = activeGroup === group.id;
            const hasHighlight = group.items.some(item => item.highlight);

            return (
              <CollapsibleNavGroup
                key={group.id}
                icon={GroupIcon}
                label={group.label}
                isExpanded={isExpanded}
                onToggle={() => toggleGroup(group.id)}
                isActive={isActiveGroup}
                hasHighlight={hasHighlight}
                isCollapsed={sidebar.effectiveCollapsed}
              >
                {group.items.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={activeTab === item.id}
                    highlight={item.highlight}
                    onClick={() => handleNavClick(item.id, group.id)}
                    isCollapsed={sidebar.effectiveCollapsed}
                    testId={`nav-${item.id}`}
                  />
                ))}
              </CollapsibleNavGroup>
            );
          })}
        </ResponsiveSidebar>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
