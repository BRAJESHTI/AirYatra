import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" message briefly
      if (wasOffline) {
        setShowBanner(true);
        setTimeout(() => setShowBanner(false), 3000);
      }
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setIsOnline(false);
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Don't render if online and banner not showing
  if (isOnline && !showBanner) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[200] transition-all duration-500 ${
        showBanner ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className={`px-4 py-3 flex items-center justify-center gap-3 ${
        isOnline 
          ? 'bg-green-600' 
          : 'bg-gradient-to-r from-red-600 to-orange-600'
      }`}>
        {isOnline ? (
          <>
            <Wifi className="h-5 w-5 text-white animate-pulse" />
            <span className="text-white font-medium">
              Back online! Your changes will sync automatically.
            </span>
          </>
        ) : (
          <>
            <WifiOff className="h-5 w-5 text-white animate-bounce" />
            <div className="text-white">
              <span className="font-medium">You are offline</span>
              <span className="hidden sm:inline text-white/80"> — Some features may be unavailable. Using cached data.</span>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Retry</span>
            </button>
          </>
        )}
      </div>
      
      {/* Dismiss button for offline state */}
      {!isOnline && (
        <button
          onClick={() => setShowBanner(false)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-1"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default OfflineIndicator;
