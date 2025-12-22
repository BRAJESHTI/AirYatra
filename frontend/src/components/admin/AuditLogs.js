import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Filter, User, Calendar, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminAPI } from '@/services/api';

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entity_type: '',
    user_id: '',
    limit: 100
  });

  useEffect(() => {
    loadLogs();
    loadStatistics();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAuditLogs(filters);
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await adminAPI.getAuditStatistics();
      setStatistics(response.data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    const colors = {
      operator_verification: 'bg-blue-500/20 text-blue-400',
      booking_reassignment: 'bg-purple-500/20 text-purple-400',
      settlement_approved: 'bg-green-500/20 text-green-400',
      settlement_paid: 'bg-green-500/20 text-green-400',
      landing_permission_approved: 'bg-cyan-500/20 text-cyan-400',
      landing_permission_rejected: 'bg-red-500/20 text-red-400',
      force_assign_operator: 'bg-orange-500/20 text-orange-400',
    };
    return colors[action] || 'bg-slate-500/20 text-slate-400';
  };

  const formatAction = (action) => {
    return action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="h-8 w-8 text-purple-400" />
            Audit Logs
          </h1>
          <p className="text-slate-400 mt-1">Track all administrative actions and changes</p>
        </div>
        <Button onClick={loadLogs} variant="outline" className="border-slate-600 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Statistics Summary */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <p className="text-sm text-slate-400">Total Log Entries</p>
            <p className="text-2xl font-bold text-white">{statistics.total_logs || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <p className="text-sm text-slate-400">Action Types</p>
            <p className="text-2xl font-bold text-purple-400">{statistics.by_action?.length || 0}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <p className="text-sm text-slate-400">Active Users</p>
            <p className="text-2xl font-bold text-cyan-400">{statistics.most_active_users?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-slate-400" />
          <span className="text-white font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Action Type</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
            >
              <option value="">All Actions</option>
              <option value="operator_verification">Operator Verification</option>
              <option value="booking_reassignment">Booking Reassignment</option>
              <option value="settlement_approved">Settlement Approved</option>
              <option value="settlement_paid">Settlement Paid</option>
              <option value="landing_permission_approved">Permission Approved</option>
              <option value="landing_permission_rejected">Permission Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Entity Type</label>
            <select
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
            >
              <option value="">All Entities</option>
              <option value="operator">Operator</option>
              <option value="booking">Booking</option>
              <option value="settlement">Settlement</option>
              <option value="landing_permission">Landing Permission</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Limit</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
              className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
            >
              <option value={50}>50 entries</option>
              <option value={100}>100 entries</option>
              <option value={200}>200 entries</option>
              <option value={500}>500 entries</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={loadLogs} className="w-full bg-orange-500 hover:bg-orange-600">
              Apply Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs ${getActionBadge(log.action)}`}>
                      {formatAction(log.action)}
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs">
                      {log.entity_type}
                    </span>
                    {log.is_critical && (
                      <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">
                        Critical
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {log.user_name || 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      Entity: {log.entity_id?.slice(0, 8)}...
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(log.created_at)}
                    </span>
                  </div>

                  {/* Changes Summary */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="mt-2 p-2 rounded bg-slate-800/50">
                      <p className="text-xs text-slate-500 mb-1">Changes:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(log.changes).slice(0, 5).map(([key, value]) => (
                          <span key={key} className="text-xs text-slate-300">
                            <span className="text-slate-500">{key}:</span> {typeof value === 'object' ? JSON.stringify(value).slice(0, 30) : String(value).slice(0, 30)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Most Active Users */}
      {statistics?.most_active_users && statistics.most_active_users.length > 0 && (
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4">Most Active Users</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {statistics.most_active_users.map((user, index) => (
              <div key={index} className="p-3 rounded-lg bg-slate-800/50">
                <p className="text-white font-medium">{user.user_name || 'Unknown'}</p>
                <p className="text-sm text-slate-400">{user.actions} actions</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogs;
