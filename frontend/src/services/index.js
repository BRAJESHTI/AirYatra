/**
 * Services Index - Re-export all service modules
 * Import from here for cleaner imports
 * 
 * Usage:
 * import { authService, bookingService, landingService, referralService } from '@/services';
 * OR
 * import authService from '@/services/authService';
 */

// Main API instance (for direct use if needed)
export { default as api } from './api';

// Domain-specific services
export { authService } from './authService';
export { bookingService } from './bookingService';
export { landingService } from './landingService';
export { referralService } from './referralService';

// Legacy exports from api.js (for backwards compatibility)
export { 
  authAPI, 
  bookingAPI, 
  customerAPI, 
  operatorAPI, 
  adminAPI, 
  settingsAPI, 
  pincodeAPI,
  landingAPI,
  referralAPI 
} from './api';
