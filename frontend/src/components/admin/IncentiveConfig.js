import React, { useState, useEffect } from 'react';
import { 
  Gift, DollarSign, Save, Loader2, Plus, Trash2, 
  TrendingUp, Users, Target, Award, Percent, Calculator
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../services/api';
import { toast } from 'sonner';

function IncentiveConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState({
    incentives_enabled: true,
    per_lead_enabled: true,
    per_lead_amount: 100,
    per_lead_qualified_only: false,
    per_conversion_enabled: true,
    per_conversion_amount: 500,
    per_conversion_min_value: 0,
    revenue_percent_enabled: true,
    revenue_percent: 1,
    revenue_percent_cap: 50000,
    target_bonus_enabled: true,
    target_bonus_slabs: [
      { min_percent: 100, max_percent: 110, bonus_amount: 5000, bonus_percent: 0 },
      { min_percent: 110, max_percent: 125, bonus_amount: 10000, bonus_percent: 0 },
      { min_percent: 125, max_percent: 150, bonus_amount: 15000, bonus_percent: 5 },
      { min_percent: 150, max_percent: 999, bonus_amount: 25000, bonus_percent: 10 },
    ],
    performance_bonus_enabled: true,
    penalty_enabled: false,
    penalty_below_percent: 50,
    penalty_amount: 0,
  });
  const [report, setReport] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/hr/incentive-config');
      setConfig(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error('Failed to load incentive config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    try {
      const response = await api.get('/hr/incentive-report', {
        params: { month: selectedMonth, year: selectedYear }
      });
      setReport(response.data);
    } catch (error) {
      toast.error('Failed to load incentive report');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/hr/incentive-config', config);
      toast.success('Incentive configuration saved!');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const updateSlab = (index, field, value) => {
    const newSlabs = [...config.target_bonus_slabs];
    newSlabs[index] = { ...newSlabs[index], [field]: parseFloat(value) || 0 };
    setConfig(prev => ({ ...prev, target_bonus_slabs: newSlabs }));
  };

  const addSlab = () => {
    const lastSlab = config.target_bonus_slabs[config.target_bonus_slabs.length - 1];
    setConfig(prev => ({
      ...prev,
      target_bonus_slabs: [
        ...prev.target_bonus_slabs.slice(0, -1),
        { min_percent: lastSlab.min_percent, max_percent: lastSlab.min_percent + 25, bonus_amount: 0, bonus_percent: 0 },
        { ...lastSlab, min_percent: lastSlab.min_percent + 25 }
      ]
    }));
  };

  const removeSlab = (index) => {
    if (config.target_bonus_slabs.length <= 1) return;
    setConfig(prev => ({
      ...prev,
      target_bonus_slabs: prev.target_bonus_slabs.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="h-6 w-6 text-green-400" />
            Incentive Management</h2>
          <p className="text-slate-400 mt-1">
            Configure sales team incentives and bonuses
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-green-500 hover:bg-green-600">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-lg transition ${
            activeTab === 'config' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Configuration
        </button>
        <button
          onClick={() => { setActiveTab('report'); loadReport(); }}
          className={`px-4 py-2 rounded-lg transition ${
            activeTab === 'report' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          Incentive Report
        </button>
      </div>

      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Master Toggle */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Incentives System</h3>
                <p className="text-slate-400 text-sm">Enable or disable all incentives</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.incentives_enabled}
                  onChange={(e) => handleChange('incentives_enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>

          {/* Per Lead Incentive */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Per Lead Incentive</h3>
                  <p className="text-slate-400 text-sm">Bonus for each new lead captured</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.per_lead_enabled}
                  onChange={(e) => handleChange('per_lead_enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            
            {config.per_lead_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="text-slate-300">Amount per Lead (₹)</Label>
                  <Input
                    type="number"
                    value={config.per_lead_amount}
                    onChange={(e) => handleChange('per_lead_amount', parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    id="qualifiedOnly"
                    checked={config.per_lead_qualified_only}
                    onChange={(e) => handleChange('per_lead_qualified_only', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="qualifiedOnly" className="text-slate-300">Only for qualified leads</Label>
                </div>
              </div>
            )}
          </div>

          {/* Per Conversion Incentive */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Per Conversion Incentive</h3>
                  <p className="text-slate-400 text-sm">Bonus for each lead converted to booking</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.per_conversion_enabled}
                  onChange={(e) => handleChange('per_conversion_enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            
            {config.per_conversion_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="text-slate-300">Amount per Conversion (₹)</Label>
                  <Input
                    type="number"
                    value={config.per_conversion_amount}
                    onChange={(e) => handleChange('per_conversion_amount', parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Minimum Booking Value (₹)</Label>
                  <Input
                    type="number"
                    value={config.per_conversion_min_value}
                    onChange={(e) => handleChange('per_conversion_min_value', parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Revenue Percentage */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Percent className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Revenue Percentage</h3>
                  <p className="text-slate-400 text-sm">Percentage of monthly revenue as incentive</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.revenue_percent_enabled}
                  onChange={(e) => handleChange('revenue_percent_enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            
            {config.revenue_percent_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="text-slate-300">Revenue Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.revenue_percent}
                    onChange={(e) => handleChange('revenue_percent', parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Maximum Cap (₹)</Label>
                  <Input
                    type="number"
                    value={config.revenue_percent_cap}
                    onChange={(e) => handleChange('revenue_percent_cap', parseFloat(e.target.value) || 0)}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Target Achievement Slabs */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Target Achievement Bonus</h3>
                  <p className="text-slate-400 text-sm">Slab-based bonus on target achievement</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.target_bonus_enabled}
                  onChange={(e) => handleChange('target_bonus_enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            
            {config.target_bonus_enabled && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-5 gap-2 text-xs text-slate-400 font-medium">
                  <div>Min %</div>
                  <div>Max %</div>
                  <div>Fixed Bonus (₹)</div>
                  <div>Extra %</div>
                  <div></div>
                </div>
                
                {config.target_bonus_slabs.map((slab, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2">
                    <Input
                      type="number"
                      value={slab.min_percent}
                      onChange={(e) => updateSlab(index, 'min_percent', e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white text-sm"
                    />
                    <Input
                      type="number"
                      value={slab.max_percent}
                      onChange={(e) => updateSlab(index, 'max_percent', e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white text-sm"
                    />
                    <Input
                      type="number"
                      value={slab.bonus_amount}
                      onChange={(e) => updateSlab(index, 'bonus_amount', e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white text-sm"
                    />
                    <Input
                      type="number"
                      value={slab.bonus_percent}
                      onChange={(e) => updateSlab(index, 'bonus_percent', e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white text-sm"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSlab(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <Button size="sm" variant="outline" onClick={addSlab}>
                  <Plus className="h-4 w-4 mr-2" /> Add Slab
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Tab */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Month Selector */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-slate-300">Month</Label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="ml-2 p-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-300">Year</Label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="ml-2 p-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <Button onClick={loadReport} className="bg-orange-500 hover:bg-orange-600">
                <Calculator className="h-4 w-4 mr-2" /> Calculate
              </Button>
            </div>
          </div>

          {/* Report Results */}
          {report && (
            <>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <p className="text-green-400 text-lg font-semibold">
                  Total Incentives: ₹{report.total_incentives?.toLocaleString()}
                </p>
                <p className="text-slate-400 text-sm">Period: {report.period}</p>
              </div>

              <div className="space-y-4">
                {report.report?.map((emp, idx) => (
                  <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-white font-semibold">{emp.employee_name}</p>
                        <p className="text-slate-400 text-sm">{emp.employee_email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 text-xl font-bold">₹{emp.total_incentive?.toLocaleString()}</p>
                        <p className="text-slate-400 text-xs">Total Incentive</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {emp.leads && (
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <p className="text-slate-400">Leads</p>
                          <p className="text-white font-medium">{emp.leads.count} × ₹{emp.leads.rate}</p>
                          <p className="text-blue-400">₹{emp.leads.amount}</p>
                        </div>
                      )}
                      {emp.conversions && (
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <p className="text-slate-400">Conversions</p>
                          <p className="text-white font-medium">{emp.conversions.count} × ₹{emp.conversions.rate}</p>
                          <p className="text-green-400">₹{emp.conversions.amount}</p>
                        </div>
                      )}
                      {emp.revenue && (
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <p className="text-slate-400">Revenue %</p>
                          <p className="text-white font-medium">{emp.revenue.percent}% of ₹{emp.revenue.total_revenue?.toLocaleString()}</p>
                          <p className="text-purple-400">₹{emp.revenue.amount}</p>
                        </div>
                      )}
                      {emp.target_achievement && (
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <p className="text-slate-400">Target Bonus</p>
                          <p className="text-white font-medium">{emp.target_achievement.achievement_percent}% achieved</p>
                          <p className="text-orange-400">₹{emp.target_achievement.amount}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default IncentiveConfig;
