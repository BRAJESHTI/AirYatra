import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Edit, Trash2, Building2, Plane, MapPin, 
  Calculator, Loader2, Check, Percent
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { landingAPI } from '@/services/api';
import { toast } from 'sonner';

const rentTypeLabels = {
  per_landing: 'Per Landing',
  per_hour: 'Per Hour',
  per_day: 'Per Day',
  fixed: 'Fixed Rate'
};

function LandingRentConfig() {
  const [landingPoints, setLandingPoints] = useState([]);
  const [rentConfigs, setRentConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    landing_point_id: '',
    rent_type: 'per_landing',
    base_rent_amount: '',
    max_hours: '2',
    parking_charge_per_hour: '',
    overnight_charge: '',
    gst_applicable: true,
    gst_percentage: '18',
    helicopter_rate: '',
    fixed_wing_rate: '',
    peak_hours_multiplier: '1.0',
    weekend_multiplier: '1.0',
    notes: ''
  });

  // Calculator state
  const [calcForm, setCalcForm] = useState({
    landing_point_id: '',
    landing_date: '',
    duration_hours: '1',
    aircraft_type: 'helicopter'
  });
  const [calcResult, setCalcResult] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get all landing points that can have rent
      const response = await landingAPI.getLandingPoints({ limit: 200 });
      const points = (response.data.landing_points || []).filter(p => p.rent_applicable);
      setLandingPoints(points);
      
      // Load rent configs for each point
      const configs = [];
      for (const point of points.slice(0, 20)) { // Limit to first 20 for performance
        try {
          const rentResponse = await landingAPI.getRentConfig(point.id);
          if (rentResponse.data && rentResponse.data.id) {
            configs.push({
              ...rentResponse.data,
              landing_point: point
            });
          }
        } catch (e) {
          // No config for this point
        }
      }
      setRentConfigs(configs);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.landing_point_id || !formData.base_rent_amount) {
        toast.error('Please fill required fields');
        return;
      }

      const data = {
        landing_point_id: formData.landing_point_id,
        rent_type: formData.rent_type,
        base_rent_amount: parseFloat(formData.base_rent_amount),
        max_hours: parseInt(formData.max_hours) || 2,
        parking_charge_per_hour: parseFloat(formData.parking_charge_per_hour) || 0,
        overnight_charge: parseFloat(formData.overnight_charge) || 0,
        gst_applicable: formData.gst_applicable,
        gst_percentage: parseFloat(formData.gst_percentage) || 18,
        helicopter_rate: formData.helicopter_rate ? parseFloat(formData.helicopter_rate) : null,
        fixed_wing_rate: formData.fixed_wing_rate ? parseFloat(formData.fixed_wing_rate) : null,
        peak_hours_multiplier: parseFloat(formData.peak_hours_multiplier) || 1.0,
        weekend_multiplier: parseFloat(formData.weekend_multiplier) || 1.0,
        notes: formData.notes
      };

      await landingAPI.createRentConfig(data);
      toast.success('Rent configuration saved');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save rent config');
    }
  };

  const handleCalculate = async () => {
    try {
      if (!calcForm.landing_point_id || !calcForm.landing_date) {
        toast.error('Please select landing point and date');
        return;
      }

      const response = await landingAPI.calculateRent({
        landing_point_id: calcForm.landing_point_id,
        landing_date: calcForm.landing_date,
        duration_hours: parseFloat(calcForm.duration_hours) || 1,
        aircraft_type: calcForm.aircraft_type
      });
      
      setCalcResult(response.data);
    } catch (error) {
      toast.error('Failed to calculate rent');
    }
  };

  const openConfigModal = (point) => {
    setSelectedPoint(point);
    const existingConfig = rentConfigs.find(c => c.landing_point?.id === point.id);
    
    if (existingConfig) {
      setFormData({
        landing_point_id: point.id,
        rent_type: existingConfig.rent_type || 'per_landing',
        base_rent_amount: existingConfig.base_rent_amount?.toString() || '',
        max_hours: existingConfig.max_hours?.toString() || '2',
        parking_charge_per_hour: existingConfig.parking_charge_per_hour?.toString() || '',
        overnight_charge: existingConfig.overnight_charge?.toString() || '',
        gst_applicable: existingConfig.gst_applicable ?? true,
        gst_percentage: existingConfig.gst_percentage?.toString() || '18',
        helicopter_rate: existingConfig.helicopter_rate?.toString() || '',
        fixed_wing_rate: existingConfig.fixed_wing_rate?.toString() || '',
        peak_hours_multiplier: existingConfig.peak_hours_multiplier?.toString() || '1.0',
        weekend_multiplier: existingConfig.weekend_multiplier?.toString() || '1.0',
        notes: existingConfig.notes || ''
      });
    } else {
      setFormData({
        ...formData,
        landing_point_id: point.id
      });
    }
    
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      landing_point_id: '',
      rent_type: 'per_landing',
      base_rent_amount: '',
      max_hours: '2',
      parking_charge_per_hour: '',
      overnight_charge: '',
      gst_applicable: true,
      gst_percentage: '18',
      helicopter_rate: '',
      fixed_wing_rate: '',
      peak_hours_multiplier: '1.0',
      weekend_multiplier: '1.0',
      notes: ''
    });
    setSelectedPoint(null);
  };

  const getTypeIcon = (type) => {
    if (type === 'airport') return <Plane className="h-4 w-4" />;
    return <Building2 className="h-4 w-4" />;
  };

  const pointsWithoutConfig = landingPoints.filter(
    p => !rentConfigs.some(c => c.landing_point?.id === p.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Landing Rent Configuration</h2>
          <p className="text-slate-400">Configure rent for airports and helipads</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCalculator(true)} variant="outline" className="border-slate-600">
            <Calculator className="h-4 w-4 mr-2" /> Rent Calculator
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Check className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{rentConfigs.length}</p>
              <p className="text-sm text-slate-400">Configured</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pointsWithoutConfig.length}</p>
              <p className="text-sm text-slate-400">Pending Config</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <MapPin className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{landingPoints.length}</p>
              <p className="text-sm text-slate-400">Total Rent Points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configured Rents Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">Configured Landing Rents</h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-4 text-slate-400 font-medium">Landing Point</th>
                <th className="text-left p-4 text-slate-400 font-medium">Rent Type</th>
                <th className="text-left p-4 text-slate-400 font-medium">Base Rent</th>
                <th className="text-left p-4 text-slate-400 font-medium">GST</th>
                <th className="text-left p-4 text-slate-400 font-medium">Parking</th>
                <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rentConfigs.map((config) => (
                <tr key={config.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        {getTypeIcon(config.landing_point?.type)}
                      </div>
                      <div>
                        <p className="text-white font-medium">{config.landing_point?.name}</p>
                        <p className="text-sm text-slate-400">{config.landing_point?.city}, {config.landing_point?.state}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">
                      {rentTypeLabels[config.rent_type]}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-white font-semibold">₹{config.base_rent_amount?.toLocaleString()}</p>
                    {config.helicopter_rate && config.helicopter_rate !== config.base_rent_amount && (
                      <p className="text-xs text-slate-400">Heli: ₹{config.helicopter_rate?.toLocaleString()}</p>
                    )}
                  </td>
                  <td className="p-4">
                    {config.gst_applicable ? (
                      <span className="text-green-400">{config.gst_percentage}%</span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="p-4">
                    <p className="text-white">₹{config.parking_charge_per_hour?.toLocaleString()}/hr</p>
                    <p className="text-xs text-slate-400">Max {config.max_hours} hrs free</p>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openConfigModal(config.landing_point)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Configuration */}
      {pointsWithoutConfig.length > 0 && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Pending Rent Configuration</h3>
            <p className="text-sm text-slate-400">These landing points need rent configuration</p>
          </div>
          
          <div className="p-4 grid grid-cols-2 gap-4">
            {pointsWithoutConfig.slice(0, 10).map((point) => (
              <div 
                key={point.id} 
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 cursor-pointer"
                onClick={() => openConfigModal(point)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    {getTypeIcon(point.type)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{point.name}</p>
                    <p className="text-sm text-slate-400">{point.city}, {point.state}</p>
                  </div>
                </div>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-1" /> Configure
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Config Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Configure Rent - {selectedPoint?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Set rent structure for this landing point
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Rent */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Rent Type *</Label>
                <Select value={formData.rent_type} onValueChange={(v) => setFormData({...formData, rent_type: v})}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="per_landing">Per Landing</SelectItem>
                    <SelectItem value="per_hour">Per Hour</SelectItem>
                    <SelectItem value="per_day">Per Day</SelectItem>
                    <SelectItem value="fixed">Fixed Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Base Rent (₹) *</Label>
                <Input
                  type="number"
                  value={formData.base_rent_amount}
                  onChange={(e) => setFormData({...formData, base_rent_amount: e.target.value})}
                  placeholder="5000"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Aircraft Specific Rates */}
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-4">Aircraft Specific Rates (Optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Helicopter Rate (₹)</Label>
                  <Input
                    type="number"
                    value={formData.helicopter_rate}
                    onChange={(e) => setFormData({...formData, helicopter_rate: e.target.value})}
                    placeholder="Same as base"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Fixed Wing Rate (₹)</Label>
                  <Input
                    type="number"
                    value={formData.fixed_wing_rate}
                    onChange={(e) => setFormData({...formData, fixed_wing_rate: e.target.value})}
                    placeholder="Same as base"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Parking & Duration */}
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-4">Parking & Duration</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Max Free Hours</Label>
                  <Input
                    type="number"
                    value={formData.max_hours}
                    onChange={(e) => setFormData({...formData, max_hours: e.target.value})}
                    placeholder="2"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Parking/Hour (₹)</Label>
                  <Input
                    type="number"
                    value={formData.parking_charge_per_hour}
                    onChange={(e) => setFormData({...formData, parking_charge_per_hour: e.target.value})}
                    placeholder="500"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Overnight (₹)</Label>
                  <Input
                    type="number"
                    value={formData.overnight_charge}
                    onChange={(e) => setFormData({...formData, overnight_charge: e.target.value})}
                    placeholder="2000"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* GST & Multipliers */}
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-white font-medium mb-4">GST & Multipliers</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">GST %</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={formData.gst_percentage}
                      onChange={(e) => setFormData({...formData, gst_percentage: e.target.value})}
                      disabled={!formData.gst_applicable}
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                    <label className="flex items-center gap-1 text-slate-300 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={formData.gst_applicable}
                        onChange={(e) => setFormData({...formData, gst_applicable: e.target.checked})}
                        className="rounded"
                      />
                      Apply
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Peak Hours (x)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.peak_hours_multiplier}
                    onChange={(e) => setFormData({...formData, peak_hours_multiplier: e.target.value})}
                    placeholder="1.0"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Weekend (x)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.weekend_multiplier}
                    onChange={(e) => setFormData({...formData, weekend_multiplier: e.target.value})}
                    placeholder="1.0"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-slate-300">Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes..."
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600">
                Save Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculator Modal */}
      <Dialog open={showCalculator} onOpenChange={setShowCalculator}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Calculator className="h-5 w-5" /> Rent Calculator
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Calculate landing rent for a trip
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-300">Landing Point</Label>
              <Select value={calcForm.landing_point_id} onValueChange={(v) => setCalcForm({...calcForm, landing_point_id: v})}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select landing point" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                  {landingPoints.map(point => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.name} ({point.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Landing Date</Label>
                <Input
                  type="date"
                  value={calcForm.landing_date}
                  onChange={(e) => setCalcForm({...calcForm, landing_date: e.target.value})}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Duration (hours)</Label>
                <Input
                  type="number"
                  value={calcForm.duration_hours}
                  onChange={(e) => setCalcForm({...calcForm, duration_hours: e.target.value})}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Aircraft Type</Label>
              <Select value={calcForm.aircraft_type} onValueChange={(v) => setCalcForm({...calcForm, aircraft_type: v})}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="helicopter">Helicopter</SelectItem>
                  <SelectItem value="fixed_wing">Fixed Wing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCalculate} className="w-full bg-orange-500 hover:bg-orange-600">
              Calculate Rent
            </Button>

            {/* Result */}
            {calcResult && (
              <div className="mt-4 p-4 bg-slate-800 rounded-xl">
                <h4 className="text-white font-semibold mb-3">{calcResult.landing_point}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Base Rent</span>
                    <span className="text-white">₹{calcResult.base_rent?.toLocaleString()}</span>
                  </div>
                  {calcResult.parking_charge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Parking Charge</span>
                      <span className="text-white">₹{calcResult.parking_charge?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-white">₹{calcResult.subtotal?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">GST ({calcResult.gst_percentage}%)</span>
                    <span className="text-white">₹{calcResult.gst_amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-700">
                    <span className="text-white font-semibold">Total Rent</span>
                    <span className="text-orange-400 font-bold text-lg">₹{calcResult.total_rent?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LandingRentConfig;
