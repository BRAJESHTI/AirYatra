import React from 'react';
import { FileText, Clock, User, Settings } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Audit Logs Tab Component
 * Shows pricing change history
 */
export const AuditLogsTab = ({ auditLogs }) => {
  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'create': return 'bg-green-500/20 text-green-400';
      case 'update': return 'bg-blue-500/20 text-blue-400';
      case 'delete': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          Audit Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No audit logs available yet.</p>
            <p className="text-sm">Logs will appear here when pricing changes are made.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLogs.map((log, index) => (
              <div 
                key={index} 
                className="bg-slate-700/30 rounded-lg p-3 flex items-start gap-3"
              >
                <div className="h-8 w-8 bg-slate-600/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Settings className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getActionBadgeColor(log.action)}>
                      {log.action}
                    </Badge>
                    <span className="text-white font-medium text-sm truncate">
                      {log.field || log.resource_type || 'Pricing Control'}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-slate-400 text-xs mt-1 truncate">
                      {typeof log.details === 'object' 
                        ? JSON.stringify(log.details).slice(0, 100) + '...'
                        : log.details}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {log.user_email || log.user_id || 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(log.timestamp || log.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {auditLogs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700 text-center">
            <p className="text-slate-500 text-xs">
              Showing last {auditLogs.length} changes • Full audit trail available in Admin Panel
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogsTab;
