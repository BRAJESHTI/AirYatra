import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, Mail, CreditCard, Phone, Plus, Edit, Trash2, 
  Power, PowerOff, Copy, Eye, RefreshCw, Loader2, Search, 
  ChevronDown, Check, X, FileText, Zap, Send, Download,
  Settings, AlertTriangle, CheckCircle2, Clock, Hash, Globe,
  BarChart3, TrendingUp, Calendar, GitBranch, Beaker, Languages,
  Timer, Bell, ArrowRight, Award, Target, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

const CATEGORY_CONFIG = {
  sms: { 
    label: 'SMS Templates', 
    icon: Phone, 
    color: 'bg-green-500', 
    bgLight: 'bg-green-50',
    description: 'Short text messages for mobile notifications'
  },
  whatsapp: { 
    label: 'WhatsApp Templates', 
    icon: MessageSquare, 
    color: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    description: 'Rich messaging templates with formatting'
  },
  email: { 
    label: 'Email Templates', 
    icon: Mail, 
    color: 'bg-blue-500',
    bgLight: 'bg-blue-50',
    description: 'HTML email templates with branding'
  },
  payment: { 
    label: 'Payment Templates', 
    icon: CreditCard, 
    color: 'bg-purple-500',
    bgLight: 'bg-purple-50',
    description: 'Receipts and payment notifications'
  }
};

