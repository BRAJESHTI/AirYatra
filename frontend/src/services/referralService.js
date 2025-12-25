/**
 * Referral Service - Referral & Wallet API calls
 */
import api from './api';

export const referralService = {
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

export default referralService;
