import React, { useState, useEffect } from 'react';
import { 
  Tag, Plus, Edit2, Trash2, Loader2, Check, X, Copy, 
  Calendar, Users, IndianRupee, Percent, Clock, Search,
  ToggleLeft, ToggleRight, RefreshCw, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { referralAPI } from '../../services/api';
import { toast } from 'sonner';

function AdminDiscountCodes() {
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState(null);
  const [generating, setGenerating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: 10,
    max_uses: 100,
    min_booking_amount: 10000,
    max_discount_amount: 5000,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_active: true,
    description: ''
  });

  useEffect(() => {
    loadCodes();
  }, [filterActive]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const params = filterActive !== null ? { is_active: filterActive } : {};
      const res = await referralAPI.getDiscountCodes(params);
      setCodes(res.data.codes || []);
    } catch (error) {
      toast.error('Failed to load discount codes');
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await referralAPI.generateCodeString({ prefix: 'AIR', length: 6 });
      setFormData(prev => ({ ...prev, code: res.data.code }));
      toast.success('Code generated!');
    } catch (error) {
      toast.error('Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.code.trim()) {
      toast.error('Please enter or generate a code');
      return;
    }
    
    try {
      await referralAPI.createDiscountCode({
        ...formData,
        code: formData.code.toUpperCase(),
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString()
      });
      toast.success('Discount code created!');
      setShowCreate(false);
      resetForm();
      loadCodes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create code');
    }
  };

  const handleUpdate = async () => {
    try {
      await referralAPI.updateDiscountCode(editingCode.id, {
        ...formData,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString()
      });
      toast.success('Discount code updated!');
      setEditingCode(null);
      resetForm();
      loadCodes();
    } catch (error) {
      toast.error('Failed to update code');
    }
  };

  const handleDelete = async (codeId) => {
    if (!window.confirm('Delete this discount code?')) return;
    
    try {
      await referralAPI.deleteDiscountCode(codeId);
      toast.success('Code deleted!');
      loadCodes();
    } catch (error) {
      toast.error('Failed to delete code');
    }
  };

  const toggleActive = async (code) => {
    try {
      await referralAPI.updateDiscountCode(code.id, { is_active: !code.is_active });
      toast.success(code.is_active ? 'Code deactivated' : 'Code activated');
      loadCodes();
    } catch (error) {
      toast.error('Failed to toggle status');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discount_type: 'percent',
      discount_value: 10,
      max_uses: 100,
      min_booking_amount: 10000,
      max_discount_amount: 5000,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_active: true,
      description: ''
    });
  };

  const startEdit = (code) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      max_uses: code.max_uses,
      min_booking_amount: code.min_booking_amount,
      max_discount_amount: code.max_discount_amount || 5000,
      valid_from: code.valid_from?.split('T')[0] || '',
      valid_until: code.valid_until?.split('T')[0] || '',
      is_active: code.is_active,
      description: code.description || ''
    });
    setShowCreate(true);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  const filteredCodes = codes.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isExpired = (code) => {
    return new Date(code.valid_until) < new Date();
  };

  const usagePercent = (code) => {
    return Math.round((code.times_used / code.max_uses) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag className="h-6 w-6 text-purple-400" />
            Discount Codes</h2>
          <p className="text-slate-400 mt-1">Create and manage promo codes for customers</p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setEditingCode(null); resetForm(); }}
          className="bg-purple-500 hover:bg-purple-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Code
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/30">
          <Tag className="h-6 w-6 text-purple-400 mb-2" />
          <p className="text-2xl font-bold text-white">{codes.length}</p>
          <p className="text-slate-400 text-sm">Total Codes</p>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
          <Check className="h-6 w-6 text-green-400 mb-2" />
          <p className="text-2xl font-bold text-green-400">{codes.filter(c => c.is_active && !isExpired(c)).length}</p>
          <p className="text-slate-400 text-sm">Active Codes</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-xl p-4 border border-orange-500/30">
          <Users className="h-6 w-6 text-orange-400 mb-2" />
          <p className="text-2xl font-bold text-orange-400">{codes.reduce((sum, c) => sum + (c.times_used || 0), 0)}</p>
          <p className="text-slate-400 text-sm">Total Uses</p>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl p-4 border border-red-500/30">
          <Clock className="h-6 w-6 text-red-400 mb-2" />
          <p className="text-2xl font-bold text-red-400">{codes.filter(c => isExpired(c)).length}</p>
          <p className="text-slate-400 text-sm">Expired</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search codes..."
            className="pl-10 bg-slate-800 border-slate-600 text-white"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setFilterActive(null)}
            variant={filterActive === null ? 'default' : 'outline'}
            size="sm"
            className={filterActive === null ? 'bg-slate-700' : 'border-slate-600'}
          >
            All
          </Button>
          <Button
            onClick={() => setFilterActive(true)}
            variant={filterActive === true ? 'default' : 'outline'}
            size="sm"
            className={filterActive === true ? 'bg-green-600' : 'border-slate-600'}
          >
            Active
          </Button>
          <Button
            onClick={() => setFilterActive(false)}
            variant={filterActive === false ? 'default' : 'outline'}
            size="sm"
            className={filterActive === false ? 'bg-red-600' : 'border-slate-600'}
          >
            Inactive
          </Button>
        </div>
        <Button onClick={loadCodes} variant="outline" size="sm" className="border-slate-600">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingCode ? 'Edit Discount Code' : 'Create Discount Code'}
            </h3>
            
            <div className="space-y-4">
              {/* Code */}
              <div>
                <Label className="text-white">Code*</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="AIRYATRA10"
                    className="bg-slate-800 border-slate-600 text-white uppercase"
                    disabled={editingCode}
                  />
                  {!editingCode && (
                    <Button onClick={generateCode} variant="outline" className="border-slate-600" disabled={generating}>
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Type</Label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value }))}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-2 text-white"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-white">Value*</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      value={formData.discount_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) }))}
                      className="bg-slate-800 border-slate-600 text-white pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {formData.discount_type === 'percent' ? '%' : '₹'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Max Discount (for percent) */}
              {formData.discount_type === 'percent' && (
                <div>
                  <Label className="text-white">Max Discount Amount</Label>
                  <Input
                    type="number"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_discount_amount: parseFloat(e.target.value) }))}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                    placeholder="5000"
                  />
                </div>
              )}

              {/* Usage & Min Booking */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Max Uses</Label>
                  <Input
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_uses: parseInt(e.target.value) }))}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Min Booking (₹)</Label>
                  <Input
                    type="number"
                    value={formData.min_booking_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_booking_amount: parseFloat(e.target.value) }))}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white">Valid From</Label>
                  <Input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white">Valid Until</Label>
                  <Input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                    className="mt-1 bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-white">Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Diwali Special Offer..."
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                <span className="text-white">Active</span>
                <button
                  onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`p-1 rounded-full ${formData.is_active ? 'bg-green-500' : 'bg-slate-600'}`}
                >
                  {formData.is_active ? (
                    <ToggleRight className="h-6 w-6 text-white" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-white" />
                  )}
                </button>
              </div>

              {/* Preview */}
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <p className="text-purple-400 text-sm font-semibold mb-2">Preview</p>
                <p className="text-white">
                  Code: <span className="font-mono font-bold">{formData.code || 'XXXXXX'}</span>
                </p>
                <p className="text-slate-400 text-sm">
                  {formData.discount_type === 'percent' 
                    ? `${formData.discount_value}% off (max ₹${formData.max_discount_amount})`
                    : `Flat ₹${formData.discount_value} off`
                  }
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Min booking: ₹{formData.min_booking_amount?.toLocaleString()} • Max {formData.max_uses} uses
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => { setShowCreate(false); setEditingCode(null); resetForm(); }}
                variant="outline"
                className="flex-1 border-slate-600"
              >
                Cancel
              </Button>
              <Button
                onClick={editingCode ? handleUpdate : handleCreate}
                className="flex-1 bg-purple-500 hover:bg-purple-600"
              >
                {editingCode ? 'Update Code' : 'Create Code'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Codes Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      ) : filteredCodes.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <Tag className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No discount codes found</p>
          <p className="text-slate-500 text-sm">Create your first promo code</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left p-4 text-slate-400 font-medium">Code</th>
                <th className="text-left p-4 text-slate-400 font-medium">Discount</th>
                <th className="text-left p-4 text-slate-400 font-medium">Usage</th>
                <th className="text-left p-4 text-slate-400 font-medium">Validity</th>
                <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.map((code) => (
                <tr key={code.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white bg-slate-700 px-2 py-1 rounded">
                        {code.code}
                      </span>
                      <button onClick={() => copyCode(code.code)} className="text-slate-400 hover:text-white">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    {code.description && (
                      <p className="text-slate-500 text-xs mt-1">{code.description}</p>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-white">
                      {code.discount_type === 'percent' ? (
                        <>
                          <Percent className="h-4 w-4 text-green-400" />
                          <span>{code.discount_value}%</span>
                          <span className="text-slate-500 text-xs">(max ₹{code.max_discount_amount})</span>
                        </>
                      ) : (
                        <>
                          <IndianRupee className="h-4 w-4 text-green-400" />
                          <span>₹{code.discount_value}</span>
                        </>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs">Min: ₹{code.min_booking_amount?.toLocaleString()}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${usagePercent(code) >= 90 ? 'bg-red-500' : usagePercent(code) >= 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${usagePercent(code)}%` }}
                        />
                      </div>
                      <span className="text-slate-400 text-sm">
                        {code.times_used || 0}/{code.max_uses}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-400 text-sm">
                      <p>{new Date(code.valid_from).toLocaleDateString()}</p>
                      <p className="text-slate-500">to {new Date(code.valid_until).toLocaleDateString()}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    {isExpired(code) ? (
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Expired</span>
                    ) : code.is_active ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded text-xs">Inactive</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActive(code)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title={code.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {code.is_active ? (
                          <ToggleRight className="h-4 w-4 text-green-400" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(code)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(code.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminDiscountCodes;
