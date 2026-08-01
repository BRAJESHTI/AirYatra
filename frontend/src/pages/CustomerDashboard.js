import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Plane, Home, Calendar, FileText, Wallet, LogOut, MapPin, MessageSquare, User, Gift, ChevronDown, ChevronRight, Settings, Bell, CreditCard, HelpCircle, Star, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customerAPI } from '../services/api';
import { toast } from 'sonner';
import MyTrips from '../components/customer/MyTrips';
import ChatWidget from '../components/customer/ChatWidget';
import CustomerProfile from '../components/customer/CustomerProfile';
import ReferAndEarn from '../components/customer/ReferAndEarn';
import LoyaltyRewards from '../components/customer/LoyaltyRewards';
import NotificationBell from '../components/shared/NotificationBell';

// Organized Navigation Structure - 4 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Main / मुख्य',
    icon: Home,
    items: [
      { id: 'overview', label: 'Dashboard', icon: Home, path: '/customer' },
      { id: 'trips', label: 'My Trips / मेरी यात्राएं', icon: MapPin, path: '/customer/trips', highlight: true },
      { id: 'booking', label: 'New Booking / नई बुकिंग', icon: Calendar, path: '/booking', external: true, highlight: true },
    ]
  },
  {
    id: 'rewards',
    label: 'Rewards & Offers / पुरस्कार',
    icon: Gift,
    items: [
      { id: 'refer', label: 'Refer & Earn / रेफर करें', icon: Gift, path: '/customer/refer' },
      { id: 'wallet', label: 'My Wallet / वॉलेट', icon: Wallet, path: '/customer/wallet' },
      { id: 'loyalty', label: 'VIP Points / वीआईपी', icon: Star, path: '/customer/loyalty' },
    ]
  },
  {
    id: 'support',
    label: 'Support / सहायता',
    icon: HelpCircle,
    items: [
      { id: 'messages', label: 'Messages / संदेश', icon: MessageSquare, path: '/customer/messages' },
      { id: 'help', label: 'Help Center / मदद', icon: HelpCircle, path: '/customer/help' },
    ]
  },
  {
    id: 'account',
    label: 'Account / खाता',
    icon: User,
    items: [
      { id: 'profile', label: 'Profile / प्रोफाइल', icon: User, path: '/customer/profile' },
      { id: 'security', label: 'Security / सुरक्षा', icon: Shield, path: '/customer/security' },
      { id: 'settings', label: 'Settings / सेटिंग्स', icon: Settings, path: '/customer/settings' },
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

  useEffect(() => {
    fetchBookings();
  }, []);

  // Sync activeTab with URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/trips')) setActiveTab('trips');
    else if (path.includes('/profile')) setActiveTab('profile');
    else if (path.includes('/messages')) setActiveTab('messages');
    else if (path.includes('/refer')) setActiveTab('refer');
    else if (path.includes('/loyalty')) setActiveTab('loyalty');
    else setActiveTab('overview');
  }, [location]);

  const fetchBookings = async () => {
    try {
      const response = await customerAPI.getTrips();
      setBookings(response.data.trips || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
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
      case 'profile':
        return <CustomerProfile user={user} />;
      case 'messages':
        return <ChatWidget user={user} />;
      case 'refer':
        return <ReferAndEarn user={user} />;
      case 'loyalty':
        return <LoyaltyRewards user={user} />;
      default:
        return (
          <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-2" data-testid="page-title">Welcome Back! / स्वागत है!</h1>
            <p className="text-slate-400 mb-8">{user.full_name}</p>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-sm uppercase mb-2">Total Bookings / कुल बुकिंग</div>
                <div className="text-3xl font-bold text-white" data-testid="total-bookings">{bookings.length}</div>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-sm uppercase mb-2">Pending / लंबित</div>
                <div className="text-3xl font-bold text-orange-500" data-testid="pending-bookings">
                  {bookings.filter(b => b.status === 'pending_quotes' || b.status === 'quotes_received').length}
                </div>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                <div className="text-slate-400 text-sm uppercase mb-2">Completed / पूर्ण</div>
                <div className="text-3xl font-bold text-green-500" data-testid="completed-bookings">
                  {bookings.filter(b => b.status === 'completed').length}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Link to="/booking" className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all">
                <Calendar className="h-8 w-8 text-white mb-3" />
                <h3 className="text-xl font-bold text-white mb-1">Book a Flight / फ्लाइट बुक करें</h3>
                <p className="text-orange-100">Charter your private jet or helicopter</p>
              </Link>
              <button onClick={() => { setActiveTab('trips'); navigate('/customer/trips'); }} className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 hover:bg-slate-700/50 transition-all text-left">
                <MapPin className="h-8 w-8 text-blue-400 mb-3" />
                <h3 className="text-xl font-bold text-white mb-1">View My Trips / यात्राएं देखें</h3>
                <p className="text-slate-400">Track and manage your bookings</p>
              </button>
            </div>

            {/* Recent Bookings */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Recent Bookings / हाल की बुकिंग</h2>
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
                  <p className="text-slate-400 mb-4">No bookings yet / अभी कोई बुकिंग नहीं</p>
                  <Link to="/booking">
                    <Button className="bg-orange-500 hover:bg-orange-600" data-testid="create-first-booking-btn">
                      Create Your First Booking
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700" data-testid={`booking-${booking.id}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-white">{booking.booking_number}</div>
                          <div className="text-slate-400 text-sm">
                            {booking.from_location} → {booking.to_location}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs ${
                          booking.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`} data-testid={`booking-status-${booking.id}`}>
                          {booking.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
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
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white">AirYatra</span>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell user={user} />
            <span className="text-slate-300" data-testid="user-name">{user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-orange-400" data-testid="logout-btn">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Sidebar - Collapsible Groups */}
        <aside className="w-64 bg-slate-900/50 border-r border-slate-800 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="p-3 space-y-1">
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups.includes(group.id);
              const isActiveGroup = activeGroup === group.id;

              return (
                <div key={group.id} className="mb-1">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                      isActiveGroup
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <GroupIcon className={`h-5 w-5 ${isActiveGroup ? 'text-orange-400' : ''}`} />
                      <span className="font-medium text-sm">{group.label}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {/* Group Items */}
                  {isExpanded && (
                    <div className="mt-1 ml-4 space-y-0.5 border-l border-slate-700 pl-3">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavClick(item, group.id)}
                            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                              activeTab === item.id
                                ? 'bg-orange-500 text-white'
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

export default CustomerDashboard;
