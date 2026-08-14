import React, { useState } from 'react';
import { Scale, X, ChevronUp, ChevronDown, Plane, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * Floating Compare Widget for Aircraft Catalog
 * Shows selected aircraft for comparison with quick actions
 */
const CompareWidget = ({ 
  selectedAircraft = [], 
  onRemove, 
  onCompare, 
  onClear,
  maxCompare = 3 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (selectedAircraft.length === 0) return null;
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 w-80 bg-slate-900 border border-orange-500/50 rounded-xl shadow-2xl shadow-orange-500/20"
      data-testid="compare-widget"
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 border-b border-slate-700 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Scale className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm">Compare Aircraft</h4>
            <p className="text-slate-400 text-xs">
              {selectedAircraft.length}/{maxCompare} selected
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          )}
        </Button>
      </div>
      
      {/* Body */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Selected Aircraft List */}
          <div className="space-y-2">
            {selectedAircraft.map((aircraft, idx) => (
              <div 
                key={aircraft.id}
                className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-slate-700 rounded flex items-center justify-center">
                    <Plane className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[150px]">
                      {aircraft.basic_info?.manufacturer} {aircraft.basic_info?.model}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {aircraft.basic_info?.registration_number}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-slate-400 hover:text-red-400"
                  onClick={() => onRemove(aircraft.id)}
                  data-testid={`remove-compare-${idx}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          {/* Empty Slots */}
          {selectedAircraft.length < maxCompare && (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: maxCompare - selectedAircraft.length }).map((_, idx) => (
                <div 
                  key={idx}
                  className="h-8 w-16 border-2 border-dashed border-slate-700 rounded flex items-center justify-center"
                >
                  <span className="text-slate-500 text-xs">+</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-700">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-slate-400"
              onClick={onClear}
            >
              Clear All
            </Button>
            <Button 
              size="sm" 
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={onCompare}
              disabled={selectedAircraft.length < 2}
              data-testid="start-compare-btn"
            >
              Compare <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {selectedAircraft.length < 2 && (
            <p className="text-slate-500 text-xs text-center">
              Select at least 2 aircraft to compare
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compare Button for Aircraft Card
 * Add to each aircraft card in catalog
 */
export const CompareButton = ({ 
  aircraft, 
  isSelected, 
  onToggle,
  disabled = false 
}) => {
  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={() => onToggle(aircraft)}
      disabled={disabled}
      className={`${
        isSelected 
          ? 'bg-orange-500 hover:bg-orange-600 text-white' 
          : 'border-orange-500/50 text-orange-400 hover:bg-orange-500/10'
      }`}
      data-testid={`compare-btn-${aircraft.id}`}
    >
      <Scale className="h-4 w-4 mr-1" />
      {isSelected ? 'Selected' : 'Compare'}
    </Button>
  );
};

/**
 * Hook to manage compare state
 */
export const useCompareAircraft = (maxCompare = 3) => {
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  
  const toggleAircraft = (aircraft) => {
    setSelectedForCompare(prev => {
      const isSelected = prev.some(a => a.id === aircraft.id);
      
      if (isSelected) {
        return prev.filter(a => a.id !== aircraft.id);
      }
      
      if (prev.length >= maxCompare) {
        toast.warning(`You can compare a maximum of ${maxCompare} aircraft`);
        return prev;
      }
      
      toast.success(`${aircraft.basic_info?.model || 'Aircraft'} added to compare`);
      return [...prev, aircraft];
    });
  };
  
  const removeAircraft = (aircraftId) => {
    setSelectedForCompare(prev => prev.filter(a => a.id !== aircraftId));
  };
  
  const clearAll = () => {
    setSelectedForCompare([]);
  };
  
  const isSelected = (aircraftId) => {
    return selectedForCompare.some(a => a.id === aircraftId);
  };
  
  return {
    selectedForCompare,
    toggleAircraft,
    removeAircraft,
    clearAll,
    isSelected
  };
};

export default CompareWidget;
