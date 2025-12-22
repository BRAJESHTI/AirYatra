import axios from 'axios';

console.log('Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL
});

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

console.log('API_URL being used:', API_URL);

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me'),
};

export const bookingAPI = {
  create: (data) => api.post('/bookings/', data),
  getAll: (status) => api.get('/bookings/', { params: { status } }),
  getById: (id) => api.get(`/bookings/${id}`),
  acceptQuote: (bookingId, quoteId) => api.post(`/bookings/${bookingId}/accept-quote`, { quote_id: quoteId }),
  cancel: (id) => api.post(`/bookings/${id}/cancel`),
};

export const quoteAPI = {
  create: (data) => api.post('/quotes', data),
  getInquiries: () => api.get('/quotes/operator/inquiries'),
};

export const fleetAPI = {
  create: (data) => api.post('/fleet', data),
  getAll: () => api.get('/fleet'),
  update: (id, data) => api.put(`/fleet/${id}`, data),
  delete: (id) => api.delete(`/fleet/${id}`),
};

export const documentAPI = {
  generateUploadUrl: (data) => api.post('/documents/generate-upload-url', data),
  confirmUpload: (id) => api.post(`/documents/${id}/confirm-upload`),
  getDownloadUrl: (id) => api.get(`/documents/${id}/download-url`),
  getAll: () => api.get('/documents'),
  delete: (id) => api.delete(`/documents/${id}`),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getOperators: () => api.get('/admin/operators'),
  verifyOperator: (id, data) => api.post(`/admin/operators/${id}/verify`, data),
  getAllBookings: () => api.get('/admin/bookings'),
  reassignBooking: (id, data) => api.post(`/admin/bookings/${id}/reassign`, data),
  getAuditLogs: () => api.get('/admin/audit-logs'),
};

export const aiAPI = {
  getPriceSuggestion: (data) => api.post('/ai/price-suggestion', data),
  verifyDocument: (data) => api.post('/ai/verify-document', data),
  getRouteRecommendations: (data) => api.post('/ai/route-recommendations', data),
};

export const paymentAPI = {
  createOrder: (data) => api.post('/payment/create-order', data),
  verifyPayment: (data) => api.post('/payment/verify', data),
};

export const operatorAPI = {
  createProfile: (data) => api.post('/operator/profile', data),
  getProfile: () => api.get('/operator/profile'),
  updateProfile: (data) => api.put('/operator/profile', data),
  getDashboard: () => api.get('/operator/dashboard'),
  createPilot: (data) => api.post('/operator/pilots', data),
  getPilots: () => api.get('/operator/pilots'),
  updatePilot: (id, data) => api.put(`/operator/pilots/${id}`, data),
  deletePilot: (id) => api.delete(`/operator/pilots/${id}`),
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

export default api;