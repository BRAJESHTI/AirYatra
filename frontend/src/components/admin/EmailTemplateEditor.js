import React, { useState, useEffect, useCallback } from 'react';
import { 
  Mail, Eye, Send, RefreshCw, Download, Code, Palette,
  Sun, Moon, Globe, BarChart3, MousePointer, Clock,
  Check, X, Loader2, Copy, ExternalLink, Languages
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-1" />Refresh
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
