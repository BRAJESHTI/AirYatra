import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, Lock, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Price Lock Timer Component
 * Shows 15-minute countdown with live decrement
 * Auto-redirects on expiry
 */
export const PriceLockTimer = ({ 
  lockId,
  expiresAt,
  onExpire,
  onExtend,
  totalAmount,
  currency = 'INR',
  showExtendButton = true,
  redirectOnExpire = '/booking',
  className = ''
}) => {
  const navigate = useNavigate();
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  
  // Calculate remaining time in seconds
  const calculateTimeRemaining = useCallback(() => {
    if (!expiresAt) return 0;
    const expiry = new Date(expiresAt).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
    return remaining;
  }, [expiresAt]);
  
  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Timer effect
  useEffect(() => {
    if (!expiresAt) return;
    
    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());
    
    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);
      
      // Show warning at 2 minutes
      if (remaining <= 120 && remaining > 0 && !showWarning) {
        setShowWarning(true);
        toast.warning('⚠️ Price lock expiring in 2 minutes! / मूल्य लॉक 2 मिनट में समाप्त हो रहा है!');
      }
      
      // Handle expiry
      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        clearInterval(interval);
        toast.error('❌ Price lock expired! / मूल्य लॉक समाप्त हो गया!');
        
        if (onExpire) {
          onExpire();
        }
        
        // Auto-redirect after 3 seconds
        if (redirectOnExpire) {
          setTimeout(() => {
            navigate(redirectOnExpire);
          }, 3000);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt, calculateTimeRemaining, isExpired, showWarning, onExpire, navigate, redirectOnExpire]);
  
  // Handle extend button click
  const handleExtend = async () => {
    if (!onExtend) return;
    
    setIsExtending(true);
    try {
      await onExtend();
      setShowWarning(false);
      setIsExpired(false);
      toast.success('✅ Price lock extended by 5 minutes! / मूल्य लॉक 5 मिनट बढ़ाया गया!');
    } catch (error) {
      toast.error('Failed to extend price lock');
    } finally {
      setIsExtending(false);
    }
  };
  
  // Get timer color based on remaining time
  const getTimerColor = () => {
    if (isExpired || timeRemaining <= 0) return 'text-red-500';
    if (timeRemaining <= 60) return 'text-red-400 animate-pulse';
    if (timeRemaining <= 120) return 'text-orange-400';
    return 'text-green-400';
  };
  
  // Get background color based on state
  const getBackgroundClass = () => {
    if (isExpired) return 'bg-red-500/10 border-red-500/50';
    if (timeRemaining <= 60) return 'bg-red-500/10 border-red-500/30 animate-pulse';
    if (timeRemaining <= 120) return 'bg-orange-500/10 border-orange-500/30';
    return 'bg-blue-500/10 border-blue-500/30';
  };

  if (!expiresAt) return null;

  return (
    <div className={`rounded-xl border p-4 ${getBackgroundClass()} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
            isExpired ? 'bg-red-500/20' : 'bg-blue-500/20'
          }`}>
            {isExpired ? (
              <AlertTriangle className="h-5 w-5 text-red-400" />
            ) : (
              <Lock className="h-5 w-5 text-blue-400" />
            )}
          </div>
          <div>
            <h4 className={`font-semibold ${isExpired ? 'text-red-400' : 'text-white'}`}>
              {isExpired ? 'Price Lock Expired' : 'Price Locked'}
            </h4>
            <p className="text-xs text-slate-400">
              {isExpired 
                ? 'मूल्य लॉक समाप्त हो गया' 
                : 'आपका मूल्य लॉक है'}
            </p>
          </div>
        </div>
        
        {/* Timer Display */}
        <div className="text-right">
          <div className={`text-3xl font-mono font-bold ${getTimerColor()}`}>
            {formatTime(timeRemaining)}
          </div>
          <p className="text-xs text-slate-400">
            {isExpired ? 'Expired' : 'Remaining / शेष समय'}
          </p>
        </div>
      </div>
      
      {/* Progress Bar */}
      {!isExpired && (
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              timeRemaining <= 60 ? 'bg-red-500' :
              timeRemaining <= 120 ? 'bg-orange-500' : 'bg-blue-500'
            }`}
            style={{ 
              width: `${Math.min(100, (timeRemaining / 900) * 100)}%` // 900 = 15 minutes
            }}
          />
        </div>
      )}
      
      {/* Locked Amount */}
      {totalAmount && (
        <div className="flex items-center justify-between py-2 border-t border-slate-700/50 mt-2">
          <span className="text-slate-400 text-sm">Locked Amount / लॉक्ड राशि</span>
          <span className="text-white font-bold text-lg">
            ₹{totalAmount.toLocaleString('en-IN')}
          </span>
        </div>
      )}
      
      {/* Warning Message */}
      {showWarning && !isExpired && (
        <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3 mt-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-orange-300 text-sm font-medium">
              Complete payment soon!
            </p>
            <p className="text-orange-400/70 text-xs">
              जल्द ही भुगतान पूरा करें! Price may change after expiry.
            </p>
          </div>
        </div>
      )}
      
      {/* Expired Message */}
      {isExpired && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mt-3">
          <p className="text-red-300 text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Price lock has expired. Redirecting to booking page...
          </p>
          <p className="text-red-400/70 text-xs mt-1">
            मूल्य लॉक समाप्त हो गया। बुकिंग पेज पर रीडायरेक्ट हो रहा है...
          </p>
        </div>
      )}
      
      {/* Extend Button */}
      {showExtendButton && !isExpired && timeRemaining <= 180 && onExtend && (
        <Button 
          onClick={handleExtend}
          disabled={isExtending}
          variant="outline"
          className="w-full mt-3 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
        >
          {isExtending ? (
            <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Extending...</>
          ) : (
            <><Clock className="h-4 w-4 mr-2" /> Extend by 5 min / 5 मिनट बढ़ाएं</>
          )}
        </Button>
      )}
      
      {/* Lock ID for reference */}
      {lockId && (
        <p className="text-xs text-slate-500 mt-2 text-center">
          Lock ID: {lockId.slice(0, 8)}...
        </p>
      )}
    </div>
  );
};

/**
 * Compact Price Lock Badge - for headers/navbars
 */
export const PriceLockBadge = ({ expiresAt, onClick }) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  useEffect(() => {
    if (!expiresAt) return;
    
    const update = () => {
      const expiry = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);
  
  if (!expiresAt || timeRemaining <= 0) return null;
  
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        timeRemaining <= 60 
          ? 'bg-red-500/20 text-red-400 animate-pulse' 
          : timeRemaining <= 120 
            ? 'bg-orange-500/20 text-orange-400'
            : 'bg-blue-500/20 text-blue-400'
      }`}
    >
      <Lock className="h-3.5 w-3.5" />
      <span className="font-mono">
        {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
      </span>
    </button>
  );
};

export default PriceLockTimer;
