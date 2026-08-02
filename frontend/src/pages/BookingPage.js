import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plane, Calendar, Users, Clock, CreditCard, Shield, User, Phone, 
  MapPin, ChevronLeft, ChevronRight, Check, AlertCircle, 
  Briefcase, Target, Navigation, Calculator, Send, Loader2,
  UserCircle, Mail, Weight, Luggage, Baby, UserPlus, Building2, TreePine, DollarSign, Gift, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { bookingAPI, settingsAPI, landingAPI, pricingEngineAPI, referralAPI } from '../services/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
  
  // Referral & Discount State
  const [referralCode, setReferralCode] = useState('');
  const [referralApplied, setReferralApplied] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(null);
  const [applyingCode, setApplyingCode] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

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
      toast.error('Please enter a referral code / कृपया रेफरल कोड डालें');
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
      toast.error(error.response?.data?.detail || 'Invalid referral code / अमान्य रेफरल कोड');
      setReferralApplied(null);
    } finally {
      setApplyingCode(false);
    }
  };
  
  // Apply Discount Code
  const applyDiscount = async () => {
    if (!discountCode.trim()) {
      toast.error('Please enter a discount code / कृपया डिस्काउंट कोड डालें');
      return;
    }
    
    if (!priceEstimate?.total) {
      toast.error('Wait for price calculation / कृपया कीमत गणना का इंतजार करें');
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
      toast.error(error.response?.data?.detail || 'Invalid discount code / अमान्य डिस्काउंट कोड');
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

  // Render Step 1: Passengers & Aircraft Selection
  const renderPassengersStep = () => (
    <div className="space-y-6">
      {/* Aircraft Type Selection */}
      <div>
        <Label className="text-white text-lg mb-4 block">
          {t('bookingForm.selectAircraftType')} <span className="text-red-500">*</span>
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
              <span className="text-white font-semibold block">{t(`options.${type.value}`)}</span>
              <span className="text-slate-400 text-sm">{t('bookingForm.maxPassengers', { count: type.maxPassengers })}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Adult Passengers */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-400" />
          {t('bookingForm.adultPassengers')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Male Adults */}
          <div>
            <Label className="text-slate-300 mb-2 block">{t('bookingForm.male')}</Label>
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
            <Label className="text-slate-300 mb-2 block">{t('bookingForm.female')}</Label>
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
            {t('bookingForm.totalAdults')}: <span className="text-orange-400 font-bold text-xl">{formData.total_passengers}</span>
          </p>
        </div>
      </div>

      {/* Children */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Baby className="h-5 w-5 text-blue-400" />
          {t('bookingForm.children')}
        </h3>
        <p className="text-green-400 text-sm mb-4">✨ {t('bookingForm.childrenFree')}</p>
        
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
          {t('bookingForm.flightType')} <span className="text-red-500">*</span>
        </Label>
        <select
          value={formData.udan_prakar}
          onChange={(e) => handleInputChange('udan_prakar', e.target.value)}
          className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        >
          <option value="" className="bg-slate-900">{t('bookingForm.selectOption')}</option>
          {udanPrakarOptions.map(option => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.icon} {t(`options.${option.value}`)}
            </option>
          ))}
        </select>
        {formData.udan_prakar && (
          <p className="mt-2 text-orange-400 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t('bookingForm.selected')}: {t(`options.${formData.udan_prakar}`)}
          </p>
        )}
      </div>

      {/* Booking For - Dropdown */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <Label className="text-white text-lg mb-3 block flex items-center gap-2">
          <User className="h-5 w-5 text-blue-400" />
          {t('bookingForm.bookingFor')} <span className="text-red-500">*</span>
        </Label>
        <select
          value={formData.booking_for}
          onChange={(e) => handleInputChange('booking_for', e.target.value)}
          className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        >
          <option value="" className="bg-slate-900">{t('bookingForm.selectOption')}</option>
          {bookingForOptions.map(option => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.icon} {t(`options.${option.value}`)}
            </option>
          ))}
        </select>
        {formData.booking_for && (
          <p className="mt-2 text-blue-400 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t('bookingForm.selected')}: {t(`options.${formData.booking_for}`)}
          </p>
        )}
      </div>

      {/* Booking Purpose - Dropdown */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <Label className="text-white text-lg mb-3 block flex items-center gap-2">
          <Target className="h-5 w-5 text-green-400" />
          {t('bookingForm.bookingPurpose')} <span className="text-red-500">*</span>
        </Label>
        <select
          value={formData.booking_purpose}
          onChange={(e) => handleInputChange('booking_purpose', e.target.value)}
          className="w-full p-4 bg-slate-900 border border-slate-600 rounded-xl text-white text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
        >
          <option value="" className="bg-slate-900">{t('bookingForm.selectOption')}</option>
          {bookingPurposeOptions.map(option => (
            <option key={option.value} value={option.value} className="bg-slate-900">
              {option.icon} {t(`options.${option.value}`)}
            </option>
          ))}
        </select>
        {formData.booking_purpose && (
          <p className="mt-2 text-green-400 text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            {t('bookingForm.selected')}: {t(`options.${formData.booking_purpose}`)}
          </p>
        )}
        
        {formData.booking_purpose === 'other' && (
          <Input
            placeholder={t('bookingForm.specifyPurpose')}
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
          {t('bookingForm.pickupLocation')}
        </h3>
        <LandingPointSelector
          label={t('bookingForm.selectPickupPoint')}
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
          {t('bookingForm.dropLocation')}
        </h3>
        <LandingPointSelector
          label={t('bookingForm.selectDropPoint')}
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
          <p className="text-blue-400 text-sm">{t('bookingForm.estimatedDistance')}</p>
          <p className="text-white text-3xl font-bold">{distanceKm} KM</p>
        </div>
      )}

      {/* Permission Warning */}
      {permissionRequired && (
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
            <div>
              <h4 className="text-yellow-400 font-semibold">{t('bookingForm.villageDocsTitle')}</h4>
              <p className="text-yellow-400/70 text-sm mt-1">
                {t('bookingForm.villageDocsDesc')}
              </p>
              <ul className="text-yellow-400/70 text-sm mt-2 list-disc list-inside space-y-1">
                <li>{t('bookingForm.docCollectorNoc')}</li>
                <li>{t('bookingForm.docFireDept')}</li>
                <li>{t('bookingForm.docPoliceStation')}</li>
                <li>{t('bookingForm.docSpDcp')}</li>
              </ul>
              <p className="text-yellow-400/80 text-xs mt-3 font-medium">
                ⚠️ {t('bookingForm.villageDocsNote')}
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
            {t('bookingForm.departureDate')} <span className="text-red-500">*</span>
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
            {t('bookingForm.pickupTime')} <span className="text-red-500">*</span>
          </Label>
          <Input
            type="time"
            value={formData.pickup_time}
            onChange={(e) => handleInputChange('pickup_time', e.target.value)}
            className="bg-slate-800 border-slate-600 text-white"
          />
        </div>
      </div>

      {/* Additional Aviation Options */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
        <p className="text-slate-400 text-sm mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-400" />
          {t('bookingForm.additionalOptions')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300 mb-2 block text-sm">
              {t('bookingForm.waitingTime')}
            </Label>
            <Input
              type="number"
              min="0"
              step="30"
              value={formData.waiting_time || 0}
              onChange={(e) => handleInputChange('waiting_time', parseInt(e.target.value) || 0)}
              placeholder="0"
              className="bg-slate-800 border-slate-600 text-white"
            />
            <p className="text-xs text-slate-500 mt-1">{t('bookingForm.waitingTimeNote')}</p>
          </div>
          
          <div>
            <Label className="text-slate-300 mb-2 block text-sm">
              {t('bookingForm.nightHalts')}
            </Label>
            <Input
              type="number"
              min="0"
              max="30"
              value={formData.night_halts || 0}
              onChange={(e) => handleInputChange('night_halts', parseInt(e.target.value) || 0)}
              placeholder="0"
              className="bg-slate-800 border-slate-600 text-white"
            />
            <p className="text-xs text-slate-500 mt-1">{t('bookingForm.nightHaltsNote')}</p>
          </div>
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
          {t('bookingForm.bookingSummary')}
        </h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-slate-400">{t('bookingForm.aircraftTypeLabel')}</div>
          <div className="text-white">{formData.aircraft_type === 'helicopter' ? '🚁' : '✈️'} {t(`options.${formData.aircraft_type || 'helicopter'}`)}</div>
          
          <div className="text-slate-400">{t('bookingForm.totalPassengersLabel')}</div>
          <div className="text-white">{formData.total_passengers} {t('bookingForm.adults')} + {formData.children_count} {t('bookingForm.childrenLabel')}</div>
          
          <div className="text-slate-400">{t('bookingForm.flightTypeLabel')}</div>
          <div className="text-white">{formData.udan_prakar ? t(`options.${formData.udan_prakar}`) : '-'}</div>
          
          <div className="text-slate-400">{t('bookingForm.pickupLabel')}</div>
          <div className="text-white">
            {formData.pickup_landing_point?.landing_point_name || formData.pickup_location}
            {formData.pickup_landing_point?.landing_point_type && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-slate-700 rounded">
                {formData.pickup_landing_point.landing_point_type.replace('_', ' ')}
              </span>
            )}
          </div>
          
          <div className="text-slate-400">{t('bookingForm.dropLabel')}</div>
          <div className="text-white">
            {formData.drop_landing_point?.landing_point_name || formData.drop_location}
            {formData.drop_landing_point?.landing_point_type && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-slate-700 rounded">
                {formData.drop_landing_point.landing_point_type.replace('_', ' ')}
              </span>
            )}
          </div>
          
          <div className="text-slate-400">{t('bookingForm.distanceLabel')}</div>
          <div className="text-orange-400 font-bold">{distanceKm} KM</div>
          
          <div className="text-slate-400">{t('bookingForm.dateTimeLabel')}</div>
          <div className="text-white">{formData.departure_date} {t('bookingForm.at')} {formData.pickup_time}</div>
        </div>
      </div>

      {/* Permission Required Warning */}
      {permissionRequired && (
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-400 shrink-0" />
            <div>
              <h4 className="text-yellow-400 font-semibold">⚠️ {t('bookingForm.villageApprovalTitle')}</h4>
              <p className="text-yellow-400/70 text-sm mt-1">
                {t('bookingForm.villageApprovalDesc')}
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
            {t('bookingForm.priceBreakdown')}
            {priceEstimate.calculation_id && (
              <span className="text-xs text-slate-500 ml-auto">ID: {priceEstimate.calculation_id}</span>
            )}
          </h3>
          
          <div className="space-y-2 text-sm">
            {/* Base Charges Section */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-orange-400 font-semibold mb-2 text-xs uppercase tracking-wide">{t('bookingForm.baseFlightCost')}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{t('bookingForm.flightCost')} ({distanceKm} km):</span>
                  <span>₹{(priceEstimate.base_flight_cost || priceEstimate.base_price || 0).toLocaleString()}</span>
                </div>
                {priceEstimate.dead_leg_cost > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>{t('bookingForm.positioningCost')}:</span>
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
                    <span>{t('bookingForm.roundTripDiscount')}:</span>
                    <span>-₹{priceEstimate.round_trip_discount?.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-200 font-medium pt-1 border-t border-slate-700">
                  <span>{t('bookingForm.operatorGrossCost')}:</span>
                  <span>₹{(priceEstimate.operator_gross_cost || priceEstimate.base_subtotal || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Additional Aviation Charges */}
            {(priceEstimate.waiting_charges > 0 || priceEstimate.night_halt_cost > 0 || priceEstimate.crew_charges > 0) && (
              <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                <p className="text-yellow-400 font-semibold mb-2 text-xs uppercase tracking-wide">{t('bookingForm.additionalCharges')}</p>
                <div className="space-y-1">
                  {priceEstimate.waiting_charges > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>{t('bookingForm.waitingGroundHolding')}:</span>
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
                      <span>{t('bookingForm.crewAccommodation')}:</span>
                      <span>₹{priceEstimate.crew_charges?.toLocaleString()}</span>
                    </div>
                  )}
                  {priceEstimate.fuel_surcharge > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>{t('bookingForm.fuelSurcharge')}:</span>
                      <span>₹{priceEstimate.fuel_surcharge?.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Platform Fees & Charges */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-blue-400 font-semibold mb-2 text-xs uppercase tracking-wide">{t('bookingForm.platformFees')}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{t('bookingForm.convenienceFee')} ({priceEstimate.convenience_fee_percent || 5}%):</span>
                  <span>₹{(priceEstimate.convenience_fee || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>{t('bookingForm.insurance')} ({priceEstimate.insurance_percent || 2}%):</span>
                  <span>₹{(priceEstimate.insurance || 0).toLocaleString()}</span>
                </div>
                {priceEstimate.peak_surge_applied && (
                  <div className="flex justify-between text-red-400">
                    <span>{t('bookingForm.peakSurge')} ({priceEstimate.peak_surge_multiplier}x):</span>
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
                  {t('bookingForm.helipadCharges')}
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
                    <span>{t('bookingForm.totalLandingCharges')}:</span>
                    <span>₹{priceEstimate.total_landing_charges?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* GST Breakdown */}
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <p className="text-purple-400 font-semibold mb-2 text-xs uppercase tracking-wide">
                GST ({priceEstimate.gst_type === 'inter_state' ? 'IGST' : 'CGST+SGST'})
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>{t('bookingForm.taxableAmount')}:</span>
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
                  <span>{t('bookingForm.totalGst')}:</span>
                  <span>₹{(priceEstimate.total_gst || priceEstimate.gst || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-lg p-4 border border-orange-500/40">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-white font-bold text-lg">{t('bookingForm.grandTotal')}</span>
                  <span className="text-slate-400 text-xs block">({t('bookingForm.inclusiveTaxes')})</span>
                </div>
                <span className="text-orange-400 font-bold text-2xl">₹{(priceEstimate.total || 0).toLocaleString()}</span>
              </div>
              {priceEstimate.operator_payout > 0 && (
                <div className="mt-2 pt-2 border-t border-orange-500/30 flex justify-between text-xs text-slate-400">
                  <span>{t('bookingForm.operatorReceives')}:</span>
                  <span>₹{priceEstimate.operator_payout?.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            {/* Referral & Discount Section */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 mt-4">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Gift className="h-4 w-4 text-green-400" />
                Referral & Discounts / रेफरल और छूट
              </h4>
              
              {/* Referral Code Input */}
              {!referralApplied && (
                <div className="mb-3">
                  <label className="text-slate-400 text-sm mb-1 block">Referral Code (Friend&apos;s Code) / रेफरल कोड</label>
                  <div className="flex gap-2">
                    <Input
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="AIRXXX"
                      className="bg-slate-900 border-slate-600 text-white uppercase"
                      disabled={applyingCode}
                    />
                    <Button
                      onClick={applyReferral}
                      disabled={applyingCode || !referralCode.trim()}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {applyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">Get 10% off on your first booking! / पहली बुकिंग पर 10% छूट!</p>
                </div>
              )}
              
              {/* Referral Applied Badge */}
              {referralApplied && (
                <div className="mb-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-400">Referral Applied! / रेफरल लागू!</span>
                    </div>
                    <span className="text-green-400 font-bold">-{referralApplied.discount_percent}%</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">Referred by: {referralApplied.referrer_name}</p>
                </div>
              )}
              
              {/* Discount Code Input */}
              {!discountApplied && (
                <div className="mb-3">
                  <label className="text-slate-400 text-sm mb-1 block">Promo Code / प्रोमो कोड</label>
                  <div className="flex gap-2">
                    <Input
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      placeholder="AIRYATRA10"
                      className="bg-slate-900 border-slate-600 text-white uppercase"
                      disabled={applyingCode}
                    />
                    <Button
                      onClick={applyDiscount}
                      disabled={applyingCode || !discountCode.trim()}
                      variant="outline"
                      className="border-slate-600"
                    >
                      {applyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Discount Applied Badge */}
              {discountApplied && (
                <div className="mb-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-purple-400" />
                      <span className="text-purple-400">{discountApplied.code} Applied!</span>
                    </div>
                    <span className="text-purple-400 font-bold">-₹{discountApplied.discount_amount?.toLocaleString()}</span>
                  </div>
                </div>
              )}
              
              {/* Wallet Balance */}
              {walletBalance > 0 && (
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="use-wallet"
                        checked={useWallet}
                        onCheckedChange={setUseWallet}
                      />
                      <label htmlFor="use-wallet" className="text-white cursor-pointer">
                        Use Wallet Balance / वॉलेट बैलेंस उपयोग करें
                      </label>
                    </div>
                    <span className="text-blue-400 font-bold">₹{walletBalance.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Final Price After Discounts */}
            {(referralApplied || discountApplied || (useWallet && walletBalance > 0)) && (
              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/40 mt-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Original Price:</span>
                    <span className="line-through">₹{(priceEstimate.total || 0).toLocaleString()}</span>
                  </div>
                  {getFinalPrice().discounts.map((d, i) => (
                    <div key={i} className="flex justify-between text-green-400">
                      <span>{d.type}:</span>
                      <span>-₹{d.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-green-500/30">
                    <span className="text-white font-bold text-lg">You Pay / आप देंगे:</span>
                    <span className="text-green-400 font-bold text-2xl">₹{getFinalPrice().total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

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
          {t('bookingForm.specialRequirements')}
        </Label>
        <textarea
          value={formData.special_requirements}
          onChange={(e) => handleInputChange('special_requirements', e.target.value)}
          placeholder={t('bookingForm.specialRequirementsPlaceholder')}
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
            {t('bookingForm.submitting')}
          </>
        ) : (
          <>
            <Send className="h-5 w-5 mr-2" />
            {permissionRequired ? t('bookingForm.submitApproval') : t('bookingForm.generateInquiry')}
          </>
        )}
      </Button>

      <p className="text-center text-slate-400 text-sm">
        {permissionRequired ? t('bookingForm.approvalNote') : t('bookingForm.inquiryNote')}
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
    </div>
  );
}

export default BookingPage;
