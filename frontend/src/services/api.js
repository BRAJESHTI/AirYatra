import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  logout: () => {
    localStorage.removeItem('token');
    return Promise.resolve();
  },
};

// Google Auth API
export const googleAuthAPI = {
  getSettings: () => api.get('/auth/google/settings'),
  verifyToken: (data) => api.post('/auth/google/verify-token', data),
  // Redirect login is handled via window.location redirect
};

// Fleet API
export const fleetAPI = {
  create: (data) => api.post('/fleet/', data),
  getAll: () => api.get('/fleet/'),
  update: (id, data) => api.put(`/fleet/${id}`, data),
  delete: (id) => api.delete(`/fleet/${id}`),
  getStatistics: (id) => api.get(`/fleet/${id}/statistics`),
};

// Booking API
export const bookingAPI = {
  create: (data) => api.post('/bookings/', data),
  createInquiry: (data) => api.post('/bookings/inquiry', data),
  getAll: (status) => api.get('/bookings/', { params: { status } }),
  getById: (id) => api.get(`/bookings/${id}`),
  acceptQuote: (bookingId, quoteId) => api.post(`/bookings/${bookingId}/accept-quote`, { quote_id: quoteId }),
  cancel: (id) => api.post(`/bookings/${id}/cancel`),
  getInquiryStatus: (id) => api.get(`/bookings/inquiry/${id}/status`),
};

// Quote API
export const quoteAPI = {
  create: (data) => api.post('/quotes/', data),
  getInquiries: () => api.get('/quotes/operator/inquiries'),
  getAll: () => api.get('/quotes/'),
};

// Document API
export const documentAPI = {
  generateUploadUrl: (data) => api.post('/documents/generate-upload-url', data),
  confirmUpload: (id) => api.post(`/documents/${id}/confirm-upload`),
  getDownloadUrl: (id) => api.get(`/documents/${id}/download-url`),
  getAll: () => api.get('/documents'),
  delete: (id) => api.delete(`/documents/${id}`),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getOperators: (status) => api.get('/admin/operators', { params: { status } }),
  verifyOperator: (id, data) => api.post(`/admin/operators/${id}/verify`, data),
  getAllBookings: (status) => api.get('/admin/bookings', { params: { status } }),
  reassignBooking: (id, data) => api.post(`/admin/bookings/${id}/reassign`, data),
  forceAssign: (id, data) => api.post(`/admin/bookings/${id}/force-assign`, data),
  getAuditLogs: (filters) => api.get('/admin/audit-logs/', { params: filters }),
  getAuditStatistics: () => api.get('/admin/audit-logs/statistics'),
  getUserActivity: (userId) => api.get(`/admin/audit-logs/user/${userId}/activity`),
  getEntityAuditTrail: (type, id) => api.get(`/admin/audit-logs/entity/${type}/${id}`),
  getCriticalActions: () => api.get('/admin/audit-logs/critical'),
  createUser: (data) => api.post('/admin/users', data),
  // Inquiry Management
  getInquiries: (params) => api.get('/admin/inquiries', { params }),
  getInquiryDetails: (id) => api.get(`/admin/inquiries/${id}`),
};

// Admin Landing Permissions API
export const adminLandingPermissionAPI = {
  getPending: () => api.get('/admin/landing-permissions/pending'),
  approve: (id, data) => api.post(`/admin/landing-permissions/${id}/approve`, data),
  reject: (id, data) => api.post(`/admin/landing-permissions/${id}/reject`, data),
};

// Admin Settlements API
export const adminSettlementAPI = {
  create: (data) => api.post('/admin/settlements/create', data),
  getAll: (status) => api.get('/admin/settlements/', { params: { status } }),
  approve: (id, data) => api.post(`/admin/settlements/${id}/approve`, data),
  markPaid: (id, data) => api.post(`/admin/settlements/${id}/mark-paid`, data),
};

// AI API
export const aiAPI = {
  getPriceSuggestion: (data) => api.post('/ai/price-suggestion', data),
  verifyDocument: (data) => api.post('/ai/verify-document', data),
  getRouteRecommendations: (data) => api.post('/ai/route-recommendations', data),
};

// Payment API
export const paymentAPI = {
  createOrder: (data) => api.post('/payment/create-order', data),
  verifyPayment: (data) => api.post('/payment/verify', data),
};

