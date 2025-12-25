import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Plane, Home, Calendar, FileText, Wallet, LogOut, MapPin, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customerAPI } from '../services/api';
import { toast } from 'sonner';
import MyTrips from '../components/customer/MyTrips';
import ChatWidget from '../components/customer/ChatWidget';
import NotificationBell from '../components/shared/NotificationBell';

function CustomerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchBookings();
  }, []);

  // Sync activeTab with URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/trips')) setActiveTab('trips');
    else if (path.includes('/messages')) setActiveTab('messages');
    else setActiveTab('overview');
  }, [location]);

  const fetchBookings = async () => {
    try {
      const response = await customerAPI.getTrips();
      setBookings(response.data.trips || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      // Silent fail - don't show error toast on dashboard
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: Home, path: '/customer' },
    { id: 'trips', label: 'My Trips', icon: MapPin, path: '/customer/trips' },
    { id: 'profile', label: 'Profile', icon: FileText, path: '/customer/profile' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/customer/messages' },
    { id: 'booking', label: 'New Booking', icon: Calendar, path: '/booking', external: true },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'trips':
        return <MyTrips user={user} />;
      case 'messages':
        return <ChatWidget user={user} />;
      default:
        return (
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-8" data-testid="page-title">My Dashboard</h1>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="glass p-6 rounded-lg">
                <div className="text-slate-400 text-sm uppercase mb-2">Total Bookings</div>
                <div className="text-3xl font-bold text-white" data-testid="total-bookings">{bookings.length}</div>
              </div>
              <div className="glass p-6 rounded-lg">
                <div className="text-slate-400 text-sm uppercase mb-2">Pending</div>
                <div className="text-3xl font-bold text-orange-500" data-testid="pending-bookings">
                  {bookings.filter(b => b.status === 'pending_quotes' || b.status === 'quotes_received').length}
                </div>
              </div>
              <div className="glass p-6 rounded-lg">
                <div className="text-slate-400 text-sm uppercase mb-2">Completed</div>
                <div className="text-3xl font-bold text-green-500" data-testid="completed-bookings">
                  {bookings.filter(b => b.status === 'completed').length}
                </div>
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="glass p-6 rounded-lg">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Recent Bookings</h2>
                <Button 
                  variant="outline" 
                  className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                  onClick={() => { setActiveTab('trips'); navigate('/customer/trips'); }}
                >
                  View All Trips
                </Button>
              </div>
              {loading ? (
                <div className="text-slate-400">Loading...</div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12">
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
                    <div key={booking.id} className="bg-slate-800 p-4 rounded-lg" data-testid={`booking-${booking.id}`}>
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

  return (
    <div className="min-h-screen bg-slate-950" data-testid="customer-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white">AirYatra</span>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell user={user} />
            <span className="text-slate-300" data-testid="user-name">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white" data-testid="logout-btn">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 min-h-[calc(100vh-73px)] p-6">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              if (item.external) {
                return (
                  <Link 
                    key={item.id}
                    to={item.path} 
                    className="flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800"
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              }
              
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); navigate(item.path); }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default CustomerDashboard;