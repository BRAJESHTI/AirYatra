/**
 * useMapCache - React hook for managing offline map tile cache
 * AirYatra Aviation Platform
 */

import { useState, useCallback, useEffect } from 'react';

// India major cities bounding boxes for pre-caching
export const INDIA_REGIONS = {
  mumbai: { name: 'Mumbai', north: 19.3, south: 18.8, east: 73.1, west: 72.7 },
  delhi: { name: 'Delhi NCR', north: 28.9, south: 28.3, east: 77.5, west: 76.8 },
  bangalore: { name: 'Bangalore', north: 13.2, south: 12.8, east: 77.8, west: 77.4 },
  chennai: { name: 'Chennai', north: 13.3, south: 12.9, east: 80.4, west: 80.0 },
  hyderabad: { name: 'Hyderabad', north: 17.6, south: 17.2, east: 78.7, west: 78.2 },
  kolkata: { name: 'Kolkata', north: 22.7, south: 22.4, east: 88.5, west: 88.2 },
  pune: { name: 'Pune', north: 18.7, south: 18.4, east: 74.0, west: 73.7 },
  ahmedabad: { name: 'Ahmedabad', north: 23.2, south: 22.9, east: 72.7, west: 72.4 },
  jaipur: { name: 'Jaipur', north: 27.0, south: 26.7, east: 76.0, west: 75.6 },
  goa: { name: 'Goa', north: 15.8, south: 14.9, east: 74.3, west: 73.6 },
  // Pilgrimage routes
  shirdi: { name: 'Shirdi', north: 19.8, south: 19.7, east: 74.5, west: 74.4 },
  tirupati: { name: 'Tirupati', north: 13.7, south: 13.5, east: 79.5, west: 79.3 },
  vaishno_devi: { name: 'Vaishno Devi', north: 33.1, south: 32.9, east: 75.0, west: 74.8 },
  kedarnath: { name: 'Kedarnath', north: 30.8, south: 30.6, east: 79.1, west: 78.9 },
  // All India (low zoom only)
  all_india: { name: 'All India', north: 35.0, south: 8.0, east: 97.0, west: 68.0 }
};

export function useMapCache() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preCaching, setPreCaching] = useState(false);
  const [preCacheProgress, setPreCacheProgress] = useState(null);

  // Send message to service worker and get response
  const sendToServiceWorker = useCallback((type, data = {}) => {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('Service Worker not active'));
        return;
      }

      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type, data },
        [messageChannel.port2]
      );
    });
  }, []);

  // Get cache statistics
  const getStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await sendToServiceWorker('GET_MAP_CACHE_STATS');
      setStats(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [sendToServiceWorker]);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await sendToServiceWorker('CLEAR_MAP_CACHE');
      setStats({ tileCount: 0, estimatedSizeMB: '0' });
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [sendToServiceWorker]);

  // Pre-cache a region
  const preCacheRegion = useCallback(async (regionKey, zoomLevels = [8, 10, 12]) => {
    const region = INDIA_REGIONS[regionKey];
    if (!region) {
      setError(`Unknown region: ${regionKey}`);
      return null;
    }

    try {
      setPreCaching(true);
      setPreCacheProgress({ region: region.name, status: 'caching' });
      setError(null);

      const result = await sendToServiceWorker('PRE_CACHE_REGION', {
        bounds: region,
        zoomLevels
      });

      setPreCacheProgress({ 
        region: region.name, 
        status: 'complete', 
        cached: result.cached 
      });

      // Refresh stats
      await getStats();
      return result;
    } catch (err) {
      setError(err.message);
      setPreCacheProgress({ region: region.name, status: 'error' });
      return null;
    } finally {
      setPreCaching(false);
    }
  }, [sendToServiceWorker, getStats]);

  // Pre-cache multiple regions
  const preCacheMultipleRegions = useCallback(async (regionKeys, zoomLevels = [8, 10, 12]) => {
    let totalCached = 0;
    
    for (const regionKey of regionKeys) {
      const result = await preCacheRegion(regionKey, zoomLevels);
      if (result) {
        totalCached += result.cached;
      }
    }
    
    return { totalCached };
  }, [preCacheRegion]);

  // Check if service worker supports map caching
  const isSupported = useCallback(() => {
    return 'serviceWorker' in navigator && navigator.serviceWorker.controller;
  }, []);

  // Load stats on mount
  useEffect(() => {
    if (isSupported()) {
      getStats();
    }
  }, [isSupported, getStats]);

  return {
    stats,
    loading,
    error,
    preCaching,
    preCacheProgress,
    getStats,
    clearCache,
    preCacheRegion,
    preCacheMultipleRegions,
    isSupported,
    REGIONS: INDIA_REGIONS
  };
}

export default useMapCache;
