import api from './apiClient';

// Analytics API
export const analyticsAPI = {
  getDashboard: (period) => api.get('/analytics/dashboard', { params: { period } }),
  getRevenue: (period) => api.get('/analytics/revenue', { params: { period } }),
  getOperatorAnalytics: (operatorId, period) => api.get(`/analytics/operator/${operatorId}`, { params: { period } }),
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

// AI API
export const aiAPI = {
  getPriceSuggestion: (data) => api.post('/ai/price-suggestion', data),
  verifyDocument: (data) => api.post('/ai/verify-document', data),
  getRouteRecommendations: (data) => api.post('/ai/route-recommendations', data),
};
