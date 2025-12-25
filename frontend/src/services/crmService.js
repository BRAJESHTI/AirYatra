import api from './apiClient';

// CRM API
export const crmAPI = {
  // Dashboard
  getDashboard: () => api.get('/crm/dashboard'),
  getSalesTeamPerformance: () => api.get('/crm/sales-team'),
  
  // Leads
  getLeads: (params) => api.get('/crm/leads', { params }),
  getLead: (id) => api.get(`/crm/leads/${id}`),
  createLead: (data) => api.post('/crm/leads', data),
  updateLead: (id, data) => api.put(`/crm/leads/${id}`, data),
  assignLead: (id, data) => api.post(`/crm/leads/${id}/assign`, data),
  convertLead: (id, data) => api.post(`/crm/leads/${id}/convert`, data),
  
  // Calls
  getCalls: (params) => api.get('/crm/calls', { params }),
  logCall: (data) => api.post('/crm/calls', data),
  
  // Tasks
  getTasks: (params) => api.get('/crm/tasks', { params }),
  createTask: (data) => api.post('/crm/tasks', data),
  updateTask: (id, data) => api.put(`/crm/tasks/${id}`, data),
  
  // Targets
  getTargets: (params) => api.get('/crm/targets', { params }),
  createTarget: (data) => api.post('/crm/targets', data),
  
  // Auto-reassignment
  autoReassignLeads: () => api.post('/crm/auto-reassign'),
  
  // Webhook (for testing)
  webhookCreateLead: (source, data) => api.post(`/crm/leads/webhook/${source}`, data),
};

// Referral & Wallet API
export const referralAPI = {
  // User referral
  getMyCode: () => api.get('/referral/my-code'),
  getReferralStats: () => api.get('/referral/stats'),
  applyReferralCode: (code) => api.post(`/referral/apply/${code}`),
  
  // Wallet
  getWallet: () => api.get('/referral/wallet'),
  
  // Discount codes (public)
  validateDiscount: (data) => api.post('/referral/validate-discount', data),
  
  // Admin - Discount codes
  getDiscountCodes: (params) => api.get('/referral/discount-codes', { params }),
  createDiscountCode: (data) => api.post('/referral/discount-codes', data),
  updateDiscountCode: (codeId, data) => api.put(`/referral/discount-codes/${codeId}`, data),
  deleteDiscountCode: (codeId) => api.delete(`/referral/discount-codes/${codeId}`),
  generateCodeString: (data) => api.post('/referral/generate-code', data),
  
  // Admin - Settings
  getSettings: () => api.get('/referral/settings'),
  updateSettings: (data) => api.put('/referral/settings', data),
  getPublicSettings: () => api.get('/referral/settings/public'),
};