// Operator API
export const operatorAPI = {
  createProfile: (data) => api.post('/operator/profile', data),
  getProfile: () => api.get('/operator/profile'),
  updateProfile: (data) => api.put('/operator/profile', data),
  getDashboard: () => api.get('/operator/dashboard'),
  createPilot: (data) => api.post('/operator/pilots', data),
  getPilots: () => api.get('/operator/pilots'),
  updatePilot: (id, data) => api.put(`/operator/pilots/${id}`, data),
  deletePilot: (id) => api.delete(`/operator/pilots/${id}`),
  // Quote Management
  getQuoteRequests: () => api.get('/operator/quote-requests'),
  submitRevisedQuote: (data) => api.post('/operator/submit-quote', data),
  getMyQuotes: () => api.get('/operator/my-quotes'),
};

export const pilotDocumentAPI = {
  generateUploadUrl: (data) => api.post('/pilot-documents/upload-url', data),
  confirmUpload: (documentId) => api.post(`/pilot-documents/${documentId}/confirm`),
  getPilotDocuments: (pilotId) => api.get(`/pilot-documents/pilot/${pilotId}`),
  deleteDocument: (documentId) => api.delete(`/pilot-documents/${documentId}`),
  getExpiringDocuments: () => api.get('/pilot-documents/expiring-soon'),
};

export const aircraftDocumentAPI = {
  generateUploadUrl: (data) => api.post('/aircraft-documents/upload-url', data),
  confirmUpload: (documentId) => api.post(`/aircraft-documents/${documentId}/confirm`),
  getAircraftDocuments: (aircraftId) => api.get(`/aircraft-documents/aircraft/${aircraftId}`),
  deleteDocument: (documentId) => api.delete(`/aircraft-documents/${documentId}`),
  getExpiringDocuments: () => api.get('/aircraft-documents/expiring-soon'),
};

export const flightRecordAPI = {
  create: (data) => api.post('/flight-records/', data),
  getAircraftRecords: (aircraftId) => api.get(`/flight-records/aircraft/${aircraftId}`),
  getBookingRecord: (bookingId) => api.get(`/flight-records/booking/${bookingId}`),
};

export const fuelRecordAPI = {
  create: (data) => api.post('/fuel-records/', data),
  getAircraftRecords: (aircraftId) => api.get(`/fuel-records/aircraft/${aircraftId}`),
  delete: (fuelId) => api.delete(`/fuel-records/${fuelId}`),
};

export const liveTrackingAPI = {
  updateLocation: (data) => api.post('/live-tracking/update-location', data),
  getAircraftLocation: (aircraftId) => api.get(`/live-tracking/aircraft/${aircraftId}`),
  getBookingTracking: (bookingId) => api.get(`/live-tracking/booking/${bookingId}`),
  getTrackingHistory: (trackingId) => api.get(`/live-tracking/tracking-history/${trackingId}`),
};

export const landingPermissionAPI = {
  create: (data) => api.post('/landing-permissions/', data),
  uploadDocument: (permissionId, data) => api.post(`/landing-permissions/${permissionId}/upload-document`, data),
  getBookingPermissions: (bookingId) => api.get(`/landing-permissions/booking/${bookingId}`),
  getPilotPending: () => api.get('/landing-permissions/pilot/pending'),
};

// Regional Manager API
export const regionalManagerAPI = {
  getDashboard: () => api.get('/regional-manager/dashboard'),
  getOperators: (status) => api.get('/regional-manager/operators', { params: { status } }),
  approveOperator: (id, notes) => api.post(`/regional-manager/operators/${id}/approve`, { notes }),
  rejectOperator: (id, reason) => api.post(`/regional-manager/operators/${id}/reject`, { reason }),
  getBookings: (status) => api.get('/regional-manager/bookings', { params: { status } }),
  getLandingPermissions: (status) => api.get('/regional-manager/landing-permissions', { params: { status } }),
  approveLandingPermission: (id, notes) => api.post(`/regional-manager/landing-permissions/${id}/approve`, { notes }),
  getProfile: () => api.get('/regional-manager/profile'),
};

