import React, { useState, useEffect, useCallback } from 'react';
import { Plane, MapPin, Clock, IndianRupee, Zap, Users, Calendar, ArrowRight, Timer, Check, AlertCircle, Loader2, TrendingUp, Gavel, RefreshCw, Navigation, Fuel, Settings, Plus, Edit, Trash2, Eye, CheckCircle, XCircle, DollarSign, Target, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Fleet Positioning Dashboard
function FleetPositioningSection() {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLocation, setSearchLocation] = useState('');
  const [nearestResults, setNearestResults] = useState(null);

  useEffect(() => {
    fetchFleetLocations();
  }, []);

  const fetchFleetLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/fleet/locations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setFleet(data.fleet || []);
      }
    } catch (error) {
      console.error('Error fetching fleet:', error);
    } finally {
      setLoading(false);
    }
  };

  const findNearestAircraft = async () => {
    if (!searchLocation) {
      toast.error('Please enter a location');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/asre/fleet/nearest?location=${encodeURIComponent(searchLocation)}&passenger_count=1`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setNearestResults(data);
        toast.success(`Found ${data.count} aircraft near ${searchLocation}`);
      } else {
        toast.error(data.detail || 'Location not found');
      }
    } catch (error) {
      toast.error('Error finding nearest aircraft');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Find Nearest Aircraft */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-500" />
            Find Nearest Aircraft / सबसे नजदीकी विमान खोजें
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter pickup location (Mumbai, Delhi, Shirdi...)"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="flex-1"
            />
            <Button onClick={findNearestAircraft} className="bg-blue-600 hover:bg-blue-700">
              <Navigation className="w-4 h-4 mr-2" /> Find
            </Button>
          </div>

          {nearestResults && (
            <div className="mt-4 space-y-3">
              <h4 className="font-medium text-sm">
                {nearestResults.count} Aircraft Near {nearestResults.pickup_location}
              </h4>
              <div className="space-y-2">
                {nearestResults.aircraft?.slice(0, 5).map((ac, idx) => (
                  <div key={ac.aircraft_id || idx} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <Plane className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{ac.registration}</p>
                        <p className="text-xs text-gray-500">{ac.type} • {ac.seats} seats</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{ac.distance_km?.toFixed(0)} km away</p>
                      <p className="text-xs text-gray-500">{ac.flight_time_minutes} min ferry</p>
                      {ac.repositioning_needed && (
                        <Badge variant="outline" className="text-xs mt-1">Repositioning needed</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fleet.map((aircraft, idx) => (
          <Card key={aircraft.aircraft_id || idx} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                    <Plane className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">{aircraft.registration}</h3>
                    <p className="text-sm text-gray-500">{aircraft.type}</p>
                  </div>
                </div>
                <Badge variant={aircraft.is_available ? 'default' : 'secondary'}>
                  {aircraft.is_available ? '✓ Available' : 'Busy'}
                </Badge>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">Location:</span>
                  <span className="font-medium">{aircraft.current_location || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">Capacity:</span>
                  <span className="font-medium">{aircraft.seats} passengers</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {fleet.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Plane className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Fleet Data</h3>
            <p className="text-sm text-gray-500 mt-2">Add aircraft to see fleet positioning</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Operator Auction Opportunities
function OperatorAuctionsSection() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(null);
  const [bidForm, setBidForm] = useState({
    aircraft_id: '',
    aircraft_registration: '',
    aircraft_type: 'Helicopter',
    quoted_price: '',
    special_conditions: '',
    includes_catering: false,
  });

  useEffect(() => {
    fetchAvailableAuctions();
  }, []);

  const fetchAvailableAuctions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/auction/operator/available`, {
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

  const submitBid = async () => {
    if (!bidForm.quoted_price || !bidForm.aircraft_registration) {
      toast.error('Please fill in price and aircraft details');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/auction/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          auction_id: bidding,
          ...bidForm,
          quoted_price: parseFloat(bidForm.quoted_price),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Bid submitted successfully!');
        setBidding(null);
        setBidForm({
          aircraft_id: '',
          aircraft_registration: '',
          aircraft_type: 'Helicopter',
          quoted_price: '',
          special_conditions: '',
          includes_catering: false,
        });
        fetchAvailableAuctions();
      } else {
        toast.error(data.detail || 'Failed to submit bid');
      }
    } catch (error) {
      toast.error('Error submitting bid');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bid Dialog */}
      <Dialog open={!!bidding} onOpenChange={() => setBidding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-purple-500" />
              Submit Bid / बोली लगाएं
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Aircraft Registration / पंजीकरण</Label>
              <Input
                placeholder="VT-XXX"
                value={bidForm.aircraft_registration}
                onChange={(e) => setBidForm(prev => ({ ...prev, aircraft_registration: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Aircraft Type / विमान प्रकार</Label>
              <Select
                value={bidForm.aircraft_type}
                onValueChange={(val) => setBidForm(prev => ({ ...prev, aircraft_type: val }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Helicopter">Helicopter</SelectItem>
                  <SelectItem value="Light Jet">Light Jet</SelectItem>
                  <SelectItem value="Turboprop">Turboprop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Your Quote Price (₹) / आपकी कीमत</Label>
              <Input
                type="number"
                placeholder="150000"
                value={bidForm.quoted_price}
                onChange={(e) => setBidForm(prev => ({ ...prev, quoted_price: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Special Conditions / विशेष शर्तें</Label>
              <Input
                placeholder="Any terms or conditions..."
                value={bidForm.special_conditions}
                onChange={(e) => setBidForm(prev => ({ ...prev, special_conditions: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={bidForm.includes_catering}
                onCheckedChange={(checked) => setBidForm(prev => ({ ...prev, includes_catering: checked }))}
              />
              <Label>Includes Catering / केटरिंग शामिल</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidding(null)}>Cancel</Button>
            <Button onClick={submitBid} className="bg-purple-600 hover:bg-purple-700">
              <Gavel className="w-4 h-4 mr-2" /> Submit Bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auctions List */}
      {auctions.length > 0 ? (
        <div className="space-y-4">
          {auctions.map((auction) => (
            <Card key={auction.auction_id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-500" />
                      {auction.from_location} → {auction.to_location}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(auction.departure_date).toLocaleDateString('en-IN')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {auction.passenger_count} passengers
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {auction.booking_type}
                      </span>
                    </div>
                    {auction.max_budget && (
                      <p className="text-sm mt-2">
                        <span className="text-gray-500">Max Budget:</span>
                        <span className="font-medium text-green-600 ml-1">₹{auction.max_budget?.toLocaleString('en-IN')}</span>
                      </p>
                    )}
                    {auction.special_requirements && (
                      <p className="text-sm mt-1 text-amber-600">
                        Special: {auction.special_requirements}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-500">
                      🔴 LIVE
                    </Badge>
                    <p className="text-xs text-gray-500 mt-2">
                      {auction.operator_bids?.length || 0} bids
                    </p>
                  </div>
                </div>

                {/* My Bid Status */}
                {auction.operator_bids?.length > 0 && (
                  <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Your Bid: ₹{auction.operator_bids[0].quoted_price?.toLocaleString('en-IN')}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button 
                    onClick={() => setBidding(auction.auction_id)}
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={auction.operator_bids?.length > 0}
                  >
                    <Gavel className="w-4 h-4 mr-2" />
                    {auction.operator_bids?.length > 0 ? 'Already Bid' : 'Place Bid'}
                  </Button>
                  <Button variant="outline">
                    <Eye className="w-4 h-4 mr-2" /> View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Gavel className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Active Auctions</h3>
          <p className="text-sm text-gray-500 mt-2">
            When customers request quotes, you will see opportunities here
          </p>
        </div>
      )}
    </div>
  );
}

// Fixed Route Pricing Management
function FixedRoutePricingSection() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRoute, setNewRoute] = useState({
    from_airport_code: '',
    from_city: '',
    to_airport_code: '',
    to_city: '',
    base_price: '',
    route_distance_km: '',
    flight_time_hours: '',
    seats_available: 4,
    aircraft_type: 'helicopter',
    includes_crew: true,
    includes_fuel: true,
    includes_landing_charges: true,
    includes_catering: false,
    effective_from: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchFixedRoutes();
  }, []);

  const fetchFixedRoutes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/pricing/fixed-routes`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setRoutes(data.routes || []);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createFixedRoute = async () => {
    if (!newRoute.from_city || !newRoute.to_city || !newRoute.base_price) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/pricing/fixed-routes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newRoute,
          base_price: parseFloat(newRoute.base_price),
          route_distance_km: parseFloat(newRoute.route_distance_km) || 100,
          flight_time_hours: parseFloat(newRoute.flight_time_hours) || 0.5,
          effective_from: new Date(newRoute.effective_from).toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Fixed route pricing created!');
        setShowAddDialog(false);
        fetchFixedRoutes();
      } else {
        toast.error(data.detail || 'Failed to create route');
      }
    } catch (error) {
      toast.error('Error creating route');
    }
  };

  const toggleRouteStatus = async (pricingId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/asre/pricing/fixed-routes/${pricingId}?is_active=${!currentStatus}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        toast.success(currentStatus ? 'Route deactivated' : 'Route activated');
        fetchFixedRoutes();
      }
    } catch (error) {
      toast.error('Error updating route');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Route Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-500" />
              Add Fixed Route Pricing / निश्चित मार्ग मूल्य जोड़ें
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From City / शहर से</Label>
                <Input
                  placeholder="Mumbai"
                  value={newRoute.from_city}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, from_city: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>From Airport Code</Label>
                <Input
                  placeholder="BOM"
                  value={newRoute.from_airport_code}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, from_airport_code: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>To City / शहर तक</Label>
                <Input
                  placeholder="Shirdi"
                  value={newRoute.to_city}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, to_city: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>To Airport Code</Label>
                <Input
                  placeholder="SAG"
                  value={newRoute.to_airport_code}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, to_airport_code: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Price (₹) / मूल कीमत</Label>
                <Input
                  type="number"
                  placeholder="125000"
                  value={newRoute.base_price}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, base_price: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Distance (km)</Label>
                <Input
                  type="number"
                  placeholder="240"
                  value={newRoute.route_distance_km}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, route_distance_km: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Flight Time (hours)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.2"
                  value={newRoute.flight_time_hours}
                  onChange={(e) => setNewRoute(prev => ({ ...prev, flight_time_hours: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Seats Available</Label>
                <Select
                  value={newRoute.seats_available.toString()}
                  onValueChange={(val) => setNewRoute(prev => ({ ...prev, seats_available: parseInt(val) }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 5, 6, 7, 8].map((n) => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Inclusions</Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newRoute.includes_crew}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, includes_crew: e.target.checked }))}
                  />
                  Crew
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newRoute.includes_fuel}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, includes_fuel: e.target.checked }))}
                  />
                  Fuel
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newRoute.includes_landing_charges}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, includes_landing_charges: e.target.checked }))}
                  />
                  Landing Charges
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newRoute.includes_catering}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, includes_catering: e.target.checked }))}
                  />
                  Catering
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={createFixedRoute} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" /> Create Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Your Fixed Routes / आपके निश्चित मार्ग</h3>
          <p className="text-sm text-gray-500">Set fixed prices for popular routes</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" /> Add Route
        </Button>
      </div>

      {/* Routes Table */}
      {routes.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <TableRow key={route.pricing_id}>
                  <TableCell>
                    <div className="font-medium">{route.from_city} → {route.to_city}</div>
                    <div className="text-xs text-gray-500">{route.from_airport_code} - {route.to_airport_code}</div>
                  </TableCell>
                  <TableCell>{route.route_distance_km?.toFixed(0)} km</TableCell>
                  <TableCell className="font-bold text-green-600">₹{route.base_price?.toLocaleString('en-IN')}</TableCell>
                  <TableCell>{route.seats_available}</TableCell>
                  <TableCell>
                    <Badge variant={route.is_active ? 'default' : 'secondary'}>
                      {route.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={route.is_active}
                        onCheckedChange={() => toggleRouteStatus(route.pricing_id, route.is_active)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <Target className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400">No Fixed Routes</h3>
          <p className="text-sm text-gray-500 mt-2">
            Create fixed pricing for your popular routes
          </p>
          <Button onClick={() => setShowAddDialog(true)} className="mt-4">
            <Plus className="w-4 h-4 mr-2" /> Add First Route
          </Button>
        </div>
      )}
    </div>
  );
}

// Distance Calculator Tool
function DistanceCalculatorSection() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const calculateDistance = async () => {
    if (!from || !to) {
      toast.error('Please enter both locations');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/asre/distance/calculate?from_location=${encodeURIComponent(from)}&to_location=${encodeURIComponent(to)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setResult(data);
      } else {
        toast.error(data.detail || 'Failed to calculate distance');
      }
    } catch (error) {
      toast.error('Error calculating distance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-indigo-500" />
          Distance Calculator / दूरी कैलकुलेटर
        </CardTitle>
        <CardDescription>Calculate aviation distance and flight time between airports</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="From (Mumbai, BOM, Delhi...)"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            placeholder="To (Shirdi, SAG, Agra...)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button onClick={calculateDistance} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calculate'}
          </Button>
        </div>

        {result && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span className="font-medium">{result.origin?.city}</span>
              <ArrowRight className="w-4 h-4" />
              <span className="font-medium">{result.destination?.city}</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{result.distance?.aviation_route_km?.toFixed(0)}</p>
                <p className="text-xs text-gray-500">km (aviation)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{result.flight_time?.total_minutes}</p>
                <p className="text-xs text-gray-500">minutes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{result.flight_time?.formatted}</p>
                <p className="text-xs text-gray-500">flight time</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main ASRE Dashboard for Admin/Operator
export default function ASREDashboard() {
  const [activeTab, setActiveTab] = useState('fleet');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-500" />
            AI Smart Repositioning Engine (ASRE)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Fleet positioning, reverse auctions, and dynamic pricing management
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Active Fleet</p>
                <p className="text-2xl font-bold">12</p>
              </div>
              <Plane className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Live Auctions</p>
                <p className="text-2xl font-bold">3</p>
              </div>
              <Gavel className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Fixed Routes</p>
                <p className="text-2xl font-bold">8</p>
              </div>
              <Target className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Won Bids</p>
                <p className="text-2xl font-bold">15</p>
              </div>
              <Award className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fleet" className="flex items-center gap-2">
            <Plane className="w-4 h-4" />
            <span className="hidden sm:inline">Fleet Position</span>
          </TabsTrigger>
          <TabsTrigger value="auctions" className="flex items-center gap-2">
            <Gavel className="w-4 h-4" />
            <span className="hidden sm:inline">Bid on Trips</span>
          </TabsTrigger>
          <TabsTrigger value="fixed-routes" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">Fixed Routes</span>
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            <span className="hidden sm:inline">Calculator</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="mt-6">
          <FleetPositioningSection />
        </TabsContent>

        <TabsContent value="auctions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-500" />
                Available Auction Opportunities / उपलब्ध नीलामी अवसर
              </CardTitle>
              <CardDescription>
                Customers are looking for quotes - submit your best price to win!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OperatorAuctionsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fixed-routes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-500" />
                Fixed Route Pricing / निश्चित मार्ग मूल्य
              </CardTitle>
              <CardDescription>
                Set guaranteed prices for your popular routes - customers get instant quotes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FixedRoutePricingSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="mt-6">
          <DistanceCalculatorSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
