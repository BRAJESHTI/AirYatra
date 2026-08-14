import React, { useState, useEffect } from 'react';
import { 
  Star, ThumbsUp, MessageSquare, AlertTriangle, User,
  Loader2, Filter, ChevronDown, Flag, Eye, EyeOff,
  Trash2, CheckCircle, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

function ReviewsManagement() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({ status: '', reported: null });

  useEffect(() => {
    loadReviews();
    loadReports();
  }, [filters]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.reported !== null) params.reported = filters.reported;
      
      const response = await api.get('/reviews/admin/all', { params });
      setReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const response = await api.get('/reviews/admin/reports');
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const moderateReview = async (reviewId, action) => {
    try {
      await api.put(`/reviews/admin/${reviewId}/moderate?action=${action}`);
      toast.success(`Review ${action}ed successfully`);
      loadReviews();
      loadReports();
    } catch (error) {
      toast.error('Failed to moderate review');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-400" />
            Reviews & Ratings</h2>
          <p className="text-slate-400 mt-1">Manage customer reviews and operator ratings</p>
        </div>
        <Button onClick={loadReviews} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'all', label: 'All Reviews', count: reviews.length },
          { id: 'reported', label: 'Reported', count: reports.length, highlight: true },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'reported') {
                setFilters({ ...filters, reported: true });
              } else {
                setFilters({ ...filters, reported: null });
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === tab.id ? 'bg-yellow-500 text-black' : tab.highlight ? 'text-red-400 hover:bg-red-500/20' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-black/20 text-black' : tab.highlight ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="bg-slate-800 border-slate-600 text-white rounded px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map(review => (
          <div
            key={review.id}
            className={`bg-slate-800/50 rounded-xl p-4 border ${
              review.reported ? 'border-red-500/50' : 'border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-medium">{review.customer_name}</p>
                    {review.verified_booking && (
                      <span className="text-green-400 text-xs bg-green-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Verified Booking
                      </span>
                    )}
                    {review.reported && (
                      <span className="text-red-400 text-xs bg-red-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <Flag className="h-3 w-3" /> Reported
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{review.operator_name}</p>
                  <p className="text-slate-500 text-xs mt-1">{review.route} • {review.journey_date}</p>
                </div>
              </div>
              
              <div className="text-right">
                {renderStars(review.overall_rating)}
                <p className="text-slate-400 text-xs mt-1">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Review Content */}
            <div className="mt-4">
              {review.title && (
                <p className="text-white font-medium mb-2">{review.title}</p>
              )}
              <p className="text-slate-300">{review.comment || 'No comment provided'}</p>
            </div>

            {/* Rating Breakdown */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {review.pilot_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Pilot:</span>
                  <span className="text-yellow-400">{review.pilot_rating}/5</span>
                </div>
              )}
              {review.aircraft_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Aircraft:</span>
                  <span className="text-yellow-400">{review.aircraft_rating}/5</span>
                </div>
              )}
              {review.service_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Service:</span>
                  <span className="text-yellow-400">{review.service_rating}/5</span>
                </div>
              )}
              {review.punctuality_rating && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Punctuality:</span>
                  <span className="text-yellow-400">{review.punctuality_rating}/5</span>
                </div>
              )}
            </div>

            {/* Operator Response */}
            {review.operator_response && (
              <div className="mt-4 bg-slate-900/50 rounded-lg p-3">
                <p className="text-purple-400 text-sm font-medium mb-1">Operator Response:</p>
                <p className="text-slate-300 text-sm">{review.operator_response}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-slate-400 text-sm">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" /> {review.helpful_count} helpful
                </span>
                <span>
                  {review.would_recommend ? '👍 Would recommend' : '👎 Would not recommend'}
                </span>
              </div>
              
              <div className="flex gap-2">
                {review.status === 'published' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderateReview(review.id, 'hide')}
                    className="border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <EyeOff className="h-4 w-4 mr-1" /> Hide
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderateReview(review.id, 'publish')}
                    className="border-green-500 text-green-400 hover:bg-green-500/10"
                  >
                    <Eye className="h-4 w-4 mr-1" /> Publish
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => moderateReview(review.id, 'delete')}
                  className="border-red-500 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
            <Star className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-white font-medium">No reviews found</p>
            <p className="text-slate-400 text-sm">Reviews will appear here once customers submit them</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewsManagement;
