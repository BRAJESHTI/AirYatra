import React, { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, ArrowRight, Navigation, Calculator, AlertCircle, GripVertical, Map, Sparkles, Loader2, TrendingDown, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import LandingPointSelector from '../shared/LandingPointSelector';
import MultiCityRouteMap from './MultiCityRouteMap';
import { toast } from 'sonner';
import axios from 'axios';

// DnD Kit imports for drag-drop reordering
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Sortable Leg Card Component
 * Enables drag-drop reordering of route legs
 */
const SortableLegCard = ({
  leg,
  index,
  legs,
  minLegs,
  perLegDiscount,
  selectedDate,
  aircraftType,
  updateLegPoint,
  removeLeg
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: leg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`bg-slate-800/50 border-slate-700 ${
        index === 0 ? 'border-l-4 border-l-green-500' : 
        index === legs.length - 1 ? 'border-l-4 border-l-red-500' : ''
      } ${isDragging ? 'shadow-2xl ring-2 ring-orange-500' : ''}`}
    >
      <CardContent className="p-4">
        {/* Leg Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-700 rounded touch-none"
              data-testid={`drag-handle-leg-${index + 1}`}
            >
              <GripVertical className="h-5 w-5 text-slate-500" />
            </button>
            
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
              index === 0 ? 'bg-green-500/20 text-green-400' :
              index === legs.length - 1 ? 'bg-red-500/20 text-red-400' :
              'bg-orange-500/20 text-orange-400'
            }`}>
              {index + 1}
            </div>
            <span className="text-white font-medium">
              Leg {index + 1}{index + 1}
              {index === 0 && <span className="text-green-400 text-xs ml-2">(Start)</span>}
              {index === legs.length - 1 && <span className="text-red-400 text-xs ml-2">(End)</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Per-leg discount badge */}
            {index > 0 && perLegDiscount > 0 && (
              <Badge className="bg-green-500/20 text-green-400 text-xs">
                {Math.min(index * perLegDiscount, 25)}% off
              </Badge>
            )}
            {/* Remove button */}
            {legs.length > minLegs && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeLeg(index)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* From/To Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* From Point */}
          <div>
            <Label className="text-slate-400 text-sm mb-2 block flex items-center gap-1">
              <MapPin className="h-3 w-3 text-green-400" />
              From{index === 0 && <span className="text-red-400">*</span>}
            </Label>
            {index > 0 && legs[index - 1]?.to ? (
              // Auto-filled from previous leg's destination
              <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                <p className="text-white text-sm">{legs[index - 1].to?.landing_point_name}</p>
                <p className="text-slate-400 text-xs">Auto-linked from Leg {index}</p>
              </div>
            ) : (
              <LandingPointSelector
                label="Select pickup"
                type="pickup"
                selectedDate={selectedDate}
                aircraftType={aircraftType}
                onSelect={(data) => updateLegPoint(index, 'from', data)}
                selectedPoint={leg.from}
                compact={true}
              />
            )}
          </div>
          
          {/* To Point */}
          <div>
            <Label className="text-slate-400 text-sm mb-2 block flex items-center gap-1">
              <MapPin className="h-3 w-3 text-red-400" />
              To<span className="text-red-400">*</span>
            </Label>
            <LandingPointSelector
              label="Select destination"
              type="drop"
              selectedDate={selectedDate}
              aircraftType={aircraftType}
              onSelect={(data) => updateLegPoint(index, 'to', data)}
              selectedPoint={leg.to}
              compact={true}
            />
          </div>
        </div>
        
        {/* Leg Stats */}
        {leg.distance > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-slate-400">
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                {leg.distance} km
              </span>
              <span className="flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                ~{Math.round(leg.distance / 200 * 60)} min
              </span>
            </div>
            <span className="text-orange-400 font-medium">
              ₹{leg.price?.toLocaleString('en-IN') || 0}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Multi-City Route Builder Component
 * Allows customers to add 3+ destinations for multi_city booking type
 * with per-leg pricing calculation
 */
export const MultiCityRouteBuilder = ({
  routes = [],
  onRoutesChange,
  selectedDate,
  aircraftType,
  basePrice = 0,
  perLegDiscount = 5, // % discount per additional leg
  minLegs = 2,
  maxLegs = 8,
  className = ''
}) => {
  // Initialize with min 2 legs if empty
  const [legs, setLegs] = useState(routes.length >= minLegs ? routes : [
    { id: 1, from: null, to: null, distance: 0, price: 0 },
    { id: 2, from: null, to: null, distance: 0, price: 0 }
  ]);
  
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [showMap, setShowMap] = useState(true);
  const [mapExpanded, setMapExpanded] = useState(false);
  
  // Route Optimization State
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [showOptimization, setShowOptimization] = useState(false);
  
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  // DnD Kit sensors for drag-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle drag end - reorder legs
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      setLegs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newLegs = arrayMove(items, oldIndex, newIndex);
        
        // Recalculate auto-chain after reorder
        return recalculateChain(newLegs);
      });
    }
  };
  
  // Recalculate auto-chain (next leg's from = previous leg's to)
  const recalculateChain = (legsArray) => {
    return legsArray.map((leg, index) => {
      if (index === 0) return leg;
      
      const prevLeg = legsArray[index - 1];
      if (prevLeg.to && leg.from !== prevLeg.to) {
        return {
          ...leg,
          from: prevLeg.to,
          distance: calculateDistance(prevLeg.to, leg.to)
        };
      }
      return leg;
    });
  };
  
  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (from, to) => {
    if (!from?.coordinates || !to?.coordinates) return 0;
    
    const R = 6371; // Earth's radius in km
    const lat1 = from.coordinates.lat * Math.PI / 180;
    const lat2 = to.coordinates.lat * Math.PI / 180;
    const deltaLat = (to.coordinates.lat - from.coordinates.lat) * Math.PI / 180;
    const deltaLon = (to.coordinates.lng - from.coordinates.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return Math.round(R * c);
  };
  
  // Calculate price per leg with distance-based pricing
  const calculateLegPrice = (distance, legIndex) => {
    if (!distance || !basePrice) return 0;
    
    // Base price per km (assuming basePrice is hourly and avg speed is 200km/h)
    const pricePerKm = basePrice / 200;
    let legPrice = distance * pricePerKm;
    
    // Apply per-leg discount for legs beyond the first
    if (legIndex > 0 && perLegDiscount > 0) {
      const discount = (legIndex * perLegDiscount) / 100;
      legPrice = legPrice * (1 - Math.min(discount, 0.25)); // Max 25% discount
    }
    
    return Math.round(legPrice);
  };
  
  // Recalculate totals when legs change
  useEffect(() => {
    let distance = 0;
    let price = 0;
    let discount = 0;
    
    const updatedLegs = legs.map((leg, index) => {
      const legDistance = calculateDistance(leg.from, leg.to);
      const fullPrice = legDistance * (basePrice / 200);
      const legPrice = calculateLegPrice(legDistance, index);
      const legDiscount = fullPrice - legPrice;
      
      distance += legDistance;
      price += legPrice;
      discount += legDiscount;
      
      return {
        ...leg,
        distance: legDistance,
        price: legPrice
      };
    });
    
    setLegs(updatedLegs);
    setTotalDistance(distance);
    setTotalPrice(price);
    setTotalDiscount(discount);
    
    // Notify parent
    if (onRoutesChange) {
      onRoutesChange({
        legs: updatedLegs,
        totalDistance: distance,
        totalPrice: price,
        totalDiscount: discount
      });
    }
  }, [legs.map(l => l.from?.id + '-' + l.to?.id).join(','), basePrice, perLegDiscount]);
  
  // Add new leg
  const addLeg = () => {
    if (legs.length >= maxLegs) return;
    
    const lastLeg = legs[legs.length - 1];
    setLegs([
      ...legs,
      {
        id: Date.now(),
        from: lastLeg?.to || null, // Auto-set from as previous destination
        to: null,
        distance: 0,
        price: 0
      }
    ]);
  };
  
  // Remove leg
  const removeLeg = (index) => {
    if (legs.length <= minLegs) return;
    setLegs(legs.filter((_, i) => i !== index));
  };
  
  // Update leg point
  const updateLegPoint = (index, type, data) => {
    setLegs(legs.map((leg, i) => {
      if (i === index) {
        return { ...leg, [type]: data };
      }
      // Auto-chain: if updating 'to', set next leg's 'from'
      if (type === 'to' && i === index && legs[index + 1]) {
        legs[index + 1] = { ...legs[index + 1], from: data };
      }
      return leg;
    }));
  };
  
  // Swap two legs
  const swapLegs = (index1, index2) => {
    if (index1 < 0 || index2 < 0 || index1 >= legs.length || index2 >= legs.length) return;
    const newLegs = [...legs];
    [newLegs[index1], newLegs[index2]] = [newLegs[index2], newLegs[index1]];
    setLegs(newLegs);
  };

  // ============ ROUTE OPTIMIZATION AI ============
  
  // Optimize route using AI
  const optimizeRoute = async () => {
    // Check if we have enough valid destinations
    const validLegs = legs.filter(leg => leg.from && leg.to);
    if (validLegs.length < 2) {
      toast.error('Add at least 2 complete legs to optimize');
      return;
    }
    
    try {
      setOptimizing(true);
      setOptimizationResult(null);
      
      // Build locations array for API
      const origin = {
        name: legs[0].from?.landing_point_name || 'Origin',
        lat: legs[0].from?.latitude || 0,
        lng: legs[0].from?.longitude || 0,
        city: legs[0].from?.city || ''
      };
      
      const destinations = legs.map(leg => ({
        name: leg.to?.landing_point_name || 'Destination',
        lat: leg.to?.latitude || 0,
        lng: leg.to?.longitude || 0,
        city: leg.to?.city || ''
      })).filter(d => d.lat !== 0);
      
      // Use backend API for optimization (existing endpoint)
      const locationNames = [
        legs[0].from?.city?.toLowerCase() || 'mumbai',
        ...legs.map(l => l.to?.city?.toLowerCase()).filter(Boolean)
      ];
      
      const response = await axios.post(`${API_URL}/api/routes/multi-stop`, {
        locations: locationNames,
        start_location: locationNames[0],
        return_to_start: false,
        optimize_for: 'distance'
      });
      
      const result = response.data;
      
      // Calculate savings
      const originalDistance = totalDistance;
      const optimizedDistance = result.total_distance_km || totalDistance;
      const savings = originalDistance - optimizedDistance;
      const savingsPercent = originalDistance > 0 ? (savings / originalDistance * 100) : 0;
      
      setOptimizationResult({
        originalOrder: legs.map(l => l.to?.landing_point_name?.split(',')[0] || 'Unknown'),
        optimizedOrder: result.optimized_route || [],
        originalDistance: Math.round(originalDistance),
        optimizedDistance: Math.round(optimizedDistance),
        savingsKm: Math.round(savings),
        savingsPercent: Math.round(savingsPercent),
        estimatedTime: result.estimated_time_min || 0,
        isDifferent: savings > 5
      });
      
      setShowOptimization(true);
      
      if (savings > 10) {
        toast.success(`🚁 Found shorter route! Save ${Math.round(savings)} km`);
      } else {
        toast.info('✅ Your route is already optimal!');
      }
      
    } catch (error) {
      console.error('Route optimization failed:', error);
      toast.error('Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };
  
  // Apply optimized route
  const applyOptimizedRoute = () => {
    if (!optimizationResult?.optimizedOrder) return;
    
    // Reorder legs based on optimization
    const optimizedOrder = optimizationResult.optimizedOrder;
    const newLegs = [];
    
    // Build new legs array based on optimized order
    for (let i = 0; i < optimizedOrder.length - 1; i++) {
      const fromName = optimizedOrder[i];
      const toName = optimizedOrder[i + 1];
      
      // Find matching leg or create new one
      const existingLeg = legs.find(l => 
        (l.from?.city?.toLowerCase() === fromName.toLowerCase() || 
         l.from?.landing_point_name?.toLowerCase().includes(fromName.toLowerCase())) &&
        (l.to?.city?.toLowerCase() === toName.toLowerCase() ||
         l.to?.landing_point_name?.toLowerCase().includes(toName.toLowerCase()))
      );
      
      if (existingLeg) {
        newLegs.push({ ...existingLeg, id: Date.now() + i });
      } else {
        // Create placeholder leg
        newLegs.push({
          id: Date.now() + i,
          from: legs.find(l => l.from?.city?.toLowerCase() === fromName.toLowerCase())?.from ||
                legs.find(l => l.to?.city?.toLowerCase() === fromName.toLowerCase())?.to || null,
          to: legs.find(l => l.to?.city?.toLowerCase() === toName.toLowerCase())?.to || null,
          distance: 0,
          price: 0
        });
      }
    }
    
    if (newLegs.length >= 2) {
      setLegs(recalculateChain(newLegs));
      setShowOptimization(false);
      setOptimizationResult(null);
      toast.success('Route optimized!');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Navigation className="h-5 w-5 text-orange-400" />
            Multi-City Route Builder</h3>
          <p className="text-slate-400 text-sm mt-1">
            Add {minLegs}-{maxLegs} destinations. Each additional leg gets {perLegDiscount}% off!
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Route Optimization Button */}
          {legs.filter(l => l.from && l.to).length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={optimizeRoute}
              disabled={optimizing}
              className="border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
              data-testid="optimize-route-btn"
            >
              {optimizing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {optimizing ? 'Optimizing...' : 'AI Optimize'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMap(!showMap)}
            className={`border-slate-600 ${showMap ? 'bg-blue-500/20 text-blue-400' : ''}`}
          >
            <Map className="h-4 w-4 mr-1" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </Button>
          <Badge className="bg-blue-500/20 text-blue-400">
            {legs.length} Legs / {legs.length}          </Badge>
        </div>
      </div>
      
      {/* Interactive Route Map */}
      {showMap && totalDistance > 0 && (
        <MultiCityRouteMap
          legs={legs}
          totalDistance={totalDistance}
          totalPrice={totalPrice}
          isExpanded={mapExpanded}
          onToggleExpand={() => setMapExpanded(!mapExpanded)}
        />
      )}
      
      {/* Drag-Drop Hint */}
      <div className="flex items-center gap-2 text-slate-500 text-xs">
        <GripVertical className="h-4 w-4" />
        <span>Drag legs to reorder your route</span>
      </div>
      
      {/* Route Legs with Drag-Drop */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={legs.map(leg => leg.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {legs.map((leg, index) => (
              <SortableLegCard
                key={leg.id}
                leg={leg}
                index={index}
                legs={legs}
                minLegs={minLegs}
                perLegDiscount={perLegDiscount}
                selectedDate={selectedDate}
                aircraftType={aircraftType}
                updateLegPoint={updateLegPoint}
                removeLeg={removeLeg}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      {/* Add Leg Button */}
      {legs.length < maxLegs && (
        <Button
          variant="outline"
          onClick={addLeg}
          className="w-full border-dashed border-slate-600 text-slate-400 hover:text-orange-400 hover:border-orange-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Destination{legs.length}/{maxLegs})
        </Button>
      )}
      
      {/* Route Optimization Result */}
      {showOptimization && optimizationResult && (
        <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                Route Optimization</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOptimization(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
            
            {optimizationResult.isDifferent ? (
              <>
                {/* Comparison */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400 text-xs mb-1">Current Route</p>
                    <p className="text-white text-lg font-bold">{optimizationResult.originalDistance} km</p>
                    <p className="text-slate-500 text-xs truncate">
                      {optimizationResult.originalOrder?.join(' → ')}
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 text-xs mb-1">Optimized Route</p>
                    <p className="text-green-400 text-lg font-bold">{optimizationResult.optimizedDistance} km</p>
                    <p className="text-green-400/70 text-xs truncate">
                      {optimizationResult.optimizedOrder?.join(' → ')}
                    </p>
                  </div>
                </div>
                
                {/* Savings Badge */}
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-medium">
                      Save {optimizationResult.savingsKm} km ({optimizationResult.savingsPercent}%)
                    </span>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400">
                    ~{Math.round(optimizationResult.savingsKm / 250 * 60)} min faster
                  </Badge>
                </div>
                
                {/* Apply Button */}
                <Button
                  onClick={applyOptimizedRoute}
                  className="w-full bg-purple-500 hover:bg-purple-600"
                >
                  <Route className="h-4 w-4 mr-2" />
                  Apply Optimized Route</Button>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-400 font-medium">Your route is already optimal!</p>
                <p className="text-slate-400 text-sm"></p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Route Summary */}
      {totalDistance > 0 && (
        <Card className="bg-gradient-to-r from-orange-500/10 to-orange-600/5 border-orange-500/30">
          <CardContent className="p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-orange-400" />
              Route Summary</h4>
            
            {/* Visual Route */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3">
              {legs.map((leg, index) => (
                <React.Fragment key={leg.id}>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className={`px-2 py-1 rounded text-xs ${
                      index === 0 ? 'bg-green-500/20 text-green-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {leg.from?.landing_point_name?.split(',')[0] || 'Start'}
                    </div>
                    {leg.to && (
                      <>
                        <ArrowRight className="h-3 w-3 text-slate-500" />
                        <div className={`px-2 py-1 rounded text-xs ${
                          index === legs.length - 1 ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {leg.to?.landing_point_name?.split(',')[0] || 'End'}
                        </div>
                      </>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-slate-400 text-xs">Total Distance</p>
                <p className="text-white text-xl font-bold">{totalDistance} km</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-xs">You Save</p>
                <p className="text-green-400 text-xl font-bold">₹{totalDiscount.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-400 text-xs">Total Price</p>
                <p className="text-orange-400 text-xl font-bold">₹{totalPrice.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2 text-sm">
        <AlertCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-blue-300">
          <p>Multi-city flights chain automatically. Each destination becomes the next leg&apos;s starting point.</p>
          <p className="text-blue-400/70 mt-1"></p>
        </div>
      </div>
    </div>
  );
};

export default MultiCityRouteBuilder;
