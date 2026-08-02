import React from 'react';
import { AlertCircle, Clock, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/**
 * Cancellation Policy Tab Component
 * Handles cancellation slabs and refund configuration
 */
export const CancellationPolicyTab = ({ controls, setControls, updateCancellationSlab }) => {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          Cancellation Policy / रद्दीकरण नीति
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cancellation Slabs */}
        <div className="space-y-3">
          <h4 className="text-white font-medium">Cancellation Charges by Time</h4>
          <p className="text-slate-400 text-sm">
            Configure cancellation charges based on hours before departure
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(controls.cancellation_slabs || []).map((slab, index) => (
              <div 
                key={index} 
                className={`bg-slate-700/30 rounded-lg p-4 border-l-4 ${
                  slab.charge_percent >= 75 ? 'border-red-500' :
                  slab.charge_percent >= 50 ? 'border-orange-500' :
                  slab.charge_percent >= 25 ? 'border-yellow-500' :
                  'border-green-500'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="text-white font-medium">{slab.label}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-slate-400 text-xs">Hours Before</Label>
                    <Input
                      type="number"
                      value={slab.hours_before}
                      onChange={(e) => updateCancellationSlab(index, 'hours_before', e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Charge %</Label>
                    <Input
                      type="number"
                      value={slab.charge_percent}
                      onChange={(e) => updateCancellationSlab(index, 'charge_percent', e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
                <Badge 
                  className={`mt-2 ${
                    slab.charge_percent >= 75 ? 'bg-red-500/20 text-red-400' :
                    slab.charge_percent >= 50 ? 'bg-orange-500/20 text-orange-400' :
                    slab.charge_percent >= 25 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}
                >
                  {slab.charge_percent}% charge
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Weather Abort Refund */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-blue-400" />
            <h4 className="text-white font-medium">Weather/Force Majeure Refund</h4>
          </div>
          <p className="text-slate-400 text-sm mb-3">
            Refund percentage when flight is cancelled due to weather or safety concerns
          </p>
          <div className="flex items-center gap-4">
            <div className="w-32">
              <Label className="text-slate-400 text-sm">Refund %</Label>
              <Input
                type="number"
                value={controls.weather_abort_refund_percent}
                onChange={(e) => setControls(prev => ({ 
                  ...prev, 
                  weather_abort_refund_percent: parseFloat(e.target.value) || 90 
                }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div className="flex-1 text-slate-400 text-sm">
              Customer will receive {controls.weather_abort_refund_percent || 90}% refund 
              if flight is cancelled due to bad weather, DGCA restrictions, or force majeure events.
            </div>
          </div>
        </div>

        {/* Cancellation Policy Preview */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-blue-400 font-medium mb-3">Policy Preview / नीति पूर्वावलोकन</h4>
          <div className="space-y-2 text-sm">
            {(controls.cancellation_slabs || []).map((slab, index) => (
              <div key={index} className="flex justify-between text-slate-300">
                <span>{slab.label}</span>
                <span className="font-medium">
                  {slab.charge_percent === 100 
                    ? 'No refund' 
                    : `${100 - slab.charge_percent}% refund`}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-blue-300 pt-2 border-t border-blue-500/30">
              <span>Weather/Safety Cancellation</span>
              <span className="font-medium">{controls.weather_abort_refund_percent || 90}% refund</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CancellationPolicyTab;
