import React from 'react';
import { MapPin, Plus, Navigation, Star } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Route Pricing Tab Component
 * Handles route-based pricing configuration
 */
export const RoutePricingTab = ({ 
  routes, 
  newRoute, 
  setNewRoute, 
  addRoute, 
  saving 
}) => {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          Route-Based Pricing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Route */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Add New Route</h4>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <Label className="text-slate-400 text-sm">From City</Label>
              <Input
                type="text"
                value={newRoute.route_from}
                onChange={(e) => setNewRoute(prev => ({ ...prev, route_from: e.target.value }))}
                placeholder="Mumbai"
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">To City</Label>
              <Input
                type="text"
                value={newRoute.route_to}
                onChange={(e) => setNewRoute(prev => ({ ...prev, route_to: e.target.value }))}
                placeholder="Pune"
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Distance (km)</Label>
              <Input
                type="number"
                value={newRoute.distance_km}
                onChange={(e) => setNewRoute(prev => ({ ...prev, distance_km: parseFloat(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Flight Time (min)</Label>
              <Input
                type="number"
                value={newRoute.estimated_flight_time_minutes}
                onChange={(e) => setNewRoute(prev => ({ ...prev, estimated_flight_time_minutes: parseInt(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Base Price (₹)</Label>
              <Input
                type="number"
                value={newRoute.base_price}
                onChange={(e) => setNewRoute(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addRoute} disabled={saving} className="bg-blue-600 hover:bg-blue-700 w-full">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Checkbox
              checked={newRoute.is_popular}
              onCheckedChange={(checked) => setNewRoute(prev => ({ ...prev, is_popular: checked }))}
            />
            <Label className="text-slate-400 text-sm">Mark as Popular Route</Label>
          </div>
        </div>

        {/* Existing Routes */}
        <div className="space-y-2">
          <h4 className="text-white font-medium">Existing Routes ({routes.length})</h4>
          {routes.length === 0 ? (
            <p className="text-slate-400 text-sm">No route pricing configured yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {routes.map((route, index) => (
                <div 
                  key={index} 
                  className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Navigation className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">
                        {route.route_from} → {route.route_to}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {route.distance_km} km • {route.estimated_flight_time_minutes} min
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-semibold">₹{route.base_price?.toLocaleString()}</p>
                    {route.is_popular && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">
                        <Star className="h-3 w-3 mr-1" /> Popular
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Popular Routes Suggestion */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-blue-400 text-sm font-medium mb-2">
            Suggested Popular Routes in India
          </h4>
          <div className="flex flex-wrap gap-2">
            {[
              { from: 'Mumbai', to: 'Pune', km: 150, mins: 30, price: 85000 },
              { from: 'Delhi', to: 'Jaipur', km: 280, mins: 45, price: 120000 },
              { from: 'Mumbai', to: 'Shirdi', km: 240, mins: 40, price: 95000 },
              { from: 'Bangalore', to: 'Coorg', km: 265, mins: 50, price: 110000 },
              { from: 'Delhi', to: 'Agra', km: 230, mins: 35, price: 90000 }
            ].map(suggestion => (
              <Button
                key={`${suggestion.from}-${suggestion.to}`}
                variant="outline"
                size="sm"
                className="text-xs border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                onClick={() => setNewRoute({
                  route_from: suggestion.from,
                  route_to: suggestion.to,
                  distance_km: suggestion.km,
                  estimated_flight_time_minutes: suggestion.mins,
                  base_price: suggestion.price,
                  is_popular: true
                })}
              >
                {suggestion.from} → {suggestion.to}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoutePricingTab;
