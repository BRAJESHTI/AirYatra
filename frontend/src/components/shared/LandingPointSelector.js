import React, { useState, useEffect, useRef } from 'react';
import { 
  Plane, Building2, TreePine, MapPin, Search, Check, X, 
  AlertTriangle, Calendar, DollarSign, Loader2, ChevronDown, Home
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { landingAPI, pincodeAPI } from '@/services/api';
import { toast } from 'sonner';

// Landing Point Type Icons & Colors
const typeConfig = {
  airport: { 
    icon: Plane, 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/20',
    label: 'Airport / एयरपोर्ट'
  },
  govt_helipad: { 
    icon: Building2, 
    color: 'text-green-400', 
    bg: 'bg-green-500/20',
    label: 'Govt Helipad / सरकारी हेलीपैड'
  },
  private_helipad: { 
    icon: Building2, 
    color: 'text-purple-400', 
    bg: 'bg-purple-500/20',
    label: 'Private Helipad / प्राइवेट हेलीपैड'
  },
  village_land: { 
    icon: TreePine, 
    color: 'text-orange-400', 
    bg: 'bg-orange-500/20',
    label: 'Village Land / गांव की जमीन'
  },
};

function LandingPointSelector({ 
  label, 
  type = 'pickup', // 'pickup' or 'drop'
  selectedDate,
  onSelect,
  selectedPoint,
  aircraftType = 'helicopter'
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [showVillageInput, setShowVillageInput] = useState(false);
  const [villageData, setVillageData] = useState({
    pincode: '',
    area: '',
    district: '',
    state: '',
    latitude: null,
    longitude: null
  });
  const [loadingPincode, setLoadingPincode] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search landing points
  const handleSearch = async (term) => {
    setSearchTerm(term);
    setShowVillageInput(false); // Reset village input when searching
    
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      // Use public search endpoint (no auth required)
      const response = await landingAPI.publicSearch(term, aircraftType === 'chartered_plane' ? 'airport' : null);
      let results = response.data.landing_points || [];

      setSearchResults(results.slice(0, 15));
      setShowDropdown(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle PIN code lookup for village area
  const handlePincodeChange = async (pincode) => {
    setVillageData(prev => ({ ...prev, pincode }));
    
    if (pincode.length === 6) {
      setLoadingPincode(true);
      try {
        const response = await pincodeAPI.lookup(pincode);
        const data = response.data;
        
        // Handle response with locations array
        if (data.success && data.locations && data.locations.length > 0) {
          const location = data.locations[0];
          setVillageData({
            pincode,
            area: location.area || data.district || data.area || '',
            district: location.district || data.district || '',
            state: location.state || data.state || '',
            latitude: location.latitude || data.latitude || null,
            longitude: location.longitude || data.longitude || null
          });
          
          // Show warning for estimated locations
          if (data.source === 'estimated' || data.source === 'default_fallback') {
            toast.warning('Approximate location detected. Verify coordinates. / अनुमानित स्थान। कृपया निर्देशांक सत्यापित करें।');
          }
        } else if (data.area || data.district) {
          // Fallback to direct fields
          setVillageData({
            pincode,
            area: data.area || data.location || `Area ${pincode}`,
            district: data.district || 'Unknown',
            state: data.state || 'India',
            latitude: data.latitude || null,
            longitude: data.longitude || null
          });
          
          if (data.warning) {
            toast.warning(data.warning);
          }
        } else {
          // Even if response doesn't have expected fields, use whatever is available
          setVillageData({
            pincode,
            area: `Area ${pincode}`,
            district: 'Please verify',
            state: 'India',
            latitude: data.latitude || 20.5937,  // Center of India fallback
            longitude: data.longitude || 78.9629
          });
          toast.warning('Location details limited. Please verify before booking. / स्थान विवरण सीमित। कृपया बुकिंग से पहले सत्यापित करें।');
        }
      } catch (error) {
        console.error('PIN code lookup error:', error);
        // Graceful fallback - don't block user
        setVillageData({
          pincode,
          area: `Area ${pincode}`,
          district: 'Please verify manually',
          state: 'India',
          latitude: 20.5937,  // Center of India
          longitude: 78.9629
        });
        toast.warning('Could not verify PIN code. Please verify location manually. / पिन कोड सत्यापित नहीं हो सका। कृपया मैन्युअल रूप से स्थान सत्यापित करें।');
      } finally {
        setLoadingPincode(false);
      }
    }
  };

  // Select village area as landing point
  const handleSelectVillageArea = () => {
    if (!villageData.area || !villageData.pincode) {
      toast.error('Please enter valid PIN code / कृपया सही पिन कोड दर्ज करें');
      return;
    }

    const villageLandingData = {
      landing_point_id: `custom_village_${villageData.pincode}`,
      landing_point_code: `VLN-CUSTOM-${villageData.pincode}`,
      landing_point_name: `${villageData.area}, ${villageData.district}`,
      landing_point_type: 'village_land',
      city: villageData.area,
      state: villageData.state,
      district: villageData.district,
      pincode: villageData.pincode,
      latitude: villageData.latitude,
      longitude: villageData.longitude,
      permission_required: true, // Village land always requires permission
      rent_applicable: false,
      availability_calendar_required: false,
      is_custom_village: true // Flag to identify custom village entries
    };

    onSelect(villageLandingData);
    setSearchTerm(`${villageData.area}, ${villageData.district}`);
    setShowDropdown(false);
    setShowVillageInput(false);
    toast.success('Village area selected / गांव क्षेत्र चुना गया');
  };

  // Check availability for private helipads
  const checkAvailability = async (point) => {
    if (!point.availability_calendar_required || !selectedDate) {
      return { available: true };
    }

    setCheckingAvailability(true);
    try {
      const response = await landingAPI.checkAvailability(
        point.id, 
        selectedDate
      );
      return response.data;
    } catch (error) {
      console.error('Availability check failed:', error);
      return { available: true, error: true };
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Handle point selection
  const handleSelectPoint = async (point) => {
    // Check availability for private helipads
    if (point.availability_calendar_required && selectedDate) {
      const availabilityResult = await checkAvailability(point);
      
      if (!availabilityResult.available) {
        toast.error(
          `${point.name} is not available on ${selectedDate}. ` +
          `${availabilityResult.alternatives?.length > 0 ? 'Check alternatives.' : ''}`
        );
        
        // Show alternatives
        if (availabilityResult.alternatives?.length > 0) {
          setSearchResults(prev => {
            const altIds = availabilityResult.alternatives.map(a => a.id);
            return prev.filter(p => altIds.includes(p.id) || p.id === point.id);
          });
        }
        return;
      }
    }

    // Prepare landing point data with all details
    const landingData = {
      landing_point_id: point.id,
      landing_point_code: point.code,
      landing_point_name: point.name,
      landing_point_type: point.type,
      city: point.city,
      state: point.state,
      district: point.district,
      latitude: point.latitude,
      longitude: point.longitude,
      permission_required: point.permission_required,
      rent_applicable: point.rent_applicable,
      availability_calendar_required: point.availability_calendar_required,
    };

    onSelect(landingData);
    setSearchTerm(point.name);
    setShowDropdown(false);
  };

  // Clear selection
  const handleClear = () => {
    setSearchTerm('');
    setSearchResults([]);
    onSelect(null);
  };

  const TypeIcon = ({ pointType }) => {
    const config = typeConfig[pointType] || typeConfig.airport;
    const Icon = config.icon;
    return (
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Label className="text-white mb-2 block">
        {label} <span className="text-red-500">*</span>
      </Label>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search city, airport, helipad... / शहर, एयरपोर्ट खोजें..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          className="pl-10 pr-10 bg-slate-800 border-slate-600 text-white"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400 animate-spin" />
        )}
        {selectedPoint && !loading && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-xl max-h-80 overflow-y-auto">
          {searchResults.map((point) => (
            <button
              key={point.id}
              onClick={() => handleSelectPoint(point)}
              className="w-full p-3 flex items-start gap-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700 last:border-0 text-left"
            >
              <TypeIcon pointType={point.type} />
              
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{point.name}</p>
                <p className="text-slate-400 text-sm">{point.city}, {point.state}</p>
                
                {/* Rules badges */}
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${typeConfig[point.type]?.bg} ${typeConfig[point.type]?.color}`}>
                    {typeConfig[point.type]?.label?.split('/')[0].trim()}
                  </span>
                  
                  {point.permission_required && (
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Permission
                    </span>
                  )}
                  
                  {point.rent_applicable && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Rent
                    </span>
                  )}
                  
                  {point.availability_calendar_required && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Calendar
                    </span>
                  )}
                </div>
              </div>
              
              <ChevronDown className="h-4 w-4 text-slate-500 rotate-[-90deg]" />
            </button>
          ))}
        </div>
      )}

      {/* Selected Point Display */}
      {selectedPoint && (
        <div className={`mt-3 p-4 rounded-lg border ${
          type === 'pickup' 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-start gap-3">
            <TypeIcon pointType={selectedPoint.landing_point_type} />
            
            <div className="flex-1">
              <p className={`font-medium ${type === 'pickup' ? 'text-green-400' : 'text-red-400'}`}>
                {selectedPoint.landing_point_name}
              </p>
              <p className="text-slate-400 text-sm">
                {selectedPoint.city}, {selectedPoint.state}
              </p>
              
              {/* Warnings */}
              {selectedPoint.permission_required && (
                <div className="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/30 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-400 text-sm font-medium">
                      Permission Required / अनुमति आवश्यक
                    </p>
                    <p className="text-yellow-400/70 text-xs">
                      Admin approval needed before booking / बुकिंग से पहले एडमिन अप्रूवल जरूरी
                    </p>
                  </div>
                </div>
              )}
              
              {selectedPoint.rent_applicable && (
                <p className="mt-2 text-green-400 text-sm flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Landing charges applicable / लैंडिंग शुल्क लागू
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No results message - Show Village Area Option */}
      {showDropdown && searchTerm.length >= 2 && searchResults.length === 0 && !loading && !showVillageInput && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-xl p-4">
          <div className="text-center mb-4">
            <MapPin className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400">No landing points found / कोई लैंडिंग पॉइंट नहीं मिला</p>
          </div>
          
          {/* Select Village Area Option */}
          <div className="border-t border-slate-700 pt-4">
            <button
              onClick={() => {
                setShowVillageInput(true);
                setShowDropdown(false);
              }}
              className="w-full p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg flex items-center gap-3 transition-colors"
            >
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <TreePine className="h-5 w-5 text-orange-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-orange-400 font-medium">Select Village Area / गांव क्षेत्र चुनें</p>
                <p className="text-orange-400/70 text-xs">
                  Enter PIN Code to select your village / पिन कोड दर्ज करें
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-orange-400 rotate-[-90deg]" />
            </button>
          </div>
        </div>
      )}

      {/* Village Area Input Form */}
      {showVillageInput && (
        <div className="mt-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <TreePine className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h4 className="text-orange-400 font-medium">Select Village Area / गांव क्षेत्र चुनें</h4>
              <p className="text-orange-400/70 text-xs">
                Enter your village PIN code to get location details
              </p>
            </div>
          </div>

          {/* PIN Code Input */}
          <div className="space-y-3">
            <div>
              <Label className="text-slate-300 text-sm mb-1 block">PIN Code / पिन कोड *</Label>
              <div className="relative">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit PIN code"
                  value={villageData.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value.replace(/\D/g, ''))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
                {loadingPincode && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Location Details (auto-filled from PIN code) */}
            {villageData.area && (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-white font-medium">{villageData.area}</p>
                <p className="text-slate-400 text-sm">{villageData.district}, {villageData.state}</p>
                {villageData.latitude && (
                  <p className="text-slate-500 text-xs mt-1">
                    📍 {villageData.latitude.toFixed(4)}, {villageData.longitude.toFixed(4)}
                  </p>
                )}
              </div>
            )}

            {/* Permission Warning */}
            <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 text-sm font-medium">Landing Permission Required</p>
                  <p className="text-yellow-400/70 text-xs">
                    Village landing requires documents: Collector NOC, Fire Dept, Police & SP/DCP Acknowledgments
                  </p>
                  <p className="text-yellow-400/70 text-xs">
                    गांव लैंडिंग के लिए दस्तावेज़ आवश्यक: कलेक्टर NOC, फायर विभाग, पुलिस और SP/DCP पावती
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSelectVillageArea}
                disabled={!villageData.area || loadingPincode}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                <Check className="h-4 w-4 mr-2" />
                Select This Location
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowVillageInput(false);
                  setVillageData({ pincode: '', area: '', district: '', state: '', latitude: null, longitude: null });
                }}
                className="border-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPointSelector;
