import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Plane, Home, Calendar, FileText, Wallet, LogOut, MapPin, MessageSquare, User, Gift, ChevronDown, ChevronRight, Settings, Bell, CreditCard, HelpCircle, Star, Shield, PieChart, TrendingUp, Sparkles, Menu, Eye, XCircle, Gavel, Scale, Flag, Leaf, Anchor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customerAPI } from '../services/api';
import { toast } from 'sonner';
import MyTrips from '../components/customer/MyTrips';
import MyComplaints from '../components/customer/MyComplaints';
import ChatWidget from '../components/customer/ChatWidget';
import CustomerProfile from '../components/customer/CustomerProfile';
import ReferAndEarn from '../components/customer/ReferAndEarn';
import LoyaltyRewards from '../components/customer/LoyaltyRewards';
import MyInvestments from '../components/customer/MyInvestments';
import MyWatchlist from '../components/customer/MyWatchlist';
import CustomerPaymentHistory from '../components/customer/CustomerPaymentHistory';
import NotificationBell from '../components/shared/NotificationBell';
import GlobalSearch from '../components/shared/GlobalSearch';
import SwipeableCard from '../components/shared/SwipeableCard';
import CustomerKYCUpload from '../components/customer/CustomerKYCUpload';
import LoginActivityLog from '../components/auth/LoginActivityLog';
import TwoFactorSetup from '../components/auth/TwoFactorSetup';
import { useResponsiveSidebar, MobileMenuButton, ResponsiveSidebar, CollapsibleNavGroup } from '../components/shared/Sidebar';
import RefundHistory from '../components/customer/RefundHistory';
import BookYourJourney from '../components/customer/BookYourJourney';
import FeaturedAssets from '../components/customer/FeaturedAssets';
import { Zap } from 'lucide-react';

