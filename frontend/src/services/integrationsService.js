/**
 * Integrations API Service
 * Handles Twilio, Tally, and Zoho integrations
 */

import api from './apiClient';

// ==================== TWILIO ====================
export const twilioAPI = {
  getDashboard: () => api.get('/twilio/dashboard'),
  getConfig: () => api.get('/twilio/config'),
  updateConfig: (data) => api.post('/twilio/config', data),
  getCalls: (params = {}) => api.get('/twilio/calls', { params }),
  getCallDetails: (callSid) => api.get(`/twilio/calls/${callSid}`),
  initiateCall: (data) => api.post('/twilio/call', data),
  getRecording: (callSid) => api.get(`/twilio/calls/${callSid}/recording`),
  addCallNotes: (callSid, notes) => api.post(`/twilio/calls/${callSid}/notes`, { notes }),
};

// ==================== TALLY ====================
export const tallyAPI = {
  getDashboard: () => api.get('/tally/dashboard'),
  getConfig: () => api.get('/tally/config'),
  updateConfig: (data) => api.post('/tally/config', data),
  testConnection: () => api.post('/tally/test-connection'),
  getVouchers: (params = {}) => api.get('/tally/vouchers', { params }),
  createVoucher: (data) => api.post('/tally/vouchers', data),
  triggerSync: (type = 'all') => api.post('/tally/sync', null, { params: { sync_type: type } }),
  getSyncLogs: (params = {}) => api.get('/tally/sync/logs', { params }),
  getLedgers: (params = {}) => api.get('/tally/ledgers', { params }),
  createLedger: (data) => api.post('/tally/ledgers', data),
  exportXML: (params = {}) => api.get('/tally/export/xml', { params }),
};

// ==================== ZOHO ====================
export const zohoAPI = {
  getDashboard: () => api.get('/zoho/dashboard'),
  getConfig: () => api.get('/zoho/config'),
  updateConfig: (data) => api.post('/zoho/config', data),
  getOAuthUrl: () => api.get('/zoho/oauth/url'),
  testConnection: () => api.post('/zoho/test-connection'),
  // Books - Contacts
  getContacts: (params = {}) => api.get('/zoho/books/contacts', { params }),
  createContact: (data) => api.post('/zoho/books/contacts', data),
  // Books - Invoices
  getInvoices: (params = {}) => api.get('/zoho/books/invoices', { params }),
  createInvoice: (data) => api.post('/zoho/books/invoices', data),
  // CRM - Leads
  getLeads: (params = {}) => api.get('/zoho/crm/leads', { params }),
  createLead: (data) => api.post('/zoho/crm/leads', data),
  // Sync
  triggerSync: (module = 'all') => api.post('/zoho/sync', null, { params: { module } }),
  getSyncLogs: (params = {}) => api.get('/zoho/sync/logs', { params }),
  autoSyncBookings: () => api.post('/zoho/auto-sync/bookings'),
};

// Combined Integrations API for convenience
export const integrationsAPI = {
  // Twilio
  getTwilioDashboard: twilioAPI.getDashboard,
  getTwilioConfig: twilioAPI.getConfig,
  updateTwilioConfig: twilioAPI.updateConfig,
  getTwilioCalls: twilioAPI.getCalls,
  initiateCall: twilioAPI.initiateCall,
  
  // Tally
  getTallyDashboard: tallyAPI.getDashboard,
  getTallyConfig: tallyAPI.getConfig,
  updateTallyConfig: tallyAPI.updateConfig,
  testTallyConnection: tallyAPI.testConnection,
  getTallyVouchers: tallyAPI.getVouchers,
  triggerTallySync: tallyAPI.triggerSync,
  getTallySyncLogs: tallyAPI.getSyncLogs,
  exportTallyXML: tallyAPI.exportXML,
  
  // Zoho
  getZohoDashboard: zohoAPI.getDashboard,
  getZohoConfig: zohoAPI.getConfig,
  updateZohoConfig: zohoAPI.updateConfig,
  getZohoContacts: zohoAPI.getContacts,
  getZohoInvoices: zohoAPI.getInvoices,
  getZohoLeads: zohoAPI.getLeads,
  triggerZohoSync: zohoAPI.triggerSync,
  autoSyncBookingsToZoho: zohoAPI.autoSyncBookings,
};

export default integrationsAPI;
