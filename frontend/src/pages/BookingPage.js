import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight,
  UserCircle, Mail, Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookingAPI, settingsAPI, landingAPI, pricingEngineAPI, referralAPI } from '../services/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
// Import modular booking components and config
import { 
  BookingStepIndicator,
  AircraftCompareModal,
  EmergencyBookingForm,
  bookingSteps,
  defaultPricingSettings,
  calculateDistance,
  udanPrakarMultipliers,
  serviceTypeMultipliers,
} from '../components/booking';
// Wizard step components (split from monolithic BookingPage.js)
import Step1Passengers from '../components/booking/steps/Step1Passengers';
import Step2BookingType from '../components/booking/steps/Step2BookingType';
import Step3Route from '../components/booking/steps/Step3Route';
import Step4Price from '../components/booking/steps/Step4Price';

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
  const { t } = useTranslation();
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
    booking_type: 'one_way', // NEW: 9 booking types
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
  
  // Price Lock State (NEW)
  const [priceLock, setPriceLock] = useState({
    isLocked: false,
    lockId: null,
    expiresAt: null,
    lockedAmount: null
  });
  
  // Referral & Discount State
  const [referralCode, setReferralCode] = useState('');
  const [referralApplied, setReferralApplied] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(null);
  const [applyingCode, setApplyingCode] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  
  // Aircraft Comparison State (NEW)
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [availableAircraft, setAvailableAircraft] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  
  // Emergency Booking State (NEW)
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  
  // Multi-City Routes State (NEW)
  const [multiCityRoutes, setMultiCityRoutes] = useState({ legs: [], totalDistance: 0, totalPrice: 0 });
  
  // Mandatory Legal Consents State (5 required checkboxes)
  const [consents, setConsents] = useState({
    terms_conditions: false,      // T&C, Privacy, Cancellation Policy
    flight_conditions: false,     // Weather, DGCA, Safety
    platform_role: false,         // AirYatra is marketplace
    passenger_info: false,        // Info accuracy confirmation
    electronic_consent: false,    // E-signature & OTP consent
  });
  
  // Check if all mandatory consents are accepted
  const allConsentsAccepted = Object.values(consents).every(v => v === true);
  
  // Toggle consent checkbox
  const toggleConsent = (key) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Use imported steps from config (titles localized)
  const steps = bookingSteps.map(s => ({ ...s, title: t(`booking.steps.${s.id}`) }));

  // Restore saved step after login
  useEffect(() => {
    if (user && savedStep > 0) {
      setCurrentStep(savedStep);
      toast.success(`📋 ${t('bookingForm.formRestored')}`);
    }
  }, [user, savedStep, t]);

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
    // Load wallet balance if logged in
    if (user) {
      loadWalletBalance();
      // Check URL for referral code
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
        setReferralCode(refCode);
      }
    }
  }, [user]);
  
  // Load available aircraft for comparison (NEW)
  const loadAvailableAircraft = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const res = await fetch(`${API_URL}/api/aircraft/public/featured?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setAvailableAircraft(data.aircraft || []);
      }
    } catch (e) {
      console.log('Could not load aircraft for comparison');
    }
  };
  
  // Load aircraft when booking type step is reached
  useEffect(() => {
    if (currentStep >= 1) {
      loadAvailableAircraft();
    }
  }, [currentStep]);
  
  const loadWalletBalance = async () => {
    try {
      const res = await referralAPI.getWallet();
      const balance = res.data.balance || 0;
      setWalletBalance(balance);
      // Auto-apply wallet if balance exists (Smart Wallet feature)
      if (balance > 0) {
        setUseWallet(true);
      }
    } catch (e) {
      console.log('Wallet not available');
    }
  };

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
        pickup_landing_point_id: formData.pickup_landing_point?.landing_point_id,
        drop_landing_point_id: formData.drop_landing_point?.landing_point_id
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
            ? t('bookingForm.noteVillageApproval') 
            : t('bookingForm.notePriceEngine')
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
      : formData.aircraft_type === 'helicopter'
        ? (settings.helicopter_multiplier || 1)
        : (serviceTypeMultipliers[formData.aircraft_type] || 1);
    
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
        ? t('bookingForm.noteVillageApproval') 
        : t('bookingForm.noteFinalPrice'),
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
          toast.error(t('bookingForm.selectAircraftError'));
          return false;
        }
        if (formData.total_passengers < 1) {
          toast.error(t('bookingForm.minAdultError'));
          return false;
        }
        if (formData.children_count > 2) {
          toast.error(t('bookingForm.maxChildrenError'));
          return false;
        }
        return true;
        
      case 1: // Booking Type
        if (!formData.udan_prakar) {
          toast.error(t('bookingForm.selectFlightTypeError'));
          return false;
        }
        if (!formData.booking_for) {
          toast.error(t('bookingForm.selectBookingForError'));
          return false;
        }
        if (!formData.booking_purpose) {
          toast.error(t('bookingForm.selectPurposeError'));
          return false;
        }
        return true;
        
      case 2: // Route
        if (!formData.pickup_landing_point) {
          toast.error(t('bookingForm.selectPickupError'));
          return false;
        }
        if (!formData.drop_landing_point) {
          toast.error(t('bookingForm.selectDropError'));
          return false;
        }
        if (!formData.departure_date) {
          toast.error(t('bookingForm.selectDateError'));
          return false;
        }
        if (!formData.pickup_time) {
          toast.error(t('bookingForm.selectTimeError'));
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

  // Apply Referral Code
  const applyReferral = async () => {
    if (!referralCode.trim()) {
      toast.error('Please enter a referral code');
      return;
    }
    
    setApplyingCode(true);
    try {
      const res = await referralAPI.applyReferralCode(referralCode.trim().toUpperCase());
      setReferralApplied({
        discount_percent: res.data.first_booking_discount,
        referrer_name: res.data.referrer_name,
        message: res.data.message
      });
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid referral code');
      setReferralApplied(null);
    } finally {
      setApplyingCode(false);
    }
  };
  
  // Apply Discount Code
  const applyDiscount = async () => {
    if (!discountCode.trim()) {
      toast.error('Please enter a discount code');
      return;
    }
    
    if (!priceEstimate?.total) {
      toast.error('Wait for price calculation');
      return;
    }
    
    setApplyingCode(true);
    try {
      const res = await referralAPI.validateDiscount({
        code: discountCode.trim().toUpperCase(),
        booking_amount: priceEstimate.total
      });
      setDiscountApplied({
        code: res.data.code,
        discount_type: res.data.discount_type,
        discount_value: res.data.discount_value,
        discount_amount: res.data.discount_amount,
        message: res.data.message
      });
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid discount code');
      setDiscountApplied(null);
    } finally {
      setApplyingCode(false);
    }
  };
  
  // Calculate final price with discounts
  const getFinalPrice = () => {
    let total = priceEstimate?.total || 0;
    let discounts = [];
    
    // Apply referral discount (first booking 10%)
    if (referralApplied) {
      const referralDiscount = Math.round(total * (referralApplied.discount_percent / 100));
      discounts.push({ type: 'Referral Discount', amount: referralDiscount });
      total -= referralDiscount;
    }
    
    // Apply discount code
    if (discountApplied) {
      discounts.push({ type: 'Promo Code', amount: discountApplied.discount_amount });
      total -= discountApplied.discount_amount;
    }
    
    // Apply wallet balance
    if (useWallet && walletBalance > 0) {
      const walletUse = Math.min(walletBalance, total);
      discounts.push({ type: 'Wallet Balance', amount: walletUse });
      total -= walletUse;
    }
    
    return { total: Math.max(0, total), discounts };
  };

  const handleMarketplaceSearch = () => {
    if (!allConsentsAccepted) {
      toast.error('Please accept all consents first');
      return;
    }
    const pickup = formData.pickup_landing_point;
    const drop = formData.drop_landing_point;
    const payload = {
      aircraft_type: formData.aircraft_type,
      from_location: pickup?.city || pickup?.landing_point_name || formData.pickup_location,
      to_location: drop?.city || drop?.landing_point_name || formData.drop_location,
      pickup_latitude: pickup?.latitude,
      pickup_longitude: pickup?.longitude,
      drop_latitude: drop?.latitude,
      drop_longitude: drop?.longitude,
      travel_date: formData.departure_date,
      travel_time: formData.pickup_time || '09:00',
      passengers: (parseInt(formData.adults_male) || 0) + (parseInt(formData.adults_female) || 0) + (parseInt(formData.children_count) || 0) || 1,
      booking_type: formData.booking_type || 'one_way',
      consents_accepted: {
        ...consents,
        accepted_at: new Date().toISOString(),
        version: 'v1.0',
      },
    };
    sessionStorage.setItem('marketplace_search', JSON.stringify(payload));
    navigate('/marketplace/results');
  };

  const handleSubmitInquiry = async () => {
    if (!user) {
      // Save form data before redirecting to login
      localStorage.setItem(BOOKING_FORM_KEY, JSON.stringify({
        formData,
        currentStep,
        savedAt: new Date().toISOString()
      }));
      toast.info('🔐 Please login — your form data is saved!');
      navigate('/login', { state: { returnTo: '/booking' } });
      return;
    }
    
    // STRICT RULE: No booking without resolved price
    if (!priceEstimate || !priceEstimate.total || priceEstimate.total <= 0) {
      toast.error(`⚠️ ${t('bookingForm.priceWaitError')}`);
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
        pricing_calculation_id: priceEstimate?.calculation_id, // Audit trail
        landing_rent_breakdown: landingRent,
        
        // Referral & Discount data
        referral_code_used: referralApplied ? referralCode.toUpperCase() : null,
        referral_discount: referralApplied ? {
          percent: referralApplied.discount_percent,
          amount: Math.round((priceEstimate?.total || 0) * (referralApplied.discount_percent / 100))
        } : null,
        discount_code_used: discountApplied ? discountApplied.code : null,
        discount_applied: discountApplied ? {
          type: discountApplied.discount_type,
          value: discountApplied.discount_value,
          amount: discountApplied.discount_amount
        } : null,
        wallet_used: useWallet ? Math.min(walletBalance, getFinalPrice().total + (useWallet && walletBalance > 0 ? Math.min(walletBalance, priceEstimate?.total || 0) : 0)) : 0,
        final_price: getFinalPrice().total,
        
        // Legal Consents Data (Mandatory)
        consents_accepted: {
          terms_conditions: consents.terms_conditions,
          flight_conditions: consents.flight_conditions,
          platform_role: consents.platform_role,
          passenger_info: consents.passenger_info,
          electronic_consent: consents.electronic_consent,
          accepted_at: new Date().toISOString(),
          version: 'v1.0'
        },
        
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
        toast.success(`🎉 ${t('bookingForm.inquirySubmitted')}`);
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

  // Render current wizard step (delegated to modular step components)
  const stepProps = {
    formData,
    handleInputChange,
    t,
    priceEstimate,
    selectedAircraft,
    setSelectedAircraft,
    setShowEmergencyForm,
    setShowCompareModal,
    handleLandingPointSelect,
    multiCityRoutes,
    setMultiCityRoutes,
    setDistanceKm,
    distanceKm,
    permissionRequired,
    pricingSettings,
    priceLock,
    setPriceLock,
    referralCode,
    setReferralCode,
    referralApplied,
    applyReferral,
    discountCode,
    setDiscountCode,
    discountApplied,
    applyDiscount,
    applyingCode,
    walletBalance,
    useWallet,
    setUseWallet,
    getFinalPrice,
    consents,
    toggleConsent,
    allConsentsAccepted,
    handleMarketplaceSearch,
    handleSubmitInquiry,
    submitting,
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return <Step1Passengers {...stepProps} />;
      case 1: return <Step2BookingType {...stepProps} />;
      case 2: return <Step3Route {...stepProps} />;
      case 3: return <Step4Price {...stepProps} />;
      default: return null;
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            ✈️ {t('booking.title')}
          </h1>
          <p className="text-slate-400">
            {t('booking.subtitle')}
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
                {t('booking.previous')}
              </Button>
              
              <Button
                onClick={nextStep}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {t('booking.next')}
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
                {t('booking.previous')}
              </Button>
            </div>
          )}
        </div>

        {/* Login Prompt */}
        {!user && (
          <div className="mt-6 p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-center">
            <p className="text-amber-400">
              ⚠️ {t('booking.loginPrompt')}
            </p>
            <Button
              onClick={() => navigate('/login')}
              className="mt-3 bg-amber-500 hover:bg-amber-600"
            >
              {t('booking.loginBtn')}
            </Button>
          </div>
        )}
      </div>
      
      {/* Aircraft Comparison Modal (NEW) */}
      <AircraftCompareModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        availableAircraft={availableAircraft}
        onSelectAircraft={(aircraft) => {
          setSelectedAircraft(aircraft);
          handleInputChange('selected_aircraft_id', aircraft.id);
          handleInputChange('selected_aircraft_model', aircraft.basic_info?.model || aircraft.model);
        }}
        selectedAircraftId={selectedAircraft?.id}
        distanceKm={distanceKm}
        passengerCount={formData.total_passengers}
      />
      
      {/* Emergency Booking Modal (NEW) */}
      {showEmergencyForm && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) {
              setShowEmergencyForm(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowEmergencyForm(false);
            }
          }}
          tabIndex={0}
        >
          <div className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <EmergencyBookingForm
              user={user}
              onSuccess={(data) => {
                setShowEmergencyForm(false);
                navigate(`/customer/emergency/${data.emergency_booking_id}`);
              }}
              onCancel={() => setShowEmergencyForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default BookingPage;
