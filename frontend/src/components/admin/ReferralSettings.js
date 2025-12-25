import React, { useState, useEffect } from 'react';
import { 
  Gift, Settings, Save, Loader2, Plus, Trash2, Edit2, Copy,
  Percent, IndianRupee, Calendar, Check, X, RefreshCw, Tag,
  Users, TrendingUp, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { referralAPI } from '../../services/api';
import { toast } from 'sonner';

function ReferralSettings() {
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings
  const [settings, setSettings] = useState({
    referral_bonus_percent: 5,
    referral_bonus_fixed: 500,
    referral_bonus_type: 'fixed',
    first_booking_discount_percent: 10,
    first_booking_discount_max: 2000,
    min_booking_for_referral: 10000,
    referral_enabled: true,
    wallet_enabled: true
  });
  
  // Discount Codes
  const [discountCodes, setDiscountCodes] = useState([]);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [newCode, setNewCode] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: 10,
    max_uses: 100,
    min_booking_amount: 5000,
    max_discount_amount: 5000,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
    is_active: true,
    description: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'settings') {
        const response = await referralAPI.getSettings();
        setSettings(response.data);
      } else {
        const response = await referralAPI.getDiscountCodes();
        setDiscountCodes(response.data.codes || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await referralAPI.updateSettings(settings);
      toast.success('Settings saved! / सेटिंग्स सेव हो गईं!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const generateRandomCode = async () => {
    try {
      const response = await referralAPI.generateCodeString({ prefix: 'AIR', length: 6 });
      setNewCode(prev => ({ ...prev, code: response.data.code }));
    } catch (error) {
      toast.error('Failed to generate code');
    }
  };

  const handleCreateCode = async () => {
    if (!newCode.code) {
      toast.error('Please enter a discount code');
      return;
    }
    
    setSaving(true);
    try {
      if (editingCode) {
        await referralAPI.updateDiscountCode(editingCode.id, newCode);
        toast.success('Discount code updated!');
      } else {
        await referralAPI.createDiscountCode(newCode);
        toast.success('Discount code created!');
      }
      setShowCodeDialog(false);
      setEditingCode(null);
      resetNewCode();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save discount code');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCode = async (codeId) => {
    if (!window.confirm('Are you sure you want to delete this code?')) return;
    
    try {
      await referralAPI.deleteDiscountCode(codeId);
      toast.success('Discount code deleted!');
      loadData();
    } catch (error) {
      toast.error('Failed to delete code');
    }
  };

  const handleToggleCode = async (code) => {
    try {
      await referralAPI.updateDiscountCode(code.id, { is_active: !code.is_active });
      toast.success(`Code ${!code.is_active ? 'activated' : 'deactivated'}!`);
      loadData();
    } catch (error) {
      toast.error('Failed to update code');
    }
  };

  const resetNewCode = () => {
    setNewCode({
      code: '',
      discount_type: 'percent',
      discount_value: 10,
      max_uses: 100,
      min_booking_amount: 5000,
      max_discount_amount: 5000,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      is_active: true,
      description: ''
    });
  };

  const openEditDialog = (code) => {
    setEditingCode(code);
    setNewCode({
      ...code,
      valid_from: code.valid_from?.split('T')[0] || '',
      valid_until: code.valid_until?.split('T')[0] || ''
    });
    setShowCodeDialog(true);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
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
            Referral & Discount Settings / रेफरल और डिस्काउंट सेटिंग्स
          </h2>
          <p className="text-slate-400 mt-1">Manage referral program and discount codes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'settings' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Settings className="h-4 w-4" /> Settings / सेटिंग्स
        </button>
        <button
          onClick={() => setActiveTab('codes')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            activeTab === 'codes' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Tag className="h-4 w-4" /> Discount Codes / डिस्काउंट कोड
        </button>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Enable/Disable */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Program Status / प्रोग्राम स्थिति</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                <div>
                  <p className="text-white">Referral Program</p>
                  <p className="text-slate-400 text-sm">Enable customer referrals</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.referral_enabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, referral_enabled: e.target.checked }))}
                  />
                  <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                <div>
                  <p className="text-white">Wallet System</p>
                  <p className="text-slate-400 text-sm">Enable wallet payments</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.wallet_enabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, wallet_enabled: e.target.checked }))}
                  />
                  <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Referral Bonus Settings */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Referral Bonus / रेफरल बोनस
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Bonus Type / बोनस प्रकार</Label>
                <select
                  value={settings.referral_bonus_type}
                  onChange={(e) => setSettings(prev => ({ ...prev, referral_bonus_type: e.target.value }))}
                  className="w-full mt-1 p-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                >
                  <option value="fixed">Fixed Amount / निश्चित राशि</option>
                  <option value="percent">Percentage / प्रतिशत</option>
                </select>
              </div>
              
              {settings.referral_bonus_type === 'fixed' ? (
                <div>
                  <Label className="text-slate-300">Fixed Bonus Amount (₹)</Label>
                  <Input
                    type="number"
                    value={settings.referral_bonus_fixed}
                    onChange={(e) => setSettings(prev => ({ ...prev, referral_bonus_fixed: parseFloat(e.target.value) }))}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-slate-300">Bonus Percentage (%)</Label>
                  <Input
                    type="number"
                    value={settings.referral_bonus_percent}
                    onChange={(e) => setSettings(prev => ({ ...prev, referral_bonus_percent: parseFloat(e.target.value) }))}
                    className="bg-slate-900 border-slate-600 text-white mt-1"
                  />
                </div>
              )}
              
              <div>
                <Label className="text-slate-300">Minimum Booking Amount (₹)</Label>
                <Input
                  type="number"
                  value={settings.min_booking_for_referral}
                  onChange={(e) => setSettings(prev => ({ ...prev, min_booking_for_referral: parseFloat(e.target.value) }))}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
                <p className="text-slate-500 text-xs mt-1">Referral counts only if booking is above this amount</p>
              </div>
            </div>
          </div>

          {/* First Booking Discount */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              First Booking Discount / पहली बुकिंग छूट
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Discount given to new users who use a referral code / रेफरल कोड उपयोग करने वाले नए उपयोगकर्ताओं को छूट
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Discount Percentage (%)</Label>
                <Input
                  type="number"
                  value={settings.first_booking_discount_percent}
                  onChange={(e) => setSettings(prev => ({ ...prev, first_booking_discount_percent: parseFloat(e.target.value) }))}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">Maximum Discount (₹)</Label>
                <Input
                  type="number"
                  value={settings.first_booking_discount_max}
                  onChange={(e) => setSettings(prev => ({ ...prev, first_booking_discount_max: parseFloat(e.target.value) }))}
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-purple-500 hover:bg-purple-600 px-8"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings / सेटिंग्स सेव करें
            </Button>
          </div>
        </div>
      )}

      {/* Discount Codes Tab */}
      {activeTab === 'codes' && (
        <div className="space-y-6">
          {/* Add New Code Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => {
                resetNewCode();
                setEditingCode(null);
                setShowCodeDialog(true);
              }}
              className="bg-green-500 hover:bg-green-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Discount Code / नया कोड बनाएं
            </Button>
          </div>

          {/* Codes List */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50 text-left text-slate-400 text-sm">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Uses</th>
                    <th className="px-4 py-3">Valid Until</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {discountCodes.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                        No discount codes yet / अभी कोई डिस्काउंट कोड नहीं
                      </td>
                    </tr>
                  ) : (
                    discountCodes.map((code) => (
                      <tr key={code.id} className="border-t border-slate-700">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white font-bold">{code.code}</span>
                            <button onClick={() => copyCode(code.code)} className="text-slate-400 hover:text-white">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-slate-500 text-xs">{code.description}</p>
                        </td>
                        <td className="px-4 py-3 text-white">
                          {code.discount_type === 'percent' 
                            ? `${code.discount_value}%` 
                            : `₹${code.discount_value}`}
                          {code.max_discount_amount && code.discount_type === 'percent' && (
                            <span className="text-slate-500 text-xs block">Max ₹{code.max_discount_amount}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {code.times_used || 0} / {code.max_uses}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {code.valid_until ? new Date(code.valid_until).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleCode(code)}
                            className={`px-2 py-1 rounded text-xs ${
                              code.is_active 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {code.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditDialog(code)}
                              className="p-1 text-slate-400 hover:text-blue-400"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCode(code.id)}
                              className="p-1 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Code Dialog */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? 'Edit Discount Code' : 'Create Discount Code'} / 
              {editingCode ? 'कोड संपादित करें' : 'नया कोड बनाएं'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Code / कोड</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newCode.code}
                  onChange={(e) => setNewCode(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., AIRSAVE20"
                  className="bg-slate-800 border-slate-600 text-white font-mono"
                />
                <Button variant="outline" onClick={generateRandomCode} className="border-slate-600">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Discount Type</Label>
                <select
                  value={newCode.discount_type}
                  onChange={(e) => setNewCode(prev => ({ ...prev, discount_type: e.target.value }))}
                  className="w-full mt-1 p-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div>
                <Label className="text-slate-300">
                  {newCode.discount_type === 'percent' ? 'Discount %' : 'Discount Amount (₹)'}
                </Label>
                <Input
                  type="number"
                  value={newCode.discount_value}
                  onChange={(e) => setNewCode(prev => ({ ...prev, discount_value: parseFloat(e.target.value) }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            
            {newCode.discount_type === 'percent' && (
              <div>
                <Label className="text-slate-300">Max Discount Amount (₹)</Label>
                <Input
                  type="number"
                  value={newCode.max_discount_amount}
                  onChange={(e) => setNewCode(prev => ({ ...prev, max_discount_amount: parseFloat(e.target.value) }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                  placeholder="e.g., 5000"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Max Uses</Label>
                <Input
                  type="number"
                  value={newCode.max_uses}
                  onChange={(e) => setNewCode(prev => ({ ...prev, max_uses: parseInt(e.target.value) }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">Min Booking (₹)</Label>
                <Input
                  type="number"
                  value={newCode.min_booking_amount}
                  onChange={(e) => setNewCode(prev => ({ ...prev, min_booking_amount: parseFloat(e.target.value) }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Valid From</Label>
                <Input
                  type="date"
                  value={newCode.valid_from}
                  onChange={(e) => setNewCode(prev => ({ ...prev, valid_from: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">Valid Until</Label>
                <Input
                  type="date"
                  value={newCode.valid_until}
                  onChange={(e) => setNewCode(prev => ({ ...prev, valid_until: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-slate-300">Description (Optional)</Label>
              <Input
                value={newCode.description}
                onChange={(e) => setNewCode(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Diwali Special Offer"
                className="bg-slate-800 border-slate-600 text-white mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCodeDialog(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button onClick={handleCreateCode} disabled={saving} className="bg-purple-500 hover:bg-purple-600">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {editingCode ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReferralSettings;
