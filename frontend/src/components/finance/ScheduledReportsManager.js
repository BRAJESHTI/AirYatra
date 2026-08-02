import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, Calendar, Mail, Clock, Play, Pause, Plus, Trash2,
  CheckCircle, XCircle, Send, Settings, Database, ArrowRightLeft,
  AlertTriangle, Building2, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import api from '@/services/apiClient';

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ScheduledReportsManager() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendingReport, setSendingReport] = useState(null);
  
  const [newReport, setNewReport] = useState({
    name: '',
    frequency: 'weekly',
    send_day: 1,
    recipients: '',
    report_type: 'monthly'
  });

  const fetchData = useCallback(async () => {
    try {
      const [reportsRes, syncRes] = await Promise.all([
        api.get('/finance/scheduled/reports'),
        api.get('/finance/scheduled/settlement-sync/status')
      ]);
      setReports(reportsRes.data.reports || []);
      setSyncStatus(syncRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateReport = async () => {
    if (!newReport.name || !newReport.recipients) {
      toast.error('Please fill in name and recipients');
      return;
    }
    
    try {
      const recipients = newReport.recipients.split(',').map(e => e.trim()).filter(e => e);
      if (recipients.length === 0) {
        toast.error('At least one valid email is required');
        return;
      }
      
      await api.post('/finance/scheduled/reports', {
        ...newReport,
        recipients
      });
      
      toast.success('Scheduled report created');
      setShowCreateModal(false);
      setNewReport({ name: '', frequency: 'weekly', send_day: 1, recipients: '', report_type: 'monthly' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create report');
    }
  };

  const handleToggleReport = async (reportId) => {
    try {
      await api.post(`/finance/scheduled/reports/${reportId}/toggle`);
      toast.success('Report status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle report');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;
    
    try {
      await api.delete(`/finance/scheduled/reports/${reportId}`);
      toast.success('Report deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const handleSendNow = async (reportId) => {
    setSendingReport(reportId);
    try {
      const response = await api.post(`/finance/scheduled/reports/${reportId}/send-now`);
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send report');
    } finally {
      setSendingReport(null);
    }
  };

  const handleTriggerSync = async (gateway = 'all') => {
    setSyncing(true);
    try {
      await api.post(`/finance/scheduled/settlement-sync/trigger?gateway=${gateway}`);
      toast.success(`Settlement sync triggered for ${gateway}`);
      setTimeout(fetchData, 2000);
    } catch (error) {
      toast.error('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="scheduled-reports-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="h-7 w-7 text-indigo-400" />
            Scheduled Reports & Auto-Sync
          </h1>
          <p className="text-slate-400 mt-1">Configure automated finance reports and settlement synchronization</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="reports" className="data-[state=active]:bg-indigo-600">
            <Mail className="h-4 w-4 mr-2" />
            Scheduled Reports
          </TabsTrigger>
          <TabsTrigger value="sync" className="data-[state=active]:bg-purple-600">
            <Database className="h-4 w-4 mr-2" />
            Settlement Sync
          </TabsTrigger>
        </TabsList>

        {/* Scheduled Reports Tab */}
        <TabsContent value="reports">
          <div className="space-y-4">
            {reports.length > 0 ? (
              reports.map((report) => (
                <Card key={report.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          report.is_active ? 'bg-indigo-500/20' : 'bg-slate-700'
                        }`}>
                          <Calendar className={`h-6 w-6 ${report.is_active ? 'text-indigo-400' : 'text-slate-500'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium">{report.name}</h3>
                            <Badge className={`${
                              report.is_active 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                                : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                            } border`}>
                              {report.is_active ? 'Active' : 'Paused'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {report.frequency === 'weekly' 
                                ? `Every ${dayNames[report.send_day]}`
                                : report.frequency === 'monthly'
                                  ? `Monthly on the ${report.send_day}${report.send_day === 1 ? 'st' : report.send_day === 2 ? 'nd' : report.send_day === 3 ? 'rd' : 'th'}`
                                  : 'Daily'
                              }
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {report.recipients?.length || 0} recipients
                            </span>
                            {report.last_sent && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3 text-green-400" />
                                Last sent: {new Date(report.last_sent).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendNow(report.id)}
                          disabled={sendingReport === report.id}
                          className="border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20"
                        >
                          {sendingReport === report.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleReport(report.id)}
                          className="border-slate-600"
                        >
                          {report.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteReport(report.id)}
                          className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Recipients preview */}
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 mb-1">Recipients:</p>
                      <div className="flex flex-wrap gap-1">
                        {report.recipients?.slice(0, 5).map((email, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {email}
                          </Badge>
                        ))}
                        {report.recipients?.length > 5 && (
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                            +{report.recipients.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-white font-medium mb-2">No Scheduled Reports</h3>
                  <p className="text-slate-400 text-sm mb-4">Create your first scheduled finance report to automate reporting</p>
                  <Button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Settlement Sync Tab */}
        <TabsContent value="sync">
          <div className="space-y-4">
            {/* Sync controls */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-purple-400" />
                  Settlement Auto-Sync
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTriggerSync('stripe')}
                    disabled={syncing}
                    className="border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20"
                  >
                    Sync Stripe
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTriggerSync('razorpay')}
                    disabled={syncing}
                    className="border-blue-500/50 text-blue-300 hover:bg-blue-500/20"
                  >
                    Sync Razorpay
                  </Button>
                  <Button
                    onClick={() => handleTriggerSync('all')}
                    disabled={syncing}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sync All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-4">
                  Settlement data is automatically synced daily from Stripe and Razorpay. You can manually trigger a sync anytime.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Stripe Status */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">Stripe</h4>
                        <p className="text-xs text-slate-400">Payment settlements</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Settlements</p>
                        <p className="text-white font-semibold">{syncStatus?.stripe?.settlements_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Balance Txns</p>
                        <p className="text-white font-semibold">{syncStatus?.stripe?.balance_transactions_count || 0}</p>
                      </div>
                    </div>
                    {syncStatus?.stripe?.last_sync && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <p className="text-xs text-slate-500">
                          Last sync: {new Date(syncStatus.stripe.last_sync.created_at).toLocaleString()}
                        </p>
                        <Badge className={`mt-1 ${
                          syncStatus.stripe.last_sync.status === 'success'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {syncStatus.stripe.last_sync.status}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Razorpay Status */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">Razorpay</h4>
                        <p className="text-xs text-slate-400">Payment settlements</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-400">Settlements</p>
                        <p className="text-white font-semibold">{syncStatus?.razorpay?.settlements_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">UTRs Synced</p>
                        <p className="text-white font-semibold">{syncStatus?.razorpay?.settlements_count || 0}</p>
                      </div>
                    </div>
                    {syncStatus?.razorpay?.last_sync && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <p className="text-xs text-slate-500">
                          Last sync: {new Date(syncStatus.razorpay.last_sync.created_at).toLocaleString()}
                        </p>
                        <Badge className={`mt-1 ${
                          syncStatus.razorpay.last_sync.status === 'success'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {syncStatus.razorpay.last_sync.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sync Logs */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg">Recent Sync Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...(syncStatus?.stripe?.recent_logs || []), ...(syncStatus?.razorpay?.recent_logs || [])]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 10)
                    .map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {log.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                          <div>
                            <span className="text-white capitalize">{log.gateway}</span>
                            <span className="text-slate-400 text-sm ml-2">
                              {log.payouts_synced !== undefined && `${log.payouts_synced} payouts`}
                              {log.settlements_synced !== undefined && `${log.settlements_synced} settlements`}
                              {log.transactions_synced !== undefined && `, ${log.transactions_synced} transactions`}
                            </span>
                          </div>
                        </div>
                        <span className="text-slate-500 text-sm">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  {(!syncStatus?.stripe?.recent_logs?.length && !syncStatus?.razorpay?.recent_logs?.length) && (
                    <div className="text-center py-8 text-slate-400">
                      <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No sync activity yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Report Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-400" />
              Create Scheduled Report
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Report Name</label>
              <Input
                value={newReport.name}
                onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                placeholder="e.g., Weekly Finance Summary"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Frequency</label>
                <Select 
                  value={newReport.frequency} 
                  onValueChange={(v) => setNewReport({ ...newReport, frequency: v, send_day: v === 'weekly' ? 1 : 1 })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="daily" className="text-white">Daily</SelectItem>
                    <SelectItem value="weekly" className="text-white">Weekly</SelectItem>
                    <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-slate-400 text-sm mb-2 block">
                  {newReport.frequency === 'weekly' ? 'Send Day' : newReport.frequency === 'monthly' ? 'Day of Month' : 'Frequency'}
                </label>
                {newReport.frequency === 'weekly' ? (
                  <Select 
                    value={newReport.send_day.toString()} 
                    onValueChange={(v) => setNewReport({ ...newReport, send_day: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {dayNames.map((day, idx) => (
                        <SelectItem key={idx} value={idx.toString()} className="text-white">{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : newReport.frequency === 'monthly' ? (
                  <Select 
                    value={newReport.send_day.toString()} 
                    onValueChange={(v) => setNewReport({ ...newReport, send_day: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {Array.from({ length: 28 }, (_, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()} className="text-white">
                          {i+1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value="Every day"
                    disabled
                    className="bg-slate-800 border-slate-700 text-slate-400"
                  />
                )}
              </div>
            </div>
            
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Recipients (comma-separated emails)</label>
              <Input
                value={newReport.recipients}
                onChange={(e) => setNewReport({ ...newReport, recipients: e.target.value })}
                placeholder="finance@company.com, cfo@company.com"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleCreateReport} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
