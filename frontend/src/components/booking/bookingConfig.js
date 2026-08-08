// Booking Configuration - Shared constants for booking flow
// This file contains all dropdown options, aircraft types, and pricing multipliers

// Aircraft Types
export const aircraftTypes = [
  {
    value: 'helicopter',
    label: 'Helicopter Charter',
    description: 'Bell, Airbus, AW, Robinson',
    icon: '🚁',
    maxPassengers: 6,
    image: '/services/helicopter.jpg'
  },
  {
    value: 'chartered_plane',
    label: 'Private Jet',
    description: 'Light, midsize & heavy jets',
    icon: '✈️',
    maxPassengers: 19,
    image: '/services/private_jet.jpg'
  },
  {
    value: 'air_ambulance',
    label: 'Air Ambulance',
    description: 'Medical emergency flights',
    icon: '🚑',
    maxPassengers: 6,
    image: '/services/air_ambulance.jpg'
  },
  {
    value: 'yacht_cruiser',
    label: 'Luxury Yacht / Cruiser',
    description: 'Private yacht & cruise charters',
    icon: '🛥️',
    maxPassengers: 30,
    image: '/services/yacht_cruiser.jpg'
  },
  {
    value: 'cargo',
    label: 'Cargo Aircraft / Ship',
    description: 'Cargo & logistics transport',
    icon: '📦',
    maxPassengers: 4,
    image: '/services/cargo.jpg'
  },
  {
    value: 'joy_ride',
    label: 'Scenic / Joy Ride',
    description: 'Tourism & sightseeing flights',
    icon: '🏔️',
    maxPassengers: 6,
    image: '/services/joy_ride.jpg'
  }
];

// Price multiplier per service category (chartered_plane/helicopter can be overridden by admin pricing settings)
export const serviceTypeMultipliers = {
  helicopter: 1,
  chartered_plane: 1.5,
  air_ambulance: 1.8,
  yacht_cruiser: 1.2,
  cargo: 1.3,
  joy_ride: 0.8
};

// ============ 9 BOOKING TYPES (NEW) ============
// Matches backend BOOKING_TYPES from aircraft_catalog_routes.py

export const bookingTypes = [
  { 
    value: 'one_way', 
    label: 'One Way', 
    labelHi: 'एकतरफा',
    icon: '→',
    description: 'Single journey from A to B',
    descriptionHi: 'A से B तक एक तरफ़ा यात्रा',
    multiplier: 1.0,
    minHours: null,
    minDays: null,
    discountHint: null
  },
  { 
    value: 'round_trip', 
    label: 'Round Trip', 
    labelHi: 'वापसी यात्रा',
    icon: '↔',
    description: 'Return journey A to B to A',
    descriptionHi: 'A से B और वापस A तक',
    multiplier: 1.85, // 7.5% discount on 2x
    minHours: null,
    minDays: null,
    discountHint: 'Save 5-10%'
  },
  { 
    value: 'multi_city', 
    label: 'Multi-City', 
    labelHi: 'बहु-शहर',
    icon: '◇',
    description: 'Multiple destinations in one trip',
    descriptionHi: 'एक यात्रा में कई गंतव्य',
    multiplier: 1.0, // Per leg pricing
    minHours: null,
    minDays: null,
    discountHint: 'Per-leg discounts'
  },
  { 
    value: 'hourly_charter', 
    label: 'Hourly Charter', 
    labelHi: 'प्रति घंटा चार्टर',
    icon: '⏱',
    description: 'Book by the hour',
    descriptionHi: 'घंटे के हिसाब से बुक करें',
    multiplier: 1.0,
    minHours: 1,
    minDays: null,
    discountHint: null
  },
  { 
    value: 'daily_charter', 
    label: 'Daily Charter', 
    labelHi: 'दैनिक चार्टर',
    icon: '📅',
    description: 'Full day aircraft at your disposal',
    descriptionHi: 'पूरे दिन के लिए विमान',
    multiplier: 0.9, // 10% discount for full day
    minHours: 8,
    minDays: 1,
    discountHint: '10% off daily rate'
  },
  { 
    value: 'multi_day', 
    label: 'Multi-Day', 
    labelHi: 'बहु-दिवसीय',
    icon: '📆',
    description: '3+ days charter with discounts',
    descriptionHi: '3+ दिन की चार्टर छूट के साथ',
    multiplier: 0.85, // 15% discount for 3+ days
    minHours: null,
    minDays: 3,
    discountHint: '10-15% off'
  },
  { 
    value: 'group_booking', 
    label: 'Group Booking', 
    labelHi: 'समूह बुकिंग',
    icon: '👥',
    description: '5+ passengers, special rates',
    descriptionHi: '5+ यात्री, विशेष दरें',
    multiplier: 0.92, // 8% group discount
    minHours: null,
    minDays: null,
    minPassengers: 5,
    discountHint: 'Group discounts'
  },
  { 
    value: 'emergency', 
    label: 'Emergency', 
    labelHi: 'आपातकालीन',
    icon: '🚨',
    description: 'Urgent medical or time-critical',
    descriptionHi: 'तत्काल चिकित्सा या समय-महत्वपूर्ण',
    multiplier: 1.25, // 25% priority surcharge
    minHours: null,
    minDays: null,
    discountHint: 'Priority surcharge',
    priority: true
  },
  { 
    value: 'event_based', 
    label: 'Event Package', 
    labelHi: 'इवेंट पैकेज',
    icon: '🎉',
    description: 'Weddings, Corporate events, Film shoots',
    descriptionHi: 'शादी, कॉर्पोरेट इवेंट, फिल्म शूटिंग',
    multiplier: 1.0, // Custom quote
    minHours: null,
    minDays: null,
    discountHint: 'Custom quote',
    customQuote: true
  }
];

