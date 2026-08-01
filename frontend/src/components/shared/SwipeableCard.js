import React, { useState, useRef, useCallback } from 'react';

/**
 * SwipeableCard - Swipe left to reveal action buttons
 * 
 * Usage:
 * <SwipeableCard
 *   actions={[
 *     { id: 'edit', icon: Edit, color: 'bg-blue-500', onClick: () => {} },
 *     { id: 'delete', icon: Trash2, color: 'bg-red-500', onClick: () => {} }
 *   ]}
 * >
 *   <YourContent />
 * </SwipeableCard>
 */
function SwipeableCard({ 
  children, 
  actions = [], 
  threshold = 80,
  className = ''
}) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const containerRef = useRef(null);

  const actionWidth = actions.length * 60; // 60px per action button

  const handleTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX;
    currentX.current = translateX;
    setIsDragging(true);
  }, [translateX]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    
    const diff = startX.current - e.touches[0].clientX;
    let newTranslateX = currentX.current - diff;
    
    // Limit swipe range
    newTranslateX = Math.max(-actionWidth, Math.min(0, newTranslateX));
    
    setTranslateX(newTranslateX);
  }, [isDragging, actionWidth]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    // Snap to revealed or hidden state
    if (translateX < -threshold) {
      setTranslateX(-actionWidth);
      setIsRevealed(true);
    } else {
      setTranslateX(0);
      setIsRevealed(false);
    }
  }, [translateX, threshold, actionWidth]);

  const handleMouseDown = useCallback((e) => {
    startX.current = e.clientX;
    currentX.current = translateX;
    setIsDragging(true);
    
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const diff = startX.current - e.clientX;
      let newTranslateX = currentX.current - diff;
      newTranslateX = Math.max(-actionWidth, Math.min(0, newTranslateX));
      setTranslateX(newTranslateX);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      if (translateX < -threshold) {
        setTranslateX(-actionWidth);
        setIsRevealed(true);
      } else {
        setTranslateX(0);
        setIsRevealed(false);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [translateX, threshold, actionWidth, isDragging]);

  const closeActions = () => {
    setTranslateX(0);
    setIsRevealed(false);
  };

  const handleActionClick = (action) => {
    action.onClick?.();
    closeActions();
  };

  // Click outside to close
  const handleContentClick = () => {
    if (isRevealed) {
      closeActions();
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Action Buttons (behind content) */}
      <div 
        className="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: actionWidth }}
      >
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={`w-[60px] flex items-center justify-center transition-transform ${action.color || 'bg-slate-600'}`}
              style={{
                transform: `translateX(${Math.min(0, translateX + actionWidth)}px)`,
                transitionDuration: isDragging ? '0ms' : '200ms'
              }}
            >
              <Icon className="h-5 w-5 text-white" />
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleContentClick}
        className="relative bg-slate-800 cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {children}
      </div>

      {/* Swipe hint indicator */}
      {!isRevealed && translateX === 0 && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none sm:hidden">
          <div className="flex items-center gap-1 text-xs">
            <span>←</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SwipeableCard;
