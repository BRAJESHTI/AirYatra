import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Eye, Edit, Trash2, Copy, ExternalLink, Download, Mail, Share2 } from 'lucide-react';

// Context Menu Component
export const ContextMenu = ({ 
  actions = [], 
  children, 
  position = 'left',
  triggerClassName = '',
  size = 'default' // 'small' | 'default'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          triggerRef.current && !triggerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleAction = (action) => {
    action.onClick?.();
    setIsOpen(false);
  };

  const positionClasses = {
    left: 'right-0',
    right: 'left-0',
    center: 'left-1/2 -translate-x-1/2'
  };

  const sizeClasses = {
    small: 'p-1',
    default: 'p-1.5'
  };

  return (
    <div className="relative inline-block" data-testid="context-menu">
      {/* Trigger - Either custom children or default three-dot button */}
      <div ref={triggerRef}>
        {children ? (
          <div onClick={() => setIsOpen(!isOpen)}>{children}</div>
        ) : (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`${sizeClasses[size]} text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all ${triggerClassName}`}
            data-testid="context-menu-trigger"
          >
            <MoreVertical className={size === 'small' ? 'h-4 w-4' : 'h-5 w-5'} />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className={`absolute z-50 mt-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden ${positionClasses[position]}`}
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <div className="py-1">
            {actions.map((action, index) => {
              if (action.divider) {
                return <div key={index} className="my-1 border-t border-slate-700" />;
              }

              const Icon = action.icon;
              const colorClass = action.danger 
                ? 'text-red-400 hover:bg-red-500/20' 
                : action.warning
                  ? 'text-yellow-400 hover:bg-yellow-500/20'
                  : action.success
                    ? 'text-green-400 hover:bg-green-500/20'
                    : 'text-slate-300 hover:bg-slate-700';

              return (
                <button
                  key={action.id || index}
                  onClick={() => handleAction(action)}
                  disabled={action.disabled}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${colorClass} ${
                    action.disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  data-testid={`context-menu-${action.id || action.label?.toLowerCase().replace(/\s/g, '-')}`}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{action.label}</span>
                  {action.shortcut && (
                    <span className="ml-auto text-xs text-slate-500">{action.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Animation styles are handled by Tailwind animate classes */}
    </div>
  );
};

// Preset action factories for common operations
export const createViewAction = (onClick) => ({
  id: 'view',
  label: 'View Details',
  icon: Eye,
  onClick
});

export const createEditAction = (onClick) => ({
  id: 'edit',
  label: 'Edit',
  icon: Edit,
  onClick
});

export const createDeleteAction = (onClick) => ({
  id: 'delete',
  label: 'Delete',
  icon: Trash2,
  danger: true,
  onClick
});

export const createCopyIdAction = (id, toast) => ({
  id: 'copy-id',
  label: 'Copy ID',
  icon: Copy,
  onClick: () => {
    navigator.clipboard.writeText(id);
    toast?.success('ID copied to clipboard');
  }
});

export const createOpenLinkAction = (url, label = 'Open Link') => ({
  id: 'open-link',
  label,
  icon: ExternalLink,
  onClick: () => window.open(url, '_blank')
});

export const createDownloadAction = (onClick) => ({
  id: 'download',
  label: 'Download',
  icon: Download,
  onClick
});

export const createEmailAction = (onClick) => ({
  id: 'email',
  label: 'Send Email',
  icon: Mail,
  onClick
});

export const createShareAction = (onClick) => ({
  id: 'share',
  label: 'Share',
  icon: Share2,
  onClick
});

export const createDivider = () => ({ divider: true });

// Example usage helper - creates common table row actions
export const createTableRowActions = ({ 
  onView, 
  onEdit, 
  onDelete, 
  onCopyId, 
  id,
  toast,
  extraActions = []
}) => {
  const actions = [];
  
  if (onView) actions.push(createViewAction(onView));
  if (onEdit) actions.push(createEditAction(onEdit));
  if (onCopyId || id) {
    actions.push(createCopyIdAction(id, toast));
  }
  
  if (extraActions.length > 0) {
    actions.push(createDivider());
    actions.push(...extraActions);
  }
  
  if (onDelete) {
    actions.push(createDivider());
    actions.push(createDeleteAction(onDelete));
  }
  
  return actions;
};

export default ContextMenu;