// Udan Ka Prakar (Flight Type) Options - Legacy support
export const udanPrakarOptions = [
  { value: 'one_hour', label: '1 Hour Flight / 1 घंटे की उड़ान', icon: '⏱️' },
  { value: 'two_hour', label: '2 Hour Flight / 2 घंटे की उड़ान', icon: '⏰' },
  { value: 'half_day', label: 'Half Day', icon: '🌤️' },
  { value: 'full_day', label: 'Full Day', icon: '☀️' },
  { value: 'multi_city', label: 'Multi-City', icon: '🗺️' },
  { value: 'point_to_point', label: 'Point-to-Point', icon: '📍' },
];

// Booking For Options
export const bookingForOptions = [
  { value: 'self', label: 'Self', icon: '👤' },
  { value: 'friend_family', label: 'Friend & Family', icon: '👨‍👩‍👧' },
  { value: 'company', label: 'Company / Corporate', icon: '🏢' },
  { value: 'political', label: 'Political / VIP', icon: '🎖️' },
  { value: 'other', label: 'Other', icon: '📝' },
];

// Booking Purpose Options
export const bookingPurposeOptions = [
  { value: 'wedding', label: 'Wedding', icon: '💒' },
  { value: 'temple_yatra', label: 'Temple Yatra', icon: '🛕' },
  { value: 'company_tour', label: 'Corporate Tour', icon: '🏢' },
  { value: 'election_tour', label: 'Election Campaign', icon: '🗳️' },
  { value: 'medical_emergency', label: 'Medical Emergency', icon: '🏥' },
  { value: 'film_shooting', label: 'Film Shooting', icon: '🎬' },
  { value: 'general_tour', label: 'General Tour', icon: '✈️' },
  { value: 'pilgrimage', label: 'Pilgrimage', icon: '🙏' },
  { value: 'business', label: 'Business Meeting', icon: '💼' },
  { value: 'other', label: 'Other', icon: '📝' },
];

// Booking Steps Configuration
export const bookingSteps = [
  { id: 'passengers', title: 'Passengers' },
  { id: 'booking_type', title: 'Booking Type' },
  { id: 'route', title: 'Route' },
  { id: 'price_inquiry', title: 'Price' },
];

// Udan Prakar Pricing Multipliers
export const udanPrakarMultipliers = {
  one_hour: 0.8,
  two_hour: 1,
  half_day: 1.5,
  full_day: 2.5,
  multi_city: 3,
  point_to_point: 1,
};

// Default Pricing Settings (fallback)
export const defaultPricingSettings = {
  base_price: 50000,
  rate_per_km: 500,
  helicopter_multiplier: 1,
  plane_multiplier: 1.5,
  dynamic_pricing_enabled: true,
  custom_price_enabled: true,
};

// Village Landing Required Documents
export const villageLandingDocuments = [
  { key: 'collector_noc', label: 'Collector NOC' },
  { key: 'fire_dept', label: 'Fire Department Acknowledgment' },
  { key: 'police_station', label: 'Local Police Station Acknowledgment' },
  { key: 'sp_dcp', label: 'SP/DCP Acknowledgment / SP/DCP की पावती' },
];

// Helper function to get label by value
export const getOptionLabel = (options, value) => {
  const option = options.find(opt => opt.value === value);
  return option ? option.label : value;
};

// Helper function to calculate distance using Haversine formula
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
