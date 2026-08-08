import React, { useState, useEffect, useCallback } from 'react';
import { Plane, MapPin, Clock, IndianRupee, Zap, Users, Calendar, ArrowRight, Timer, Check, AlertCircle, Loader2, TrendingUp, Gavel, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Popular routes for quick selection
const POPULAR_ROUTES = [
  { from: 'Mumbai', to: 'Shirdi', label: 'Mumbai → Shirdi' },
  { from: 'Delhi', to: 'Agra', label: 'Delhi → Agra' },
  { from: 'Bangalore', to: 'Coorg', label: 'Bangalore → Coorg' },
  { from: 'Mumbai', to: 'Pune', label: 'Mumbai → Pune' },
  { from: 'Chennai', to: 'Tirupati', label: 'Chennai → Tirupati' },
];

const BOOKING_TYPES = [
  { value: 'one_way', label: 'One Way / एक तरफ', icon: '→' },
  { value: 'round_trip', label: 'Round Trip / वापसी', icon: '⟲' },
  { value: 'charter', label: 'Charter / चार्टर', icon: '✈️' },
];

// Instant Quote Section
function InstantQuoteSection() {
  const [formData, setFormData] = useState({
    from_location: '',
    to_location: '',
    departure_date: new Date().toISOString().split('T')[0],
    booking_type: 'one_way',
    passenger_count: 2,
    aircraft_type: 'helicopter',
  });
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chargesBreakdown, setChargesBreakdown] = useState(null);

  const getInstantQuote = async () => {
    if (!formData.from_location || !formData.to_location) {
      toast.error('Please select origin and destination');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/pricing/instant-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          departure_date: new Date(formData.departure_date).toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setQuote(data);
        toast.success(`Quote generated: ₹${data.final_price?.toLocaleString('en-IN')}`);
        
        // Get detailed breakdown
        const breakdownRes = await fetch(
          `${API_URL}/api/asre/pricing/charges-breakdown?from_location=${formData.from_location}&to_location=${formData.to_location}&aircraft_type=${formData.aircraft_type}&booking_type=${formData.booking_type}&passenger_count=${formData.passenger_count}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const breakdownData = await breakdownRes.json();
        if (breakdownData.success) {
          setChargesBreakdown(breakdownData.breakdown);
        }
      } else {
        toast.error(data.detail || 'Failed to get quote');
      }
    } catch (error) {
      toast.error('Error getting quote');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectPopularRoute = (route) => {
    setFormData(prev => ({
      ...prev,
      from_location: route.from,
      to_location: route.to,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Quick Route Selection */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 mr-2 self-center">Popular Routes:</span>
        {POPULAR_ROUTES.map((route, idx) => (
          <Button
            key={idx}
            variant="outline"
            size="sm"
            onClick={() => selectPopularRoute(route)}
            className="text-xs"
          >
            {route.label}
          </Button>
        ))}
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label className="text-sm font-medium">From / कहां से</Label>
          <Input
            placeholder="Mumbai, Delhi, Bangalore..."
            value={formData.from_location}
            onChange={(e) => setFormData(prev => ({ ...prev, from_location: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">To / कहां तक</Label>
          <Input
            placeholder="Shirdi, Agra, Coorg..."
            value={formData.to_location}
            onChange={(e) => setFormData(prev => ({ ...prev, to_location: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Date / तारीख</Label>
          <Input
            type="date"
            value={formData.departure_date}
            onChange={(e) => setFormData(prev => ({ ...prev, departure_date: e.target.value }))}
            min={new Date().toISOString().split('T')[0]}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-sm font-medium">Booking Type / प्रकार</Label>
          <Select
            value={formData.booking_type}
            onValueChange={(val) => setFormData(prev => ({ ...prev, booking_type: val }))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Passengers / यात्री</Label>
          <Select
            value={formData.passenger_count.toString()}
            onValueChange={(val) => setFormData(prev => ({ ...prev, passenger_count: parseInt(val) }))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <SelectItem key={n} value={n.toString()}>{n} Passenger{n > 1 ? 's' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">Aircraft / विमान</Label>
          <Select
            value={formData.aircraft_type}
            onValueChange={(val) => setFormData(prev => ({ ...prev, aircraft_type: val }))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="helicopter">🚁 Helicopter</SelectItem>
              <SelectItem value="light_jet">✈️ Light Jet</SelectItem>
              <SelectItem value="turboprop">🛩️ Turboprop</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={getInstantQuote} 
        disabled={loading}
        className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
        size="lg"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating...</>
        ) : (
          <><Zap className="w-4 h-4 mr-2" /> Get Instant Quote / तुरंत कोट पाएं</>
        )}
      </Button>

      {/* Quote Result */}
      {quote && (
        <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                Quote Ready / कोट तैयार
              </CardTitle>
              <Badge variant={quote.pricing_type === 'fixed_route' ? 'default' : 'secondary'}>
                {quote.pricing_type === 'fixed_route' ? '✓ Fixed Price' : '📊 Dynamic'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Route Info */}
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-orange-500" />
              <span className="font-medium">{quote.route?.from}</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{quote.route?.to}</span>
              <span className="text-gray-500">({quote.route?.distance_km?.toFixed(0)} km)</span>
            </div>

            {/* Flight Time */}
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Flight Time: <strong>{quote.route?.flight_time_hours?.toFixed(1)} hrs</strong></span>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Base Price</span>
                <span>₹{quote.price_breakdown?.base_price?.toLocaleString('en-IN')}</span>
              </div>
              {quote.price_breakdown?.demand_adjustment !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Demand Adjustment</span>
                  <span className={quote.price_breakdown?.demand_adjustment > 0 ? 'text-red-500' : 'text-green-500'}>
                    {quote.price_breakdown?.demand_adjustment > 0 ? '+' : ''}₹{quote.price_breakdown?.demand_adjustment?.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {quote.price_breakdown?.time_adjustment !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Time Adjustment</span>
                  <span>₹{quote.price_breakdown?.time_adjustment?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Platform Fee (15%)</span>
                <span>₹{quote.price_breakdown?.platform_fee?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">GST (18%)</span>
                <span>₹{quote.price_breakdown?.gst?.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total / कुल</span>
                <span className="text-orange-600">₹{quote.final_price?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Detailed Charges */}
            {chargesBreakdown && (
              <details className="text-sm">
                <summary className="cursor-pointer text-orange-600 hover:underline">View Detailed Breakdown</summary>
                <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded p-3 space-y-1">
                  {chargesBreakdown.fuel_cost > 0 && (
                    <div className="flex justify-between"><span>Fuel Cost</span><span>₹{chargesBreakdown.fuel_cost?.toLocaleString('en-IN')}</span></div>
                  )}
                  {chargesBreakdown.crew_cost > 0 && (
                    <div className="flex justify-between"><span>Crew Cost</span><span>₹{chargesBreakdown.crew_cost?.toLocaleString('en-IN')}</span></div>
                  )}
                  {chargesBreakdown.landing_charges > 0 && (
                    <div className="flex justify-between"><span>Landing Charges</span><span>₹{chargesBreakdown.landing_charges?.toLocaleString('en-IN')}</span></div>
                  )}
                  {chargesBreakdown.repositioning_cost > 0 && (
                    <div className="flex justify-between text-amber-600"><span>Repositioning Cost</span><span>₹{chargesBreakdown.repositioning_cost?.toLocaleString('en-IN')}</span></div>
                  )}
                </div>
              </details>
            )}

            {/* Quote Validity */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Timer className="w-3 h-3" />
              Quote valid for 15 minutes • Quote ID: {quote.quote_id}
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button className="flex-1 bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" /> Book Now / अभी बुक करें
            </Button>
            <Button variant="outline" onClick={() => setQuote(null)}>
              <RefreshCw className="w-4 h-4 mr-2" /> New Quote
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

// Active Auctions Section (Customer's reverse auctions)
function MyAuctionsSection() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyAuctions();
  }, []);

  const fetchMyAuctions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/auction/customer/active`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setAuctions(data.auctions || []);
      }
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptBid = async (auctionId, bidId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/auction/${auctionId}/accept/${bidId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Bid accepted! Operator will contact you soon.');
        fetchMyAuctions();
      } else {
        toast.error(data.detail || 'Failed to accept bid');
      }
    } catch (error) {
      toast.error('Error accepting bid');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (auctions.length === 0) {
    return (
      <div className="text-center py-12">
        <Gavel className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Active Auctions</h3>
        <p className="text-sm text-gray-500 mt-2">
          When you request a quote for a route without fixed pricing, operators will bid for your trip.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {auctions.map((auction) => (
        <Card key={auction.auction_id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Gavel className="w-4 h-4 text-blue-500" />
                {auction.from_location} → {auction.to_location}
              </CardTitle>
              <Badge variant={auction.auction_status === 'active' ? 'default' : 'secondary'}>
                {auction.auction_status === 'active' ? '🔴 LIVE' : auction.auction_status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(auction.departure_date).toLocaleDateString('en-IN')}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {auction.passenger_count} passengers
              </span>
            </div>

            {/* Bids */}
            {auction.operator_bids?.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Operator Bids ({auction.operator_bids.length})</h4>
                {auction.operator_bids.map((bid, idx) => (
                  <div key={bid.bid_id || idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div>
                      <p className="font-medium">{bid.operator_name || 'Operator'}</p>
                      <p className="text-xs text-gray-500">{bid.aircraft_type} • {bid.aircraft_registration}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">₹{bid.quoted_price?.toLocaleString('en-IN')}</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => acceptBid(auction.auction_id, bid.bid_id)}
                        className="mt-1"
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500">Waiting for operator bids...</p>
                <p className="text-xs text-gray-400 mt-1">Usually takes 5-10 minutes</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Start New Auction Form
function StartAuctionSection() {
  const [formData, setFormData] = useState({
    booking_id: `BK-${Date.now()}`,
    from_location: '',
    to_location: '',
    departure_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    passenger_count: 2,
    booking_type: 'one_way',
    max_budget: '',
    special_requirements: '',
  });
  const [loading, setLoading] = useState(false);

  const startAuction = async () => {
    if (!formData.from_location || !formData.to_location) {
      toast.error('Please fill origin and destination');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/auction/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          departure_date: new Date(formData.departure_date).toISOString(),
          max_budget: formData.max_budget ? parseFloat(formData.max_budget) : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Auction started! Operators are being notified.');
        setFormData({
          booking_id: `BK-${Date.now()}`,
          from_location: '',
          to_location: '',
          departure_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          passenger_count: 2,
          booking_type: 'one_way',
          max_budget: '',
          special_requirements: '',
        });
      } else {
        toast.error(data.detail || 'Failed to start auction');
      }
    } catch (error) {
      toast.error('Error starting auction');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="w-5 h-5 text-purple-500" />
          Start Reverse Auction / रिवर्स नीलामी शुरू करें
        </CardTitle>
        <p className="text-sm text-gray-500">
          Post your trip requirements and let operators compete to offer you the best price.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>From / कहां से</Label>
            <Input
              placeholder="Mumbai, Delhi..."
              value={formData.from_location}
              onChange={(e) => setFormData(prev => ({ ...prev, from_location: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>To / कहां तक</Label>
            <Input
              placeholder="Shirdi, Agra..."
              value={formData.to_location}
              onChange={(e) => setFormData(prev => ({ ...prev, to_location: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Departure Date</Label>
            <Input
              type="date"
              value={formData.departure_date}
              onChange={(e) => setFormData(prev => ({ ...prev, departure_date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Passengers</Label>
            <Select
              value={formData.passenger_count.toString()}
              onValueChange={(val) => setFormData(prev => ({ ...prev, passenger_count: parseInt(val) }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Max Budget (Optional) / अधिकतम बजट</Label>
            <Input
              type="number"
              placeholder="₹ Leave empty for no limit"
              value={formData.max_budget}
              onChange={(e) => setFormData(prev => ({ ...prev, max_budget: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Special Requirements / विशेष आवश्यकताएं</Label>
            <Input
              placeholder="Medical, VIP, Luggage..."
              value={formData.special_requirements}
              onChange={(e) => setFormData(prev => ({ ...prev, special_requirements: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={startAuction} 
          disabled={loading}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
          ) : (
            <><Gavel className="w-4 h-4 mr-2" /> Start Auction / नीलामी शुरू करें</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// Main ASRE Booking Widget
export default function ASREBookingWidget() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-500" />
            Smart Booking / स्मार्ट बुकिंग
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            AI-powered instant quotes and reverse auctions for best prices
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="instant-quote" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="instant-quote" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Instant Quote</span>
            <span className="sm:hidden">Quote</span>
          </TabsTrigger>
          <TabsTrigger value="my-auctions" className="flex items-center gap-2">
            <Gavel className="w-4 h-4" />
            <span className="hidden sm:inline">My Auctions</span>
            <span className="sm:hidden">Auctions</span>
          </TabsTrigger>
          <TabsTrigger value="start-auction" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Start Auction</span>
            <span className="sm:hidden">New</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instant-quote" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                Get Instant Quote / तुरंत कोट पाएं
              </CardTitle>
              <p className="text-sm text-gray-500">
                Real-time pricing based on distance, demand, and availability
              </p>
            </CardHeader>
            <CardContent>
              <InstantQuoteSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-auctions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-blue-500" />
                My Active Auctions / मेरी नीलामियां
              </CardTitle>
              <p className="text-sm text-gray-500">
                View bids from operators and accept the best offer
              </p>
            </CardHeader>
            <CardContent>
              <MyAuctionsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="start-auction" className="mt-6">
          <StartAuctionSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
