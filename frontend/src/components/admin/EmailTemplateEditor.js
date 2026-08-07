import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, Eye, Send, RefreshCw, Download, Code, Palette,
  Sun, Moon, Globe, BarChart3, MousePointer, Clock,
  Check, X, Loader2, Copy, ExternalLink, Languages,
  TrendingUp, Calendar, Megaphone, Users, Beaker
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import api from '../../services/api';
import { toast } from 'sonner';

const TEMPLATES = [
  { id: 'booking_confirmation', name: 'Booking Confirmation', icon: '📋', description: 'Sent when booking is confirmed' },
  { id: 'payment_receipt', name: 'Payment Receipt', icon: '🧾', description: 'After successful payment' },
  { id: 'flight_reminder', name: 'Flight Reminder', icon: '🔔', description: '24 hours before flight' },
  { id: 'flight_rescheduled', name: 'Flight Rescheduled', icon: '📅', description: 'When flight timing changes' },
  { id: 'flight_cancelled', name: 'Flight Cancelled', icon: '❌', description: 'When flight is cancelled' },
  { id: 'flight_completed', name: 'Flight Completed', icon: '✈️', description: 'Thank you after flight' },
  { id: 'inquiry_received', name: 'Inquiry Received', icon: '📩', description: 'When inquiry submitted' },
  { id: 'otp', name: 'OTP Verification', icon: '🔐', description: 'Login/Signup verification' },
];

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
];

