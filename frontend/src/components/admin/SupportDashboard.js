import React, { useState, useEffect } from 'react';
import { 
  Headphones, Plus, MessageSquare, Clock, AlertTriangle, CheckCircle,
  User, Loader2, ChevronRight, RefreshCw, Tag, Filter, Search,
  X, Send, Paperclip, Phone, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function SupportDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [agents, setAgents] = useState([]);
  const [slaConfig, setSlaConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filters, setFilters] = useState({ status: '', priority: '', category: '' });
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadTickets();
    loadAgents();
    loadSLAConfig();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/support/admin/dashboard');
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.category) params.category = filters.category;
      
      const response = await api.get('/support/admin/tickets', { params });
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await api.get('/support/admin/agents');
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadSLAConfig = async () => {
    try {
      const response = await api.get('/support/admin/sla-config');
      setSlaConfig(response.data);
    } catch (error) {
      console.error('Failed to load SLA config:', error);
    }
  };

  const loadTicketDetails = async (ticketId) => {
    try {
      const response = await api.get(`/support/tickets/${ticketId}`);
      setSelectedTicket(response.data);
    } catch (error) {
      toast.error('Failed to load ticket details');
    }
  };

  const updateTicket = async (ticketId, updates) => {
    try {
      await api.put(`/support/admin/tickets/${ticketId}`, updates);
      toast.success('Ticket updated');
      loadTickets();
      if (selectedTicket?.id === ticketId) {
        loadTicketDetails(ticketId);
      }
    } catch (error) {
      toast.error('Failed to update ticket');
    }
  };

  const addReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    
    try {
      await api.post(`/support/tickets/${selectedTicket.id}/reply`, {
        message: replyText,
        is_internal: isInternal
      });
      toast.success(isInternal ? 'Internal note added' : 'Reply sent');
      setReplyText('');
      loadTicketDetails(selectedTicket.id);
      loadDashboard();
    } catch (error) {
      toast.error('Failed to add reply');
    }
  };

  const statusColors = {
    open: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    waiting_customer: 'bg-purple-500',
    resolved: 'bg-green-500',
    closed: 'bg-gray-500'
  };

  const priorityColors = {
    urgent: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-gray-500 text-white'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Headphones className="h-6 w-6 text-purple-400" />
            Support Helpdesk / सपोर्ट हेल्पडेस्क
          </h2>
          <p className="text-slate-400 mt-1">Manage customer support tickets and SLA</p>
        </div>
        <Button onClick={() => { loadDashboard(); loadTickets(); }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Headphones },
          { id: 'tickets', label: 'All Tickets', icon: MessageSquare, badge: dashboard?.total_open },
          { id: 'sla', label: 'SLA Settings', icon: Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id ? 'bg-purple-500 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Open Tickets</p>
                  <p className="text-white text-2xl font-bold">{dashboard.total_open}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">SLA Breached</p>
                  <p className="text-red-400 text-2xl font-bold">{dashboard.sla_breached}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <User className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Unassigned</p>
                  <p className="text-yellow-400 text-2xl font-bold">{dashboard.unassigned}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Clock className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Avg Resolution</p>
                  <p className="text-green-400 text-2xl font-bold">{dashboard.avg_resolution_hours}h</p>
                </div>
              </div>
            </div>
          </div>

          {/* Priority Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-white font-semibold mb-4">By Priority</h3>
              <div className="space-y-2">
                {['urgent', 'high', 'medium', 'low'].map(p => (
                  <div key={p} className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs ${priorityColors[p]}`}>
                      {p.toUpperCase()}
                    </span>
                    <span className="text-white font-medium">
                      {dashboard.priority_counts?.[p] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-white font-semibold mb-4">By Status</h3>
              <div className="space-y-2">
                {['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map(s => (
                  <div key={s} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusColors[s]}`}></span>
                      <span className="text-slate-300 text-sm capitalize">{s.replace('_', ' ')}</span>
                    </div>
                    <span className="text-white font-medium">
                      {dashboard.status_counts?.[s] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket List */}
          <div className="lg:col-span-1 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b border-slate-700 space-y-2">
              <select
                value={filters.status}
                onChange={(e) => { setFilters(f => ({...f, status: e.target.value})); setTimeout(loadTickets, 100); }}
                className="w-full bg-slate-900 border-slate-600 text-white rounded p-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_customer">Waiting Customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={filters.priority}
                onChange={(e) => { setFilters(f => ({...f, priority: e.target.value})); setTimeout(loadTickets, 100); }}
                className="w-full bg-slate-900 border-slate-600 text-white rounded p-2 text-sm"
              >
                <option value="">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            
            {/* List */}
            <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
              {tickets.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => loadTicketDetails(ticket.id)}
                  className={`p-4 cursor-pointer hover:bg-slate-800 transition ${
                    selectedTicket?.id === ticket.id ? 'bg-slate-800' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{ticket.subject}</p>
                      <p className="text-slate-400 text-xs mt-1">{ticket.ticket_number}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[ticket.status]}`}></span>
                    <span className="text-slate-400 text-xs capitalize">{ticket.status.replace('_', ' ')}</span>
                    <span className="text-slate-500 text-xs">•</span>
                    <span className="text-slate-500 text-xs">{ticket.category}</span>
                  </div>
                </div>
              ))}
              
              {tickets.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tickets found</p>
                </div>
              )}
            </div>
          </div>

          {/* Ticket Details */}
          <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {selectedTicket ? (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{selectedTicket.subject}</h3>
                      <p className="text-slate-400 text-sm">{selectedTicket.ticket_number}</p>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white rounded px-3 py-1 text-sm"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_customer">Waiting Customer</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <select
                      value={selectedTicket.assigned_to || ''}
                      onChange={(e) => updateTicket(selectedTicket.id, { assigned_to: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white rounded px-3 py-1 text-sm"
                    >
                      <option value="">Assign to...</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.full_name}</option>
                      ))}
                    </select>
                    <select
                      value={selectedTicket.priority}
                      onChange={(e) => updateTicket(selectedTicket.id, { priority: e.target.value })}
                      className="bg-slate-900 border-slate-600 text-white rounded px-3 py-1 text-sm"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{selectedTicket.customer_name}</p>
                      <p className="text-slate-400 text-sm">{selectedTicket.customer_email}</p>
                    </div>
                  </div>
                </div>

                {/* Conversation */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px]">
                  {/* Original Message */}
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <p className="text-slate-300">{selectedTicket.description}</p>
                    <p className="text-slate-500 text-xs mt-2">
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </p>
                  </div>
                  
                  {/* Replies */}
                  {selectedTicket.replies?.map((reply, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg p-4 ${
                        reply.is_internal
                          ? 'bg-yellow-500/10 border border-yellow-500/30'
                          : reply.user_role === 'staff'
                          ? 'bg-purple-500/10 border border-purple-500/30'
                          : 'bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-medium text-sm">{reply.user_name}</span>
                        {reply.is_internal && (
                          <span className="text-yellow-400 text-xs bg-yellow-500/20 px-2 py-0.5 rounded">Internal</span>
                        )}
                        {reply.user_role === 'staff' && !reply.is_internal && (
                          <span className="text-purple-400 text-xs bg-purple-500/20 px-2 py-0.5 rounded">Staff</span>
                        )}
                      </div>
                      <p className="text-slate-300">{reply.message}</p>
                      <p className="text-slate-500 text-xs mt-2">
                        {new Date(reply.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Reply Box */}
                <div className="p-4 border-t border-slate-700">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="w-full bg-slate-900 border-slate-600 text-white rounded-lg p-3 min-h-[80px]"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded"
                      />
                      Internal Note (not visible to customer)
                    </label>
                    <Button onClick={addReply} disabled={!replyText.trim()} className="bg-purple-500 hover:bg-purple-600">
                      <Send className="h-4 w-4 mr-2" /> Send
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a ticket to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SLA Settings Tab */}
      {activeTab === 'sla' && slaConfig && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-6">SLA Configuration / SLA सेटिंग्स</h3>
          <p className="text-slate-400 text-sm mb-6">Define response and resolution time limits for each priority level</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['urgent', 'high', 'medium', 'low'].map(priority => (
              <div key={priority} className="bg-slate-900/50 rounded-lg p-4">
                <h4 className={`font-semibold mb-4 px-2 py-1 rounded inline-block ${priorityColors[priority]}`}>
                  {priority.toUpperCase()} Priority
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-sm">First Response (hours)</Label>
                    <Input
                      type="number"
                      value={slaConfig[`${priority}_response_hours`]}
                      readOnly
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-sm">Resolution (hours)</Label>
                    <Input
                      type="number"
                      value={slaConfig[`${priority}_resolution_hours`]}
                      readOnly
                      className="bg-slate-800 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-slate-500 text-sm mt-4">* Contact admin to modify SLA settings</p>
        </div>
      )}
    </div>
  );
}

export default SupportDashboard;
