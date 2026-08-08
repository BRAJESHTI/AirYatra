import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Plane, Shield, Users, Clock, IndianRupee, Star, Award,
  CheckCircle, XCircle, Wifi, Wind, Coffee, Tv, Dog, 
  Accessibility, ChevronRight, X, Loader2, Zap, AlertTriangle,
  BarChart3, Scale, Trophy, Plus, Minus
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ FEATURE BADGE ============

const FeatureBadge = ({ hasFeature, label }) => {
  return hasFeature ? (
    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
      <CheckCircle className="h-3 w-3 mr-1" /> {label}
    </Badge>
  ) : (
    <Badge className="bg-slate-700 text-slate-400">
      <XCircle className="h-3 w-3 mr-1" /> {label}
    </Badge>
  );
};

// ============ SCORE BAR ============

const ScoreBar = ({ score, label, color = 'orange' }) => {
  const colors = {
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500'
  };
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-medium">{score}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

// ============ COMPARISON TABLE ROW ============

const ComparisonRow = ({ label, values, type = 'text', highlight = null }) => {
  return (
    <tr className="border-b border-slate-700/50">
      <td className="py-3 px-4 text-slate-400 font-medium text-sm">{label}</td>
      {values.map((value, idx) => (
        <td 
          key={idx} 
          className={`py-3 px-4 text-center ${
            highlight === idx ? 'bg-orange-500/10 text-orange-400 font-semibold' : 'text-white'
          }`}
        >
          {type === 'boolean' ? (
            value ? (
              <CheckCircle className="h-5 w-5 text-green-400 mx-auto" />
            ) : (
              <XCircle className="h-5 w-5 text-slate-500 mx-auto" />
            )
          ) : type === 'price' ? (
            <span className="font-semibold text-green-400">{value}</span>
          ) : (
            value
          )}
        </td>
      ))}
    </tr>
  );
};

// ============ AIRCRAFT SELECTOR ============

const AircraftSelector = ({ aircraft, selectedIds, onToggle, maxSelections = 4 }) => {
  const isSelected = selectedIds.includes(aircraft.id);
  const isDisabled = !isSelected && selectedIds.length >= maxSelections;
  
  return (
    <Card 
      className={`cursor-pointer transition-all ${
        isSelected 
          ? 'bg-orange-500/10 border-orange-500' 
          : isDisabled 
            ? 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed' 
            : 'bg-slate-900 border-slate-700 hover:border-orange-500/50'
      }`}
      onClick={() => !isDisabled && onToggle(aircraft.id)}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <Checkbox checked={isSelected} disabled={isDisabled} />
        <div className="h-12 w-12 bg-slate-800 rounded-lg flex items-center justify-center">
          <Plane className="h-6 w-6 text-orange-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-white font-medium">
            {aircraft.basic_info?.manufacturer} {aircraft.basic_info?.model}
          </h4>
          <p className="text-slate-400 text-sm">
            {aircraft.basic_info?.registration_number} • {aircraft.features?.total_seats} seats
          </p>
        </div>
        {aircraft.pricing?.hourly_price && (
          <Badge className="bg-green-500/20 text-green-400">
            ₹{aircraft.pricing.hourly_price.toLocaleString()}/hr
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

// ============ MAIN COMPARISON COMPONENT ============

export const AircraftComparison = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [availableAircraft, setAvailableAircraft] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch available aircraft
  useEffect(() => {
    fetchAircraft();
  }, []);
  
  const fetchAircraft = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/aircraft/public/featured?limit=12`);
      setAvailableAircraft(response.data.aircraft || []);
    } catch (error) {
      console.error('Failed to fetch aircraft:', error);
      toast.error('Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
    // Clear comparison when selection changes
    setComparisonData(null);
  };
  
  const runComparison = async () => {
    if (selectedIds.length < 2) {
      toast.error('Select at least 2 aircraft to compare');
      return;
    }
    
    setLoadingComparison(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aircraft/compare`,
        selectedIds,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setComparisonData(response.data);
      setActiveTab('overview');
      toast.success('Comparison ready!');
    } catch (error) {
      console.error('Comparison failed:', error);
      toast.error(error.response?.data?.detail || 'Comparison failed');
    } finally {
      setLoadingComparison(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-6xl my-8">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-slate-900 z-10 border-b border-slate-700">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-400" />
              AI Smart Comparison
            </CardTitle>
            <CardDescription>
              Compare up to 4 aircraft side-by-side to find the best option
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Aircraft Selection */}
          {!comparisonData && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-white font-medium">
                  Select Aircraft ({selectedIds.length}/4 selected)
                </h3>
                <Button
                  onClick={runComparison}
                  disabled={selectedIds.length < 2 || loadingComparison}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {loadingComparison ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Comparing...</>
                  ) : (
                    <><BarChart3 className="h-4 w-4 mr-2" /> Compare Now</>
                  )}
                </Button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {availableAircraft.map(aircraft => (
                    <AircraftSelector
                      key={aircraft.id}
                      aircraft={aircraft}
                      selectedIds={selectedIds}
                      onToggle={toggleSelection}
                    />
                  ))}
                </div>
              )}
              
              {availableAircraft.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-400">
                  <Plane className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No verified aircraft available for comparison</p>
                </div>
              )}
            </div>
          )}
          
          {/* Comparison Results */}
          {comparisonData && (
            <div className="space-y-6">
              {/* Back Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setComparisonData(null)}
              >
                ← Back to Selection
              </Button>
              
              {/* Highlights */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="p-4 text-center">
                    <Trophy className="h-6 w-6 text-green-400 mx-auto mb-2" />
                    <p className="text-green-400 font-semibold">Best Safety</p>
                    <p className="text-white text-sm">{comparisonData.highlights?.best_safety?.name}</p>
                    <Badge className="mt-1 bg-green-500/20 text-green-300">
                      Score: {comparisonData.highlights?.best_safety?.score}%
                    </Badge>
                  </CardContent>
                </Card>
                <Card className="bg-blue-500/10 border-blue-500/30">
                  <CardContent className="p-4 text-center">
                    <Star className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-blue-400 font-semibold">Best Amenities</p>
                    <p className="text-white text-sm">{comparisonData.highlights?.best_amenities?.name}</p>
                    <Badge className="mt-1 bg-blue-500/20 text-blue-300">
                      Score: {comparisonData.highlights?.best_amenities?.score}%
                    </Badge>
                  </CardContent>
                </Card>
                <Card className="bg-orange-500/10 border-orange-500/30">
                  <CardContent className="p-4 text-center">
                    <IndianRupee className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                    <p className="text-orange-400 font-semibold">Best Value</p>
                    <p className="text-white text-sm">{comparisonData.highlights?.best_value?.name}</p>
                    <Badge className="mt-1 bg-orange-500/20 text-orange-300">
                      {comparisonData.highlights?.best_value?.price}
                    </Badge>
                  </CardContent>
                </Card>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-2 border-b border-slate-700 pb-2">
                {['overview', 'specs', 'safety', 'amenities', 'pricing'].map(tab => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab(tab)}
                    className={activeTab === tab ? 'bg-orange-500' : ''}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Button>
                ))}
              </div>
              
              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="py-3 px-4 text-left text-slate-400 font-medium">Feature</th>
                      {comparisonData.comparison?.map((aircraft, idx) => (
                        <th key={idx} className="py-3 px-4 text-center">
                          <div className="space-y-1">
                            <p className="text-white font-semibold">{aircraft.name}</p>
                            <p className="text-slate-400 text-xs">{aircraft.registration}</p>
                            {aircraft.verification?.is_verified && (
                              <Badge className="bg-green-500/20 text-green-400 text-xs">
                                <Shield className="h-3 w-3 mr-1" /> Verified
                              </Badge>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'overview' && (
                      <>
                        <ComparisonRow 
                          label="Type" 
                          values={comparisonData.comparison.map(a => a.type)} 
                        />
                        <ComparisonRow 
                          label="Year" 
                          values={comparisonData.comparison.map(a => a.year)} 
                        />
                        <ComparisonRow 
                          label="Total Seats" 
                          values={comparisonData.comparison.map(a => a.capacity?.total_seats)} 
                        />
                        <ComparisonRow 
                          label="Safety Score" 
                          values={comparisonData.comparison.map(a => `${a.safety?.score}% (${a.safety?.rating})`)} 
                        />
                        <ComparisonRow 
                          label="Amenity Score" 
                          values={comparisonData.comparison.map(a => `${a.amenities?.score}% (${a.amenities?.rating})`)} 
                        />
                        <ComparisonRow 
                          label="Hourly Rate" 
                          values={comparisonData.comparison.map(a => a.pricing?.formatted_hourly)} 
                          type="price"
                        />
                      </>
                    )}
                    
                    {activeTab === 'specs' && (
                      <>
                        <ComparisonRow 
                          label="Engine Type" 
                          values={comparisonData.comparison.map(a => a.specs?.engine_type)} 
                        />
                        <ComparisonRow 
                          label="Cruise Speed" 
                          values={comparisonData.comparison.map(a => a.specs?.cruise_speed)} 
                        />
                        <ComparisonRow 
                          label="Range" 
                          values={comparisonData.comparison.map(a => a.specs?.range)} 
                        />
                        <ComparisonRow 
                          label="Max Altitude" 
                          values={comparisonData.comparison.map(a => a.specs?.max_altitude)} 
                        />
                        <ComparisonRow 
                          label="Cabin Size" 
                          values={comparisonData.comparison.map(a => a.capacity?.cabin_size)} 
                        />
                        <ComparisonRow 
                          label="Baggage Capacity" 
                          values={comparisonData.comparison.map(a => a.capacity?.baggage_kg ? `${a.capacity.baggage_kg} kg` : 'N/A')} 
                        />
                      </>
                    )}
                    
                    {activeTab === 'safety' && (
                      <>
                        <ComparisonRow 
                          label="Safety Score" 
                          values={comparisonData.comparison.map(a => `${a.safety?.score}%`)} 
                        />
                        <ComparisonRow 
                          label="TCAS (Collision Avoidance)" 
                          values={comparisonData.comparison.map(a => a.safety?.tcas)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Oxygen Kit (High Altitude)" 
                          values={comparisonData.comparison.map(a => a.safety?.oxygen_kit)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Parachute System (BRS)" 
                          values={comparisonData.comparison.map(a => a.safety?.parachute)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Pilots Required" 
                          values={comparisonData.comparison.map(a => a.crew?.pilots)} 
                        />
                        <ComparisonRow 
                          label="Co-Pilot Required" 
                          values={comparisonData.comparison.map(a => a.crew?.copilot_required)} 
                          type="boolean"
                        />
                      </>
                    )}
                    
                    {activeTab === 'amenities' && (
                      <>
                        <ComparisonRow 
                          label="Amenity Score" 
                          values={comparisonData.comparison.map(a => `${a.amenities?.score}%`)} 
                        />
                        <ComparisonRow 
                          label="WiFi" 
                          values={comparisonData.comparison.map(a => a.key_features?.wifi)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Meals Service" 
                          values={comparisonData.comparison.map(a => a.key_features?.meals)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Lavatory" 
                          values={comparisonData.comparison.map(a => a.key_features?.lavatory)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Entertainment" 
                          values={comparisonData.comparison.map(a => a.key_features?.entertainment)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Leather Seats" 
                          values={comparisonData.comparison.map(a => a.key_features?.leather_seats)} 
                          type="boolean"
                        />
                        <ComparisonRow 
                          label="Pet Friendly" 
                          values={comparisonData.comparison.map(a => a.key_features?.pet_friendly)} 
                          type="boolean"
                        />
                      </>
                    )}
                    
                    {activeTab === 'pricing' && (
                      <>
                        <ComparisonRow 
                          label="Hourly Rate" 
                          values={comparisonData.comparison.map(a => a.pricing?.formatted_hourly)} 
                          type="price"
                        />
                        <ComparisonRow 
                          label="Daily Rate" 
                          values={comparisonData.comparison.map(a => a.pricing?.formatted_daily)} 
                          type="price"
                        />
                        <ComparisonRow 
                          label="One-Way Price" 
                          values={comparisonData.comparison.map(a => a.pricing?.one_way ? `₹${a.pricing.one_way.toLocaleString()}` : 'Quote')} 
                          type="price"
                        />
                        <ComparisonRow 
                          label="VIP Seats" 
                          values={comparisonData.comparison.map(a => a.capacity?.vip_seats || 0)} 
                        />
                        <ComparisonRow 
                          label="Cabin Crew" 
                          values={comparisonData.comparison.map(a => a.crew?.cabin_crew || 0)} 
                        />
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                {comparisonData.comparison?.map((aircraft, idx) => (
                  <Button 
                    key={idx}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    Book {aircraft.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AircraftComparison;