const LANGUAGE_CONFIG = {
  en: { name: 'English', native: 'English', flag: '🇬🇧' },
  hi: { name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  mr: { name: 'Marathi', native: 'मराठी', flag: '🏛️' },
  gu: { name: 'Gujarati', native: 'ગુજરાતી', flag: '🦁' },
  ta: { name: 'Tamil', native: 'தமிழ்', flag: '🏺' }
};

export default function TemplateSettings() {
  const [activeTab, setActiveTab] = useState('templates'); // templates, analytics, ab-testing, scheduled
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [abStats, setAbStats] = useState(null);
  const [scheduledTemplates, setScheduledTemplates] = useState(null);
  
  // Template variables and events
  const [templateVariables, setTemplateVariables] = useState({});
  const [triggerEvents, setTriggerEvents] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [scheduleTypes, setScheduleTypes] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'sms',
    subject: '',
    content: '',
    content_hindi: '',
    content_marathi: '',
    content_gujarati: '',
    content_tamil: '',
    variables: [],
    trigger_event: '',
    is_active: true,
    priority: 0,
    schedule_type: 'immediate',
    schedule_offset: 24,
    schedule_unit: 'hours',
    schedule_time: '09:00'
  });
  
  const [activeLang, setActiveLang] = useState('en');

  // Load template variables
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

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/templates/list', {
          params: {
            category: activeCategory,
            search: searchQuery || undefined,
            is_active: showInactive ? undefined : true,
            limit: 100
          }
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

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await api.get('/templates/analytics/overview?days=30');
      setAnalyticsData(res.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  // Load scheduled templates
  const loadScheduled = useCallback(async () => {
    try {
      const res = await api.get('/templates/scheduled');
      setScheduledTemplates(res.data.scheduled_templates);
    } catch (err) {
      console.error('Failed to load scheduled:', err);
    }
  }, []);

  useEffect(() => {
    loadVariables();
  }, [loadVariables]);

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'analytics') {
      loadAnalytics();
    } else if (activeTab === 'scheduled') {
      loadScheduled();
    }
  }, [activeTab, loadTemplates, loadAnalytics, loadScheduled]);

  // Handlers
  const handleCreate = () => {
    setFormData({
      name: '',
      category: activeCategory,
      subject: '',
      content: '',
      content_hindi: '',
      content_marathi: '',
      content_gujarati: '',
      content_tamil: '',
      variables: [],
      trigger_event: '',
      is_active: true,
      priority: 0,
      schedule_type: 'immediate',
      schedule_offset: 24,
      schedule_unit: 'hours',
      schedule_time: '09:00'
    });
    setActiveLang('en');
    setShowCreateDialog(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      subject: template.subject || '',
      content: template.content,
      content_hindi: template.content_hindi || '',
      content_marathi: template.content_marathi || '',
      content_gujarati: template.content_gujarati || '',
      content_tamil: template.content_tamil || '',
      variables: template.variables || [],
      trigger_event: template.trigger_event || '',
      is_active: template.is_active,
      priority: template.priority || 0,
      schedule_type: template.schedule_type || 'immediate',
      schedule_offset: template.schedule_offset || 24,
      schedule_unit: template.schedule_unit || 'hours',
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
    } catch (err) {
      toast.error('Failed to generate preview');
    }
  };

  const handleToggleActive = async (template) => {
    try {
      await api.patch(`/templates/${template.template_id}/toggle`);
      toast.success(template.is_active ? 'Template deactivated' : 'Template activated');
      loadTemplates();
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  const handleDelete = (template) => {
    setSelectedTemplate(template);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/templates/${selectedTemplate.template_id}`);
      toast.success('Template deleted');
      setShowDeleteDialog(false);
      loadTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handleSaveTemplate = async (isEdit = false) => {
    try {
      if (isEdit) {
        await api.put(`/templates/${selectedTemplate.template_id}`, formData);
        toast.success('Template updated');
        setShowEditDialog(false);
      } else {
        await api.post('/templates/create', formData);
        toast.success('Template created');
        setShowCreateDialog(false);
      }
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save template');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await api.post('/templates/seed-defaults');
      toast.success(`Created ${res.data.created} default templates`);
      loadTemplates();
    } catch (err) {
      toast.error('Failed to seed templates');
    }
  };

  const handleDuplicate = async (template) => {
    const newName = prompt('Enter name for duplicated template:', `${template.name} (Copy)`);
    if (!newName) return;
    
    try {
      await api.post(`/templates/duplicate/${template.template_id}?new_name=${encodeURIComponent(newName)}`);
      toast.success('Template duplicated');
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to duplicate template');
    }
  };

  // A/B Testing handlers
  const handleCreateVariant = async (template) => {
    const variantName = prompt('Enter variant name:', `${template.name} - Variant B`);
    if (!variantName) return;
    
    try {
      await api.post(`/templates/${template.template_id}/create-variant?variant_name=${encodeURIComponent(variantName)}`);
      toast.success('A/B variant created');
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create variant');
    }
  };

  const handleToggleABTest = async (template, percentage = 50) => {
    try {
      const res = await api.patch(`/templates/${template.template_id}/ab-test/toggle?percentage=${percentage}`);
      toast.success(res.data.message);
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to toggle A/B test');
    }
  };

  const handleViewABStats = async (template) => {
    try {
      const parentId = template.parent_template_id || template.template_id;
      const res = await api.get(`/templates/${parentId}/ab-stats`);
      setAbStats(res.data);
      setSelectedTemplate(template);
      setShowABDialog(true);
    } catch (err) {
      toast.error('Failed to load A/B stats');
    }
  };

  // Schedule handlers
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
      const params = new URLSearchParams({
        schedule_type: formData.schedule_type
      });
      
      if (formData.schedule_type !== 'immediate') {
        if (formData.schedule_type === 'fixed_time') {
          params.append('schedule_time', formData.schedule_time);
        } else {
          params.append('schedule_offset', formData.schedule_offset);
          params.append('schedule_unit', formData.schedule_unit);
        }
      }
      
      await api.post(`/templates/${selectedTemplate.template_id}/schedule?${params.toString()}`);
      toast.success('Schedule configured');
      setShowScheduleDialog(false);
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to configure schedule');
    }
  };

  const insertVariable = (variable) => {
    const fieldMap = {
      en: 'content',
      hi: 'content_hindi',
      mr: 'content_marathi',
      gu: 'content_gujarati',
      ta: 'content_tamil'
    };
    const field = fieldMap[activeLang] || 'content';
    
    setFormData(prev => ({
      ...prev,
      [field]: prev[field] + variable,
      variables: prev.variables.includes(variable.replace(/[{}]/g, '')) 
        ? prev.variables 
        : [...prev.variables, variable.replace(/[{}]/g, '')]
    }));
  };

  const getContentField = (lang) => {
    const fieldMap = {
      en: 'content',
      hi: 'content_hindi',
      mr: 'content_marathi',
      gu: 'content_gujarati',
      ta: 'content_tamil'
    };
    return fieldMap[lang] || 'content';
  };

  const CategoryIcon = CATEGORY_CONFIG[activeCategory]?.icon || FileText;

  // Render Analytics Tab
  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {analyticsData?.total_sent?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-slate-500">Total Sent (30d)</p>
            </div>
          </div>
        </div>
        
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const catStats = analyticsData?.category_stats?.[key] || {};
          return (
            <div key={key} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${config.bgLight} rounded-lg`}>
                  <Icon className={`h-5 w-5 ${config.color.replace('bg-', 'text-')}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">
                    {catStats.total_usage?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-slate-500">{config.label.replace(' Templates', '')}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Trend Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" />
          Usage Trend (Last 30 Days)
        </h3>
        <div className="h-64 flex items-end gap-1">
          {analyticsData?.usage_trend?.slice(-30).map((day, i) => {
            const total = day.sms + day.whatsapp + day.email + day.payment;
            const maxHeight = 200;
            const height = Math.max(10, (total / 500) * maxHeight);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-gradient-to-t from-orange-500 to-orange-300 rounded-t transition-all hover:from-orange-600 hover:to-orange-400"
                  style={{ height: `${height}px` }}
                  title={`${day.date}: ${total} messages`}
                />
                {i % 5 === 0 && (
                  <span className="text-xs text-slate-400 rotate-45 origin-left">
                    {day.date.slice(5)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Language Distribution & Top Templates */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Language Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Languages className="h-5 w-5 text-purple-500" />
            Language Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(analyticsData?.language_stats || {}).map(([code, data]) => (
              <div key={code} className="flex items-center gap-3">
                <span className="text-lg">{LANGUAGE_CONFIG[code]?.flag}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{LANGUAGE_CONFIG[code]?.native || code}</span>
                    <span className="text-sm text-slate-500">{data.percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                      style={{ width: `${data.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Templates */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Top Performing Templates
          </h3>
          <div className="space-y-3">
            {analyticsData?.top_templates?.slice(0, 5).map((template, i) => (
              <div key={template.template_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-slate-100 text-slate-700' :
                  i === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-50 text-slate-500'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{template.name}</p>
                  <p className="text-xs text-slate-500">{template.category}</p>
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {template.usage_count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Render Scheduled Templates Tab
  const renderScheduled = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Scheduled Templates</h2>
          <p className="text-sm text-slate-500">Templates configured to send at specific times</p>
        </div>
        <Button variant="outline" onClick={loadScheduled}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {scheduledTemplates && Object.entries(scheduledTemplates).map(([type, templates]) => (
        templates.length > 0 && (
          <div key={type} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-medium flex items-center gap-2">
                {type === 'before_event' && <Bell className="h-4 w-4 text-blue-500" />}
                {type === 'after_event' && <Clock className="h-4 w-4 text-green-500" />}
                {type === 'fixed_time' && <Timer className="h-4 w-4 text-purple-500" />}
                {type === 'immediate' && <Zap className="h-4 w-4 text-yellow-500" />}
                {scheduleTypes.find(s => s.id === type)?.name || type}
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  {templates.length}
                </span>
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {templates.map(template => (
                <div key={template.template_id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <p className="text-sm text-slate-500">
                        {template.schedule_type === 'before_event' && 
                          `${template.schedule_offset} ${template.schedule_unit} before event`}
                        {template.schedule_type === 'after_event' && 
                          `${template.schedule_offset} ${template.schedule_unit} after event`}
                        {template.schedule_type === 'fixed_time' && 
                          `Daily at ${template.schedule_time}`}
                        {template.trigger_event && ` • Trigger: ${template.trigger_event}`}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleConfigureSchedule(template)}>
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {(!scheduledTemplates || Object.values(scheduledTemplates).every(t => t.length === 0)) && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No scheduled templates configured</p>
          <p className="text-sm text-slate-400 mt-1">Edit any template and configure scheduling</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="h-7 w-7 text-orange-500" />
            Template Settings / टेम्पलेट सेटिंग्स
          </h1>
          <p className="text-slate-500 mt-1">Manage notification templates with scheduling, A/B testing & multi-language</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDefaults}>
            <Download className="h-4 w-4 mr-2" />
            Load Defaults
          </Button>
          <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {[
          { id: 'templates', label: 'Templates', icon: FileText },
          { id: 'analytics', label: 'Usage Analytics', icon: BarChart3 },
          { id: 'scheduled', label: 'Scheduled', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-orange-500 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && renderAnalytics()}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && renderScheduled()}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              const catStats = stats?.[key] || { total: 0, active: 0, inactive: 0 };
              const isActive = activeCategory === key;
              
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isActive 
                      ? `border-orange-500 ${config.bgLight} dark:bg-slate-800`
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isActive ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {catStats.total} total
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">{config.label}</h3>
                  <div className="flex gap-3 mt-1 text-xs">
                    <span className="text-green-600">{catStats.active} active</span>
                    <span className="text-slate-400">{catStats.inactive} inactive</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show inactive
            </label>
            <Button variant="outline" size="sm" onClick={loadTemplates}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Templates List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <CategoryIcon className={`h-5 w-5 ${CATEGORY_CONFIG[activeCategory]?.color.replace('bg-', 'text-')}`} />
              <h2 className="font-semibold text-slate-800 dark:text-white">
                {CATEGORY_CONFIG[activeCategory]?.label}
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500" />
              </div>
            ) : templates.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-slate-300" />
                <p className="mt-2 text-slate-500">No templates found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {templates.map((template) => (
                  <div
                    key={template.template_id}
                    className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                      !template.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-slate-800 dark:text-white">
                            {template.name}
                          </h3>
                          {template.is_active ? (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500">
                              Inactive
                            </span>
                          )}
                          {template.schedule_type && template.schedule_type !== 'immediate' && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Scheduled
                            </span>
                          )}
                          {template.is_variant && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              A/B Variant
                            </span>
                          )}
                          {template.ab_test_active && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                              <Beaker className="h-3 w-3" />
                              Testing
                            </span>
                          )}
                          {template.has_variants && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                              Has Variants
                            </span>
                          )}
                        </div>
                        
                        {template.trigger_event && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                            <Zap className="h-3 w-3" />
                            {template.trigger_event.replace(/_/g, ' ')}
                          </div>
                        )}
                        
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
                          {template.content?.replace(/<[^>]*>/g, '').substring(0, 100)}...
                        </p>

                        {/* Language indicators */}
                        <div className="flex gap-1 mt-2">
                          {template.content && <span className="text-xs" title="English">🇬🇧</span>}
                          {template.content_hindi && <span className="text-xs" title="Hindi">🇮🇳</span>}
                          {template.content_marathi && <span className="text-xs" title="Marathi">🏛️</span>}
                          {template.content_gujarati && <span className="text-xs" title="Gujarati">🦁</span>}
                          {template.content_tamil && <span className="text-xs" title="Tamil">🏺</span>}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={() => handlePreview(template)} title="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(template)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleConfigureSchedule(template)} title="Schedule">
                          <Calendar className="h-4 w-4" />
                        </Button>
                        {!template.is_variant && (
                          <Button variant="ghost" size="sm" onClick={() => handleCreateVariant(template)} title="Create A/B Variant">
                            <GitBranch className="h-4 w-4" />
                          </Button>
                        )}
                        {(template.is_variant || template.has_variants) && (
                          <Button variant="ghost" size="sm" onClick={() => handleViewABStats(template)} title="A/B Stats">
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)} title="Duplicate">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={template.is_active ? "ghost" : "default"}
                          size="sm"
                          onClick={() => handleToggleActive(template)}
                          className={template.is_active ? '' : 'bg-green-500 hover:bg-green-600 text-white'}
                        >
                          {template.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={() => {
        setShowCreateDialog(false);
        setShowEditDialog(false);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {showEditDialog ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {showEditDialog ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
            {/* Form Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Booking Confirmation SMS"
                  />
                </div>
                <div>
                  <Label>Category *</Label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                    disabled={showEditDialog}
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trigger Event</Label>
                  <select
                    value={formData.trigger_event}
                    onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="">-- Select Trigger --</option>
                    {triggerEvents
                      .filter(e => e.category.includes(formData.category))
                      .map(event => (
                        <option key={event.id} value={event.id}>{event.name}</option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <Label>Schedule Type</Label>
                  <select
                    value={formData.schedule_type}
                    onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                  >
                    {scheduleTypes.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule Configuration */}
              {formData.schedule_type !== 'immediate' && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Label className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Schedule Configuration
                  </Label>
                  {formData.schedule_type === 'fixed_time' ? (
                    <Input
                      type="time"
                      value={formData.schedule_time}
                      onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                      className="mt-2"
                    />
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="number"
                        value={formData.schedule_offset}
                        onChange={(e) => setFormData({ ...formData, schedule_offset: parseInt(e.target.value) })}
                        className="w-24"
                        min={1}
                        max={168}
                      />
                      <select
                        value={formData.schedule_unit}
                        onChange={(e) => setFormData({ ...formData, schedule_unit: e.target.value })}
                        className="px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                      <span className="flex items-center text-sm text-slate-500">
                        {formData.schedule_type === 'before_event' ? 'before event' : 'after event'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {(formData.category === 'email' || formData.category === 'payment') && (
                <div>
                  <Label>Subject Line</Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., Booking Confirmed - {{booking_id}}"
                  />
                </div>
              )}

              {/* Language Tabs */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Languages className="h-4 w-4" />
                  Content (Multi-Language)
                </Label>
                <div className="flex gap-1 mb-2 flex-wrap">
                  {Object.entries(LANGUAGE_CONFIG).map(([code, lang]) => (
                    <button
                      key={code}
                      onClick={() => setActiveLang(code)}
                      className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition-colors ${
                        activeLang === code
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      {lang.native}
                    </button>
                  ))}
                </div>
                <textarea
                  value={formData[getContentField(activeLang)]}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    [getContentField(activeLang)]: e.target.value 
                  })}
                  rows={formData.category === 'email' ? 10 : 5}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 font-mono text-sm"
                  placeholder={`Enter ${LANGUAGE_CONFIG[activeLang]?.name} content...`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded h-5 w-5"
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Variables Panel */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Variables
              </h4>
              <p className="text-xs text-slate-500 mb-3">Click to insert</p>
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {Object.entries(templateVariables).map(([group, vars]) => (
                  <div key={group}>
                    <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">
                      {group}
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {vars.map((v, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border rounded hover:bg-orange-50 hover:border-orange-300 font-mono"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); }}>
              Cancel
            </Button>
            <Button onClick={() => handleSaveTemplate(showEditDialog)} className="bg-orange-500 hover:bg-orange-600">
              {showEditDialog ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* A/B Stats Dialog */}
      <Dialog open={showABDialog} onOpenChange={setShowABDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-purple-500" />
              A/B Test Results
            </DialogTitle>
          </DialogHeader>
          
          {abStats && (
            <div className="py-4 space-y-4">
              {/* Original */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Original (A)</span>
                    <span className="font-medium">{abStats.original?.name}</span>
                  </div>
                  {abStats.winner === abStats.original?.template_id && (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <Award className="h-4 w-4" />
                      Winner
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold">{abStats.original?.sent_count}</p>
                    <p className="text-xs text-slate-500">Sent</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{abStats.original?.delivery_rate}%</p>
                    <p className="text-xs text-slate-500">Delivered</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{abStats.original?.open_rate}%</p>
                    <p className="text-xs text-slate-500">Opened</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{abStats.original?.conversion_rate}%</p>
                    <p className="text-xs text-slate-500">Converted</p>
                  </div>
                </div>
              </div>

              {/* Variants */}
              {abStats.variants?.map((variant, i) => (
                <div key={variant.template_id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Variant {String.fromCharCode(66 + i)}</span>
                      <span className="font-medium">{variant.name}</span>
                      {variant.ab_test_active && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">Testing</span>
                      )}
                    </div>
                    {abStats.winner === variant.template_id && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <Award className="h-4 w-4" />
                        Winner
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold">{variant.sent_count}</p>
                      <p className="text-xs text-slate-500">Sent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{variant.delivery_rate}%</p>
                      <p className="text-xs text-slate-500">Delivered</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{variant.open_rate}%</p>
                      <p className="text-xs text-slate-500">Opened</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{variant.conversion_rate}%</p>
                      <p className="text-xs text-slate-500">Converted</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant={variant.ab_test_active ? "destructive" : "default"}
                      onClick={() => handleToggleABTest(variant)}
                    >
                      {variant.ab_test_active ? 'Stop Test' : 'Start Test'}
                    </Button>
                  </div>
                </div>
              ))}

              {/* Recommendation */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-500" />
                  <strong>Recommendation:</strong> {abStats.recommendation}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowABDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Configure Schedule
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <Label>Schedule Type</Label>
              <select
                value={formData.schedule_type}
                onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 mt-1"
              >
                {scheduleTypes.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {scheduleTypes.find(s => s.id === formData.schedule_type)?.description}
              </p>
            </div>

            {formData.schedule_type === 'fixed_time' && (
              <div>
                <Label>Time of Day</Label>
                <Input
                  type="time"
                  value={formData.schedule_time}
                  onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            )}

            {(formData.schedule_type === 'before_event' || formData.schedule_type === 'after_event') && (
              <div>
                <Label>Offset</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    value={formData.schedule_offset}
                    onChange={(e) => setFormData({ ...formData, schedule_offset: parseInt(e.target.value) })}
                    className="w-24"
                    min={1}
                    max={168}
                  />
                  <select
                    value={formData.schedule_unit}
                    onChange={(e) => setFormData({ ...formData, schedule_unit: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Template will be sent {formData.schedule_offset} {formData.schedule_unit} {formData.schedule_type === 'before_event' ? 'before' : 'after'} the event
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveSchedule} className="bg-purple-500 hover:bg-purple-600">
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Template Preview
            </DialogTitle>
          </DialogHeader>
          
          {previewContent && (
            <div className="py-4">
              <div className="mb-4 flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs text-white ${CATEGORY_CONFIG[previewContent.category]?.color}`}>
                  {previewContent.category?.toUpperCase()}
                </span>
                <span className="text-slate-600">{previewContent.name}</span>
              </div>
              
              {previewContent.subject && (
                <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Label className="text-xs text-slate-500">Subject</Label>
                  <p className="font-medium">{previewContent.subject}</p>
                </div>
              )}
              
              <div className="border rounded-lg overflow-hidden">
                {previewContent.category === 'email' || previewContent.category === 'payment' ? (
                  <iframe
                    srcDoc={previewContent.content}
                    title="Preview"
                    className="w-full h-[500px] bg-white"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 whitespace-pre-wrap">
                    {previewContent.content}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Template?
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-slate-600">
              Are you sure you want to delete <strong>&quot;{selectedTemplate?.name}&quot;</strong>?
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
