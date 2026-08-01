import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Plane, MapPin, Calendar, Clock, TrendingUp, Star, Award, 
  RefreshCw, DollarSign, Target, Zap, Crown, Gift, ArrowUpRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Loyalty Tiers
const LOYALTY_TIERS = [
  { name: 'Bronze', minSpend: 0, maxSpend: 500000, color: 'from-amber-700 to-amber-800', icon: Award, benefits: ['5% discount on bookings', 'Priority support'] },
  { name: 'Silver', minSpend: 500000, maxSpend: 1500000, color: 'from-slate-400 to-slate-500', icon: Star, benefits: ['10% discount on bookings', 'Free cancellation', 'Lounge access'] },
  { name: 'Gold', minSpend: 1500000, maxSpend: 5000000, color: 'from-yellow-500 to-yellow-600', icon: Crown, benefits: ['15% discount on bookings', 'Free upgrades', 'Dedicated manager', 'Airport transfers'] },
  { name: 'Platinum', minSpend: 5000000, maxSpend: Infinity, color: 'from-purple-500 to-purple-600', icon: Zap, benefits: ['20% discount on bookings', 'All Gold benefits', 'Private jet access', 'Exclusive events'] },
];

export default function CustomerBookingStats({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/customer/booking-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setStats(json);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Determine current tier
  const getCurrentTier = (totalSpend) => {
    for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
      if (totalSpend >= LOYALTY_TIERS[i].minSpend) {
        return { tier: LOYALTY_TIERS[i], index: i };
      }
    }
    return { tier: LOYALTY_TIERS[0], index: 0 };
  };

  // Calculate progress to next tier
  const getProgressToNextTier = (totalSpend) => {
    const { tier, index } = getCurrentTier(totalSpend);
    if (index === LOYALTY_TIERS.length - 1) {
      return { progress: 100, remaining: 0, nextTier: null };
    }
    const nextTier = LOYALTY_TIERS[index + 1];
    const progressInTier = totalSpend - tier.minSpend;
    const tierRange = nextTier.minSpend - tier.minSpend;
    const progress = Math.min(100, (progressInTier / tierRange) * 100);
    const remaining = nextTier.minSpend - totalSpend;
    return { progress, remaining, nextTier };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="stats-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const totalSpend = stats?.total_spend || 0;
  const { tier: currentTier, index: tierIndex } = getCurrentTier(totalSpend);
  const { progress, remaining, nextTier } = getProgressToNextTier(totalSpend);
  const TierIcon = currentTier.icon;

  return (
    <div className="space-y-6 p-6" data-testid="customer-booking-stats">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-orange-500" />
            My Flight Stats
          </h1>
          <p className="text-slate-400 mt-1">Your journey with AirYatra</p>
        </div>
        <Button 
          onClick={loadStats} 
          variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Loyalty Tier Card */}
      <Card className={`bg-gradient-to-br ${currentTier.color} border-0 overflow-hidden relative`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <TierIcon className="h-10 w-10 text-white" />
                <div>
                  <p className="text-white/70 text-sm">Current Tier</p>
                  <h2 className="text-3xl font-bold text-white">{currentTier.name}</h2>
                </div>
              </div>
              
              {nextTier && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/70">Progress to {nextTier.name}</span>
                    <span className="text-white font-semibold">{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/20" />
                  <p className="text-white/70 text-sm mt-2">
                    Spend {formatCurrency(remaining)} more to unlock {nextTier.name}
                  </p>
                </div>
              )}
              
              {!nextTier && (
                <p className="text-white/80 mt-4 flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  You've reached the highest tier! Enjoy all benefits.
                </p>
              )}
            </div>
            
            <div className="text-right">
              <p className="text-white/70 text-sm">Total Spend</p>
              <p className="text-3xl font-bold text-white">{formatCurrency(totalSpend)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5 text-center">
            <Plane className="h-8 w-8 text-orange-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats?.total_flights || 0}</p>
            <p className="text-slate-400 text-sm">Total Flights</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5 text-center">
            <MapPin className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats?.unique_routes || 0}</p>
            <p className="text-slate-400 text-sm">Unique Routes</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5 text-center">
            <Clock className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats?.total_hours || 0}</p>
            <p className="text-slate-400 text-sm">Flight Hours</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-5 text-center">
            <Gift className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-white">{stats?.rewards_earned || 0}</p>
            <p className="text-slate-400 text-sm">Points Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tier Benefits */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Your {currentTier.name} Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {currentTier.benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-center gap-3 text-slate-300">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-green-400" />
                  </div>
                  {benefit}
                </li>
              ))}
            </ul>
            
            {nextTier && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <p className="text-slate-400 text-sm mb-2">Unlock with {nextTier.name}:</p>
                <ul className="space-y-2">
                  {nextTier.benefits.slice(0, 2).map((benefit, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-500 text-sm">
                      <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center">
                        <Target className="h-3 w-3 text-slate-500" />
                      </div>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Flights */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              Recent Flights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!stats?.recent_flights || stats.recent_flights.length === 0) ? (
              <div className="text-center py-8 text-slate-500">
                <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No flights yet</p>
                <Button 
                  className="mt-4 bg-orange-500 hover:bg-orange-600"
                  onClick={() => window.location.href = '/booking'}
                >
                  Book Your First Flight
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recent_flights.slice(0, 5).map((flight, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-900/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                        <Plane className="h-5 w-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {flight.from_location} → {flight.to_location}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {flight.departure_date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-semibold text-sm">
                        {formatCurrency(flight.amount)}
                      </p>
                      <Badge className={`text-xs border-0 ${
                        flight.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        flight.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {flight.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Tiers Overview */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Loyalty Tier Roadmap</CardTitle>
          <CardDescription className="text-slate-400">
            Spend more to unlock better benefits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {LOYALTY_TIERS.map((tier, idx) => {
              const Icon = tier.icon;
              const isCurrentOrPast = idx <= tierIndex;
              return (
                <div 
                  key={idx}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    idx === tierIndex 
                      ? `bg-gradient-to-br ${tier.color} border-white/30` 
                      : isCurrentOrPast 
                        ? 'bg-slate-700/50 border-green-500/50' 
                        : 'bg-slate-900/50 border-slate-700'
                  }`}
                >
                  <Icon className={`h-8 w-8 mb-2 ${
                    idx === tierIndex ? 'text-white' : isCurrentOrPast ? 'text-green-400' : 'text-slate-500'
                  }`} />
                  <h3 className={`font-bold ${idx === tierIndex ? 'text-white' : isCurrentOrPast ? 'text-white' : 'text-slate-400'}`}>
                    {tier.name}
                  </h3>
                  <p className={`text-sm ${idx === tierIndex ? 'text-white/70' : 'text-slate-500'}`}>
                    {tier.minSpend === 0 ? '₹0' : formatCurrency(tier.minSpend)}+
                  </p>
                  {isCurrentOrPast && idx < tierIndex && (
                    <Badge className="mt-2 bg-green-500/20 text-green-400 border-0 text-xs">
                      ✓ Unlocked
                    </Badge>
                  )}
                  {idx === tierIndex && (
                    <Badge className="mt-2 bg-white/20 text-white border-0 text-xs">
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
