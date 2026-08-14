import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Plane, Shield, Users, Search, Filter, Star, MapPin,
  IndianRupee, Clock, Wifi, Wind, Coffee, ChevronRight,
  Loader2, X, Scale, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import CompareWidget, { CompareButton, useCompareAircraft } from './CompareWidget';
import AircraftComparison from './AircraftComparison';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Public Aircraft Browse Page with Compare Feature
 * Customer-facing catalog with floating compare widget
 */
const PublicAircraftBrowse = () => {
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    aircraft_type: '',
    min_seats: '',
    max_price: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
  // Compare hook
  const { 
    selectedForCompare, 
    toggleAircraft, 
    removeAircraft, 
    clearAll, 
    isSelected 
  } = useCompareAircraft(3);
  
  // Fetch aircraft
  useEffect(() => {
    fetchAircraft();
  }, []);
  
  const fetchAircraft = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.aircraft_type) params.append('aircraft_type', filters.aircraft_type);
      if (filters.min_seats) params.append('min_seats', filters.min_seats);
      if (filters.max_price) params.append('max_hourly_price', filters.max_price);
      
      const response = await axios.get(`${API_URL}/api/aircraft/public/browse?${params}`);
      setAircraft(response.data.aircraft || []);
    } catch (error) {
      console.error('Failed to fetch aircraft:', error);
      toast.error('Failed to load aircraft catalog');
    } finally {
      setLoading(false);
    }
  };
  
  // Filter aircraft by search
  const filteredAircraft = aircraft.filter(a => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    const model = (a.basic_info?.model || '').toLowerCase();
    const manufacturer = (a.basic_info?.manufacturer || '').toLowerCase();
    const registration = (a.basic_info?.registration_number || '').toLowerCase();
    return model.includes(searchLower) || 
           manufacturer.includes(searchLower) || 
           registration.includes(searchLower);
  });
  
  // Handle compare button click
  const handleCompare = () => {
    if (selectedForCompare.length < 2) {
      toast.error('Select at least 2 aircraft to compare');
      return;
    }
    setShowComparison(true);
  };
  
  // Render comparison page
  if (showComparison) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="h-6 w-6 text-orange-400" />
            Aircraft Comparison</h2>
          <Button variant="outline" onClick={() => setShowComparison(false)}>
            <ArrowRight className="h-4 w-4 mr-2 rotate-180" /> Back to Catalog
          </Button>
        </div>
        
        <AircraftComparison 
          preSelectedAircraft={selectedForCompare}
          onClose={() => setShowComparison(false)}
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Plane className="h-6 w-6 text-orange-400" />
            Aircraft Catalog</h2>
          <p className="text-slate-400 text-sm mt-1">
            Browse verified aircraft • Compare prices • Book instantly
          </p>
        </div>
        
        {/* Search */}
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by model, manufacturer..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 w-64 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-slate-700' : ''}
          >
            <Filter className="h-4 w-4 mr-2" /> Filters
          </Button>
        </div>
      </div>
      
      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Aircraft Type</label>
                <select
                  value={filters.aircraft_type}
                  onChange={(e) => setFilters({ ...filters, aircraft_type: e.target.value })}
                  className="w-full h-10 bg-slate-700 border border-slate-600 rounded-md text-white px-3"
                >
                  <option value="">All Types</option>
                  <option value="helicopter">Helicopter</option>
                  <option value="light_jet">Light Jet</option>
                  <option value="mid_jet">Mid Jet</option>
                  <option value="heavy_jet">Heavy Jet</option>
                  <option value="turboprop">Turboprop</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Min Seats</label>
                <Input
                  type="number"
                  value={filters.min_seats}
                  onChange={(e) => setFilters({ ...filters, min_seats: e.target.value })}
                  placeholder="Any"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Max Hourly Price (₹)</label>
                <Input
                  type="number"
                  value={filters.max_price}
                  onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
                  placeholder="Any"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchAircraft} className="w-full bg-orange-500 hover:bg-orange-600">
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-slate-400">
          {filteredAircraft.length} aircraft found
        </p>
        {selectedForCompare.length > 0 && (
          <Badge className="bg-orange-500/20 text-orange-400">
            <Scale className="h-3 w-3 mr-1" />
            {selectedForCompare.length} selected for compare
          </Badge>
        )}
      </div>
      
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      )}
      
      {/* Aircraft Grid */}
      {!loading && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAircraft.map((craft) => (
            <AircraftBrowseCard 
              key={craft.id}
              aircraft={craft}
              isSelected={isSelected(craft.id)}
              onToggleCompare={() => toggleAircraft(craft)}
              compareDisabled={!isSelected(craft.id) && selectedForCompare.length >= 3}
            />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {!loading && filteredAircraft.length === 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="py-12 text-center">
            <Plane className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Aircraft Found</h3>
            <p className="text-slate-400">Try adjusting your filters or search query</p>
          </CardContent>
        </Card>
      )}
      
      {/* Floating Compare Widget */}
      <CompareWidget
        selectedAircraft={selectedForCompare}
        onRemove={removeAircraft}
        onCompare={handleCompare}
        onClear={clearAll}
        maxCompare={3}
      />
    </div>
  );
};

/**
 * Individual Aircraft Card for Browse Page
 */
const AircraftBrowseCard = ({ 
  aircraft, 
  isSelected, 
  onToggleCompare,
  compareDisabled 
}) => {
  const { basic_info, features, pricing, verification, verification_badge } = aircraft;
  
  return (
    <Card className={`bg-slate-900 border-slate-700 overflow-hidden transition-all ${
      isSelected ? 'ring-2 ring-orange-500' : ''
    }`}>
      {/* Header Image */}
      <div className="h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative">
        <Plane className="h-16 w-16 text-slate-600" />
        
        {/* Verification Badge */}
        {verification?.status === 'verified' && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
              <Shield className="h-3 w-3 mr-1" /> Verified
            </Badge>
          </div>
        )}
        
        {/* AirYatra Badge */}
        {verification_badge?.is_verified && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-orange-500 text-white">
              <Star className="h-3 w-3 mr-1" /> Verified by AirYatra
            </Badge>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        {/* Title */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {basic_info?.manufacturer} {basic_info?.model}
            </h3>
            <p className="text-slate-400 text-sm">
              {basic_info?.registration_number} • {basic_info?.year_of_manufacture}
            </p>
          </div>
          <Badge variant="outline" className="text-orange-400 border-orange-400 capitalize">
            {basic_info?.aircraft_type?.replace(/_/g, ' ')}
          </Badge>
        </div>
        
        {/* Features */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <Badge variant="secondary" className="bg-slate-800">
            <Users className="h-3 w-3 mr-1" /> {features?.total_seats || 'N/A'} Seats
          </Badge>
          {features?.wifi && (
            <Badge variant="secondary" className="bg-slate-800">
              <Wifi className="h-3 w-3 mr-1" /> WiFi
            </Badge>
          )}
          {features?.air_conditioning && (
            <Badge variant="secondary" className="bg-slate-800">
              <Wind className="h-3 w-3 mr-1" /> AC
            </Badge>
          )}
        </div>
        
        {/* Pricing */}
        {pricing?.hourly_price && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl font-bold text-green-400">
              ₹{pricing.hourly_price.toLocaleString()}
            </span>
            <span className="text-slate-400 text-sm">/hour</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-slate-700">
          <Button 
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            data-testid={`view-details-${aircraft.id}`}
          >
            View Details <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <CompareButton
            aircraft={aircraft}
            isSelected={isSelected}
            onToggle={onToggleCompare}
            disabled={compareDisabled}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PublicAircraftBrowse;
