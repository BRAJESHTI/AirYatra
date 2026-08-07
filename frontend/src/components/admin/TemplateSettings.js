import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, Mail, CreditCard, Phone, Plus, Edit, Trash2, 
  Power, PowerOff, Copy, Eye, RefreshCw, Loader2, Search, 
  ChevronDown, Check, X, FileText, Zap, Send, Download,
  Settings, AlertTriangle, CheckCircle2, Clock, Hash, Globe,
  BarChart3, TrendingUp, Calendar, GitBranch, Beaker, Languages,
  Timer, Bell, ArrowRight, Award, Target, Percent, History,
  RotateCcw, Shield, CheckSquare, XSquare, MessageCircle, Sparkles,
  Lightbulb, Wand2, FileCheck, FileClock, AlertCircle, PlayCircle,
  BookOpen, Library, TestTube2, Activity, Package, Star, Import, 
  Gauge, AlertOctagon, Filter, ExternalLink, Inbox, PhoneCall
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const CATEGORY_CONFIG = {
  sms: { label: 'SMS', icon: Phone, color: 'bg-green-500', bgLight: 'bg-green-50' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'bg-emerald-500', bgLight: 'bg-emerald-50' },
  email: { label: 'Email', icon: Mail, color: 'bg-blue-500', bgLight: 'bg-blue-50' },
  payment: { label: 'Payment', icon: CreditCard, color: 'bg-purple-500', bgLight: 'bg-purple-50' }
};

const LANGUAGE_CONFIG = {
  en: { name: 'English', native: 'English', flag: '🇬🇧' },
  hi: { name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  mr: { name: 'Marathi', native: 'मराठी', flag: '🏛️' },
  gu: { name: 'Gujarati', native: 'ગુજરાતી', flag: '🦁' },
  ta: { name: 'Tamil', native: 'தமிழ்', flag: '🏺' }
};

const APPROVAL_STATUS = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending_approval: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: FileClock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: FileCheck },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XSquare },
  changes_requested: { label: 'Changes Requested', color: 'bg-orange-100 text-orange-700', icon: AlertCircle }
};