export default function EmailTemplateEditor() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('en');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeView, setActiveView] = useState('templates'); // templates, charts, campaigns
  const [trendData, setTrendData] = useState([]);
  const [templateStats, setTemplateStats] = useState([]);

  // Load preview
  const loadPreview = useCallback(async (templateId) => {
    if (!templateId) return;
    setLoading(true);
    try {
      const res = await api.get(`/templates/email-templates/preview/${templateId}?theme=${theme}`);
      if (res.data.success) {
        setPreviewHtml(res.data.html);
        setPreviewSubject(res.data.subject);
      }
    } catch (err) {
      toast.error('Failed to load preview');
    }
    setLoading(false);
  }, [theme]);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.get('/templates/email/analytics?days=30');
      if (res.data.success) {
        setAnalytics(res.data);
      }
      
      // Load trend data for charts
      const trendsRes = await api.get('/email-campaigns/analytics/trends?days=30');
      if (trendsRes.data.success) {
        setTrendData(trendsRes.data.trends || []);
      }
      
      // Load template stats for bar chart
      const templateRes = await api.get('/email-campaigns/analytics/templates?days=30');
      if (templateRes.data.success) {
        setTemplateStats(templateRes.data.templates || []);
      }
    } catch (err) {
      console.error(err);
    }
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (selectedTemplate) {
      loadPreview(selectedTemplate.id);
    }
  }, [selectedTemplate, theme, loadPreview]);

  // Send test email
  const handleSendTest = async () => {
    if (!testEmail || !selectedTemplate) {
      toast.error('Enter email address');
      return;
    }
    try {
      const res = await api.post(`/templates/email-templates/send-test?template_name=${selectedTemplate.id}&recipient_email=${encodeURIComponent(testEmail)}&theme=${theme}`);
      if (res.data.success) {
        toast.success(`Test email sent to ${testEmail}`);
        setShowSendDialog(false);
        setTestEmail('');
      } else {
        toast.error(res.data.error || 'Send failed');
      }
    } catch (err) {
      toast.error('Failed to send test email');
    }
  };

  // Copy HTML
  const handleCopyHtml = () => {
    navigator.clipboard.writeText(previewHtml);
    toast.success('HTML copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-orange-500" />
            Email Template Editor
          </h2>
          <p className="text-sm text-slate-500">Preview, customize, and test branded email templates</p>
        </div>
        <div className="flex gap-2">
          {/* View Toggle */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {[
              { id: 'templates', label: 'Templates', icon: Mail },
              { id: 'charts', label: 'Analytics', icon: TrendingUp },
              { id: 'campaigns', label: 'Campaigns', icon: Megaphone }
            ].map(view => (
              <Button
                key={view.id}
                variant={activeView === view.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView(view.id)}
                className={activeView === view.id ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
              >
                <view.icon className="h-4 w-4 mr-1" />{view.label}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCw className={`h-4 w-4 mr-1 ${analyticsLoading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <Send className="h-5 w-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{analytics.total_sent?.toLocaleString() || 0}</p>
            <p className="text-xs text-slate-500">Sent (30d)</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <Eye className="h-5 w-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold">{analytics.total_opened?.toLocaleString() || 0}</p>
            <p className="text-xs text-slate-500">Opened</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <MousePointer className="h-5 w-5 text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{analytics.total_clicked?.toLocaleString() || 0}</p>
            <p className="text-xs text-slate-500">Clicked</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <BarChart3 className="h-5 w-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold">{analytics.open_rate || 0}%</p>
            <p className="text-xs text-slate-500">Open Rate</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <Check className="h-5 w-5 text-teal-500 mb-2" />
            <p className="text-2xl font-bold">{analytics.click_rate || 0}%</p>
            <p className="text-xs text-slate-500">Click Rate</p>
          </div>
        </div>
      )}

      {/* Charts View */}
      {activeView === 'charts' && (
        <div className="space-y-6">
          {/* Daily Trends Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Email Engagement Trends (30 Days)
            </h3>
            <div className="h-[300px]">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorClicked" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tick={{fontSize: 11}} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{fontSize: 11}} />
                    <Tooltip 
                      contentStyle={{background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}}
                      labelStyle={{color: '#94a3b8'}}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="url(#colorSent)" name="Sent" />
                    <Area type="monotone" dataKey="opened" stroke="#22c55e" fill="url(#colorOpened)" name="Opened" />
                    <Area type="monotone" dataKey="clicked" stroke="#a855f7" fill="url(#colorClicked)" name="Clicked" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <p>No trend data available yet. Start sending emails to see analytics.</p>
                </div>
              )}
            </div>
          </div>

          {/* Template Performance Bar Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-500" />
              Template Performance (30 Days)
            </h3>
            <div className="h-[300px]">
              {templateStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={templateStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{fontSize: 11}} />
                    <YAxis dataKey="template" type="category" tick={{fontSize: 11}} width={120} />
                    <Tooltip 
                      contentStyle={{background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}}
                    />
                    <Legend />
                    <Bar dataKey="sent" fill="#3b82f6" name="Sent" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="opened" fill="#22c55e" name="Opened" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="clicked" fill="#a855f7" name="Clicked" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <p>No template data available yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Open/Click Rate Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
              <Eye className="h-8 w-8 mb-3 opacity-80" />
              <p className="text-4xl font-bold">{analytics?.open_rate || 0}%</p>
              <p className="text-sm opacity-80 mt-1">Average Open Rate</p>
              <p className="text-xs opacity-60 mt-2">Industry avg: 20-25%</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl p-6 text-white">
              <MousePointer className="h-8 w-8 mb-3 opacity-80" />
              <p className="text-4xl font-bold">{analytics?.click_rate || 0}%</p>
              <p className="text-sm opacity-80 mt-1">Average Click Rate</p>
              <p className="text-xs opacity-60 mt-2">Industry avg: 2-5%</p>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns View */}
      {activeView === 'campaigns' && (
        <EmailCampaignManager />
      )}

      {/* Templates View */}
      {activeView === 'templates' && (
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Templates</h3>
          <div className="space-y-2">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-500'
                    : 'bg-white dark:bg-slate-800 hover:border-orange-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-slate-500">{template.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedTemplate ? (
            <>
              {/* Controls */}
              <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border">
                <div className="flex items-center gap-4">
                  {/* Theme Toggle */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Theme:</Label>
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                      <button
                        onClick={() => setTheme('dark')}
                        className={`p-2 rounded ${theme === 'dark' ? 'bg-slate-800 text-white' : ''}`}
                      >
                        <Moon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTheme('light')}
                        className={`p-2 rounded ${theme === 'light' ? 'bg-white text-slate-800 shadow' : ''}`}
                      >
                        <Sun className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Language:</Label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="px-3 py-1.5 border rounded-lg text-sm"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.native}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyHtml}>
                    <Copy className="h-4 w-4 mr-1" />HTML
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => loadPreview(selectedTemplate.id)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => setShowSendDialog(true)} className="bg-orange-500 hover:bg-orange-600">
                    <Send className="h-4 w-4 mr-1" />Send Test
                  </Button>
                </div>
              </div>

              {/* Subject Preview */}
              <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
                <Label className="text-xs text-slate-500">Subject:</Label>
                <p className="font-medium mt-1">{previewSubject || 'Loading...'}</p>
              </div>

              {/* Email Preview */}
              <div className="relative bg-slate-200 dark:bg-slate-900 rounded-xl overflow-hidden" style={{ minHeight: '600px' }}>
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  </div>
                ) : (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full min-h-[600px] border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                )}
              </div>

              {/* Template Stats */}
              {analytics?.template_breakdown?.[selectedTemplate.id] && (
                <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    {selectedTemplate.name} Stats (30d)
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-500">
                        {analytics.template_breakdown[selectedTemplate.id]?.sent || 0}
                      </p>
                      <p className="text-xs text-slate-500">Sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-500">
                        {analytics.template_breakdown[selectedTemplate.id]?.opened || 0}
                      </p>
                      <p className="text-xs text-slate-500">Opened</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-500">
                        {analytics.template_breakdown[selectedTemplate.id]?.clicked || 0}
                      </p>
                      <p className="text-xs text-slate-500">Clicked</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-96 bg-white dark:bg-slate-800 rounded-xl border">
              <div className="text-center text-slate-500">
                <Mail className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Select a template to preview</p>
                <p className="text-sm">Choose from 8 branded email templates</p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Send Test Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Send className="h-5 w-5 inline mr-2 text-orange-500" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm">
              <strong>Template:</strong> {selectedTemplate?.name}<br />
              <strong>Theme:</strong> {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </div>
            <div>
              <Label>Recipient Email *</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button onClick={handleSendTest} className="bg-orange-500 hover:bg-orange-600">
              <Send className="h-4 w-4 mr-2" />Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== EMAIL CAMPAIGN MANAGER COMPONENT ====================

function EmailCampaignManager() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    template_name: 'booking_confirmation',
    subject: '',
    audience_type: 'all_customers',
    scheduled_at: '',
    ab_testing_enabled: false,
    variant_b_subject: ''
  });

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get('/email-campaigns/campaigns');
      if (res.data.success) {
        setCampaigns(res.data.campaigns || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.scheduled_at) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      const res = await api.post('/email-campaigns/campaigns', {
        ...newCampaign,
        scheduled_at: new Date(newCampaign.scheduled_at).toISOString()
      });
      if (res.data.success) {
        toast.success('Campaign created!');
        setShowCreateDialog(false);
        setNewCampaign({
          name: '', template_name: 'booking_confirmation', subject: '',
          audience_type: 'all_customers', scheduled_at: '', ab_testing_enabled: false, variant_b_subject: ''
        });
        loadCampaigns();
      }
    } catch (err) {
      toast.error('Failed to create campaign');
    }
  };

  const handleSchedule = async (campaignId) => {
    try {
      const res = await api.post(`/email-campaigns/campaigns/${campaignId}/schedule`);
      if (res.data.success) {
        toast.success(`Scheduled! ${res.data.recipients} recipients`);
        loadCampaigns();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule');
    }
  };

  const handleSendNow = async (campaignId) => {
    try {
      const res = await api.post(`/email-campaigns/campaigns/${campaignId}/send-now`);
      if (res.data.success) {
        toast.success('Campaign sending started!');
        loadCampaigns();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send');
    }
  };

  const handleCancel = async (campaignId) => {
    try {
      await api.post(`/email-campaigns/campaigns/${campaignId}/cancel`);
      toast.success('Campaign cancelled');
      loadCampaigns();
    } catch (err) {
      toast.error('Failed to cancel');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-600',
      scheduled: 'bg-blue-100 text-blue-600',
      sending: 'bg-yellow-100 text-yellow-600',
      completed: 'bg-green-100 text-green-600',
      cancelled: 'bg-red-100 text-red-600',
      failed: 'bg-red-100 text-red-600'
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-orange-500" />
            Email Campaigns
          </h3>
          <p className="text-sm text-slate-500">Schedule and manage bulk email campaigns</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-orange-500 hover:bg-orange-600">
          <Calendar className="h-4 w-4 mr-2" />New Campaign
        </Button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No campaigns yet. Create your first email campaign!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium">Campaign</th>
                  <th className="text-left p-4 text-sm font-medium">Template</th>
                  <th className="text-left p-4 text-sm font-medium">Audience</th>
                  <th className="text-left p-4 text-sm font-medium">Scheduled</th>
                  <th className="text-left p-4 text-sm font-medium">Stats</th>
                  <th className="text-left p-4 text-sm font-medium">Status</th>
                  <th className="text-left p-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.map(camp => (
                  <tr key={camp.campaign_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="p-4">
                      <p className="font-medium">{camp.name}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{camp.subject}</p>
                      {camp.ab_testing?.enabled && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-600 mt-1">
                          <Beaker className="h-3 w-3" />A/B Test
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm">{camp.template_name}</td>
                    <td className="p-4">
                      <span className="text-sm">{camp.audience_type?.replace(/_/g, ' ')}</span>
                      <p className="text-xs text-slate-500">{camp.stats?.total_recipients || 0} recipients</p>
                    </td>
                    <td className="p-4 text-sm">
                      {camp.scheduled_at ? new Date(camp.scheduled_at).toLocaleString('en-IN', {
                        dateStyle: 'medium', timeStyle: 'short'
                      }) : '-'}
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex gap-3 text-xs">
                        <span className="text-blue-600">{camp.stats?.sent || 0} sent</span>
                        <span className="text-green-600">{camp.stats?.opened || 0} opened</span>
                        <span className="text-purple-600">{camp.stats?.clicked || 0} clicked</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={getStatusBadge(camp.status)}>{camp.status}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {camp.status === 'draft' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleSchedule(camp.campaign_id)}>
                              Schedule
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSendNow(camp.campaign_id)}>
                              <Send className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {camp.status === 'scheduled' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleSendNow(camp.campaign_id)}>
                              Send Now
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCancel(camp.campaign_id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {camp.status === 'completed' && camp.ab_testing?.enabled && (
                          <Button size="sm" variant="outline" onClick={() => toast.info('A/B Results: Coming soon!')}>
                            <Beaker className="h-3 w-3 mr-1" />Results
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <Megaphone className="h-5 w-5 inline mr-2 text-orange-500" />
              Create Email Campaign
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})}
                placeholder="Diwali Special Offer"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email Subject *</Label>
              <Input
                value={newCampaign.subject}
                onChange={(e) => setNewCampaign({...newCampaign, subject: e.target.value})}
                placeholder="🎉 Exclusive Diwali Discount - 20% Off Flights!"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-lg bg-white dark:bg-slate-800"
                  value={newCampaign.template_name}
                  onChange={(e) => setNewCampaign({...newCampaign, template_name: e.target.value})}
                >
                  {TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Audience</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-lg bg-white dark:bg-slate-800"
                  value={newCampaign.audience_type}
                  onChange={(e) => setNewCampaign({...newCampaign, audience_type: e.target.value})}
                >
                  <option value="all_customers">All Customers</option>
                  <option value="active_customers">Active (90 days)</option>
                  <option value="inactive_customers">Inactive</option>
                  <option value="vip_customers">VIP Members</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Schedule Date & Time *</Label>
              <Input
                type="datetime-local"
                value={newCampaign.scheduled_at}
                onChange={(e) => setNewCampaign({...newCampaign, scheduled_at: e.target.value})}
                className="mt-1"
              />
            </div>
            
            {/* A/B Testing Toggle */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCampaign.ab_testing_enabled}
                  onChange={(e) => setNewCampaign({...newCampaign, ab_testing_enabled: e.target.checked})}
                  className="w-4 h-4 accent-purple-600"
                />
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-purple-500" />
                    Enable A/B Testing
                  </p>
                  <p className="text-xs text-slate-500">Test different subject lines to optimize open rates</p>
                </div>
              </label>
              
              {newCampaign.ab_testing_enabled && (
                <div className="mt-3">
                  <Label>Variant B Subject</Label>
                  <Input
                    value={newCampaign.variant_b_subject}
                    onChange={(e) => setNewCampaign({...newCampaign, variant_b_subject: e.target.value})}
                    placeholder="Alternative subject line to test"
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">50% audience gets each variant</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateCampaign} className="bg-orange-500 hover:bg-orange-600">
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
