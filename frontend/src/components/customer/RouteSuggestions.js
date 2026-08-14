import React, { useState, useEffect } from 'react';
import { 
  MapPin, TrendingUp, Sparkles, Plane, Calendar, Clock, 
  ChevronRight, Loader2, Star, Gift, IndianRupee, Navigation,
  Sun, Heart, Building2, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function RouteSuggestions({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/customer/route-suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPurposeIcon = (purpose) => {
    switch (purpose) {
      case 'pilgrimage': return <Heart className="h-4 w-4 text-pink-400" />;
      case 'business': return <Building2 className="h-4 w-4 text-blue-400" />;
      case 'tourism': return <Star className="h-4 w-4 text-yellow-400" />;
      case 'leisure': return <Sun className="h-4 w-4 text-orange-400" />;
      case 'wedding': return <Gift className="h-4 w-4 text-red-400" />;
      default: return <Plane className="h-4 w-4 text-slate-400" />;
    }
  };

  const getPurposeLabel = (purpose) => {
    const labels = {
      'pilgrimage': 'Pilgrimage',
      'business': 'Business',
      'tourism': 'Tourism',
      'leisure': 'Leisure',
      'wedding': 'Wedding',
      'heritage': 'Heritage'
    };
    return labels[purpose] || purpose;
  };

  const handleBookRoute = (route) => {
    // Navigate to booking with pre-filled route
    navigate(`/booking?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(route.to)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-400" />
          Route Suggestions</h2>
        <p className="text-slate-400 mt-1">AI-powered recommendations based on your preferences</p>
      </div>

      {/* Seasonal Suggestion Banner */}
      {data?.seasonal_suggestion && (
        <div className="bg-gradient-to-r from-orange-500/20 via-red-500/20 to-pink-500/20 rounded-xl p-4 border border-orange-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-500/30 flex items-center justify-center">
                <Gift className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">{data.seasonal_suggestion.title}</h3>
                <p className="text-slate-300 text-sm">{data.seasonal_suggestion.description}</p>
                {data.seasonal_suggestion.discount && (
                  <p className="text-green-400 text-sm mt-1">{data.seasonal_suggestion.discount}</p>
                )}
              </div>
            </div>
            {data.seasonal_suggestion.route && (
              <Button 
                onClick={() => handleBookRoute(data.seasonal_suggestion.route)}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Book Now <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Personalized Routes */}
      {data?.personalized_routes?.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400" />
            For You<span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Personalized</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {data.personalized_routes.map((route, idx) => (
              <div 
                key={idx}
                className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-4 border border-yellow-500/30 hover:border-yellow-500/50 transition-all cursor-pointer group"
                onClick={() => handleBookRoute(route)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getPurposeIcon(route.purpose)}
                    <span className="text-slate-400 text-sm">{getPurposeLabel(route.purpose)}</span>
                  </div>
                  <span className="text-yellow-400 text-xs bg-yellow-500/20 px-2 py-0.5 rounded-full">
                    {route.popularity}% popular
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-green-400" />
                  <span className="text-white font-semibold">{route.from}</span>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                  <MapPin className="h-4 w-4 text-red-400" />
                  <span className="text-white font-semibold">{route.to}</span>
                </div>
                
                <p className="text-slate-400 text-sm mb-3">{route.description}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {route.duration}
                    </span>
                    <span className="text-green-400 font-semibold">{route.price_range}</span>
                  </div>
                  <Button size="sm" className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Book <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Routes */}
      <div>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-400" />
          Trending Routes</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.trending_routes?.map((route, idx) => (
            <div 
              key={idx}
              className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-orange-500/50 transition-all cursor-pointer group"
              onClick={() => handleBookRoute(route)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getPurposeIcon(route.purpose)}
                  <span className="text-slate-400 text-sm">{getPurposeLabel(route.purpose)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-400" />
                  <span className="text-green-400 text-xs">{route.popularity}%</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white font-semibold">{route.from}</span>
                <Navigation className="h-4 w-4 text-orange-400" />
                <span className="text-white font-semibold">{route.to}</span>
              </div>
              
              <p className="text-slate-500 text-xs mb-3 line-clamp-2">{route.description}</p>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {route.duration}
                </span>
                <span className="text-green-400 font-semibold">{route.price_range}</span>
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                <span className="text-slate-500 text-xs">Best: {route.best_time}</span>
                <Button size="sm" variant="ghost" className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2">
                  Book <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Popular Routes */}
      <div>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Plane className="h-5 w-5 text-blue-400" />
          All Popular Routes</h3>
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Route</th>
                <th className="text-left p-3 text-slate-400 font-medium">Type</th>
                <th className="text-left p-3 text-slate-400 font-medium">Duration</th>
                <th className="text-left p-3 text-slate-400 font-medium">Price Range</th>
                <th className="text-left p-3 text-slate-400 font-medium">Best Time</th>
                <th className="text-right p-3 text-slate-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.all_popular_routes?.map((route, idx) => (
                <tr key={idx} className="border-t border-slate-700 hover:bg-slate-800/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white">{route.from}</span>
                      <ChevronRight className="h-4 w-4 text-orange-400" />
                      <span className="text-white">{route.to}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {getPurposeIcon(route.purpose)}
                      <span className="text-slate-400 text-sm">{route.purpose}</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-400">{route.duration}</td>
                  <td className="p-3 text-green-400 font-medium">{route.price_range}</td>
                  <td className="p-3 text-slate-400">{route.best_time}</td>
                  <td className="p-3 text-right">
                    <Button 
                      size="sm" 
                      onClick={() => handleBookRoute(route)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      Book
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Tip */}
      {data?.booking_tip && (
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30 text-center">
          <p className="text-blue-400">💡 {data.booking_tip}</p>
        </div>
      )}

      {/* User Preferences Summary */}
      {data?.user_preference?.total_bookings > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
          <h4 className="text-slate-400 text-sm mb-2">Your Travel Profile</h4>
          <div className="flex items-center gap-4">
            <span className="text-white">
              <Users className="h-4 w-4 inline mr-1 text-blue-400" />
              {data.user_preference.total_bookings} bookings
            </span>
            <span className="text-white">
              {getPurposeIcon(data.user_preference.top_purpose)}
              <span className="ml-1">Prefers: {data.user_preference.top_purpose}</span>
            </span>
            {data.user_preference.visited_cities?.length > 0 && (
              <span className="text-slate-400">
                Visited: {data.user_preference.visited_cities.join(', ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RouteSuggestions;
