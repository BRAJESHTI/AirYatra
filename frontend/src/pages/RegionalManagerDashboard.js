import React, { useState, useEffect } from 'react';
import { LogOut, Plane, LayoutDashboard, Users, Calendar, Shield, MapPin, ChevronDown, ChevronRight, Building2, FileText, BarChart3, Settings, User, CheckSquare, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { regionalManagerAPI } from '@/services/api';
import NotificationBell from '@/components/shared/NotificationBell';

// Import regional components
import RegionalOverview from '@/components/regional/RegionalOverview';
import RegionalOperators from '@/components/regional/RegionalOperators';
import RegionalBookings from '@/components/regional/RegionalBookings';
import RegionalPermissions from '@/components/regional/RegionalPermissions';

// Organized Navigation Structure - 4 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
    ]
  },
  {
    id: 'management',
    label: 'Management',
    icon: Building2,
    items: [
      { id: 'operators', label: 'Operators', icon: Users, highlight: true },
      { id: 'bookings', label: 'Bookings', icon: Calendar },
      { id: 'approvals', label: 'Pending Approvals', icon: CheckSquare, highlight: true },
    ]
  },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: Shield,
    items: [
      { id: 'permissions', label: 'Landing Permissions', icon: Shield },
      { id: 'village', label: 'Village Permissions', icon: MapPin },
    ]
  },
  {
    id: 'account',
    label: 'Account',
    icon: User,
    items: [
      { id: 'profile', label: 'My Profile', icon: User },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  },
];

function RegionalManagerDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(['main', 'management']);

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

  const activeGroup = getActiveGroup();

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

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Sidebar - Collapsible Groups */}
        <aside className="w-72 bg-slate-900/50 border-r border-slate-800 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="p-3 space-y-1">
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups.includes(group.id);
              const isActiveGroup = activeGroup === group.id;
              const hasHighlight = group.items.some(item => item.highlight);

              return (
                <div key={group.id} className="mb-1">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                      isActiveGroup
                        ? 'bg-purple-500/20 text-purple-400'
                        : hasHighlight
                          ? 'text-slate-200 hover:bg-slate-800'
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

export default RegionalManagerDashboard;
