import React, { useState, useEffect, createContext, useContext } from 'react';
import { ChevronLeft, ChevronRight, Menu, X, ChevronDown } from 'lucide-react';

// Sidebar Context for global state
const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      // Mobile: < 768px - sidebar hidden by default
      // Tablet: 768-1024px - sidebar collapsed
      // Desktop: > 1024px - sidebar expanded
      if (width < 768) {
        setIsCollapsed(true);
        setIsMobileOpen(false);
      } else if (width < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);
  const closeMobile = () => setIsMobileOpen(false);
  
  // Effective width based on state
  const effectiveCollapsed = isCollapsed && !isHovered;
  
  return (
    <SidebarContext.Provider value={{
      isCollapsed,
      isMobileOpen,
      isHovered,
      effectiveCollapsed,
      setIsCollapsed,
      setIsMobileOpen,
      setIsHovered,
      toggleCollapse,
      toggleMobile,
      closeMobile
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

// Mobile Menu Toggle Button (hamburger)
export const MobileMenuButton = ({ className = '' }) => {
  const { isMobileOpen, toggleMobile } = useSidebar();
  
  return (
    <button
      onClick={toggleMobile}
      className={`lg:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ${className}`}
      aria-label="Toggle menu"
    >
      {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
};

// Sidebar Collapse Toggle Button
export const SidebarToggle = ({ className = '' }) => {
  const { isCollapsed, toggleCollapse } = useSidebar();
  
  return (
    <button
      onClick={toggleCollapse}
      className={`hidden md:flex items-center justify-center p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all ${className}`}
      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </button>
  );
};

// Main Sidebar Container
export const Sidebar = ({ 
  children, 
  className = '',
  collapsedWidth = 'w-16',
  expandedWidth = 'w-72',
  topOffset = '73px' // For sticky nav height
}) => {
  const { effectiveCollapsed, isMobileOpen, setIsHovered, closeMobile } = useSidebar();
  
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={closeMobile}
        />
      )}
      
      {/* Sidebar */}
      <aside
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        className={`
          bg-slate-900/50 border-r border-slate-800 overflow-y-auto overflow-x-hidden
          transition-all duration-300 ease-in-out
          ${effectiveCollapsed ? collapsedWidth : expandedWidth}
          
          /* Mobile: Fixed, slides in from left */
          fixed lg:sticky z-50 lg:z-auto
          top-0 lg:top-[${topOffset}]
          h-full lg:h-[calc(100vh-${topOffset})]
          ${isMobileOpen ? 'left-0' : '-left-full lg:left-0'}
          
          ${className}
        `}
        style={{
          top: isMobile ? 0 : topOffset,
          height: isMobile ? '100vh' : `calc(100vh - ${topOffset})`
        }}
      >
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800">
          <span className="text-white font-semibold">Menu</span>
          <button onClick={closeMobile} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Sidebar Content */}
        <div className="p-3 space-y-1">
          {children}
        </div>
        
        {/* Collapse Toggle at Bottom (Desktop only) */}
        <div className="hidden lg:block absolute bottom-4 left-0 right-0 px-3">
          <SidebarToggle className="w-full justify-center" />
        </div>
      </aside>
    </>
  );
};

// Sidebar Navigation Group
export const SidebarGroup = ({ 
  icon: GroupIcon, 
  label, 
  isExpanded, 
  onToggle, 
  isActive,
  hasHighlight,
  children 
}) => {
  const { effectiveCollapsed } = useSidebar();
  
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
          isActive
            ? 'bg-orange-500/20 text-orange-400'
            : hasHighlight
              ? 'text-slate-200 hover:bg-slate-800'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
        title={effectiveCollapsed ? label : undefined}
      >
        <div className="flex items-center space-x-3">
          <GroupIcon className={`h-5 w-5 shrink-0 ${isActive ? 'text-orange-400' : ''}`} />
          {!effectiveCollapsed && (
            <span className="font-medium text-sm truncate">{label}</span>
          )}
        </div>
        {!effectiveCollapsed && (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )
        )}
      </button>
      
      {/* Group Items */}
      {isExpanded && !effectiveCollapsed && (
        <div className="mt-1 ml-4 space-y-0.5 border-l border-slate-700 pl-3">
          {children}
        </div>
      )}
      
      {/* Collapsed: Show items in tooltip/popover on hover */}
      {effectiveCollapsed && isExpanded && (
        <div className="absolute left-full ml-2 top-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-[200px] py-2">
          <div className="px-3 py-2 border-b border-slate-700 text-white font-medium text-sm">
            {label}
          </div>
          <div className="py-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

// Sidebar Navigation Item
export const SidebarItem = ({ 
  icon: ItemIcon, 
  label, 
  isActive, 
  highlight, 
  onClick,
  testId
}) => {
  const { effectiveCollapsed, closeMobile } = useSidebar();
  
  const handleClick = () => {
    onClick?.();
    // Close mobile sidebar on item click
    if (window.innerWidth < 768) {
      closeMobile();
    }
  };
  
  return (
    <button
      onClick={handleClick}
      data-testid={testId}
      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
        isActive
          ? 'bg-orange-500 text-white'
          : highlight
            ? 'text-yellow-400 hover:bg-yellow-500/20'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
      title={effectiveCollapsed ? label : undefined}
    >
      <ItemIcon className="h-4 w-4 shrink-0" />
      {!effectiveCollapsed && (
        <>
          <span className="truncate">{label}</span>
          {highlight && !isActive && (
            <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full shrink-0" />
          )}
        </>
      )}
    </button>
  );
};

export default Sidebar;
