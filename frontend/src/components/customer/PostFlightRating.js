import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Star, Plane, User, Shield, CreditCard, Heart,
  ThumbsUp, ThumbsDown, Camera, Send, CheckCircle,
  Loader2, AlertCircle, Award
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Star Rating Component
 */
const StarRating = ({ value, onChange, size = 'default', readonly = false }) => {
  const [hoverValue, setHoverValue] = useState(0);
  
  const sizes = {
    small: 'h-4 w-4',
    default: 'h-6 w-6',
    large: 'h-8 w-8'
  };

  return (
    <div className="flex gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => !readonly && setHoverValue(0)}
          disabled={readonly}
          className={`transition-all duration-150 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
        >
          <Star
            className={`${sizes[size]} ${
              star <= (hoverValue || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-700 text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

/**
 * Rating Category Component
 */
const RatingCategory = ({ 
  icon: Icon, 
  label, 
  value, 
  onChange, 
  color = 'orange',
  description 
}) => {
  const colors = {
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400'
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-slate-800 ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-white font-medium">{label}</p>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
      </div>
      <StarRating value={value} onChange={onChange} />
    </div>
  );
};

/**
 * Quick Feedback Tags
 */
const FeedbackTags = ({ selected, onChange, type = 'positive' }) => {
  const positiveTags = [
    'Punctual', 'Professional Crew', 'Clean Aircraft', 'Smooth Flight',
    'Great Service', 'Good Communication', 'Value for Money', 'Will Book Again'
  ];
  
  const negativeTags = [
    'Delayed', 'Poor Communication', 'Aircraft Issues', 'Rude Staff',
    'Overpriced', 'Safety Concerns', 'Hidden Charges', 'Poor Service'
  ];

  const tags = type === 'positive' ? positiveTags : negativeTags;
  const bgColor = type === 'positive' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';
  const hoverColor = type === 'positive' ? 'hover:bg-green-500/30' : 'hover:bg-red-500/30';

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => {
            if (selected.includes(tag)) {
              onChange(selected.filter(t => t !== tag));
            } else {
              onChange([...selected, tag]);
            }
          }}
          className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
            selected.includes(tag)
              ? bgColor
              : 'bg-slate-800 text-slate-400 border-slate-700 ' + hoverColor
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
};

/**
 * Post-Flight Rating Component
 */
const PostFlightRating = ({ 
  bookingId, 
  booking,
  onSubmit,
  isOpen,
  onClose
}) => {
  const [ratings, setRatings] = useState({
    pilot: 0,
    aircraft: 0,
    operator: 0,
    booking_experience: 0,
    value_for_money: 0
  });
  const [overallRating, setOverallRating] = useState(0);
  const [review, setReview] = useState('');
  const [positiveTags, setPositiveTags] = useState([]);
  const [negativeTags, setNegativeTags] = useState([]);
  const [wouldRecommend, setWouldRecommend] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateRating = (category, value) => {
    setRatings(prev => ({ ...prev, [category]: value }));
    // Auto-calculate overall rating
    const newRatings = { ...ratings, [category]: value };
    const values = Object.values(newRatings).filter(v => v > 0);
    if (values.length > 0) {
      setOverallRating(Math.round(values.reduce((a, b) => a + b, 0) / values.length));
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 5) {
      toast.warning('Maximum 5 photos allowed');
      return;
    }
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos(prev => [...prev, { file, preview: e.target.result }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (overallRating === 0) {
      toast.error('Please provide at least an overall rating');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('booking_id', bookingId);
      formData.append('overall_rating', overallRating);
      formData.append('ratings', JSON.stringify(ratings));
      formData.append('review', review);
      formData.append('positive_tags', JSON.stringify(positiveTags));
      formData.append('negative_tags', JSON.stringify(negativeTags));
      formData.append('would_recommend', wouldRecommend);
      
      photos.forEach((photo, index) => {
        formData.append(`photos`, photo.file);
      });

      const response = await axios.post(
        `${API_URL}/api/customer/bookings/${bookingId}/rating`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setSubmitted(true);
      toast.success('Thank you for your feedback!');
      onSubmit?.(response.data);
      
      setTimeout(() => {
        onClose?.();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit rating:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Thank You!</h2>
            <p className="text-slate-400">Your feedback helps us improve our services.</p>
            {overallRating >= 4 && (
              <div className="mt-4">
                <Badge className="bg-amber-500/20 text-amber-400">
                  <Award className="h-4 w-4 mr-1" />
                  You earned 50 bonus points!
                </Badge>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Star className="h-6 w-6 text-amber-400" />
            Rate Your Flight Experience
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Booking Info */}
          {booking && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Plane className="h-5 w-5 text-orange-400" />
                <div>
                  <p className="text-white font-medium">
                    {booking.from_location} → {booking.to_location}
                  </p>
                  <p className="text-sm text-slate-400">
                    {booking.travel_date} • {booking.aircraft_type || 'Charter Flight'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Overall Rating */}
          <div className="text-center">
            <p className="text-slate-400 mb-3">How was your overall experience?</p>
            <div className="flex justify-center mb-2">
              <StarRating 
                value={overallRating} 
                onChange={setOverallRating} 
                size="large" 
              />
            </div>
            <p className="text-sm text-slate-500">
              {overallRating === 0 && 'Tap to rate'}
              {overallRating === 1 && 'Poor'}
              {overallRating === 2 && 'Fair'}
              {overallRating === 3 && 'Good'}
              {overallRating === 4 && 'Very Good'}
              {overallRating === 5 && 'Excellent!'}
            </p>
          </div>

          {/* Category Ratings */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400">Rate Each Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <RatingCategory
                icon={User}
                label="Pilot Performance"
                description="Professionalism, communication, flying skills"
                value={ratings.pilot}
                onChange={(v) => updateRating('pilot', v)}
                color="amber"
              />
              <RatingCategory
                icon={Plane}
                label="Aircraft Condition"
                description="Cleanliness, comfort, amenities"
                value={ratings.aircraft}
                onChange={(v) => updateRating('aircraft', v)}
                color="blue"
              />
              <RatingCategory
                icon={Shield}
                label="Operator Service"
                description="Ground support, coordination"
                value={ratings.operator}
                onChange={(v) => updateRating('operator', v)}
                color="green"
              />
              <RatingCategory
                icon={CreditCard}
                label="Booking Experience"
                description="Ease of booking, support quality"
                value={ratings.booking_experience}
                onChange={(v) => updateRating('booking_experience', v)}
                color="purple"
              />
              <RatingCategory
                icon={Heart}
                label="Value for Money"
                description="Price vs quality received"
                value={ratings.value_for_money}
                onChange={(v) => updateRating('value_for_money', v)}
                color="orange"
              />
            </CardContent>
          </Card>

          {/* Quick Feedback Tags */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-400" />
                What went well?
              </p>
              <FeedbackTags 
                selected={positiveTags} 
                onChange={setPositiveTags} 
                type="positive" 
              />
            </div>
            
            <div>
              <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-red-400" />
                What could be improved?
              </p>
              <FeedbackTags 
                selected={negativeTags} 
                onChange={setNegativeTags} 
                type="negative" 
              />
            </div>
          </div>

          {/* Would Recommend */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <p className="text-white font-medium mb-3">Would you recommend AirYatra to others?</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={wouldRecommend === true ? 'default' : 'outline'}
                onClick={() => setWouldRecommend(true)}
                className={wouldRecommend === true ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Yes, definitely!
              </Button>
              <Button
                type="button"
                variant={wouldRecommend === false ? 'default' : 'outline'}
                onClick={() => setWouldRecommend(false)}
                className={wouldRecommend === false ? 'bg-red-500 hover:bg-red-600' : ''}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Not really
              </Button>
            </div>
          </div>

          {/* Written Review */}
          <div>
            <p className="text-sm text-slate-400 mb-2">Share your experience (optional)</p>
            <Textarea
              placeholder="Tell us about your flight experience..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{review.length}/1000</p>
          </div>

          {/* Photo Upload */}
          <div>
            <p className="text-sm text-slate-400 mb-2">Add photos (optional)</p>
            <div className="flex flex-wrap gap-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img 
                    src={photo.preview} 
                    alt={`Upload ${index + 1}`}
                    className="h-20 w-20 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                  >
                    <AlertCircle className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <label className="h-20 w-20 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-orange-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Camera className="h-6 w-6 text-slate-500" />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Max 5 photos</p>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Skip for now
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || overallRating === 0}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Rating
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Rating Display Component (for showing existing ratings)
 */
export const RatingDisplay = ({ rating, showDetails = false }) => {
  if (!rating) return null;

  return (
    <div className="flex items-center gap-2" data-testid="rating-display">
      <StarRating value={rating.overall || 0} readonly size="small" />
      <span className="text-white font-medium">{rating.overall?.toFixed(1)}</span>
      {showDetails && rating.review_count && (
        <span className="text-slate-500 text-sm">({rating.review_count} reviews)</span>
      )}
    </div>
  );
};

export { StarRating, RatingCategory };
export default PostFlightRating;
