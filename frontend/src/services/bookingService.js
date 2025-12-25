/**
 * Booking Service - Booking and Inquiry related API calls
 */
import api from './api';

export const bookingService = {
  // Create inquiry
  createInquiry: (data) => api.post('/inquiries', data),
  
  // Get all inquiries (customer)
  getMyInquiries: () => api.get('/inquiries/my'),
  
  // Get inquiry by ID
  getInquiry: (id) => api.get(`/inquiries/${id}`),
  
  // Get inquiry with quotes
  getInquiryWithQuotes: (id) => api.get(`/inquiries/${id}/quotes`),
  
  // Accept quote
  acceptQuote: (inquiryId, quoteId) => api.post(`/inquiries/${inquiryId}/accept-quote`, { quote_id: quoteId }),
  
  // Cancel inquiry
  cancelInquiry: (id, reason) => api.post(`/inquiries/${id}/cancel`, { reason }),
  
  // Get bookings
  getMyBookings: () => api.get('/bookings/my'),
  
  // Get booking by ID
  getBooking: (id) => api.get(`/bookings/${id}`),
  
  // Get journey status
  getJourneyStatus: (bookingId) => api.get(`/bookings/${bookingId}/journey-status`),
  
  // Calculate price estimate
  calculatePrice: (data) => api.post('/pricing/calculate', data),
  
  // Get public pricing settings
  getPublicPricing: () => api.get('/settings/public/pricing'),
};

export default bookingService;
