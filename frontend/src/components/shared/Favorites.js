import React, { useState, useEffect } from 'react';
import { Star, StarOff, Pin, GripVertical, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Icon mapping
const ICON_MAP = {
  'LayoutDashboard': '📊',
  'Calendar': '📅',
  'Radio': '📡',
  'Sparkles': '✨',
  'Plane': '✈️',
  'History': '📜',
  'Users': '👥',
  'Settings': '⚙️',
  'default': '📌'
};

function FavoritesBar({ user }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?._id || user?.id) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    try {
      const userId = user._id || user.id;
      const response = await fetch(`${API_URL}/api/favorites/pinned-menu/${userId}`);
      const data = await response.json();
      setFavorites(data.pinned_items || []);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (favoriteId) => {
    try {
      await fetch(`${API_URL}/api/favorites/remove/${favoriteId}`, { method: 'DELETE' });
      setFavorites(prev => prev.filter(f => f._id !== favoriteId));
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove favorite');
    }
  };

  if (loading || favorites.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-2">
      <div className="flex items-center gap-2 overflow-x-auto">
        <Pin className="h-4 w-4 text-orange-400 flex-shrink-0" />
        {favorites.map(fav => (
          <button
            key={fav._id}
            onClick={() => navigate(fav.path)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 hover:text-white transition-all group whitespace-nowrap"
          >
            <span>{ICON_MAP[fav.icon] || ICON_MAP.default}</span>
            <span>{fav.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFavorite(fav._id);
              }}
              className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 hover:bg-red-500/20 rounded"
            >
              <X className="h-3 w-3 text-red-400" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

// Favorite Toggle Button (for adding items to favorites)
function FavoriteToggle({ user, itemType, itemId, label, path, icon, size = 'sm' }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?._id || user?.id) {
      checkFavorite();
    }
  }, [user, itemId]);

  const checkFavorite = async () => {
    try {
      const userId = user._id || user.id;
      const response = await fetch(
        `${API_URL}/api/favorites/check?user_id=${userId}&item_type=${itemType}&item_id=${itemId}`
      );
      const data = await response.json();
      setIsFavorite(data.is_favorite);
    } catch (error) {
      console.error('Failed to check favorite:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!user?._id && !user?.id) {
      toast.error('Please login to save favorites');
      return;
    }

    setLoading(true);
    try {
      const userId = user._id || user.id;
      
      if (isFavorite) {
        await fetch(
          `${API_URL}/api/favorites/remove-item?user_id=${userId}&item_type=${itemType}&item_id=${itemId}`,
          { method: 'DELETE' }
        );
        setIsFavorite(false);
        toast.success('Removed from favorites');
      } else {
        await fetch(`${API_URL}/api/favorites/add?user_id=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_type: itemType,
            item_id: itemId,
            label,
            path,
            icon
          })
        });
        setIsFavorite(true);
        toast.success('Added to favorites');
      }
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggleFavorite}
      disabled={loading}
      className={isFavorite ? 'text-yellow-400' : 'text-slate-400'}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorite ? (
        <Star className="h-4 w-4 fill-yellow-400" />
      ) : (
        <StarOff className="h-4 w-4" />
      )}
    </Button>
  );
}

// Favorites Manager (Full page/modal for managing favorites)
function FavoritesManager({ user, isOpen, onClose }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && (user?._id || user?.id)) {
      fetchAllFavorites();
    }
  }, [isOpen, user]);

  const fetchAllFavorites = async () => {
    try {
      const userId = user._id || user.id;
      const response = await fetch(`${API_URL}/api/favorites/user/${userId}`);
      const data = await response.json();
      setFavorites(data.favorites || []);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (favoriteId) => {
    try {
      await fetch(`${API_URL}/api/favorites/remove/${favoriteId}`, { method: 'DELETE' });
      setFavorites(prev => prev.filter(f => f._id !== favoriteId));
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  const addQuickFavorites = async (preset) => {
    try {
      const userId = user._id || user.id;
      await fetch(`${API_URL}/api/favorites/quick-add/${userId}?preset=${preset}`, {
        method: 'POST'
      });
      fetchAllFavorites();
      toast.success('Quick favorites added');
    } catch (error) {
      toast.error('Failed to add quick favorites');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-400" />
            My Favorites
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Quick Add Presets */}
        <div className="mb-6">
          <p className="text-slate-400 text-sm mb-2">Quick add presets:</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => addQuickFavorites('admin')}>
              Admin
            </Button>
            <Button size="sm" variant="outline" onClick={() => addQuickFavorites('operator')}>
              Operator
            </Button>
            <Button size="sm" variant="outline" onClick={() => addQuickFavorites('customer')}>
              Customer
            </Button>
          </div>
        </div>

        {/* Favorites List */}
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-8">
            <Star className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No favorites yet</p>
            <p className="text-slate-500 text-sm">Click the star icon on any page to add it here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map(fav => (
              <div
                key={fav._id}
                className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg hover:bg-slate-700/50 group"
              >
                <GripVertical className="h-4 w-4 text-slate-500 cursor-grab" />
                <span className="text-xl">{ICON_MAP[fav.icon] || ICON_MAP.default}</span>
                <div className="flex-1">
                  <p className="text-white font-medium">{fav.label}</p>
                  <p className="text-slate-400 text-xs">{fav.path}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(fav.path)}
                  className="opacity-0 group-hover:opacity-100"
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFavorite(fav._id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { FavoritesBar, FavoriteToggle, FavoritesManager };
export default FavoritesBar;
