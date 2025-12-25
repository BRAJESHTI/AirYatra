import api from './apiClient';

// Chat API
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (bookingId, limit) => api.get(`/chat/messages/${bookingId}`, { params: { limit } }),
  sendMessage: (data) => api.post('/chat/send', data),
  markRead: (messageId) => api.post(`/chat/messages/${messageId}/read`),
};

// Feedback API
export const feedbackAPI = {
  create: (data) => api.post('/feedback/', data),
  getBookingFeedback: (bookingId) => api.get(`/feedback/booking/${bookingId}`),
  getOperatorFeedback: (operatorId, limit) => api.get(`/feedback/operator/${operatorId}`, { params: { limit } }),
  respond: (feedbackId, data) => api.post(`/feedback/${feedbackId}/respond`, data),
  getMyReviews: () => api.get('/feedback/my-reviews'),
};

// Notifications API
export const notificationAPI = {
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (data) => api.put('/notifications/preferences', data),
  getHistory: (limit) => api.get('/notifications/history', { params: { limit } }),
  getInApp: (unreadOnly) => api.get('/notifications/in-app', { params: { unread_only: unreadOnly } }),
  markRead: (id) => api.post(`/notifications/in-app/${id}/read`),
  markAllRead: () => api.post('/notifications/in-app/mark-all-read'),
};
