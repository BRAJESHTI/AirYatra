import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
  Plane, Calendar, Eye, Tag, ArrowLeft, Search, BookOpen,
  Clock, User, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { id: 'all', label: 'All Posts' },
  { id: 'travel', label: 'Travel Tips' },
  { id: 'business', label: 'Business' },
  { id: 'safety', label: 'Safety' },
  { id: 'industry', label: 'Industry News' }
];

// Blog List Page
function BlogListPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/content/blog?limit=20`;
      if (selectedCategory !== 'all') {
        url += `&category=${selectedCategory}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchPosts();
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/content/blog?search=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white tracking-tight">AirYatra</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="ghost" className="text-slate-300 hover:text-white">Home</Button>
            </Link>
            <Link to="/fleet">
              <Button variant="ghost" className="text-slate-300 hover:text-white">Fleet</Button>
            </Link>
            <Link to="/booking">
              <Button className="bg-orange-500 hover:bg-orange-600">Book Now</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-6 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">Blog</span>
          <h1 className="text-5xl md:text-6xl font-bold text-white mt-4 mb-6">
            Aviation Insights & Travel Tips
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Stay updated with the latest in private aviation, travel guides, and industry news
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="pl-12 pr-4 h-12 bg-slate-800 border-slate-700 text-white rounded-full"
              />
            </div>
          </form>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-6 px-6 bg-slate-900 sticky top-[73px] z-40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-400">Loading articles...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No articles found</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all"
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={post.featured_image || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600'}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full capitalize">
                        {post.category}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    {post.title_hi && (
                      <p className="text-orange-400/70 text-sm mb-2">{post.title_hi}</p>
                    )}
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                      {post.excerpt}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {post.views || 0} views
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-orange-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Plane className="h-6 w-6 text-orange-500" />
            <span className="text-xl font-bold text-white">AirYatra</span>
          </div>
          <p className="text-slate-400 text-sm">
            © 2024 AirYatra. India Premier Aviation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Single Blog Post Page
function BlogPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [slug]);

  const fetchPost = async () => {
    try {
      const response = await fetch(`${API_URL}/api/content/blog/${slug}`);
      if (!response.ok) {
        navigate('/blog');
        return;
      }
      const data = await response.json();
      setPost(data);
    } catch (err) {
      console.error('Error fetching post:', err);
      navigate('/blog');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white tracking-tight">AirYatra</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link to="/blog">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Blog
              </Button>
            </Link>
            <Link to="/booking">
              <Button className="bg-orange-500 hover:bg-orange-600">Book Now</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 relative">
        <div className="h-80 md:h-96 relative">
          <img
            src={post.featured_image || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200'}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 -mt-32 relative z-10">
          <span className="px-4 py-1.5 bg-orange-500 text-white text-sm font-semibold rounded-full capitalize">
            {post.category}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-6 mb-4">
            {post.title}
          </h1>
          {post.title_hi && (
            <p className="text-orange-400/80 text-xl mb-6">{post.title_hi}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-6 text-slate-400 text-sm">
            <span className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {post.author_name}
            </span>
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(post.created_at)}
            </span>
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {post.views || 0} views
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              5 min read
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-8 md:p-12">
            <div 
              className="prose prose-invert prose-orange max-w-none
                prose-headings:text-white prose-headings:font-bold
                prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                prose-p:text-slate-300 prose-p:leading-relaxed
                prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-white
                prose-ul:text-slate-300 prose-ol:text-slate-300
                prose-li:marker:text-orange-500"
              dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br/>').replace(/## /g, '<h2>').replace(/# /g, '<h1>') }}
            />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              <Tag className="h-4 w-4 text-slate-400" />
              {post.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to Experience Private Aviation?</h3>
            <p className="text-white/90 mb-6">Book your first flight with AirYatra today</p>
            <Link to="/booking">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-slate-100">
                Book a Flight
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 px-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Plane className="h-6 w-6 text-orange-500" />
            <span className="text-xl font-bold text-white">AirYatra</span>
          </div>
          <p className="text-slate-400 text-sm">
            © 2024 AirYatra. India Premier Aviation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

export { BlogListPage, BlogPostPage };
