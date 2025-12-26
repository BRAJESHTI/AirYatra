import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Settings, Save, RefreshCw, Percent, Calendar,
  Building2, MapPin, AlertCircle, CheckCircle, Plus, Trash2,
  FileText, Clock, TrendingUp, Shield, Info, Calculator
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { pricingEngineAPI } from '../../services/api';

function AdminPricingControls() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('commission');
  
  // Admin Controls State
  const [controls, setControls] = useState({
    commission_type: 'percentage',
    commission_value: 10,
    commission_overrides: {
      by_operator: {},
      by_purpose: {},
      by_route: {},
      by_helicopter_model: {}
    },
    peak_season_enabled: true,
    peak_surge_multiplier: 1.3,
    peak_dates: [],
    fuel_surcharge_enabled: true,
    fuel_surcharge_percent: 5,
    convenience_fee_percent: 5,
    insurance_percent: 2,
    insurance_enabled: true,
    gst_percent: 18,
    cgst_percent: 9,
    sgst_percent: 9,
    igst_percent: 18,
    cancellation_slabs: [
      { hours_before: 72, charge_percent: 10, label: '72+ hours' },
      { hours_before: 24, charge_percent: 25, label: '24-72 hours' },
      { hours_before: 12, charge_percent: 50, label: '12-24 hours' },
      { hours_before: 0, charge_percent: 100, label: 'Same day' }
    ],
    weather_abort_refund_percent: 90
  });
  
  // Route Pricing State
  const [routes, setRoutes] = useState([]);
  const [newRoute, setNewRoute] = useState({
    route_from: '',
    route_to: '',
    distance_km: 0,
    estimated_flight_time_minutes: 0,
    base_price: 0,
    is_popular: false
  });
  
  // Corporate Contracts State
  const [contracts, setContracts] = useState([]);
  const [newContract, setNewContract] = useState({
    contract_id: '',
    company_name: '',
    contract_type: 'corporate',
    discount_percent: 0,
    fixed_rate_per_hour: null,
    valid_from: '',
    valid_to: ''
  });
  
  // Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      const [controlsRes, routesRes, contractsRes, logsRes] = await Promise.all([
        pricingEngineAPI.getAdminControls(),
        pricingEngineAPI.getRoutes(),
        pricingEngineAPI.getContracts(),
        pricingEngineAPI.getAuditLogs(50)
      ]);
      
      if (controlsRes.data) {
        setControls(prev => ({ ...prev, ...controlsRes.data }));
      }
      setRoutes(routesRes.data?.routes || []);
      setContracts(contractsRes.data?.contracts || []);
      setAuditLogs(logsRes.data?.logs || []);
      
    } catch (error) {
      console.error('Failed to load admin pricing data:', error);
      toast.error('Failed to load pricing controls');
    } finally {
      setLoading(false);
    }
  };
  
  const saveControls = async () => {
    try {
      setSaving(true);
      await pricingEngineAPI.setAdminControls(controls);
      toast.success('✅ Admin controls saved! / एडमिन कंट्रोल्स सेव हो गए!');
      loadData(); // Reload to get audit logs
    } catch (error) {
      console.error('Failed to save admin controls:', error);
      toast.error('Failed to save / सेव करने में विफल');
    } finally {
      setSaving(false);
    }
  };
  
  const addPeakDate = () => {
    const newPeak = {
      start: '',
      end: '',
      multiplier: 1.3,
      label: 'New Peak Period',
      regions: []
    };
    setControls(prev => ({
      ...prev,
      peak_dates: [...(prev.peak_dates || []), newPeak]
    }));
  };
  
  const updatePeakDate = (index, field, value) => {
    setControls(prev => {
      const updated = [...prev.peak_dates];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, peak_dates: updated };
    });
  };
  
  const removePeakDate = (index) => {
    setControls(prev => ({
      ...prev,
      peak_dates: prev.peak_dates.filter((_, i) => i !== index)
    }));
  };
  
  const addRoute = async () => {
    if (!newRoute.route_from || !newRoute.route_to || !newRoute.base_price) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      setSaving(true);
      await pricingEngineAPI.setRoutePricing(newRoute);
      toast.success('Route pricing added!');
      setNewRoute({
        route_from: '', route_to: '', distance_km: 0,
        estimated_flight_time_minutes: 0, base_price: 0, is_popular: false
      });
      loadData();
    } catch (error) {
      toast.error('Failed to add route');
    } finally {
      setSaving(false);
    }
  };
  
  const addContract = async () => {
    if (!newContract.contract_id || !newContract.company_name) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      setSaving(true);
      await pricingEngineAPI.createCorporateContract(newContract);
      toast.success('Corporate contract created!');
      setNewContract({
        contract_id: '', company_name: '', contract_type: 'corporate',
        discount_percent: 0, fixed_rate_per_hour: null, valid_from: '', valid_to: ''
      });
      loadData();
    } catch (error) {
      toast.error('Failed to create contract');
    } finally {
      setSaving(false);
    }
  };
  
  const updateCancellationSlab = (index, field, value) => {
    setControls(prev => {
      const updated = [...prev.cancellation_slabs];
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
      return { ...prev, cancellation_slabs: updated };
    });
  };

  const tabs = [
    { id: 'commission', label: 'Commission & Fees', icon: Percent },
    { id: 'peak', label: 'Peak Season', icon: TrendingUp },
    { id: 'routes', label: 'Route Pricing', icon: MapPin },
    { id: 'contracts', label: 'Corporate Contracts', icon: Building2 },
    { id: 'cancellation', label: 'Cancellation', icon: AlertCircle },
    { id: 'audit', label: 'Audit Logs', icon: FileText }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-slate-300">Loading admin controls...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="h-6 w-6 text-orange-500" />
            Admin Pricing Controls / एडमिन प्राइसिंग कंट्रोल
          </h2>
          <p className="text-slate-400 mt-1">
            Platform-wide pricing configuration (Operators cannot edit)
          </p>
        </div>
        <Button onClick={saveControls} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Commission & Fees Tab */}
      {activeTab === 'commission' && (
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

            {/* Other Fees */}
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
                  <input
                    type="checkbox"
                    checked={controls.fuel_surcharge_enabled}
                    onChange={(e) => setControls(prev => ({ ...prev, fuel_surcharge_enabled: e.target.checked }))}
                    className="rounded"
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
      )}

      {/* Peak Season Tab */}
      {activeTab === 'peak' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-500" />
              Peak Season Surge / पीक सीजन सर्ज
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={controls.peak_season_enabled}
                onChange={(e) => setControls(prev => ({ ...prev, peak_season_enabled: e.target.checked }))}
                className="rounded"
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
          </CardContent>
        </Card>
      )}

      {/* Route Pricing Tab */}
      {activeTab === 'routes' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Route-Based Pricing / रूट-आधारित मूल्य
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add New Route */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Add New Route / नया रूट जोड़ें</h4>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div>
                  <Label className="text-slate-400 text-sm">From City</Label>
                  <Input
                    type="text"
                    value={newRoute.route_from}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, route_from: e.target.value }))}
                    placeholder="Mumbai"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">To City</Label>
                  <Input
                    type="text"
                    value={newRoute.route_to}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, route_to: e.target.value }))}
                    placeholder="Pune"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Distance (km)</Label>
                  <Input
                    type="number"
                    value={newRoute.distance_km}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, distance_km: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Flight Time (min)</Label>
                  <Input
                    type="number"
                    value={newRoute.estimated_flight_time_minutes}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, estimated_flight_time_minutes: parseInt(e.target.value) || 0 }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Base Price (₹)</Label>
                  <Input
                    type="number"
                    value={newRoute.base_price}
                    onChange={(e) => setNewRoute(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addRoute} disabled={saving} className="bg-blue-600 hover:bg-blue-700 w-full">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing Routes */}
            <div className="space-y-2">
              <h4 className="text-white font-medium">Existing Routes ({routes.length})</h4>
              {routes.length === 0 ? (
                <p className="text-slate-400 text-sm">No route pricing configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {routes.map((route, index) => (
                    <div key={index} className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <MapPin className="h-4 w-4 text-blue-400" />
                        <span className="text-white">{route.route_from} → {route.route_to}</span>
                        <span className="text-slate-400">{route.distance_km} km</span>
                        <span className="text-green-400 font-semibold">₹{route.base_price?.toLocaleString()}</span>
                        {route.is_popular && (
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">Popular</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Corporate Contracts Tab */}
      {activeTab === 'contracts' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              Corporate Contracts / कॉर्पोरेट अनुबंध
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add New Contract */}
            <div className="bg-slate-700/30 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Create Contract / अनुबंध बनाएं</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-slate-400 text-sm">Contract ID</Label>
                  <Input
                    type="text"
                    value={newContract.contract_id}
                    onChange={(e) => setNewContract(prev => ({ ...prev, contract_id: e.target.value }))}
                    placeholder="CORP-001"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Company Name</Label>
                  <Input
                    type="text"
                    value={newContract.company_name}
                    onChange={(e) => setNewContract(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Tata Motors"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Type</Label>
                  <select
                    value={newContract.contract_type}
                    onChange={(e) => setNewContract(prev => ({ ...prev, contract_type: e.target.value }))}
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-md p-2 mt-1"
                  >
                    <option value="corporate">Corporate</option>
                    <option value="government">Government</option>
                    <option value="ngo">NGO</option>
                  </select>
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Discount (%)</Label>
                  <Input
                    type="number"
                    value={newContract.discount_percent}
                    onChange={(e) => setNewContract(prev => ({ ...prev, discount_percent: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div>
                  <Label className="text-slate-400 text-sm">Valid From</Label>
                  <Input
                    type="date"
                    value={newContract.valid_from}
                    onChange={(e) => setNewContract(prev => ({ ...prev, valid_from: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-sm">Valid To</Label>
                  <Input
                    type="date"
                    value={newContract.valid_to}
                    onChange={(e) => setNewContract(prev => ({ ...prev, valid_to: e.target.value }))}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button onClick={addContract} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" /> Create Contract
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing Contracts */}
            <div className="space-y-2">
              <h4 className="text-white font-medium">Active Contracts ({contracts.length})</h4>
              {contracts.length === 0 ? (
                <p className="text-slate-400 text-sm">No corporate contracts yet.</p>
              ) : (
                <div className="space-y-2">
                  {contracts.map((contract, index) => (
                    <div key={index} className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Building2 className="h-4 w-4 text-purple-400" />
                        <span className="text-white font-medium">{contract.company_name}</span>
                        <span className="px-2 py-0.5 bg-slate-600 text-slate-300 rounded text-xs uppercase">
                          {contract.contract_type}
                        </span>
                        <span className="text-green-400">{contract.discount_percent}% off</span>
                      </div>
                      <span className="text-slate-400 text-sm">ID: {contract.contract_id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancellation Tab */}
      {activeTab === 'cancellation' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Cancellation Slabs / रद्दीकरण स्लैब
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {controls.cancellation_slabs.map((slab, index) => (
                <div key={index} className="bg-slate-700/30 rounded-lg p-4 grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-400 text-sm">Hours Before Booking</Label>
                    <Input
                      type="number"
                      value={slab.hours_before}
                      onChange={(e) => updateCancellationSlab(index, 'hours_before', e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-sm">Charge (%)</Label>
                    <Input
                      type="number"
                      value={slab.charge_percent}
                      onChange={(e) => updateCancellationSlab(index, 'charge_percent', e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div className="flex items-center">
                    <span className="text-slate-300">{slab.label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-700/30 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Weather/Emergency Abort</h4>
              <div>
                <Label className="text-slate-400 text-sm">Weather Abort Refund (%)</Label>
                <Input
                  type="number"
                  value={controls.weather_abort_refund_percent}
                  onChange={(e) => setControls(prev => ({ ...prev, weather_abort_refund_percent: parseFloat(e.target.value) || 90 }))}
                  className="bg-slate-700 border-slate-600 text-white mt-1 max-w-xs"
                />
                <p className="text-xs text-slate-500 mt-1">Refund percentage when flight is aborted due to weather</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" />
              Pricing Audit Logs / प्राइसिंग ऑडिट लॉग
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-slate-400">No audit logs yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log, index) => (
                  <div key={index} className="bg-slate-700/30 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <span className="text-orange-400 font-medium">{log.action}</span>
                      <span className="text-slate-400 ml-2">by {log.user_email || log.user_id}</span>
                    </div>
                    <span className="text-slate-500 text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-orange-400 mt-0.5" />
          <div>
            <h4 className="text-orange-400 font-medium">Admin Pricing Rules / एडमिन प्राइसिंग नियम</h4>
            <ul className="text-slate-300 text-sm mt-2 space-y-1">
              <li>• Commission & fees are deducted from operator payouts</li>
              <li>• Peak season surge applies on top of operator's base pricing</li>
              <li>• Route pricing overrides hourly calculation when available</li>
              <li>• Corporate contracts provide discounts to tagged customers</li>
              <li>• All changes are logged for audit compliance</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPricingControls;
