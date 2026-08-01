import React, { useState, useEffect } from 'react';
import { Keyboard, X, Search, ArrowUp, ArrowDown, CornerDownLeft, Command } from 'lucide-react';

// KeyBadge component for displaying keyboard keys
const KeyBadge = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-200">
    {children}
  </kbd>
);

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: ['Ctrl/⌘', 'K'], description: 'Open Global Search' },
      { keys: ['Esc'], description: 'Close dialogs / Go back' },
      { keys: ['↑', '↓'], description: 'Navigate in lists' },
      { keys: ['Enter'], description: 'Select item' },
    ]
  },
  {
    category: 'Quick Actions',
    items: [
      { keys: ['?'], description: 'Open this help panel' },
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'B'], description: 'Go to Bookings' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ]
  },
  {
    category: 'Tables & Lists',
    items: [
      { keys: ['J'], description: 'Move down in list' },
      { keys: ['K'], description: 'Move up in list' },
      { keys: ['X'], description: 'Select/Deselect item' },
      { keys: ['Delete'], description: 'Delete selected' },
    ]
  }
];

function KeyboardShortcutsPanel() {
  const [isOpen, setIsOpen] = useState(false);

  // Listen for ? key to open
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Open with ? key (Shift + /)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        setIsOpen(true);
      }
      
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Keyboard className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
              <p className="text-sm text-slate-400">Navigate faster with these shortcuts</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-medium text-orange-400 uppercase tracking-wider mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((shortcut, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                    >
                      <span className="text-sm text-slate-300">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            <KeyBadge>{key}</KeyBadge>
                            {keyIdx < shortcut.keys.length - 1 && (
                              <span className="text-slate-500 text-xs">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pro Tips */}
          <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
            <h4 className="text-sm font-medium text-orange-400 mb-2">Pro Tips</h4>
            <ul className="text-sm text-slate-300 space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-orange-400 rounded-full" />
                Press <KeyBadge>?</KeyBadge> anytime to open this panel
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-orange-400 rounded-full" />
                Use <KeyBadge>Ctrl</KeyBadge> + <KeyBadge>K</KeyBadge> for quick search
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-orange-400 rounded-full" />
                Shortcuts work everywhere except input fields
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/30 flex items-center justify-between">
          <span className="text-xs text-slate-500">Press <KeyBadge>Esc</KeyBadge> to close</span>
          <span className="text-xs text-slate-500">AirYatra Keyboard Shortcuts v1.0</span>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsPanel;
