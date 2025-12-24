import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plane, Calendar, Users, Clock, CreditCard, Shield, User, Phone, Building2, FileText, MapPin, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { bookingAPI, settingsAPI, gstPanAPI } from '../services/api';
import { toast } from 'sonner';
import PinCodeInput from '../components/shared/PinCodeInput';
import PriceCalculator from '../components/shared/PriceCalculator';

function BookingPage({ user }) {
  const [formData, setFormData] = useState({
    // Flight type selection
    flight_type: 'point_to_point', // one_hour, two_hour, half_day, full_day_single, full_day_multi, point_to_point
    multi_location_stops: [], // For full_day_multi type
    // Location
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
    passengers: 1,
    trip_type: 'one_way',
    waiting_hours: 0,
    special_requirements: '',
    include_insurance: false,
    // Booking type and purpose
    booking_for: 'self', // self, friend_family, company, political, other
    booking_purpose: 'general_tour', // wedding, temple_yatra, company_tour, election_tour, general_tour, medical_emergency, other
    booking_purpose_other: '',
    // GST billing
    gst_billing: false,
    company_name: '',
    gstin: '',
    billing_address: ''
  });
  
  const [flightTypes, setFlightTypes] = useState([]);
  const [selectedFlightTypeDetails, setSelectedFlightTypeDetails] = useState(null);
  
  const bookingForOptions = [
    { value: 'self', label: 'Self / खुद के लिए' },
    { value: 'friend_family', label: 'Friend & Family / दोस्त और परिवार' },
    { value: 'company', label: 'Company / Corporate / कंपनी' },
    { value: 'political', label: 'Political / VIP / राजनीतिक' },
    { value: 'other', label: 'Other / अन्य' },
  ];

  const bookingPurposeOptions = [
    { value: 'wedding', label: '💒 Wedding / शादी', icon: '💒' },
    { value: 'temple_yatra', label: '🛕 Temple Yatra / मंदिर यात्रा', icon: '🛕' },
    { value: 'company_tour', label: '🏢 Company Tour / कंपनी टूर', icon: '🏢' },
    { value: 'election_tour', label: '🗳️ Election Tour / चुनाव टूर', icon: '🗳️' },
    { value: 'general_tour', label: '✈️ General Tour / सामान्य यात्रा', icon: '✈️' },
    { value: 'medical_emergency', label: '🏥 Medical Emergency / मेडिकल इमरजेंसी', icon: '🏥' },
    { value: 'business_meeting', label: '💼 Business Meeting / बिज़नेस मीटिंग', icon: '💼' },
    { value: 'pilgrimage', label: '🙏 Pilgrimage / तीर्थ यात्रा', icon: '🙏' },
    { value: 'film_shooting', label: '🎬 Film/Media Shooting / फिल्म शूटिंग', icon: '🎬' },
    { value: 'survey_inspection', label: '📋 Survey/Inspection / सर्वे/निरीक्षण', icon: '📋' },
    { value: 'other', label: '📝 Other / अन्य (Specify)', icon: '📝' },
  ];
  
  const [passengerDetails, setPassengerDetails] = useState([{ name: '', age: '', phone: '' }]);
  const [priceEstimate, setPriceEstimate] = useState(null);
  const [insuranceSettings, setInsuranceSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);
  const [gstVerificationMessage, setGstVerificationMessage] = useState('');
  const navigate = useNavigate();

  // Load insurance settings
  useEffect(() => {
    loadInsuranceSettings();
  }, []);

  // Update passenger details array when passenger count changes
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

  const calculateInsuranceAmount = () => {
    if (!insuranceSettings || !formData.include_insurance) return 0;
    
    const passengerCount = parseInt(formData.passengers) || 1;
    
    if (insuranceSettings.rateType === 'fixed') {
      return insuranceSettings.fixedRate * passengerCount;
    } else {
      return (insuranceSettings.coverage * insuranceSettings.percentageRate / 100) * passengerCount;
    }
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

  // GST Verification Function
  const handleVerifyGST = async () => {
    const gstin = formData.gstin.trim().toUpperCase();
    
    if (!gstin || gstin.length !== 15) {
      toast.error('Please enter valid 15-digit GSTIN / कृपया सही 15-अंकों का GSTIN दर्ज करें');
      return;
    }
    
    setGstVerifying(true);
    setGstVerified(false);
    setGstVerificationMessage('');
    
    try {
      const response = await gstPanAPI.verifyGST(gstin);
      const data = response.data;
      
      if (data.verified) {
        setGstVerified(true);
        setGstVerificationMessage(data.message);
        
        // Auto-fill company details
        setFormData(prev => ({
          ...prev,
          company_name: data.company_name || data.trade_name || prev.company_name,
          billing_address: [
            data.address,
            data.city,
            data.district,
            data.state,
            data.pincode
          ].filter(Boolean).join(', ') || prev.billing_address
        }));
        
        toast.success(`GST Verified! / GST सत्यापित!\n${data.company_name || data.trade_name}`);
      } else {
        setGstVerificationMessage(data.message);
        toast.warning(data.message);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'GST verification failed / GST सत्यापन विफल';
      setGstVerificationMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setGstVerifying(false);
    }
  };

  const handlePriceCalculated = (estimate) => {
    setPriceEstimate(estimate);
  };

  const handlePassengerChange = (index, field, value) => {
    setPassengerDetails(prev => {
      const newDetails = [...prev];
      newDetails[index] = { ...newDetails[index], [field]: value };
      return newDetails;
    });
  };

  const isPhoneRequired = () => {
    return formData.booking_for !== 'self';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to book a flight');
      navigate('/login');
      return;
    }

    if (!formData.from_latitude || !formData.to_latitude) {
      toast.error('Please enter valid PIN codes for pickup and drop locations');
      return;
    }

    // Validate passenger details
    for (let i = 0; i < passengerDetails.length; i++) {
      if (!passengerDetails[i].name.trim()) {
        toast.error(`Please enter name for Passenger ${i + 1}`);
        return;
      }
      if (!passengerDetails[i].age || passengerDetails[i].age < 1) {
        toast.error(`Please enter valid age for Passenger ${i + 1}`);
        return;
      }
      // Phone required if booking for others
      if (isPhoneRequired() && !passengerDetails[i].phone.trim()) {
        toast.error(`Please enter phone number for Passenger ${i + 1}`);
        return;
      }
    }

    // Validate GST fields if GST billing is selected
    if (formData.gst_billing) {
      if (!formData.company_name.trim()) {
        toast.error('Please enter company name for GST billing');
        return;
      }
      if (!formData.gstin.trim() || formData.gstin.length !== 15) {
        toast.error('Please enter valid 15-digit GSTIN');
        return;
      }
    }

    const insuranceAmount = calculateInsuranceAmount();
    const totalWithInsurance = (priceEstimate?.total_price || 0) + insuranceAmount;
    const advanceWithInsurance = totalWithInsurance * (priceEstimate?.advance_percent || 5) / 100;

    setLoading(true);
    try {
      const bookingData = {
        from_location: formData.from_location,
        from_pincode: formData.from_pincode,
        from_state: formData.from_state,
        from_district: formData.from_district,
        from_area: formData.from_area,
        from_coordinates: {
          latitude: formData.from_latitude,
          longitude: formData.from_longitude
        },
        to_location: formData.to_location,
        to_pincode: formData.to_pincode,
        to_state: formData.to_state,
        to_district: formData.to_district,
        to_area: formData.to_area,
        to_coordinates: {
          latitude: formData.to_latitude,
          longitude: formData.to_longitude
        },
        departure_date: formData.departure_date,
        pickup_time: formData.pickup_time,
        passengers: formData.passengers,
        passenger_details: passengerDetails,
        trip_type: formData.trip_type,
        waiting_hours: formData.waiting_hours,
        special_requirements: formData.special_requirements,
        estimated_distance_km: priceEstimate?.distance_km,
        estimated_price: priceEstimate?.total_price,
        include_insurance: formData.include_insurance,
        insurance_amount: insuranceAmount,
        insurance_coverage: formData.include_insurance ? insuranceSettings?.coverage : 0,
        total_with_insurance: totalWithInsurance,
        advance_amount: advanceWithInsurance,
        // Booking type and purpose
        booking_for: formData.booking_for,
        booking_purpose: formData.booking_purpose,
        booking_purpose_other: formData.booking_purpose === 'other' ? formData.booking_purpose_other : null,
        // GST billing
        gst_billing: formData.gst_billing,
        billing_details: formData.gst_billing ? {
          company_name: formData.company_name,
          gstin: formData.gstin,
          billing_address: formData.billing_address
        } : null
      };

      const response = await bookingAPI.create(bookingData);
      toast.success('Booking request created! Operators will send quotes soon.');
      navigate('/customer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const insuranceAmount = calculateInsuranceAmount();
  const totalWithInsurance = (priceEstimate?.total_price || 0) + insuranceAmount;

  // Get selected purpose label for display
  const getSelectedPurposeLabel = () => {
    const purpose = bookingPurposeOptions.find(p => p.value === formData.booking_purpose);
    if (formData.booking_purpose === 'other' && formData.booking_purpose_other) {
      return `📝 ${formData.booking_purpose_other}`;
    }
    return purpose ? `${purpose.icon} ${purpose.label.split('/')[0].trim()}` : '';
  };

  return (
    <div className="min-h-screen bg-slate-950" data-testid="booking-page">
      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Plane className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold text-white">AirYatra</span>
          </Link>
          {user && (
            <Link to="/customer" className="text-orange-400 hover:text-orange-300">
              My Dashboard →
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4" data-testid="booking-title">
            Book Your Flight
          </h1>
          <p className="text-xl text-slate-400">
            Search for helicopter charters and get instant price estimates
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="glass p-8 rounded-lg space-y-6" data-testid="booking-form">
              
              {/* Booking Type Selection */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30">
                <h3 className="text-lg font-semibold text-white mb-4">Booking Details / बुकिंग विवरण</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Booking For Dropdown */}
                  <div className="space-y-2">
                    <Label className="text-white">किसके लिए बुकिंग? (Booking For) *</Label>
                    <select
                      value={formData.booking_for}
                      onChange={(e) => setFormData(prev => ({ ...prev, booking_for: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-white"
                    >
                      {bookingForOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Booking Purpose Dropdown */}
                  <div className="space-y-2">
                    <Label className="text-white">यात्रा का उद्देश्य (Purpose) *</Label>
                    <select
                      value={formData.booking_purpose}
                      onChange={(e) => setFormData(prev => ({ ...prev, booking_purpose: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-white"
                    >
                      {bookingPurposeOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Other Purpose Specification */}
                {formData.booking_purpose === 'other' && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-white">Please specify purpose / उद्देश्य बताएं *</Label>
                    <Input
                      value={formData.booking_purpose_other}
                      onChange={(e) => setFormData(prev => ({ ...prev, booking_purpose_other: e.target.value }))}
                      placeholder="Enter booking purpose"
                      required
                      className="bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                )}

                {formData.booking_for !== 'self' && (
                  <p className="mt-3 text-sm text-orange-400">
                    ⚠️ यात्री का Mobile Number अनिवार्य है (Passenger mobile number required)
                  </p>
                )}
              </div>

              {/* Pickup Location */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white text-sm flex items-center justify-center">1</span>
                  Pickup Location
                </h3>
                <PinCodeInput
                  label="Pickup PIN Code"
                  value={formData.from_pincode}
                  onChange={(val) => setFormData(prev => ({ ...prev, from_pincode: val }))}
                  onLocationSelect={handlePickupLocationSelect}
                  placeholder="Enter pickup PIN code"
                  required
                />
              </div>

              {/* Drop Location */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-sm flex items-center justify-center">2</span>
                  Drop Location
                </h3>
                <PinCodeInput
                  label="Drop PIN Code"
                  value={formData.to_pincode}
                  onChange={(val) => setFormData(prev => ({ ...prev, to_pincode: val }))}
                  onLocationSelect={handleDropLocationSelect}
                  placeholder="Enter drop PIN code"
                  required
                />
              </div>

              {/* Trip Details */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-sm flex items-center justify-center">3</span>
                  Trip Details
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departure_date" className="text-white">Departure Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <Input
                        id="departure_date"
                        name="departure_date"
                        type="date"
                        value={formData.departure_date}
                        onChange={handleChange}
                        required
                        className="pl-10 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickup_time" className="text-white">Pickup Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <Input
                        id="pickup_time"
                        name="pickup_time"
                        type="time"
                        value={formData.pickup_time}
                        onChange={handleChange}
                        required
                        className="pl-10 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passengers" className="text-white">Number of Passengers</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <Input
                        id="passengers"
                        name="passengers"
                        type="number"
                        min="1"
                        max="8"
                        value={formData.passengers}
                        onChange={handleChange}
                        required
                        className="pl-10 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trip_type" className="text-white">Trip Type</Label>
                    <select
                      id="trip_type"
                      name="trip_type"
                      value={formData.trip_type}
                      onChange={handleChange}
                      className="w-full h-10 px-3 rounded-md bg-slate-900 border border-slate-700 text-white"
                    >
                      <option value="one_way">One Way</option>
                      <option value="round_trip">Round Trip</option>
                      <option value="hourly">Hourly Charter</option>
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="waiting_hours" className="text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-400" />
                      Waiting Time at Destination (Hours)
                    </Label>
                    <Input
                      id="waiting_hours"
                      name="waiting_hours"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.waiting_hours}
                      onChange={handleChange}
                      className="bg-slate-900 border-slate-700 text-white max-w-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Passenger Details */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center">4</span>
                  Passenger Details
                </h3>
                
                <div className="space-y-4">
                  {passengerDetails.map((passenger, index) => (
                    <div key={index} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-blue-400" />
                        <span className="text-white font-medium">Passenger {index + 1}</span>
                        {index === 0 && formData.booking_for === 'self' && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Primary</span>
                        )}
                      </div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-400 text-sm">Full Name *</Label>
                          <Input
                            type="text"
                            value={passenger.name}
                            onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                            placeholder="Enter name"
                            required
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-400 text-sm">Age *</Label>
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            value={passenger.age}
                            onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                            placeholder="Age"
                            required
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-400 text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            Mobile No. {isPhoneRequired() && <span className="text-red-400">*</span>}
                          </Label>
                          <Input
                            type="tel"
                            value={passenger.phone}
                            onChange={(e) => handlePassengerChange(index, 'phone', e.target.value)}
                            placeholder="+91 XXXXXXXXXX"
                            required={isPhoneRequired()}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insurance Option */}
              {insuranceSettings?.enabled && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      id="include_insurance"
                      checked={formData.include_insurance}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, include_insurance: checked }))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="include_insurance" className="text-white font-semibold flex items-center gap-2 cursor-pointer">
                        <Shield className="h-5 w-5 text-blue-400" />
                        Travel Insurance (₹{(insuranceSettings.coverage / 10000000).toFixed(0)} Crore per passenger)
                      </Label>
                      <p className="text-slate-400 text-sm mt-1">
                        Comprehensive coverage for all passengers during the flight
                      </p>
                      <div className="mt-2 text-sm">
                        <span className="text-blue-400">
                          Premium: ₹{insuranceSettings.rateType === 'fixed' 
                            ? insuranceSettings.fixedRate.toLocaleString() 
                            : Math.round(insuranceSettings.coverage * insuranceSettings.percentageRate / 100).toLocaleString()
                          } per passenger
                        </span>
                        {formData.include_insurance && (
                          <span className="text-green-400 ml-4">
                            Total: ₹{insuranceAmount.toLocaleString()} for {formData.passengers} passenger(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GST Billing Option */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <div className="flex items-start gap-4">
                  <Checkbox
                    id="gst_billing"
                    checked={formData.gst_billing}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, gst_billing: checked }))}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="gst_billing" className="text-white font-semibold flex items-center gap-2 cursor-pointer">
                      <FileText className="h-5 w-5 text-green-400" />
                      GST Invoice Required (कंपनी के नाम से GST बिल चाहिए)
                    </Label>
                    <p className="text-slate-400 text-sm mt-1">
                      For company/corporate bookings with GST input credit
                    </p>
                  </div>
                </div>

                {formData.gst_billing && (
                  <div className="mt-4 p-4 rounded-lg bg-slate-900/50 border border-green-500/30 space-y-4">
                    {/* GSTIN with Verify Button */}
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        GSTIN (15 digits) *
                        {gstVerified && (
                          <span className="text-green-400 text-xs flex items-center gap-1">
                            ✓ Verified / सत्यापित
                          </span>
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={formData.gstin}
                          onChange={(e) => {
                            setFormData(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }));
                            setGstVerified(false);
                            setGstVerificationMessage('');
                          }}
                          placeholder="e.g., 27AABCU9603R1ZM"
                          maxLength={15}
                          required={formData.gst_billing}
                          className={`bg-slate-800 border-slate-700 text-white uppercase flex-1 ${
                            gstVerified ? 'border-green-500' : ''
                          }`}
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyGST}
                          disabled={gstVerifying || formData.gstin.length !== 15}
                          className="bg-blue-600 hover:bg-blue-700 px-4"
                        >
                          {gstVerifying ? 'Verifying...' : 'Verify GST'}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        Format: 22AAAAA0000A1Z5 | Test GST: 27AABCU9603R1ZM (Infosys)
                      </p>
                      {gstVerificationMessage && (
                        <p className={`text-xs ${gstVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                          {gstVerificationMessage}
                        </p>
                      )}
                    </div>

                    {/* Company Name - Auto-filled from GST */}
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        Company Name / कंपनी का नाम *
                        {gstVerified && <span className="text-green-400 text-xs">(Auto-filled)</span>}
                      </Label>
                      <Input
                        value={formData.company_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                        placeholder="Enter company name or verify GST to auto-fill"
                        required={formData.gst_billing}
                        className={`bg-slate-800 border-slate-700 text-white ${
                          gstVerified ? 'border-green-500/50' : ''
                        }`}
                      />
                    </div>

                    {/* Billing Address - Auto-filled from GST */}
                    <div className="space-y-2">
                      <Label className="text-white flex items-center gap-2">
                        Billing Address / बिलिंग पता
                        {gstVerified && <span className="text-green-400 text-xs">(Auto-filled)</span>}
                      </Label>
                      <textarea
                        value={formData.billing_address}
                        onChange={(e) => setFormData(prev => ({ ...prev, billing_address: e.target.value }))}
                        placeholder="Enter registered office address or verify GST to auto-fill"
                        rows="2"
                        className={`w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-white ${
                          gstVerified ? 'border-green-500/50' : ''
                        }`}
                      />
                    </div>

                    {/* GST Verification Success Banner */}
                    {gstVerified && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="text-green-400 text-sm flex items-center gap-2">
                          ✓ GST Verified - Company details auto-filled / GST सत्यापित - कंपनी विवरण ऑटो-भरा गया
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Special Requirements */}
              <div className="space-y-2">
                <Label htmlFor="special_requirements" className="text-white">Special Requirements (Optional)</Label>
                <textarea
                  id="special_requirements"
                  name="special_requirements"
                  value={formData.special_requirements}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Any special requests or requirements..."
                  className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-white"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
                disabled={loading || !formData.from_latitude || !formData.to_latitude}
              >
                {loading ? 'Creating Request...' : 'Request Quotes'}
              </Button>
            </form>
          </div>

          {/* Price Calculator Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              <PriceCalculator
                pickupLocation={{
                  latitude: formData.from_latitude,
                  longitude: formData.from_longitude,
                  area: formData.from_area,
                  district: formData.from_district
                }}
                dropLocation={{
                  latitude: formData.to_latitude,
                  longitude: formData.to_longitude,
                  area: formData.to_area,
                  district: formData.to_district
                }}
                onPriceCalculated={handlePriceCalculated}
                showWaitingTime={false}
              />

              {/* Insurance Summary */}
              {formData.include_insurance && insuranceAmount > 0 && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-2 text-blue-400 mb-3">
                    <Shield className="h-5 w-5" />
                    <span className="font-medium">Insurance Added</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Coverage per person</span>
                      <span className="text-white">₹{(insuranceSettings?.coverage / 10000000).toFixed(0)} Cr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Passengers</span>
                      <span className="text-white">{formData.passengers}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-500/20 pt-2">
                      <span className="text-blue-400">Insurance Premium</span>
                      <span className="text-blue-400 font-semibold">₹{insuranceAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* GST Billing Info */}
              {formData.gst_billing && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <FileText className="h-5 w-5" />
                    <span className="font-medium">GST Invoice</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    GST invoice will be generated in the name of {formData.company_name || 'your company'}
                  </p>
                </div>
              )}

              {/* Total Summary */}
              {priceEstimate && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
                  <h4 className="text-white font-semibold mb-3">Booking Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Flight Cost</span>
                      <span className="text-white">₹{priceEstimate.total_price?.toLocaleString()}</span>
                    </div>
                    {formData.include_insurance && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Insurance</span>
                        <span className="text-white">₹{insuranceAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-orange-500/20 pt-2">
                      <span className="text-white font-semibold">Grand Total</span>
                      <span className="text-xl font-bold text-orange-400">₹{totalWithInsurance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mt-2 p-2 rounded bg-green-500/10">
                      <span className="text-green-400">Advance ({priceEstimate.advance_percent}%)</span>
                      <span className="text-green-400 font-bold">
                        ₹{Math.round(totalWithInsurance * priceEstimate.advance_percent / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Type Info */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <h4 className="text-white font-medium mb-2">Booking Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Booking For:</span>
                    <span className="text-white">
                      {formData.booking_for === 'self' && '👤 Self'}
                      {formData.booking_for === 'friend_family' && '👨‍👩‍👧‍👦 Friend & Family'}
                      {formData.booking_for === 'company' && '🏢 Company'}
                      {formData.booking_for === 'political' && '🎖️ Political/VIP'}
                      {formData.booking_for === 'other' && '📋 Other'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Purpose:</span>
                    <span className="text-orange-400">{getSelectedPurposeLabel()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingPage;
