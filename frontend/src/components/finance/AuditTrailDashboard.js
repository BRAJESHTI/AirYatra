import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, Search, RefreshCw, Filter, Eye, User, Clock, Shield,
  FileText, Database, Edit2, Trash2, Plus, AlertCircle, ChevronRight,
  BarChart3, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/services/apiClient';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const actionColors = {
  create: 'bg-green-500/20 text-green-400',
  update: 'bg-blue-500/20 text-blue-400',
  delete: 'bg-red-500/20 text-red-400',
  approve: 'bg-purple-500/20 text-purple-400',
  reject: 'bg-orange-500/20 text-orange-400',
  view: 'bg-slate-500/20 text-slate-400'
};

const actionIcons = {
  create: Plus,
  update: Edit2,
  delete: Trash2,
  approve: Shield,
  reject: AlertCircle,
  view: Eye
};

export default function AuditTrailDashboard() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ modules: [], actions: [], entity_types: [] });
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedModule !== 'all') params.append('module', selectedModule);
      if (selectedAction !== 'all') params.append('action', selectedAction);
      if (searchQuery) params.append('search', searchQuery);
      params.append('skip', ((page - 1) * 50).toString());
      params.append('limit', '50');
      
      const [logsRes, statsRes] = await Promise.all([
        api.get(`/finance/phase5/audit/logs?${params.toString()}`),
        api.get('/finance/phase5/audit/stats')
      ]);
      setLogs(logsRes.data.logs || []);
      setTotal(logsRes.data.total || 0);
      setFilters(logsRes.data.filters || { modules: [], actions: [], entity_types: [] });
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedModule, selectedAction, searchQuery, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchData]);

  const handleViewDetail = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="audit-trail-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="h-7 w-7 text-cyan-400" />
            Audit Trail Dashboard</h1>
          <p className="text-slate-400 mt-1">Complete log of all finance transactions and actions</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => { setRefreshing(true); fetchData(); }}
          disabled={refreshing}
          className="border-slate-600"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-600/30 to-cyan-800/30 border-cyan-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-200 text-sm">Total Logs</p>
                <p className="text-3xl font-bold text-white mt-1">{stats?.total_logs || 0}</p>
              </div>
              <Database className="h-10 w-10 text-cyan-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-600/30 to-green-800/30 border-green-500/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-sm">Today&apos;s Activity</p>
                <p className="text-3xl font-bold text-white mt-1">{stats?.today_count || 0}</p>
              </div>
              <Calendar className="h-10 w-10 text-green-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Modules</p>
                <p className="text-3xl font-bold text-white mt-1">{Object.keys(stats?.by_module || {}).length}</p>
              </div>
              <FileText className="h-10 w-10 text-slate-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Active Users</p>
                <p className="text-3xl font-bold text-white mt-1">{Object.keys(stats?.recent_users || {}).length}</p>
              </div>
              <User className="h-10 w-10 text-slate-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity by Module */}
      {stats?.by_module && Object.keys(stats.by_module).length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Activity by Module
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.by_module).map(([module, count]) => (
                <div 
                  key={module}
                  className="px-4 py-2 bg-slate-900/50 rounded-lg border border-slate-700 cursor-pointer hover:border-cyan-500/50 transition-colors"
                  onClick={() => setSelectedModule(module)}
                >
                  <p className="text-white font-medium capitalize">{module}</p>
                  <p className="text-cyan-400 text-sm">{count} actions</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by description, entity ID..."
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <Select value={selectedModule} onValueChange={setSelectedModule}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Modules</SelectItem>
            {filters.modules.map(mod => (
              <SelectItem key={mod} value={mod} className="text-white capitalize">{mod}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedAction} onValueChange={setSelectedAction}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Actions</SelectItem>
            {filters.actions.map(act => (
              <SelectItem key={act} value={act} className="text-white capitalize">{act}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-5 w-5 text-cyan-400" />
              Audit Logs ({total})
            </span>
            {total > 50 && (
              <div className="flex items-center gap-2 text-sm">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="border-slate-600"
                >
                  Previous
                </Button>
                <span className="text-slate-400">Page {page}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page * 50 >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="border-slate-600"
                >
                  Next
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => {
                const ActionIcon = actionIcons[log.action] || Eye;
                const actionColor = actionColors[log.action] || 'bg-slate-500/20 text-slate-400';
                
                return (
                  <div 
                    key={log.id || log._id}
                    className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                    onClick={() => handleViewDetail(log)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${actionColor.split(' ')[0]}`}>
                        <ActionIcon className={`h-4 w-4 ${actionColor.split(' ')[1]}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{log.description}</span>
                          <Badge className={`${actionColor} border-0 text-xs capitalize`}>
                            {log.action}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                          <span className="capitalize">{log.module}</span>
                          <span className="mx-2">•</span>
                          <span>{log.entity_type}: {log.entity_id?.substring(0, 8)}...</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-slate-400">{log.user_email || 'system'}</p>
                        <p className="text-xs text-slate-500">{formatDate(log.created_at)}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-cyan-400" />
              Audit Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Action</p>
                  <Badge className={`${actionColors[selectedLog.action] || ''} mt-1 capitalize`}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Module</p>
                  <p className="text-white font-medium capitalize">{selectedLog.module}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Entity Type</p>
                  <p className="text-white">{selectedLog.entity_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Entity ID</p>
                  <p className="text-white font-mono text-sm">{selectedLog.entity_id}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">Description</p>
                  <p className="text-white">{selectedLog.description}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">User</p>
                  <p className="text-white">{selectedLog.user_email || 'System'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Timestamp</p>
                  <p className="text-white">{formatDate(selectedLog.created_at)}</p>
                </div>
                {selectedLog.ip_address && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">IP Address</p>
                    <p className="text-white font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}
                {selectedLog.old_value && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-1">Old Value</p>
                    <pre className="bg-slate-800 p-2 rounded text-xs text-slate-300 overflow-auto max-h-32">
                      {JSON.stringify(selectedLog.old_value, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.new_value && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-1">New Value</p>
                    <pre className="bg-slate-800 p-2 rounded text-xs text-slate-300 overflow-auto max-h-32">
                      {JSON.stringify(selectedLog.new_value, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
