import api from './apiClient';

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getOperators: (status) => api.get('/admin/operators', { params: { status } }),
  verifyOperator: (id, data) => api.post(`/admin/operators/${id}/verify`, data),
  getAllBookings: (status) => api.get('/admin/bookings', { params: { status } }),
  reassignBooking: (id, data) => api.post(`/admin/bookings/${id}/reassign`, data),
  forceAssign: (id, data) => api.post(`/admin/bookings/${id}/force-assign`, data),
  getAuditLogs: (filters) => api.get('/admin/audit-logs/', { params: filters }),
  getAuditStatistics: () => api.get('/admin/audit-logs/statistics'),
  getUserActivity: (userId) => api.get(`/admin/audit-logs/user/${userId}/activity`),
  getEntityAuditTrail: (type, id) => api.get(`/admin/audit-logs/entity/${type}/${id}`),
  getCriticalActions: () => api.get('/admin/audit-logs/critical'),
  createUser: (data) => api.post('/admin/users', data),
  getInquiries: (params) => api.get('/admin/inquiries', { params }),
  getInquiryDetails: (id) => api.get(`/admin/inquiries/${id}`),
};

// Admin Landing Permissions API
export const adminLandingPermissionAPI = {
  getPending: () => api.get('/admin/landing-permissions/pending'),
  approve: (id, data) => api.post(`/admin/landing-permissions/${id}/approve`, data),
  reject: (id, data) => api.post(`/admin/landing-permissions/${id}/reject`, data),
};

// Admin Settlements API
export const adminSettlementAPI = {
  create: (data) => api.post('/admin/settlements/create', data),
  getAll: (status) => api.get('/admin/settlements/', { params: { status } }),
  approve: (id, data) => api.post(`/admin/settlements/${id}/approve`, data),
  markPaid: (id, data) => api.post(`/admin/settlements/${id}/mark-paid`, data),
};

// User & Role Management API
export const userManagementAPI = {
  getAllUsers: (params) => api.get('/admin/users/', { params }),
  createUser: (data) => api.post('/admin/users/create', data),
  updateUser: (userId, data) => api.put(`/admin/users/${userId}`, data),
  toggleUserStatus: (userId, data) => api.post(`/admin/users/${userId}/toggle-status`, data),
  resetPassword: (userId, data) => api.post(`/admin/users/${userId}/reset-password`, data),
  control2FA: (userId, data) => api.post(`/admin/users/${userId}/2fa-control`, data),
  getUserActivity: (userId) => api.get(`/admin/users/activity-log/${userId}`),
  getAllRoles: () => api.get('/admin/users/roles'),
  createRole: (data) => api.post('/admin/users/roles', data),
  updateRole: (roleId, data) => api.put(`/admin/users/roles/${roleId}`, data),
  deleteRole: (roleId) => api.delete(`/admin/users/roles/${roleId}`),
  getPermissions: () => api.get('/admin/users/permissions'),
};

// Approval Management API
export const approvalAPI = {
  getQueue: (params) => api.get('/admin/approvals/queue', { params }),
  approve: (approvalId, data) => api.post(`/admin/approvals/${approvalId}/approve`, data),
  reject: (approvalId, data) => api.post(`/admin/approvals/${approvalId}/reject`, data),
  escalate: (approvalId, data) => api.post(`/admin/approvals/${approvalId}/escalate`, data),
  getHistory: (entityType, entityId) => api.get(`/admin/approvals/history/${entityType}/${entityId}`),
  getSettings: () => api.get('/admin/approvals/settings'),
  updateSettings: (data) => api.put('/admin/approvals/settings', data),
};

// Settlement Automation API
export const settlementAutomationAPI = {
  getStatus: () => api.get('/admin/settlement-automation/status'),
  updateConfig: (data) => api.put('/admin/settlement-automation/config', data),
  runNow: (dryRun = false) => api.post('/admin/settlement-automation/run-now', null, { params: { dry_run: dryRun } }),
  getRunStatus: (runId) => api.get(`/admin/settlement-automation/run/${runId}`),
  getPendingOperators: () => api.get('/admin/settlement-automation/pending-operators'),
};
