import React, { useState, useEffect, useRef } from 'react';

/**
 * Optimized Image Component with Lazy Loading
 * - Uses Intersection Observer for viewport detection
 * - Supports blur placeholder
 * - Handles loading states
 */
export function LazyImage({ 
  src, 
  alt, 
  className = '', 
  placeholder = null,
  ...props 
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {/* Placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-700 animate-pulse rounded" />
      )}
      
      {/* Actual image */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          {...props}
        />
      )}
    </div>
  );
}

/**
 * Optimized Avatar Component
 */
export function Avatar({ 
  src, 
  name = '', 
  size = 'md',
  className = '' 
}) {
  const [error, setError] = useState(false);
  
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (error || !src) {
    return (
      <div 
        className={`${sizes[size]} rounded-full bg-orange-500 flex items-center justify-center text-white font-medium ${className}`}
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setError(true)}
      className={`${sizes[size]} rounded-full object-cover ${className}`}
    />
  );
}

/**
 * Skeleton Loader Component
 */
export function Skeleton({ className = '', variant = 'rect' }) {
  const variants = {
    rect: 'rounded',
    circle: 'rounded-full',
    text: 'rounded h-4'
  };

  return (
    <div 
      className={`bg-slate-700 animate-pulse ${variants[variant]} ${className}`}
    />
  );
}

/**
 * Virtual List Component for large lists
 * Only renders visible items
 */
export function VirtualList({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className = ''
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: containerHeight, overflow: 'auto' }}
      className={className}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LazyImage;
