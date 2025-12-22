import React, { useState, useEffect } from 'react';
import { LogOut, Plane, LayoutDashboard, Users, Calendar, Shield, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { regionalManagerAPI } from '@/services/api';
import NotificationBell from '@/components/shared/NotificationBell';

// Import regional components
import RegionalOverview from '@/components/regional/RegionalOverview';
import RegionalOperators from '@/components/regional/RegionalOperators';
import RegionalBookings from '@/components/regional/RegionalBookings';
import RegionalPermissions from '@/components/regional/RegionalPermissions';

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'operators', label: 'Operators', icon: Users },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'permissions', label: 'Landing Permissions', icon: Shield },
];

function RegionalManagerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await regionalManagerAPI.getProfile();
      setProfile(response.data.profile);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <RegionalOverview profile={profile} />;
      case 'operators':
        return <RegionalOperators region={profile?.region} />;
      case 'bookings':
        return <RegionalBookings region={profile?.region} />;
      case 'permissions':
        return <RegionalPermissions region={profile?.region} />;
      default:
        return <RegionalOverview profile={profile} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950" data-testid="regional-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-purple-500" />
            <span className="text-2xl font-bold text-white">AirYatra Regional</span>
          </div>
          <div className="flex items-center space-x-4">
            {profile?.region && (
              <div className="flex items-center px-3 py-1 bg-purple-500/20 rounded-full">
                <MapPin className="h-4 w-4 text-purple-500 mr-2" />
                <span className="text-purple-400 text-sm">{profile.region}</span>
              </div>
            )}
            <NotificationBell user={user} />
            <span className="text-slate-300">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-purple-400">
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
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
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

export default RegionalManagerDashboard;
