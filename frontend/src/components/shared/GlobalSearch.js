import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Command, X, Plane, Users, Building2, FileText, DollarSign, 
  ChevronRight, Clock, ArrowRight, Hash, Star, Loader2, Shield, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Search result categories with icons and colors
const CATEGORIES = {
  bookings: { icon: Plane, label: 'Bookings', color: 'text-blue-400 bg-blue-500/20', path: '/admin/bookings' },
  customers: { icon: Users, label: 'Customers', color: 'text-green-400 bg-green-500/20', path: '/admin/users' },
  operators: { icon: Building2, label: 'Operators', color: 'text-purple-400 bg-purple-500/20', path: '/admin/operators' },
  invoices: { icon: FileText, label: 'Invoices', color: 'text-orange-400 bg-orange-500/20', path: '/admin/invoices' },
  aircraft: { icon: Plane, label: 'Aircraft', color: 'text-cyan-400 bg-cyan-500/20', path: '/admin/fleet' },
  pilots: { icon: Users, label: 'Pilots', color: 'text-yellow-400 bg-yellow-500/20', path: '/operator/pilots' },
  inquiries: { icon: FileText, label: 'Inquiries', color: 'text-pink-400 bg-pink-500/20', path: '/admin/inquiries' },
  security: { icon: Shield, label: 'Security', color: 'text-red-400 bg-red-500/20', path: '/admin' }
};

// Quick actions for common tasks
const QUICK_ACTIONS = [
  { id: 'new-booking', label: 'Create New Booking', icon: Plane, shortcut: 'N', path: '/booking' },
  { id: 'view-inquiries', label: 'View All Inquiries', icon: FileText, path: '/admin/inquiries' },
  { id: 'command-center', label: 'Command Center (24×7 Monitoring)', icon: Shield, path: '/command-center', category: 'admin' },
  { id: 'ai-pricing', label: 'AI Pricing Advisor', icon: DollarSign, path: '/ai-pricing', category: 'admin' },
  { id: 'operator-dashboard', label: 'Operator Dashboard', icon: Building2, path: '/operator' },
  { id: 'admin-dashboard', label: 'Admin Dashboard', icon: Star, path: '/admin' },
  { id: 'customer-dashboard', label: 'Customer Dashboard', icon: Users, path: '/customer' },
  { id: 'fleet-management', label: 'Fleet Management', icon: Plane, path: '/operator/fleet' },
  { id: 'login-shield', label: 'Login Shield AI™ / Security', icon: Shield, path: '/admin?tab=login_shield', category: 'security' },
  { id: 'session-manager', label: 'Session Manager / Active Sessions', icon: Key, path: '/admin?tab=session_manager', category: 'security' }
];