export default function TemplateSettings() {
  const [activeTab, setActiveTab] = useState('templates');
  const [activeCategory, setActiveCategory] = useState('sms');
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showABDialog, setShowABDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  
  // Data states
  const [analyticsData, setAnalyticsData] = useState(null);
  const [abStats, setAbStats] = useState(null);
  const [scheduledTemplates, setScheduledTemplates] = useState(null);
  const [versionHistory, setVersionHistory] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [bestPractices, setBestPractices] = useState(null);
  
  // Phase 4 States
  const [libraryTemplates, setLibraryTemplates] = useState([]);
  const [libraryFilters, setLibraryFilters] = useState({ category: '', tag: '', search: '', sort: 'popularity' });
  const [alerts, setAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [deliveryReports, setDeliveryReports] = useState({ reports: [], stats: {} });
  const [sandboxHistory, setSandboxHistory] = useState([]);
  const [showSandboxDialog, setShowSandboxDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [sandboxRecipient, setSandboxRecipient] = useState('');
  const [sandboxLanguage, setSandboxLanguage] = useState('en');
  const [alertConfig, setAlertConfig] = useState({
    metric: 'delivery_rate',
    threshold: 90,
    comparison: 'below',
    notify_emails: ''
  });
  
  // Chart & WhatsApp States
  const [chartData, setChartData] = useState({ line: [], bar: [], pie: [], summary: {} });
  const [chartDays, setChartDays] = useState(7);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('booking_confirmation');
  const [whatsappVariables, setWhatsappVariables] = useState({});
  
  // Chart colors
  const CHART_COLORS = ['#f97316', '#22c55e', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];
  
  // Config
  const [templateVariables, setTemplateVariables] = useState({});
  const [triggerEvents, setTriggerEvents] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [scheduleTypes, setScheduleTypes] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '', category: 'sms', subject: '', content: '',
    content_hindi: '', content_marathi: '', content_gujarati: '', content_tamil: '',
    variables: [], trigger_event: '', is_active: true, priority: 0,
    schedule_type: 'immediate', schedule_offset: 24, schedule_unit: 'hours', schedule_time: '09:00'
  });
  
  const [activeLang, setActiveLang] = useState('en');
  const [approvalNote, setApprovalNote] = useState('');
  const [aiSuggestionType, setAiSuggestionType] = useState('improve');

  // Load functions
  const loadVariables = useCallback(async () => {
    try {
      const res = await api.get('/templates/variables');
      setTemplateVariables(res.data.variables || {});
      setTriggerEvents(res.data.trigger_events || []);
      setLanguages(res.data.languages || []);
      setScheduleTypes(res.data.schedule_types || []);
    } catch (err) {
      console.error('Failed to load variables:', err);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/templates/list', {
          params: { category: activeCategory, search: searchQuery || undefined, is_active: showInactive ? undefined : true, limit: 100 }
        }),
        api.get('/templates/stats')
      ]);
      setTemplates(listRes.data.templates || []);
      setStats(statsRes.data.stats || {});
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, searchQuery, showInactive]);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await api.get('/templates/analytics/overview?days=30');
      setAnalyticsData(res.data);
    } catch (err) { console.error(err); }
  }, []);

  const loadScheduled = useCallback(async () => {
    try {
      const res = await api.get('/templates/scheduled');
      setScheduledTemplates(res.data.scheduled_templates);
    } catch (err) { console.error(err); }
  }, []);

  const loadPendingApprovals = useCallback(async () => {
    try {
      const res = await api.get('/templates/approvals/pending');
      setPendingApprovals(res.data.pending_approvals || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadNotificationQueue = useCallback(async () => {
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/templates/queue/pending'),
        api.get('/templates/queue/history?days=7')
      ]);
      setNotificationQueue({
        pending: pendingRes.data.pending || [],
        history: historyRes.data.history || [],
        stats: historyRes.data.stats || {}
      });
    } catch (err) { console.error(err); }
  }, []);

  const loadBestPractices = useCallback(async () => {
    try {
      const res = await api.get(`/templates/ai/best-practices?category=${activeCategory}`);
      setBestPractices(res.data.best_practices);
    } catch (err) { console.error(err); }
  }, [activeCategory]);

  // Phase 4 Load Functions
  const loadLibrary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (libraryFilters.category) params.append('category', libraryFilters.category);
      if (libraryFilters.tag) params.append('tag', libraryFilters.tag);
      if (libraryFilters.search) params.append('search', libraryFilters.search);
      params.append('sort_by', libraryFilters.sort);
      const res = await api.get(`/templates/library/browse?${params.toString()}`);
      setLibraryTemplates(res.data.templates || []);
    } catch (err) { console.error(err); }
  }, [libraryFilters]);

  const loadAlerts = useCallback(async () => {
    try {
      const [alertsRes, historyRes] = await Promise.all([
        api.get('/templates/alerts/list'),
        api.get('/templates/alerts/history?days=7')
      ]);
      setAlerts(alertsRes.data.alerts || []);
      setAlertHistory(historyRes.data.history || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadDeliveryReports = useCallback(async () => {
    try {
      const res = await api.get('/templates/delivery-reports?days=7&limit=100');
      setDeliveryReports({
        reports: res.data.reports || [],
        stats: res.data.stats || {}
      });
    } catch (err) { console.error(err); }
  }, []);

  // Chart Data Load
  const loadChartData = useCallback(async () => {
    try {
      const res = await api.get(`/templates/analytics/chart-data?days=${chartDays}`);
      if (res.data.success) {
        setChartData({
          line: res.data.line_chart?.data || [],
          bar: res.data.bar_chart?.data || [],
          pie: res.data.pie_chart?.data || [],
          summary: res.data.summary || {}
        });
      }
    } catch (err) { console.error(err); }
  }, [chartDays]);

  // WhatsApp Status
  const loadWhatsAppStatus = useCallback(async () => {
    try {
      const res = await api.get('/templates/whatsapp/status');
      setWhatsappStatus(res.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadVariables(); loadWhatsAppStatus(); }, [loadVariables, loadWhatsAppStatus]);

  useEffect(() => {
    if (activeTab === 'templates') loadTemplates();
    else if (activeTab === 'analytics') { loadAnalytics(); loadChartData(); }
    else if (activeTab === 'scheduled') loadScheduled();
    else if (activeTab === 'approvals') loadPendingApprovals();
    else if (activeTab === 'queue') loadNotificationQueue();
    else if (activeTab === 'library') loadLibrary();
    else if (activeTab === 'alerts') loadAlerts();
    else if (activeTab === 'delivery') loadDeliveryReports();
  }, [activeTab, loadTemplates, loadAnalytics, loadScheduled, loadPendingApprovals, loadNotificationQueue, loadLibrary, loadAlerts, loadDeliveryReports, loadChartData]);

  // Handlers
  const handleCreate = () => {
    setFormData({
      name: '', category: activeCategory, subject: '', content: '',
      content_hindi: '', content_marathi: '', content_gujarati: '', content_tamil: '',
      variables: [], trigger_event: '', is_active: true, priority: 0,
      schedule_type: 'immediate', schedule_offset: 24, schedule_unit: 'hours', schedule_time: '09:00'
    });
    setActiveLang('en');
    loadBestPractices();
    setShowCreateDialog(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name, category: template.category, subject: template.subject || '',
      content: template.content, content_hindi: template.content_hindi || '',
      content_marathi: template.content_marathi || '', content_gujarati: template.content_gujarati || '',
      content_tamil: template.content_tamil || '', variables: template.variables || [],
      trigger_event: template.trigger_event || '', is_active: template.is_active,
      priority: template.priority || 0, schedule_type: template.schedule_type || 'immediate',
      schedule_offset: template.schedule_offset || 24, schedule_unit: template.schedule_unit || 'hours',
      schedule_time: template.schedule_time || '09:00'
    });
    setActiveLang('en');
    setShowEditDialog(true);
  };

  const handlePreview = async (template) => {
    try {
      const res = await api.post(`/templates/preview?template_id=${template.template_id}`);
      setPreviewContent(res.data.preview);
      setSelectedTemplate(template);
      setShowPreviewDialog(true);
    } catch (err) { toast.error('Preview failed'); }
  };

  const handleToggleActive = async (template) => {
    // Check approval status
    if (!template.is_active && template.approval_status && template.approval_status !== 'approved') {
      toast.error('Template must be approved before activation');
      return;
    }
    try {
      await api.patch(`/templates/${template.template_id}/toggle`);
      toast.success(template.is_active ? 'Deactivated' : 'Activated');
      loadTemplates();
    } catch (err) { toast.error('Toggle failed'); }
  };

  const handleDelete = (template) => {
    setSelectedTemplate(template);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/templates/${selectedTemplate.template_id}`);
      toast.success('Deleted');
      setShowDeleteDialog(false);
      loadTemplates();
    } catch (err) { toast.error('Delete failed'); }
  };

  const handleSaveTemplate = async (isEdit = false) => {
    try {
      if (isEdit) {
        // Save version before edit
        await api.post(`/templates/${selectedTemplate.template_id}/save-version?change_note=${encodeURIComponent('Pre-edit backup')}`);
        await api.put(`/templates/${selectedTemplate.template_id}`, formData);
        toast.success('Updated & version saved');
        setShowEditDialog(false);
      } else {
        await api.post('/templates/create', formData);
        toast.success('Created');
        setShowCreateDialog(false);
      }
      loadTemplates();
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await api.post('/templates/seed-defaults');
      toast.success(`Created ${res.data.created} templates`);
      loadTemplates();
    } catch (err) { toast.error('Seed failed'); }
  };

  const handleDuplicate = async (template) => {
    const newName = prompt('New name:', `${template.name} (Copy)`);
    if (!newName) return;
    try {
      await api.post(`/templates/duplicate/${template.template_id}?new_name=${encodeURIComponent(newName)}`);
      toast.success('Duplicated');
      loadTemplates();
    } catch (err) { toast.error('Duplicate failed'); }
  };

  // Version History
  const handleViewHistory = async (template) => {
    setSelectedTemplate(template);
    try {
      const res = await api.get(`/templates/${template.template_id}/history`);
      setVersionHistory(res.data.history || []);
      setShowHistoryDialog(true);
    } catch (err) { toast.error('History load failed'); }
  };

  const handleRollback = async (version) => {
    if (!confirm(`Rollback to version ${version}?`)) return;
    try {
      await api.post(`/templates/${selectedTemplate.template_id}/rollback/${version}`);
      toast.success(`Rolled back to v${version}`);
      setShowHistoryDialog(false);
      loadTemplates();
    } catch (err) { toast.error('Rollback failed'); }
  };

  // Approval Workflow
  const handleSubmitForApproval = async (template) => {
    const note = prompt('Add note (optional):');
    try {
      await api.post(`/templates/${template.template_id}/submit-for-approval?note=${encodeURIComponent(note || '')}`);
      toast.success('Submitted for approval');
      loadTemplates();
    } catch (err) { toast.error(err.response?.data?.detail || 'Submit failed'); }
  };

  const handleApprove = async (templateId) => {
    try {
      await api.post(`/templates/${templateId}/approve?note=${encodeURIComponent(approvalNote)}`);
      toast.success('Approved');
      setApprovalNote('');
      loadPendingApprovals();
      loadTemplates();
    } catch (err) { toast.error(err.response?.data?.detail || 'Approve failed'); }
  };

  const handleReject = async (templateId) => {
    if (!approvalNote || approvalNote.length < 10) {
      toast.error('Please provide rejection reason (min 10 chars)');
      return;
    }
    try {
      await api.post(`/templates/${templateId}/reject?reason=${encodeURIComponent(approvalNote)}`);
      toast.success('Rejected');
      setApprovalNote('');
      loadPendingApprovals();
      loadTemplates();
    } catch (err) { toast.error(err.response?.data?.detail || 'Reject failed'); }
  };

  const handleRequestChanges = async (templateId) => {
    if (!approvalNote || approvalNote.length < 10) {
      toast.error('Please specify changes needed (min 10 chars)');
      return;
    }
    try {
      await api.post(`/templates/${templateId}/request-changes?changes=${encodeURIComponent(approvalNote)}`);
      toast.success('Changes requested');
      setApprovalNote('');
      loadPendingApprovals();
      loadTemplates();
    } catch (err) { toast.error('Request failed'); }
  };

  // AI Suggestions
  const handleGetAISuggestions = async (template) => {
    setSelectedTemplate(template);
    setAiSuggestions(null);
    setShowAIDialog(true);
    try {
      const res = await api.post(`/templates/${template.template_id}/ai-suggestions?suggestion_type=${aiSuggestionType}`);
      setAiSuggestions(res.data);
    } catch (err) { toast.error('AI suggestions failed'); }
  };

  // Queue
  const handleSendNow = async (queueId) => {
    try {
      await api.post(`/templates/queue/${queueId}/send-now`);
      toast.success('Sending...');
      setTimeout(loadNotificationQueue, 2000);
    } catch (err) { toast.error('Send failed'); }
  };

  const handleCancelQueued = async (queueId) => {
    try {
      await api.post(`/templates/queue/${queueId}/cancel`);
      toast.success('Cancelled');
      loadNotificationQueue();
    } catch (err) { toast.error('Cancel failed'); }
  };

  // A/B Testing
  const handleCreateVariant = async (template) => {
    const name = prompt('Variant name:', `${template.name} - Variant B`);
    if (!name) return;
    try {
      await api.post(`/templates/${template.template_id}/create-variant?variant_name=${encodeURIComponent(name)}`);
      toast.success('Variant created');
      loadTemplates();
    } catch (err) { toast.error('Create variant failed'); }
  };

  const handleViewABStats = async (template) => {
    const parentId = template.parent_template_id || template.template_id;
    try {
      const res = await api.get(`/templates/${parentId}/ab-stats`);
      setAbStats(res.data);
      setSelectedTemplate(template);
      setShowABDialog(true);
    } catch (err) { toast.error('A/B stats failed'); }
  };

  const handleToggleABTest = async (template, percentage = 50) => {
    try {
      const res = await api.patch(`/templates/${template.template_id}/ab-test/toggle?percentage=${percentage}`);
      toast.success(res.data.message);
      loadTemplates();
    } catch (err) { toast.error('Toggle A/B failed'); }
  };

  // Schedule
  const handleConfigureSchedule = (template) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      schedule_type: template.schedule_type || 'immediate',
      schedule_offset: template.schedule_offset || 24,
      schedule_unit: template.schedule_unit || 'hours',
      schedule_time: template.schedule_time || '09:00'
    }));
    setShowScheduleDialog(true);
  };

  const handleSaveSchedule = async () => {
    try {
      const params = new URLSearchParams({ schedule_type: formData.schedule_type });
      if (formData.schedule_type !== 'immediate') {
        if (formData.schedule_type === 'fixed_time') params.append('schedule_time', formData.schedule_time);
        else { params.append('schedule_offset', formData.schedule_offset); params.append('schedule_unit', formData.schedule_unit); }
      }
      await api.post(`/templates/${selectedTemplate.template_id}/schedule?${params.toString()}`);
      toast.success('Schedule saved');
      setShowScheduleDialog(false);
      loadTemplates();
    } catch (err) { toast.error('Schedule save failed'); }
  };

  // Phase 4 Handlers
  const handleImportLibraryTemplate = async (libraryId, customName) => {
    try {
      const params = customName ? `?custom_name=${encodeURIComponent(customName)}` : '';
      const res = await api.post(`/templates/library/${libraryId}/import${params}`);
      if (res.data.success) {
        toast.success(res.data.message);
        loadLibrary();
        loadTemplates();
      } else {
        toast.info(res.data.message);
      }
    } catch (err) { toast.error('Import failed'); }
  };

  const handleConfigureAlert = async () => {
    try {
      const params = new URLSearchParams({
        metric: alertConfig.metric,
        threshold: alertConfig.threshold,
        comparison: alertConfig.comparison
      });
      if (alertConfig.notify_emails) {
        alertConfig.notify_emails.split(',').forEach(e => params.append('notify_emails', e.trim()));
      }
      if (selectedTemplate) params.append('template_id', selectedTemplate.template_id);
      await api.post(`/templates/alerts/configure?${params.toString()}`);
      toast.success('Alert configured');
      setShowAlertDialog(false);
      loadAlerts();
    } catch (err) { toast.error('Alert config failed'); }
  };

  const handleDeleteAlert = async (alertId) => {
    if (!confirm('Delete this alert?')) return;
    try {
      await api.delete(`/templates/alerts/${alertId}`);
      toast.success('Alert deleted');
      loadAlerts();
    } catch (err) { toast.error('Delete failed'); }
  };

  const handleSandboxTest = async () => {
    if (!sandboxRecipient) { toast.error('Enter recipient'); return; }
    try {
      const res = await api.post(`/templates/${selectedTemplate.template_id}/sandbox/test?test_recipient=${encodeURIComponent(sandboxRecipient)}&language=${sandboxLanguage}`);
      toast.success(res.data.message);
      setShowSandboxDialog(false);
      loadSandboxHistory(selectedTemplate.template_id);
    } catch (err) { toast.error('Test failed'); }
  };

  const loadSandboxHistory = async (templateId) => {
    try {
      const res = await api.get(`/templates/${templateId}/sandbox/history`);
      setSandboxHistory(res.data.history || []);
    } catch (err) { console.error(err); }
  };

  const openSandboxDialog = (template) => {
    setSelectedTemplate(template);
    setSandboxRecipient('');
    setSandboxLanguage('en');
    loadSandboxHistory(template.template_id);
    setShowSandboxDialog(true);
  };

  const openAlertDialog = (template = null) => {
    setSelectedTemplate(template);
    setAlertConfig({ metric: 'delivery_rate', threshold: 90, comparison: 'below', notify_emails: '' });
    setShowAlertDialog(true);
  };

  // WhatsApp Handlers
  const handleSendWhatsApp = async () => {
    if (!whatsappPhone) { toast.error('Enter phone number'); return; }
    try {
      const res = await api.post(`/templates/whatsapp/send?phone=${encodeURIComponent(whatsappPhone)}&template_id=${whatsappTemplate}`, {
        variables: whatsappVariables
      });
      if (res.data.success) {
        toast.success(`WhatsApp sent! ${res.data.mock_mode ? '(Mock Mode)' : ''}`);
        setShowWhatsAppDialog(false);
      } else {
        toast.error(res.data.error || 'Send failed');
      }
    } catch (err) { toast.error('WhatsApp send failed'); }
  };

  const handleTriggerAlertCheck = async () => {
    try {
      const res = await api.post('/templates/alerts/trigger-check');
      if (res.data.alerts_triggered > 0) {
        toast.success(`${res.data.alerts_triggered} alerts triggered! Emails sent.`);
      } else {
        toast.info('No alerts triggered. All metrics within threshold.');
      }
      loadAlerts();
    } catch (err) { toast.error('Alert check failed'); }
  };

  const insertVariable = (variable) => {
    const fieldMap = { en: 'content', hi: 'content_hindi', mr: 'content_marathi', gu: 'content_gujarati', ta: 'content_tamil' };
    const field = fieldMap[activeLang] || 'content';
    setFormData(prev => ({
      ...prev,
      [field]: prev[field] + variable,
      variables: prev.variables.includes(variable.replace(/[{}]/g, '')) ? prev.variables : [...prev.variables, variable.replace(/[{}]/g, '')]
    }));
  };

  const getContentField = (lang) => ({ en: 'content', hi: 'content_hindi', mr: 'content_marathi', gu: 'content_gujarati', ta: 'content_tamil' })[lang] || 'content';

  // Render Tabs
  const renderApprovals = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Pending Approvals ({pendingApprovals.length})</h2>
        <Button variant="outline" size="sm" onClick={loadPendingApprovals}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>
      {pendingApprovals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border">
          <CheckSquare className="h-12 w-12 mx-auto text-green-300 mb-2" />
          <p className="text-slate-500">No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingApprovals.map(approval => (
            <div key={approval.approval_id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-medium">{approval.template_name}</h3>
                  <p className="text-sm text-slate-500">{approval.category} • Submitted by {approval.submitted_by_email}</p>
                  {approval.note && <p className="text-sm text-slate-600 mt-1">Note: {approval.note}</p>}
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">Pending</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded text-sm mb-3 font-mono">
                {approval.content_snapshot}
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Add review note..."
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => handleApprove(approval.template_id)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRequestChanges(approval.template_id)}>
                    <MessageCircle className="h-4 w-4 mr-1" />Request Changes
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(approval.template_id)}>
                    <XSquare className="h-4 w-4 mr-1" />Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderQueue = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Queued', value: notificationQueue?.stats?.queued || 0, color: 'bg-blue-500' },
          { label: 'Sent (7d)', value: notificationQueue?.stats?.sent || 0, color: 'bg-green-500' },
          { label: 'Failed', value: notificationQueue?.stats?.failed || 0, color: 'bg-red-500' },
          { label: 'Total', value: notificationQueue?.stats?.total || 0, color: 'bg-slate-500' }
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <div className={`w-3 h-3 rounded-full ${stat.color} mb-2`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Pending Queue */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Pending Notifications
          </h3>
          <Button variant="outline" size="sm" onClick={loadNotificationQueue}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {notificationQueue?.pending?.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No pending notifications</div>
        ) : (
          <div className="divide-y">
            {notificationQueue?.pending?.map(item => (
              <div key={item.queue_id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.template_name}</p>
                  <p className="text-sm text-slate-500">{item.recipient} • {item.category}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSendNow(item.queue_id)}>
                    <PlayCircle className="h-4 w-4 mr-1" />Send Now
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCancelQueued(item.queue_id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send History */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500" />
            Recent Send History (7 days)
          </h3>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {notificationQueue?.history?.slice(0, 20).map(item => (
            <div key={item.queue_id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{item.template_name}</p>
                <p className="text-slate-500">{item.recipient}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                item.status === 'sent' ? 'bg-green-100 text-green-700' :
                item.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-orange-500" />Template Analytics
        </h2>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <Button key={d} size="sm" variant={chartDays === d ? "default" : "outline"} onClick={() => setChartDays(d)} className={chartDays === d ? 'bg-orange-500' : ''}>
              {d}d
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={loadChartData}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <Send className="h-6 w-6 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{chartData.summary?.total?.toLocaleString() || analyticsData?.total_sent?.toLocaleString() || 0}</p>
          <p className="text-sm text-slate-500">Total Sent ({chartDays}d)</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{chartData.summary?.sent?.toLocaleString() || 0}</p>
          <p className="text-sm text-slate-500">Delivered</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
          <p className="text-2xl font-bold">{chartData.summary?.failed?.toLocaleString() || 0}</p>
          <p className="text-sm text-slate-500">Failed</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <TrendingUp className="h-6 w-6 text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{chartData.summary?.success_rate || 0}%</p>
          <p className="text-sm text-slate-500">Success Rate</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Line Chart - Daily Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />Daily Delivery Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.line}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }}
                  labelFormatter={(v) => `Date: ${v}`}
                />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#22c55e" strokeWidth={2} name="Sent" dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} name="Failed" dot={false} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart - Category Comparison */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />Category Performance
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.bar} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" width={80} tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff' }}
                  formatter={(v, name) => [v, name === 'success_rate' ? `${v}%` : v]}
                />
                <Legend />
                <Bar dataKey="sent" fill="#22c55e" name="Sent" radius={[0, 4, 4, 0]} />
                <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Legacy Stats Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Languages className="h-5 w-5 text-purple-500" />Language Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(analyticsData?.language_stats || {}).map(([code, data]) => (
              <div key={code} className="flex items-center gap-3">
                <span className="text-lg">{LANGUAGE_CONFIG[code]?.flag}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">{LANGUAGE_CONFIG[code]?.native || code}</span>
                    <span className="text-sm text-slate-500">{data.percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${data.percentage}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />Top Templates
          </h3>
          <div className="space-y-2">
            {analyticsData?.top_templates?.slice(0, 5).map((t, i) => (
              <div key={t.template_id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.name}</p></div>
                <span className="text-sm font-semibold">{t.usage_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderScheduled = () => (
    <div className="space-y-6">
      {scheduledTemplates && Object.entries(scheduledTemplates).map(([type, templates]) => templates.length > 0 && (
        <div key={type} className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b">
            <h3 className="font-medium flex items-center gap-2">
              {type === 'before_event' && <Bell className="h-4 w-4 text-blue-500" />}
              {type === 'after_event' && <Clock className="h-4 w-4 text-green-500" />}
              {type === 'fixed_time' && <Timer className="h-4 w-4 text-purple-500" />}
              {scheduleTypes.find(s => s.id === type)?.name || type}
              <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">{templates.length}</span>
            </h3>
          </div>
          <div className="divide-y">
            {templates.map(t => (
              <div key={t.template_id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-slate-500">
                    {t.schedule_type === 'before_event' && `${t.schedule_offset} ${t.schedule_unit} before`}
                    {t.schedule_type === 'after_event' && `${t.schedule_offset} ${t.schedule_unit} after`}
                    {t.schedule_type === 'fixed_time' && `Daily at ${t.schedule_time}`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleConfigureSchedule(t)}><Settings className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {(!scheduledTemplates || Object.values(scheduledTemplates).every(t => t.length === 0)) && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border">
          <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500">No scheduled templates</p>
        </div>
      )}
    </div>
  );

  // Phase 4 Render Functions
  const renderLibrary = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs mb-1">Category</Label>
            <select value={libraryFilters.category} onChange={(e) => setLibraryFilters({ ...libraryFilters, category: e.target.value })} className="px-3 py-2 border rounded-lg">
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex-1 max-w-md">
            <Label className="text-xs mb-1">Search</Label>
            <Input placeholder="Search templates..." value={libraryFilters.search} onChange={(e) => setLibraryFilters({ ...libraryFilters, search: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs mb-1">Sort By</Label>
            <select value={libraryFilters.sort} onChange={(e) => setLibraryFilters({ ...libraryFilters, sort: e.target.value })} className="px-3 py-2 border rounded-lg">
              <option value="popularity">Popularity</option>
              <option value="downloads">Downloads</option>
              <option value="rating">Rating</option>
              <option value="name">Name</option>
            </select>
          </div>
          <Button variant="outline" onClick={loadLibrary}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Library Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {libraryTemplates.map(template => (
          <div key={template.library_id} className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded text-xs text-white ${CATEGORY_CONFIG[template.category]?.color || 'bg-slate-500'}`}>
                  {template.category?.toUpperCase()}
                </span>
                {template.is_featured && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />}
              </div>
              <h3 className="font-semibold mb-1">{template.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mb-3">{template.description}</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {template.tags?.slice(0, 3).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{tag}</span>
                ))}
              </div>
              <div className="flex justify-between items-center text-sm text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Download className="h-3 w-3" />{template.downloads}</span>
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" />{template.rating}</span>
                </div>
                <span className="text-xs text-purple-500">{template.popularity}% popular</span>
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                const content = template.content?.replace(/<[^>]*>/g, '').substring(0, 200);
                alert(`Preview:\n\n${content}...`);
              }}>
                <Eye className="h-4 w-4 mr-1" />Preview
              </Button>
              <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={() => handleImportLibraryTemplate(template.library_id)}>
                <Download className="h-4 w-4 mr-1" />Import
              </Button>
            </div>
          </div>
        ))}
      </div>

      {libraryTemplates.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border">
          <Package className="h-12 w-12 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500">No templates found in library</p>
        </div>
      )}
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Performance Alerts</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTriggerAlertCheck} className="border-purple-500 text-purple-600 hover:bg-purple-50">
            <PlayCircle className="h-4 w-4 mr-2" />Run Check Now
          </Button>
          <Button onClick={() => openAlertDialog()} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />Configure Alert
          </Button>
        </div>
      </div>

      {/* WhatsApp Status Card */}
      {whatsappStatus && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PhoneCall className="h-8 w-8" />
              <div>
                <h3 className="font-semibold">WhatsApp Integration</h3>
                <p className="text-sm opacity-90">
                  Status: {whatsappStatus.status} | Provider: {whatsappStatus.provider?.toUpperCase()}
                  {whatsappStatus.mock_mode && <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">MOCK MODE</span>}
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowWhatsAppDialog(true)} className="bg-white text-green-600 hover:bg-green-50">
              <Send className="h-4 w-4 mr-1" />Send Test
            </Button>
          </div>
        </div>
      )}

      {/* Alert Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <Bell className="h-6 w-6 text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{alerts.length}</p>
          <p className="text-sm text-slate-500">Active Alerts</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <AlertTriangle className="h-6 w-6 text-yellow-500 mb-2" />
          <p className="text-2xl font-bold">{alertHistory.length}</p>
          <p className="text-sm text-slate-500">Triggered (7d)</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <Gauge className="h-6 w-6 text-green-500 mb-2" />
          <p className="text-2xl font-bold">{alerts.filter(a => a.metric === 'delivery_rate').length}</p>
          <p className="text-sm text-slate-500">Delivery Alerts</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
          <Activity className="h-6 w-6 text-purple-500 mb-2" />
          <p className="text-2xl font-bold">{alerts.filter(a => a.metric === 'open_rate').length}</p>
          <p className="text-sm text-slate-500">Open Rate Alerts</p>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Active Alert Rules</h3>
          <Button variant="outline" size="sm" onClick={loadAlerts}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Bell className="h-12 w-12 mx-auto text-slate-300 mb-2" />
            No alerts configured
          </div>
        ) : (
          <div className="divide-y">
            {alerts.map(alert => (
              <div key={alert.alert_id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {alert.metric.replace('_', ' ').toUpperCase()}
                    <span className={`px-2 py-0.5 text-xs rounded ${alert.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                      {alert.is_active ? 'Active' : 'Paused'}
                    </span>
                  </p>
                  <p className="text-sm text-slate-500">
                    Alert when {alert.comparison} {alert.threshold}%
                    {alert.template_id && ` • Template: ${alert.template_id}`}
                  </p>
                  <p className="text-xs text-slate-400">Triggered {alert.trigger_count} times</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteAlert(alert.alert_id)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert History */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />Alert History (7 days)
          </h3>
        </div>
        <div className="max-h-60 overflow-y-auto divide-y">
          {alertHistory.length === 0 ? (
            <p className="p-4 text-center text-slate-500 text-sm">No alerts triggered recently</p>
          ) : alertHistory.map((h, i) => (
            <div key={i} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{h.metric?.replace('_', ' ')}</p>
                <p className="text-slate-500">Value: {h.actual_value}% (threshold: {h.threshold}%)</p>
              </div>
              <span className="text-xs text-slate-400">{new Date(h.triggered_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDelivery = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: deliveryReports.stats.total || 0, color: 'bg-slate-500', icon: Send },
          { label: 'Delivered', value: deliveryReports.stats.delivered || 0, color: 'bg-green-500', icon: CheckCircle2 },
          { label: 'Opened', value: deliveryReports.stats.opened || 0, color: 'bg-blue-500', icon: Eye },
          { label: 'Clicked', value: deliveryReports.stats.clicked || 0, color: 'bg-purple-500', icon: ExternalLink },
          { label: 'Failed', value: deliveryReports.stats.failed || 0, color: 'bg-red-500', icon: AlertTriangle },
          { label: 'Bounced', value: deliveryReports.stats.bounced || 0, color: 'bg-orange-500', icon: AlertOctagon }
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-xl p-4 border">
            <stat.icon className={`h-5 w-5 ${stat.color.replace('bg-', 'text-')} mb-2`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Rates */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />Delivery Rate
          </h3>
          <div className="text-center py-4">
            <p className="text-5xl font-bold text-green-500">{deliveryReports.stats.delivery_rate || 0}%</p>
            <p className="text-sm text-slate-500 mt-2">Messages Successfully Delivered</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />Open Rate
          </h3>
          <div className="text-center py-4">
            <p className="text-5xl font-bold text-blue-500">{deliveryReports.stats.open_rate || 0}%</p>
            <p className="text-sm text-slate-500 mt-2">Recipients Opened Messages</p>
          </div>
        </div>
      </div>

      {/* Recent Reports */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Recent Delivery Reports (7 days)</h3>
          <Button variant="outline" size="sm" onClick={loadDeliveryReports}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {deliveryReports.reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-2" />
            No delivery reports yet
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y">
            {deliveryReports.reports.slice(0, 50).map(report => (
              <div key={report.report_id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{report.message_id?.substring(0, 20)}...</p>
                  <p className="text-slate-500">{report.provider || 'Unknown'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    report.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    report.status === 'opened' ? 'bg-blue-100 text-blue-700' :
                    report.status === 'clicked' ? 'bg-purple-100 text-purple-700' :
                    report.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100'
                  }`}>{report.status}</span>
                  <span className="text-xs text-slate-400">{new Date(report.received_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-7 w-7 text-orange-500" />
            Template Settings
          </h1>
          <p className="text-slate-500 mt-1">Multi-language templates with scheduling, approvals & AI suggestions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDefaults}><Download className="h-4 w-4 mr-2" />Defaults</Button>
          <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" />Add</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {[
          { id: 'templates', label: 'Templates', icon: FileText },
          { id: 'library', label: 'Library', icon: BookOpen },
          { id: 'approvals', label: 'Approvals', icon: Shield, badge: pendingApprovals.length },
          { id: 'queue', label: 'Queue', icon: Send },
          { id: 'delivery', label: 'Delivery', icon: Activity },
          { id: 'alerts', label: 'Alerts', icon: Bell },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'scheduled', label: 'Scheduled', icon: Calendar },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${activeTab === tab.id ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <tab.icon className="h-4 w-4" />{tab.label}
            {tab.badge > 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'approvals' && renderApprovals()}
      {activeTab === 'queue' && renderQueue()}
      {activeTab === 'analytics' && renderAnalytics()}
      {activeTab === 'scheduled' && renderScheduled()}
      {activeTab === 'library' && renderLibrary()}
      {activeTab === 'alerts' && renderAlerts()}
      {activeTab === 'delivery' && renderDelivery()}

      {activeTab === 'templates' && (
        <>
          {/* Category Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const catStats = stats?.[key] || { total: 0, active: 0 };
              const isActive = activeCategory === key;
              return (
                <button key={key} onClick={() => setActiveCategory(key)} className={`p-4 rounded-xl border-2 text-left ${isActive ? `border-orange-500 ${config.bgLight}` : 'border-slate-200 hover:border-orange-300'}`}>
                  <div className="flex justify-between mb-2">
                    <div className={`p-2 rounded-lg ${config.color}`}><config.icon className="h-5 w-5 text-white" /></div>
                    <span className={`text-xs px-2 py-1 rounded-full ${isActive ? 'bg-orange-500 text-white' : 'bg-slate-100'}`}>{catStats.total}</span>
                  </div>
                  <h3 className="font-semibold">{config.label}</h3>
                  <p className="text-xs text-green-600">{catStats.active} active</p>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
              Show inactive
            </label>
            <Button variant="outline" size="sm" onClick={loadTemplates}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          </div>

          {/* Templates List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500" /></div>
            ) : templates.length === 0 ? (
              <div className="p-12 text-center"><FileText className="h-12 w-12 mx-auto text-slate-300" /><p className="mt-2 text-slate-500">No templates</p></div>
            ) : (
              <div className="divide-y">
                {templates.map(template => (
                  <div key={template.template_id} className={`p-4 hover:bg-slate-50 ${!template.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium">{template.name}</h3>
                          {template.is_active ? <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Active</span> : <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100">Inactive</span>}
                          {template.approval_status && APPROVAL_STATUS[template.approval_status] && (
                            <span className={`px-2 py-0.5 text-xs rounded-full ${APPROVAL_STATUS[template.approval_status].color}`}>
                              {APPROVAL_STATUS[template.approval_status].label}
                            </span>
                          )}
                          {template.schedule_type && template.schedule_type !== 'immediate' && <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700"><Clock className="h-3 w-3 inline mr-1" />Scheduled</span>}
                          {template.is_variant && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700"><GitBranch className="h-3 w-3 inline mr-1" />Variant</span>}
                          {template.has_variants && <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">Has Variants</span>}
                          {template.version && <span className="text-xs text-slate-400">v{template.version}</span>}
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-1">{template.content?.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                        <div className="flex gap-1 mt-1">
                          {template.content && <span className="text-xs">🇬🇧</span>}
                          {template.content_hindi && <span className="text-xs">🇮🇳</span>}
                          {template.content_marathi && <span className="text-xs">🏛️</span>}
                          {template.content_gujarati && <span className="text-xs">🦁</span>}
                          {template.content_tamil && <span className="text-xs">🏺</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={() => handlePreview(template)} title="Preview"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(template)} title="Edit"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => openSandboxDialog(template)} title="Sandbox Test"><TestTube2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleViewHistory(template)} title="History"><History className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleGetAISuggestions(template)} title="AI Suggestions"><Sparkles className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleConfigureSchedule(template)} title="Schedule"><Calendar className="h-4 w-4" /></Button>
                        {!template.is_variant && <Button variant="ghost" size="sm" onClick={() => handleCreateVariant(template)} title="A/B Variant"><GitBranch className="h-4 w-4" /></Button>}
                        {(template.is_variant || template.has_variants) && <Button variant="ghost" size="sm" onClick={() => handleViewABStats(template)} title="A/B Stats"><BarChart3 className="h-4 w-4" /></Button>}
                        {template.approval_status !== 'pending_approval' && template.approval_status !== 'approved' && (
                          <Button variant="ghost" size="sm" onClick={() => handleSubmitForApproval(template)} title="Submit for Approval"><Shield className="h-4 w-4" /></Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                        <Button variant={template.is_active ? "ghost" : "default"} size="sm" onClick={() => handleToggleActive(template)} className={template.is_active ? '' : 'bg-green-500 text-white'}>
                          {template.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(template)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={() => { setShowCreateDialog(false); setShowEditDialog(false); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <div className="grid lg:grid-cols-3 gap-6 py-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><Label>Category</Label><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg" disabled={showEditDialog}>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Trigger Event</Label><select value={formData.trigger_event} onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">-- Select --</option>
                  {triggerEvents.filter(e => e.category.includes(formData.category)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
                <div><Label>Schedule</Label><select value={formData.schedule_type} onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  {scheduleTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              </div>
              {(formData.category === 'email' || formData.category === 'payment') && (
                <div><Label>Subject</Label><Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} /></div>
              )}
              <div>
                <Label className="flex items-center gap-2 mb-2"><Languages className="h-4 w-4" />Content</Label>
                <div className="flex gap-1 mb-2 flex-wrap">
                  {Object.entries(LANGUAGE_CONFIG).map(([code, lang]) => (
                    <button key={code} onClick={() => setActiveLang(code)} className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${activeLang === code ? 'bg-orange-500 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
                      {lang.flag} {lang.native}
                    </button>
                  ))}
                </div>
                <textarea value={formData[getContentField(activeLang)]} onChange={(e) => setFormData({ ...formData, [getContentField(activeLang)]: e.target.value })} rows={formData.category === 'email' ? 10 : 5} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" placeholder={`${LANGUAGE_CONFIG[activeLang]?.name} content...`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Priority</Label><Input type="number" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })} /></div>
                <div className="flex items-end"><label className="flex items-center gap-2"><input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="rounded h-5 w-5" />Active</label></div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-3"><Hash className="h-4 w-4 inline mr-1" />Variables</h4>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {Object.entries(templateVariables).map(([group, vars]) => (
                  <div key={group}>
                    <h5 className="text-xs font-medium text-slate-500 uppercase mb-1">{group}</h5>
                    <div className="flex flex-wrap gap-1">
                      {vars.map((v, i) => <button key={i} type="button" onClick={() => insertVariable(v)} className="px-2 py-1 text-xs bg-white border rounded hover:bg-orange-50 font-mono">{v}</button>)}
                    </div>
                  </div>
                ))}
              </div>
              {bestPractices && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium mb-2 flex items-center gap-1"><Lightbulb className="h-4 w-4 text-yellow-500" />Tips</h4>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {bestPractices.tips?.slice(0, 4).map((tip, i) => <li key={i}>• {tip}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); }}>Cancel</Button>
            <Button onClick={() => handleSaveTemplate(showEditDialog)} className="bg-orange-500 hover:bg-orange-600">{showEditDialog ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle><History className="h-5 w-5 inline mr-2" />Version History</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            {versionHistory.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No version history</p>
            ) : versionHistory.map(v => (
              <div key={v.version_id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-semibold">Version {v.version}</span>
                    <p className="text-sm text-slate-500">{v.created_by_email} • {new Date(v.created_at).toLocaleString()}</p>
                    {v.change_note && <p className="text-sm mt-1">{v.change_note}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRollback(v.version)}><RotateCcw className="h-4 w-4 mr-1" />Rollback</Button>
                </div>
                <div className="text-xs bg-slate-50 p-2 rounded font-mono line-clamp-2">{v.snapshot?.content?.substring(0, 150)}...</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Suggestions Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle><Sparkles className="h-5 w-5 inline mr-2 text-purple-500" />AI Suggestions</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="flex gap-2 mb-4">
              {['improve', 'shorten', 'emoji', 'formal', 'casual'].map(type => (
                <button key={type} onClick={() => { setAiSuggestionType(type); handleGetAISuggestions(selectedTemplate); }} className={`px-3 py-1.5 rounded-lg text-sm ${aiSuggestionType === type ? 'bg-purple-500 text-white' : 'bg-slate-100'}`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            {!aiSuggestions ? (
              <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" /><p className="mt-2 text-slate-500">Getting AI suggestions...</p></div>
            ) : aiSuggestions.ai_available === false ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 mb-4">{aiSuggestions.message}</p>
                {aiSuggestions.suggestions?.map((s, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <h4 className="font-medium flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-500" />{s.title}</h4>
                    <p className="text-sm text-slate-600 mt-1">{s.suggestion}</p>
                    {s.example && <code className="text-xs bg-slate-100 p-2 rounded block mt-2">{s.example}</code>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">{aiSuggestions.ai_response}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* A/B Stats Dialog */}
      <Dialog open={showABDialog} onOpenChange={setShowABDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle><Beaker className="h-5 w-5 inline mr-2" />A/B Test Results</DialogTitle></DialogHeader>
          {abStats && (
            <div className="py-4 space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex justify-between mb-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Original (A)</span>
                  {abStats.winner === abStats.original?.template_id && <span className="text-green-600 text-sm flex items-center"><Award className="h-4 w-4 mr-1" />Winner</span>}
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div><p className="text-2xl font-bold">{abStats.original?.sent_count}</p><p className="text-xs text-slate-500">Sent</p></div>
                  <div><p className="text-2xl font-bold">{abStats.original?.delivery_rate}%</p><p className="text-xs text-slate-500">Delivered</p></div>
                  <div><p className="text-2xl font-bold">{abStats.original?.open_rate}%</p><p className="text-xs text-slate-500">Opened</p></div>
                  <div><p className="text-2xl font-bold text-green-600">{abStats.original?.conversion_rate}%</p><p className="text-xs text-slate-500">Converted</p></div>
                </div>
              </div>
              {abStats.variants?.map((v, i) => (
                <div key={v.template_id} className="p-4 border rounded-lg">
                  <div className="flex justify-between mb-3">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Variant {String.fromCharCode(66 + i)}</span>
                    {abStats.winner === v.template_id && <span className="text-green-600 text-sm flex items-center"><Award className="h-4 w-4 mr-1" />Winner</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div><p className="text-2xl font-bold">{v.sent_count}</p><p className="text-xs text-slate-500">Sent</p></div>
                    <div><p className="text-2xl font-bold">{v.delivery_rate}%</p><p className="text-xs text-slate-500">Delivered</p></div>
                    <div><p className="text-2xl font-bold">{v.open_rate}%</p><p className="text-xs text-slate-500">Opened</p></div>
                    <div><p className="text-2xl font-bold text-green-600">{v.conversion_rate}%</p><p className="text-xs text-slate-500">Converted</p></div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant={v.ab_test_active ? "destructive" : "default"} onClick={() => handleToggleABTest(v)}>{v.ab_test_active ? 'Stop Test' : 'Start Test'}</Button>
                  </div>
                </div>
              ))}
              <div className="p-3 bg-slate-100 rounded-lg"><p className="text-sm"><Target className="h-4 w-4 inline mr-2 text-orange-500" /><strong>Recommendation:</strong> {abStats.recommendation}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle><Calendar className="h-5 w-5 inline mr-2" />Configure Schedule</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Schedule Type</Label>
              <select value={formData.schedule_type} onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg mt-1">
                {scheduleTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {formData.schedule_type === 'fixed_time' && (
              <div><Label>Time</Label><Input type="time" value={formData.schedule_time} onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })} className="mt-1" /></div>
            )}
            {(formData.schedule_type === 'before_event' || formData.schedule_type === 'after_event') && (
              <div><Label>Offset</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="number" value={formData.schedule_offset} onChange={(e) => setFormData({ ...formData, schedule_offset: parseInt(e.target.value) })} className="w-24" min={1} max={168} />
                  <select value={formData.schedule_unit} onChange={(e) => setFormData({ ...formData, schedule_unit: e.target.value })} className="flex-1 px-3 py-2 border rounded-lg">
                    <option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSchedule} className="bg-purple-500 hover:bg-purple-600">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle><Eye className="h-5 w-5 inline mr-2" />Preview</DialogTitle></DialogHeader>
          {previewContent && (
            <div className="py-4">
              <div className="mb-4"><span className={`px-2 py-1 rounded text-xs text-white ${CATEGORY_CONFIG[previewContent.category]?.color}`}>{previewContent.category?.toUpperCase()}</span></div>
              {previewContent.subject && <div className="mb-4 p-3 bg-slate-100 rounded-lg"><Label className="text-xs">Subject</Label><p className="font-medium">{previewContent.subject}</p></div>}
              <div className="border rounded-lg overflow-hidden">
                {previewContent.category === 'email' || previewContent.category === 'payment' ? (
                  <iframe srcDoc={previewContent.content} title="Preview" className="w-full h-[500px] bg-white" />
                ) : (
                  <div className="p-4 bg-slate-50 whitespace-pre-wrap">{previewContent.content}</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-600"><AlertTriangle className="h-5 w-5 inline mr-2" />Delete?</DialogTitle></DialogHeader>
          <p className="py-4">Delete &quot;{selectedTemplate?.name}&quot;?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sandbox Test Dialog */}
      <Dialog open={showSandboxDialog} onOpenChange={setShowSandboxDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle><TestTube2 className="h-5 w-5 inline mr-2 text-purple-500" />Sandbox Test</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700">
                <strong>Template:</strong> {selectedTemplate?.name}<br />
                <strong>Category:</strong> {selectedTemplate?.category?.toUpperCase()}
              </p>
            </div>
            <div>
              <Label>Test Recipient *</Label>
              <Input 
                value={sandboxRecipient} 
                onChange={(e) => setSandboxRecipient(e.target.value)} 
                placeholder={selectedTemplate?.category === 'email' ? 'email@example.com' : '+91XXXXXXXXXX'}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                {selectedTemplate?.category === 'email' ? 'Enter email address' : 'Enter phone number'}
              </p>
            </div>
            <div>
              <Label>Language</Label>
              <select value={sandboxLanguage} onChange={(e) => setSandboxLanguage(e.target.value)} className="w-full px-3 py-2 border rounded-lg mt-1">
                {Object.entries(LANGUAGE_CONFIG).map(([code, lang]) => (
                  <option key={code} value={code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>
            {sandboxHistory.length > 0 && (
              <div>
                <Label className="mb-2 block">Recent Tests</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                  {sandboxHistory.slice(0, 5).map(test => (
                    <div key={test.test_id} className="p-2 text-sm flex justify-between items-center">
                      <div>
                        <p className="font-medium">{test.test_recipient}</p>
                        <p className="text-xs text-slate-500">{test.language} • {new Date(test.tested_at).toLocaleString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs ${test.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                        {test.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSandboxDialog(false)}>Cancel</Button>
            <Button onClick={handleSandboxTest} className="bg-purple-500 hover:bg-purple-600">
              <PlayCircle className="h-4 w-4 mr-2" />Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Configuration Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><Bell className="h-5 w-5 inline mr-2 text-orange-500" />Configure Alert</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedTemplate && (
              <div className="p-3 bg-orange-50 rounded-lg text-sm">
                <strong>Template:</strong> {selectedTemplate.name}
              </div>
            )}
            <div>
              <Label>Metric *</Label>
              <select value={alertConfig.metric} onChange={(e) => setAlertConfig({ ...alertConfig, metric: e.target.value })} className="w-full px-3 py-2 border rounded-lg mt-1">
                <option value="delivery_rate">Delivery Rate</option>
                <option value="open_rate">Open Rate</option>
                <option value="click_rate">Click Rate</option>
                <option value="bounce_rate">Bounce Rate</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Comparison</Label>
                <select value={alertConfig.comparison} onChange={(e) => setAlertConfig({ ...alertConfig, comparison: e.target.value })} className="w-full px-3 py-2 border rounded-lg mt-1">
                  <option value="below">Falls Below</option>
                  <option value="above">Goes Above</option>
                </select>
              </div>
              <div>
                <Label>Threshold (%)</Label>
                <Input 
                  type="number" 
                  value={alertConfig.threshold} 
                  onChange={(e) => setAlertConfig({ ...alertConfig, threshold: parseInt(e.target.value) || 0 })}
                  min={0} max={100}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Notify Emails (comma separated)</Label>
              <Input 
                value={alertConfig.notify_emails} 
                onChange={(e) => setAlertConfig({ ...alertConfig, notify_emails: e.target.value })}
                placeholder="admin@example.com, team@example.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAlertDialog(false)}>Cancel</Button>
            <Button onClick={handleConfigureAlert} className="bg-orange-500 hover:bg-orange-600">
              <Bell className="h-4 w-4 mr-2" />Save Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Send Dialog */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle><PhoneCall className="h-5 w-5 inline mr-2 text-green-500" />Send WhatsApp Message</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {whatsappStatus?.mock_mode && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Mock Mode Active - Messages won&apos;t be delivered to real numbers
              </div>
            )}
            <div>
              <Label>Phone Number *</Label>
              <Input 
                value={whatsappPhone} 
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">Include country code (e.g., +91 for India)</p>
            </div>
            <div>
              <Label>Template</Label>
              <select 
                value={whatsappTemplate} 
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mt-1"
              >
                <option value="booking_confirmation">Booking Confirmation</option>
                <option value="payment_reminder">Payment Reminder</option>
                <option value="flight_reminder">Flight Reminder</option>
                <option value="complaint_update">Complaint Update</option>
                <option value="discount_code">Discount Code</option>
                <option value="otp_verification">OTP Verification</option>
              </select>
            </div>
            <div>
              <Label>Variables (JSON format)</Label>
              <textarea
                value={JSON.stringify(whatsappVariables, null, 2)}
                onChange={(e) => {
                  try {
                    setWhatsappVariables(JSON.parse(e.target.value));
                  } catch (err) { /* ignore parse errors while typing */ }
                }}
                placeholder='{"customer_name": "John", "booking_id": "BK-123"}'
                className="w-full px-3 py-2 border rounded-lg mt-1 h-24 font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>Cancel</Button>
            <Button onClick={handleSendWhatsApp} className="bg-green-500 hover:bg-green-600">
              <Send className="h-4 w-4 mr-2" />Send WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