// Notifications API
export const notificationAPI = {
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (data) => api.put('/notifications/preferences', data),
  getHistory: (limit) => api.get('/notifications/history', { params: { limit } }),
  getInApp: (unreadOnly) => api.get('/notifications/in-app', { params: { unread_only: unreadOnly } }),
  markRead: (id) => api.post(`/notifications/in-app/${id}/read`),
  markAllRead: () => api.post('/notifications/in-app/mark-all-read'),
};

// Payments API
export const paymentsAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
  refund: (data) => api.post('/payments/refund', data),
  getMethods: () => api.get('/payments/methods'),
  getOrderStatus: (orderId) => api.get(`/payments/order/${orderId}/status`),
};

// Customer API
export const customerAPI = {
  getTrips: (status) => api.get('/customer/trips', { params: { status } }),
  getTripDetails: (bookingId) => api.get(`/customer/trips/${bookingId}`),
  cancelTrip: (bookingId, data) => api.post(`/customer/trips/${bookingId}/cancel`, data),
  getInvoice: (bookingId) => api.get(`/customer/trips/${bookingId}/invoice`),
  getRefunds: () => api.get('/customer/refunds'),
  // Revised Quotes
  getBookingQuotes: (bookingId) => api.get(`/customer/trips/${bookingId}/quotes`),
  respondToQuote: (bookingId, quoteId, data) => api.post(`/customer/trips/${bookingId}/quotes/${quoteId}/respond`, data),
  getPendingQuotes: () => api.get('/customer/quotes/pending'),
  // Passenger Details
  submitPassengerDetails: (inquiryId, data) => api.post(`/customer/trips/${inquiryId}/passenger-details`, data),
  getPaymentInfo: (inquiryId) => api.get(`/customer/trips/${inquiryId}/payment-info`),
};

// User & Role Management API
export const userManagementAPI = {
  getAllUsers: (params) => api.get('/admin/users/', { params }),
  createUser: (data) => api.post('/admin/users/create', data),
  updateUser: (userId, data) => api.put(`/admin/users/${userId}`, data),
  toggleUserStatus: (userId, data) => api.post(`/admin/users/${userId}/toggle-status`, data),
  resetPassword: (userId, data) => api.post(`/admin/users/${userId}/reset-password`, data),
  control2FA: (userId, data) => api.post(`/admin/users/${userId}/2fa-control`, data),
  getUserActivity: (userId) => api.get(`/admin/users/activity-log/${userId}`),
  getAllRoles: () => api.get('/admin/users/roles'),
  createRole: (data) => api.post('/admin/users/roles', data),
  updateRole: (roleId, data) => api.put(`/admin/users/roles/${roleId}`, data),
  deleteRole: (roleId) => api.delete(`/admin/users/roles/${roleId}`),
  getPermissions: () => api.get('/admin/users/permissions'),
};

// Operator Management API
export const operatorManagementAPI = {
  getSuspended: () => api.get('/admin/operators-management/suspended'),
  suspendOperator: (operatorId, data) => api.post(`/admin/operators-management/${operatorId}/suspend`, data),
  activateOperator: (operatorId, data) => api.post(`/admin/operators-management/${operatorId}/activate`, data),
  getDocuments: (operatorId) => api.get(`/admin/operators-management/${operatorId}/documents`),
  verifyDocument: (operatorId, docId, data) => api.post(`/admin/operators-management/${operatorId}/documents/${docId}/verify`, data),
  getPendingApprovals: () => api.get('/admin/operators-management/pending-approvals'),
  approveOnboarding: (operatorId, data) => api.post(`/admin/operators-management/${operatorId}/approve-onboarding`, data),
  rejectOnboarding: (operatorId, data) => api.post(`/admin/operators-management/${operatorId}/reject-onboarding`, data),
  assignRegion: (operatorId, data) => api.post(`/admin/operators-management/${operatorId}/assign-region`, data),
  getPerformance: (operatorId) => api.get(`/admin/operators-management/${operatorId}/performance`),
};

// Booking Management API
export const bookingManagementAPI = {
  getTimeline: (bookingId) => api.get(`/admin/bookings-management/timeline/${bookingId}`),
  addRemark: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/add-remark`, data),
  requestCancellation: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/request-cancellation`, data),
  emergencyOverride: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/emergency-override`, data),
  reassignBooking: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/reassign`, data),
  getByStatus: (params) => api.get('/admin/bookings-management/by-status', { params }),
};

