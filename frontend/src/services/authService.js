import api from './apiClient';

// Auth API
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  logout: () => {
    localStorage.removeItem('token');
    return Promise.resolve();
  },
  // OTP Authentication
  verifyOTP: (data) => api.post('/auth/login/verify-otp', data),
  resendOTP: (data) => api.post('/auth/login/resend-otp', data),
  // Session Management
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
  logoutAllDevices: () => api.post('/auth/logout-all-devices'),
  // Trusted Devices
  getTrustedDevices: () => api.get('/auth/trusted-devices'),
  trustCurrentDevice: () => api.post('/auth/trust-current-device'),
  revokeTrustedDevice: (deviceId) => api.delete(`/auth/trusted-devices/${deviceId}`),
  revokeAllTrustedDevices: () => api.delete('/auth/trusted-devices'),
  // Security Settings
  getSecuritySettings: () => api.get('/auth/security-settings'),
  updateSecuritySettings: (data) => api.put('/auth/security-settings', data),
  // Password
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Google Auth API
export const googleAuthAPI = {
  getSettings: () => api.get('/auth/google/settings'),
  verifyToken: (data) => api.post('/auth/google/verify-token', data),
};

// Verification API
export const verificationAPI = {
  sendOTP: (data) => api.post('/verification/send-otp', data),
  verifyOTP: (data) => api.post('/verification/verify-otp', data),
  agreeTerms: (data) => api.post('/verification/agree-terms', data),
  checkVerification: (email) => api.get(`/verification/check-verification/${email}`),
};

// GST & PAN Verification API
export const gstPanAPI = {
  verifyGST: (gstin) => api.post('/verification/gst/verify', { gstin }),
  verifyPAN: (pan, name) => api.post('/verification/pan/verify', { pan, name }),
  getSampleGSTNumbers: () => api.get('/verification/gst/sample-numbers'),
  getSamplePANNumbers: () => api.get('/verification/pan/sample-numbers'),
};
