/**
 * API Services - Re-export for backward compatibility
 * 
 * REFACTORED: This file now re-exports from domain-specific service files.
 * For new code, import directly from the specific service file:
 * 
 * import { authAPI } from '@/services/authService';
 * import { bookingAPI } from '@/services/bookingService';
 * import { fleetAPI } from '@/services/fleetService';
 * etc.
 */

// Export the base API client
export { default } from './apiClient';
export { default as api } from './apiClient';

// Auth & Verification Services
export { authAPI, googleAuthAPI, verificationAPI, gstPanAPI } from './authService';

// Booking Services
export { 
  bookingAPI, 
  quoteAPI, 
  journeyAPI, 
  customerAPI, 
  bookingManagementAPI,
  inquiryBroadcastAPI 
} from './bookingService';

// Fleet & Document Services
export { 
  fleetAPI, 
  documentAPI, 
  pilotDocumentAPI, 
  aircraftDocumentAPI,
  flightRecordAPI,
  fuelRecordAPI,
  liveTrackingAPI 
} from './fleetService';

// Operator Services
export { 
  operatorAPI, 
  operatorManagementAPI, 
  regionalManagerAPI 
} from './operatorService';

// Admin Services
export { 
  adminAPI, 
  adminLandingPermissionAPI, 
  adminSettlementAPI,
  userManagementAPI,
  approvalAPI,
  settlementAutomationAPI 
} from './adminService';

// CRM & Referral Services
export { crmAPI, referralAPI } from './crmService';

// Landing & Location Services
export { landingAPI, landingPermissionAPI, pincodeAPI } from './landingService';

// Settings Services
export { settingsAPI, pricingEngineAPI } from './settingsService';

// Support & Communication Services
export { chatAPI, feedbackAPI, notificationAPI } from './supportService';

// Analytics & Reports Services
export { analyticsAPI, reportsAPI, aiAPI } from './analyticsService';

// Integrations Services (Twilio, Tally, Zoho)
export { twilioAPI, tallyAPI, zohoAPI, integrationsAPI } from './integrationsService';
