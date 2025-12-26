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
import { bookingAPI, settingsAPI, landingAPI, pricingEngineAPI } from '../services/api';
import { toast } from 'sonner';
import PinCodeInput from '../components/shared/PinCodeInput';
import LandingPointSelector from '../components/shared/LandingPointSelector';
// Import modular booking components and config
import { 
  BookingStepIndicator,
  aircraftTypes,
  udanPrakarOptions,
  bookingForOptions,
  bookingPurposeOptions,
  bookingSteps,
  udanPrakarMultipliers,
  defaultPricingSettings,
  villageLandingDocuments,
  getOptionLabel,
  calculateDistance,
} from '../components/booking';

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
  
  // Storage key for preserving form data
  const BOOKING_FORM_KEY = 'airyatra_booking_form';
  
  // Load saved form data from localStorage
  const getSavedFormData = () => {
    try {
      const saved = localStorage.getItem(BOOKING_FORM_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading saved form:', e);
    }
    return null;
  };
  
  // Default form state
  const defaultFormData = {
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
    waiting_time: 0, // Waiting/Ground holding time in minutes
    night_halts: 0,  // Number of night halts
    
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
  };
  
  // Form state - initialize from localStorage if available
  const [formData, setFormData] = useState(() => {
    const saved = getSavedFormData();
    return saved ? { ...defaultFormData, ...saved.formData } : defaultFormData;
  });
  
  // Restore step if saved
  const [savedStep] = useState(() => {
    const saved = getSavedFormData();
    return saved?.currentStep || 0;
  });

  // Pricing state
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [pricingSettings, setPricingSettings] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [landingRent, setLandingRent] = useState({ pickup: null, drop: null, total: 0 });
  const [permissionRequired, setPermissionRequired] = useState(false);

  // Use imported steps from config
  const steps = bookingSteps;

  // Restore saved step after login
  useEffect(() => {
    if (user && savedStep > 0) {
      setCurrentStep(savedStep);
      toast.success('📋 Form data restored! / फॉर्म डाटा बहाल किया गया!');
    }
  }, [user, savedStep]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (formData.aircraft_type || formData.pickup_landing_point || formData.departure_date) {
      localStorage.setItem(BOOKING_FORM_KEY, JSON.stringify({
        formData,
        currentStep,
        savedAt: new Date().toISOString()
      }));
    }
  }, [formData, currentStep]);

  useEffect(() => {
    loadPricingSettings();
  }, []);

  useEffect(() => {
    // Calculate total passengers
    const total = parseInt(formData.adults_male || 0) + parseInt(formData.adults_female || 0);
    setFormData(prev => ({ ...prev, total_passengers: total }));
  }, [formData.adults_male, formData.adults_female]);

  useEffect(() => {
    // Calculate distance when both landing points are set
    const pickup = formData.pickup_landing_point;
    const drop = formData.drop_landing_point;
    
    console.log('Distance useEffect triggered:', {
      pickup_lat: pickup?.latitude,
      pickup_lng: pickup?.longitude,
      drop_lat: drop?.latitude,
      drop_lng: drop?.longitude
    });
    
    if (pickup?.latitude && drop?.latitude && 
        pickup?.longitude && drop?.longitude) {
      const dist = calculateDistance(
        pickup.latitude, pickup.longitude,
        drop.latitude, drop.longitude
      );
      console.log('Calculated distance:', dist);
      setDistanceKm(Math.round(dist));
    }
    
    // Check if permission is required for any landing point
    const needsPermission = pickup?.permission_required || drop?.permission_required;
    setPermissionRequired(needsPermission);
    
    // Calculate landing rent
    calculateLandingRent(pickup, drop);
  }, [formData.pickup_landing_point, formData.drop_landing_point, formData.departure_date]);

  useEffect(() => {
    // Calculate price when we have all required data
    if (currentStep === 3 && formData.udan_prakar && distanceKm > 0) {
      calculatePrice(); // async function - handles its own promise
    }
  }, [currentStep, formData.udan_prakar, distanceKm, pricingSettings, formData.booking_purpose, formData.night_halts, formData.waiting_time]);

  const loadPricingSettings = async () => {
    try {
      const response = await settingsAPI.getPublicPricing();
      setPricingSettings(response.data);
    } catch (err) {
      console.error('Failed to load pricing settings');
      // Use default pricing from config
      setPricingSettings(defaultPricingSettings);
    }
  };

  // Calculate landing rent for pickup and drop locations
  const calculateLandingRent = async (pickup, drop) => {
    let pickupRent = null;
    let dropRent = null;
    let totalLandingRent = 0;

    // Calculate pickup landing rent
    if (pickup?.rent_applicable && pickup.landing_point_id && formData.departure_date) {
      try {
        const response = await landingAPI.calculateRent({
          landing_point_id: pickup.landing_point_id,
          landing_date: formData.departure_date,
          duration_hours: 2, // Default 2 hours
          aircraft_type: formData.aircraft_type || 'helicopter'
        });
        pickupRent = response.data;
        totalLandingRent += pickupRent.total_rent || 0;
      } catch (error) {
        console.error('Failed to calculate pickup rent:', error);
      }
    }

    // Calculate drop landing rent
    if (drop?.rent_applicable && drop.landing_point_id && formData.departure_date) {
      try {
        const response = await landingAPI.calculateRent({
          landing_point_id: drop.landing_point_id,
          landing_date: formData.departure_date,
          duration_hours: 2,
          aircraft_type: formData.aircraft_type || 'helicopter'
        });
        dropRent = response.data;
        totalLandingRent += dropRent.total_rent || 0;
      } catch (error) {
        console.error('Failed to calculate drop rent:', error);
      }
    }

    setLandingRent({ pickup: pickupRent, drop: dropRent, total: totalLandingRent });
  };

  // ===== NEW AVIATION-GRADE PRICING ENGINE =====
  const calculatePrice = async () => {
    if (!formData.pickup_location || !formData.drop_location) return;
    
    try {
      const response = await pricingEngineAPI.calculatePrice({
        pickup_city: formData.pickup_location,
        pickup_latitude: formData.pickup_lat || 19.076,
        pickup_longitude: formData.pickup_lng || 72.877,
        drop_city: formData.drop_location,
        drop_latitude: formData.drop_lat || 18.520,
        drop_longitude: formData.drop_lng || 73.856,
        distance_km: distanceKm || 100,
        departure_date: formData.departure_date || new Date().toISOString().split('T')[0],
        departure_time: formData.departure_time || '10:00',
        is_round_trip: formData.udan_prakar === 'round_trip',
        booking_purpose: formData.booking_purpose || 'personal',
        passenger_count: parseInt(formData.passenger_count) || 1,
        waiting_time_minutes: parseInt(formData.waiting_time) || 0,
        night_halts: parseInt(formData.night_halts) || 0,
        pickup_landing_point_id: selectedLandingPoints.pickup?.landing_point_id,
        drop_landing_point_id: selectedLandingPoints.drop?.landing_point_id
      });
      
      if (response.data?.success) {
        const data = response.data;
        const breakdown = data.price_breakdown;
        const customerView = data.customer_view;
        
        setPriceEstimate({
          // From new pricing engine
          base_flight_cost: breakdown.base_flight_cost,
          dead_leg_cost: breakdown.dead_leg_cost,
          mdg_adjustment: breakdown.mdg_adjustment,
          waiting_charges: breakdown.waiting_charges,
          night_halt_cost: breakdown.night_halt_cost,
          crew_charges: breakdown.crew_charges,
          fuel_surcharge: breakdown.fuel_surcharge,
          
          // Landing Charges
          pickup_landing_charge: breakdown.pickup_landing_rent,
          pickup_landing_name: breakdown.pickup_landing_name,
          drop_landing_charge: breakdown.drop_landing_rent,
          drop_landing_name: breakdown.drop_landing_name,
          total_landing_charges: breakdown.total_landing_rent,
          
          // Purpose & Discounts
          purpose: breakdown.purpose,
          purpose_multiplier: breakdown.purpose_multiplier,
          purpose_adjustment: breakdown.purpose_adjustment,
          round_trip_discount: breakdown.round_trip_discount,
          
          // Platform Fees
          operator_gross_cost: breakdown.operator_gross_cost,
          platform_commission: breakdown.platform_commission,
          platform_commission_percent: breakdown.platform_commission_percent,
          convenience_fee: breakdown.convenience_fee,
          convenience_fee_percent: breakdown.convenience_fee_percent,
          insurance: breakdown.insurance,
          insurance_percent: breakdown.insurance_percent,
          
          // Peak Surge
          peak_surge_applied: breakdown.peak_surge_applied,
          peak_surge_multiplier: breakdown.peak_surge_multiplier,
          peak_surge_amount: breakdown.peak_surge_amount,
          
          // GST Breakdown
          taxable_amount: breakdown.taxable_amount,
          gst_type: breakdown.gst_type,
          cgst: breakdown.cgst,
          cgst_percent: breakdown.cgst_percent,
          sgst: breakdown.sgst,
          sgst_percent: breakdown.sgst_percent,
          igst: breakdown.igst,
          igst_percent: breakdown.igst_percent,
          total_gst: breakdown.total_gst,
          
          // Final Amounts
          total: breakdown.final_customer_price,
          operator_payout: breakdown.operator_net_payout,
          platform_earnings: breakdown.platform_earnings,
          
          // Meta
          is_approximate: breakdown.is_estimate,
          calculated_at: breakdown.calculated_at,
          valid_until: breakdown.valid_until,
          calculation_id: data.calculation_id,
          notes: breakdown.notes || [],
          
          // For display - simplified customer view
          customer_view: customerView,
          
          // Legacy fields for compatibility
          distance_km: distanceKm,
          base_price: breakdown.base_flight_cost,
          permission_required: permissionRequired,
          note: permissionRequired 
            ? 'Village landing requires admin approval / गांव लैंडिंग के लिए एडमिन अनुमति जरूरी' 
            : 'Price calculated by Aviation-Grade Pricing Engine / एविएशन-ग्रेड प्राइसिंग इंजन द्वारा गणना'
        });
        
      } else {
        // Fallback to basic calculation if engine fails
        fallbackCalculatePrice();
      }
    } catch (error) {
      console.error('Pricing engine error:', error);
      fallbackCalculatePrice();
    }
  };
  
  // Fallback pricing (old method) if engine fails
  const fallbackCalculatePrice = () => {
    if (!pricingSettings) return;
    
    const settings = pricingSettings;
    let basePrice = settings.base_price || 50000;
    let kmPrice = (settings.rate_per_km || 500) * distanceKm;
    
    // Aircraft type multiplier
    const multiplier = formData.aircraft_type === 'chartered_plane' 
      ? (settings.plane_multiplier || 1.5) 
      : (settings.helicopter_multiplier || 1);
    
    // Udan Prakar based pricing - using imported multipliers from config
    const udanMultiplier = udanPrakarMultipliers[formData.udan_prakar] || 1;
    
    // Base subtotal before fees
    const baseSubtotal = (basePrice + kmPrice) * multiplier * udanMultiplier;
    
    // Platform Convenience Fee (5% of base)
    const convenienceFee = Math.round(baseSubtotal * (settings.convenience_fee_percent || 5) / 100);
    
    // Commission for operators (10% - deducted from operator share, shown to customer)
    const commission = Math.round(baseSubtotal * (settings.commission_percent || 10) / 100);
    
    // Insurance (2% of base or fixed amount)
    const insurance = Math.round(baseSubtotal * (settings.insurance_percent || 2) / 100);
    
    // Helipad Landing Charges
    const pickupLandingCharge = landingRent.pickup?.rent || 0;
    const dropLandingCharge = landingRent.drop?.rent || 0;
    const totalLandingCharges = pickupLandingCharge + dropLandingCharge;
    
    // Subtotal before GST
    const subtotalBeforeGST = baseSubtotal + convenienceFee + insurance + totalLandingCharges;
    
    // GST (18% on services)
    const gstRate = settings.gst_rate || 18;
    const gst = Math.round(subtotalBeforeGST * gstRate / 100);
    
    // CGST and SGST breakdown (9% each for intra-state)
    const cgst = Math.round(gst / 2);
    const sgst = Math.round(gst / 2);
    
    // Total Amount
    const total = subtotalBeforeGST + gst;
    
    setPriceEstimate({
      // Base Pricing
      base_price: Math.round(basePrice),
      km_price: Math.round(kmPrice),
      distance_km: distanceKm,
      aircraft_multiplier: multiplier,
      udan_multiplier: udanMultiplier,
      base_subtotal: Math.round(baseSubtotal),
      
      // Fees & Charges
      convenience_fee: convenienceFee,
      convenience_fee_percent: settings.convenience_fee_percent || 5,
      commission: commission,
      commission_percent: settings.commission_percent || 10,
      insurance: insurance,
      insurance_percent: settings.insurance_percent || 2,
      
      // Landing Charges
      pickup_landing_charge: pickupLandingCharge,
      drop_landing_charge: dropLandingCharge,
      total_landing_charges: totalLandingCharges,
      pickup_landing_rent: landingRent.pickup,
      drop_landing_rent: landingRent.drop,
      
      // GST Breakdown
      subtotal_before_gst: subtotalBeforeGST,
      gst_rate: gstRate,
      gst: gst,
      cgst: cgst,
      sgst: sgst,
      
      // Final Amount
      total: Math.round(total),
      
      // Meta
      is_approximate: true,
      permission_required: permissionRequired,
      note: permissionRequired 
        ? 'Village landing requires admin approval / गांव लैंडिंग के लिए एडमिन अनुमति जरूरी' 
        : 'Final price will be confirmed by operator / अंतिम मूल्य ऑपरेटर द्वारा पुष्टि होगी',
      calculated_at: new Date().toISOString()
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle landing point selection
  const handleLandingPointSelect = (type, landingData) => {
    console.log(`handleLandingPointSelect called for ${type}:`, landingData);
    
    if (!landingData) {
      // Clear selection
      setFormData(prev => ({
        ...prev,
        [`${type}_landing_point`]: null,
        [`${type}_location`]: '',
        [`${type}_state`]: '',
        [`${type}_district`]: '',
        [`${type}_latitude`]: null,
        [`${type}_longitude`]: null,
      }));
      return;
    }
    
    // Update form data with landing point details
    setFormData(prev => ({
      ...prev,
      [`${type}_landing_point`]: landingData,
      [`${type}_location`]: landingData.landing_point_name || '',
      [`${type}_state`]: landingData.state || '',
      [`${type}_district`]: landingData.district || '',
      [`${type}_latitude`]: landingData.latitude,
      [`${type}_longitude`]: landingData.longitude,
    }));
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
        if (!formData.pickup_landing_point) {
          toast.error('Please select pickup location / पिकअप स्थान चुनें');
          return false;
        }
        if (!formData.drop_landing_point) {
          toast.error('Please select drop location / ड्रॉप स्थान चुनें');
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
      // Save form data before redirecting to login
      localStorage.setItem(BOOKING_FORM_KEY, JSON.stringify({
        formData,
        currentStep,
        savedAt: new Date().toISOString()
      }));
      toast.info('🔐 Login karein, form data save ho gaya hai! / Please login, form data is saved!');
      navigate('/login', { state: { returnTo: '/booking' } });
      return;
    }
    
    setSubmitting(true);
    try {
      const pickup = formData.pickup_landing_point;
      const drop = formData.drop_landing_point;
      
      const inquiryData = {
        ...formData,
        customer_id: user.id,
        customer_name: user.full_name || user.email,
        customer_email: user.email,
        customer_phone: user.phone,
        
        // Landing point details
        pickup_landing_point_id: pickup?.landing_point_id,
        pickup_landing_point_name: pickup?.landing_point_name,
        pickup_landing_point_type: pickup?.landing_point_type,
        drop_landing_point_id: drop?.landing_point_id,
        drop_landing_point_name: drop?.landing_point_name,
        drop_landing_point_type: drop?.landing_point_type,
        
        // Location details
        pickup_location: pickup?.landing_point_name || formData.pickup_location,
        pickup_city: pickup?.city,
        pickup_state: pickup?.state || formData.pickup_state,
        pickup_latitude: pickup?.latitude,
        pickup_longitude: pickup?.longitude,
        drop_location: drop?.landing_point_name || formData.drop_location,
        drop_city: drop?.city,
        drop_state: drop?.state || formData.drop_state,
        drop_latitude: drop?.latitude,
        drop_longitude: drop?.longitude,
        
        distance_km: distanceKm,
        estimated_price: priceEstimate?.total || 0,
        price_breakdown: priceEstimate,
        landing_rent_breakdown: landingRent,
        
        // Permission workflow
        permission_required: permissionRequired,
        pickup_permission_required: pickup?.permission_required || false,
        drop_permission_required: drop?.permission_required || false,
        
        status: permissionRequired ? 'pending_permission' : 'pending_acceptance',
        created_at: new Date().toISOString(),
      };
      
      const response = await bookingAPI.createInquiry(inquiryData);
      
      // Clear saved form data after successful submission
      localStorage.removeItem(BOOKING_FORM_KEY);
      
      // If permission required, create village landing permission request
      if (permissionRequired) {
        try {
          const permissionLandingPoint = pickup?.permission_required ? pickup : drop;
          await landingAPI.createVillagePermission({
            inquiry_id: response.data.inquiry_id,
            landing_point_id: permissionLandingPoint.landing_point_id,
            landing_point_name: permissionLandingPoint.landing_point_name,
            city: permissionLandingPoint.city,
            district: permissionLandingPoint.district,
            state: permissionLandingPoint.state,
            landing_date: formData.departure_date,
            landing_time: formData.pickup_time,
            customer_id: user.id,
            customer_name: user.full_name,
            customer_email: user.email,
            customer_phone: user.phone,
          });
          
          toast.success('🎉 Inquiry submitted! Admin approval required for village landing.');
        } catch (permError) {
          console.error('Permission request failed:', permError);
        }
      } else {
        toast.success('🎉 Inquiry submitted! Operators will respond soon / इंक्वायरी जमा! ऑपरेटर जल्द जवाब देंगे');
      }
      
      // Navigate to inquiry status page
      navigate(`/customer/inquiry/${response.data.inquiry_id}`, { 
        state: { newInquiry: true, permissionRequired } 
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
      {/* Pickup Location - Landing Point Selector */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Navigation className="h-5 w-5 text-green-400" />
          Pickup Location / पिकअप स्थान
        </h3>
        <LandingPointSelector
          label="Select Pickup Point / पिकअप पॉइंट चुनें"
          type="pickup"
          selectedDate={formData.departure_date}
          aircraftType={formData.aircraft_type}
          onSelect={(data) => handleLandingPointSelect('pickup', data)}
          selectedPoint={formData.pickup_landing_point}
        />
      </div>

      {/* Drop Location - Landing Point Selector */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-red-400" />
          Drop Location / ड्रॉप स्थान
        </h3>
        <LandingPointSelector
          label="Select Drop Point / ड्रॉप पॉइंट चुनें"
          type="drop"
          selectedDate={formData.departure_date}
          aircraftType={formData.aircraft_type}
          onSelect={(data) => handleLandingPointSelect('drop', data)}
          selectedPoint={formData.drop_landing_point}
        />
      </div>

      {/* Distance Display */}
      {distanceKm > 0 && (
        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30 text-center">
          <p className="text-blue-400 text-sm">Estimated Distance / अनुमानित दूरी</p>
          <p className="text-white text-3xl font-bold">{distanceKm} KM</p>
        </div>
      )}

      {/* Permission Warning */}
      {permissionRequired && (
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
            <div>
              <h4 className="text-yellow-400 font-semibold">Village Landing - Documents Required</h4>
              <p className="text-yellow-400/70 text-sm mt-1">
                गांव/निजी जमीन पर लैंडिंग के लिए आपको Authority से निम्न Documents लेने होंगे:
              </p>
              <ul className="text-yellow-400/70 text-sm mt-2 list-disc list-inside space-y-1">
                <li>Collector NOC / कलेक्टर NOC</li>
                <li>Fire Department Acknowledgment / फायर विभाग की पावती</li>
                <li>Local Police Station Acknowledgment / स्थानीय थाना की पावती</li>
                <li>SP/DCP Acknowledgment / SP/DCP की पावती</li>
              </ul>
              <p className="text-yellow-400/80 text-xs mt-3 font-medium">
                ⚠️ Booking confirm hone ke baad, aapko ye documents upload karne honge. 
                Admin/Operator verify karenge, tab hi Pilot udan bharega.
              </p>
            </div>
          </div>
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
          
          <div className="text-slate-400">Pickup:</div>
          <div className="text-white">
            {formData.pickup_landing_point?.landing_point_name || formData.pickup_location}
            {formData.pickup_landing_point?.landing_point_type && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-slate-700 rounded">
                {formData.pickup_landing_point.landing_point_type.replace('_', ' ')}
              </span>
            )}
          </div>
          
          <div className="text-slate-400">Drop:</div>
          <div className="text-white">
            {formData.drop_landing_point?.landing_point_name || formData.drop_location}
            {formData.drop_landing_point?.landing_point_type && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-slate-700 rounded">
                {formData.drop_landing_point.landing_point_type.replace('_', ' ')}
              </span>
            )}
          </div>
          
          <div className="text-slate-400">Distance:</div>
          <div className="text-orange-400 font-bold">{distanceKm} KM</div>
          
          <div className="text-slate-400">Date & Time:</div>
          <div className="text-white">{formData.departure_date} at {formData.pickup_time}</div>
        </div>
      </div>

      {/* Permission Required Warning */}
      {permissionRequired && (
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
            <div>
              <h4 className="text-yellow-400 font-semibold">⚠️ Village Landing - Admin Approval Required</h4>
              <p className="text-yellow-400/70 text-sm mt-1">
                Your inquiry will be submitted for admin approval. Payment will be enabled after approval.
              </p>
              <p className="text-yellow-400/70 text-sm">
                आपकी इंक्वायरी एडमिन अप्रूवल के लिए भेजी जाएगी। अप्रूवल के बाद पेमेंट enabled होगी।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Price Breakdown */}
      {priceEstimate && (
        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-6 border border-orange-500/30">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-orange-400" />
            Price Breakdown / मूल्य विवरण
            {priceEstimate.calculation_id && (
              <span className="text-xs text-slate-500 ml-auto">ID: {priceEstimate.calculation_id}</span>
            )}
          </h3>
          
          <div className="space-y-2 text-sm">
            {/* Base Charges Section */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-orange-400 font-semibold mb-2 text-xs uppercase tracking-wide">Base Flight Cost / उड़ान लागत</p>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Flight Cost ({distanceKm} km):</span>
                  <span>₹{(priceEstimate.base_flight_cost || priceEstimate.base_price || 0).toLocaleString()}</span>
                </div>
                {priceEstimate.dead_leg_cost > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Positioning Cost / डेड-लेग:</span>
                    <span>₹{priceEstimate.dead_leg_cost?.toLocaleString()}</span>
                  </div>
                )}
                {priceEstimate.mdg_adjustment > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Min Guarantee (MDG) Adjustment:</span>
                    <span>₹{priceEstimate.mdg_adjustment?.toLocaleString()}</span>
                  </div>
                )}
                {priceEstimate.purpose_adjustment > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>{priceEstimate.purpose} Multiplier ({priceEstimate.purpose_multiplier}x):</span>
                    <span>+₹{priceEstimate.purpose_adjustment?.toLocaleString()}</span>
                  </div>
                )}
                {priceEstimate.round_trip_discount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Round Trip Discount:</span>
                    <span>-₹{priceEstimate.round_trip_discount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-200 font-medium pt-1 border-t border-slate-700">
                  <span>Operator Gross Cost:</span>
                  <span>₹{(priceEstimate.operator_gross_cost || priceEstimate.base_subtotal || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Additional Aviation Charges */}
            {(priceEstimate.waiting_charges > 0 || priceEstimate.night_halt_cost > 0 || priceEstimate.crew_charges > 0) && (
              <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                <p className="text-yellow-400 font-semibold mb-2 text-xs uppercase tracking-wide">Additional Charges / अतिरिक्त शुल्क</p>
                <div className="space-y-1">
                  {priceEstimate.waiting_charges > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Waiting / Ground Holding:</span>
                      <span>₹{priceEstimate.waiting_charges?.toLocaleString()}</span>
                    </div>
                  )}
                  {priceEstimate.night_halt_cost > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Night Halt ({priceEstimate.night_halts || formData.night_halts} nights):</span>
                      <span>₹{priceEstimate.night_halt_cost?.toLocaleString()}</span>
                    </div>
                  )}
                  {priceEstimate.crew_charges > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Crew Accommodation & Food:</span>
                      <span>₹{priceEstimate.crew_charges?.toLocaleString()}</span>
                    </div>
                  )}
                  {priceEstimate.fuel_surcharge > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Fuel Surcharge:</span>
                      <span>₹{priceEstimate.fuel_surcharge?.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Platform Fees & Charges */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-blue-400 font-semibold mb-2 text-xs uppercase tracking-wide">Platform Fees / प्लेटफॉर्म शुल्क</p>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Convenience Fee ({priceEstimate.convenience_fee_percent || 5}%):</span>
                  <span>₹{(priceEstimate.convenience_fee || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Insurance ({priceEstimate.insurance_percent || 2}%):</span>
                  <span>₹{(priceEstimate.insurance || 0).toLocaleString()}</span>
                </div>
                {priceEstimate.peak_surge_applied && (
                  <div className="flex justify-between text-red-400">
                    <span>Peak Season Surge ({priceEstimate.peak_surge_multiplier}x):</span>
                    <span>+₹{priceEstimate.peak_surge_amount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Platform Commission ({priceEstimate.platform_commission_percent || priceEstimate.commission_percent || 10}%):</span>
                  <span className="text-slate-500">Included</span>
                </div>
              </div>
            </div>

            {/* Helipad Landing Charges */}
            {priceEstimate.total_landing_charges > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                <p className="text-green-400 font-semibold mb-2 text-xs uppercase tracking-wide flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Helipad Landing Charges / हेलीपैड शुल्क
                </p>
                <div className="space-y-1">
                  {priceEstimate.pickup_landing_charge > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Pickup {priceEstimate.pickup_landing_name ? `- ${priceEstimate.pickup_landing_name}` : ''}:</span>
                      <span>₹{priceEstimate.pickup_landing_charge?.toLocaleString()}</span>
                    </div>
                  )}
                  {priceEstimate.drop_landing_charge > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Drop {priceEstimate.drop_landing_name ? `- ${priceEstimate.drop_landing_name}` : ''}:</span>
                      <span>₹{priceEstimate.drop_landing_charge?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-200 font-medium pt-1 border-t border-slate-700">
                    <span>Total Landing Charges:</span>
                    <span>₹{priceEstimate.total_landing_charges?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* GST Breakdown */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-purple-400 font-semibold mb-2 text-xs uppercase tracking-wide">
                GST / जीएसटी ({priceEstimate.gst_type === 'inter_state' ? 'IGST' : 'CGST+SGST'})
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Taxable Amount:</span>
                  <span>₹{(priceEstimate.taxable_amount || priceEstimate.subtotal_before_gst || 0).toLocaleString()}</span>
                </div>
                {priceEstimate.gst_type === 'inter_state' ? (
                  <div className="flex justify-between text-slate-300">
                    <span>IGST ({priceEstimate.igst_percent || 18}%):</span>
                    <span>₹{(priceEstimate.igst || 0).toLocaleString()}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-300">
                      <span>CGST ({priceEstimate.cgst_percent || 9}%):</span>
                      <span>₹{(priceEstimate.cgst || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>SGST ({priceEstimate.sgst_percent || 9}%):</span>
                      <span>₹{(priceEstimate.sgst || 0).toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-slate-200 font-medium pt-1 border-t border-slate-700">
                  <span>Total GST:</span>
                  <span>₹{(priceEstimate.total_gst || priceEstimate.gst || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-lg p-4 border border-orange-500/40">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-white font-bold text-lg">Grand Total</span>
                  <span className="text-slate-400 text-xs block">कुल राशि (Inclusive of all taxes)</span>
                </div>
                <span className="text-orange-400 font-bold text-2xl">₹{(priceEstimate.total || 0).toLocaleString()}</span>
              </div>
              {priceEstimate.operator_payout > 0 && (
                <div className="mt-2 pt-2 border-t border-orange-500/30 flex justify-between text-xs text-slate-400">
                  <span>Operator will receive:</span>
                  <span>₹{priceEstimate.operator_payout?.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {priceEstimate.notes && priceEstimate.notes.length > 0 && (
              <div className="text-xs text-amber-400 mt-2">
                {priceEstimate.notes.map((note, i) => (
                  <p key={i} className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {note}
                  </p>
                ))}
              </div>
            )}
          </div>
          
          <p className={`text-sm mt-4 flex items-center gap-2 ${permissionRequired ? 'text-yellow-400' : 'text-amber-400'}`}>
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
        className={`w-full py-6 text-lg ${permissionRequired ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-orange-500 hover:bg-orange-600'}`}
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-5 w-5 mr-2" />
            {permissionRequired ? 'Submit for Approval / अनुमति के लिए भेजें' : 'Generate Inquiry / इंक्वायरी भेजें'}
          </>
        )}
      </Button>

      <p className="text-center text-slate-400 text-sm">
        {permissionRequired ? (
          <>
            Your inquiry requires admin approval for village landing.
            <br />
            गांव लैंडिंग के लिए एडमिन अप्रूवल जरूरी है।
          </>
        ) : (
          <>
            After inquiry, operators will review and send you their quotes.
            <br />
            इंक्वायरी के बाद, ऑपरेटर्स आपको कोट भेजेंगे।
          </>
        )}
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

        {/* Step Indicator - Using modular component */}
        <BookingStepIndicator currentStep={currentStep} steps={steps} />

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
