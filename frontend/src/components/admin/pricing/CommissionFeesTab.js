import React from 'react';
import { Percent, DollarSign } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Commission & Fees Tab Component
 * Handles platform commission, fees, and GST settings
 */
export const CommissionFeesTab = ({ controls, setControls }) => {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Percent className="h-5 w-5 text-green-500" />
          Commission & Platform Fees / कमीशन और प्लेटफॉर्म शुल्क
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Commission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300">Commission Type</Label>
            <select
              value={controls.commission_type}
              onChange={(e) => setControls(prev => ({ ...prev, commission_type: e.target.value }))}
              className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-2 mt-1"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>
          <div>
            <Label className="text-slate-300">
              Commission Value {controls.commission_type === 'percentage' ? '(%)' : '(₹)'}
            </Label>
            <Input
              type="number"
              value={controls.commission_value}
              onChange={(e) => setControls(prev => ({ ...prev, commission_value: parseFloat(e.target.value) || 0 }))}
              className="bg-slate-700 border-slate-600 text-white mt-1"
            />
          </div>
        </div>

        {/* Platform Fees */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4">Platform Fees / प्लेटफॉर्म शुल्क</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-slate-400 text-sm">Convenience Fee (%)</Label>
              <Input
                type="number"
                value={controls.convenience_fee_percent}
                onChange={(e) => setControls(prev => ({ ...prev, convenience_fee_percent: parseFloat(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Insurance (%)</Label>
              <Input
                type="number"
                value={controls.insurance_percent}
                onChange={(e) => setControls(prev => ({ ...prev, insurance_percent: parseFloat(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">Fuel Surcharge (%)</Label>
              <Input
                type="number"
                value={controls.fuel_surcharge_percent}
                onChange={(e) => setControls(prev => ({ ...prev, fuel_surcharge_percent: parseFloat(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Checkbox
                checked={controls.fuel_surcharge_enabled}
                onCheckedChange={(checked) => setControls(prev => ({ ...prev, fuel_surcharge_enabled: checked }))}
              />
              <Label className="text-slate-400 text-sm">Enable Fuel Surcharge</Label>
            </div>
          </div>
        </div>

        {/* GST Settings */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4">GST Configuration / जीएसटी विन्यास</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-slate-400 text-sm">GST (%)</Label>
              <Input
                type="number"
                value={controls.gst_percent}
                onChange={(e) => setControls(prev => ({ ...prev, gst_percent: parseFloat(e.target.value) || 18 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">CGST (%)</Label>
              <Input
                type="number"
                value={controls.cgst_percent}
                onChange={(e) => setControls(prev => ({ ...prev, cgst_percent: parseFloat(e.target.value) || 9 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">SGST (%)</Label>
              <Input
                type="number"
                value={controls.sgst_percent}
                onChange={(e) => setControls(prev => ({ ...prev, sgst_percent: parseFloat(e.target.value) || 9 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-sm">IGST (%) - Interstate</Label>
              <Input
                type="number"
                value={controls.igst_percent}
                onChange={(e) => setControls(prev => ({ ...prev, igst_percent: parseFloat(e.target.value) || 18 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommissionFeesTab;
