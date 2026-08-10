// Booking Components Index
export { default as BookingStepIndicator } from './BookingStepIndicator';

// Wizard step components (split from monolithic BookingPage.js)
export { default as Step1Passengers } from './steps/Step1Passengers';
export { default as Step2BookingType } from './steps/Step2BookingType';
export { default as Step3Route } from './steps/Step3Route';
export { default as Step4Price } from './steps/Step4Price';

// New Components
export { PriceLockTimer, PriceLockBadge } from './PriceLockTimer';
export { BookingTypeSelector, BookingTypePill } from './BookingTypeSelector';
export { MultiCityRouteBuilder } from './MultiCityRouteBuilder';

// P0 Features: Emergency, Comparison, Map
export { default as AircraftCompareModal } from './AircraftCompareModal';
export { default as MultiCityRouteMap } from './MultiCityRouteMap';
export { default as EmergencyBookingForm } from './EmergencyBookingForm';

// Export configuration
export {
  aircraftTypes,
  udanPrakarOptions,
  bookingTypes,  // NEW: 9 booking types
  bookingForOptions,
  bookingPurposeOptions,
  bookingSteps,
  udanPrakarMultipliers,
  serviceTypeMultipliers,
  defaultPricingSettings,
  villageLandingDocuments,
  getOptionLabel,
  calculateDistance,
} from './bookingConfig';