// Organized Navigation Structure - 4 Main Categories (English Only)
const navGroups = [
  {
    id: 'main',
    label: 'Main',
    icon: Home,
    items: [
      { id: 'overview', label: 'Dashboard', icon: Home, path: '/customer' },
      { id: 'book', label: 'Book Your Journey', icon: Calendar, path: '/customer/book', highlight: true },
      { id: 'trips', label: 'My Trips', icon: MapPin, path: '/customer/trips', highlight: true },
      { id: 'watchlist', label: 'My Watchlist', icon: Bell, path: '/customer/watchlist' },
    ]
  },
  {
    id: 'rewards',
    label: 'Payments, Rewards & Offers',
    icon: Gift,
    items: [
      { id: 'payments', label: 'Payment History', icon: CreditCard, path: '/customer/payments', highlight: true },
      { id: 'refunds', label: 'Refund History', icon: Wallet, path: '/customer/refunds', highlight: true },
      { id: 'refer', label: 'Refer & Earn', icon: Gift, path: '/customer/refer' },
      { id: 'investments', label: 'My Investments', icon: PieChart, path: '/customer/investments' },
      { id: 'loyalty', label: 'VIP Points', icon: Star, path: '/customer/loyalty' },
    ]
  },
  {
    id: 'support',
    label: 'Support',
    icon: HelpCircle,
    items: [
      { id: 'complaints', label: 'My Complaints', icon: Flag, path: '/customer/complaints', highlight: true },
      { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/customer/messages' },
    ]
  },
  {
    id: 'account',
    label: 'Account',
    icon: User,
    items: [
      { id: 'profile', label: 'Profile', icon: User, path: '/customer/profile' },
      { id: 'kyc', label: 'KYC Documents', icon: Shield, path: '/customer/kyc', highlight: true },
      { id: 'security', label: 'Security', icon: Shield, path: '/customer/security' },
    ]
  },
];

function CustomerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(['main']);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Responsive sidebar hook
  const sidebar = useResponsiveSidebar();

  useEffect(() => {
    fetchBookings();
  }, []);

  // Sync activeTab with URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/trips')) setActiveTab('trips');
    else if (path.includes('/book')) setActiveTab('book');
    else if (path.includes('/marine')) setActiveTab('book');
    else if (path.includes('/complaints')) setActiveTab('complaints');
    else if (path.includes('/investments')) setActiveTab('investments');
    else if (path.includes('/watchlist')) setActiveTab('watchlist');
    else if (path.includes('/auctions')) setActiveTab('watchlist');
    else if (path.includes('/profile')) setActiveTab('profile');
    else if (path.includes('/messages')) setActiveTab('messages');
    else if (path.includes('/refer')) setActiveTab('refer');
    else if (path.includes('/loyalty')) setActiveTab('loyalty');
    else if (path.includes('/payments')) setActiveTab('payments');
    else if (path.includes('/refunds')) setActiveTab('refunds');
    else if (path.includes('/kyc')) setActiveTab('kyc');
    else setActiveTab('overview');
  }, [location.pathname]);

  const fetchBookings = useCallback(async () => {
    try {
      const response = await customerAPI.getTrips();
      setBookings(response.data.trips || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleNavClick = (item, groupId) => {
    if (item.external) {
      navigate(item.path);
    } else {
      setActiveTab(item.id);
      navigate(item.path);
    }
    if (!expandedGroups.includes(groupId)) {
      setExpandedGroups(prev => [...prev, groupId]);
    }
    // Close mobile sidebar
    sidebar.closeMobile();
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
      case 'trips':
        return <MyTrips user={user} />;
      case 'book':
        return <BookYourJourney />;
      case 'investments':
        return <MyInvestments user={user} />;
      case 'watchlist':
        return <MyWatchlist user={user} />;
      case 'profile':
        return <CustomerProfile user={user} />;
      case 'kyc':
        return <CustomerKYCUpload user={user} />;
      case 'security':
        return (
          <div className="space-y-6">
            <TwoFactorSetup user={user} />
            <LoginActivityLog user={user} />
          </div>
        );
      case 'messages':
        return <ChatWidget user={user} />;
      case 'refer':
        return <ReferAndEarn user={user} />;
      case 'loyalty':
        return <LoyaltyRewards user={user} />;
      case 'payments':
        return <CustomerPaymentHistory user={user} />;
      case 'refunds':
        return <RefundHistory userId={user?.id} />;
      case 'complaints':
        return <MyComplaints user={user} />;
      default:
        return (
          <div className="max-w-6xl mx-auto">
            <FeaturedAssets />
            {/* Welcome Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1" data-testid="page-title">
                  Welcome Back, {user.full_name?.split(' ')[0] || 'User'}!
                </h1>
                <p className="text-slate-400">Manage your flights and bookings</p>
              </div>
              {/* Mobile: Book Now + Login visible at top */}
              <div className="flex gap-3 mt-4 sm:mt-0">
                <Button className="bg-orange-500 hover:bg-orange-600" data-testid="header-book-btn"
                  onClick={() => { setActiveTab('book'); navigate('/customer/book'); }}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Your Journey
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-4 sm:p-6 rounded-xl border border-blue-500/30">
                <div className="text-slate-400 text-xs sm:text-sm uppercase mb-2">Total Bookings</div>
                <div className="text-2xl sm:text-3xl font-bold text-white" data-testid="total-bookings">{bookings.length}</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 p-4 sm:p-6 rounded-xl border border-orange-500/30">
                <div className="text-slate-400 text-xs sm:text-sm uppercase mb-2">Pending</div>
                <div className="text-2xl sm:text-3xl font-bold text-orange-400" data-testid="pending-bookings">
                  {bookings.filter(b => b.status === 'pending_quotes' || b.status === 'quotes_received').length}
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 p-4 sm:p-6 rounded-xl border border-green-500/30">
                <div className="text-slate-400 text-xs sm:text-sm uppercase mb-2">Completed</div>
                <div className="text-2xl sm:text-3xl font-bold text-green-400" data-testid="completed-bookings">
                  {bookings.filter(b => b.status === 'completed').length}
                </div>
              </div>
            </div>

            {/* Quick Actions - Larger CTAs */}
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
              <button onClick={() => { setActiveTab('book'); navigate('/customer/book'); }} data-testid="book-your-journey-cta"
                className="group bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-[1.02] text-left">
                <Calendar className="h-8 w-8 text-white mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold text-white mb-1">BOOK YOUR JOURNEY</h3>
                <p className="text-orange-100 text-sm">Helicopter • Private Jet • Yacht • Cruise</p>
              </button>
              <button onClick={() => { setActiveTab('trips'); navigate('/customer/trips'); }} className="group bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 hover:border-blue-500/50 transition-all text-left transform hover:scale-[1.02]">
                <MapPin className="h-8 w-8 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold text-white mb-1">View My Trips</h3>
                <p className="text-slate-400 text-sm">Track and manage your bookings</p>
              </button>
            </div>

            {/* Quick Access Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <button 
                onClick={() => { setActiveTab('payments'); navigate('/customer/payments'); }}
                className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 hover:border-orange-500/50 transition-all text-center"
              >
                <CreditCard className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                <span className="text-sm text-white">Payments</span>
              </button>
              <button 
                onClick={() => { setActiveTab('watchlist'); navigate('/customer/watchlist'); }}
                className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 hover:border-purple-500/50 transition-all text-center"
              >
                <Gavel className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                <span className="text-sm text-white">My Watchlist</span>
              </button>
              <button 
                onClick={() => { setActiveTab('complaints'); navigate('/customer/complaints'); }}
                className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 hover:border-blue-500/50 transition-all text-center"
              >
                <HelpCircle className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <span className="text-sm text-white">Support</span>
              </button>
              <button 
                onClick={() => { setActiveTab('loyalty'); navigate('/customer/loyalty'); }}
                className="p-4 rounded-xl bg-slate-800/30 border border-slate-700 hover:border-amber-500/50 transition-all text-center"
              >
                <Star className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <span className="text-sm text-white">VIP Points</span>
              </button>
            </div>

            {/* Recent Bookings */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Recent Bookings</h2>
                <Button 
                  variant="outline" 
                  className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                  onClick={() => { setActiveTab('trips'); navigate('/customer/trips'); }}
                >
                  View All
                </Button>
              </div>
              {loading ? (
                <div className="text-slate-400">Loading...</div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12">
                  <Plane className="h-16 w-16 mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400 mb-4">No bookings yet</p>
                  <Link to="/booking">
                    <Button className="bg-orange-500 hover:bg-orange-600" data-testid="create-first-booking-btn">
                      Create Your First Booking
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.slice(0, 5).map((booking) => (
                    <SwipeableCard
                      key={booking.id}
                      className="rounded-lg overflow-hidden"
                      actions={[
                        {
                          id: 'view',
                          icon: Eye,
                          color: 'bg-blue-500',
                          onClick: () => navigate(`/customer/inquiry/${booking.id}`)
                        },
                        ...(booking.status !== 'cancelled' && booking.status !== 'completed' ? [{
                          id: 'cancel',
                          icon: XCircle,
                          color: 'bg-red-500',
                          onClick: () => toast.info('Cancel from My Trips page')
                        }] : [])
                      ]}
                    >
                      <div className="bg-slate-900/50 p-4 border border-slate-700 hover:border-slate-600 transition-colors" data-testid={`booking-${booking.id}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-white">{booking.booking_number}</div>
                            <div className="text-slate-400 text-sm">
                              {booking.from_location} → {booking.to_location}
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                            'bg-orange-500/20 text-orange-400'
                          }`} data-testid={`booking-status-${booking.id}`}>
                            {booking.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {/* Mobile swipe hint */}
                        <p className="text-xs text-slate-500 mt-2 sm:hidden">Swipe left for actions</p>
                      </div>
                    </SwipeableCard>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-slate-950" data-testid="customer-dashboard">
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
            <span className="text-xl lg:text-2xl font-bold text-white">AirYatra</span>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-4">
            <GlobalSearch user={user} />
            <NotificationBell user={user} />
            <span className="text-slate-300 hidden sm:inline text-sm lg:text-base" data-testid="user-name">{user.full_name}</span>
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

            return (
              <CollapsibleNavGroup
                key={group.id}
                icon={GroupIcon}
                label={group.label}
                isExpanded={isExpanded}
                onToggle={() => toggleGroup(group.id)}
                isActive={isActiveGroup}
                hasHighlight={group.items.some(item => item.highlight)}
                isCollapsed={sidebar.effectiveCollapsed}
              >
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item, group.id)}
                      title={sidebar.effectiveCollapsed ? item.label : undefined}
                      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                        activeTab === item.id
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
                          {item.highlight && activeTab !== item.id && (
                            <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full shrink-0" />
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </CollapsibleNavGroup>
            );
          })}
        </ResponsiveSidebar>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default CustomerDashboard;
