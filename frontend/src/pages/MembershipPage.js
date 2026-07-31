import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Crown, Check, Star, Zap, Shield, Users, Clock, Gift, ArrowRight, Sparkles } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MembershipPage = ({ user }) => {
  const [tiers, setTiers] = useState(null);
  const [userMembership, setUserMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null);

  const tierIcons = {
    silver: <Star className="h-8 w-8" />,
    gold: <Crown className="h-8 w-8" />,
    platinum: <Zap className="h-8 w-8" />,
    black: <Shield className="h-8 w-8" />
  };

  const tierColors = {
    silver: 'from-slate-400 to-slate-600',
    gold: 'from-amber-400 to-amber-600',
    platinum: 'from-purple-400 to-purple-600',
    black: 'from-slate-900 to-black'
  };

  const tierBorderColors = {
    silver: 'border-slate-400',
    gold: 'border-amber-400',
    platinum: 'border-purple-400',
    black: 'border-slate-800'
  };

  useEffect(() => {
    fetchTiers();
    if (user?.id) {
      fetchUserMembership();
    }
  }, [user]);

  const fetchTiers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/membership/tiers`);
      const data = await response.json();
      if (data.success) {
        setTiers(data.tiers);
      }
    } catch (error) {
      console.error('Error fetching tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserMembership = async () => {
    try {
      const response = await fetch(`${API_URL}/api/membership/my-membership/${user.id}`);
      const data = await response.json();
      if (data.success && data.has_membership) {
        setUserMembership(data.membership);
      }
    } catch (error) {
      console.error('Error fetching membership:', error);
    }
  };

  const handleSubscribe = async (tier) => {
    if (!user) {
      alert('Please login to subscribe');
      return;
    }

    setSubscribing(true);
    setSelectedTier(tier);

    try {
      const response = await fetch(`${API_URL}/api/membership/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          tier: tier,
          payment_method: 'online',
          auto_renew: true
        })
      });

      const data = await response.json();
      if (data.success) {
        setUserMembership(data.membership);
        alert(`Welcome to AirYatra ${tiers[tier].name} Membership!`);
      } else {
        alert(data.detail || 'Subscription failed');
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      alert('Subscription failed. Please try again.');
    } finally {
      setSubscribing(false);
      setSelectedTier(null);
    }
  };

  const handleUpgrade = async (newTier) => {
    if (!user || !userMembership) return;

    setSubscribing(true);
    setSelectedTier(newTier);

    try {
      const response = await fetch(`${API_URL}/api/membership/upgrade?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_tier: newTier,
          payment_method: 'online'
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchUserMembership();
        alert(`Successfully upgraded to ${tiers[newTier].name}!`);
      } else {
        alert(data.detail || 'Upgrade failed');
      }
    } catch (error) {
      console.error('Error upgrading:', error);
    } finally {
      setSubscribing(false);
      setSelectedTier(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const tierOrder = ['silver', 'gold', 'platinum', 'black'];
  const currentTierIndex = userMembership ? tierOrder.indexOf(userMembership.tier) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-orange-500" />
            <span className="text-orange-500 font-semibold uppercase tracking-wider">Premium Membership</span>
            <Sparkles className="h-6 w-6 text-orange-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            AirYatra <span className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">BLACK</span> Membership
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Unlock exclusive benefits, priority booking, and luxury experiences with our premium membership tiers
          </p>
        </div>

        {/* Current Membership Status */}
        {userMembership && (
          <div className={`mb-12 p-6 rounded-2xl bg-gradient-to-r ${tierColors[userMembership.tier]} shadow-2xl`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  {tierIcons[userMembership.tier]}
                </div>
                <div>
                  <p className="text-white/80 text-sm">Your Current Membership</p>
                  <h3 className="text-2xl font-bold text-white">{tiers[userMembership.tier]?.name} Member</h3>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm">Card Number</p>
                <p className="text-white font-mono text-lg">{userMembership.card_number}</p>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm">Valid Until</p>
                <p className="text-white font-semibold">
                  {new Date(userMembership.expiry_date).toLocaleDateString('en-IN', { 
                    day: 'numeric', month: 'short', year: 'numeric' 
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm">Total Savings</p>
                <p className="text-white font-bold text-xl">{formatCurrency(userMembership.total_savings)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tierOrder.map((tierKey, index) => {
            const tier = tiers[tierKey];
            const isCurrentTier = userMembership?.tier === tierKey;
            const canUpgrade = userMembership && index > currentTierIndex;
            const canSubscribe = !userMembership;

            return (
              <Card 
                key={tierKey}
                data-testid={`membership-tier-${tierKey}`}
                className={`relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl
                  ${isCurrentTier ? 'ring-2 ring-orange-500' : ''} 
                  ${tierKey === 'black' ? 'bg-slate-950 border-slate-700' : 'bg-slate-800/50 border-slate-700'}
                `}
              >
                {/* Popular Badge */}
                {tierKey === 'platinum' && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-orange-500 text-white">Most Popular</Badge>
                  </div>
                )}
                
                {isCurrentTier && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-green-500 text-white">Current</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className={`inline-flex mx-auto p-4 rounded-2xl bg-gradient-to-br ${tierColors[tierKey]} text-white mb-4`}>
                    {tierIcons[tierKey]}
                  </div>
                  <CardTitle className="text-white text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-slate-400">
                    {tierKey === 'silver' && 'Perfect start for occasional flyers'}
                    {tierKey === 'gold' && 'For frequent business travelers'}
                    {tierKey === 'platinum' && 'Premium experience for VIPs'}
                    {tierKey === 'black' && 'Ultimate luxury & exclusivity'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Price */}
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">
                      {formatCurrency(tier.annual_fee)}
                    </div>
                    <p className="text-slate-400 text-sm">per year</p>
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-orange-400">{tier.discount_percent}%</p>
                      <p className="text-xs text-slate-400">Discount</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-orange-400">{tier.loyalty_multiplier}x</p>
                      <p className="text-xs text-slate-400">Points</p>
                    </div>
                  </div>

                  {/* Benefits List */}
                  <div className="space-y-2">
                    {tier.benefits.slice(0, 5).map((benefit, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-400 mt-1 flex-shrink-0" />
                        <span className="text-slate-300 text-sm">{benefit}</span>
                      </div>
                    ))}
                    {tier.benefits.length > 5 && (
                      <p className="text-orange-400 text-sm font-medium">
                        + {tier.benefits.length - 5} more benefits
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-4">
                    {isCurrentTier ? (
                      <Button 
                        className="w-full bg-slate-600 text-white cursor-default"
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : canUpgrade ? (
                      <Button 
                        data-testid={`upgrade-to-${tierKey}`}
                        className={`w-full bg-gradient-to-r ${tierColors[tierKey]} text-white hover:opacity-90`}
                        onClick={() => handleUpgrade(tierKey)}
                        disabled={subscribing}
                      >
                        {subscribing && selectedTier === tierKey ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Processing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Upgrade <ArrowRight className="h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    ) : canSubscribe ? (
                      <Button 
                        data-testid={`subscribe-${tierKey}`}
                        className={`w-full bg-gradient-to-r ${tierColors[tierKey]} text-white hover:opacity-90`}
                        onClick={() => handleSubscribe(tierKey)}
                        disabled={subscribing}
                      >
                        {subscribing && selectedTier === tierKey ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Processing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Subscribe Now <ArrowRight className="h-4 w-4" />
                          </span>
                        )}
                      </Button>
                    ) : (
                      <Button 
                        className="w-full bg-slate-700 text-slate-400"
                        disabled
                      >
                        Lower Tier
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Compare All Features</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 p-4">Feature</th>
                  {tierOrder.map(tierKey => (
                    <th key={tierKey} className="text-center p-4">
                      <span className={`text-${tierKey === 'gold' ? 'amber' : tierKey === 'platinum' ? 'purple' : tierKey === 'black' ? 'slate' : 'slate'}-400 font-semibold`}>
                        {tiers[tierKey].name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-700/50">
                  <td className="text-slate-300 p-4">Priority Booking</td>
                  {tierOrder.map(tierKey => (
                    <td key={tierKey} className="text-center p-4">
                      {tiers[tierKey].priority_booking ? 
                        <Check className="h-5 w-5 text-green-400 mx-auto" /> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="text-slate-300 p-4">Dedicated Pilot</td>
                  {tierOrder.map(tierKey => (
                    <td key={tierKey} className="text-center p-4">
                      {tiers[tierKey].dedicated_pilot ? 
                        <Check className="h-5 w-5 text-green-400 mx-auto" /> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="text-slate-300 p-4">Lounge Access</td>
                  {tierOrder.map(tierKey => (
                    <td key={tierKey} className="text-center p-4">
                      {tiers[tierKey].lounge_access ? 
                        <Check className="h-5 w-5 text-green-400 mx-auto" /> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="text-slate-300 p-4">24x7 Concierge</td>
                  {tierOrder.map(tierKey => (
                    <td key={tierKey} className="text-center p-4">
                      {tiers[tierKey].concierge_24x7 ? 
                        <Check className="h-5 w-5 text-green-400 mx-auto" /> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="text-slate-300 p-4">Free Cancellation</td>
                  {tierOrder.map(tierKey => (
                    <td key={tierKey} className="text-center p-4">
                      {tiers[tierKey].free_cancellation ? 
                        <Check className="h-5 w-5 text-green-400 mx-auto" /> : 
                        <span className="text-slate-600">-</span>
                      }
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="text-slate-300 p-4">Max Guests</td>
                  {tierOrder.map(tierKey => (
                    <td key={tierKey} className="text-center text-slate-300 p-4">
                      {tiers[tierKey].max_guests}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA Section */}
        {!userMembership && (
          <div className="mt-16 text-center bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-2xl p-8 border border-orange-500/30">
            <Gift className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">Not sure which plan is right for you?</h3>
            <p className="text-slate-400 mb-6">Start with Silver and upgrade anytime. Your benefits start immediately!</p>
            <Button 
              data-testid="cta-subscribe-silver"
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-6 text-lg"
              onClick={() => handleSubscribe('silver')}
            >
              Start with Silver Membership
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MembershipPage;
