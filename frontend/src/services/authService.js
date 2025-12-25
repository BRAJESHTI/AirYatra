/**
 * Auth Service - Authentication related API calls
 */
import api from './api';

export const authService = {
  // Login
  login: (credentials) => api.post('/auth/login', credentials),
  
  // Register
  register: (userData) => api.post('/auth/register', userData),
  
  // Get current user profile
  getProfile: () => api.get('/auth/profile'),
  
  // Update profile
  updateProfile: (data) => api.put('/auth/profile', data),
  
  // Change password
  changePassword: (data) => api.post('/auth/change-password', data),
  
  // Request password reset
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  
  // Reset password
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, new_password: newPassword }),
  
  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  
  // Get stored token
  getToken: () => localStorage.getItem('token'),
  
  // Get stored user
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  // Check if logged in
  isAuthenticated: () => !!localStorage.getItem('token'),
  
  // Google OAuth
  googleAuthUrl: () => api.get('/google/auth/url'),
  googleCallback: (code) => api.post('/google/auth/callback', { code }),
  
  // Emergent Auth
  emergentAuthUrl: () => api.get('/google/auth/emergent/url'),
  emergentCallback: (code) => api.post('/google/auth/emergent/callback', { code }),
};

export default authService;
