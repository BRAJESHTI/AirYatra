import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, TrendingDown, Minus, MapPin, Calendar, RefreshCw,
  DollarSign, ArrowRight, Sparkles, Clock, Info
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Popular routes (can be expanded)
const POPULAR_ROUTES = [
  { from: 'Mumbai', to: 'Shirdi', label: 'Mumbai → Shirdi' },
  { from: 'Mumbai', to: 'Pune', label: 'Mumbai → Pune' },
  { from: 'Delhi', to: 'Agra', label: 'Delhi → Agra' },
  { from: 'Bangalore', to: 'Coorg', label: 'Bangalore → Coorg' },
  { from: 'Chennai', to: 'Tirupati', label: 'Chennai → Tirupati' },
];

export default function FlightPriceHistory({ user }) {
  const [selectedRoute, setSelectedRoute] = useState(POPULAR_ROUTES[0]);
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPriceHistory();
  }, [selectedRoute]);

  const loadPriceHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_URL}/api/pricing/history?from=${encodeURIComponent(selectedRoute.from)}&to=${encodeURIComponent(selectedRoute.to)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const json = await res.json();
        setPriceData(json);
      }
    } catch (err) {
      console.error('Failed to load price history:', err);
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

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-red-400" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-green-400" />;
    return <Minus className="h-4 w-4 text-slate-400" />;
  };

  const getTrendColor = (trend) => {
    if (trend > 0) return 'text-red-400';
    if (trend < 0) return 'text-green-400';
    return 'text-slate-400';
  };

  const getBestTimeToBook = () => {
    if (!priceData?.monthly_avg) return null;
    const sorted = [...priceData.monthly_avg].sort((a, b) => a.avg_price - b.avg_price);
    return sorted[0];
  };

  const bestTime = getBestTimeToBook();

  return (
    <div className="space-y-6 p-6" data-testid="price-history">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-green-500" />
            Price Trends
          </h1>
          <p className="text-slate-400 mt-1">Track price history to find the best time to book</p>
        </div>
        <Button 
          onClick={loadPriceHistory} 
          variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Route Selector */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              <span className="text-slate-400">Select Route:</span>
            </div>
            <Select
              value={selectedRoute.label}
              onValueChange={(value) => {
                const route = POPULAR_ROUTES.find(r => r.label === value);
                if (route) setSelectedRoute(route);
              }}
            >
              <SelectTrigger className="w-[250px] bg-slate-900 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {POPULAR_ROUTES.map((route, idx) => (
                  <SelectItem key={idx} value={route.label} className="text-white hover:bg-slate-800">
                    {route.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Current Price</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {formatCurrency(priceData?.current_price)}
                    </p>
                    <div className={`flex items-center gap-1 mt-1 ${getTrendColor(priceData?.trend_percent)}`}>
                      {getTrendIcon(priceData?.trend_percent)}
                      <span className="text-sm">{Math.abs(priceData?.trend_percent || 0)}% vs last month</span>
                    </div>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Lowest Price</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {formatCurrency(priceData?.lowest_price)}
                    </p>
                    <p className="text-green-200 text-sm mt-1">{priceData?.lowest_month || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <TrendingDown className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-600 to-red-700 border-0">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-red-100 text-sm font-medium">Highest Price</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {formatCurrency(priceData?.highest_price)}
                    </p>
                    <p className="text-red-200 text-sm mt-1">{priceData?.highest_month || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Average Price</p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {formatCurrency(priceData?.avg_price)}
                    </p>
                    <p className="text-purple-200 text-sm mt-1">Last 6 months</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Minus className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Best Time to Book */}
          {bestTime && (
            <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <Sparkles className="h-8 w-8 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <span>💡 Best Time to Book</span>
                      <Badge className="bg-green-500/20 text-green-400 border-0">Tip</Badge>
                    </h3>
                    <p className="text-slate-300 mt-1">
                      Prices are typically lowest in <strong className="text-green-400">{bestTime.month}</strong> at around {formatCurrency(bestTime.avg_price)}. 
                      Book during this period to save up to {formatCurrency((priceData?.highest_price || 0) - bestTime.avg_price)}!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price History Chart */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                Price History (Last 6 Months)
              </CardTitle>
              <CardDescription className="text-slate-400">
                {selectedRoute.from} → {selectedRoute.to}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {priceData?.monthly_avg?.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceData.monthly_avg}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                        formatter={(value) => [formatCurrency(value), 'Avg Price']}
                      />
                      <Area type="monotone" dataKey="avg_price" stroke="#f97316" strokeWidth={2} fill="url(#priceGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No historical data available for this route</p>
                    <p className="text-sm mt-1">Check back after some bookings are made</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Tips */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Booking Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                    <Calendar className="h-5 w-5 text-blue-400" />
                  </div>
                  <h4 className="text-white font-semibold mb-1">Book Early</h4>
                  <p className="text-slate-400 text-sm">Book 2-4 weeks in advance for better rates and availability</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                    <TrendingDown className="h-5 w-5 text-green-400" />
                  </div>
                  <h4 className="text-white font-semibold mb-1">Avoid Peak Season</h4>
                  <p className="text-slate-400 text-sm">Prices are higher during festivals and long weekends</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                  </div>
                  <h4 className="text-white font-semibold mb-1">Use Loyalty Points</h4>
                  <p className="text-slate-400 text-sm">Earn and redeem points for discounts on future bookings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
