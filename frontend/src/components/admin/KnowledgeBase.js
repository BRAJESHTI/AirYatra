import React, { useState, useEffect } from 'react';
import { BookOpen, FileText, HelpCircle, Video, Plus, Edit, Trash2, Eye, Search, RefreshCw, Save, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/services/api';

function KnowledgeBase() {
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('articles');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [articleForm, setArticleForm] = useState({
    title: '', title_hi: '', category: 'getting_started', content: '', content_hi: '',
    tags: [], is_featured: false, is_published: true
  });
  const [faqForm, setFaqForm] = useState({
    question: '', question_hi: '', answer: '', answer_hi: '', category: 'faq', is_featured: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, categoriesRes, articlesRes, faqsRes, videosRes] = await Promise.all([
        api.get('/api/knowledge/admin/stats').catch(() => ({ data: {} })),
        api.get('/api/knowledge/categories'),
        api.get('/api/knowledge/articles'),
        api.get('/api/knowledge/faqs'),
        api.get('/api/knowledge/videos')
      ]);
      setStats(statsRes.data);
      setCategories(categoriesRes.data.categories || []);
      setArticles(articlesRes.data.articles || []);
      setFaqs(faqsRes.data.faqs || []);
      setVideos(videosRes.data.videos || []);
    } catch (error) {
      console.error('Failed to load KB data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchContent = async () => {
    if (!searchQuery.trim()) return loadData();
    try {
      const res = await api.get(`/api/knowledge/search?q=${encodeURIComponent(searchQuery)}`);
      setArticles(res.data.articles || []);
      setFaqs(res.data.faqs || []);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const createArticle = async () => {
    try {
      await api.post('/api/knowledge/admin/articles', articleForm);
      setShowArticleForm(false);
      setArticleForm({ title: '', title_hi: '', category: 'getting_started', content: '', content_hi: '', tags: [], is_featured: false, is_published: true });
      loadData();
    } catch (error) {
      console.error('Failed to create article:', error);
    }
  };

  const createFaq = async () => {
    try {
      await api.post('/api/knowledge/admin/faqs', faqForm);
      setShowFaqForm(false);
      setFaqForm({ question: '', question_hi: '', answer: '', answer_hi: '', category: 'faq', is_featured: false });
      loadData();
    } catch (error) {
      console.error('Failed to create FAQ:', error);
    }
  };

  const getCategoryName = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : catId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Base / FAQ</h1>
          <p className="text-slate-400">Help center content management</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowArticleForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> New Article
          </Button>
          <Button onClick={() => setShowFaqForm(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" /> New FAQ
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-blue-400 mb-2">
              <FileText className="h-5 w-5" />
              <span className="text-sm">Articles</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_articles || 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-green-400 mb-2">
              <HelpCircle className="h-5 w-5" />
              <span className="text-sm">FAQs</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_faqs || 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-purple-400 mb-2">
              <Video className="h-5 w-5" />
              <span className="text-sm">Videos</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_videos || 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center space-x-2 text-orange-400 mb-2">
              <Eye className="h-5 w-5" />
              <span className="text-sm">Total Views</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_views || 0}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex space-x-2">
        <Input
          placeholder="Search articles, FAQs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchContent()}
          className="bg-slate-800 border-slate-700 flex-1"
        />
        <Button onClick={searchContent} variant="outline">
          <Search className="h-4 w-4" />
        </Button>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-slate-700">
        {['articles', 'faqs', 'videos', 'categories'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'articles' && (
        <div className="space-y-3">
          {articles.length > 0 ? articles.map(article => (
            <div key={article.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-medium">{article.title}</h3>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">{getCategoryName(article.category)}</span>
                    {article.is_featured && <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">Featured</span>}
                    <span className="text-slate-500 text-xs"><Eye className="h-3 w-3 inline mr-1" />{article.views || 0} views</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 text-slate-500">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No articles yet. Create your first article!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'faqs' && (
        <div className="space-y-3">
          {faqs.length > 0 ? faqs.map(faq => (
            <div key={faq.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-white font-medium flex items-center">
                    <HelpCircle className="h-4 w-4 mr-2 text-green-400" />
                    {faq.question}
                  </h3>
                  <p className="text-slate-400 text-sm mt-2 ml-6">{faq.answer}</p>
                  <div className="flex items-center space-x-2 mt-2 ml-6">
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">{getCategoryName(faq.category)}</span>
                    {faq.is_featured && <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">Featured</span>}
                  </div>
                </div>
                <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 text-slate-500">
              <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No FAQs yet. Add your first FAQ!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="grid grid-cols-3 gap-4">
          {videos.length > 0 ? videos.map(video => (
            <div key={video.id} className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
              <div className="aspect-video bg-slate-900 flex items-center justify-center">
                <Video className="h-12 w-12 text-slate-600" />
              </div>
              <div className="p-3">
                <h3 className="text-white font-medium text-sm">{video.title}</h3>
                <p className="text-slate-400 text-xs mt-1">{getCategoryName(video.category)}</p>
              </div>
            </div>
          )) : (
            <div className="col-span-3 text-center py-12 text-slate-500">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No tutorial videos yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-2 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">{cat.name}</h3>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-500" />
            </div>
          ))}
        </div>
      )}

      {/* Article Form Modal */}
      {showArticleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Article</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-sm">Title (English)</label>
                  <Input value={articleForm.title} onChange={(e) => setArticleForm(p => ({ ...p, title: e.target.value }))} className="bg-slate-700" />
                </div>
                <div>
                  <label className="text-slate-400 text-sm">Title (Hindi)</label>
                  <Input value={articleForm.title_hi} onChange={(e) => setArticleForm(p => ({ ...p, title_hi: e.target.value }))} className="bg-slate-700" />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-sm">Category</label>
                <select value={articleForm.category} onChange={(e) => setArticleForm(p => ({ ...p, category: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm">Content (English)</label>
                <textarea value={articleForm.content} onChange={(e) => setArticleForm(p => ({ ...p, content: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" rows="4" />
              </div>
              <div>
                <label className="text-slate-400 text-sm">Content (Hindi)</label>
                <textarea value={articleForm.content_hi} onChange={(e) => setArticleForm(p => ({ ...p, content_hi: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" rows="4" />
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 text-slate-300">
                  <input type="checkbox" checked={articleForm.is_featured} onChange={(e) => setArticleForm(p => ({ ...p, is_featured: e.target.checked }))} />
                  <span>Featured</span>
                </label>
                <label className="flex items-center space-x-2 text-slate-300">
                  <input type="checkbox" checked={articleForm.is_published} onChange={(e) => setArticleForm(p => ({ ...p, is_published: e.target.checked }))} />
                  <span>Published</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowArticleForm(false)}>Cancel</Button>
              <Button onClick={createArticle} className="bg-orange-500 hover:bg-orange-600">Create Article</Button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Form Modal */}
      {showFaqForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Create New FAQ</h3>
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm">Question (English)</label>
                <Input value={faqForm.question} onChange={(e) => setFaqForm(p => ({ ...p, question: e.target.value }))} className="bg-slate-700" />
              </div>
              <div>
                <label className="text-slate-400 text-sm">Question (Hindi)</label>
                <Input value={faqForm.question_hi} onChange={(e) => setFaqForm(p => ({ ...p, question_hi: e.target.value }))} className="bg-slate-700" />
              </div>
              <div>
                <label className="text-slate-400 text-sm">Answer (English)</label>
                <textarea value={faqForm.answer} onChange={(e) => setFaqForm(p => ({ ...p, answer: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" rows="3" />
              </div>
              <div>
                <label className="text-slate-400 text-sm">Answer (Hindi)</label>
                <textarea value={faqForm.answer_hi} onChange={(e) => setFaqForm(p => ({ ...p, answer_hi: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" rows="3" />
              </div>
              <div>
                <label className="text-slate-400 text-sm">Category</label>
                <select value={faqForm.category} onChange={(e) => setFaqForm(p => ({ ...p, category: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <Button variant="outline" onClick={() => setShowFaqForm(false)}>Cancel</Button>
              <Button onClick={createFaq} className="bg-green-500 hover:bg-green-600">Create FAQ</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KnowledgeBase;
