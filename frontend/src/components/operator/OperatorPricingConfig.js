import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Clock, MapPin, Plane, Users, Save, 
  Settings, AlertCircle, CheckCircle, RefreshCw,
  Percent, Info, Calculator, Moon, Car, Fuel
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { pricingEngineAPI } from '../../services/api';

// Purpose Multiplier Labels
const purposeLabels = {
  personal: 'Personal / व्यक्तिगत',
  business: 'Business / व्यापार',
  wedding: 'Wedding / शादी',
  medical: 'Medical / चिकित्सा',
  pilgrimage: 'Pilgrimage / तीर्थ',
  election: 'Election / चुनाव',
  corporate: 'Corporate / कॉर्पोरेट',
  vip: 'VIP',
  tourism: 'Tourism / पर्यटन',
  aerial_survey: 'Aerial Survey',
  film_shooting: 'Film Shooting / फिल्म'
};

function OperatorPricingConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operatorId, setOperatorId] = useState(null);
  const [helicopters, setHelicopters] = useState([]);
  const [selectedHelicopter, setSelectedHelicopter] = useState('');
  
  // Base Pricing State
  const [basePricing, setBasePricing] = useState({
    pricing_type: 'hourly',
    price_per_hour: 180000,
    min_billable_hours: 2,
    half_day_hours: 3,
    half_day_price: 500000,
    full_day_hours: 6,
    full_day_price: 900000,
    per_sector_price: 150000,
    per_day_price: 1000000,
    purpose_multipliers: {
      personal: 1.0, business: 1.0, wedding: 1.3, medical: 0.9,
      pilgrimage: 1.1, election: 1.5, corporate: 1.2, vip: 1.4,
      tourism: 1.0, aerial_survey: 1.2, film_shooting: 1.5
    }
  });
  
  // Dead Leg Config State
  const [deadLegConfig, setDeadLegConfig] = useState({
    enabled: true,
    rate_type: 'per_km',
    rate_value: 500,
    free_positioning_km: 0,
    base_city: '',
    base_latitude: null,
    base_longitude: null
  });
  
  // Additional Charges State
  const [additionalCharges, setAdditionalCharges] = useState({
    night_halt_per_night: 25000,
    crew_accommodation_included: false,
    crew_accommodation_per_night: 5000,
    crew_food_allowance_per_day: 1500,
    waiting_free_minutes: 30,
    waiting_charge_per_minute: 500,
    waiting_charge_per_hour: 25000,
    fuel_cost_type: 'included',
    fuel_surcharge_percent: 0,
    round_trip_discount_percent: 10,
    mandatory_return: false
  });
  
  useEffect(() => {
    loadPricingConfig();
  }, []);
  
  const loadPricingConfig = async () => {
    try {
      setLoading(true);
      const response = await pricingEngineAPI.getOperatorPricing();
      const data = response.data;
      
      setOperatorId(data.operator_id);
      
      // Load base pricing (first one if exists)
      if (data.base_pricing && data.base_pricing.length > 0) {
        setBasePricing(prev => ({ ...prev, ...data.base_pricing[0] }));
        setSelectedHelicopter(data.base_pricing[0].helicopter_id || '');
      }
      
      // Load dead leg config
      if (data.dead_leg_config && Object.keys(data.dead_leg_config).length > 0) {
        setDeadLegConfig(prev => ({ ...prev, ...data.dead_leg_config }));
      }
      
      // Load additional charges
      if (data.additional_charges && Object.keys(data.additional_charges).length > 0) {
        setAdditionalCharges(prev => ({ ...prev, ...data.additional_charges }));
      }
      
      // Set default multipliers if not set
      if (data.default_multipliers) {
        setBasePricing(prev => ({
          ...prev,
          purpose_multipliers: { ...data.default_multipliers, ...prev.purpose_multipliers }
        }));
      }
      
    } catch (error) {
      console.error('Failed to load pricing config:', error);
      toast.error('Failed to load pricing configuration / मूल्य विन्यास लोड करने में विफल');
    } finally {
      setLoading(false);
    }
  };
  
  const saveBasePricing = async () => {
    try {
      setSaving(true);
      await pricingEngineAPI.setBasePricing({
        ...basePricing,
        helicopter_id: selectedHelicopter || 'default'
      });
      toast.success('✅ Base pricing saved! / बेस प्राइसिंग सेव हो गई!');
    } catch (error) {
      console.error('Failed to save base pricing:', error);
      toast.error('Failed to save / सेव करने में विफल');
    } finally {
      setSaving(false);
    }
  };
  
  const saveDeadLegConfig = async () => {
    try {
      setSaving(true);
      await pricingEngineAPI.setDeadLegConfig({
        ...deadLegConfig,
        helicopter_id: selectedHelicopter || 'default'
      });
      toast.success('✅ Dead-leg config saved! / डेड-लेग कॉन्फिग सेव हो गया!');
    } catch (error) {
      console.error('Failed to save dead-leg config:', error);
      toast.error('Failed to save / सेव करने में विफल');
    } finally {
      setSaving(false);
    }
  };
  
  const saveAdditionalCharges = async () => {
    try {
      setSaving(true);
      await pricingEngineAPI.setAdditionalCharges({
        ...additionalCharges,
        helicopter_id: selectedHelicopter || 'default'
      });
      toast.success('✅ Additional charges saved! / अतिरिक्त शुल्क सेव हो गए!');
    } catch (error) {
      console.error('Failed to save additional charges:', error);
      toast.error('Failed to save / सेव करने में विफल');
    } finally {
      setSaving(false);
    }
  };
  
  const handleMultiplierChange = (purpose, value) => {
    const numValue = parseFloat(value) || 1.0;
    setBasePricing(prev => ({
      ...prev,
      purpose_multipliers: {
        ...prev.purpose_multipliers,
        [purpose]: numValue
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-slate-300">Loading pricing config...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-orange-500" />
            Pricing Configuration / मूल्य विन्यास
          </h2>
          <p className="text-slate-400 mt-1">Configure your helicopter pricing / हेलीकॉप्टर प्राइसिंग सेट करें</p>
        </div>
      </div>

      {/* Base Pricing Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-green-500" />
            Base Pricing / बेस प्राइसिंग
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pricing Type Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['hourly', 'route', 'half_day', 'full_day'].map(type => (
              <button
                key={type}
                onClick={() => setBasePricing(prev => ({ ...prev, pricing_type: type }))}
                className={`p-3 rounded-lg border text-center transition-all ${
                  basePricing.pricing_type === type
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="font-medium capitalize">{type.replace('_', ' ')}</div>
              </button>
            ))}
          </div>

          {/* Hourly Rate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Hourly Rate / प्रति घंटा दर (₹)</Label>
              <Input
                type="number"
                value={basePricing.price_per_hour}
                onChange={(e) => setBasePricing(prev => ({ ...prev, price_per_hour: parseFloat(e.target.value) || 0 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-300">Min Billable Hours (MDG)</Label>
              <Input
                type="number"
                step="0.5"
                value={basePricing.min_billable_hours}
                onChange={(e) => setBasePricing(prev => ({ ...prev, min_billable_hours: parseFloat(e.target.value) || 2 }))}
                className="bg-slate-700 border-slate-600 text-white mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum Daily Guarantee hours</p>
            </div>
          </div>

          {/* Day Package Pricing */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              Day Package Pricing / दिवस पैकेज
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Half-Day Hours</Label>
                <Input
                  type="number"
                  value={basePricing.half_day_hours}
                  onChange={(e) => setBasePricing(prev => ({ ...prev, half_day_hours: parseFloat(e.target.value) || 3 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Half-Day Price (₹)</Label>
                <Input
                  type="number"
                  value={basePricing.half_day_price || ''}
                  onChange={(e) => setBasePricing(prev => ({ ...prev, half_day_price: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Full-Day Hours</Label>
                <Input
                  type="number"
                  value={basePricing.full_day_hours}
                  onChange={(e) => setBasePricing(prev => ({ ...prev, full_day_hours: parseFloat(e.target.value) || 6 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Full-Day Price (₹)</Label>
                <Input
                  type="number"
                  value={basePricing.full_day_price || ''}
                  onChange={(e) => setBasePricing(prev => ({ ...prev, full_day_price: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
          </div>

          {/* Purpose Multipliers */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Percent className="h-4 w-4 text-purple-400" />
              Purpose Multipliers / उद्देश्य गुणक
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Set price multipliers based on booking purpose (1.0 = no change, 1.3 = 30% extra)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(purposeLabels).map(([purpose, label]) => (
                <div key={purpose} className="bg-slate-800/50 rounded p-2">
                  <Label className="text-slate-400 text-xs">{label}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="3"
                    value={basePricing.purpose_multipliers?.[purpose] || 1.0}
                    onChange={(e) => handleMultiplierChange(purpose, e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white mt-1 h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={saveBasePricing} disabled={saving} className="bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Base Pricing / बेस प्राइसिंग सेव करें'}
          </Button>
        </CardContent>
      </Card>

      {/* Dead Leg / Positioning Cost Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Car className="h-5 w-5 text-yellow-500" />
            Dead-Leg / Positioning Cost / पोजिशनिंग कॉस्ट
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={deadLegConfig.enabled}
              onChange={(e) => setDeadLegConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="rounded"
            />
            <Label className="text-slate-300">Enable Dead-Leg Charging</Label>
          </div>

          {deadLegConfig.enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Rate Type</Label>
                  <select
                    value={deadLegConfig.rate_type}
                    onChange={(e) => setDeadLegConfig(prev => ({ ...prev, rate_type: e.target.value }))}
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-2 mt-1"
                  >
                    <option value="per_km">Per KM</option>
                    <option value="per_hour">Per Hour</option>
                    <option value="percentage">Percentage of Flight</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <Label className="text-slate-300">
                    Rate Value {deadLegConfig.rate_type === 'percentage' ? '(%)' : '(₹)'}
                  </Label>
                  <Input
                    type="number"
                    value={deadLegConfig.rate_value}
                    onChange={(e) => setDeadLegConfig(prev => ({ ...prev, rate_value: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Free Positioning KM</Label>
                  <Input
                    type="number"
                    value={deadLegConfig.free_positioning_km}
                    onChange={(e) => setDeadLegConfig(prev => ({ ...prev, free_positioning_km: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Base City / बेस शहर</Label>
                <Input
                  type="text"
                  value={deadLegConfig.base_city || ''}
                  onChange={(e) => setDeadLegConfig(prev => ({ ...prev, base_city: e.target.value }))}
                  placeholder="e.g., Mumbai, Delhi"
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
            </>
          )}

          <Button onClick={saveDeadLegConfig} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Dead-Leg Config'}
          </Button>
        </CardContent>
      </Card>

      {/* Additional Charges Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-500" />
            Additional Charges / अतिरिक्त शुल्क
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Night Halt */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Moon className="h-4 w-4 text-indigo-400" />
              Night Halt Charges / रात्रि ठहराव शुल्क
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Per Night (₹)</Label>
                <Input
                  type="number"
                  value={additionalCharges.night_halt_per_night}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, night_halt_per_night: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Crew Accommodation (₹)</Label>
                <Input
                  type="number"
                  value={additionalCharges.crew_accommodation_per_night}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, crew_accommodation_per_night: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Crew Food (₹/day)</Label>
                <Input
                  type="number"
                  value={additionalCharges.crew_food_allowance_per_day}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, crew_food_allowance_per_day: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  checked={additionalCharges.crew_accommodation_included}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, crew_accommodation_included: e.target.checked }))}
                  className="rounded"
                />
                <Label className="text-slate-400 text-sm">Crew Included</Label>
              </div>
            </div>
          </div>

          {/* Waiting Charges */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-400" />
              Waiting / Ground Holding / प्रतीक्षा शुल्क
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-400 text-sm">Free Minutes</Label>
                <Input
                  type="number"
                  value={additionalCharges.waiting_free_minutes}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, waiting_free_minutes: parseInt(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Per Minute (₹)</Label>
                <Input
                  type="number"
                  value={additionalCharges.waiting_charge_per_minute}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, waiting_charge_per_minute: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-sm">Per Hour (₹)</Label>
                <Input
                  type="number"
                  value={additionalCharges.waiting_charge_per_hour}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, waiting_charge_per_hour: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
          </div>

          {/* Fuel & Round Trip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <Fuel className="h-4 w-4 text-red-400" />
                Fuel Cost Handling
              </h4>
              <select
                value={additionalCharges.fuel_cost_type}
                onChange={(e) => setAdditionalCharges(prev => ({ ...prev, fuel_cost_type: e.target.value }))}
                className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-2"
              >
                <option value="included">Included in Price</option>
                <option value="excluded">Excluded (Extra)</option>
                <option value="surcharge">Surcharge Applied</option>
              </select>
              {additionalCharges.fuel_cost_type === 'surcharge' && (
                <div className="mt-2">
                  <Label className="text-slate-400 text-sm">Surcharge %</Label>
                  <Input
                    type="number"
                    value={additionalCharges.fuel_surcharge_percent}
                    onChange={(e) => setAdditionalCharges(prev => ({ ...prev, fuel_surcharge_percent: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-700/30 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-green-400" />
                Round Trip Discount
              </h4>
              <div>
                <Label className="text-slate-400 text-sm">Discount %</Label>
                <Input
                  type="number"
                  value={additionalCharges.round_trip_discount_percent}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, round_trip_discount_percent: parseFloat(e.target.value) || 0 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={additionalCharges.mandatory_return}
                  onChange={(e) => setAdditionalCharges(prev => ({ ...prev, mandatory_return: e.target.checked }))}
                  className="rounded"
                />
                <Label className="text-slate-400 text-sm">Mandatory Return</Label>
              </div>
            </div>
          </div>

          <Button onClick={saveAdditionalCharges} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Additional Charges / अतिरिक्त शुल्क सेव करें'}
          </Button>
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="text-blue-400 font-medium">How Pricing Works / प्राइसिंग कैसे काम करती है</h4>
            <ul className="text-slate-300 text-sm mt-2 space-y-1">
              <li>• Base pricing is calculated using hourly rate or day packages</li>
              <li>• Dead-leg cost is added for helicopter positioning from base</li>
              <li>• Minimum Daily Guarantee (MDG) ensures minimum billing hours</li>
              <li>• Purpose multipliers adjust price based on booking type</li>
              <li>• Platform commission (Admin-controlled) is deducted from your payout</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperatorPricingConfig;
