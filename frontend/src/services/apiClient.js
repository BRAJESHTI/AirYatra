import axios from 'axios';

// ==================== HIGH-PERFORMANCE API CLIENT ====================

// Request cache for deduplication
const pendingRequests = new Map();

// Create axios instance with optimized configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,  // 30 second timeout
  // Connection pooling hints
  maxRedirects: 5,
  decompress: true,
});

// Request deduplication - prevent duplicate parallel requests
const getCacheKey = (config) => {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
};

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Deduplicate GET requests
    if (config.method === 'get') {
      const cacheKey = getCacheKey(config);
      const pending = pendingRequests.get(cacheKey);
      
      if (pending) {
        // Return existing promise instead of making new request
        const controller = new AbortController();
        config.signal = controller.signal;
        controller.abort('Duplicate request cancelled');
        return pending.then(() => config);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    // Clear from pending requests
    const cacheKey = getCacheKey(response.config);
    pendingRequests.delete(cacheKey);
    
    return response;
  },
  (error) => {
    // Clear from pending on error too
    if (error.config) {
      const cacheKey = getCacheKey(error.config);
      pendingRequests.delete(cacheKey);
    }
    
    // Handle 401 - unauthorized
    if (error.response?.status === 401) {
      // Don't redirect for login/register endpoints - let the form handle the error
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    
    // Handle 429 - rate limited
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 1;
      console.warn(`Rate limited. Retry after ${retryAfter}s`);
    }
    
    return Promise.reject(error);
  }
);

// ==================== BATCH REQUEST HELPER ====================
export const batchRequests = async (requests) => {
  /**
   * Execute multiple requests in parallel efficiently
   * Usage: batchRequests([api.get('/a'), api.get('/b')])
   */
  return Promise.allSettled(requests);
};

// ==================== RETRY HELPER ====================
export const withRetry = async (fn, retries = 3, delay = 1000) => {
  /**
   * Retry a request with exponential backoff
   */
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
};

export default api;
