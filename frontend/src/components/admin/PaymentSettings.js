import React, { useState, useEffect } from 'react';
import { CreditCard, Percent, Save, RefreshCw, AlertCircle, Check, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { settingsAPI } from '@/services/api';
import { toast } from 'sonner';

// Booking Purpose Options with default payment percentages
const DEFAULT_PAYMENT_RULES = [
  { purpose: 'wedding', label: 'Wedding / शादी', icon: '💒', advance_percent: 50, can_pay_later: true },
  { purpose: 'temple_yatra', label: 'Temple Yatra / मंदिर यात्रा', icon: '🛕', advance_percent: 50, can_pay_later: true },
  { purpose: 'company_tour', label: 'Corporate Tour / कॉर्पोरेट टूर', icon: '🏢', advance_percent: 50, can_pay_later: true },
  { purpose: 'election_tour', label: 'Election Campaign / चुनाव प्रचार', icon: '🗳️', advance_percent: 100, can_pay_later: false },
  { purpose: 'medical_emergency', label: 'Medical Emergency / मेडिकल', icon: '🏥', advance_percent: 100, can_pay_later: false },
  { purpose: 'film_shooting', label: 'Film Shooting / फिल्म शूटिंग', icon: '🎬', advance_percent: 50, can_pay_later: true },
  { purpose: 'general_tour', label: 'General Tour / सामान्य यात्रा', icon: '✈️', advance_percent: 50, can_pay_later: true },
  { purpose: 'pilgrimage', label: 'Pilgrimage / तीर्थ यात्रा', icon: '🙏', advance_percent: 50, can_pay_later: true },
  { purpose: 'business', label: 'Business Meeting / बिज़नेस', icon: '💼', advance_percent: 50, can_pay_later: true },
  { purpose: 'other', label: 'Other / अन्य', icon: '📝', advance_percent: 100, can_pay_later: false },
];

function PaymentSettings() {
  const [paymentRules, setPaymentRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    default_advance_percent: 50,
    allow_partial_payment: true,
    minimum_advance_percent: 25,
    payment_deadline_hours: 24,
  });

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  const loadPaymentSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsAPI.getPaymentRules();
      if (response.data.payment_rules && response.data.payment_rules.length > 0) {
        setPaymentRules(response.data.payment_rules);
      } else {
        setPaymentRules(DEFAULT_PAYMENT_RULES);
      }
      if (response.data.global_settings) {
        setGlobalSettings(response.data.global_settings);
      }
    } catch (error) {
      console.error('Failed to load payment settings');
      setPaymentRules(DEFAULT_PAYMENT_RULES);
    } finally {
      setLoading(false);
    }
  };

  const handleRuleChange = (index, field, value) => {
    setPaymentRules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleGlobalChange = (field, value) => {
    setGlobalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.updatePaymentRules({
        payment_rules: paymentRules,
        global_settings: globalSettings,
      });
      toast.success('✅ Payment settings saved! / भुगतान सेटिंग्स सहेजी गईं!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-orange-400" />
            Payment Settings / भुगतान सेटिंग्स
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Configure advance payment percentages by booking purpose
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Settings
        </Button>
      </div>

      {/* Global Settings */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Global Settings / सामान्य सेटिंग्स</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-slate-300">Default Advance %</Label>
            <Input
              type="number"
              value={globalSettings.default_advance_percent}
              onChange={(e) => handleGlobalChange('default_advance_percent', parseInt(e.target.value))}
              min="0"
              max="100"
              className="bg-slate-900 border-slate-600 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-slate-300">Minimum Advance %</Label>
            <Input
              type="number"
              value={globalSettings.minimum_advance_percent}
              onChange={(e) => handleGlobalChange('minimum_advance_percent', parseInt(e.target.value))}
              min="0"
              max="100"
              className="bg-slate-900 border-slate-600 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-slate-300">Payment Deadline (Hours)</Label>
            <Input
              type="number"
              value={globalSettings.payment_deadline_hours}
              onChange={(e) => handleGlobalChange('payment_deadline_hours', parseInt(e.target.value))}
              min="1"
              max="72"
              className="bg-slate-900 border-slate-600 text-white mt-1"
            />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={globalSettings.allow_partial_payment}
              onChange={(e) => handleGlobalChange('allow_partial_payment', e.target.checked)}
              className="w-5 h-5 rounded border-slate-600"
            />
            <Label className="text-slate-300">Allow Partial Payment</Label>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
        <p className="text-blue-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Set advance payment % for each booking purpose. 100% means full payment required, 50% means half advance.
        </p>
        <p className="text-blue-300 text-sm mt-1">
          प्रत्येक बुकिंग उद्देश्य के लिए अग्रिम भुगतान % सेट करें। 100% = पूरा भुगतान, 50% = आधा अग्रिम।
        </p>
      </div>

      {/* Payment Rules by Purpose */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plane className="h-5 w-5 text-orange-400" />
            Payment Rules by Booking Purpose / बुकिंग उद्देश्य के अनुसार
          </h3>
        </div>
        
        <div className="divide-y divide-slate-700">
          {paymentRules.map((rule, index) => (
            <div key={rule.purpose} className="p-4 flex items-center gap-4 hover:bg-slate-800/50">
              {/* Icon & Label */}
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{rule.icon}</span>
                <div>
                  <p className="text-white font-medium">{rule.label}</p>
                  <p className="text-slate-500 text-xs">Purpose: {rule.purpose}</p>
                </div>
              </div>

              {/* Advance Percentage */}
              <div className="flex items-center gap-2">
                <Label className="text-slate-400 text-sm">Advance:</Label>
                <select
                  value={rule.advance_percent}
                  onChange={(e) => handleRuleChange(index, 'advance_percent', parseInt(e.target.value))}
                  className="w-24 p-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                >
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="75">75%</option>
                  <option value="100">100%</option>
                </select>
              </div>

              {/* Can Pay Later */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.can_pay_later}
                  onChange={(e) => handleRuleChange(index, 'can_pay_later', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-600"
                />
                <Label className="text-slate-400 text-sm">Pay Later OK</Label>
              </div>

              {/* Status Indicator */}
              <div className={`px-3 py-1 rounded-full text-xs ${
                rule.advance_percent === 100 
                  ? 'bg-red-500/20 text-red-400' 
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {rule.advance_percent === 100 ? '100% Required' : `${rule.advance_percent}% Advance`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Settings / सभी सेटिंग्स सहेजें
        </Button>
      </div>
    </div>
  );
}

export default PaymentSettings;
