import api from './apiClient';

// Payment API
export const paymentAPI = {
  createOrder: (data) => api.post('/payment/create-order', data),
  verifyPayment: (data) => api.post('/payment/verify', data),
};

// Payments API (Extended)
export const paymentsAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
  refund: (data) => api.post('/payments/refund', data),
  getMethods: () => api.get('/payments/methods'),
  getOrderStatus: (orderId) => api.get(`/payments/order/${orderId}/status`),
};
