/**
 * CRM Leads List Component
 * Displays leads in a table with filters, search, and actions
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Filter, RefreshCw, Phone, Mail, MapPin,
  ChevronRight, Edit2, Loader2, User, Clock
} from 'lucide-react';
import { crmAPI } from '@/services/api';
import { toast } from 'sonner';

// Status configurations
const statusConfig = {
  new: { color: 'bg-blue-500', label: 'New' },
  contacted: { color: 'bg-yellow-500', label: 'Contacted' },
  qualified: { color: 'bg-purple-500', label: 'Qualified' },
  proposal_sent: { color: 'bg-indigo-500', label: 'Proposal Sent' },
  negotiation: { color: 'bg-orange-500', label: 'Negotiation' },
  won: { color: 'bg-green-500', label: 'Won' },
  lost: { color: 'bg-red-500', label: 'Lost' },
  follow_up: { color: 'bg-cyan-500', label: 'Follow Up' },
  not_interested: { color: 'bg-gray-500', label: 'Not Interested' },
};

const priorityConfig = {
  hot: { color: 'bg-red-500', label: '🔥 Hot' },
  warm: { color: 'bg-orange-500', label: '☀️ Warm' },
  cold: { color: 'bg-blue-500', label: '❄️ Cold' },
};

const sourceIcons = {
  facebook: '📘', whatsapp: '💬', email: '📧', gmail: '📩',
  indiamart: '🏭', justdial: '📞', sulekha: '🔍', website: '🌐',
  referral: '👥', walk_in: '🚶', phone_inquiry: '📱', other: '📝',
};

// Lead Card Component
const LeadCard = ({ lead, onEdit, onCall, onView }) => {
  const status = statusConfig[lead.status] || statusConfig.new;
  const priority = priorityConfig[lead.priority] || priorityConfig.warm;

  return (
    <div 
      className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-all cursor-pointer"
      onClick={() => onView && onView(lead)}
      data-testid={`lead-card-${lead.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-white font-medium">{lead.customer_name}</h4>
              <span className="text-lg">{sourceIcons[lead.source] || '📝'}</span>
            </div>
            <p className="text-slate-400 text-sm">{lead.company || 'Individual'}</p>
            <div className="flex items-center gap-3 mt-1 text-slate-500 text-xs">
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {lead.phone}
                </span>
              )}
              {lead.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {lead.location}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1">
            <Badge className={`${priority.color} text-white text-xs`}>
              {priority.label}
            </Badge>
            <Badge className={`${status.color} text-white text-xs`}>
              {status.label}
            </Badge>
          </div>
          {lead.expected_value > 0 && (
            <span className="text-green-400 font-medium text-sm">
              ₹{(lead.expected_value / 1000).toFixed(0)}K
            </span>
          )}
        </div>
      </div>

      {/* Travel Details Preview */}
      {lead.travel_details?.from_location && (
        <div className="mt-3 p-2 bg-slate-800 rounded text-xs text-slate-400">
          ✈️ {lead.travel_details.from_location} → {lead.travel_details.to_location}
          {lead.travel_details.travel_date && (
            <span className="ml-2">📅 {new Date(lead.travel_details.travel_date).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-1 text-slate-500 text-xs">
          <Clock className="h-3 w-3" />
          {new Date(lead.created_at).toLocaleDateString()}
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-slate-400 hover:text-green-400"
            onClick={(e) => { e.stopPropagation(); onCall && onCall(lead); }}
          >
            <Phone className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-slate-400 hover:text-blue-400"
            onClick={(e) => { e.stopPropagation(); onEdit && onEdit(lead); }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-slate-400 hover:text-white"
            onClick={(e) => { e.stopPropagation(); onView && onView(lead); }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Leads List Component
const CRMLeadsList = ({ 
  leads, 
  loading, 
  onRefresh, 
  onAddNew, 
  onEditLead, 
  onCallLead, 
  onViewLead,
  filters,
  onFilterChange 
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = (e) => {
    onFilterChange && onFilterChange({ ...filters, search: e.target.value });
  };

  const handleFilterChange = (field, value) => {
    onFilterChange && onFilterChange({ ...filters, [field]: value });
  };

  const filteredLeads = leads.filter(lead => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!lead.customer_name?.toLowerCase().includes(search) &&
          !lead.phone?.includes(search) &&
          !lead.email?.toLowerCase().includes(search) &&
          !lead.company?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.source && lead.source !== filters.source) return false;
    if (filters.priority && lead.priority !== filters.priority) return false;
    return true;
  });

  return (
    <div className="space-y-4" data-testid="crm-leads-list">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search leads..."
              value={filters.search || ''}
              onChange={handleSearchChange}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'border-orange-500 text-orange-400' : ''}
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onRefresh}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Button onClick={onAddNew} className="bg-orange-500 hover:bg-orange-600">
          + Add Lead
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-slate-800 rounded-lg flex flex-wrap gap-4">
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
          >
            <option value="">All Status</option>
            {Object.entries(statusConfig).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select
            value={filters.priority || ''}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
          >
            <option value="">All Priority</option>
            <option value="hot">🔥 Hot</option>
            <option value="warm">☀️ Warm</option>
            <option value="cold">❄️ Cold</option>
          </select>
          <select
            value={filters.source || ''}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            className="h-10 px-3 bg-slate-700 border border-slate-600 text-white rounded-md"
          >
            <option value="">All Sources</option>
            {Object.entries(sourceIcons).map(([key, icon]) => (
              <option key={key} value={key}>{icon} {key.replace('_', ' ')}</option>
            ))}
          </select>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onFilterChange && onFilterChange({ search: '', status: '', source: '', priority: '' })}
            className="text-slate-400"
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Leads Count */}
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">
          Showing {filteredLeads.length} of {leads.length} leads
        </p>
      </div>

      {/* Leads Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-700">
          <User className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No leads found</p>
          <Button onClick={onAddNew} className="mt-4 bg-orange-500 hover:bg-orange-600">
            Add Your First Lead
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onEdit={onEditLead}
              onCall={onCallLead}
              onView={onViewLead}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CRMLeadsList;
