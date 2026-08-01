import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Menu, X, ChevronDown } from 'lucide-react';

/**
 * useResponsiveSidebar - Hook for responsive sidebar behavior
 * Returns state and handlers for mobile/tablet/desktop responsiveness
 */
export const useResponsiveSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      
      // Auto-collapse on tablet, hidden on mobile
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

  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);
  const closeMobile = () => setIsMobileOpen(false);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  
  // Effective collapsed state (collapsed but not hovered)
  const effectiveCollapsed = isCollapsed && !isHovered;

  return {
    isCollapsed,
    isMobileOpen,
    isHovered,
    isMobile,
    isTablet,
    effectiveCollapsed,
    setIsHovered,
    toggleMobile,
    closeMobile,
    toggleCollapse
  };
};

/**
 * MobileMenuButton - Hamburger menu for mobile
 */
export const MobileMenuButton = ({ onClick, isOpen, className = '' }) => (
  <button
    onClick={onClick}
    className={`lg:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors ${className}`}
    aria-label="Toggle menu"
  >
    {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
  </button>
);

/**
 * SidebarToggleButton - Collapse/Expand button for desktop
 */
export const SidebarToggleButton = ({ isCollapsed, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`hidden lg:flex items-center justify-center w-6 h-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 hover:text-white transition-all absolute -right-3 top-6 z-10 ${className}`}
    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
  </button>
);

/**
 * ResponsiveSidebar - Wrapper component for responsive sidebar
 */
export const ResponsiveSidebar = ({ 
  children, 
  isCollapsed,
  isMobileOpen,
  isHovered,
  setIsHovered,
  closeMobile,
  toggleCollapse,
  className = ''
}) => {
  const effectiveCollapsed = isCollapsed && !isHovered;
  
  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}
      
      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          bg-slate-900/50 border-r border-slate-800 overflow-y-auto overflow-x-hidden
          transition-all duration-300 ease-in-out relative
          
          /* Width based on collapsed state */
          ${effectiveCollapsed ? 'w-16' : 'w-72'}
          
          /* Mobile: Fixed position, slides in */
          fixed lg:sticky z-50 lg:z-auto
          top-0 lg:top-[73px]
          h-screen lg:h-[calc(100vh-73px)]
          ${isMobileOpen ? 'left-0' : '-left-72 lg:left-0'}
          
          ${className}
        `}
      >
        {/* Mobile Close Button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800">
          <span className="text-white font-semibold">Menu</span>
          <button 
            onClick={closeMobile} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Desktop Toggle Button */}
        <SidebarToggleButton 
          isCollapsed={isCollapsed} 
          onClick={toggleCollapse}
        />
        
        {/* Sidebar Content */}
        <nav className={`p-3 space-y-1 ${effectiveCollapsed ? 'px-2' : ''}`}>
          {children}
        </nav>
      </aside>
    </>
  );
};

/**
 * CollapsibleNavGroup - Navigation group that collapses
 */
export const CollapsibleNavGroup = ({
  icon: GroupIcon,
  label,
  isExpanded,
  onToggle,
  isActive,
  hasHighlight,
  isCollapsed,
  children
}) => {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        title={isCollapsed ? label : undefined}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
          isActive
            ? 'bg-orange-500/20 text-orange-400'
            : hasHighlight
              ? 'text-slate-200 hover:bg-slate-800'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-3">
          <GroupIcon className={`h-5 w-5 shrink-0 ${isActive ? 'text-orange-400' : ''}`} />
          {!isCollapsed && <span className="font-medium text-sm truncate">{label}</span>}
        </div>
        {!isCollapsed && (
          isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </button>
      
      {/* Expanded Items */}
      {isExpanded && !isCollapsed && (
        <div className="mt-1 ml-4 space-y-0.5 border-l border-slate-700 pl-3">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * NavItem - Single navigation item
 */
export const NavItem = ({
  icon: ItemIcon,
  label,
  isActive,
  highlight,
  onClick,
  isCollapsed,
  testId
}) => {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      title={isCollapsed ? label : undefined}
      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg transition-all text-sm ${
        isActive
          ? 'bg-orange-500 text-white'
          : highlight
            ? 'text-yellow-400 hover:bg-yellow-500/20'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <ItemIcon className="h-4 w-4 shrink-0" />
      {!isCollapsed && (
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

export default {
  useResponsiveSidebar,
  MobileMenuButton,
  SidebarToggleButton,
  ResponsiveSidebar,
  CollapsibleNavGroup,
  NavItem
};
