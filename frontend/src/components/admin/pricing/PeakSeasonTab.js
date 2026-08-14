import React from 'react';
import { TrendingUp, Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Peak Season Tab Component
 * Handles peak season surge pricing configuration
 */
export const PeakSeasonTab = ({ 
  controls, 
  setControls, 
  addPeakDate, 
  updatePeakDate, 
  removePeakDate 
}) => {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-yellow-500" />
          Peak Season Surge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={controls.peak_season_enabled}
            onCheckedChange={(checked) => setControls(prev => ({ ...prev, peak_season_enabled: checked }))}
          />
          <Label className="text-slate-300">Enable Peak Season Pricing</Label>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Label className="text-slate-400 text-sm">Default Surge Multiplier:</Label>
            <Input
              type="number"
              step="0.1"
              value={controls.peak_surge_multiplier}
              onChange={(e) => setControls(prev => ({ ...prev, peak_surge_multiplier: parseFloat(e.target.value) || 1.3 }))}
              className="bg-slate-700 border-slate-600 text-white w-20"
            />
          </div>
        </div>

        {/* Peak Dates List */}
        <div className="space-y-3">
          {(controls.peak_dates || []).map((peak, index) => (
            <div key={index} className="bg-slate-700/30 rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <Label className="text-slate-400 text-sm">Label</Label>
                <Input
                  type="text"
                  value={peak.label || ''}
                  onChange={(e) => updatePeakDate(index, 'label', e.target.value)}
                  placeholder="e.g., Diwali"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Start Date</Label>
                <Input
                  type="date"
                  value={peak.start || ''}
                  onChange={(e) => updatePeakDate(index, 'start', e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">End Date</Label>
                <Input
                  type="date"
                  value={peak.end || ''}
                  onChange={(e) => updatePeakDate(index, 'end', e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={peak.multiplier || 1.3}
                  onChange={(e) => updatePeakDate(index, 'multiplier', parseFloat(e.target.value))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => removePeakDate(index)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={addPeakDate} variant="outline" className="border-slate-600 text-slate-300">
          <Plus className="h-4 w-4 mr-2" />
          Add Peak Period
        </Button>

        {/* Quick Add Common Peaks */}
        <div className="bg-slate-700/20 rounded-lg p-4">
          <h4 className="text-white text-sm font-medium mb-3">Quick Add Common Peak Periods</h4>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Diwali', months: '10-11' },
              { label: 'Holi', months: '03' },
              { label: 'Christmas/NY', months: '12' },
              { label: 'Navratri', months: '09-10' },
              { label: 'Summer (May-Jun)', months: '05-06' }
            ].map(period => (
              <Button
                key={period.label}
                variant="outline"
                size="sm"
                className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => {
                  const year = new Date().getFullYear();
                  const newPeak = {
                    label: period.label,
                    start: `${year}-${period.months.split('-')[0]}-01`,
                    end: `${year}-${period.months.split('-').pop()}-30`,
                    multiplier: 1.3
                  };
                  setControls(prev => ({
                    ...prev,
                    peak_dates: [...(prev.peak_dates || []), newPeak]
                  }));
                }}
              >
                + {period.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PeakSeasonTab;
