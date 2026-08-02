import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Plane, Home, Building2, Users, FileText, MessageSquare, LogOut, Settings, Fuel, MapPin, Shield, BookOpen, Key, DollarSign, Bell, User, ChevronDown, ChevronRight, Calendar, BarChart3, Briefcase, Navigation, UserPlus, Wrench, Upload, Menu, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { operatorAPI } from '../services/api';
import { toast } from 'sonner';
import NotificationBell from '../components/shared/NotificationBell';
import GlobalSearch from '../components/shared/GlobalSearch';
import { useResponsiveSidebar, MobileMenuButton, ResponsiveSidebar, CollapsibleNavGroup, NavItem } from '../components/shared/Sidebar';

// Import operator sub-pages
import OperatorHome from '../components/operator/OperatorHome';
import OperatorOnboarding from '../components/operator/OperatorOnboarding';
import FleetManagement from '../components/operator/FleetManagement';
import InquiryInbox from '../components/operator/InquiryInbox';
import PilotManagement from '../components/operator/PilotManagement';
import FlightRecordsManager from '../components/operator/FlightRecordsManager';
import FuelRecordsManager from '../components/operator/FuelRecordsManager';
import LiveTrackingMap from '../components/operator/LiveTrackingMap';
import LandingPermissionViewer from '../components/operator/LandingPermissionViewer';
import JourneyOTPManager from '../components/operator/JourneyOTPManager';
import ReviseQuoteManager from '../components/operator/ReviseQuoteManager';
import InquiryNotifications from '../components/operator/InquiryNotifications';
import OperatorProfile from '../components/operator/OperatorProfile';
import OperatorPricingConfig from '../components/operator/OperatorPricingConfig';
import OperatorERP from '../components/operator/OperatorERP';
import OperatorRevenueDashboard from '../components/operator/OperatorRevenueDashboard';
import OperatorFleetAnalytics from '../components/operator/OperatorFleetAnalytics';
import PilotDutyTracker from '../components/operator/PilotDutyTracker';
import FleetMaintenanceCalendar from '../components/operator/FleetMaintenanceCalendar';
import PilotAssignmentCalendar from '../components/operator/PilotAssignmentCalendar';
import CrewSchedulingBoard from '../components/operator/CrewSchedulingBoard';
import MaintenanceCostTracker from '../components/operator/MaintenanceCostTracker';
import PilotDocumentUpload from '../components/operator/PilotDocumentUpload';
import { OperatorAuctions } from '../components/auction/AuctionDashboard';

// Organized Navigation Structure - 5 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Dashboard / डैशबोर्ड',
    icon: Home,
    items: [
      { id: 'home', label: 'Overview', icon: Home, path: '/operator' },
      { id: 'erp', label: 'ERP Command Center / ईआरपी', icon: BarChart3, path: '/operator/erp', highlight: true },
      { id: 'revenue', label: 'Revenue Dashboard / राजस्व', icon: DollarSign, path: '/operator/revenue', highlight: true },
      { id: 'fleet-analytics', label: 'Fleet Analytics / फ्लीट', icon: Plane, path: '/operator/fleet-analytics', highlight: true },
      { id: 'new-inquiries', label: 'New Inquiries / नई पूछताछ', icon: Bell, path: '/operator/new-inquiries', highlight: true },
    ]
  },
  {
    id: 'business',
    label: 'Business / व्यापार',
    icon: Briefcase,
    items: [
      { id: 'inquiries', label: 'All Inquiries / सभी पूछताछ', icon: MessageSquare, path: '/operator/inquiries' },
      { id: 'live-auctions', label: 'Live Auctions / लाइव नीलामी', icon: Gavel, path: '/operator/auctions', highlight: true },
      { id: 'quotes', label: 'Quote Requests / कोटेशन', icon: DollarSign, path: '/operator/quotes', highlight: true },
      { id: 'journey-otp', label: 'Journey OTP / यात्रा OTP', icon: Key, path: '/operator/journey-otp', highlight: true },
    ]
  },
  {
    id: 'fleet',
    label: 'Fleet & Crew / फ्लीट और क्रू',
    icon: Plane,
    items: [
      { id: 'fleet', label: 'Fleet Management / फ्लीट', icon: Plane, path: '/operator/fleet' },
      { id: 'maintenance-calendar', label: 'Maintenance Calendar / रखरखाव', icon: Calendar, path: '/operator/maintenance-calendar', highlight: true },
      { id: 'cost-tracker', label: 'Cost Tracker / लागत', icon: DollarSign, path: '/operator/cost-tracker', highlight: true },
      { id: 'pilots', label: 'Pilots / पायलट', icon: Users, path: '/operator/pilots' },
      { id: 'pilot-assignment', label: 'Pilot Assignment / असाइनमेंट', icon: UserPlus, path: '/operator/pilot-assignment', highlight: true },
      { id: 'crew-scheduling', label: 'Crew Scheduling / शेड्यूलिंग', icon: Calendar, path: '/operator/crew-scheduling', highlight: true },
      { id: 'pilot-documents', label: 'Pilot Documents / दस्तावेज़', icon: FileText, path: '/operator/pilot-documents', highlight: true },
    ]
  },
  {
    id: 'tracking',
    label: 'Tracking & Records / ट्रैकिंग',
    icon: Navigation,
    items: [
      { id: 'live-tracking', label: 'Live Tracking / लाइव ट्रैकिंग', icon: MapPin, path: '/operator/live-tracking', highlight: true },
      { id: 'pilot-duty', label: 'Pilot Duty Tracker / FDTL', icon: Shield, path: '/operator/pilot-duty', highlight: true },
      { id: 'flight-records', label: 'Flight Records / उड़ान रिकॉर्ड', icon: BookOpen, path: '/operator/flight-records' },
      { id: 'fuel-records', label: 'Fuel Records / ईंधन रिकॉर्ड', icon: Fuel, path: '/operator/fuel-records' },
      { id: 'landing-permissions', label: 'Landing Permissions / अनुमतियां', icon: Shield, path: '/operator/landing-permissions' },
    ]
  },
  {
    id: 'account',
    label: 'Account / खाता',
    icon: User,
    items: [
      { id: 'pricing', label: 'Pricing Config / मूल्य', icon: DollarSign, path: '/operator/pricing', highlight: true },
      { id: 'profile', label: 'Profile / प्रोफाइल', icon: User, path: '/operator/profile' },
      { id: 'settings', label: 'Settings / सेटिंग्स', icon: Settings, path: '/operator/settings' },
    ]
  },
];

