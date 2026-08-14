import React, { useState, useEffect } from 'react';
import { 
  Users, Phone, Target, Calendar, Clock, Plus, Search, 
  Filter, RefreshCw, TrendingUp, AlertTriangle, Check, X, 
  User, Mail, Building2, MapPin, PhoneCall, MessageSquare,
  ChevronRight, ChevronDown, Edit2, UserPlus, ArrowRight,
  Loader2, BarChart3, ListChecks, Award, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { crmAPI, userManagementAPI } from '@/services/api';
import { toast } from 'sonner';

// Lead Status Colors
const statusColors = {
  new: 'bg-blue-500',
  contacted: 'bg-yellow-500',
  qualified: 'bg-purple-500',
  proposal_sent: 'bg-indigo-500',
  negotiation: 'bg-orange-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
  follow_up: 'bg-cyan-500',
  not_interested: 'bg-gray-500',
};

const priorityColors = {
  hot: 'bg-red-500 text-white',
  warm: 'bg-orange-500 text-white',
  cold: 'bg-blue-500 text-white',
};

const sourceIcons = {
  facebook: '📘',
  whatsapp: '💬',
  email: '📧',
  gmail: '📩',
  indiamart: '🏭',
  justdial: '📞',
  sulekha: '🔍',
  website: '🌐',
  referral: '👥',
  walk_in: '🚶',
  phone_inquiry: '📱',
  other: '📝',
};

function CRMDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [salesTeam, setSalesTeam] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    priority: '',
    search: '',
    assigned_to: '',
  });

  useEffect(() => {
    loadDashboard();
    loadLeads();
    loadTasks();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await crmAPI.getDashboard();
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load CRM dashboard:', error);
    }
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.source) params.source = filters.source;
      if (filters.priority) params.priority = filters.priority;
      if (filters.search) params.search = filters.search;
      if (filters.assigned_to) params.assigned_to = filters.assigned_to;
      
      const response = await crmAPI.getLeads(params);
      setLeads(response.data.leads || []);
    } catch (error) {
      console.error('Failed to load leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await crmAPI.getTasks({});
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const loadSalesTeam = async () => {
    try {
      const response = await crmAPI.getSalesTeamPerformance();
      setSalesTeam(response.data.team || []);
    } catch (error) {
      console.error('Failed to load sales team:', error);
    }
  };

  const handleAutoReassign = async () => {
    try {
      const response = await crmAPI.autoReassignLeads();
      toast.success(response.data.message);
      loadLeads();
      loadDashboard();
    } catch (error) {
      toast.error('Failed to auto-reassign leads');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    loadLeads();
  }, [filters]);

  // Dashboard Overview Component
  const DashboardOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Total Leads</p>
              <p className="text-white text-2xl font-bold">{dashboard?.summary?.total_leads || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Converted</p>
              <p className="text-white text-2xl font-bold">{dashboard?.summary?.converted || 0}</p>
              <p className="text-green-400 text-xs">{dashboard?.summary?.conversion_rate || 0}%</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Phone className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Today's Calls</p>
              <p className="text-white text-2xl font-bold">{dashboard?.summary?.today_calls || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Overdue Tasks</p>
              <p className="text-white text-2xl font-bold">{dashboard?.summary?.overdue_tasks || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row - Today Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl p-4 border border-blue-500/30">
          <h4 className="text-blue-400 text-sm mb-2">Today's New Leads</h4>
          <p className="text-white text-3xl font-bold">{dashboard?.summary?.today_leads || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-600/10 rounded-xl p-4 border border-yellow-500/30">
          <h4 className="text-yellow-400 text-sm mb-2">New Leads (Action Required)</h4>
          <p className="text-white text-3xl font-bold">{dashboard?.summary?.new_leads || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl p-4 border border-purple-500/30">
          <h4 className="text-purple-400 text-sm mb-2">Pending Tasks</h4>
          <p className="text-white text-3xl font-bold">{dashboard?.summary?.pending_tasks || 0}</p>
        </div>
      </div>

      {/* Lead Source Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-400" />
            Lead Sources
          </h3>
          <div className="space-y-3">
            {dashboard?.source_breakdown?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{sourceIcons[item.source] || '📝'}</span>
                  <span className="text-slate-300 capitalize">{item.source?.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${Math.min((item.count / (dashboard?.summary?.total_leads || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-white font-medium w-8 text-right">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-blue-400" />
            Status Breakdown
          </h3>
          <div className="space-y-3">
            {dashboard?.status_breakdown?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${statusColors[item.status] || 'bg-gray-500'}`}></span>
                  <span className="text-slate-300 capitalize">{item.status?.replace('_', ' ')}</span>
                </div>
                <span className="text-white font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Urgent Leads */}
      {dashboard?.urgent_leads?.length > 0 && (
        <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-red-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Urgent: Leads Not Contacted (1+ Hour)
            </h3>
            <Button 
              size="sm" 
              onClick={handleAutoReassign}
              className="bg-red-500 hover:bg-red-600"
            >
              Auto-Reassign All
            </Button>
          </div>
          <div className="space-y-2">
            {dashboard.urgent_leads.map((lead, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{sourceIcons[lead.source] || '📝'}</span>
                  <div>
                    <p className="text-white font-medium">{lead.name || 'No Name'}</p>
                    <p className="text-slate-400 text-sm">{lead.phone || lead.email}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setSelectedLead(lead);
                    setShowLeadModal(true);
                  }}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Leads */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-green-400" />
          Recent Leads
        </h3>
        <div className="space-y-3">
          {dashboard?.recent_leads?.map((lead, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition cursor-pointer"
                 onClick={() => { setSelectedLead(lead); setShowLeadModal(true); }}>
              <div className="flex items-center gap-4">
                <span className="text-2xl">{sourceIcons[lead.source] || '📝'}</span>
                <div>
                  <p className="text-white font-medium">{lead.name || 'No Name'}</p>
                  <p className="text-slate-400 text-sm">{lead.phone || lead.email} • {lead.city || lead.state}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs ${priorityColors[lead.priority] || 'bg-gray-500'}`}>
                  {lead.priority?.toUpperCase()}
                </span>
                <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[lead.status] || 'bg-gray-500'}`}>
                  {lead.status?.replace('_', ' ')}
                </span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Leads List Component
  const LeadsList = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <Label className="text-slate-400 text-xs mb-1 block">Search</Label>
            <Input
              placeholder="Name, Phone, Email..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="bg-slate-900 border-slate-600"
            />
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1 block">Status</Label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
            >
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="negotiation">Negotiation</option>
              <option value="follow_up">Follow Up</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1 block">Source</Label>
            <select
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
            >
              <option value="">All Sources</option>
              <option value="facebook">Facebook</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="indiamart">IndiaMart</option>
              <option value="justdial">JustDial</option>
              <option value="website">Website</option>
              <option value="phone_inquiry">Phone Inquiry</option>
              <option value="referral">Referral</option>
            </select>
          </div>
          <div>
            <Label className="text-slate-400 text-xs mb-1 block">Priority</Label>
            <select
              value={filters.priority}
              onChange={(e) => handleFilterChange('priority', e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
            >
              <option value="">All Priority</option>
              <option value="hot">Hot 🔥</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={loadLeads} className="w-full bg-orange-500 hover:bg-orange-600">
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <p className="text-slate-400">
          Showing {leads.length} leads
        </p>
        <div className="flex gap-2">
          <Button onClick={handleAutoReassign} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Auto-Reassign Stale
          </Button>
          <Button onClick={() => setShowLeadModal(true)} className="bg-green-500 hover:bg-green-600" size="sm">
            <Plus className="h-4 w-4 mr-2" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center p-8 text-slate-400">
            No leads found. Create your first lead!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="text-left p-4 text-slate-400 font-medium">Lead</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Contact</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Source</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Priority</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Assigned To</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-700 hover:bg-slate-800/50 transition">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{lead.name || 'No Name'}</p>
                        <p className="text-slate-400 text-xs">{lead.lead_number}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-slate-300 text-sm">{lead.phone}</p>
                        <p className="text-slate-400 text-xs">{lead.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-2">
                        <span className="text-xl">{sourceIcons[lead.source] || '📝'}</span>
                        <span className="text-slate-300 text-sm capitalize">{lead.source?.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[lead.status] || 'bg-gray-500'}`}>
                        {lead.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${priorityColors[lead.priority] || 'bg-gray-500'}`}>
                        {lead.priority?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300 text-sm">
                      {lead.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => { setSelectedLead(lead); setShowCallModal(true); }}
                        >
                          <PhoneCall className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => { setSelectedLead(lead); setShowLeadModal(true); }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // Tasks Component
  const TasksView = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-semibold">Tasks</h3>
        <Button onClick={() => setShowTaskModal(true)} className="bg-green-500 hover:bg-green-600" size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Task
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h4 className="text-yellow-400 font-medium mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Pending
          </h4>
          <div className="space-y-2">
            {tasks.filter(t => t.status === 'pending').map((task, idx) => (
              <div key={idx} className="bg-slate-900/50 p-3 rounded-lg">
                <p className="text-white font-medium text-sm">{task.title}</p>
                <p className="text-slate-400 text-xs mt-1">{task.description?.substring(0, 50)}...</p>
                <p className="text-yellow-400 text-xs mt-2">Due: {new Date(task.due_date).toLocaleDateString()}</p>
              </div>
            ))}
            {tasks.filter(t => t.status === 'pending').length === 0 && (
              <p className="text-slate-500 text-sm">No pending tasks</p>
            )}
          </div>
        </div>
        
        {/* In Progress */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h4 className="text-blue-400 font-medium mb-4 flex items-center gap-2">
            <Loader2 className="h-4 w-4" /> In Progress
          </h4>
          <div className="space-y-2">
            {tasks.filter(t => t.status === 'in_progress').map((task, idx) => (
              <div key={idx} className="bg-slate-900/50 p-3 rounded-lg">
                <p className="text-white font-medium text-sm">{task.title}</p>
                <p className="text-slate-400 text-xs mt-1">{task.description?.substring(0, 50)}...</p>
              </div>
            ))}
            {tasks.filter(t => t.status === 'in_progress').length === 0 && (
              <p className="text-slate-500 text-sm">No tasks in progress</p>
            )}
          </div>
        </div>
        
        {/* Completed */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h4 className="text-green-400 font-medium mb-4 flex items-center gap-2">
            <Check className="h-4 w-4" /> Completed
          </h4>
          <div className="space-y-2">
            {tasks.filter(t => t.status === 'completed').slice(0, 5).map((task, idx) => (
              <div key={idx} className="bg-slate-900/50 p-3 rounded-lg opacity-70">
                <p className="text-white font-medium text-sm line-through">{task.title}</p>
              </div>
            ))}
            {tasks.filter(t => t.status === 'completed').length === 0 && (
              <p className="text-slate-500 text-sm">No completed tasks</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Sales Team Performance Component
  const SalesTeamView = () => {
    useEffect(() => {
      loadSalesTeam();
    }, []);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-white font-semibold">Sales Team Performance</h3>
          <Button onClick={() => setShowTargetModal(true)} className="bg-purple-500 hover:bg-purple-600" size="sm">
            <Target className="h-4 w-4 mr-2" /> Set Target
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {salesTeam.map((member, idx) => (
            <div key={idx} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">{member.name}</p>
                  <p className="text-slate-400 text-sm">{member.email}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Total Leads</span>
                  <span className="text-white font-medium">{member.total_leads}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Converted</span>
                  <span className="text-green-400 font-medium">{member.converted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Conversion Rate</span>
                  <span className="text-orange-400 font-medium">{member.conversion_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Today's Calls</span>
                  <span className="text-blue-400 font-medium">{member.today_calls}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">Pending Tasks</span>
                  <span className={`font-medium ${member.pending_tasks > 5 ? 'text-red-400' : 'text-slate-300'}`}>
                    {member.pending_tasks}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {salesTeam.length === 0 && (
            <div className="col-span-full text-center p-8 text-slate-400">
              No sales team members found. Add users with 'sales' role.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Lead Detail Modal
  const LeadModal = () => {
    const [leadData, setLeadData] = useState(selectedLead || {
      name: '',
      email: '',
      phone: '',
      company_name: '',
      city: '',
      state: '',
      source: 'website',
      priority: 'warm',
      service_interested: '',
      requirements: '',
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
      setSaving(true);
      try {
        if (selectedLead?.id) {
          await crmAPI.updateLead(selectedLead.id, leadData);
          toast.success('Lead updated successfully');
        } else {
          await crmAPI.createLead(leadData);
          toast.success('Lead created successfully');
        }
        setShowLeadModal(false);
        setSelectedLead(null);
        loadLeads();
        loadDashboard();
      } catch (error) {
        toast.error('Failed to save lead');
      } finally {
        setSaving(false);
      }
    };

    if (!showLeadModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-white font-semibold text-lg">
              {selectedLead?.id ? 'Edit Lead' : 'New Lead'}
            </h3>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Name*</Label>
                <Input
                  value={leadData.name}
                  onChange={(e) => setLeadData({ ...leadData, name: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label className="text-slate-300">Phone*</Label>
                <Input
                  value={leadData.phone}
                  onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                  placeholder="+91 XXXXXXXXXX"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Email</Label>
                <Input
                  value={leadData.email}
                  onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label className="text-slate-300">Company</Label>
                <Input
                  value={leadData.company_name}
                  onChange={(e) => setLeadData({ ...leadData, company_name: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">City</Label>
                <Input
                  value={leadData.city}
                  onChange={(e) => setLeadData({ ...leadData, city: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label className="text-slate-300">State</Label>
                <Input
                  value={leadData.state}
                  onChange={(e) => setLeadData({ ...leadData, state: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Source</Label>
                <select
                  value={leadData.source}
                  onChange={(e) => setLeadData({ ...leadData, source: e.target.value })}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="website">🌐 Website</option>
                  <option value="facebook">📘 Facebook</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="indiamart">🏭 IndiaMart</option>
                  <option value="justdial">📞 JustDial</option>
                  <option value="sulekha">🔍 Sulekha</option>
                  <option value="phone_inquiry">📱 Phone Inquiry</option>
                  <option value="referral">👥 Referral</option>
                  <option value="walk_in">🚶 Walk-in</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Priority</Label>
                <select
                  value={leadData.priority}
                  onChange={(e) => setLeadData({ ...leadData, priority: e.target.value })}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">🌡️ Warm</option>
                  <option value="cold">❄️ Cold</option>
                </select>
              </div>
            </div>
            
            {selectedLead?.id && (
              <div>
                <Label className="text-slate-300">Status</Label>
                <select
                  value={leadData.status}
                  onChange={(e) => setLeadData({ ...leadData, status: e.target.value })}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                  <option value="not_interested">Not Interested</option>
                </select>
              </div>
            )}
            
            <div>
              <Label className="text-slate-300">Service Interested</Label>
              <select
                value={leadData.service_interested}
                onChange={(e) => setLeadData({ ...leadData, service_interested: e.target.value })}
                className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
              >
                <option value="">Select Service</option>
                <option value="helicopter">🚁 Helicopter</option>
                <option value="chartered_plane">✈️ Chartered Plane</option>
                <option value="both">Both</option>
              </select>
            </div>
            
            <div>
              <Label className="text-slate-300">Requirements</Label>
              <textarea
                value={leadData.requirements}
                onChange={(e) => setLeadData({ ...leadData, requirements: e.target.value })}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white h-24"
                placeholder="Route, date, passengers, budget..."
              />
            </div>
          </div>
          
          <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowLeadModal(false); setSelectedLead(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {selectedLead?.id ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Call Log Modal
  const CallModal = () => {
    const [callData, setCallData] = useState({
      lead_id: selectedLead?.id,
      call_type: 'outgoing',
      phone_number: selectedLead?.phone,
      duration_seconds: 0,
      outcome: 'connected',
      notes: '',
      follow_up_required: false,
    });
    const [saving, setSaving] = useState(false);

    const handleSaveCall = async () => {
      setSaving(true);
      try {
        await crmAPI.logCall(callData);
        toast.success('Call logged successfully');
        setShowCallModal(false);
        setSelectedLead(null);
        loadLeads();
        loadDashboard();
      } catch (error) {
        toast.error('Failed to log call');
      } finally {
        setSaving(false);
      }
    };

    if (!showCallModal || !selectedLead) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-xl max-w-md w-full border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-white font-semibold text-lg">Log Call</h3>
            <p className="text-slate-400 text-sm">{selectedLead.name} - {selectedLead.phone}</p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Call Type</Label>
                <select
                  value={callData.call_type}
                  onChange={(e) => setCallData({ ...callData, call_type: e.target.value })}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="outgoing">📞 Outgoing</option>
                  <option value="incoming">📲 Incoming</option>
                  <option value="missed">❌ Missed</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Outcome</Label>
                <select
                  value={callData.outcome}
                  onChange={(e) => setCallData({ ...callData, outcome: e.target.value })}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="connected">✅ Connected</option>
                  <option value="no_answer">📵 No Answer</option>
                  <option value="busy">🔴 Busy</option>
                  <option value="callback_requested">🔄 Callback Requested</option>
                  <option value="voicemail">📼 Voicemail</option>
                  <option value="wrong_number">❌ Wrong Number</option>
                </select>
              </div>
            </div>
            
            <div>
              <Label className="text-slate-300">Duration (seconds)</Label>
              <Input
                type="number"
                value={callData.duration_seconds}
                onChange={(e) => setCallData({ ...callData, duration_seconds: parseInt(e.target.value) || 0 })}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Notes</Label>
              <textarea
                value={callData.notes}
                onChange={(e) => setCallData({ ...callData, notes: e.target.value })}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white h-24"
                placeholder="Call summary, next steps..."
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="followUp"
                checked={callData.follow_up_required}
                onChange={(e) => setCallData({ ...callData, follow_up_required: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="followUp" className="text-slate-300">Follow-up required</Label>
            </div>
          </div>
          
          <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setShowCallModal(false); setSelectedLead(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveCall} disabled={saving} className="bg-green-500 hover:bg-green-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Log Call
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Task Modal
  const TaskModal = () => {
    const [taskData, setTaskData] = useState({
      title: '',
      description: '',
      due_date: new Date().toISOString().split('T')[0],
      priority: 'medium',
    });
    const [saving, setSaving] = useState(false);

    const handleSaveTask = async () => {
      if (!taskData.title) {
        toast.error('Task title is required');
        return;
      }
      setSaving(true);
      try {
        await crmAPI.createTask(taskData);
        toast.success('Task created successfully');
        setShowTaskModal(false);
        loadTasks();
      } catch (error) {
        toast.error('Failed to create task');
      } finally {
        setSaving(false);
      }
    };

    if (!showTaskModal) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-900 rounded-xl max-w-md w-full border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-white font-semibold text-lg">New Task</h3>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <Label className="text-slate-300">Title*</Label>
              <Input
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                className="bg-slate-800 border-slate-600"
                placeholder="Follow up with client..."
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Description</Label>
              <textarea
                value={taskData.description}
                onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white h-24"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Due Date</Label>
                <Input
                  type="date"
                  value={taskData.due_date}
                  onChange={(e) => setTaskData({ ...taskData, due_date: e.target.value })}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div>
                <Label className="text-slate-300">Priority</Label>
                <select
                  value={taskData.priority}
                  onChange={(e) => setTaskData({ ...taskData, priority: e.target.value })}
                  className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTask} disabled={saving} className="bg-purple-500 hover:bg-purple-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Task
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">CRM Dashboard</h2>
          <p className="text-slate-400">Lead Management & Sales Team</p>
        </div>
        <Button onClick={() => { loadDashboard(); loadLeads(); loadTasks(); }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { id: 'leads', label: 'Leads', icon: Users },
          { id: 'tasks', label: 'Tasks', icon: ListChecks },
          { id: 'team', label: 'Sales Team', icon: Award },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id
                ? 'bg-orange-500 text-white'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && <DashboardOverview />}
      {activeTab === 'leads' && <LeadsList />}
      {activeTab === 'tasks' && <TasksView />}
      {activeTab === 'team' && <SalesTeamView />}

      {/* Modals */}
      <LeadModal />
      <CallModal />
      <TaskModal />
    </div>
  );
}

export default CRMDashboard;