function GlobalSearch({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentQueries, setRecentQueries] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const storageId = user?.id || 'anon';

  // Load per-user recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`airyatra_recent_searches_${storageId}`);
      setRecentSearches(saved ? JSON.parse(saved).slice(0, 5) : []);
      const savedQ = localStorage.getItem(`airyatra_recent_queries_${storageId}`);
      setRecentQueries(savedQ ? JSON.parse(savedQ).slice(0, 6) : []);
    } catch (e) {
      console.error('Failed to parse recent searches');
    }
  }, [storageId]);

  // Save recent search
  const saveRecentSearch = (item) => {
    const updated = [item, ...recentSearches.filter(r => r.id !== item.id)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(`airyatra_recent_searches_${storageId}`, JSON.stringify(updated));
  };

  const saveRecentQuery = (term) => {
    const t = term.trim();
    if (!t) return;
    const updated = [t, ...recentQueries.filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    setRecentQueries(updated);
    localStorage.setItem(`airyatra_recent_queries_${storageId}`, JSON.stringify(updated));
  };

  const clearRecents = () => {
    setRecentQueries([]);
    setRecentSearches([]);
    localStorage.removeItem(`airyatra_recent_queries_${storageId}`);
    localStorage.removeItem(`airyatra_recent_searches_${storageId}`);
  };

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Open with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search API call with debounce
  const searchDebounceRef = useRef(null);
  
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/search/global?q=${encodeURIComponent(searchQuery)}&limit=20`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      } else {
        // Fallback: search locally
        setResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (query.trim()) {
      searchDebounceRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const totalItems = query ? results.length : QUICK_ACTIONS.length + recentSearches.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect(selectedIndex);
        break;
      default:
        break;
    }
  };

  // Handle item selection
  const handleSelect = (index) => {
    let item;
    
    if (query) {
      item = results[index];
    } else if (index < recentSearches.length) {
      item = recentSearches[index];
    } else {
      item = QUICK_ACTIONS[index - recentSearches.length];
    }
    
    if (item) {
      handleNavigate(item);
    }
  };

  // Navigate to result
  const handleNavigate = (item) => {
    // Remember the typed search term for one-tap re-search
    if (query.trim()) {
      saveRecentQuery(query);
    }
    // Save to recent searches if it's a search result
    if (item.category && item.id) {
      saveRecentSearch({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        category: item.category,
        path: item.path
      });
    }
    
    setIsOpen(false);
    
    // Navigate based on item type
    if (item.path) {
      navigate(item.path);
    } else if (item.category && CATEGORIES[item.category]) {
      navigate(`${CATEGORIES[item.category].path}/${item.id}`);
    }
  };

  // Get display items based on query state
  const displayItems = query ? results : [
    ...recentSearches.map(r => ({ ...r, isRecent: true })),
    ...QUICK_ACTIONS.map(a => ({ ...a, isAction: true }))
  ];

  // Render result item
  const renderItem = (item, index) => {
    const isSelected = selectedIndex === index;
    const category = item.category ? CATEGORIES[item.category] : null;
    const Icon = item.icon || category?.icon || FileText;
    const colorClass = category?.color || 'text-slate-400 bg-slate-700';
    
    return (
      <button
        key={item.id || index}
        onClick={() => handleNavigate(item)}
        onMouseEnter={() => setSelectedIndex(index)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
          isSelected 
            ? 'bg-orange-500/10 border-l-2 border-orange-500' 
            : 'border-l-2 border-transparent hover:bg-slate-800/50'
        }`}
      >
        {/* Icon */}
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {item.isRecent && (
              <Clock className="h-3 w-3 text-slate-500" />
            )}
            <span className={`font-medium truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
              {item.title || item.label}
            </span>
            {item.category && (
              <span className={`text-xs px-2 py-0.5 rounded ${colorClass}`}>
                {CATEGORIES[item.category]?.label}
              </span>
            )}
          </div>
          {item.subtitle && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
          )}
        </div>
        
        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {item.shortcut && (
            <kbd className="hidden sm:inline px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
              {item.shortcut}
            </kbd>
          )}
          {isSelected && (
            <ArrowRight className="h-4 w-4 text-orange-400" />
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Search Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors group"
        data-testid="global-search-trigger"
      >
        <Search className="h-4 w-4 text-slate-400 group-hover:text-white" />
        <span className="text-sm text-slate-400 group-hover:text-white hidden sm:inline">Search...</span>
        <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal */}
          <div 
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: 'slideDown 0.2s ease-out' }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
              <Search className="h-5 w-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search bookings, customers, operators, invoices..."
                className="flex-1 bg-transparent text-white text-lg placeholder:text-slate-500 focus:outline-none"
                data-testid="global-search-input"
              />
              {loading && <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />}
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center px-2 py-1 text-xs bg-slate-800 text-slate-400 rounded border border-slate-700">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {/* No query - show recent & quick actions */}
              {!query && (
                <>
                  {recentQueries.length > 0 && (
                    <div className="py-2" data-testid="recent-queries-section">
                      <div className="px-4 py-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Recent Searches
                        </span>
                        <button onClick={clearRecents} className="text-[11px] text-slate-500 hover:text-red-400"
                          data-testid="clear-recents-btn">
                          Clear
                        </button>
                      </div>
                      <div className="px-4 pb-1 flex flex-wrap gap-2">
                        {recentQueries.map((term) => (
                          <button key={term} onClick={() => setQuery(term)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:border-orange-500/60 hover:text-white transition-colors"
                            data-testid={`recent-query-${term.replace(/\s+/g, '-').toLowerCase()}`}>
                            <Clock className="h-3.5 w-3.5 text-slate-500" />
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {recentSearches.length > 0 && (
                    <div className="py-2 border-t border-slate-800">
                      <div className="px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Recently Viewed
                      </div>
                      {recentSearches.map((item, index) => renderItem(item, index))}
                    </div>
                  )}
                  
                  <div className="py-2 border-t border-slate-800">
                    <div className="px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Quick Actions
                    </div>
                    {QUICK_ACTIONS.map((item, index) => 
                      renderItem(item, index + recentSearches.length)
                    )}
                  </div>
                </>
              )}

              {/* Query entered - show results */}
              {query && (
                <>
                  {loading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="h-8 w-8 text-orange-400 animate-spin mx-auto" />
                      <p className="text-slate-400 mt-2">Searching...</p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="py-12 text-center">
                      <Search className="h-12 w-12 text-slate-600 mx-auto" />
                      <p className="text-slate-400 mt-3">No results found for &quot;{query}&quot;</p>
                      <p className="text-slate-500 text-sm mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {results.length} Result{results.length !== 1 ? 's' : ''}
                      </div>
                      {results.map((item, index) => renderItem(item, index))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer with keyboard hints */}
            <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">esc</kbd>
                close
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

export default GlobalSearch;
