import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, Clock, Mail, MessageSquare, Plus, RefreshCw, Settings,
  CheckCircle, AlertTriangle, Calendar, Send, Trash2, Edit2,
  Smartphone, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/apiClient';
import { toast } from 'sonner';

const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  const num = Number(amount);
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const challanTypes = ['GST', 'TDS', 'PF', 'ESIC', 'PT', 'IT'];

export default function AutoReminders() {
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const [pendingReminders, setPendingReminders] = useState([]);
  const [reminderHistory, setReminderHistory] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [newConfig, setNewConfig] = useState({
    challan_type: 'GST',
    days_before: [7, 3, 1],
    email_enabled: true,
    whatsapp_enabled: false,
    recipients: []
  });
  const [recipientInput, setRecipientInput] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [configsRes, pendingRes, historyRes] = await Promise.all([
        api.get('/finance/phase4/reminders/config'),
        api.get('/finance/phase4/reminders/pending'),
        api.get('/finance/phase4/reminders/history?limit=20')
      ]);
      setConfigs(configsRes.data.configs || []);
      setPendingReminders(pendingRes.data.pending_reminders || []);
      setReminderHistory(historyRes.data.logs || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveConfig = async () => {
    try {
      await api.post('/finance/phase4/reminders/configure', newConfig);
      toast.success('Reminder configured');
      setShowConfigModal(false);
      setNewConfig({
        challan_type: 'GST',
        days_before: [7, 3, 1],
        email_enabled: true,
        whatsapp_enabled: false,
        recipients: []
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to save config');
    }
  };

  const handleSendReminders = async () => {
    setSending(true);
    try {
      const response = await api.post('/finance/phase4/reminders/send');
      toast.success(`Sent ${response.data.reminders_sent} reminders`);
      fetchData();
    } catch (error) {
      toast.error('Failed to send reminders');
    } finally {
      setSending(false);
    }
  };

  const addRecipient = () => {
    if (recipientInput && !newConfig.recipients.includes(recipientInput)) {
      setNewConfig({
        ...newConfig,
        recipients: [...newConfig.recipients, recipientInput]
      });
      setRecipientInput('');
    }
  };

  const removeRecipient = (email) => {
    setNewConfig({
      ...newConfig,
      recipients: newConfig.recipients.filter(r => r !== email)
    });
  };

  const toggleDaysBefore = (day) => {
    const days = newConfig.days_before.includes(day)
      ? newConfig.days_before.filter(d => d !== day)
      : [...newConfig.days_before, day].sort((a, b) => b - a);
    setNewConfig({ ...newConfig, days_before: days });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="auto-reminders">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-7 w-7 text-orange-400" />
            Auto Reminders / स्वचालित रिमाइंडर
          </h1>
          <p className="text-slate-400 mt-1">Configure automatic alerts for challan due dates</p>
        </div>
        <div className="flex items-center gap-3">
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
          {pendingReminders.length > 0 && (
            <Button 
              onClick={handleSendReminders}
              disabled={sending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {sending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send {pendingReminders.length} Reminders
            </Button>
          )}
          <Button 
            onClick={() => setShowConfigModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="pending" className="data-[state=active]:bg-orange-600">
            Pending ({pendingReminders.length})
          </TabsTrigger>
          <TabsTrigger value="configs" className="data-[state=active]:bg-blue-600">
            Configurations ({configs.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-purple-600">
            History
          </TabsTrigger>
        </TabsList>

        {/* Pending Reminders */}
        <TabsContent value="pending">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Pending Reminders / लंबित रिमाइंडर
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingReminders.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400 opacity-50" />
                  <p>No reminders pending today</p>
                  <p className="text-sm mt-1">All challans are either paid or not yet due</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingReminders.map((reminder, idx) => (
                    <div 
                      key={idx}
                      className={`p-4 rounded-lg flex items-center justify-between ${
                        reminder.days_remaining <= 3 
                          ? 'bg-red-500/20 border border-red-500/50' 
                          : 'bg-yellow-500/20 border border-yellow-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          reminder.days_remaining <= 3 ? 'bg-red-500/30' : 'bg-yellow-500/30'
                        }`}>
                          <Clock className={`h-5 w-5 ${
                            reminder.days_remaining <= 3 ? 'text-red-400' : 'text-yellow-400'
                          }`} />
                        </div>
                        <div>
                          <h4 className="text-white font-medium">
                            {reminder.challan_type} - {reminder.period}
                          </h4>
                          <p className="text-sm text-slate-400">
                            Due in {reminder.days_remaining} days • {formatINR(reminder.amount)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {reminder.email_enabled && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-0">
                            <Mail className="h-3 w-3 mr-1" /> Email
                          </Badge>
                        )}
                        {reminder.whatsapp_enabled && (
                          <Badge className="bg-green-500/20 text-green-400 border-0">
                            <Smartphone className="h-3 w-3 mr-1" /> WhatsApp
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configurations */}
        <TabsContent value="configs">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-400" />
                Reminder Configurations / रिमाइंडर कॉन्फ़िगरेशन
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No reminder configurations</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setShowConfigModal(true)}
                  >
                    Configure First Reminder
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {configs.map((config, idx) => (
                    <div 
                      key={idx}
                      className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-semibold">{config.challan_type}</h4>
                        <Badge className={config.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}>
                          {config.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-300">
                            {config.days_before?.join(', ')} days before
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className={`h-4 w-4 ${config.email_enabled ? 'text-blue-400' : 'text-slate-500'}`} />
                          <span className={config.email_enabled ? 'text-slate-300' : 'text-slate-500'}>
                            Email {config.email_enabled ? 'enabled' : 'disabled'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className={`h-4 w-4 ${config.whatsapp_enabled ? 'text-green-400' : 'text-slate-500'}`} />
                          <span className={config.whatsapp_enabled ? 'text-slate-300' : 'text-slate-500'}>
                            WhatsApp {config.whatsapp_enabled ? 'enabled' : 'disabled'}
                          </span>
                        </div>
                        {config.recipients?.length > 0 && (
                          <p className="text-slate-400 text-xs">
                            Recipients: {config.recipients.length}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-400" />
                Reminder History / रिमाइंडर इतिहास
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reminderHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No reminders sent yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reminderHistory.map((log, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <div>
                          <span className="text-white">{log.challan_type} - {log.period}</span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className="text-slate-400">{formatINR(log.amount)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-slate-700 text-slate-300 border-0">
                          {log.sent_via}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {new Date(log.sent_at).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configure Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-400" />
              Configure Reminder / रिमाइंडर कॉन्फ़िगर करें
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Challan Type *</label>
              <Select 
                value={newConfig.challan_type} 
                onValueChange={(v) => setNewConfig({...newConfig, challan_type: v})}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {challanTypes.map(type => (
                    <SelectItem key={type} value={type} className="text-white">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Remind Before (days)</label>
              <div className="flex gap-2">
                {[7, 5, 3, 2, 1].map(day => (
                  <button
                    key={day}
                    onClick={() => toggleDaysBefore(day)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newConfig.days_before.includes(day)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {day}d
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-400" />
                <span className="text-white">Email Notifications</span>
              </div>
              <Switch 
                checked={newConfig.email_enabled}
                onCheckedChange={(v) => setNewConfig({...newConfig, email_enabled: v})}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-green-400" />
                <span className="text-white">WhatsApp Notifications</span>
              </div>
              <Switch 
                checked={newConfig.whatsapp_enabled}
                onCheckedChange={(v) => setNewConfig({...newConfig, whatsapp_enabled: v})}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Recipients (Email)</label>
              <div className="flex gap-2">
                <Input 
                  type="email"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="email@example.com"
                />
                <Button onClick={addRecipient} variant="outline" className="border-slate-600">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {newConfig.recipients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newConfig.recipients.map((email, idx) => (
                    <Badge 
                      key={idx}
                      className="bg-slate-700 text-slate-300 cursor-pointer hover:bg-red-500/20"
                      onClick={() => removeRecipient(email)}
                    >
                      {email} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveConfig}
              disabled={newConfig.days_before.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
