import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, Mail, CreditCard, Phone, Plus, Edit, Trash2, 
  Power, PowerOff, Copy, Eye, RefreshCw, Loader2, Search, 
  ChevronDown, Check, X, FileText, Zap, Send, Download,
  Settings, AlertTriangle, CheckCircle2, Clock, Hash
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

export default function TemplateSettings() {
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  
  // Template variables and events
  const [templateVariables, setTemplateVariables] = useState({});
  const [triggerEvents, setTriggerEvents] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'sms',
    subject: '',
    content: '',
    content_hindi: '',
    variables: [],
    trigger_event: '',
    is_active: true,
    priority: 0
  });

  // Load template variables
  const loadVariables = useCallback(async () => {
    try {
      const res = await api.get('/templates/variables');
      setTemplateVariables(res.data.variables || {});
      setTriggerEvents(res.data.trigger_events || []);
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

  useEffect(() => {
    loadVariables();
  }, [loadVariables]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handlers
  const handleCreate = () => {
    setFormData({
      name: '',
      category: activeCategory,
      subject: '',
      content: '',
      content_hindi: '',
      variables: [],
      trigger_event: '',
      is_active: true,
      priority: 0
    });
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
      variables: template.variables || [],
      trigger_event: template.trigger_event || '',
      is_active: template.is_active,
      priority: template.priority || 0
    });
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

  const insertVariable = (variable) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content + variable,
      variables: prev.variables.includes(variable.replace(/[{}]/g, '')) 
        ? prev.variables 
        : [...prev.variables, variable.replace(/[{}]/g, '')]
    }));
  };

  const CategoryIcon = CATEGORY_CONFIG[activeCategory]?.icon || FileText;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Settings className="h-7 w-7 text-orange-500" />
            Template Settings / टेम्पलेट सेटिंग्स
          </h1>
          <p className="text-slate-500 mt-1">Manage notification templates for SMS, WhatsApp, Email & Payments</p>
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
          Show inactive templates
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
          <span className="text-sm text-slate-500">
            {CATEGORY_CONFIG[activeCategory]?.description}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500" />
            <p className="mt-2 text-slate-500">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-slate-300" />
            <p className="mt-2 text-slate-500">No templates found</p>
            <Button onClick={handleCreate} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Template
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {templates.map((template) => (
              <div
                key={template.template_id}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                  !template.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-slate-800 dark:text-white truncate">
                        {template.name}
                      </h3>
                      {template.is_active ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                          <PowerOff className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                      {template.priority > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
                          Priority: {template.priority}
                        </span>
                      )}
                    </div>
                    
                    {template.trigger_event && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                        <Zap className="h-3 w-3" />
                        Trigger: {template.trigger_event.replace(/_/g, ' ')}
                      </div>
                    )}
                    
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {template.content?.replace(/<[^>]*>/g, '').substring(0, 150)}...
                    </p>
                    
                    {template.variables?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.variables.slice(0, 5).map((v, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded font-mono">
                            {`{{${v}}}`}
                          </span>
                        ))}
                        {template.variables.length > 5 && (
                          <span className="text-xs text-slate-400">+{template.variables.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(template)}
                      title="Preview"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(template)}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={template.is_active ? "ghost" : "default"}
                      size="sm"
                      onClick={() => handleToggleActive(template)}
                      title={template.is_active ? "Deactivate" : "Activate"}
                      className={template.is_active ? '' : 'bg-green-500 hover:bg-green-600 text-white'}
                    >
                      {template.is_active ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template)}
                      title="Delete"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
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

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={() => {
        setShowCreateDialog(false);
        setShowEditDialog(false);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {showEditDialog ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {showEditDialog ? 'Edit Template / टेम्पलेट संपादित करें' : 'Create Template / नया टेम्पलेट'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            {/* Form Column */}
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template Name / नाम *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Booking Confirmation SMS"
                  />
                </div>
                <div>
                  <Label>Category / श्रेणी *</Label>
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

              {(formData.category === 'email' || formData.category === 'payment') && (
                <div>
                  <Label>Subject Line / विषय</Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g., ✈️ Booking Confirmed - {{booking_id}}"
                  />
                </div>
              )}

              <div>
                <Label>Trigger Event / ट्रिगर इवेंट</Label>
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
                <Label>Content (English) / सामग्री *</Label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={formData.category === 'email' ? 12 : 6}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 font-mono text-sm"
                  placeholder={formData.category === 'email' 
                    ? '<!DOCTYPE html>\n<html>...' 
                    : 'Enter template content with {{variables}}...'}
                />
              </div>

              <div>
                <Label>Content (Hindi) / हिंदी सामग्री</Label>
                <textarea
                  value={formData.content_hindi}
                  onChange={(e) => setFormData({ ...formData, content_hindi: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                  placeholder="Hindi version (optional)..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority / प्राथमिकता</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    placeholder="0-100 (higher = used first)"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-slate-300 h-5 w-5"
                    />
                    <span>Active / सक्रिय</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Variables Panel */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Available Variables
              </h4>
              <p className="text-xs text-slate-500 mb-3">Click to insert into content</p>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {Object.entries(templateVariables).map(([group, vars]) => (
                  <div key={group}>
                    <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">
                      {group.replace(/_/g, ' ')}
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {vars.map((v, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded hover:bg-orange-50 hover:border-orange-300 transition-colors font-mono"
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
              {showEditDialog ? 'Update Template' : 'Create Template'}
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
              <div className="mb-4">
                <span className={`px-2 py-1 rounded text-xs text-white ${CATEGORY_CONFIG[previewContent.category]?.color}`}>
                  {previewContent.category?.toUpperCase()}
                </span>
                <span className="ml-2 text-slate-600">{previewContent.name}</span>
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
                    title="Email Preview"
                    className="w-full h-[500px] bg-white"
                  />
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 whitespace-pre-wrap font-mono text-sm">
                    {previewContent.content}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              if (selectedTemplate) handleEdit(selectedTemplate);
              setShowPreviewDialog(false);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
              This action cannot be undone.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
