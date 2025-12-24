import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Calendar, Users, Clock, CreditCard, Shield, User, Phone, Building2, FileText, MapPin, Plus, Minus, ChevronLeft, ChevronRight, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { bookingAPI, settingsAPI, gstPanAPI } from '../services/api';
import { toast } from 'sonner';
import PinCodeInput from '../components/shared/PinCodeInput';

// Step indicator component
const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center justify-center mb-8">
    {steps.map((step, index) => (
      <React.Fragment key={step.id}>
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
            currentStep > index ? 'bg-green-500 text-white' :
            currentStep === index ? 'bg-orange-500 text-white ring-4 ring-orange-500/30' :
            'bg-slate-700 text-slate-400'
          }`}>
            {currentStep > index ? <Check className="h-5 w-5" /> : index + 1}
          </div>
          <span className={`text-xs mt-2 ${currentStep === index ? 'text-orange-400 font-medium' : 'text-slate-500'}`}>
            {step.title}
          </span>
        </div>
        {index < steps.length - 1 && (
          <div className={`w-16 h-1 mx-2 rounded ${currentStep > index ? 'bg-green-500' : 'bg-slate-700'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

function BookingPage({ user }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Flight Type
    flight_type: '',
    booking_type: 'standard', // standard, custom_quote
    booking_for: 'self',
    booking_purpose: 'general_tour',
    booking_purpose_other: '',
    multi_location_stops: [],
    
    // Step 2: Trip Details
    from_pincode: '',
    from_location: '',
    from_state: '',
    from_district: '',
    from_area: '',
    from_latitude: null,
    from_longitude: null,
    to_pincode: '',
    to_location: '',
    to_state: '',
    to_district: '',
    to_area: '',
    to_latitude: null,
    to_longitude: null,
    departure_date: '',
    pickup_time: '',
    return_date: '',
    trip_type: 'one_way',
    waiting_hours: 0,
    
    // Step 3: Passengers
    passengers: 1,
    
    // Step 4: Additional
    include_insurance: false,
    gst_billing: false,
    company_name: '',
    gstin: '',
    billing_address: '',
    special_requirements: '',
  });

  const [passengerDetails, setPassengerDetails] = useState([{ name: '', age: '', phone: '' }]);
  const [flightTypes, setFlightTypes] = useState([]);
  const [selectedFlightTypeDetails, setSelectedFlightTypeDetails] = useState(null);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [insuranceSettings, setInsuranceSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);
  const [gstVerificationMessage, setGstVerificationMessage] = useState('');
  const [revisedQuote, setRevisedQuote] = useState(null);

  const steps = [
    { id: 'flight_type', title: 'उड़ान प्रकार' },
    { id: 'trip_details', title: 'यात्रा विवरण' },
    { id: 'passengers', title: 'यात्री' },
    { id: 'additional', title: 'अतिरिक्त' },
  ];

  const bookingForOptions = [
    { value: 'self', label: 'Self / खुद के लिए', icon: '👤' },
    { value: 'friend_family', label: 'Friend & Family / दोस्त और परिवार', icon: '👨‍👩‍👧' },
    { value: 'company', label: 'Company / Corporate / कंपनी', icon: '🏢' },
    { value: 'political', label: 'Political / VIP / राजनीतिक', icon: '🎖️' },
    { value: 'other', label: 'Other / अन्य', icon: '📝' },
  ];

  const bookingPurposeOptions = [
    { value: 'wedding', label: 'Wedding / शादी', icon: '💒' },
    { value: 'temple_yatra', label: 'Temple Yatra / मंदिर यात्रा', icon: '🛕' },
    { value: 'company_tour', label: 'Company Tour / कंपनी टूर', icon: '🏢' },
    { value: 'election_tour', label: 'Election Tour / चुनाव टूर', icon: '🗳️' },
    { value: 'general_tour', label: 'General Tour / सामान्य यात्रा', icon: '✈️' },
    { value: 'medical_emergency', label: 'Medical Emergency / मेडिकल इमरजेंसी', icon: '🏥' },
    { value: 'business_meeting', label: 'Business Meeting / बिज़नेस मीटिंग', icon: '💼' },
    { value: 'pilgrimage', label: 'Pilgrimage / तीर्थ यात्रा', icon: '🙏' },
    { value: 'film_shooting', label: 'Film/Media Shooting / फिल्म शूटिंग', icon: '🎬' },
    { value: 'survey_inspection', label: 'Survey/Inspection / सर्वे/निरीक्षण', icon: '📋' },
    { value: 'other', label: 'Other / अन्य', icon: '📝' },
  ];

  useEffect(() => {
    loadFlightTypes();
    loadInsuranceSettings();
  }, []);

  useEffect(() => {
    const count = parseInt(formData.passengers) || 1;
    setPassengerDetails(prev => {
      const newDetails = [...prev];
      while (newDetails.length < count) {
        newDetails.push({ name: '', age: '', phone: '' });
      }
      while (newDetails.length > count) {
        newDetails.pop();
      }
      return newDetails;
    });
  }, [formData.passengers]);

  useEffect(() => {
    if (formData.flight_type && flightTypes.length > 0) {
      const flightType = flightTypes.find(ft => ft.id === formData.flight_type);
      setSelectedFlightTypeDetails(flightType || null);
    }
  }, [formData.flight_type, flightTypes]);

  const loadFlightTypes = async () => {
    try {
      const response = await settingsAPI.getFlightTypePricing();
      const types = response.data.flight_types || [];
      setFlightTypes(types);
    } catch (err) {
      console.error('Failed to load flight types');
      setFlightTypes([
        { id: 'one_hour', name: '1 घंटे की उड़ान', name_en: '1 Hour Flight', price: 75000, type: 'fixed', icon: '🚁' },
        { id: 'two_hour', name: '2 घंटे की उड़ान', name_en: '2 Hour Flight', price: 140000, type: 'fixed', icon: '🚁' },
        { id: 'half_day', name: 'Half-Day बुकिंग', name_en: 'Half Day Booking', price: 250000, type: 'fixed', icon: '⏰' },
        { id: 'full_day_single', name: 'Full-Day (Single City)', name_en: 'Full Day Single City', price: 450000, type: 'fixed', icon: '🏙️' },
        { id: 'full_day_multi', name: 'Full-Day (Multiple Locations)', name_en: 'Full Day Multi City', base_price: 500000, per_stop_price: 50000, type: 'multi_stop', icon: '📍' },
        { id: 'point_to_point', name: 'Point-to-Point उड़ान', name_en: 'Point to Point', base_price: 50000, rate_per_km: 800, type: 'distance_based', icon: '📍' },
      ]);
    }
  };

  const loadInsuranceSettings = async () => {
    try {
      const response = await settingsAPI.getPublicPricing();
      setInsuranceSettings({
        enabled: response.data.insurance_enabled,
        coverage: response.data.insurance_coverage_amount,
        rateType: response.data.insurance_rate_type,
        fixedRate: response.data.insurance_fixed_rate,
        percentageRate: response.data.insurance_percentage_rate
      });
    } catch (err) {
      console.error('Failed to load insurance settings');
    }
  };

  const calculateEstimatedPrice = () => {
    if (!selectedFlightTypeDetails) return null;
    
    let basePrice = 0;
    const ft = selectedFlightTypeDetails;
    
    if (ft.type === 'fixed') {
      basePrice = ft.price || 0;
    } else if (ft.type === 'multi_stop') {
      basePrice = (ft.base_price || 500000) + (formData.multi_location_stops.length * (ft.per_stop_price || 50000));
    } else if (ft.type === 'distance_based') {
      basePrice = ft.base_price || 50000;
    }
    
    // Add insurance if selected
    let insuranceAmount = 0;
    if (formData.include_insurance && insuranceSettings) {
      const passengerCount = parseInt(formData.passengers) || 1;
      if (insuranceSettings.rateType === 'fixed') {
        insuranceAmount = insuranceSettings.fixedRate * passengerCount;
      } else {
        insuranceAmount = (insuranceSettings.coverage * insuranceSettings.percentageRate / 100) * passengerCount;
      }
    }
    
    // Calculate GST (18%)
    const subtotal = basePrice + insuranceAmount;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    return {
      basePrice,
      insuranceAmount,
      subtotal,
      gst,
      total
    };
  };

  const handlePickupLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      from_pincode: location.pincode,
      from_location: `${location.area}, ${location.district}`,
      from_state: location.state,
      from_district: location.district,
      from_area: location.area,
      from_latitude: location.latitude,
      from_longitude: location.longitude
    }));
  };

  const handleDropLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      to_pincode: location.pincode,
      to_location: `${location.area}, ${location.district}`,
      to_state: location.state,
      to_district: location.district,
      to_area: location.area,
      to_latitude: location.latitude,
      to_longitude: location.longitude
    }));
  };

  const handleAddStop = () => {
    if (formData.multi_location_stops.length < 5) {
      setFormData(prev => ({
        ...prev,
        multi_location_stops: [...prev.multi_location_stops, { pincode: '', location: '', state: '' }]
      }));
    }
  };

  const handleRemoveStop = (index) => {
    setFormData(prev => ({
      ...prev,
      multi_location_stops: prev.multi_location_stops.filter((_, i) => i !== index)
    }));
  };

  const handleStopLocationSelect = (index, location) => {
    setFormData(prev => {
      const stops = [...prev.multi_location_stops];
      stops[index] = {
        pincode: location.pincode,
        location: `${location.area}, ${location.district}`,
        state: location.state
      };
      return { ...prev, multi_location_stops: stops };
    });
  };

  const verifyGST = async () => {
    if (!formData.gstin || formData.gstin.length !== 15) {
      toast.error('Please enter a valid 15-digit GST number');
      return;
    }
    
    setGstVerifying(true);
    setGstVerificationMessage('');
    
    try {
      const response = await gstPanAPI.verifyGST(formData.gstin);
      if (response.data.verified) {
        setGstVerified(true);
        setGstVerificationMessage(`✅ ${response.data.company_name}`);
        setFormData(prev => ({
          ...prev,
          company_name: response.data.company_name || prev.company_name,
          billing_address: response.data.address || prev.billing_address
        }));
        toast.success('GST Verified Successfully!');
      } else {
        setGstVerified(false);
        setGstVerificationMessage('❌ GST verification failed');
        toast.error('GST verification failed');
      }
    } catch (err) {
      setGstVerified(false);
      setGstVerificationMessage('❌ Verification failed');
      toast.error('GST verification failed');
    } finally {
      setGstVerifying(false);
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 0: // Flight Type
        if (!formData.flight_type) {
          toast.error('कृपया उड़ान प्रकार चुनें / Please select flight type');
          return false;
        }
        return true;
      case 1: // Trip Details
        if (!formData.from_pincode || !formData.to_pincode) {
          toast.error('कृपया पिकअप और ड्रॉप लोकेशन भरें / Please fill pickup and drop locations');
          return false;
        }
        if (!formData.departure_date || !formData.pickup_time) {
          toast.error('कृपया तारीख और समय भरें / Please fill date and time');
          return false;
        }
        return true;
      case 2: // Passengers
        const hasEmptyPassenger = passengerDetails.some(p => !p.name || !p.age);
        if (hasEmptyPassenger) {
          toast.error('कृपया सभी यात्री विवरण भरें / Please fill all passenger details');
          return false;
        }
        return true;
      case 3: // Additional
        if (formData.gst_billing && !formData.gstin) {
          toast.error('कृपया GST नंबर भरें / Please enter GST number');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    if (!user) {
      toast.error('Please login to book');
      navigate('/login');
      return;
    }
    
    setLoading(true);
    
    try {
      const bookingData = {
        ...formData,
        passenger_details: passengerDetails,
        estimated_price: calculateEstimatedPrice()?.total || 0,
        user_id: user.id,
        status: formData.booking_type === 'custom_quote' ? 'quote_requested' : 'pending',
        flight_type_details: selectedFlightTypeDetails
      };
      
      const response = await bookingAPI.create(bookingData);
      toast.success(formData.booking_type === 'custom_quote' 
        ? 'Quote request submitted! Operators will respond soon. / कोट अनुरोध भेजा गया!'
        : 'Booking created successfully! / बुकिंग सफल!'
      );
      navigate('/bookings');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const priceEstimateData = calculateEstimatedPrice();

  // STEP 1: Flight Type Selection
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">उड़ान प्रकार चुनें</h2>
        <p className="text-slate-400">Select your flight type</p>
      </div>

      {/* Booking Type */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <Label className="text-orange-400 mb-3 block">Booking Type / बुकिंग प्रकार</Label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, booking_type: 'standard' })}
            className={`p-4 rounded-xl border-2 transition-all ${
              formData.booking_type === 'standard'
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="text-2xl mb-2">💰</div>
            <p className="text-white font-medium">Standard Price</p>
            <p className="text-slate-400 text-sm">मानक मूल्य पर बुक करें</p>
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, booking_type: 'custom_quote' })}
            className={`p-4 rounded-xl border-2 transition-all ${
              formData.booking_type === 'custom_quote'
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="text-2xl mb-2">📝</div>
            <p className="text-white font-medium">Custom Quote</p>
            <p className="text-slate-400 text-sm">ऑपरेटर से कोट मांगें</p>
          </button>
        </div>
        {formData.booking_type === 'custom_quote' && (
          <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <p className="text-blue-400 text-sm">
              💡 Operators can send revised quotes. You can accept or deny their offers.
              <br />
              <span className="text-blue-300">ऑपरेटर revised quote भेज सकते हैं। आप accept या deny कर सकते हैं।</span>
            </p>
          </div>
        )}
      </div>

      {/* Flight Type Selection */}
      <div className="space-y-4">
        <Label className="text-orange-400 block">Flight Type / उड़ान का प्रकार *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flightTypes.map(ft => (
            <button
              key={ft.id}
              type="button"
              onClick={() => setFormData({ ...formData, flight_type: ft.id })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                formData.flight_type === ft.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-2xl mr-2">{ft.icon || '🚁'}</span>
                  <span className="text-white font-medium">{ft.name}</span>
                  {ft.name_en && <p className="text-slate-400 text-sm mt-1">{ft.name_en}</p>}
                </div>
                {formData.flight_type === ft.id && (
                  <Check className="h-5 w-5 text-orange-500" />
                )}
              </div>
              {/* Show price only after selection */}
              {formData.flight_type === ft.id && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-orange-400 font-bold text-lg">
                    {ft.type === 'fixed' && `₹${(ft.price || 0).toLocaleString()}`}
                    {ft.type === 'multi_stop' && `₹${(ft.base_price || 500000).toLocaleString()}+`}
                    {ft.type === 'distance_based' && `₹${(ft.base_price || 50000).toLocaleString()} + ₹${ft.rate_per_km || 800}/km`}
                  </p>
                  {ft.duration && <p className="text-slate-400 text-xs">{ft.duration}</p>}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-location stops for full_day_multi */}
      {formData.flight_type === 'full_day_multi' && (
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-orange-400">Add Stops / स्टॉप जोड़ें (Max 5)</Label>
            <Button
              type="button"
              size="sm"
              onClick={handleAddStop}
              disabled={formData.multi_location_stops.length >= 5}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Stop
            </Button>
          </div>
          {formData.multi_location_stops.map((stop, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-slate-400 w-8">#{index + 1}</span>
              <div className="flex-1">
                <PinCodeInput
                  label=""
                  value={stop.pincode}
                  onChange={(val) => {
                    const stops = [...formData.multi_location_stops];
                    stops[index].pincode = val;
                    setFormData({ ...formData, multi_location_stops: stops });
                  }}
                  onLocationSelect={(loc) => handleStopLocationSelect(index, loc)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveStop(index)}
                className="text-red-400"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {formData.multi_location_stops.length > 0 && (
            <p className="text-orange-400 text-sm">
              Additional: ₹{(formData.multi_location_stops.length * 50000).toLocaleString()} for {formData.multi_location_stops.length} stops
            </p>
          )}
        </div>
      )}

      {/* Booking For & Purpose */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Booking For / किसके लिए</Label>
          <select
            value={formData.booking_for}
            onChange={(e) => setFormData({ ...formData, booking_for: e.target.value })}
            className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
          >
            {bookingForOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Purpose / उद्देश्य</Label>
          <select
            value={formData.booking_purpose}
            onChange={(e) => setFormData({ ...formData, booking_purpose: e.target.value })}
            className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
          >
            {bookingPurposeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {formData.booking_purpose === 'other' && (
        <Input
          placeholder="Specify purpose / उद्देश्य बताएं"
          value={formData.booking_purpose_other}
          onChange={(e) => setFormData({ ...formData, booking_purpose_other: e.target.value })}
          className="bg-slate-800 border-slate-700"
        />
      )}
    </div>
  );

  // STEP 2: Trip Details
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">यात्रा विवरण</h2>
        <p className="text-slate-400">Enter trip details</p>
      </div>

      {/* Pickup Location */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <Label className="text-green-400 font-medium">Pickup Location / पिकअप स्थान *</Label>
        </div>
        <PinCodeInput
          label=""
          value={formData.from_pincode}
          onChange={(val) => setFormData({ ...formData, from_pincode: val })}
          onLocationSelect={handlePickupLocationSelect}
        />
        {formData.from_location && (
          <p className="text-slate-300 text-sm">
            📍 {formData.from_location}, {formData.from_state}
          </p>
        )}
      </div>

      {/* Drop Location */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <Label className="text-red-400 font-medium">Drop Location / ड्रॉप स्थान *</Label>
        </div>
        <PinCodeInput
          label=""
          value={formData.to_pincode}
          onChange={(val) => setFormData({ ...formData, to_pincode: val })}
          onLocationSelect={handleDropLocationSelect}
        />
        {formData.to_location && (
          <p className="text-slate-300 text-sm">
            📍 {formData.to_location}, {formData.to_state}
          </p>
        )}
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
          <Label className="text-slate-300 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-400" />
            Departure Date / प्रस्थान तिथि *
          </Label>
          <Input
            type="date"
            value={formData.departure_date}
            onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="bg-slate-800 border-slate-700"
          />
        </div>
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
          <Label className="text-slate-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-400" />
            Pickup Time / पिकअप समय *
          </Label>
          <Input
            type="time"
            value={formData.pickup_time}
            onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      </div>

      {/* Trip Type */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
        <Label className="text-slate-300">Trip Type / यात्रा प्रकार</Label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, trip_type: 'one_way' })}
            className={`p-3 rounded-lg border-2 transition-all ${
              formData.trip_type === 'one_way'
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <p className="text-white font-medium">One Way</p>
            <p className="text-slate-400 text-sm">एक तरफ</p>
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, trip_type: 'round_trip' })}
            className={`p-3 rounded-lg border-2 transition-all ${
              formData.trip_type === 'round_trip'
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <p className="text-white font-medium">Round Trip</p>
            <p className="text-slate-400 text-sm">राउंड ट्रिप</p>
          </button>
        </div>
      </div>

      {formData.trip_type === 'round_trip' && (
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
          <Label className="text-slate-300">Return Date / वापसी तिथि</Label>
          <Input
            type="date"
            value={formData.return_date}
            onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
            min={formData.departure_date || new Date().toISOString().split('T')[0]}
            className="bg-slate-800 border-slate-700"
          />
        </div>
      )}
    </div>
  );

  // STEP 3: Passenger Details
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">यात्री विवरण</h2>
        <p className="text-slate-400">Enter passenger details</p>
      </div>

      {/* Passenger Count */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <Label className="text-slate-300 flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-orange-400" />
          Number of Passengers / यात्रियों की संख्या
        </Label>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFormData({ ...formData, passengers: Math.max(1, formData.passengers - 1) })}
            disabled={formData.passengers <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="text-2xl font-bold text-white w-12 text-center">{formData.passengers}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFormData({ ...formData, passengers: Math.min(10, formData.passengers + 1) })}
            disabled={formData.passengers >= 10}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Passenger Details */}
      <div className="space-y-4">
        {passengerDetails.map((passenger, index) => (
          <div key={index} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-orange-400" />
              <span className="text-white font-medium">Passenger {index + 1} / यात्री {index + 1}</span>
              {index === 0 && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">Primary</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Name / नाम *</Label>
                <Input
                  placeholder="Full Name"
                  value={passenger.name}
                  onChange={(e) => {
                    const updated = [...passengerDetails];
                    updated[index].name = e.target.value;
                    setPassengerDetails(updated);
                  }}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Age / उम्र *</Label>
                <Input
                  type="number"
                  placeholder="Age"
                  min="1"
                  max="120"
                  value={passenger.age}
                  onChange={(e) => {
                    const updated = [...passengerDetails];
                    updated[index].age = e.target.value;
                    setPassengerDetails(updated);
                  }}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Phone / फोन</Label>
                <Input
                  type="tel"
                  placeholder="Phone Number"
                  value={passenger.phone}
                  onChange={(e) => {
                    const updated = [...passengerDetails];
                    updated[index].phone = e.target.value;
                    setPassengerDetails(updated);
                  }}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // STEP 4: Additional Details
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">अतिरिक्त विवरण</h2>
        <p className="text-slate-400">Insurance, GST & other details</p>
      </div>

      {/* Insurance */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              id="insurance"
              checked={formData.include_insurance}
              onCheckedChange={(checked) => setFormData({ ...formData, include_insurance: checked })}
            />
            <div>
              <Label htmlFor="insurance" className="text-white font-medium cursor-pointer flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-400" />
                Travel Insurance / यात्रा बीमा
              </Label>
              <p className="text-slate-400 text-sm mt-1">
                Coverage up to ₹{((insuranceSettings?.coverage || 500000) / 100000).toFixed(0)} Lakh per passenger
              </p>
            </div>
          </div>
          {formData.include_insurance && insuranceSettings && (
            <div className="text-right">
              <p className="text-green-400 font-bold">
                ₹{(insuranceSettings.fixedRate * formData.passengers).toLocaleString()}
              </p>
              <p className="text-slate-500 text-xs">{formData.passengers} × ₹{insuranceSettings.fixedRate}</p>
            </div>
          )}
        </div>
        {formData.include_insurance && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-green-400 text-sm">
              ✅ Insurance covers: Medical emergencies, Trip cancellation, Baggage loss
            </p>
          </div>
        )}
      </div>

      {/* GST Billing */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="gst_billing"
            checked={formData.gst_billing}
            onCheckedChange={(checked) => setFormData({ ...formData, gst_billing: checked })}
          />
          <div>
            <Label htmlFor="gst_billing" className="text-white font-medium cursor-pointer flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-400" />
              GST Invoice Required / जीएसटी इनवॉइस चाहिए
            </Label>
            <p className="text-slate-400 text-sm mt-1">
              For company billing with GST credit
            </p>
          </div>
        </div>
        
        {formData.gst_billing && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div className="space-y-2">
              <Label className="text-slate-300">GST Number (GSTIN) *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="22AAAAA0000A1Z5"
                  value={formData.gstin}
                  onChange={(e) => {
                    setFormData({ ...formData, gstin: e.target.value.toUpperCase() });
                    setGstVerified(false);
                    setGstVerificationMessage('');
                  }}
                  maxLength={15}
                  className="bg-slate-800 border-slate-700 font-mono"
                />
                <Button
                  type="button"
                  onClick={verifyGST}
                  disabled={gstVerifying || formData.gstin.length !== 15}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {gstVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
              {gstVerificationMessage && (
                <p className={`text-sm ${gstVerified ? 'text-green-400' : 'text-red-400'}`}>
                  {gstVerificationMessage}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Company Name / कंपनी का नाम</Label>
              <Input
                placeholder="Company Name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="bg-slate-800 border-slate-700"
                disabled={gstVerified}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Billing Address / बिलिंग पता</Label>
              <textarea
                placeholder="Full billing address"
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                rows="2"
                className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Special Requirements */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
        <Label className="text-slate-300 flex items-center gap-2">
          <FileText className="h-4 w-4 text-orange-400" />
          Special Requirements / विशेष आवश्यकताएं
        </Label>
        <textarea
          placeholder="Any special requirements, medical conditions, wheelchair access, etc."
          value={formData.special_requirements}
          onChange={(e) => setFormData({ ...formData, special_requirements: e.target.value })}
          rows="3"
          className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white"
        />
      </div>

      {/* Price Summary */}
      {priceEstimateData && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/30">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-orange-400" />
            Price Summary / मूल्य सारांश
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Base Price ({selectedFlightTypeDetails?.name})</span>
              <span>₹{priceEstimateData.basePrice.toLocaleString()}</span>
            </div>
            {formData.include_insurance && (
              <div className="flex justify-between text-slate-300">
                <span>Insurance ({formData.passengers} passengers)</span>
                <span>₹{priceEstimateData.insuranceAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-300">
              <span>GST (18%)</span>
              <span>₹{priceEstimateData.gst.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-slate-600">
              <span>Total / कुल</span>
              <span className="text-orange-400">₹{priceEstimateData.total.toLocaleString()}</span>
            </div>
          </div>
          {formData.booking_type === 'custom_quote' && (
            <p className="text-blue-400 text-sm mt-3">
              * Final price may vary based on operator quotes / अंतिम मूल्य ऑपरेटर कोट के आधार पर बदल सकता है
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center text-orange-400 hover:text-orange-300 mb-4">
            <Plane className="h-8 w-8 mr-2" />
            <span className="text-2xl font-bold">AirYatra</span>
          </Link>
          <h1 className="text-3xl font-bold text-white">Book Your Flight / उड़ान बुक करें</h1>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={steps} />

        {/* Form Container */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          {/* Render current step */}
          {currentStep === 0 && renderStep1()}
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && renderStep4()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous / पिछला
            </Button>
            
            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="bg-orange-500 hover:bg-orange-600 flex items-center gap-2"
              >
                Next / अगला
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {formData.booking_type === 'custom_quote' ? 'Request Quote / कोट मांगें' : 'Book Now / अभी बुक करें'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Revised Quote Notice */}
        {revisedQuote && (
          <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <h4 className="text-blue-400 font-medium mb-2">📝 Revised Quote Received / संशोधित कोट मिला</h4>
            <p className="text-white">
              <span className="text-slate-400">Operator:</span> {revisedQuote.operator_name}
            </p>
            <p className="text-orange-400 text-xl font-bold">₹{revisedQuote.amount?.toLocaleString()}</p>
            <div className="flex gap-2 mt-3">
              <Button className="bg-green-600 hover:bg-green-700">Accept / स्वीकार</Button>
              <Button variant="outline" className="text-red-400 border-red-400">Deny / अस्वीकार</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingPage;
