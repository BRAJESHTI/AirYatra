import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gavel, Clock, MapPin, Users, Plane, Calendar, Timer, 
  AlertCircle, CheckCircle, XCircle, Send, RefreshCw,
  TrendingDown, Eye, ChevronRight, Loader2, IndianRupee,
  Phone, User, Target, Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to format time remaining
const formatTimeRemaining = (timeRemaining) => {
  if (!timeRemaining || timeRemaining.expired) return 'Expired';
  return `${timeRemaining.minutes}m ${timeRemaining.seconds}s`;
};

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    active: { color: 'bg-green-500', label: 'Live', icon: Timer },
    closed: { color: 'bg-gray-500', label: 'Closed', icon: XCircle },
    quote_selected: { color: 'bg-blue-500', label: 'Quote Selected', icon: CheckCircle },
    confirmed: { color: 'bg-purple-500', label: 'Confirmed', icon: CheckCircle },
    cancelled: { color: 'bg-red-500', label: 'Cancelled', icon: XCircle },
    expired: { color: 'bg-orange-500', label: 'Expired', icon: AlertCircle },
  };
  
  const config = statusConfig[status] || statusConfig.active;
  const Icon = config.icon;
  
  return (
    <Badge className={`${config.color} text-white flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// Countdown Timer Component
const CountdownTimer = ({ endTime, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0, expired: false });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, expired: true });
        if (onExpire) onExpire();
        return;
      }
      
      setTimeLeft({
        minutes: Math.floor(diff / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        expired: false
      });
    };
    
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(interval);
  }, [endTime, onExpire]);
  
  if (timeLeft.expired) {
    return <span className="text-red-400 font-mono">Expired</span>;
  }
  
  const isUrgent = timeLeft.minutes < 1;
  
  return (
    <span className={`font-mono ${isUrgent ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
      {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
    </span>
  );
};

// Live Countdown Progress Bar — urgency to pick a quote
const CountdownBar = ({ startTime, endTime, onExpire }) => {
  const [state, setState] = useState({ pct: 100, minutes: 0, seconds: 0, expired: false });
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    let interval = null;
    const tick = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const start = startTime ? new Date(startTime).getTime() : end - 30 * 60000;
      const total = Math.max(end - start, 1);
      const diff = end - now;
      if (diff <= 0) {
        setState({ pct: 0, minutes: 0, seconds: 0, expired: true });
        if (interval) clearInterval(interval);
        if (!expiredRef.current) {
          expiredRef.current = true;
          if (onExpire) onExpire();
        }
        return;
      }
      setState({
        pct: Math.min(100, Math.max(0, (diff / total) * 100)),
        minutes: Math.floor(diff / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    };
    tick();
    interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime, endTime, onExpire]);

  if (state.expired) {
    return (
      <div className="mt-4" data-testid="auction-countdown-bar">
        <div className="w-full h-2 rounded-full bg-slate-800" />
        <p className="text-red-400 text-xs mt-1 font-medium">Auction ended</p>
      </div>
    );
  }

  const urgent = state.pct < 20 || (state.minutes === 0 && state.seconds <= 59);
  const warning = !urgent && state.pct < 50;
  const barColor = urgent ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-green-500';
  const textColor = urgent ? 'text-red-400' : warning ? 'text-amber-400' : 'text-green-400';

  return (
    <div className="mt-4" data-testid="auction-countdown-bar">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium flex items-center gap-1 ${textColor}`}>
          <Timer className={`h-3.5 w-3.5 ${urgent ? 'animate-pulse' : ''}`} />
          {urgent ? 'Hurry! Auction ending soon' : warning ? 'Auction closing — compare quotes now' : 'Auction live — quotes coming in'}
        </span>
        <span className={`font-mono text-sm font-bold ${textColor} ${urgent ? 'animate-pulse' : ''}`} data-testid="countdown-time-left">
          {String(state.minutes).padStart(2, '0')}:{String(state.seconds).padStart(2, '0')} left
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} ${urgent ? 'animate-pulse' : ''}`}
          style={{ width: `${state.pct}%`, transition: 'width 1s linear, background-color 0.5s' }}
        />
      </div>
    </div>
  );
};

// ============ CUSTOMER COMPONENTS ============

// Create Auction Form
export const CreateAuctionForm = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    travel_date: '',
    travel_time: '',
    passengers: 2,
    aircraft_category: 'helicopter',
    auction_duration_minutes: 5,
    contact_name: '',
    contact_phone: '',
    purpose: 'personal',
    special_requirements: '',
    max_budget: ''
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        passengers: parseInt(formData.passengers),
        auction_duration_minutes: parseInt(formData.auction_duration_minutes),
        max_budget: formData.max_budget ? parseFloat(formData.max_budget) : null
      };
      
      const response = await axios.post(`${API_URL}/api/auctions/create`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Auction Created! ${response.data.auction_number}`);
      if (onSuccess) onSuccess(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Route */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white">From*</Label>
          <Input
            value={formData.origin}
            onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
            placeholder="e.g., Mumbai, Delhi"
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
        <div>
          <Label className="text-white">To*</Label>
          <Input
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            placeholder="e.g., Shirdi, Vaishno Devi"
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
      </div>
      
      {/* Date & Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white">Travel Date*</Label>
          <Input
            type="date"
            value={formData.travel_date}
            onChange={(e) => setFormData({ ...formData, travel_date: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>
        <div>
          <Label className="text-white">Preferred Time</Label>
          <Input
            type="time"
            value={formData.travel_time}
            onChange={(e) => setFormData({ ...formData, travel_time: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>
      
      {/* Passengers & Aircraft */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white">Passengers*</Label>
          <Input
            type="number"
            min="1"
            max="20"
            value={formData.passengers}
            onChange={(e) => setFormData({ ...formData, passengers: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
        <div>
          <Label className="text-white">Aircraft Type</Label>
          <select
            value={formData.aircraft_category}
            onChange={(e) => setFormData({ ...formData, aircraft_category: e.target.value })}
            className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md text-white px-3"
          >
            <option value="helicopter">Helicopter</option>
            <option value="light_jet">Light Jet</option>
            <option value="mid_jet">Mid Jet</option>
            <option value="heavy_jet">Heavy Jet</option>
          </select>
        </div>
      </div>
      
      {/* Contact */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white">Contact Name*</Label>
          <Input
            value={formData.contact_name}
            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
        <div>
          <Label className="text-white">Phone*</Label>
          <Input
            value={formData.contact_phone}
            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            placeholder="+91 98765 43210"
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
      </div>
      
      {/* Auction Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white">Auction Duration</Label>
          <select
            value={formData.auction_duration_minutes}
            onChange={(e) => setFormData({ ...formData, auction_duration_minutes: e.target.value })}
            className="w-full h-10 bg-slate-800 border border-slate-600 rounded-md text-white px-3"
          >
            <option value="3">3 minutes</option>
            <option value="5">5 minutes (Recommended)</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </div>
        <div>
          <Label className="text-white">Max BudgetOptional)</Label>
          <Input
            type="number"
            value={formData.max_budget}
            onChange={(e) => setFormData({ ...formData, max_budget: e.target.value })}
            placeholder="₹ 1,00,000"
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-orange-500 hover:bg-orange-600"
          data-testid="create-auction-submit"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
          ) : (
            <><Gavel className="h-4 w-4 mr-2" /> Start Auction</>
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

// Customer Active Auctions
export const CustomerAuctions = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const fetchAuctions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/auctions/customer/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuctions(response.data.auctions || []);
    } catch (error) {
      console.error('Failed to fetch auctions:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchAuctions();
    // Refresh every 10 seconds
    const interval = setInterval(fetchAuctions, 10000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);
  
  const handleSelectQuote = async (auctionId, quoteId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/auctions/${auctionId}/select-quote`, 
        { quote_id: quoteId },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Quote selected! Proceed to payment.');
      fetchAuctions();
      setSelectedAuction(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to select quote');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gavel className="h-6 w-6 text-orange-400" />
            My Auctions</h2>
          <p className="text-slate-400 text-sm mt-1">
            Live reverse auctions for custom routes
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchAuctions} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button 
            onClick={() => setShowCreateForm(true)} 
            className="bg-orange-500 hover:bg-orange-600"
            data-testid="create-auction-btn"
          >
            <Gavel className="h-4 w-4 mr-2" /> New Auction
          </Button>
        </div>
      </div>
      
      {/* Create Form Modal */}
      {showCreateForm && (
        <Card className="bg-slate-900 border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Gavel className="h-5 w-5 text-orange-400" />
              Create New Auction</CardTitle>
            <CardDescription>
              Get competitive quotes from multiple operators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAuctionForm 
              onSuccess={() => { setShowCreateForm(false); fetchAuctions(); }}
              onCancel={() => setShowCreateForm(false)}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Active Auctions */}
      {auctions.length === 0 ? (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-12 text-center">
            <Gavel className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Active Auctions</h3>
            <p className="text-slate-400 mb-4">Create an auction to get quotes from operators</p>
            <Button onClick={() => setShowCreateForm(true)} className="bg-orange-500 hover:bg-orange-600">
              <Gavel className="h-4 w-4 mr-2" /> Create Auction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {auctions.map((auction) => (
            <Card 
              key={auction.id} 
              className={`bg-slate-900 border-slate-700 ${
                auction.status === 'active' ? 'border-green-500/50' : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  {/* Route Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <StatusBadge status={auction.status} />
                      <span className="text-slate-400 text-sm">
                        {auction.auction_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xl font-semibold text-white">
                      <MapPin className="h-5 w-5 text-orange-400" />
                      {auction.origin}
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                      {auction.destination}
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" /> {auction.travel_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" /> {auction.passengers} passengers
                      </span>
                      <span className="flex items-center gap-1">
                        <Plane className="h-4 w-4" /> {auction.aircraft_category}
                      </span>
                    </div>
                  </div>
                  
                  {/* Timer & Stats */}
                  <div className="text-right">
                    {auction.status === 'active' && (
                      <div className="mb-2">
                        <div className="text-slate-400 text-xs mb-1">Time Remaining</div>
                        <div className="text-2xl">
                          <CountdownTimer 
                            endTime={auction.end_time} 
                            onExpire={fetchAuctions}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-400">{auction.quotes_count}</div>
                        <div className="text-xs text-slate-400">Quotes</div>
                      </div>
                      {auction.lowest_quote && (
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-400 flex items-center">
                            <IndianRupee className="h-4 w-4" />
                            {auction.lowest_quote.toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-400">Lowest</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Live Countdown Bar */}
                {auction.status === 'active' && (
                  <CountdownBar
                    startTime={auction.start_time || auction.created_at}
                    endTime={auction.end_time}
                    onExpire={fetchAuctions}
                  />
                )}
                
                {/* Quotes List */}
                {auction.quotes && auction.quotes.length > 0 && (
                  <div className="mt-4 border-t border-slate-700 pt-4">
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-green-400" />
                      Received Quotes (Lowest First)
                    </h4>
                    <div className="space-y-2">
                      {auction.quotes.slice(0, 3).map((quote, idx) => (
                        <div 
                          key={quote.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            idx === 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {idx === 0 && <Badge className="bg-green-500">Best</Badge>}
                            <div>
                              <div className="text-white font-medium">
                                {quote.operator_name || 'Verified Operator'}
                              </div>
                              <div className="text-slate-400 text-sm">
                                {quote.aircraft_model} • {quote.estimated_flight_time || 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xl font-bold text-white flex items-center">
                                <IndianRupee className="h-4 w-4" />
                                {quote.total_amount.toLocaleString()}
                              </div>
                              <div className="text-xs text-slate-400">incl. GST</div>
                            </div>
                            {auction.status === 'active' && (
                              <Button
                                size="sm"
                                onClick={() => handleSelectQuote(auction.id, quote.id)}
                                className={idx === 0 ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}
                                data-testid={`select-quote-${idx}`}
                              >
                                Select
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {auction.quotes.length > 3 && (
                      <Button 
                        variant="ghost" 
                        className="w-full mt-2 text-slate-400"
                        onClick={() => setSelectedAuction(auction)}
                      >
                        View all {auction.quotes.length} quotes
                      </Button>
                    )}
                  </div>
                )}
                
                {/* No Quotes Yet */}
                {(!auction.quotes || auction.quotes.length === 0) && auction.status === 'active' && (
                  <div className="mt-4 border-t border-slate-700 pt-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-400 mx-auto mb-2" />
                    <p className="text-slate-400">Waiting for operator quotes...</p>
                    <p className="text-slate-500 text-sm">Operators have been notified</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ OPERATOR COMPONENTS ============

// Quote Submission Form
const QuoteForm = ({ auction, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    aircraft_type: auction.aircraft_category,
    aircraft_model: '',
    base_price: '',
    landing_charges: '5000',
    handling_charges: '3000',
    crew_charges: '8000',
    fuel_surcharge: '2000',
    other_charges: '0',
    discount: '0',
    estimated_flight_time: '',
    departure_time: auction.travel_time || '',
    operator_notes: ''
  });
  
  // Calculate total
  const calculateTotal = () => {
    const subtotal = 
      (parseFloat(formData.base_price) || 0) +
      (parseFloat(formData.landing_charges) || 0) +
      (parseFloat(formData.handling_charges) || 0) +
      (parseFloat(formData.crew_charges) || 0) +
      (parseFloat(formData.fuel_surcharge) || 0) +
      (parseFloat(formData.other_charges) || 0) -
      (parseFloat(formData.discount) || 0);
    const gst = subtotal * 0.18;
    return { subtotal, gst, total: subtotal + gst };
  };
  
  const totals = calculateTotal();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const payload = {
        aircraft_type: formData.aircraft_type,
        aircraft_model: formData.aircraft_model,
        base_price: parseFloat(formData.base_price) || 0,
        landing_charges: parseFloat(formData.landing_charges) || 0,
        handling_charges: parseFloat(formData.handling_charges) || 0,
        crew_charges: parseFloat(formData.crew_charges) || 0,
        fuel_surcharge: parseFloat(formData.fuel_surcharge) || 0,
        other_charges: parseFloat(formData.other_charges) || 0,
        discount: parseFloat(formData.discount) || 0,
        estimated_flight_time: formData.estimated_flight_time,
        departure_time: formData.departure_time,
        operator_notes: formData.operator_notes
      };
      
      await axios.post(`${API_URL}/api/auctions/${auction.id}/quote`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Quote submitted successfully!');
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit quote');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Aircraft Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white">Aircraft Type</Label>
          <Input
            value={formData.aircraft_type}
            onChange={(e) => setFormData({ ...formData, aircraft_type: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
        <div>
          <Label className="text-white">Model *</Label>
          <Input
            value={formData.aircraft_model}
            onChange={(e) => setFormData({ ...formData, aircraft_model: e.target.value })}
            placeholder="e.g., Bell 407, Citation XLS"
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
      </div>
      
      {/* Pricing */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-white">Base Price *</Label>
          <Input
            type="number"
            value={formData.base_price}
            onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
            placeholder="₹ 80,000"
            className="bg-slate-800 border-slate-600 text-white"
            required
          />
        </div>
        <div>
          <Label className="text-white">Landing Charges</Label>
          <Input
            type="number"
            value={formData.landing_charges}
            onChange={(e) => setFormData({ ...formData, landing_charges: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div>
          <Label className="text-white">Handling Charges</Label>
          <Input
            type="number"
            value={formData.handling_charges}
            onChange={(e) => setFormData({ ...formData, handling_charges: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div>
          <Label className="text-white">Crew Charges</Label>
          <Input
            type="number"
            value={formData.crew_charges}
            onChange={(e) => setFormData({ ...formData, crew_charges: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div>
          <Label className="text-white">Fuel Surcharge</Label>
          <Input
            type="number"
            value={formData.fuel_surcharge}
            onChange={(e) => setFormData({ ...formData, fuel_surcharge: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div>
          <Label className="text-white">Discount</Label>
          <Input
            type="number"
            value={formData.discount}
            onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>
      
      {/* Flight Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white">Est. Flight Time</Label>
          <Input
            value={formData.estimated_flight_time}
            onChange={(e) => setFormData({ ...formData, estimated_flight_time: e.target.value })}
            placeholder="e.g., 45 minutes"
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div>
          <Label className="text-white">Departure Time</Label>
          <Input
            type="time"
            value={formData.departure_time}
            onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>
      
      {/* Notes */}
      <div>
        <Label className="text-white">Notes for Customer</Label>
        <textarea
          value={formData.operator_notes}
          onChange={(e) => setFormData({ ...formData, operator_notes: e.target.value })}
          placeholder="Any special offers or conditions..."
          className="w-full h-20 bg-slate-800 border border-slate-600 rounded-md text-white p-3"
        />
      </div>
      
      {/* Totals */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex justify-between text-slate-400 mb-1">
          <span>Subtotal:</span>
          <span>₹ {totals.subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-slate-400 mb-2">
          <span>GST (18%):</span>
          <span>₹ {totals.gst.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-white text-xl font-bold border-t border-slate-700 pt-2">
          <span>Total:</span>
          <span className="text-green-400">₹ {totals.total.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-green-500 hover:bg-green-600"
          data-testid="submit-quote-btn"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" /> Submit Quote</>
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

// Operator Pending Auctions
export const OperatorAuctions = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState(null);
  
  const fetchAuctions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/auctions/operator/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuctions(response.data.auctions || []);
    } catch (error) {
      console.error('Failed to fetch auctions:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 10000);
    return () => clearInterval(interval);
  }, [fetchAuctions]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gavel className="h-6 w-6 text-orange-400" />
            Live Auctions</h2>
          <p className="text-slate-400 text-sm mt-1">
            Submit competitive quotes to win bookings
          </p>
        </div>
        <Button variant="outline" onClick={fetchAuctions} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>
      
      {/* Auctions List */}
      {auctions.length === 0 ? (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-12 text-center">
            <Gavel className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Active Auctions</h3>
            <p className="text-slate-400">New auction requests will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {auctions.map((auction) => (
            <Card key={auction.id} className="bg-slate-900 border-slate-700">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  {/* Auction Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className="bg-green-500 text-white flex items-center gap-1">
                        <Timer className="h-3 w-3" /> Live
                      </Badge>
                      <span className="text-slate-400 text-sm">{auction.auction_number}</span>
                      {auction.has_quoted && (
                        <Badge variant="outline" className="text-blue-400 border-blue-400">
                          <CheckCircle className="h-3 w-3 mr-1" /> Quoted
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xl font-semibold text-white mb-2">
                      <MapPin className="h-5 w-5 text-orange-400" />
                      {auction.origin}
                      <ChevronRight className="h-5 w-5 text-slate-500" />
                      {auction.destination}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="h-4 w-4" /> {auction.travel_date}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="h-4 w-4" /> {auction.travel_time || 'Flexible'}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Users className="h-4 w-4" /> {auction.passengers} pax
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Plane className="h-4 w-4" /> {auction.aircraft_category}
                      </div>
                    </div>
                    
                    {auction.max_budget && (
                      <div className="mt-2 text-sm text-yellow-400">
                        <Target className="h-4 w-4 inline mr-1" />
                        Max Budget: ₹ {auction.max_budget.toLocaleString()}
                      </div>
                    )}
                  </div>
                  
                  {/* Timer & Action */}
                  <div className="text-right ml-4">
                    <div className="mb-3">
                      <div className="text-slate-400 text-xs mb-1">Time Left</div>
                      <div className="text-3xl">
                        <CountdownTimer 
                          endTime={auction.end_time}
                          onExpire={fetchAuctions}
                        />
                      </div>
                    </div>
                    
                    <div className="text-sm text-slate-400 mb-3">
                      {auction.total_quotes} quote(s) received
                    </div>
                    
                    {auction.has_quoted ? (
                      <div className="text-green-400 text-sm">
                        <CheckCircle className="h-4 w-4 inline mr-1" />
                        Your quote: ₹ {auction.my_quote?.total_amount?.toLocaleString()}
                      </div>
                    ) : (
                      <Button
                        onClick={() => setSelectedAuction(auction)}
                        className="bg-orange-500 hover:bg-orange-600"
                        data-testid={`quote-auction-${auction.id.slice(0,8)}`}
                      >
                        <Send className="h-4 w-4 mr-2" /> Submit Quote
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Quote Form Modal */}
      {selectedAuction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-orange-400" />
                Submit Quote for {selectedAuction.origin} → {selectedAuction.destination}
              </CardTitle>
              <CardDescription>
                {selectedAuction.travel_date} • {selectedAuction.passengers} passengers • {selectedAuction.aircraft_category}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuoteForm
                auction={selectedAuction}
                onSuccess={() => { setSelectedAuction(null); fetchAuctions(); }}
                onCancel={() => setSelectedAuction(null)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// Export main dashboard
export default function AuctionDashboard({ userRole = 'customer' }) {
  return (
    <div className="p-6 bg-slate-950 min-h-screen">
      {userRole === 'operator' ? (
        <OperatorAuctions />
      ) : (
        <CustomerAuctions />
      )}
    </div>
  );
}
