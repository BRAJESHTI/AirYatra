/**
 * Services Index - Clean imports for all API services
 * 
 * Usage:
 * import { authAPI, bookingAPI, fleetAPI } from '@/services';
 */

// Base API Client
export { default as api } from './apiClient';

// All Services
export * from './authService';
export * from './bookingService';
export * from './fleetService';
export * from './operatorService';
export * from './adminService';
export * from './crmService';
export * from './landingService';
export * from './settingsService';
export * from './supportService';
export * from './analyticsService';
export * from './paymentService';