function OperatorDashboard({ user, onLogout }) {
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(['main', 'business']);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Responsive sidebar hook
  const sidebar = useResponsiveSidebar();

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      const response = await operatorAPI.getProfile();
      setHasProfile(response.data.has_profile);
      setOperator(response.data.operator);
    } catch (error) {
      toast.error('Failed to load profile');
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

  const getCurrentTabFromPath = () => {
    const path = location.pathname;
    if (path === '/operator' || path === '/operator/') return 'home';
    const segment = path.replace('/operator/', '').split('/')[0];
    return segment || 'home';
  };

  const getActiveGroup = () => {
    const currentTab = getCurrentTabFromPath();
    for (const group of navGroups) {
      if (group.items.some(item => item.id === currentTab)) {
        return group.id;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show onboarding if no profile
  if (!hasProfile) {
    return <OperatorOnboarding user={user} onComplete={checkProfile} />;
  }

  const currentTab = getCurrentTabFromPath();
  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-slate-950" data-testid="operator-dashboard">
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
            <span className="text-xl lg:text-2xl font-bold text-white">AirYatra Operator</span>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-4">
            <GlobalSearch user={user} />
            <NotificationBell user={user} />
            <div className="text-right hidden sm:block">
              <div className="text-white font-medium text-sm lg:text-base" data-testid="operator-name">{operator?.company_name}</div>
              <div className="text-slate-400 text-xs lg:text-sm" data-testid="verification-status">
                Status: <span className={operator?.status === 'active' ? 'text-green-400' : 'text-orange-400'}>
                  {operator?.status}
                </span>
              </div>
            </div>
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
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={sidebar.closeMobile}
                      title={sidebar.effectiveCollapsed ? item.label : undefined}
                      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                        isActive
                          ? 'bg-orange-500 text-white'
                          : item.highlight
                            ? 'text-yellow-400 hover:bg-yellow-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <ItemIcon className="h-4 w-4 shrink-0" />
                      {!sidebar.effectiveCollapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.highlight && !isActive && (
                            <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full animate-pulse shrink-0" />
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </CollapsibleNavGroup>
            );
          })}
        </ResponsiveSidebar>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route index element={<OperatorHome operator={operator} />} />
              <Route path="new-inquiries" element={<InquiryNotifications operator={operator} />} />
              <Route path="erp" element={<OperatorERP />} />
              <Route path="revenue" element={<OperatorRevenueDashboard user={user} />} />
              <Route path="fleet-analytics" element={<OperatorFleetAnalytics operator={operator} />} />
              <Route path="pilot-duty" element={<PilotDutyTracker />} />
              <Route path="maintenance-calendar" element={<FleetMaintenanceCalendar />} />
              <Route path="fleet" element={<FleetManagement operator={operator} />} />
              <Route path="inquiries" element={<InquiryInbox operator={operator} />} />
              <Route path="auctions" element={<OperatorAuctions />} />
              <Route path="quotes" element={<ReviseQuoteManager operator={operator} />} />
              <Route path="pilots" element={<PilotManagement operator={operator} />} />
              <Route path="journey-otp" element={<JourneyOTPManager operator={operator} />} />
              <Route path="flight-records" element={<FlightRecordsManager operator={operator} />} />
              <Route path="fuel-records" element={<FuelRecordsManager operator={operator} />} />
              <Route path="live-tracking" element={<LiveTrackingMap operator={operator} />} />
              <Route path="landing-permissions" element={<LandingPermissionViewer operator={operator} />} />
              <Route path="pricing" element={<OperatorPricingConfig />} />
              <Route path="profile" element={<OperatorProfile operator={operator} onOperatorUpdate={setOperator} />} />
              <Route path="pilot-assignment" element={<PilotAssignmentCalendar />} />
              <Route path="crew-scheduling" element={<CrewSchedulingBoard />} />
              <Route path="cost-tracker" element={<MaintenanceCostTracker />} />
              <Route path="pilot-documents" element={<PilotDocumentUpload />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default OperatorDashboard;
