import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plus, Edit, Trash2, Eye, Save, X, Check, 
  Globe, Clock, CheckCircle2, AlertCircle, Copy, History,
  ChevronDown, ChevronRight, Loader2, RefreshCw, Search,
  BookOpen, Shield, Scale, FileCheck, Scroll
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '../../services/api';
import { toast } from 'sonner';

/**
 * Document Type Icons
 */
const DOC_ICONS = {
  terms_conditions: Scale,
  refund_policy: FileCheck,
  privacy_policy: Shield,
  operator_agreement: FileText,
  booking_terms: BookOpen,
  safety_guidelines: AlertCircle,
  cookie_policy: Globe
};

/**
 * Legal Documents Admin Component
 * Allows admins to create, edit, and manage legal documents with rich text editor
 */
export default function LegalDocsAdmin() {
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [activeType, setActiveType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Editor state
  const [editorData, setEditorData] = useState({
    doc_type: '',
    title: '',
    content: '',
    version: '1.0',
    effective_date: '',
    is_draft: true,
    language: 'en'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesRes, docsRes] = await Promise.all([
        api.get('/legal-documents/types'),
        api.get('/legal-documents/admin/list?include_drafts=true')
      ]);

      if (typesRes.data.success) {
        setDocumentTypes(typesRes.data.types || []);
      }
      if (docsRes.data.success) {
        setDocuments(docsRes.data.documents || []);
        setStats(docsRes.data.stats || {});
      }
    } catch (err) {
      toast.error('Failed to load documents');
    }
    setLoading(false);
  };

  const handleCreateNew = (docType = '') => {
    setEditorData({
      doc_type: docType,
      title: '',
      content: '',
      version: '1.0',
      effective_date: '',
      is_draft: true,
      language: 'en'
    });
    setSelectedDoc(null);
    setShowEditor(true);
  };

  const handleEdit = (doc) => {
    setEditorData({
      doc_type: doc.doc_type,
      title: doc.title,
      content: doc.content,
      version: doc.version,
      effective_date: doc.effective_date || '',
      is_draft: doc.is_draft,
      language: doc.language || 'en'
    });
    setSelectedDoc(doc);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editorData.doc_type || !editorData.title || !editorData.content) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (selectedDoc) {
        // Update existing
        await api.put(`/legal-documents/admin/${selectedDoc.id}`, editorData);
        toast.success('Document updated');
      } else {
        // Create new
        await api.post('/legal-documents/admin/create', editorData);
        toast.success('Document created');
      }
      setShowEditor(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save document');
    }
  };

  const handlePublish = async (docId) => {
    try {
      await api.post(`/legal-documents/admin/${docId}/publish`);
      toast.success('Document published');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to publish');
    }
  };

  const handleUnpublish = async (docId) => {
    try {
      await api.post(`/legal-documents/admin/${docId}/unpublish`);
      toast.success('Document moved to drafts');
      loadData();
    } catch (err) {
      toast.error('Failed to unpublish');
    }
  };

  const handleNewVersion = async (docId) => {
    const currentDoc = documents.find(d => d.id === docId);
    if (!currentDoc) return;

    const currentVersion = parseFloat(currentDoc.version) || 1.0;
    const newVersion = (currentVersion + 1.0).toFixed(1);

    try {
      const res = await api.post(`/legal-documents/admin/${docId}/new-version?new_version=${newVersion}`);
      if (res.data.success) {
        toast.success(`Version ${newVersion} created`);
        loadData();
        // Open editor for new version
        const newDoc = documents.find(d => d.id === res.data.document_id);
        if (newDoc) handleEdit(newDoc);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create new version');
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    try {
      await api.delete(`/legal-documents/admin/${docId}`);
      toast.success('Document deleted');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const filteredDocs = documents.filter(doc => {
    if (activeType !== 'all' && doc.doc_type !== activeType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        doc.title?.toLowerCase().includes(term) ||
        doc.doc_type?.toLowerCase().includes(term) ||
        doc.version?.includes(term)
      );
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Scroll className="h-6 w-6 text-orange-500" />
            Legal Documents Management
          </h2>
          <p className="text-sm text-slate-500">
            Manage Terms & Conditions, Refund Policy, Privacy Policy, and more
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => handleCreateNew()} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {documentTypes.map(type => {
          const stat = stats[type.id] || { published: 0, drafts: 0 };
          const Icon = DOC_ICONS[type.id] || FileText;
          const isActive = activeType === type.id;

          return (
            <div
              key={type.id}
              onClick={() => setActiveType(isActive ? 'all' : type.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                isActive 
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                  : 'bg-white dark:bg-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`h-5 w-5 mb-2 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
              <p className="text-xs font-medium truncate">{type.name}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-green-600">{stat.published} pub</span>
                <span className="text-xs text-slate-400">{stat.drafts} draft</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border">
          <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold">No Documents Found</h3>
          <p className="text-sm text-slate-400 mt-1">
            {searchTerm ? 'Try a different search' : 'Create your first legal document'}
          </p>
          <Button onClick={() => handleCreateNew()} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />Create Document
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map(doc => {
            const Icon = DOC_ICONS[doc.doc_type] || FileText;

            return (
              <div
                key={doc.id}
                className="p-4 bg-white dark:bg-slate-800 rounded-xl border hover:border-orange-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${doc.is_draft ? 'bg-yellow-50' : 'bg-green-50'}`}>
                      <Icon className={`h-5 w-5 ${doc.is_draft ? 'text-yellow-600' : 'text-green-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{doc.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                          v{doc.version}
                        </span>
                        {doc.is_draft ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                            Draft
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            Published
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{doc.type_name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {doc.is_draft ? 'Last updated' : 'Published'}: {formatDate(doc.is_draft ? doc.updated_at : doc.published_at)}
                        {doc.language && doc.language !== 'en' && (
                          <span className="ml-2">• {doc.language.toUpperCase()}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setShowPreview(true);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(doc)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {doc.is_draft ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => handlePublish(doc.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />Publish
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleNewVersion(doc.id)}
                        >
                          <Copy className="h-4 w-4 mr-1" />New Version
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUnpublish(doc.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDoc ? 'Edit Document' : 'Create New Document'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Document Type *</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-lg bg-white dark:bg-slate-800"
                  value={editorData.doc_type}
                  onChange={(e) => setEditorData({ ...editorData, doc_type: e.target.value })}
                  disabled={!!selectedDoc}
                >
                  <option value="">Select type...</option>
                  {documentTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Version</Label>
                <Input
                  value={editorData.version}
                  onChange={(e) => setEditorData({ ...editorData, version: e.target.value })}
                  placeholder="1.0"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Title *</Label>
              <Input
                value={editorData.title}
                onChange={(e) => setEditorData({ ...editorData, title: e.target.value })}
                placeholder="AirYatra Terms & Conditions"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Language</Label>
                <select
                  className="w-full mt-1 p-2 border rounded-lg bg-white dark:bg-slate-800"
                  value={editorData.language}
                  onChange={(e) => setEditorData({ ...editorData, language: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="mr">Marathi</option>
                </select>
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={editorData.effective_date}
                  onChange={(e) => setEditorData({ ...editorData, effective_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Content * (HTML supported)</Label>
              <textarea
                className="w-full mt-1 p-3 border rounded-lg bg-white dark:bg-slate-800 min-h-[300px] font-mono text-sm"
                value={editorData.content}
                onChange={(e) => setEditorData({ ...editorData, content: e.target.value })}
                placeholder="<h1>Document Title</h1>
<p>Your content here...</p>
<h2>Section 1</h2>
<ul>
  <li>Point 1</li>
  <li>Point 2</li>
</ul>"
              />
              <p className="text-xs text-slate-400 mt-1">
                Tip: Use HTML tags like &lt;h1&gt;, &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt; for formatting
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_draft"
                checked={editorData.is_draft}
                onChange={(e) => setEditorData({ ...editorData, is_draft: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="is_draft">Save as Draft (uncheck to publish immediately)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">
              <Save className="h-4 w-4 mr-2" />
              {selectedDoc ? 'Update' : 'Create'} Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {selectedDoc?.title}
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">v{selectedDoc?.version}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div 
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedDoc?.content || '' }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            <Button onClick={() => {
              setShowPreview(false);
              handleEdit(selectedDoc);
            }}>
              <Edit className="h-4 w-4 mr-2" />Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
