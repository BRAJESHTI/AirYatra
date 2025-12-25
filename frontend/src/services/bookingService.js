import api from './apiClient';

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

// Customer API
export const customerAPI = {
  getTrips: (status) => api.get('/customer/trips', { params: { status } }),
  getTripDetails: (bookingId) => api.get(`/customer/trips/${bookingId}`),
  cancelTrip: (bookingId, data) => api.post(`/customer/trips/${bookingId}/cancel`, data),
  getInvoice: (bookingId) => api.get(`/customer/trips/${bookingId}/invoice`),
  getRefunds: () => api.get('/customer/refunds'),
  getBookingQuotes: (bookingId) => api.get(`/customer/trips/${bookingId}/quotes`),
  respondToQuote: (bookingId, quoteId, data) => api.post(`/customer/trips/${bookingId}/quotes/${quoteId}/respond`, data),
  getPendingQuotes: () => api.get('/customer/quotes/pending'),
  submitPassengerDetails: (inquiryId, data) => api.post(`/customer/trips/${inquiryId}/passenger-details`, data),
  getPaymentInfo: (inquiryId) => api.get(`/customer/trips/${inquiryId}/payment-info`),
};

// Booking Management API (Admin)
export const bookingManagementAPI = {
  getTimeline: (bookingId) => api.get(`/admin/bookings-management/timeline/${bookingId}`),
  addRemark: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/add-remark`, data),
  requestCancellation: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/request-cancellation`, data),
  emergencyOverride: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/emergency-override`, data),
  reassignBooking: (bookingId, data) => api.post(`/admin/bookings-management/${bookingId}/reassign`, data),
  getByStatus: (params) => api.get('/admin/bookings-management/by-status', { params }),
};

// Inquiry Broadcast API
export const inquiryBroadcastAPI = {
  getPendingInquiries: () => api.get('/inquiry-broadcast/operator/pending'),
  getInquiryDetails: (mappingId) => api.get(`/inquiry-broadcast/operator/inquiry/${mappingId}`),
  acceptInquiry: (mappingId, data) => api.post(`/inquiry-broadcast/operator/accept/${mappingId}`, data),
  rejectInquiry: (mappingId, data) => api.post(`/inquiry-broadcast/operator/reject/${mappingId}`, data),
  reviseQuote: (mappingId, data) => api.post(`/inquiry-broadcast/operator/revise-quote/${mappingId}`, data),
  getInquiryHistory: (status) => api.get('/inquiry-broadcast/operator/history', { params: { status } }),
  getAllBroadcasts: (status) => api.get('/inquiry-broadcast/admin/broadcasts', { params: { status } }),
  getBroadcastDetails: (broadcastId) => api.get(`/inquiry-broadcast/admin/broadcast/${broadcastId}`),
};
