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
  logout: () => {
    localStorage.removeItem('token');
    return Promise.resolve();
  },
};

// Fleet API
export const fleetAPI = {
  create: (data) => api.post('/fleet/', data),
  getAll: () => api.get('/fleet/'),
  update: (id, data) => api.put(`/fleet/${id}`, data),
  delete: (id) => api.delete(`/fleet/${id}`),
  getStatistics: (id) => api.get(`/fleet/${id}/statistics`),
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

export default api;