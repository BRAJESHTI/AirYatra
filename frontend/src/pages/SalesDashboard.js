import React, { useState, useEffect } from 'react';
import { LogOut, Plane, Home, Users, Phone, Target, TrendingUp, ChevronDown, ChevronRight, BarChart3, Settings, DollarSign, MessageSquare, Calendar, Gift, Bell, Award, FileText, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/shared/NotificationBell';

// Import Sales Components
import CRMDashboard from '@/components/admin/CRMDashboard';
import MarketingCampaigns from '@/components/admin/MarketingCampaigns';
import ReferralSettings from '@/components/admin/ReferralSettings';

// Organized Navigation Structure - 5 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Dashboard',
    icon: Home,
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'targets', label: 'My Targets', icon: Target, highlight: true },
    ]
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    items: [
      { id: 'crm_dashboard', label: 'CRM Dashboard', icon: Users, highlight: true },
      { id: 'leads', label: 'All Leads', icon: Users },
      { id: 'calls', label: 'Call Logs', icon: Phone },
      { id: 'tasks', label: 'Tasks', icon: Calendar },
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
      { id: 'promotions', label: 'Promotions', icon: Gift },
      { id: 'referral', label: 'Referral Program', icon: Gift },
    ]
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: TrendingUp,
    items: [
      { id: 'my_performance', label: 'My Performance', icon: TrendingUp },
      { id: 'team_performance', label: 'Team Performance', icon: Users },
      { id: 'incentives', label: 'My Incentives', icon: Award, highlight: true },
    ]
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    items: [
      { id: 'sales_report', label: 'Sales Report', icon: FileText },
      { id: 'conversion_report', label: 'Conversion Report', icon: BarChart3 },
    ]
  },
];

function SalesDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['main', 'crm']);
  const [stats, setStats] = useState({
    total_leads: 45,
    converted: 12,
    pending_calls: 8,
    this_month_target: 50,
    achieved: 28
  });

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
      case 'crm_dashboard':
        return <CRMDashboard />;
      case 'campaigns':
        return <MarketingCampaigns />;
      case 'referral':
        return <ReferralSettings />;
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Sales Dashboard</h1>
              <p className="text-slate-400">Track leads, conversions and targets</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/50">
                <Users className="h-5 w-5 text-blue-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.total_leads}</p>
                <p className="text-slate-400 text-sm">Total Leads</p>
              </div>
              <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
                <TrendingUp className="h-5 w-5 text-green-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.converted}</p>
                <p className="text-slate-400 text-sm">Converted</p>
              </div>
              <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/50">
                <Phone className="h-5 w-5 text-yellow-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.pending_calls}</p>
                <p className="text-slate-400 text-sm">Pending Calls</p>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
                <Target className="h-5 w-5 text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.this_month_target}</p>
                <p className="text-slate-400 text-sm">Target</p>
              </div>
              <div className="bg-orange-500/20 rounded-lg p-4 border border-orange-500/50">
                <Award className="h-5 w-5 text-orange-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.achieved}</p>
                <p className="text-slate-400 text-sm">Achieved</p>
              </div>
            </div>

            {/* Target Progress */}
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Monthly Target Progress</h2>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500" style={{ width: `${(stats.achieved / stats.this_month_target) * 100}%` }} />
                  </div>
                </div>
                <span className="text-white font-bold">{Math.round((stats.achieved / stats.this_month_target) * 100)}%</span>
              </div>
              <p className="text-slate-400 mt-2">{stats.achieved} of {stats.this_month_target} conversions</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('crm_dashboard')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Users className="h-8 w-8 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">View CRM</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
              <button onClick={() => setActiveTab('campaigns')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Megaphone className="h-8 w-8 text-purple-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Marketing Campaigns</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
              <button onClick={() => setActiveTab('referral')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Gift className="h-8 w-8 text-green-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Referral Program</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
            </div>
          </div>
        );
    }
  };

  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-slate-950" data-testid="sales-dashboard">
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-blue-500" />
            <span className="text-2xl font-bold text-white">AirYatra Sales</span>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationBell user={user} />
            <span className="text-slate-300">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-blue-400">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className="w-72 bg-slate-900/50 border-r border-slate-800 overflow-y-auto sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="p-3 space-y-1">
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups.includes(group.id);
              const isActiveGroup = activeGroup === group.id;

              return (
                <div key={group.id} className="mb-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                      isActiveGroup
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <GroupIcon className={`h-5 w-5 ${isActiveGroup ? 'text-blue-400' : ''}`} />
                      <span className="font-medium text-sm">{group.label}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

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
                                ? 'bg-blue-500 text-white'
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

export default SalesDashboard;
