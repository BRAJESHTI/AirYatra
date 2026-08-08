// Booking Components Index
export { default as BookingStepIndicator } from './BookingStepIndicator';
export { default as AircraftPassengerStep } from './AircraftPassengerStep';
export { default as BookingPurposeStep } from './BookingPurposeStep';
export { default as RouteSelectionStep } from './RouteSelectionStep';
export { default as PriceSummaryStep } from './PriceSummaryStep';

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
