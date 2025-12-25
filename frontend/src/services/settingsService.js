import api from './apiClient';

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
