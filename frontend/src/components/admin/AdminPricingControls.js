import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, RefreshCw, Percent, Calendar,
  Building2, MapPin, AlertCircle, TrendingUp, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { pricingEngineAPI } from '../../services/api';

// Import modular tab components
import { 
  CommissionFeesTab, 
  PeakSeasonTab, 
  RoutePricingTab, 
  CorporateContractsTab,
  CancellationPolicyTab,
  AuditLogsTab 
} from './pricing';

/**
 * Admin Pricing Controls - Refactored
 * Platform-wide pricing configuration (787 lines → ~200 lines)
 * Individual tabs extracted to /pricing/ folder
 */
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
      loadData();
    } catch (error) {
      console.error('Failed to save admin controls:', error);
      toast.error('Failed to save / सेव करने में विफल');
    } finally {
      setSaving(false);
    }
  };
  
  // Peak Date Handlers
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
  
  // Route Handlers
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
  
  // Contract Handlers
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
  
  // Cancellation Slab Handler
  const updateCancellationSlab = (index, field, value) => {
    setControls(prev => {
      const updated = [...prev.cancellation_slabs];
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
      return { ...prev, cancellation_slabs: updated };
    });
  };

  // Tab Configuration
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

      {/* Tab Content - Using Modular Components */}
      {activeTab === 'commission' && (
        <CommissionFeesTab controls={controls} setControls={setControls} />
      )}

      {activeTab === 'peak' && (
        <PeakSeasonTab 
          controls={controls} 
          setControls={setControls}
          addPeakDate={addPeakDate}
          updatePeakDate={updatePeakDate}
          removePeakDate={removePeakDate}
        />
      )}

      {activeTab === 'routes' && (
        <RoutePricingTab 
          routes={routes}
          newRoute={newRoute}
          setNewRoute={setNewRoute}
          addRoute={addRoute}
          saving={saving}
        />
      )}

      {activeTab === 'contracts' && (
        <CorporateContractsTab 
          contracts={contracts}
          newContract={newContract}
          setNewContract={setNewContract}
          addContract={addContract}
          saving={saving}
        />
      )}

      {activeTab === 'cancellation' && (
        <CancellationPolicyTab 
          controls={controls}
          setControls={setControls}
          updateCancellationSlab={updateCancellationSlab}
        />
      )}

      {activeTab === 'audit' && (
        <AuditLogsTab auditLogs={auditLogs} />
      )}
    </div>
  );
}

export default AdminPricingControls;
