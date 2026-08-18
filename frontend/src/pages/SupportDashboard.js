import React, { useState, useEffect } from 'react';
import { LogOut, Plane, Home, MessageSquare, Phone, HelpCircle, Star, ChevronDown, ChevronRight, BarChart3, Settings, Users, Clock, CheckCircle, AlertTriangle, FileText, BookOpen, Video, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/shared/NotificationBell';
import GlobalSearch from '@/components/shared/GlobalSearch';

// Import Support Components
import SupportDashboardComp from '@/components/admin/SupportDashboard';
import ReviewsManagement from '@/components/admin/ReviewsManagement';
import KnowledgeBase from '@/components/admin/KnowledgeBase';
import VoiceVideoSupport from '@/components/admin/VoiceVideoSupport';
import AIChatbot from '@/components/admin/AIChatbot';
import ComplaintAnalytics from '@/components/admin/ComplaintAnalytics';
import TemplateSettings from '@/components/admin/TemplateSettings';
import InAppChat from '@/components/shared/InAppChat';
import SupportRefundsView from '@/components/admin/SupportRefundsView';

// Organized Navigation Structure - 5 Main Categories
const navGroups = [
  {
    id: 'main',
    label: 'Dashboard',
    icon: Home,
    items: [
      { id: 'overview', label: 'Overview', icon: BarChart3 },
      { id: 'open_tickets', label: 'Open Tickets', icon: AlertTriangle, highlight: true },
    ]
  },
  {
    id: 'tickets',
    label: 'Tickets',
    icon: MessageSquare,
    items: [
      { id: 'helpdesk', label: 'Helpdesk', icon: MessageSquare, highlight: true },
      { id: 'all_tickets', label: 'All Tickets', icon: FileText },
      { id: 'my_tickets', label: 'My Tickets', icon: Users },
      { id: 'escalated', label: 'Escalated', icon: AlertTriangle },
      { id: 'refunds', label: 'Refunds', icon: FileText },
    ]
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: Phone,
    items: [
      { id: 'voice_video', label: 'Voice/Video Calls', icon: Video },
      { id: 'ai_chatbot', label: 'AI Chatbot', icon: Bot },
      { id: 'live_chat', label: 'Live Chat', icon: MessageSquare },
    ]
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: Star,
    items: [
      { id: 'reviews', label: 'Reviews', icon: Star },
      { id: 'ratings', label: 'Ratings', icon: Star },
      { id: 'complaints', label: 'Complaints', icon: AlertTriangle },
    ]
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: BookOpen,
    items: [
      { id: 'knowledge_base', label: 'Knowledge Base / FAQ', icon: BookOpen },
      { id: 'templates', label: 'Response Templates', icon: FileText },
    ]
  },
];

function SupportDashboardPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedGroups, setExpandedGroups] = useState(['main', 'tickets']);
  const [stats, setStats] = useState({
    open_tickets: 15,
    resolved_today: 8,
    avg_response_time: '2.5h',
    satisfaction_rate: 94
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
      case 'helpdesk':
      case 'my_tickets':
      case 'all_tickets':
        return <SupportDashboardComp />;
      case 'open_tickets':
        return <SupportDashboardComp initialStatus="open" />;
      case 'escalated':
        return <SupportDashboardComp initialStatus="escalated" />;
      case 'refunds':
        return <SupportRefundsView />;
      case 'complaints':
        return <ComplaintAnalytics />;
      case 'ratings':
        return <ReviewsManagement />;
      case 'live_chat':
        return <InAppChat user={user} />;
      case 'templates':
        return <TemplateSettings />;
      case 'reviews':
        return <ReviewsManagement />;
      case 'knowledge_base':
        return <KnowledgeBase />;
      case 'voice_video':
        return <VoiceVideoSupport />;
      case 'ai_chatbot':
        return <AIChatbot />;
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Support Dashboard</h1>
              <p className="text-slate-400">Customer support and ticket management</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/50">
                <AlertTriangle className="h-5 w-5 text-red-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.open_tickets}</p>
                <p className="text-slate-400 text-sm">Open Tickets</p>
              </div>
              <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/50">
                <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.resolved_today}</p>
                <p className="text-slate-400 text-sm">Resolved Today</p>
              </div>
              <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-500/50">
                <Clock className="h-5 w-5 text-yellow-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.avg_response_time}</p>
                <p className="text-slate-400 text-sm">Avg Response</p>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/50">
                <Star className="h-5 w-5 text-purple-400 mb-2" />
                <p className="text-2xl font-bold text-white">{stats.satisfaction_rate}%</p>
                <p className="text-slate-400 text-sm">Satisfaction</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
              <button onClick={() => setActiveTab('helpdesk')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <MessageSquare className="h-8 w-8 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Open Helpdesk</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
              <button onClick={() => setActiveTab('reviews')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <Star className="h-8 w-8 text-yellow-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Manage Reviews</h3>
                <p className="text-slate-400 text-sm"></p>
              </button>
              <button onClick={() => setActiveTab('knowledge_base')} className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:bg-slate-700 text-left">
                <BookOpen className="h-8 w-8 text-green-400 mb-3" />
                <h3 className="text-lg font-semibold text-white">Knowledge Base</h3>
                <p className="text-slate-400 text-sm">FAQ</p>
              </button>
            </div>
          </div>
        );
    }
  };

  const activeGroup = getActiveGroup();

  return (
    <div className="min-h-screen bg-slate-950" data-testid="support-dashboard">
      <GlobalSearch user={user} />
      {/* Top Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-cyan-500" />
            <span className="text-2xl font-bold text-white">AirYatra Support</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center px-3 py-1 bg-red-500/20 rounded-full">
              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
              <span className="text-red-400 text-sm">{stats.open_tickets} Open</span>
            </div>
            <NotificationBell user={user} />
            <span className="text-slate-300">Welcome, {user.full_name}</span>
            <Button variant="ghost" onClick={onLogout} className="text-white hover:text-cyan-400">
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
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <GroupIcon className={`h-5 w-5 ${isActiveGroup ? 'text-cyan-400' : ''}`} />
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
                                ? 'bg-cyan-500 text-white'
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

export default SupportDashboardPage;
