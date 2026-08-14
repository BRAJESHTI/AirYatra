import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Edit2, Trash2, Check, X, RefreshCw, 
  Search, Filter, Shield, AlertTriangle, Clock, Hash,
  ChevronDown, ChevronUp, Settings, Eye, EyeOff, Calendar,
  FileCheck, Building2, Users, Plane, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Category icons and colors
const categoryConfig = {
  customer: { icon: Users, color: 'blue', label: 'Customer' },
  pilot: { icon: Shield, color: 'purple', label: 'Pilot' },
  aircraft: { icon: Plane, color: 'cyan', label: 'Aircraft' },
  employee: { icon: Briefcase, color: 'green', label: 'Employee' }
};

function DocumentTypeMaster() {
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [expandedType, setExpandedType] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    name_hi: '',
    category: 'customer',
    code: '',
    description: '',
    required_fields: ['document_number'],
    has_expiry: false,
    expiry_alert_days: 30,
    verification_api: '',
    is_mandatory: false,
    is_active: true,
    display_order: 100
  });

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const loadDocumentTypes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/documents/types?active_only=false`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDocumentTypes(data.document_types || []);
    } catch (error) {
      toast.error('Failed to load document types');
    } finally {
      setLoading(false);
    }
  };

  const seedDefaults = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/admin/documents/seed-defaults`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast.success(`Created ${data.document_types_created} document types, ${data.verification_apis_created} APIs`);
      loadDocumentTypes();
    } catch (error) {
      toast.error('Failed to seed defaults');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      toast.error('Name and Code are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingType 
        ? `${API_URL}/api/admin/documents/types/${editingType.id}`
        : `${API_URL}/api/admin/documents/types`;
      
      const res = await fetch(url, {
        method: editingType ? 'PUT' : 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save');
      }

      toast.success(editingType ? 'Document type updated!' : 'Document type created!');
      setShowAddModal(false);
      setEditingType(null);
      resetForm();
      loadDocumentTypes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (typeId) => {
    if (!window.confirm('Deactivate this document type?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/admin/documents/types/${typeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Document type deactivated');
      loadDocumentTypes();
    } catch (error) {
      toast.error('Failed to deactivate');
    }
  };

  const toggleActive = async (type) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/admin/documents/types/${type.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !type.is_active })
      });
      toast.success(`Document type ${type.is_active ? 'deactivated' : 'activated'}`);
      loadDocumentTypes();
    } catch (error) {
      toast.error('Failed to toggle status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      name_hi: '',
      category: 'customer',
      code: '',
      description: '',
      required_fields: ['document_number'],
      has_expiry: false,
      expiry_alert_days: 30,
      verification_api: '',
      is_mandatory: false,
      is_active: true,
      display_order: 100
    });
  };

  const openEditModal = (type) => {
    setFormData({
      name: type.name || '',
      name_hi: type.name_hi || '',
      category: type.category || 'customer',
      code: type.code || '',
      description: type.description || '',
      required_fields: type.required_fields || ['document_number'],
      has_expiry: type.has_expiry || false,
      expiry_alert_days: type.expiry_alert_days || 30,
      verification_api: type.verification_api || '',
      is_mandatory: type.is_mandatory || false,
      is_active: type.is_active !== false,
      display_order: type.display_order || 100
    });
    setEditingType(type);
    setShowAddModal(true);
  };

  const filteredTypes = documentTypes.filter(type => {
    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      type.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group by category for stats
  const stats = {
    total: documentTypes.length,
    active: documentTypes.filter(t => t.is_active).length,
    byCategory: Object.keys(categoryConfig).reduce((acc, cat) => {
      acc[cat] = documentTypes.filter(t => t.category === cat).length;
      return acc;
    }, {})
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-400" />
            Document Type Master</h2>
          <p className="text-slate-400 mt-1">Manage document types for all categories</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={seedDefaults} variant="outline" className="border-slate-600">
            <Settings className="h-4 w-4 mr-2" /> Seed Defaults
          </Button>
          <Button onClick={() => { resetForm(); setEditingType(null); setShowAddModal(true); }} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" /> Add Type
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <FileText className="h-5 w-5" />
            <span className="text-sm">Total Types</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-green-400">{stats.active} active</p>
        </div>
        
        {Object.entries(categoryConfig).map(([cat, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`bg-slate-800/50 rounded-xl p-4 border transition-all text-left ${
                selectedCategory === cat ? `border-${config.color}-500` : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className={`flex items-center gap-2 text-${config.color}-400 mb-2`}>
                <Icon className="h-5 w-5" />
                <span className="text-sm">{config.label.split('/')[0]}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.byCategory[cat] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or code..."
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All ({stats.total})
          </button>
          {Object.entries(categoryConfig).map(([cat, config]) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {config.label.split('/')[0]} ({stats.byCategory[cat] || 0})
            </button>
          ))}
        </div>
        
        <Button onClick={loadDocumentTypes} variant="outline" className="border-slate-600">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Document Types List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        ) : filteredTypes.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
            <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No document types found</p>
            <p className="text-slate-500 text-sm mt-2">Click &quot;Seed Defaults&quot; to create standard document types</p>
          </div>
        ) : (
          filteredTypes.map(type => {
            const catConfig = categoryConfig[type.category] || categoryConfig.customer;
            const CatIcon = catConfig.icon;
            const isExpanded = expandedType === type.id;
            
            return (
              <div 
                key={type.id}
                className={`bg-slate-800/50 rounded-xl border transition-all ${
                  type.is_active ? 'border-slate-700' : 'border-red-500/30 opacity-60'
                }`}
              >
                {/* Main Row */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/80"
                  onClick={() => setExpandedType(isExpanded ? null : type.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${catConfig.color}-500/20`}>
                      <CatIcon className={`h-6 w-6 text-${catConfig.color}-400`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{type.name}</h3>
                        {type.is_mandatory && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">Required</span>
                        )}
                        {!type.is_active && (
                          <span className="px-2 py-0.5 bg-slate-600 text-slate-400 rounded text-xs">Inactive</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm flex items-center gap-3 mt-1">
                        <span className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded">{type.code}</span>
                        <span>{catConfig.label}</span>
                        {type.has_expiry && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Clock className="h-3 w-3" /> Expires (Alert: {type.expiry_alert_days}d)
                          </span>
                        )}
                        {type.verification_api && (
                          <span className="flex items-center gap-1 text-green-400">
                            <Shield className="h-3 w-3" /> Auto-Verify
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openEditModal(type); }}
                      className="border-slate-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); toggleActive(type); }}
                      className={type.is_active ? 'border-red-500 text-red-400' : 'border-green-500 text-green-400'}
                    >
                      {type.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-700 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Required Fields</p>
                        <div className="flex flex-wrap gap-1">
                          {(type.required_fields || []).map((field, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                              {field.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Verification API</p>
                        <p className="text-white">
                          {type.verification_api || <span className="text-slate-500">Not configured</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Display Order</p>
                        <p className="text-white">{type.display_order || 100}</p>
                      </div>
                    </div>
                    {type.description && (
                      <div className="mt-3">
                        <p className="text-slate-400 text-sm mb-1">Description</p>
                        <p className="text-slate-300">{type.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {editingType ? 'Edit Document Type' : 'Add Document Type'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingType(null); }} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Name (English) *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Aadhar Card"
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                    required
                  />
                </div>
                <div>
                  <Label className="text-white">Name (Hindi)</Label>
                  <Input
                    value={formData.name_hi}
                    onChange={(e) => setFormData({...formData, name_hi: e.target.value})}
                    placeholder="e.g., Aadhar Card"
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Category *</Label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  >
                    {Object.entries(categoryConfig).map(([cat, config]) => (
                      <option key={cat} value={cat}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-white">Unique Code * (Auto uppercase)</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase().replace(/\s/g, '_')})}
                    placeholder="e.g., AADHAR"
                    className="mt-1 bg-slate-800 border-slate-600 text-white font-mono"
                    required
                    disabled={editingType}
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-white">Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Brief description..."
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              
              <div>
                <Label className="text-white">Required Fields (comma-separated)</Label>
                <Input
                  value={formData.required_fields.join(', ')}
                  onChange={(e) => setFormData({...formData, required_fields: e.target.value.split(',').map(f => f.trim().toLowerCase().replace(/\s/g, '_')).filter(f => f)})}
                  placeholder="e.g., document_number, expiry_date, name"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
                <p className="text-xs text-slate-500 mt-1">Common: document_number, expiry_date, issue_date, name, account_number, ifsc_code</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Verification API Code</Label>
                  <Input
                    value={formData.verification_api}
                    onChange={(e) => setFormData({...formData, verification_api: e.target.value.toUpperCase()})}
                    placeholder="e.g., AADHAR_KYC, PAN_VERIFY"
                    className="mt-1 bg-slate-800 border-slate-600 text-white font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Leave empty if no auto-verification</p>
                </div>
                <div>
                  <Label className="text-white">Display Order</Label>
                  <Input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({...formData, display_order: parseInt(e.target.value) || 100})}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_expiry}
                    onChange={(e) => setFormData({...formData, has_expiry: e.target.checked})}
                    className="rounded border-slate-600"
                  />
                  <span className="text-white text-sm">Has Expiry Date</span>
                </label>
                
                {formData.has_expiry && (
                  <div>
                    <Label className="text-white text-sm">Alert Days</Label>
                    <Input
                      type="number"
                      value={formData.expiry_alert_days}
                      onChange={(e) => setFormData({...formData, expiry_alert_days: parseInt(e.target.value) || 30})}
                      className="mt-1 bg-slate-800 border-slate-600 text-white h-8"
                    />
                  </div>
                )}
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({...formData, is_mandatory: e.target.checked})}
                    className="rounded border-slate-600"
                  />
                  <span className="text-white text-sm">Mandatory</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="rounded border-slate-600"
                  />
                  <span className="text-white text-sm">Active</span>
                </label>
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button type="button" onClick={() => { setShowAddModal(false); setEditingType(null); }} variant="outline" className="flex-1 border-slate-600">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">
                  {editingType ? 'Update Type' : 'Create Type'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentTypeMaster;
