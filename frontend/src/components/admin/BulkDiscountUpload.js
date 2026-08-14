import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Download, Loader2, RefreshCw, Percent, DollarSign, Calendar, Users, Tag, Trash2, Edit, Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '../../services/api';
import { toast } from 'sonner';

export default function BulkDiscountUpload() {
  const [activeTab, setActiveTab] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDiscount, setNewDiscount] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_booking_amount: 0,
    max_discount_amount: '',
    valid_from: '',
    valid_until: '',
    usage_limit: 100,
    per_user_limit: 1,
    applicable_services: 'all',
    description: ''
  });

  // Load discounts list
  const loadDiscounts = useCallback(async () => {
    setLoadingDiscounts(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/discounts/list', { 
          params: { 
            limit: 50, 
            status: statusFilter !== 'all' ? statusFilter : undefined,
            search: searchQuery || undefined
          }
        }),
        api.get('/discounts/stats')
      ]);
      
      setDiscounts(listRes.data.discounts || []);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to load discounts');
    } finally {
      setLoadingDiscounts(false);
    }
  }, [statusFilter, searchQuery]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setPreview(null);
    } else {
      toast.error('Please select a CSV file');
    }
  };

  // Preview upload
  const handlePreview = async () => {
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/discounts/bulk-upload/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setPreview(response.data);
      
      if (response.data.valid_rows > 0) {
        toast.success(`Found ${response.data.valid_rows} valid discount codes`);
      }
      if (response.data.invalid_rows > 0) {
        toast.warning(`${response.data.invalid_rows} rows have errors`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to preview file');
    } finally {
      setUploading(false);
    }
  };

  // Confirm upload
  const handleConfirmUpload = async () => {
    if (!file) return;
    
    setConfirming(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/discounts/bulk-upload/confirm?skip_invalid=true', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`Created ${response.data.created_count} discount codes!`);
      setFile(null);
      setPreview(null);
      setActiveTab('manage');
      loadDiscounts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload');
    } finally {
      setConfirming(false);
    }
  };

  // Create single discount
  const handleCreateDiscount = async () => {
    try {
      const payload = {
        ...newDiscount,
        code: newDiscount.code.toUpperCase(),
        max_discount_amount: newDiscount.max_discount_amount ? parseFloat(newDiscount.max_discount_amount) : null,
        valid_from: new Date(newDiscount.valid_from).toISOString(),
        valid_until: new Date(newDiscount.valid_until).toISOString(),
        applicable_services: newDiscount.applicable_services.split(',').map(s => s.trim())
      };
      
      await api.post('/discounts/create', payload);
      toast.success(`Discount code ${newDiscount.code.toUpperCase()} created!`);
      setShowCreateDialog(false);
      setNewDiscount({
        code: '', discount_type: 'percentage', discount_value: 10, min_booking_amount: 0,
        max_discount_amount: '', valid_from: '', valid_until: '', usage_limit: 100,
        per_user_limit: 1, applicable_services: 'all', description: ''
      });
      loadDiscounts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create discount');
    }
  };

  // Delete discount
  const handleDelete = async (discountId) => {
    if (!window.confirm('Deactivate this discount code?')) return;
    
    try {
      await api.delete(`/discounts/${discountId}`);
      toast.success('Discount deactivated');
      loadDiscounts();
    } catch (err) {
      toast.error('Failed to delete discount');
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/discounts/download-template');
      const blob = new Blob([response.data.template], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'discount_codes_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (err) {
      toast.error('Failed to download template');
    }
  };

  React.useEffect(() => {
    if (activeTab === 'manage') {
      loadDiscounts();
    }
  }, [activeTab, loadDiscounts]);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6" data-testid="bulk-discount-upload">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag className="h-6 w-6 text-green-400" />
            Discount Management</h1>
          <p className="text-slate-400 text-sm mt-1">Bulk upload and manage discount codes</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'upload' ? 'default' : 'outline'}
            onClick={() => setActiveTab('upload')}
            className={activeTab === 'upload' ? 'bg-green-500' : 'border-slate-600'}
          >
            <Upload className="h-4 w-4 mr-1" /> Bulk Upload
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'default' : 'outline'}
            onClick={() => setActiveTab('manage')}
            className={activeTab === 'manage' ? 'bg-blue-500' : 'border-slate-600'}
          >
            <Tag className="h-4 w-4 mr-1" /> Manage Codes
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && activeTab === 'manage' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass p-4 rounded-xl">
            <p className="text-2xl font-bold text-white">{stats.total_codes}</p>
            <p className="text-xs text-slate-400">Total Codes</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-2xl font-bold text-green-400">{stats.active_codes}</p>
            <p className="text-xs text-slate-400">Active</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-2xl font-bold text-slate-400">{stats.expired_codes}</p>
            <p className="text-xs text-slate-400">Expired</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-xs text-slate-400 mb-1">Top Used</p>
            <p className="text-white font-mono text-sm">{stats.top_used_codes?.[0]?.code || 'N/A'}</p>
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="glass rounded-xl p-6">
          {/* Instructions */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-6">
            <h3 className="text-blue-400 font-medium mb-2">CSV Format Instructions</h3>
            <p className="text-slate-400 text-sm mb-2">
              Upload a CSV file with the following columns:
            </p>
            <code className="text-xs text-slate-300 block p-2 bg-slate-800 rounded">
              code, discount_type, discount_value, min_booking_amount, max_discount_amount, valid_from, valid_until, usage_limit, per_user_limit, applicable_services, description
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadTemplate}
              className="mt-3 border-blue-500/50 text-blue-400"
            >
              <Download className="h-4 w-4 mr-1" /> Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center">
            <input
              type="file"
              id="csv-upload"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 mx-auto text-slate-400 mb-3" />
              {file ? (
                <div>
                  <p className="text-green-400 font-medium">{file.name}</p>
                  <p className="text-slate-500 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-slate-300">Click to upload CSV file</p>
                  <p className="text-slate-500 text-sm mt-1">or drag and drop</p>
                </div>
              )}
            </label>
          </div>

          {/* Action Buttons */}
          {file && !preview && (
            <div className="mt-4 flex justify-center gap-3">
              <Button
                onClick={() => { setFile(null); }}
                variant="outline"
                className="border-slate-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={uploading}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                Preview
              </Button>
            </div>
          )}

          {/* Preview Results */}
          {preview && (
            <div className="mt-6 space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-slate-800">
                  <p className="text-2xl font-bold text-white">{preview.total_rows}</p>
                  <p className="text-xs text-slate-400">Total Rows</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-2xl font-bold text-green-400">{preview.valid_rows}</p>
                  <p className="text-xs text-slate-400">Valid</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-2xl font-bold text-red-400">{preview.invalid_rows}</p>
                  <p className="text-xs text-slate-400">Invalid</p>
                </div>
              </div>

              {/* Errors */}
              {preview.errors?.length > 0 && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <h4 className="text-red-400 font-medium mb-2">Errors ({preview.errors.length})</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {preview.errors.slice(0, 10).map((err, idx) => (
                      <p key={idx} className="text-sm text-slate-400">
                        Row {err.row}: <span className="text-red-400">{err.error}</span>
                        {err.code && <span className="text-slate-500"> ({err.code})</span>}
                      </p>
                    ))}
                    {preview.errors.length > 10 && (
                      <p className="text-slate-500 text-sm">...and {preview.errors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {preview.preview?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="p-2 text-left text-slate-400">Code</th>
                        <th className="p-2 text-left text-slate-400">Discount</th>
                        <th className="p-2 text-left text-slate-400">Valid From</th>
                        <th className="p-2 text-left text-slate-400">Valid Until</th>
                        <th className="p-2 text-left text-slate-400">Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.slice(0, 10).map((item, idx) => (
                        <tr key={idx} className="border-t border-slate-700">
                          <td className="p-2 font-mono text-white">{item.code}</td>
                          <td className="p-2 text-green-400">{item.discount_display}</td>
                          <td className="p-2 text-slate-400">{formatDate(item.valid_from)}</td>
                          <td className="p-2 text-slate-400">{formatDate(item.valid_until)}</td>
                          <td className="p-2 text-slate-400">{item.usage_limit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.preview.length > 10 && (
                    <p className="text-slate-500 text-sm text-center mt-2">
                      Showing 10 of {preview.preview.length} valid codes
                    </p>
                  )}
                </div>
              )}

              {/* Confirm Button */}
              <div className="flex justify-center gap-3">
                <Button
                  onClick={() => { setFile(null); setPreview(null); }}
                  variant="outline"
                  className="border-slate-600"
                >
                  Cancel
                </Button>
                {preview.valid_rows > 0 && (
                  <Button
                    onClick={handleConfirmUpload}
                    disabled={confirming}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    {confirming ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    Create {preview.valid_rows} Codes
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          {/* Search & Actions */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
            <Button onClick={loadDiscounts} variant="outline" className="border-slate-600">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-green-500 hover:bg-green-600">
              <Plus className="h-4 w-4 mr-1" /> Create Code
            </Button>
          </div>

          {/* Discounts Table */}
          <div className="glass rounded-xl overflow-hidden">
            {loadingDiscounts ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
              </div>
            ) : discounts.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="h-12 w-12 mx-auto text-slate-600 mb-2" />
                <p className="text-slate-400">No discount codes found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="p-4 text-left text-slate-400 font-medium">Code</th>
                      <th className="p-4 text-left text-slate-400 font-medium">Discount</th>
                      <th className="p-4 text-left text-slate-400 font-medium">Validity</th>
                      <th className="p-4 text-center text-slate-400 font-medium">Usage</th>
                      <th className="p-4 text-left text-slate-400 font-medium">Status</th>
                      <th className="p-4 text-right text-slate-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.map((discount) => (
                      <tr key={discount.discount_id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                        <td className="p-4">
                          <p className="font-mono text-white font-medium">{discount.code}</p>
                          <p className="text-xs text-slate-500">{discount.description?.slice(0, 30)}</p>
                        </td>
                        <td className="p-4">
                          <span className={`font-semibold ${discount.discount_type === 'percentage' ? 'text-green-400' : 'text-blue-400'}`}>
                            {discount.discount_display}
                          </span>
                          {discount.min_booking_amount > 0 && (
                            <p className="text-xs text-slate-500">Min: ₹{discount.min_booking_amount.toLocaleString()}</p>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-slate-300 text-sm">{formatDate(discount.valid_from)}</p>
                          <p className="text-slate-500 text-xs">to {formatDate(discount.valid_until)}</p>
                        </td>
                        <td className="p-4 text-center">
                          <p className="text-white">{discount.times_used || 0}</p>
                          <p className="text-xs text-slate-500">/ {discount.usage_limit || '∞'}</p>
                        </td>
                        <td className="p-4">
                          {discount.is_expired || !discount.is_active ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-slate-500/20 text-slate-400">
                              Expired
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(discount.discount_id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Discount Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-400" />
              Create Discount Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Code *</Label>
                <Input
                  value={newDiscount.code}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="SUMMER20"
                  className="mt-1 bg-slate-800 border-slate-600 text-white font-mono"
                />
              </div>
              <div>
                <Label className="text-slate-300">Type *</Label>
                <select
                  value={newDiscount.discount_type}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, discount_type: e.target.value }))}
                  className="mt-1 w-full p-2 rounded-md bg-slate-800 border border-slate-600 text-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Discount Value *</Label>
                <Input
                  type="number"
                  value={newDiscount.discount_value}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, discount_value: parseFloat(e.target.value) }))}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Max Discount (optional)</Label>
                <Input
                  type="number"
                  value={newDiscount.max_discount_amount}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, max_discount_amount: e.target.value }))}
                  placeholder="5000"
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Valid From *</Label>
                <Input
                  type="date"
                  value={newDiscount.valid_from}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, valid_from: e.target.value }))}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Valid Until *</Label>
                <Input
                  type="date"
                  value={newDiscount.valid_until}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, valid_until: e.target.value }))}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Usage Limit</Label>
                <Input
                  type="number"
                  value={newDiscount.usage_limit}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, usage_limit: parseInt(e.target.value) }))}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300">Per User Limit</Label>
                <Input
                  type="number"
                  value={newDiscount.per_user_limit}
                  onChange={(e) => setNewDiscount(prev => ({ ...prev, per_user_limit: parseInt(e.target.value) }))}
                  className="mt-1 bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Description</Label>
              <Input
                value={newDiscount.description}
                onChange={(e) => setNewDiscount(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Summer sale discount"
                className="mt-1 bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-slate-600">
              Cancel
            </Button>
            <Button
              onClick={handleCreateDiscount}
              disabled={!newDiscount.code || !newDiscount.valid_from || !newDiscount.valid_until}
              className="bg-green-500 hover:bg-green-600"
            >
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
