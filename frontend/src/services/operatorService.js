import api from './apiClient';

// Operator API
export const operatorAPI = {
  createProfile: (data) => api.post('/operator/profile', data),
  getProfile: () => api.get('/operator/profile'),
  getInquiries: (params) => api.get('/quotes/operator/inquiries', { params }),
  updateProfile: (data) => api.put('/operator/profile', data),
  getDashboard: () => api.get('/operator/dashboard'),
  createPilot: (data) => api.post('/operator/pilots', data),
  getPilots: () => api.get('/operator/pilots'),
  updatePilot: (id, data) => api.put(`/operator/pilots/${id}`, data),
  deletePilot: (id) => api.delete(`/operator/pilots/${id}`),
  getQuoteRequests: () => api.get('/operator/quote-requests'),
  submitRevisedQuote: (data) => api.post('/operator/submit-quote', data),
  getMyQuotes: () => api.get('/operator/my-quotes'),
};

// Operator Management API (Admin)
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
