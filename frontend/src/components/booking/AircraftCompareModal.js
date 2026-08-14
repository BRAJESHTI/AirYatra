import React, { useState, useEffect } from 'react';
import { X, Scale, Check, AlertCircle, Star, Shield, Plane, Fuel, Users, Clock, Gauge, Wifi, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

// Score bar component (extracted to avoid re-render issues)
const ScoreBar = ({ score, label, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium ${color}`}>{score}%</span>
    </div>
    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all duration-500 ${
          score >= 80 ? 'bg-green-500' : 
          score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
        }`}
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

/**
 * Aircraft Comparison Modal for Booking Flow
 * Allows customers to compare 2-3 aircraft side-by-side during booking
 */
const AircraftCompareModal = ({
  isOpen,
  onClose,
  availableAircraft = [],
  onSelectAircraft,
  selectedAircraftId,
  distanceKm = 0,
  passengerCount = 1
}) => {
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  
  const MAX_COMPARE = 3;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedForCompare([]);
      setComparing(false);
      setComparisonData(null);
    }
  }, [isOpen]);

  // Toggle aircraft selection for comparison
  const toggleAircraftSelection = (aircraftId) => {
    setSelectedForCompare(prev => {
      if (prev.includes(aircraftId)) {
        return prev.filter(id => id !== aircraftId);
      }
      if (prev.length >= MAX_COMPARE) {
        toast.warning(`Maximum ${MAX_COMPARE} aircraft can be compared`);
        return prev;
      }
      return [...prev, aircraftId];
    });
  };

  // Start comparison
  const startComparison = () => {
    if (selectedForCompare.length < 2) {
      toast.error('Please select at least 2 aircraft to compare');
      return;
    }
    
    const selectedAircraft = availableAircraft.filter(a => 
      selectedForCompare.includes(a.id)
    );
    
    // Calculate comparison scores
    const compData = selectedAircraft.map(aircraft => ({
      ...aircraft,
      scores: calculateScores(aircraft),
      estimatedPrice: calculateEstimatedPrice(aircraft, distanceKm),
      flightTime: calculateFlightTime(aircraft, distanceKm)
    }));
    
    setComparisonData(compData);
    setComparing(true);
  };

  // Calculate comparison scores
  const calculateScores = (aircraft) => {
    const safetyFeatures = aircraft.safety_features || {};
    const amenities = aircraft.amenities || {};
    
    // Safety Score (out of 100)
    let safetyScore = 50; // Base
    if (safetyFeatures.tcas) safetyScore += 10;
    if (safetyFeatures.terrain_awareness) safetyScore += 10;
    if (safetyFeatures.weather_radar) safetyScore += 10;
    if (safetyFeatures.autopilot) safetyScore += 10;
    if (safetyFeatures.defibrillator) safetyScore += 5;
    if (safetyFeatures.oxygen_kit) safetyScore += 5;
    
    // Amenity Score (out of 100)
    let amenityScore = 30; // Base
    if (amenities.wifi_type !== 'none') amenityScore += 20;
    if (amenities.leather_seats) amenityScore += 15;
    if (amenities.pressurized_cabin) amenityScore += 15;
    if (amenities.meals_available) amenityScore += 10;
    if (amenities.conference_table) amenityScore += 10;
    
    // Value Score (based on price per seat)
    const pricePerSeat = (aircraft.hourly_rate || 50000) / (aircraft.passenger_capacity || 4);
    const valueScore = Math.max(0, 100 - (pricePerSeat / 200));
    
    return {
      safety: Math.min(100, safetyScore),
      amenity: Math.min(100, amenityScore),
      value: Math.round(valueScore),
      overall: Math.round((safetyScore + amenityScore + valueScore) / 3)
    };
  };

  // Calculate estimated price
  const calculateEstimatedPrice = (aircraft, distance) => {
    const baseRate = aircraft.hourly_rate || 50000;
    const speedKmh = aircraft.cruise_speed_kmh || 200;
    const hours = distance / speedKmh;
    return Math.round(baseRate * Math.max(1, hours));
  };

  // Calculate flight time
  const calculateFlightTime = (aircraft, distance) => {
    const speedKmh = aircraft.cruise_speed_kmh || 200;
    return Math.round((distance / speedKmh) * 60); // in minutes
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Scale className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">
                Aircraft Comparison
              </h2>
              <p className="text-slate-400 text-sm">
                {comparing 
                  ? `${comparisonData?.length} aircraft comparing`
                  : `Select 2-${MAX_COMPARE} aircraft to compare`
                }
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!comparing ? (
            /* Selection View */
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-400" />
                <span className="text-blue-300 text-sm">
                  Select 2-3 aircraft to compare
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableAircraft.map(aircraft => (
                  <Card 
                    key={aircraft.id}
                    className={`bg-slate-800/50 border cursor-pointer transition-all ${
                      selectedForCompare.includes(aircraft.id)
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                    onClick={() => toggleAircraftSelection(aircraft.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-white font-medium">
                            {aircraft.basic_info?.model || aircraft.model || 'Unknown'}
                          </h3>
                          <p className="text-slate-400 text-sm">
                            {aircraft.basic_info?.manufacturer || aircraft.manufacturer}
                          </p>
                        </div>
                        <Checkbox 
                          checked={selectedForCompare.includes(aircraft.id)}
                          className="data-[state=checked]:bg-orange-500"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Users className="h-3 w-3" />
                          <span>{aircraft.passenger_capacity || aircraft.basic_info?.passenger_capacity || 4} seats</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Gauge className="h-3 w-3" />
                          <span>{aircraft.cruise_speed_kmh || aircraft.basic_info?.cruise_speed_kmh || 200} km/h</span>
                        </div>
                      </div>
                      
                      {aircraft.verification?.verified && (
                        <Badge className="mt-2 bg-green-500/20 text-green-400">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {availableAircraft.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No aircraft available for comparison</p>
                </div>
              )}
            </div>
          ) : (
            /* Comparison View */
            <div className="space-y-6">
              {/* Comparison Cards */}
              <div className={`grid gap-4 ${
                comparisonData?.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                'grid-cols-1 md:grid-cols-3'
              }`}>
                {comparisonData?.map((aircraft, index) => (
                  <Card key={aircraft.id} className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-lg">
                          {aircraft.basic_info?.model || aircraft.model}
                        </CardTitle>
                        {index === 0 && aircraft.scores.overall >= Math.max(...comparisonData.map(a => a.scores.overall)) && (
                          <Badge className="bg-yellow-500/20 text-yellow-400">
                            <Star className="h-3 w-3 mr-1" />
                            Best Match
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm">
                        {aircraft.basic_info?.manufacturer || aircraft.manufacturer}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Overall Score */}
                      <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                        <p className="text-slate-400 text-xs mb-1">Overall Score</p>
                        <p className={`text-3xl font-bold ${
                          aircraft.scores.overall >= 80 ? 'text-green-400' :
                          aircraft.scores.overall >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {aircraft.scores.overall}%
                        </p>
                      </div>
                      
                      {/* Score Breakdown */}
                      <div className="space-y-2">
                        <ScoreBar score={aircraft.scores.safety} label="Safety" color="text-green-400" />
                        <ScoreBar score={aircraft.scores.amenity} label="Comfort" color="text-blue-400" />
                        <ScoreBar score={aircraft.scores.value} label="Value" color="text-purple-400" />
                      </div>
                      
                      {/* Specs */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-slate-700/30 rounded p-2">
                          <p className="text-slate-400 text-xs">Capacity</p>
                          <p className="text-white font-medium flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {aircraft.passenger_capacity || aircraft.basic_info?.passenger_capacity || 4} seats
                          </p>
                        </div>
                        <div className="bg-slate-700/30 rounded p-2">
                          <p className="text-slate-400 text-xs">Speed</p>
                          <p className="text-white font-medium flex items-center gap-1">
                            <Gauge className="h-3 w-3" />
                            {aircraft.cruise_speed_kmh || aircraft.basic_info?.cruise_speed_kmh || 200} km/h
                          </p>
                        </div>
                        <div className="bg-slate-700/30 rounded p-2">
                          <p className="text-slate-400 text-xs">Flight Time</p>
                          <p className="text-white font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {aircraft.flightTime} min
                          </p>
                        </div>
                        <div className="bg-slate-700/30 rounded p-2">
                          <p className="text-slate-400 text-xs">Range</p>
                          <p className="text-white font-medium">
                            {aircraft.max_range_km || aircraft.basic_info?.max_range_km || 500} km
                          </p>
                        </div>
                      </div>
                      
                      {/* Features */}
                      <div className="space-y-2">
                        <p className="text-slate-400 text-xs font-medium">Key Features</p>
                        <div className="flex flex-wrap gap-1">
                          {aircraft.safety_features?.tcas && (
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">TCAS</Badge>
                          )}
                          {aircraft.safety_features?.autopilot && (
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">Autopilot</Badge>
                          )}
                          {aircraft.amenities?.wifi_type && aircraft.amenities?.wifi_type !== 'none' && (
                            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                              <Wifi className="h-3 w-3 mr-1" />
                              WiFi
                            </Badge>
                          )}
                          {aircraft.amenities?.leather_seats && (
                            <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">Leather</Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Price */}
                      <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/30">
                        <p className="text-orange-400 text-xs mb-1">Estimated Price</p>
                        <p className="text-white text-2xl font-bold">
                          ₹{aircraft.estimatedPrice.toLocaleString('en-IN')}
                        </p>
                        <p className="text-slate-400 text-xs">
                          For {distanceKm} km journey
                        </p>
                      </div>
                      
                      {/* Select Button */}
                      <Button 
                        className={`w-full ${
                          selectedAircraftId === aircraft.id 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-orange-500 hover:bg-orange-600'
                        }`}
                        onClick={() => {
                          onSelectAircraft(aircraft);
                          onClose();
                          toast.success(`${aircraft.basic_info?.model || aircraft.model} selected!`);
                        }}
                      >
                        {selectedAircraftId === aircraft.id ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Selected
                          </>
                        ) : (
                          'Select This Aircraft'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Comparison Notes */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  Comparison Notes
                </h4>
                <ul className="text-slate-400 text-sm space-y-1 list-disc list-inside">
                  <li>Prices are estimates based on distance and hourly rates</li>
                  <li>Safety score includes TCAS, autopilot, and emergency equipment</li>
                  <li>Actual availability may vary based on operator schedule</li>
                  <li>Final price will be confirmed at the time of booking</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center">
          {comparing ? (
            <Button 
              variant="outline" 
              onClick={() => setComparing(false)}
              className="border-slate-600"
            >
              Back to Selection
            </Button>
          ) : (
            <span className="text-slate-400 text-sm">
              {selectedForCompare.length}/{MAX_COMPARE} selected
            </span>
          )}
          
          {!comparing && (
            <Button 
              onClick={startComparison}
              disabled={selectedForCompare.length < 2}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Scale className="h-4 w-4 mr-2" />
              Compare ({selectedForCompare.length})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AircraftCompareModal;