// Approval Management API
export const approvalAPI = {
  getQueue: (params) => api.get('/admin/approvals/queue', { params }),
  approve: (approvalId, data) => api.post(`/admin/approvals/${approvalId}/approve`, data),
  reject: (approvalId, data) => api.post(`/admin/approvals/${approvalId}/reject`, data),
  escalate: (approvalId, data) => api.post(`/admin/approvals/${approvalId}/escalate`, data),
  getHistory: (entityType, entityId) => api.get(`/admin/approvals/history/${entityType}/${entityId}`),
  getSettings: () => api.get('/admin/approvals/settings'),
  updateSettings: (data) => api.put('/admin/approvals/settings', data),
};

// Chat API
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (bookingId, limit) => api.get(`/chat/messages/${bookingId}`, { params: { limit } }),
  sendMessage: (data) => api.post('/chat/send', data),
  markRead: (messageId) => api.post(`/chat/messages/${messageId}/read`),
};

// Feedback API
export const feedbackAPI = {
  create: (data) => api.post('/feedback/', data),
  getBookingFeedback: (bookingId) => api.get(`/feedback/booking/${bookingId}`),
  getOperatorFeedback: (operatorId, limit) => api.get(`/feedback/operator/${operatorId}`, { params: { limit } }),
  respond: (feedbackId, data) => api.post(`/feedback/${feedbackId}/respond`, data),
  getMyReviews: () => api.get('/feedback/my-reviews'),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: (period) => api.get('/analytics/dashboard', { params: { period } }),
  getRevenue: (period) => api.get('/analytics/revenue', { params: { period } }),
  getOperatorAnalytics: (operatorId, period) => api.get(`/analytics/operator/${operatorId}`, { params: { period } }),
};

// Settings API
export const settingsAPI = {
  getPlatformSettings: () => api.get('/settings/platform'),
  updatePlatformSettings: (data) => api.put('/settings/platform', data),
  getRegions: () => api.get('/settings/regions'),
  createRegion: (data) => api.post('/settings/regions', data),
  updateRegion: (id, data) => api.put(`/settings/regions/${id}`, data),
  deleteRegion: (id) => api.delete(`/settings/regions/${id}`),
  getNotificationTemplates: (type) => api.get('/settings/notification-templates', { params: { template_type: type } }),
  createNotificationTemplate: (data) => api.post('/settings/notification-templates', data),
  updateNotificationTemplate: (id, data) => api.put(`/settings/notification-templates/${id}`, data),
  getCommissionTiers: () => api.get('/settings/commission-tiers'),
  getPricingSettings: () => api.get('/settings/pricing'),
  updatePricingSettings: (data) => api.put('/settings/pricing', data),
  getPublicPricing: () => api.get('/settings/pricing/public'),
  // API Keys
  getAPIKeys: () => api.get('/settings/api-keys'),
  updateAPIKeys: (data) => api.put('/settings/api-keys', data),
  // Terms & Conditions
  getTermsConditions: () => api.get('/settings/terms-conditions'),
  updateTermsConditions: (data) => api.put('/settings/terms-conditions', data),
  getTermsAgreements: (params) => api.get('/settings/terms-agreements', { params }),
  // Flight Type Pricing
  getFlightTypePricing: () => api.get('/settings/flight-type-pricing'),
  getFlightTypePricingAdmin: () => api.get('/settings/flight-type-pricing/admin'),
  updateFlightTypePricing: (data) => api.put('/settings/flight-type-pricing', data),
  // Inquiry Distribution Settings
  getInquiryBroadcastSettings: () => api.get('/inquiry-broadcast/settings'),
  updateInquiryBroadcastSettings: (data) => api.put('/inquiry-broadcast/settings', data),
  testInquiryBroadcast: (data) => api.post('/inquiry-broadcast/admin/test-broadcast', data),
  // Payment Rules by Purpose
  getPaymentRules: () => api.get('/settings/payment-rules'),
  getPaymentRulesPublic: () => api.get('/settings/payment-rules/public'),
  updatePaymentRules: (data) => api.put('/settings/payment-rules', data),
};

