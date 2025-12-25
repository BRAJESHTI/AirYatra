import api from './apiClient';

// Landing Infrastructure API
export const landingAPI = {
  // Public endpoints (no auth required)
  publicSearch: (query, type, state) => api.get('/landing/public/search', { params: { query, type, state } }),
  getAirports: (state) => api.get('/landing/public/airports', { params: state ? { state } : {} }),
  getHelipads: (state, type) => api.get('/landing/public/helipads', { params: { state, type } }),
  
  // Landing Points Management
  getLandingPoints: (params) => api.get('/landing/points', { params }),
  searchLandingPoints: (latitude, longitude, radius, type, date) => 
    api.get('/landing/points/search', { params: { latitude, longitude, radius_km: radius, type, available_date: date } }),
  getLandingPoint: (id) => api.get(`/landing/points/${id}`),
  createLandingPoint: (data) => api.post('/landing/points', data),
  updateLandingPoint: (id, data) => api.put(`/landing/points/${id}`, data),
  deleteLandingPoint: (id) => api.delete(`/landing/points/${id}`),
  
  // Helipad Owner specific APIs
  getMyHelipads: () => api.get('/landing/my-helipads'),
  getHelipadStats: (helipadId) => api.get(`/landing/helipad/${helipadId}/stats`),
  getHelipadBookings: (helipadId) => api.get(`/landing/helipad/${helipadId}/bookings`),
  
  // Helipad Availability
  getAvailabilityCalendar: (landingPointId, month) => 
    api.get(`/landing/availability/${landingPointId}`, { params: { month } }),
  createAvailabilitySlot: (data) => api.post('/landing/availability', data),
  createBulkAvailability: (data) => api.post('/landing/availability/bulk', data),
  checkAvailability: (landingPointId, date, fromTime, toTime) => 
    api.get('/landing/availability/check', { params: { landing_point_id: landingPointId, check_date: date, from_time: fromTime, to_time: toTime } }),
  
  // Landing Rent
  getRentConfig: (landingPointId) => api.get(`/landing/rent/${landingPointId}`),
  createRentConfig: (data) => api.post('/landing/rent', data),
  calculateRent: (data) => api.post('/landing/rent/calculate', data),
  
  // Village Landing Permissions
  createVillagePermission: (data) => api.post('/landing/village-permission', data),
  getVillagePermission: (id) => api.get(`/landing/village-permission/${id}`),
  getVillagePermissionByInquiry: (inquiryId) => api.get(`/landing/village-permission/inquiry/${inquiryId}`),
  getMyVillagePermissions: () => api.get('/landing/village-permissions'),
  uploadVillageDocument: (permissionId, data) => api.post(`/landing/village-permission/${permissionId}/upload-document`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadVillageDocumentDirect: (permissionId, formData) => api.post(`/landing/village-permission/${permissionId}/upload-document-direct`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Admin Document Verification
  verifyDocument: (permissionId, data) => api.post(`/landing/village-permission/${permissionId}/verify-document`, data),
  approvePermission: (permissionId, data) => api.post(`/landing/village-permission/${permissionId}/approve`, data),
  rejectPermission: (permissionId, data) => api.post(`/landing/village-permission/${permissionId}/reject`, data),
};

// Landing Permission API
export const landingPermissionAPI = {
  create: (data) => api.post('/landing-permissions/', data),
  uploadDocument: (permissionId, data) => api.post(`/landing-permissions/${permissionId}/upload-document`, data),
  getBookingPermissions: (bookingId) => api.get(`/landing-permissions/booking/${bookingId}`),
  getPilotPending: () => api.get('/landing-permissions/pilot/pending'),
};

// PIN Code API
export const pincodeAPI = {
  lookup: (pincode) => api.get(`/pincode/lookup/${pincode}`),
  lookupLive: (pincode, useLiveApi = true) => api.get(`/pincode/lookup/${pincode}`, { params: { use_live_api: useLiveApi } }),
  search: (params) => api.get('/pincode/search', { params }),
  calculatePrice: (params) => api.post('/pincode/calculate-price', null, { params }),
  estimateDistance: (fromPincode, toPincode) => api.get('/pincode/estimate-distance', { 
    params: { from_pincode: fromPincode, to_pincode: toPincode } 
  }),
};
