import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Calendar, DollarSign, TrendingUp, Bell, User,
  Clock, Plane, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Settings, LogOut, ChevronRight, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { landingAPI, authAPI } from '../services/api';
import { toast } from 'sonner';
import HelipadOwnerProfile from '../components/helipad/HelipadOwnerProfile';

function HelipadOwnerDashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
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
      // Load helipads owned by this user
      const response = await landingAPI.getMyHelipads();
      const helipads = response.data.helipads || [];
      setMyHelipads(helipads);
      
      if (helipads.length > 0) {
        setSelectedHelipad(helipads[0]);
        
        // Load stats for the helipad
        try {
          const statsResponse = await landingAPI.getHelipadStats(helipads[0].id);
          setStats(statsResponse.data);
        } catch (e) {
          // Stats might not be available
          console.log('Stats not available');
        }
        
        // Load recent bookings
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

  const tabs = [
    { id: 'overview', label: 'Overview / ओवरव्यू', icon: BarChart3 },
    { id: 'calendar', label: 'Availability / उपलब्धता', icon: Calendar },
    { id: 'bookings', label: 'Bookings / बुकिंग', icon: Plane },
    { id: 'profile', label: 'Profile / प्रोफाइल', icon: User },
    { id: 'settings', label: 'Settings / सेटिंग्स', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Helipad Owner Portal</h1>
              <p className="text-slate-400 text-sm">हेलीपैड मालिक पोर्टल</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-slate-400 hover:text-white">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <User className="h-4 w-4 text-purple-400" />
              </div>
              <span className="text-white text-sm hidden md:block">{user?.full_name}</span>
            </div>
            <Button 
              variant="ghost" 
              className="text-red-400 hover:text-red-300"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Helipad Selector (if multiple) */}
        {myHelipads.length > 1 && (
          <div className="mb-6">
            <label className="text-slate-400 text-sm mb-2 block">Select Helipad / हेलीपैड चुनें</label>
            <select
              value={selectedHelipad?.id || ''}
              onChange={(e) => {
                const hp = myHelipads.find(h => h.id === e.target.value);
                setSelectedHelipad(hp);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            >
              {myHelipads.map(hp => (
                <option key={hp.id} value={hp.id}>{hp.name} - {hp.city}</option>
              ))}
            </select>
          </div>
        )}

        {/* No Helipad Message */}
        {myHelipads.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No Helipad Registered</h2>
            <p className="text-slate-400 mb-4">
              You don't have any registered helipad yet. Contact admin to register your helipad.
            </p>
            <p className="text-slate-500 text-sm">
              आपका कोई पंजीकृत हेलीपैड नहीं है। अपना हेलीपैड पंजीकृत करने के लिए एडमिन से संपर्क करें।
            </p>
          </div>
        )}

        {/* Dashboard Content */}
        {selectedHelipad && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
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
                        <p className="text-slate-400 text-sm">Pending Requests</p>
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

                {/* Helipad Info Card */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-400" />
                    Your Helipad / आपका हेलीपैड
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-slate-400 text-sm">Name</p>
                      <p className="text-white font-medium">{selectedHelipad.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Location</p>
                      <p className="text-white">{selectedHelipad.city}, {selectedHelipad.state}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Status</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        selectedHelipad.is_active 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {selectedHelipad.is_active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {selectedHelipad.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent Bookings */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Plane className="h-5 w-5 text-blue-400" />
                      Recent Bookings / हाल की बुकिंग
                    </h3>
                    <Button 
                      variant="ghost" 
                      className="text-purple-400"
                      onClick={() => setActiveTab('bookings')}
                    >
                      View All <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {recentBookings.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No bookings yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentBookings.slice(0, 5).map((booking, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg"
                        >
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
            )}

            {/* Calendar Tab */}
            {activeTab === 'calendar' && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-400" />
                  Manage Availability / उपलब्धता प्रबंधित करें
                </h3>
                <p className="text-slate-400 mb-4">
                  Set your helipad availability dates. Block dates when your helipad is not available.
                </p>
                <p className="text-slate-500 text-sm mb-6">
                  अपने हेलीपैड की उपलब्धता तिथियां सेट करें। जब आपका हेलीपैड उपलब्ध नहीं है तब तिथियां ब्लॉक करें।
                </p>
                
                {/* Calendar placeholder - would integrate full calendar component */}
                <div className="bg-slate-900/50 rounded-lg p-8 text-center">
                  <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Calendar view coming soon</p>
                  <p className="text-slate-500 text-sm">Contact admin to update availability</p>
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Plane className="h-5 w-5 text-blue-400" />
                  All Bookings / सभी बुकिंग
                </h3>
                
                {recentBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <Plane className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No bookings found</p>
                    <p className="text-slate-500 text-sm">कोई बुकिंग नहीं मिली</p>
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
                                booking.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
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
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <HelipadOwnerProfile 
                user={user} 
                helipadId={selectedHelipad?.id}
                onUpdate={loadDashboardData}
              />
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-slate-400" />
                  Settings / सेटिंग्स
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Email Notifications</p>
                      <p className="text-slate-400 text-sm">Receive booking alerts via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">SMS Notifications</p>
                      <p className="text-slate-400 text-sm">Receive booking alerts via SMS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Auto-confirm Bookings</p>
                      <p className="text-slate-400 text-sm">Automatically confirm all booking requests</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HelipadOwnerDashboard;