// Inquiry Broadcast API (Operator)
export const inquiryBroadcastAPI = {
  getPendingInquiries: () => api.get('/inquiry-broadcast/operator/pending'),
  getInquiryDetails: (mappingId) => api.get(`/inquiry-broadcast/operator/inquiry/${mappingId}`),
  acceptInquiry: (mappingId, data) => api.post(`/inquiry-broadcast/operator/accept/${mappingId}`, data),
  rejectInquiry: (mappingId, data) => api.post(`/inquiry-broadcast/operator/reject/${mappingId}`, data),
  reviseQuote: (mappingId, data) => api.post(`/inquiry-broadcast/operator/revise-quote/${mappingId}`, data),
  getInquiryHistory: (status) => api.get('/inquiry-broadcast/operator/history', { params: { status } }),
  // Admin
  getAllBroadcasts: (status) => api.get('/inquiry-broadcast/admin/broadcasts', { params: { status } }),
  getBroadcastDetails: (broadcastId) => api.get(`/inquiry-broadcast/admin/broadcast/${broadcastId}`),
};

// Verification API
export const verificationAPI = {
  sendOTP: (data) => api.post('/verification/send-otp', data),
  verifyOTP: (data) => api.post('/verification/verify-otp', data),
  agreeTerms: (data) => api.post('/verification/agree-terms', data),
  checkVerification: (email) => api.get(`/verification/check-verification/${email}`),
};

// Reports API
export const reportsAPI = {
  // Booking Reports
  getBookingsByRoute: (params) => api.get('/reports/bookings/by-route', { params }),
  getBookingsByState: (params) => api.get('/reports/bookings/by-state', { params }),
  getBookingsByDistrict: (params) => api.get('/reports/bookings/by-district', { params }),
  getBookingsByPurpose: (params) => api.get('/reports/bookings/by-purpose', { params }),
  getBookingsByBookingFor: (params) => api.get('/reports/bookings/by-booking-for', { params }),
  // Operator Reports
  getOperatorPerformance: (params) => api.get('/reports/operators/performance', { params }),
  getOperatorCancellations: (params) => api.get('/reports/operators/cancellations', { params }),
  // Pilot Reports
  getPilotDutyHours: (params) => api.get('/reports/pilots/duty-hours', { params }),
  getPilotFeedback: (params) => api.get('/reports/pilots/feedback', { params }),
  // Settlement Reports
  getSettlementsByOperator: (params) => api.get('/reports/settlements/by-operator', { params }),
  getSettlementsByState: (params) => api.get('/reports/settlements/by-state', { params }),
  getSettlementsByPeriod: (params) => api.get('/reports/settlements/by-period', { params }),
  // Summary
  getReportsSummary: (params) => api.get('/reports/summary', { params }),
};

// Journey API
export const journeyAPI = {
  initiatePickup: (data) => api.post('/journey/pickup/initiate', data),
  verifyPickupOTP: (data) => api.post('/journey/pickup/verify', data),
  verifyStartJourney: (data) => api.post('/journey/start', data),
  initiateCompletion: (bookingId) => api.post(`/journey/complete/initiate?booking_id=${bookingId}`),
  verifyCompletion: (data) => api.post('/journey/complete/verify', data),
  getJourneyStatus: (bookingId) => api.get(`/journey/status/${bookingId}`),
  restrictPilot: (data) => api.post('/journey/pilot/restrict', data),
  getRestrictedPilots: () => api.get('/journey/pilot/restrictions'),
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

// GST & PAN Verification API
export const gstPanAPI = {
  verifyGST: (gstin) => api.post('/verification/gst/verify', { gstin }),
  verifyPAN: (pan, name) => api.post('/verification/pan/verify', { pan, name }),
  getSampleGSTNumbers: () => api.get('/verification/gst/sample-numbers'),
  getSamplePANNumbers: () => api.get('/verification/pan/sample-numbers'),
};

// Settlement Automation API
export const settlementAutomationAPI = {
  getStatus: () => api.get('/admin/settlement-automation/status'),
  updateConfig: (data) => api.put('/admin/settlement-automation/config', data),
  runNow: (dryRun = false) => api.post('/admin/settlement-automation/run-now', null, { params: { dry_run: dryRun } }),
  getRunStatus: (runId) => api.get(`/admin/settlement-automation/run/${runId}`),
  getPendingOperators: () => api.get('/admin/settlement-automation/pending-operators'),
};

export default api;