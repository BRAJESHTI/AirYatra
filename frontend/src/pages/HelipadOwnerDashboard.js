import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Calendar, DollarSign, TrendingUp, Bell, User,
  Clock, Plane, CheckCircle, XCircle, RefreshCw,
  Settings, LogOut, ChevronRight, ChevronDown, BarChart3, Home, MapPin, CreditCard, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAPI, authAPI } from '../services/api';
import { toast } from 'sonner';
import HelipadOwnerProfile from '../components/helipad/HelipadOwnerProfile';

// Organized Navigation Structure - 4 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Dashboard',
    icon: Home,
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'bookings', label: 'Bookings', icon: Plane, highlight: true },
    ]
  },
  {
    id: 'availability',
    label: 'Availability',
    icon: Calendar,
    items: [
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'pricing', label: 'Pricing', icon: DollarSign },
    ]
  },
  {
    id: 'earnings',
    label: 'Earnings',
    icon: CreditCard,
    items: [
      { id: 'revenue', label: 'Revenue', icon: TrendingUp },
      { id: 'payouts', label: 'Payouts', icon: CreditCard },
    ]
  },
  {
    id: 'account',
    label: 'Account',
    icon: User,
    items: [
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help', icon: HelpCircle },
    ]
  },
];

function HelipadOwnerDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['main']);
  const [myHelipads, setMyHelipads] = useState([]);
  const [selectedHelipad, setSelectedHelipad] = useState(null);
  const [stats, setStats] = useState({
    total_bookings: 0,
    pending_bookings: 0,
    total_revenue: 0,
    this_month_revenue: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const response = await landingAPI.getMyHelipads();
      const helipads = response.data.helipads || [];
      setMyHelipads(helipads);
      
      if (helipads.length > 0) {
        setSelectedHelipad(helipads[0]);
        
        try {
          const statsResponse = await landingAPI.getHelipadStats(helipads[0].id);
          setStats(statsResponse.data);
        } catch (e) {
          console.log('Stats not available');
        }
        
        try {
          const bookingsResponse = await landingAPI.getHelipadBookings(helipads[0].id);
          setRecentBookings(bookingsResponse.data.bookings || []);
        } catch (e) {
          console.log('Bookings not available');
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    navigate('/login');
    toast.success('Logged out successfully');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const activeGroup = getActiveGroup();

  const renderContent = () => {
    // No Helipad Message
    if (myHelipads.length === 0) {
      return (
        <div className="text-center py-16">
          <Building2 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Helipad Registered</h2>
          <p className="text-slate-400 mb-4">
            You do not have any registered helipad yet. Contact admin to register your helipad.
          </p>
          <p className="text-slate-500 text-sm">
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Bookings</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.total_bookings}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Plane className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Pending</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending_bookings}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">₹{stats.total_revenue?.toLocaleString() || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">This Month</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">₹{stats.this_month_revenue?.toLocaleString() || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Helipad Info */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-400" />
                Your Helipad</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-slate-400 text-sm">Name</p>
                  <p className="text-white font-medium">{selectedHelipad?.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Location</p>
                  <p className="text-white">{selectedHelipad?.city}, {selectedHelipad?.state}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    selectedHelipad?.is_active 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {selectedHelipad?.is_active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {selectedHelipad?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Recent Bookings</h3>
                <Button variant="ghost" className="text-purple-400" onClick={() => setActiveTab('bookings')}>
                  View All <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {recentBookings.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No bookings yet</p>
              ) : (
                <div className="space-y-3">
                  {recentBookings.slice(0, 5).map((booking, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{booking.booking_number || `Booking #${idx + 1}`}</p>
                        <p className="text-slate-400 text-sm">{booking.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-medium">₹{booking.amount?.toLocaleString()}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                          booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'bookings':
        return (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plane className="h-5 w-5 text-blue-400" />
              All Bookings</h3>
            
            {recentBookings.length === 0 ? (
              <div className="text-center py-12">
                <Plane className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No bookings found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                      <th className="pb-3">Booking #</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Time</th>
                      <th className="pb-3">Operator</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking, idx) => (
                      <tr key={idx} className="border-b border-slate-800">
                        <td className="py-4 text-white">{booking.booking_number || `#${idx + 1}`}</td>
                        <td className="py-4 text-slate-300">{booking.date}</td>
                        <td className="py-4 text-slate-300">{booking.time || '-'}</td>
                        <td className="py-4 text-slate-300">{booking.operator_name || '-'}</td>
                        <td className="py-4 text-green-400">₹{booking.amount?.toLocaleString()}</td>
                        <td className="py-4">
                          <span className={`text-xs px-2 py-1 rounded ${
                            booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                            booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 'calendar':
        return (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-400" />
              Manage Availability</h3>
            <p className="text-slate-400 mb-6">Set your helipad availability dates. Block dates when not available.</p>
            
            <div className="bg-slate-900/50 rounded-lg p-8 text-center">
              <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Calendar view coming soon</p>
            </div>
          </div>
        );

      case 'profile':
        return <HelipadOwnerProfile user={user} helipadId={selectedHelipad?.id} onUpdate={loadDashboardData} />;

      case 'settings':
        return (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-slate-400" />
              Settings</h3>
            
            <div className="space-y-4">
              {[
                { title: 'Email Notifications', desc: 'Receive booking alerts via email', checked: true },
                { title: 'SMS Notifications', desc: 'Receive booking alerts via SMS', checked: false },
                { title: 'Auto-confirm Bookings', desc: 'Automatically confirm all requests', checked: false },
              ].map((setting, idx) => (
                <div key={idx} className="p-4 bg-slate-900/50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{setting.title}</p>
                    <p className="text-slate-400 text-sm">{setting.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={setting.checked} />
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center py-12">
            <p className="text-slate-400">Coming soon</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Helipad Owner Portal</h1>
              <p className="text-slate-400 text-sm"></p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Helipad Selector */}
            {myHelipads.length > 1 && (
              <select
                value={selectedHelipad?.id || ''}
                onChange={(e) => {
                  const hp = myHelipads.find(h => h.id === e.target.value);
                  setSelectedHelipad(hp);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                {myHelipads.map(hp => (
                  <option key={hp.id} value={hp.id}>{hp.name}</option>
                ))}
              </select>
            )}
            <Button variant="ghost" className="text-slate-400 hover:text-white">
              <Bell className="h-5 w-5" />
            </Button>
            <span className="text-white text-sm">{user?.full_name}</span>
            <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

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
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <GroupIcon className={`h-5 w-5 ${isActiveGroup ? 'text-purple-400' : ''}`} />
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
                            onClick={() => handleNavClick(item.id, group.id)}
                            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
                              activeTab === item.id
                                ? 'bg-purple-500 text-white'
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

export default HelipadOwnerDashboard;
