import api from './apiClient';

// Fleet API
export const fleetAPI = {
  create: (data) => api.post('/fleet/', data),
  getAll: () => api.get('/fleet/'),
  update: (id, data) => api.put(`/fleet/${id}`, data),
  delete: (id) => api.delete(`/fleet/${id}`),
  getStatistics: (id) => api.get(`/fleet/${id}/statistics`),
};

// Document API
export const documentAPI = {
  generateUploadUrl: (data) => api.post('/documents/generate-upload-url', data),
  confirmUpload: (id) => api.post(`/documents/${id}/confirm-upload`),
  getDownloadUrl: (id) => api.get(`/documents/${id}/download-url`),
  getAll: () => api.get('/documents'),
  delete: (id) => api.delete(`/documents/${id}`),
};

// Pilot Document API
export const pilotDocumentAPI = {
  generateUploadUrl: (data) => api.post('/pilot-documents/upload-url', data),
  confirmUpload: (documentId) => api.post(`/pilot-documents/${documentId}/confirm`),
  getPilotDocuments: (pilotId) => api.get(`/pilot-documents/pilot/${pilotId}`),
  deleteDocument: (documentId) => api.delete(`/pilot-documents/${documentId}`),
  getExpiringDocuments: () => api.get('/pilot-documents/expiring-soon'),
};

// Aircraft Document API
export const aircraftDocumentAPI = {
  generateUploadUrl: (data) => api.post('/aircraft-documents/upload-url', data),
  confirmUpload: (documentId) => api.post(`/aircraft-documents/${documentId}/confirm`),
  getAircraftDocuments: (aircraftId) => api.get(`/aircraft-documents/aircraft/${aircraftId}`),
  deleteDocument: (documentId) => api.delete(`/aircraft-documents/${documentId}`),
  getExpiringDocuments: () => api.get('/aircraft-documents/expiring-soon'),
};

// Flight Record API
export const flightRecordAPI = {
  create: (data) => api.post('/flight-records/', data),
  getAircraftRecords: (aircraftId) => api.get(`/flight-records/aircraft/${aircraftId}`),
  getBookingRecord: (bookingId) => api.get(`/flight-records/booking/${bookingId}`),
};

// Fuel Record API
export const fuelRecordAPI = {
  create: (data) => api.post('/fuel-records/', data),
  getAircraftRecords: (aircraftId) => api.get(`/fuel-records/aircraft/${aircraftId}`),
  delete: (fuelId) => api.delete(`/fuel-records/${fuelId}`),
};

// Live Tracking API
export const liveTrackingAPI = {
  updateLocation: (data) => api.post('/live-tracking/update-location', data),
  getAircraftLocation: (aircraftId) => api.get(`/live-tracking/aircraft/${aircraftId}`),
  getBookingTracking: (bookingId) => api.get(`/live-tracking/booking/${bookingId}`),
  getTrackingHistory: (trackingId) => api.get(`/live-tracking/tracking-history/${trackingId}`),
};
