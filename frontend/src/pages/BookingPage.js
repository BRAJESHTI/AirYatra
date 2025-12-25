import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plane, Calendar, Users, Clock, CreditCard, Shield, User, Phone, 
  MapPin, ChevronLeft, ChevronRight, Check, AlertCircle, 
  Briefcase, Target, Navigation, Calculator, Send, Loader2,
  UserCircle, Mail, Weight, Luggage, Baby, UserPlus, Building2, TreePine, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { bookingAPI, settingsAPI, landingAPI } from '../services/api';
import { toast } from 'sonner';
import PinCodeInput from '../components/shared/PinCodeInput';
import LandingPointSelector from '../components/shared/LandingPointSelector';

// Step indicator component
const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
    {steps.map((step, index) => (
      <React.Fragment key={step.id}>
        <div className="flex flex-col items-center min-w-[80px]">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
            currentStep > index ? 'bg-green-500 text-white' :
            currentStep === index ? 'bg-orange-500 text-white ring-4 ring-orange-500/30' :
            'bg-slate-700 text-slate-400'
          }`}>
            {currentStep > index ? <Check className="h-5 w-5" /> : index + 1}
          </div>
          <span className={`text-xs mt-2 text-center ${currentStep === index ? 'text-orange-400 font-medium' : 'text-slate-500'}`}>
            {step.title}
          </span>
        </div>
        {index < steps.length - 1 && (
          <div className={`w-12 h-1 mx-1 rounded ${currentStep > index ? 'bg-green-500' : 'bg-slate-700'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// Customer Profile Card
const CustomerProfileCard = ({ user }) => {
  if (!user) return null;
  
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center overflow-hidden">
          {user.profile_picture ? (
            <img src={user.profile_picture} alt={user.full_name} className="w-full h-full object-cover" />
          ) : (
            <UserCircle className="h-10 w-10 text-orange-400" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg">{user.full_name || user.email}</h3>
          <p className="text-slate-400 text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> {user.email}
          </p>
          {user.phone && (
            <p className="text-slate-400 text-sm flex items-center gap-2">
              <Phone className="h-4 w-4" /> {user.phone}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
            {user.roles?.[0] || 'Customer'}
          </span>
        </div>
      </div>
    </div>
  );
};

function BookingPage({ user }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Passenger & Aircraft Selection
    aircraft_type: '', // helicopter, chartered_plane
    total_passengers: 1,
    adults_male: 1,
    adults_female: 0,
    children_count: 0, // up to 4 years free, max 2
    
    // Step 2: Booking Details (Dropdowns)
    udan_prakar: '', // flight type
    booking_for: '',
    booking_purpose: '',
    booking_purpose_other: '',
    
    // Step 3: Route Details - Landing Points
    pickup_landing_point: null, // Full landing point object
    drop_landing_point: null,   // Full landing point object
    departure_date: '',
    pickup_time: '',
    
    // Legacy fields (for compatibility)
    pickup_pincode: '',
    pickup_location: '',
    pickup_state: '',
    pickup_district: '',
    pickup_latitude: null,
    pickup_longitude: null,
    drop_pincode: '',
    drop_location: '',
    drop_state: '',
    drop_district: '',
    drop_latitude: null,
    drop_longitude: null,
    
    // Step 4: Price will be calculated
    special_requirements: '',
  });

  // Pricing state
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [pricingSettings, setPricingSettings] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [landingRent, setLandingRent] = useState({ pickup: null, drop: null, total: 0 });
  const [permissionRequired, setPermissionRequired] = useState(false);

  const steps = [
    { id: 'passengers', title: 'यात्री / Passengers' },
    { id: 'booking_type', title: 'बुकिंग प्रकार' },
    { id: 'route', title: 'मार्ग / Route' },
    { id: 'price_inquiry', title: 'मूल्य / Price' },
  ];

  // Aircraft Types
  const aircraftTypes = [
    { value: 'helicopter', label: 'Helicopter / हेलीकॉप्टर', icon: '🚁', maxPassengers: 6 },
    { value: 'chartered_plane', label: 'Chartered Plane / चार्टर्ड प्लेन', icon: '✈️', maxPassengers: 19 },
  ];

  // Udan Ka Prakar (Flight Type)
  const udanPrakarOptions = [
    { value: 'one_hour', label: '1 Hour Flight / 1 घंटे की उड़ान', icon: '⏱️' },
    { value: 'two_hour', label: '2 Hour Flight / 2 घंटे की उड़ान', icon: '⏰' },
    { value: 'half_day', label: 'Half Day / आधा दिन', icon: '🌤️' },
    { value: 'full_day', label: 'Full Day / पूरा दिन', icon: '☀️' },
    { value: 'multi_city', label: 'Multi-City / बहु-शहर', icon: '🗺️' },
    { value: 'point_to_point', label: 'Point-to-Point / पॉइंट-टू-पॉइंट', icon: '📍' },
  ];

  // Booking For Options
  const bookingForOptions = [
    { value: 'self', label: 'Self / खुद के लिए', icon: '👤' },
    { value: 'friend_family', label: 'Friend & Family / दोस्त और परिवार', icon: '👨‍👩‍👧' },
    { value: 'company', label: 'Company / Corporate / कंपनी', icon: '🏢' },
    { value: 'political', label: 'Political / VIP / राजनीतिक', icon: '🎖️' },
    { value: 'other', label: 'Other / अन्य', icon: '📝' },
  ];

  // Booking Purpose Options
  const bookingPurposeOptions = [
    { value: 'wedding', label: 'Wedding / शादी', icon: '💒' },
    { value: 'temple_yatra', label: 'Temple Yatra / मंदिर यात्रा', icon: '🛕' },
    { value: 'company_tour', label: 'Corporate Tour / कॉर्पोरेट टूर', icon: '🏢' },
    { value: 'election_tour', label: 'Election Campaign / चुनाव प्रचार', icon: '🗳️' },
    { value: 'medical_emergency', label: 'Medical Emergency / मेडिकल', icon: '🏥' },
    { value: 'film_shooting', label: 'Film Shooting / फिल्म शूटिंग', icon: '🎬' },
    { value: 'general_tour', label: 'General Tour / सामान्य यात्रा', icon: '✈️' },
    { value: 'pilgrimage', label: 'Pilgrimage / तीर्थ यात्रा', icon: '🙏' },
    { value: 'business', label: 'Business Meeting / बिज़नेस', icon: '💼' },
    { value: 'other', label: 'Other / अन्य', icon: '📝' },
  ];

  useEffect(() => {
    loadPricingSettings();
  }, []);

  useEffect(() => {
    // Calculate total passengers
    const total = parseInt(formData.adults_male || 0) + parseInt(formData.adults_female || 0);
    setFormData(prev => ({ ...prev, total_passengers: total }));
  }, [formData.adults_male, formData.adults_female]);

  useEffect(() => {
    // Calculate distance when both locations are set
    console.log('Distance useEffect triggered:', {
      pickup_lat: formData.pickup_latitude,
      pickup_lng: formData.pickup_longitude,
      drop_lat: formData.drop_latitude,
      drop_lng: formData.drop_longitude
    });
    
    if (formData.pickup_latitude && formData.drop_latitude && 
        formData.pickup_longitude && formData.drop_longitude) {
      const dist = calculateDistance(
        formData.pickup_latitude, formData.pickup_longitude,
        formData.drop_latitude, formData.drop_longitude
      );
      console.log('Calculated distance:', dist);
      setDistanceKm(Math.round(dist));
    }
  }, [formData.pickup_latitude, formData.pickup_longitude, formData.drop_latitude, formData.drop_longitude]);

  useEffect(() => {
    // Calculate price when we have all required data
    if (currentStep === 3 && formData.udan_prakar && distanceKm > 0) {
      calculatePrice();
    }
  }, [currentStep, formData.udan_prakar, distanceKm, pricingSettings]);

  const loadPricingSettings = async () => {
    try {
      const response = await settingsAPI.getPublicPricing();
      setPricingSettings(response.data);
    } catch (err) {
      console.error('Failed to load pricing settings');
      // Default pricing
      setPricingSettings({
        base_price: 50000,
        rate_per_km: 500,
        helicopter_multiplier: 1,
        plane_multiplier: 1.5,
        dynamic_pricing_enabled: true,
        custom_price_enabled: true,
      });
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculatePrice = () => {
    if (!pricingSettings) return;
    
    const settings = pricingSettings;
    let basePrice = settings.base_price || 50000;
    let kmPrice = (settings.rate_per_km || 500) * distanceKm;
    
    // Aircraft type multiplier
    const multiplier = formData.aircraft_type === 'chartered_plane' 
      ? (settings.plane_multiplier || 1.5) 
      : (settings.helicopter_multiplier || 1);
    
    // Udan Prakar based pricing
    let udanMultiplier = 1;
    switch (formData.udan_prakar) {
      case 'one_hour': udanMultiplier = 0.8; break;
      case 'two_hour': udanMultiplier = 1; break;
      case 'half_day': udanMultiplier = 1.5; break;
      case 'full_day': udanMultiplier = 2.5; break;
      case 'multi_city': udanMultiplier = 3; break;
      case 'point_to_point': udanMultiplier = 1; break;
      default: udanMultiplier = 1;
    }
    
    const subtotal = (basePrice + kmPrice) * multiplier * udanMultiplier;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    setPriceEstimate({
      base_price: Math.round(basePrice),
      km_price: Math.round(kmPrice),
      distance_km: distanceKm,
      multiplier: multiplier,
      udan_multiplier: udanMultiplier,
      subtotal: Math.round(subtotal),
      gst: Math.round(gst),
      total: Math.round(total),
      is_approximate: true,
      note: 'Final price will be confirmed by operator / अंतिम मूल्य ऑपरेटर द्वारा पुष्टि होगी'
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationSelect = (type, locationData) => {
    console.log(`handleLocationSelect called for ${type}:`, locationData);
    const prefix = type === 'pickup' ? 'pickup' : 'drop';
    setFormData(prev => {
      const newData = {
        ...prev,
        [`${prefix}_pincode`]: locationData.pincode || '',
        [`${prefix}_location`]: locationData.area || locationData.location || '',
        [`${prefix}_state`]: locationData.state || '',
        [`${prefix}_district`]: locationData.district || '',
        [`${prefix}_latitude`]: parseFloat(locationData.latitude) || null,
        [`${prefix}_longitude`]: parseFloat(locationData.longitude) || null,
      };
      console.log(`Updated ${prefix} coordinates:`, newData[`${prefix}_latitude`], newData[`${prefix}_longitude`]);
      return newData;
    });
  };

  const validateStep = (step) => {
    switch (step) {
      case 0: // Passengers
        if (!formData.aircraft_type) {
          toast.error('Please select aircraft type / विमान प्रकार चुनें');
          return false;
        }
        if (formData.total_passengers < 1) {
          toast.error('At least 1 adult passenger required / कम से कम 1 वयस्क यात्री आवश्यक');
          return false;
        }
        if (formData.children_count > 2) {
          toast.error('Maximum 2 children allowed / अधिकतम 2 बच्चे');
          return false;
        }
        return true;
        
      case 1: // Booking Type
        if (!formData.udan_prakar) {
          toast.error('Please select flight type / उड़ान प्रकार चुनें');
          return false;
        }
        if (!formData.booking_for) {
          toast.error('Please select booking for / बुकिंग किसके लिए चुनें');
          return false;
        }
        if (!formData.booking_purpose) {
          toast.error('Please select booking purpose / बुकिंग उद्देश्य चुनें');
          return false;
        }
        return true;
        
      case 2: // Route
        if (!formData.pickup_location || !formData.pickup_pincode) {
          toast.error('Please enter pickup location / पिकअप स्थान दर्ज करें');
          return false;
        }
        if (!formData.drop_location || !formData.drop_pincode) {
          toast.error('Please enter drop location / ड्रॉप स्थान दर्ज करें');
          return false;
        }
        if (!formData.departure_date) {
          toast.error('Please select departure date / प्रस्थान तारीख चुनें');
          return false;
        }
        if (!formData.pickup_time) {
          toast.error('Please select pickup time / पिकअप समय चुनें');
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmitInquiry = async () => {
    if (!user) {
      toast.error('Please login to submit inquiry / इंक्वायरी के लिए लॉगिन करें');
      navigate('/login');
      return;
    }
    
    setSubmitting(true);
    try {
      const inquiryData = {
        ...formData,
        customer_id: user.id,
        customer_name: user.full_name || user.email,
        customer_email: user.email,
        customer_phone: user.phone,
        distance_km: distanceKm,
        estimated_price: priceEstimate?.total || 0,
        price_breakdown: priceEstimate,
        status: 'pending_acceptance',
        created_at: new Date().toISOString(),
      };
      
      const response = await bookingAPI.createInquiry(inquiryData);
      
      toast.success('🎉 Inquiry submitted! Operators will respond soon / इंक्वायरी जमा! ऑपरेटर जल्द जवाब देंगे');
      
      // Navigate to inquiry status page
      navigate(`/customer/inquiry/${response.data.inquiry_id}`, { 
        state: { newInquiry: true } 
      });
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  // Render Step 1: Passengers & Aircraft Selection
  const renderPassengersStep = () => (
    <div className="space-y-6">
      {/* Aircraft Type Selection */}
      <div>
        <Label className="text-white text-lg mb-4 block">
          Select Aircraft Type / विमान प्रकार चुनें <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aircraftTypes.map(type => (
            <button
              key={type.value}
              onClick={() => handleInputChange('aircraft_type', type.value)}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                formData.aircraft_type === type.value
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <span className="text-4xl mb-3 block">{type.icon}</span>
              <span className="text-white font-semibold block">{type.label}</span>
              <span className="text-slate-400 text-sm">Max {type.maxPassengers} passengers</span>
            </button>
          ))}
        </div>
      </div>

      {/* Adult Passengers */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-400" />
          Adult Passengers / वयस्क यात्री
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Male Adults */}
          <div>
            <Label className="text-slate-300 mb-2 block">Male / पुरुष</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleInputChange('adults_male', Math.max(0, formData.adults_male - 1))}
                className="border-slate-600"
              >
                -
              </Button>
              <span className="text-white text-2xl font-bold w-12 text-center">{formData.adults_male}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleInputChange('adults_male', formData.adults_male + 1)}
                className="border-slate-600"
              >
                +
              </Button>
            </div>
          </div>
          
          {/* Female Adults */}
          <div>
            <Label className="text-slate-300 mb-2 block">Female / महिला</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleInputChange('adults_female', Math.max(0, formData.adults_female - 1))}
                className="border-slate-600"
              >
                -
              </Button>
              <span className="text-white text-2xl font-bold w-12 text-center">{formData.adults_female}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleInputChange('adults_female', formData.adults_female + 1)}
                className="border-slate-600"
              >
                +
              </Button>
            </div>
          </div>
        </div>
        
        {/* Total Adults */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-slate-400">
            Total Adults / कुल वयस्क: <span className="text-orange-400 font-bold text-xl">{formData.total_passengers}</span>
          </p>
        </div>
      </div>

      {/* Children */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Baby className="h-5 w-5 text-blue-400" />
          Children (Up to 4 years) / बच्चे (4 साल तक)
        </h3>
        <p className="text-green-400 text-sm mb-4">✨ FREE - Max 2 children / मुफ्त - अधिकतम 2 बच्चे</p>
        
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleInputChange('children_count', Math.max(0, formData.children_count - 1))}
            className="border-slate-600"
          >
            -
          </Button>
          <span className="text-white text-2xl font-bold w-12 text-center">{formData.children_count}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleInputChange('children_count', Math.min(2, formData.children_count + 1))}
            className="border-slate-600"
            disabled={formData.children_count >= 2}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );

  // Render Step 2: Booking Type (Dropdowns)
  const renderBookingTypeStep = () => (
    <div className="space-y-6">
      {/* Udan Ka Prakar - Dropdown */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <Label className="text-white text-lg mb-3 block flex items-center gap-2">
          <Plane className="h-5 w-5 text-orange-400" />
          उड़ान का प्रकार / Flight Type <span className="text-red-500">*</span>
        </Label>
        <select
          value={formData.udan_prakar}
          onChange={(e) => handleInputChange('udan_prakar', e.target.value)}
          className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        >
          <option value="" className="bg-slate-900">-- Select Flight Type / उड़ान प्रकार चुनें --</option>
          {udanPrakarOptions.map(option => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.icon} {option.label}
            </option>
          ))}
        </select>
        {formData.udan_prakar && (
          <p className="mt-2 text-orange-400 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            Selected: {udanPrakarOptions.find(o => o.value === formData.udan_prakar)?.label}
          </p>
        )}
      </div>

      {/* Booking For - Dropdown */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <Label className="text-white text-lg mb-3 block flex items-center gap-2">
          <User className="h-5 w-5 text-blue-400" />
          बुकिंग किसके लिए / Booking For <span className="text-red-500">*</span>
        </Label>
        <select
          value={formData.booking_for}
          onChange={(e) => handleInputChange('booking_for', e.target.value)}
          className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        >
          <option value="" className="bg-slate-900">-- Select Booking For / किसके लिए चुनें --</option>
          {bookingForOptions.map(option => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.icon} {option.label}
            </option>
          ))}
        </select>
        {formData.booking_for && (
          <p className="mt-2 text-blue-400 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            Selected: {bookingForOptions.find(o => o.value === formData.booking_for)?.label}
          </p>
        )}
      </div>

      {/* Booking Purpose - Dropdown */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <Label className="text-white text-lg mb-3 block flex items-center gap-2">
          <Target className="h-5 w-5 text-green-400" />
          बुकिंग का उद्देश्य / Booking Purpose <span className="text-red-500">*</span>
        </Label>
        <select
          value={formData.booking_purpose}
          onChange={(e) => handleInputChange('booking_purpose', e.target.value)}
          className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        >
          <option value="" className="bg-slate-900">-- Select Purpose / उद्देश्य चुनें --</option>
          {bookingPurposeOptions.map(option => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.icon} {option.label}
            </option>
          ))}
        </select>
        {formData.booking_purpose && (
          <p className="mt-2 text-green-400 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            Selected: {bookingPurposeOptions.find(o => o.value === formData.booking_purpose)?.label}
          </p>
        )}
        
        {formData.booking_purpose === 'other' && (
          <Input
            placeholder="Specify purpose / उद्देश्य बताएं"
            value={formData.booking_purpose_other}
            onChange={(e) => handleInputChange('booking_purpose_other', e.target.value)}
            className="mt-4 bg-slate-800 border-slate-600 text-white"
          />
        )}
      </div>
    </div>
  );

  // Render Step 3: Route Details
  const renderRouteStep = () => (
    <div className="space-y-6">
      {/* Pickup Location */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Navigation className="h-5 w-5 text-green-400" />
          Pickup Location / पिकअप स्थान <span className="text-red-500">*</span>
        </h3>
        <PinCodeInput
          label="Pickup PIN Code"
          value={formData.pickup_pincode}
          onChange={(value) => handleInputChange('pickup_pincode', value)}
          onLocationSelect={(data) => handleLocationSelect('pickup', data)}
        />
        {formData.pickup_location && (
          <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <p className="text-green-400 font-medium">{formData.pickup_location}</p>
            <p className="text-slate-400 text-sm">{formData.pickup_district}, {formData.pickup_state}</p>
          </div>
        )}
      </div>

      {/* Drop Location */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-400" />
          Drop Location / ड्रॉप स्थान <span className="text-red-500">*</span>
        </h3>
        <PinCodeInput
          label="Drop PIN Code"
          value={formData.drop_pincode}
          onChange={(value) => handleInputChange('drop_pincode', value)}
          onLocationSelect={(data) => handleLocationSelect('drop', data)}
        />
        {formData.drop_location && (
          <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
            <p className="text-red-400 font-medium">{formData.drop_location}</p>
            <p className="text-slate-400 text-sm">{formData.drop_district}, {formData.drop_state}</p>
          </div>
        )}
      </div>

      {/* Distance Display */}
      {distanceKm > 0 && (
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30 text-center">
          <p className="text-blue-400 text-sm">Estimated Distance / अनुमानित दूरी</p>
          <p className="text-white text-3xl font-bold">{distanceKm} KM</p>
        </div>
      )}

      {/* Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="text-white mb-2 block">
            <Calendar className="h-4 w-4 inline mr-2" />
            Departure Date / प्रस्थान तारीख <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            value={formData.departure_date}
            onChange={(e) => handleInputChange('departure_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
        
        <div>
          <Label className="text-white mb-2 block">
            <Clock className="h-4 w-4 inline mr-2" />
            Pickup Time / पिकअप समय <span className="text-red-500">*</span>
          </Label>
          <Input
            type="time"
            value={formData.pickup_time}
            onChange={(e) => handleInputChange('pickup_time', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>
    </div>
  );

  // Render Step 4: Price & Inquiry
  const renderPriceStep = () => (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-orange-400" />
          Booking Summary / बुकिंग सारांश
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-slate-400">Aircraft Type:</div>
          <div className="text-white">{formData.aircraft_type === 'helicopter' ? '🚁 Helicopter' : '✈️ Chartered Plane'}</div>
          
          <div className="text-slate-400">Total Passengers:</div>
          <div className="text-white">{formData.total_passengers} Adults + {formData.children_count} Children</div>
          
          <div className="text-slate-400">Flight Type:</div>
          <div className="text-white">{udanPrakarOptions.find(o => o.value === formData.udan_prakar)?.label || '-'}</div>
          
          <div className="text-slate-400">Route:</div>
          <div className="text-white">{formData.pickup_location} → {formData.drop_location}</div>
          
          <div className="text-slate-400">Distance:</div>
          <div className="text-orange-400 font-bold">{distanceKm} KM</div>
          
          <div className="text-slate-400">Date & Time:</div>
          <div className="text-white">{formData.departure_date} at {formData.pickup_time}</div>
        </div>
      </div>

      {/* Price Breakdown */}
      {priceEstimate && (
        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-6 border border-orange-500/30">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-orange-400" />
            Approximate Price / अनुमानित मूल्य
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-slate-300">
              <span>Base Price / आधार मूल्य:</span>
              <span>₹{priceEstimate.base_price?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Distance Charge ({distanceKm} KM):</span>
              <span>₹{priceEstimate.km_price?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Subtotal:</span>
              <span>₹{priceEstimate.subtotal?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>GST (18%):</span>
              <span>₹{priceEstimate.gst?.toLocaleString()}</span>
            </div>
            
            <div className="border-t border-orange-500/30 pt-3 mt-3">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-white">Estimated Total:</span>
                <span className="text-orange-400">₹{priceEstimate.total?.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <p className="text-amber-400 text-sm mt-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {priceEstimate.note}
          </p>
        </div>
      )}

      {/* Special Requirements */}
      <div>
        <Label className="text-white mb-2 block">
          Special Requirements / विशेष आवश्यकताएं (Optional)
        </Label>
        <textarea
          value={formData.special_requirements}
          onChange={(e) => handleInputChange('special_requirements', e.target.value)}
          placeholder="Any special requests or requirements..."
          className="w-full h-24 bg-slate-800 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500"
        />
      </div>

      {/* Submit Inquiry */}
      <Button
        onClick={handleSubmitInquiry}
        disabled={submitting || !priceEstimate}
        className="w-full py-6 text-lg bg-orange-500 hover:bg-orange-600"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-5 w-5 mr-2" />
            Generate Inquiry / इंक्वायरी भेजें
          </>
        )}
      </Button>

      <p className="text-center text-slate-400 text-sm">
        After inquiry, operators will review and send you their quotes.
        <br />
        इंक्वायरी के बाद, ऑपरेटर्स आपको कोट भेजेंगे।
      </p>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderPassengersStep();
      case 1: return renderBookingTypeStep();
      case 2: return renderRouteStep();
      case 3: return renderPriceStep();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            ✈️ Book Your Flight / उड़ान बुक करें
          </h1>
          <p className="text-slate-400">
            AirYatra - Premium Air Mobility Services
          </p>
        </div>

        {/* Customer Profile */}
        <CustomerProfileCard user={user} />

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={steps} />

        {/* Form Content */}
        <div className="bg-slate-900/50 rounded-2xl p-6 md:p-8 border border-slate-800">
          {renderCurrentStep()}

          {/* Navigation Buttons */}
          {currentStep < 3 && (
            <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
              <Button
                onClick={prevStep}
                disabled={currentStep === 0}
                variant="outline"
                className="border-slate-600 text-slate-300"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous / पिछला
              </Button>
              
              <Button
                onClick={nextStep}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Next / अगला
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex justify-start mt-8 pt-6 border-t border-slate-700">
              <Button
                onClick={prevStep}
                variant="outline"
                className="border-slate-600 text-slate-300"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous / पिछला
              </Button>
            </div>
          )}
        </div>

        {/* Login Prompt */}
        {!user && (
          <div className="mt-6 p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-center">
            <p className="text-amber-400">
              ⚠️ Please login to submit booking inquiry / बुकिंग के लिए लॉगिन करें
            </p>
            <Button
              onClick={() => navigate('/login')}
              className="mt-3 bg-amber-500 hover:bg-amber-600"
            >
              Login / लॉगिन करें
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingPage;
