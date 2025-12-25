// Booking Configuration - Shared constants for booking flow
// This file contains all dropdown options, aircraft types, and pricing multipliers

// Aircraft Types
export const aircraftTypes = [
  { value: 'helicopter', label: 'Helicopter / हेलीकॉप्टर', icon: '🚁', maxPassengers: 6 },
  { value: 'chartered_plane', label: 'Chartered Plane / चार्टर्ड प्लेन', icon: '✈️', maxPassengers: 19 },
];

// Udan Ka Prakar (Flight Type) Options
export const udanPrakarOptions = [
  { value: 'one_hour', label: '1 Hour Flight / 1 घंटे की उड़ान', icon: '⏱️' },
  { value: 'two_hour', label: '2 Hour Flight / 2 घंटे की उड़ान', icon: '⏰' },
  { value: 'half_day', label: 'Half Day / आधा दिन', icon: '🌤️' },
  { value: 'full_day', label: 'Full Day / पूरा दिन', icon: '☀️' },
  { value: 'multi_city', label: 'Multi-City / बहु-शहर', icon: '🗺️' },
  { value: 'point_to_point', label: 'Point-to-Point / पॉइंट-टू-पॉइंट', icon: '📍' },
];

// Booking For Options
export const bookingForOptions = [
  { value: 'self', label: 'Self / खुद के लिए', icon: '👤' },
  { value: 'friend_family', label: 'Friend & Family / दोस्त और परिवार', icon: '👨‍👩‍👧' },
  { value: 'company', label: 'Company / Corporate / कंपनी', icon: '🏢' },
  { value: 'political', label: 'Political / VIP / राजनीतिक', icon: '🎖️' },
  { value: 'other', label: 'Other / अन्य', icon: '📝' },
];

// Booking Purpose Options
export const bookingPurposeOptions = [
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

// Booking Steps Configuration
export const bookingSteps = [
  { id: 'passengers', title: 'यात्री / Passengers' },
  { id: 'booking_type', title: 'बुकिंग प्रकार' },
  { id: 'route', title: 'मार्ग / Route' },
  { id: 'price_inquiry', title: 'मूल्य / Price' },
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
  { key: 'collector_noc', label: 'Collector NOC / कलेक्टर NOC' },
  { key: 'fire_dept', label: 'Fire Department Acknowledgment / फायर विभाग की पावती' },
  { key: 'police_station', label: 'Local Police Station Acknowledgment / स्थानीय थाना की पावती' },
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
